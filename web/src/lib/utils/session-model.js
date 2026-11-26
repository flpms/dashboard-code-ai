/**
 * The event log of one session → everything the dashboard draws.
 *
 * Pure: events in, a model out. The page re-derives it whenever an event
 * arrives, so there is no second copy of the state to drift — the log is the
 * truth, and this is a projection of it. Each event kind is a row in
 * REDUCERS; a kind with no row is simply ignored.
 *
 * @import { Alert, AgentLane, CollectorEvent, ContainerState, Count, FileActivity, SecurityReport, SessionModel, TestRun, ToolSpan } from '$lib/types.js'
 */

const MAIN = 'main';

// A tool that fails this many times in a row, on the same agent, is stuck.
const FAILURE_STREAK = 3;

const MAX_DEPTH = 8;

/** @type {Record<string, (event: CollectorEvent) => ContainerState['state']>} */
const CONTAINER_STATES = {
  'container.create': () => 'stopped',
  'container.start': () => 'running',
  'container.stop': () => 'stopped',
  'container.kill': () => 'stopped',
  'container.destroy': () => 'stopped',
  'container.die': event => (event.data.exitCode ? 'failed' : 'stopped'),
};

Object.freeze(CONTAINER_STATES);

const MCP_SERVER = /^mcp__([^_]+(?:_[^_]+)*?)__/;

/**
 * @typedef {Object} Accumulator
 * @property {Map<string, AgentLane>} agents
 * @property {Map<string, ToolSpan>} spans
 * @property {Map<string, ContainerState>} containers
 * @property {TestRun[]} tests
 * @property {Map<string, FileActivity>} files
 * @property {Set<string>} reads
 * @property {Map<string, number>} skills
 * @property {Map<string, number>} mcp
 * @property {Map<string, number>} agentTypes
 * @property {Map<string, { name: string, count: number }>} streaks
 * @property {SecurityReport|null} security
 * @property {number} startMs
 * @property {number} endMs
 */

/** @returns {Accumulator} */
const emptyAccumulator = () => ({
  agents: new Map(),
  spans: new Map(),
  containers: new Map(),
  tests: [],
  files: new Map(),
  reads: new Set(),
  skills: new Map(),
  mcp: new Map(),
  agentTypes: new Map(),
  streaks: new Map(),
  security: null,
  startMs: Infinity,
  endMs: -Infinity,
});

/**
 * @param {Map<string, number>} counter
 * @param {string} key
 */
const bump = (counter, key) => counter.set(key, (counter.get(key) ?? 0) + 1);

/**
 * Lanes appear the first time an agent is seen, even without its agent.start
 * (a collector started mid-session still draws what it receives).
 *
 * @param {Accumulator} acc
 * @param {CollectorEvent} event
 * @param {number} ms
 * @returns {AgentLane}
 */
const laneFor = (acc, event, ms) => {
  const existing = acc.agents.get(event.agentId);
  if (existing) return existing;

  /** @type {AgentLane} */
  const lane = {
    id: event.agentId,
    type: event.agentId === MAIN ? 'principal' : (event.agentType ?? 'subagente'),
    parentId: event.agentId === MAIN ? null : (event.parentAgentId ?? MAIN),
    depth: 0,
    startMs: ms,
    endMs: null,
    spans: [],
  };
  acc.agents.set(event.agentId, lane);
  return lane;
};

/**
 * @param {Accumulator} acc
 * @param {CollectorEvent} event
 * @param {number} ms
 */
const countResources = (acc, event, ms) => {
  const summary = String(event.data.summary ?? '');
  if (event.category === 'skill') bump(acc.skills, summary || 'skill');
  if (event.category === 'agent') bump(acc.agentTypes, summary.split(':')[0] || 'agente');
  const server = event.name?.match(MCP_SERVER)?.[1];
  if (server) bump(acc.mcp, server);
  return ms;
};

/**
 * @param {Accumulator} acc
 * @param {ToolSpan} span
 */
