'use strict';

import { parseDockerLine } from '../domain/docker-event.js';
import { normalizeHook } from '../domain/hook-normalizer.js';

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
    services: { fileWatcher },
  } = dependencies;

  const recentToolWrites = new Map();

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

  const SESSION_SIDE_EFFECTS = Object.freeze({
    'session.end': ({ sessionId, ts }) => {
      sessionsRepository.end(sessionId, ts);
      fileWatcher.unwatch(sessionId);
    },
  });

  const ingestHook = async ({ data, onFinish }) => {
    Logger.verbose(`Collector::ingestHook ${data.hook_event_name}`);
    try {
      const events = normalizeHook(data, clock());
      const [first] = events;

      const isNew = sessionsRepository.touch({
        id: first.sessionId,
        cwd: data.cwd,
        ts: first.ts,
        count: events.length,
      });

      // Sessions started before the collector still get a watcher: the first
      // hook of any kind is enough to know where the session works.
      if (isNew && data.cwd) fileWatcher.watch(first.sessionId, data.cwd);

      events.forEach(store);
      events.forEach(event => SESSION_SIDE_EFFECTS[event.kind]?.(event));

      return onFinish.NO_CONTENT();
    } catch (error) {
      logFailure('Collector::ingestHook', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

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
   * @param {string} line  one line of `docker events --format '{{json .}}'`
   * @returns {object|null}
   */
  const recordDockerLine = line => {
    const container = parseDockerLine(line);
    return container ? recordContainerEvent(container) : null;
  };

  return {
    ingestHook,
    listSessionEvents,
    listSessions,
    recordContainerEvent,
    recordDockerLine,
    recordFileChange,
  };
};
