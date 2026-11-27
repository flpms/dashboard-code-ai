'use strict';

import { parseDockerLine } from '../domain/docker-event.js';
import { normalizeHook } from '../domain/hook-normalizer.js';
import { isDependencyFile, isInstallCommand, parseNpmAudit } from '../domain/npm-audit.js';
import { TranscriptTranslator } from '../domain/transcript.js';

/**
 * The collector's rules: turn hooks, container events and file changes into
 * one ordered log per session, and announce every new event to the dashboard.
 *
 * HTTP use cases receive `{ data, onFinish }` and call exactly one outcome.
 * The watcher-driven ones (`recordContainerEvent`, `recordFileChange`) are
 * called by services with plain values and return what they stored, because
 * nobody is waiting on a socket for them.
 */

// A container that starts within this window after a `docker …` or test
// command is attributed to the session that ran it.
const CONTAINER_ATTRIBUTION_MS = 120_000;

// A disk change this soon after an Edit/Write to the same path is that edit,
// seen a second time by the watcher.
const DUPLICATE_WRITE_MS = 3_000;

const KEY_SEPARATOR = '\u0000';

export const Collector = dependencies => {
  const {
    clock,
    enums: { HTTP_MESSAGES },
    eventBus,
    Logger,
    repositories: { eventsRepository, sessionsRepository },
    serializers: { serializeEventList, serializeSessionList },
    services: { fileWatcher, securityAuditor },
  } = dependencies;

  const recentToolWrites = new Map();

  // Sessions that reached us through HTTP hooks in this run. Their transcript
  // says the same thing later and with less detail, so it is ignored.
  const hookedSessions = new Set();
  const transcripts = TranscriptTranslator();

  const logFailure = (location, error) => {
    Logger.error(`${location} - ${error.message}`);
    Logger.verbose(`${location} - ${error.stack}`);
  };

  const sinceMs = (ts, ms) => new Date(Date.parse(ts) - ms).toISOString();

  const forget = nowMs =>
    [...recentToolWrites.entries()]
      .filter(([, at]) => nowMs - at > DUPLICATE_WRITE_MS)
      .forEach(([key]) => recentToolWrites.delete(key));

  const rememberToolWrite = event => {
    const nowMs = Date.parse(event.ts);
    forget(nowMs);
    recentToolWrites.set([event.sessionId, event.data.path].join(KEY_SEPARATOR), nowMs);
  };

  const isEcho = (sessionId, path, ts) => {
    const at = recentToolWrites.get([sessionId, path].join(KEY_SEPARATOR));
    return at !== undefined && Date.parse(ts) - at <= DUPLICATE_WRITE_MS;
  };

  // The Agent tool call that launched a subagent is the most recent one not
  // yet claimed by another subagent. Hooks do not name the parent, so this is
  // inferred from order — exact for sequential launches, best effort when
  // several start in the same instant.
  const withParent = event => {
    if (event.kind !== 'agent.start') return event;

    const claimed = new Set(eventsRepository.linkedLaunchSpans(event.sessionId));
    const launch = eventsRepository
      .agentLaunches(event.sessionId)
      .find(row => !claimed.has(row.span_id));

    if (!launch) return { ...event, parentAgentId: 'main' };

    return {
      ...event,
      parentAgentId: launch.agent_id,
      data: { ...event.data, parentSpanId: launch.span_id },
    };
  };

  const store = event => {
    const linked = withParent(event);
    const seq = eventsRepository.insert(linked);
    const published = { parentAgentId: null, ...linked, seq };

    if (linked.kind === 'file.change' && linked.data.source === 'tool') rememberToolWrite(linked);

    eventBus.publish(published);
    return published;
  };

  // Events after which the session's dependencies may have changed.
  const touchesDependencies = event =>
    (event.kind === 'file.change' && isDependencyFile(event.data.path)) ||
    (event.kind === 'tool.end' && isInstallCommand(event.data.command));

  const SESSION_SIDE_EFFECTS = Object.freeze({
    'session.end': ({ sessionId, ts }) => {
      sessionsRepository.end(sessionId, ts);
      fileWatcher.unwatch(sessionId);
    },
  });

  // One hook payload, from HTTP or translated from a transcript, into stored
  // events. `now` is when it happened.
  const ingest = (data, now) => {
    const events = normalizeHook(data, now);
    const [first] = events;

    const isNew = sessionsRepository.touch({
      id: first.sessionId,
      cwd: data.cwd,
      ts: first.ts,
      count: events.length,
    });

    // Sessions started before the collector still get a watcher: the first
    // hook of any kind is enough to know where the session works.
    // ...and a first security audit, so the instrument has a baseline
    // before the agent changes anything.
    if (isNew && data.cwd) {
      fileWatcher.watch(first.sessionId, data.cwd);
      securityAuditor.request(first.sessionId, data.cwd);
    }

    if (data.cwd && events.some(touchesDependencies)) {
      securityAuditor.request(first.sessionId, data.cwd);
    }

    const stored = events.map(store);
    events.forEach(event => SESSION_SIDE_EFFECTS[event.kind]?.(event));
    return stored;
  };

  const ingestHook = async ({ data, onFinish }) => {
    Logger.verbose(`Collector::ingestHook ${data.hook_event_name}`);
    try {
      hookedSessions.add(data.session_id);
      ingest(data, clock());
      return onFinish.NO_CONTENT();
    } catch (error) {
      logFailure('Collector::ingestHook', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  /**
   * One line of a Claude Code transcript, for sessions that send no hooks.
   *
   * @param {{ entry: Record<string, any>, source: { agentId: string|null, agentType: string|null, launchedBy: string|null } }} line
   * @returns {object[]} the stored events
   */
  const recordTranscriptEntry = ({ entry, source }) => {
    try {
      if (source.agentId && source.launchedBy) {
        transcripts.linkSubagent(source.launchedBy, {
          agentId: source.agentId,
          agentType: source.agentType,
        });
      }
      if (hookedSessions.has(entry.sessionId)) return [];

      return transcripts.translate(entry, source).flatMap(({ payload, ts }) => ingest(payload, ts));
    } catch (error) {
      logFailure('Collector::recordTranscriptEntry', error);
      return [];
    }
  };

  /** @param {string} sessionId */
  const isKnownSession = sessionId => sessionsRepository.exists(sessionId);

  const listSessions = async ({ data, onFinish }) => {
    Logger.verbose('Collector::listSessions');
    try {
      return onFinish.OK({ sessions: serializeSessionList(sessionsRepository.list(data.limit)) });
    } catch (error) {
      logFailure('Collector::listSessions', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  const listSessionEvents = async ({ data, onFinish }) => {
    Logger.verbose('Collector::listSessionEvents');
    try {
      const { sessionId, after, limit } = data;
      const events = serializeEventList(eventsRepository.listBySession(sessionId, after, limit));
      return onFinish.OK({ events, last: events.at(-1)?.seq ?? after });
    } catch (error) {
      logFailure('Collector::listSessionEvents', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  /**
   * @param {{ kind: string, containerId: string, name: string, image: string, exitCode: number|null, ts: string }} container
   * @returns {object|null} the stored event, or null when no session claims it
   */
  // Who started a container: the session (and agent, and call) whose docker or
  // test command ran just before it, else the session active at that moment.
  const containerCause = ts => {
    const since = sinceMs(ts, CONTAINER_ATTRIBUTION_MS);
    const cause = eventsRepository.latestContainerCause(since);

    if (cause) {
      return {
        sessionId: cause.session_id,
        agentId: cause.agent_id,
        agentType: cause.agent_type ?? null,
        spanId: cause.span_id ?? null,
        attributedBy: 'command',
      };
    }

    const sessionId = sessionsRepository.mostRecentActiveSince(since);
    if (!sessionId) return null;

    return { sessionId, agentId: 'main', agentType: null, spanId: null, attributedBy: 'recency' };
  };

  const containerStatus = ({ kind, exitCode }) =>
    kind === 'container.die' && exitCode ? 'error' : 'ok';

  /**
   * @param {{ kind: string, containerId: string, name: string, image: string, exitCode: number|null, ts: string }} container
   * @returns {object|null} the stored event, or null when no session claims it
   */
  const recordContainerEvent = container => {
    try {
      const cause = containerCause(container.ts);

      if (!cause) {
        Logger.verbose(`Collector::recordContainerEvent - unclaimed ${container.name}`);
        return null;
      }

      const { kind, ts, ...details } = container;
      const { attributedBy, ...owner } = cause;

      sessionsRepository.touch({ id: owner.sessionId, cwd: null, ts, count: 1 });

      return store({
        ...owner,
        ts,
        kind,
        name: details.name,
        category: 'docker',
        status: containerStatus(container),
        data: { ...details, attributedBy },
      });
    } catch (error) {
      logFailure('Collector::recordContainerEvent', error);
      return null;
    }
  };

  /**
   * @param {{ sessionId: string, path: string }} change  `path` is absolute
   * @returns {object|null} the stored event, or null for an echo of a tool edit
   */
  const recordFileChange = ({ sessionId, path }) => {
    try {
      const ts = clock();

      if (isDependencyFile(path))
        securityAuditor.request(sessionId, sessionsRepository.cwdOf(sessionId));

      if (isEcho(sessionId, path, ts)) return null;

      sessionsRepository.touch({ id: sessionId, cwd: null, ts, count: 1 });

      return store({
        sessionId,
        ts,
        kind: 'file.change',
        agentId: 'main',
        agentType: null,
        spanId: null,
        name: null,
        category: 'edit',
        status: 'ok',
        data: { path, op: 'disk', source: 'watcher' },
      });
    } catch (error) {
      logFailure('Collector::recordFileChange', error);
      return null;
    }
  };

  /**
   * @param {{ key: string, cwd: string, output: string }} result  an npm audit run, `key` = session id
   * @returns {object|null} the stored event, or null when the output was not an audit report
   */
  const recordAudit = ({ key: sessionId, cwd, output }) => {
    try {
      const summary = parseNpmAudit(output);

      if (!summary) {
        Logger.verbose(`Collector::recordAudit - no report for ${cwd}`);
        return null;
      }

      const ts = clock();
      const serious = summary.counts.critical + summary.counts.high;

      sessionsRepository.touch({ id: sessionId, cwd: null, ts, count: 1 });

      return store({
        sessionId,
        ts,
        kind: 'security.audit',
        agentId: 'main',
        agentType: null,
        spanId: null,
        name: 'npm audit',
        category: 'security',
        status: serious ? 'error' : 'ok',
        data: { ...summary, cwd },
      });
    } catch (error) {
      logFailure('Collector::recordAudit', error);
      return null;
    }
  };

  /**
   * @param {string} line  one line of `docker events --format '{{json .}}'`
   * @returns {object|null}
   */
  const recordDockerLine = line => {
    const container = parseDockerLine(line);
    return container ? recordContainerEvent(container) : null;
  };

  return {
    ingestHook,
    isKnownSession,
    recordTranscriptEntry,
    recordAudit,
    listSessionEvents,
    listSessions,
    recordContainerEvent,
    recordDockerLine,
    recordFileChange,
  };
};