const trackStreak = (acc, span) => {
  const key = `${span.agentId}:${span.name}`;
  if (span.status !== 'error') return acc.streaks.delete(key);
  const previous = acc.streaks.get(key)?.count ?? 0;
  acc.streaks.set(key, { name: span.name, count: previous + 1 });
};

/** @type {Record<string, (acc: Accumulator, event: CollectorEvent, ms: number) => void>} */
const REDUCERS = {
  'session.start': (acc, event, ms) => {
    laneFor(acc, event, ms);
  },
  'agent.start': (acc, event, ms) => {
    const lane = laneFor(acc, event, ms);
    acc.agents.set(event.agentId, {
      ...lane,
      type: event.agentType ?? lane.type,
      parentId: event.parentAgentId ?? lane.parentId,
      startMs: Math.min(lane.startMs, ms),
    });
  },
  'agent.end': (acc, event, ms) => {
    const lane = laneFor(acc, event, ms);
    acc.agents.set(event.agentId, { ...lane, endMs: ms });
  },
  'tool.start': (acc, event, ms) => {
    laneFor(acc, event, ms);
    const id = event.spanId ?? `seq-${event.seq}`;
    acc.spans.set(id, {
      id,
      agentId: event.agentId,
      name: event.name ?? 'tool',
      category: event.category ?? 'other',
      summary: String(event.data.summary ?? ''),
      startMs: ms,
      endMs: null,
      status: 'running',
      input: String(event.data.input ?? ''),
      output: '',
    });
    countResources(acc, event, ms);
  },
  'tool.end': (acc, event, ms) => {
    const id = event.spanId ?? `seq-${event.seq}`;
    const started = acc.spans.get(id);
    /** @type {ToolSpan} */
    const span = {
      ...(started ?? {
        id,
        agentId: event.agentId,
        name: event.name ?? 'tool',
        category: event.category ?? 'other',
        summary: '',
        startMs: ms,
        input: '',
      }),
      endMs: ms,
      status: event.status === 'error' ? 'error' : 'ok',
      output: String(event.data.output ?? ''),
    };
    acc.spans.set(id, span);
    trackStreak(acc, span);
  },
  'test.result': (acc, event, ms) => {
    const { runner = '', passed = 0, failed = 0, skipped = 0 } = event.data;
    acc.tests.push({ ms, runner, passed, failed, skipped });
  },
  'file.change': (acc, event) => {
    const path = String(event.data.path ?? '');
    const previous = acc.files.get(path);
    const agents = new Set([...(previous?.agents ?? []), event.agentId]);
    acc.files.set(path, {
      path,
      changes: (previous?.changes ?? 0) + 1,
      agents: [...agents],
      source: event.data.source === 'watcher' && previous?.source !== 'tool' ? 'watcher' : 'tool',
    });
  },
  // Only the latest audit matters: it describes the dependencies as they are now.
  'security.audit': (acc, event, ms) => {
    const { tool = 'npm', total = 0, counts = {}, advisories = [] } = event.data;
    acc.security = { ms, tool, total, counts, advisories };
  },
  'file.read': (acc, event) => {
    acc.reads.add(String(event.data.path ?? ''));
  },
};

Object.keys(CONTAINER_STATES).forEach(kind => {
  REDUCERS[kind] = (acc, event) => {
    const id = String(event.data.containerId ?? event.name ?? event.seq);
    acc.containers.set(id, {
      id,
      name: String(event.data.name ?? event.name ?? id),
      image: String(event.data.image ?? ''),
      state: CONTAINER_STATES[kind](event),
      exitCode: event.data.exitCode ?? null,
      agentId: event.agentId,
    });
  };
});

/**
 * Parents before children, siblings in start order, depth from the root — the
 * order the timeline draws its lanes in, like the frames of a flamegraph.
 *
 * @param {Map<string, AgentLane>} agents
 * @returns {AgentLane[]}
 */
