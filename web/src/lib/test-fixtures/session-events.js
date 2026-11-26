/**
 * A short, realistic session: the main agent reads, launches an Explore
 * subagent, runs the tests twice, starts a database container and edits a
 * file. Shared by the unit tests and the e2e smoke test.
 *
 * @import { CollectorEvent } from '$lib/types.js'
 */

const T0 = Date.parse('2026-11-26T12:00:00.000Z');

/** @param {number} seconds */
const at = seconds => new Date(T0 + seconds * 1000).toISOString();

let seq = 0;

/**
 * @param {number} seconds
 * @param {Partial<CollectorEvent>} fields
 * @returns {CollectorEvent}
 */
const event = (seconds, fields) => ({
  seq: ++seq,
  sessionId: 'sess-1',
  ts: at(seconds),
  kind: 'hook',
  agentId: 'main',
  agentType: null,
  parentAgentId: null,
  spanId: null,
  name: null,
  category: null,
  status: null,
  data: {},
  ...fields,
});

/** @type {CollectorEvent[]} */
export const SESSION_EVENTS = [
  event(0, { kind: 'session.start', data: { cwd: '/repo' } }),
  event(0, {
    kind: 'security.audit',
    name: 'npm audit',
    category: 'security',
    status: 'error',
    data: {
      tool: 'npm',
      total: 2,
      counts: { critical: 1, high: 1, moderate: 0, low: 0, info: 0 },
      advisories: [
        {
          package: 'minimist',
          severity: 'critical',
          title: 'Prototype Pollution in minimist',
          url: 'https://github.com/advisories/GHSA-xvch-5gv4-984h',
        },
        {
          package: 'lodash',
          severity: 'high',
          title: 'Command Injection in lodash',
          url: 'javascript:alert(1)',
        },
      ],
    },
  }),
  event(1, {
    kind: 'tool.start',
    spanId: 'r1',
    name: 'Read',
    category: 'read',
    data: { summary: '/repo/src/app.js', input: '{}' },
  }),
  event(2, {
    kind: 'tool.end',
    spanId: 'r1',
    name: 'Read',
    category: 'read',
    status: 'ok',
    data: { output: 'file' },
  }),
  event(2, {
    kind: 'file.read',
    spanId: 'r1',
    name: 'Read',
    category: 'read',
    status: 'ok',
    data: { path: '/repo/src/app.js' },
  }),
  event(3, {
    kind: 'tool.start',
    spanId: 'a1',
    name: 'Agent',
    category: 'agent',
    data: { summary: 'Explore: map the repo', input: '{}' },
  }),
  event(4, {
    kind: 'agent.start',
    agentId: 'sub-1',
    agentType: 'Explore',
    parentAgentId: 'main',
    data: { parentSpanId: 'a1' },
  }),
  event(5, {
    kind: 'tool.start',
    agentId: 'sub-1',
    agentType: 'Explore',
    spanId: 'g1',
    name: 'Grep',
    category: 'read',
    data: { summary: 'TODO', input: '{}' },
  }),
  event(6, {
    kind: 'tool.end',
    agentId: 'sub-1',
    agentType: 'Explore',
    spanId: 'g1',
    name: 'Grep',
    category: 'read',
    status: 'ok',
    data: { output: '3 matches' },
  }),
  event(8, { kind: 'agent.end', agentId: 'sub-1', agentType: 'Explore' }),
  event(8, {
    kind: 'tool.end',
    spanId: 'a1',
    name: 'Agent',
    category: 'agent',
    status: 'ok',
    data: { output: 'done' },
  }),
  event(9, {
    kind: 'tool.start',
    spanId: 'd1',
    name: 'Bash',
    category: 'docker',
    data: { summary: 'docker compose up -d', input: '{}' },
  }),
  event(11, {
    kind: 'container.start',
    spanId: 'd1',
    name: 'db',
    category: 'docker',
    status: 'ok',
    data: { containerId: 'c1', name: 'db', image: 'postgres:17', exitCode: null },
  }),
  event(12, {
    kind: 'tool.end',
    spanId: 'd1',
    name: 'Bash',
    category: 'docker',
    status: 'ok',
    data: { output: 'started' },
  }),
  event(13, {
    kind: 'tool.start',
    spanId: 't1',
    name: 'Bash',
    category: 'test',
    data: { summary: 'npm test', input: '{}' },
  }),
  event(18, {
    kind: 'tool.end',
    spanId: 't1',
    name: 'Bash',
    category: 'test',
    status: 'error',
    data: { output: 'ℹ pass 9\nℹ fail 1' },
  }),
  event(18, {
    kind: 'test.result',
    spanId: 't1',
    name: 'Bash',
    category: 'test',
    status: 'ok',
    data: { runner: 'node', passed: 9, failed: 1, skipped: 0 },
  }),
  event(19, {
    kind: 'tool.start',
    spanId: 'e1',
    name: 'Edit',
    category: 'edit',
    data: { summary: '/repo/src/app.js', input: '{}' },
  }),
  event(20, {
    kind: 'tool.end',
    spanId: 'e1',
    name: 'Edit',
    category: 'edit',
    status: 'ok',
    data: { output: 'ok' },
  }),
  event(20, {
    kind: 'file.change',
    spanId: 'e1',
    name: 'Edit',
    category: 'edit',
    status: 'ok',
    data: { path: '/repo/src/app.js', op: 'edit', source: 'tool' },
  }),
  event(21, {
    kind: 'tool.start',
    spanId: 's1',
    name: 'Skill',
    category: 'skill',
    data: { summary: 'code-style', input: '{}' },
  }),
  event(21, {
    kind: 'tool.end',
    spanId: 's1',
    name: 'Skill',
    category: 'skill',
    status: 'ok',
    data: { output: '' },
  }),
  event(22, {
    kind: 'tool.start',
    spanId: 't2',
    name: 'Bash',
    category: 'test',
    data: { summary: 'npm test', input: '{}' },
  }),
  event(26, {
    kind: 'tool.end',
    spanId: 't2',
    name: 'Bash',
    category: 'test',
    status: 'ok',
    data: { output: 'ℹ pass 10\nℹ fail 0' },
  }),
  event(26, {
    kind: 'test.result',
    spanId: 't2',
    name: 'Bash',
    category: 'test',
    status: 'ok',
    data: { runner: 'node', passed: 10, failed: 0, skipped: 0 },
  }),
];

export const SESSION_START_MS = T0;

export const SESSION_SUMMARY = {
  id: 'sess-1',
  cwd: '/repo',
  startedAt: at(0),
  lastEventAt: at(26),
  endedAt: null,
  eventCount: SESSION_EVENTS.length,
};