const treeOrder = agents => {
  const lanes = [...agents.values()].sort((a, b) => a.startMs - b.startMs);
  const known = new Set(lanes.map(lane => lane.id));
  const fallback = known.has(MAIN) ? MAIN : null;

  // A parent the log never mentioned would orphan its children; they hang
  // under the main agent instead.
  const parentKey = /** @param {AgentLane} lane */ lane => {
    if (lane.id === MAIN) return null;
    if (lane.parentId && lane.parentId !== lane.id && known.has(lane.parentId))
      return lane.parentId;
    return fallback;
  };

  /**
   * @param {string|null} parentId
   * @param {number} depth
   * @returns {AgentLane[]}
   */
  const walk = (parentId, depth) => {
    // Hooks cannot produce a cycle, but a malformed log must not hang the tab.
    if (depth > MAX_DEPTH) return [];
    return lanes
      .filter(lane => parentKey(lane) === parentId)
      .flatMap(lane => [{ ...lane, depth }, ...walk(lane.id, depth + 1)]);
  };

  return walk(null, 0);
};

/**
 * @param {Map<string, number>} counter
 * @returns {Count[]}
 */
const toCounts = counter =>
  [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

/**
 * @param {Accumulator} acc
 * @returns {Alert[]}
 */
const alertsOf = acc => {
  const lastRun = acc.tests.at(-1);

  /** @type {Alert[]} */
  const streaks = [...acc.streaks.values()]
    .filter(streak => streak.count >= FAILURE_STREAK)
    .map(streak => ({
      level: 'warning',
      message: `${streak.name} falhou ${streak.count} vezes seguidas`,
    }));

  /** @type {Alert[]} */
  const containers = [...acc.containers.values()]
    .filter(container => container.state === 'failed')
    .map(container => ({
      level: 'critical',
      message: `Container ${container.name} caiu (código ${container.exitCode})`,
    }));

  /** @type {Alert[]} */
  const tests =
    lastRun && lastRun.failed > 0
      ? [{ level: 'critical', message: `${lastRun.failed} teste(s) falhando na última execução` }]
      : [];

  const serious = (acc.security?.counts.critical ?? 0) + (acc.security?.counts.high ?? 0);
  /** @type {Alert[]} */
  const security = serious
    ? [
        {
          level: 'critical',
          message: `${serious} vulnerabilidade(s) crítica(s) ou alta(s) nas dependências`,
        },
      ]
    : [];

  return [...tests, ...security, ...containers, ...streaks];
};

/**
 * @param {CollectorEvent[]} events  one session's log, in seq order
 * @param {number} nowMs             the right edge for spans still running
 * @returns {SessionModel}
 */
export const buildSessionModel = (events, nowMs) => {
  const acc = events.reduce((current, event) => {
    const ms = Date.parse(event.ts);
    current.startMs = Math.min(current.startMs, ms);
    current.endMs = Math.max(current.endMs, ms);
    REDUCERS[event.kind]?.(current, event, ms);
    return current;
  }, emptyAccumulator());

  const spansByAgent = Map.groupBy([...acc.spans.values()], span => span.agentId);
  const agents = treeOrder(acc.agents).map(lane => ({
    ...lane,
    spans: spansByAgent.get(lane.id) ?? [],
  }));

  const hasEvents = Number.isFinite(acc.startMs);
  const running = agents.some(agent => agent.endMs === null && agent.id !== MAIN);

  return {
    range: {
      startMs: hasEvents ? acc.startMs : nowMs,
      endMs: hasEvents ? Math.max(acc.endMs, running ? nowMs : acc.endMs) : nowMs,
    },
    agents,
    activeAgents: agents.filter(agent => agent.id !== MAIN && agent.endMs === null).length,
    containers: [...acc.containers.values()],
    tests: acc.tests,
    filesChanged: [...acc.files.values()].sort((a, b) => b.changes - a.changes),
    filesRead: acc.reads.size,
    resources: {
      skills: toCounts(acc.skills),
      mcp: toCounts(acc.mcp),
      agentTypes: toCounts(acc.agentTypes),
    },
    security: acc.security,
    alerts: alertsOf(acc),
  };
};
