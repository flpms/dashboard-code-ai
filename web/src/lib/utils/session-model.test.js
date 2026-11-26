import { describe, expect, it } from 'vitest';

import { SESSION_EVENTS, SESSION_START_MS } from '$lib/test-fixtures/session-events.js';

import { buildSessionModel } from './session-model.js';

const NOW = SESSION_START_MS + 60_000;

/**
 * @param {number} seq
 * @param {Partial<import('$lib/types.js').CollectorEvent>} fields
 */
const extra = (seq, fields) => ({
  seq,
  sessionId: 'sess-1',
  ts: new Date(SESSION_START_MS + seq * 1000).toISOString(),
  kind: 'hook',
  agentId: 'main',
  agentType: null,
  parentAgentId: null,
  spanId: null,
  name: null,
  category: null,
  status: /** @type {'ok'|'error'|null} */ (null),
  data: {},
  ...fields,
});

describe('buildSessionModel', () => {
  const model = buildSessionModel(SESSION_EVENTS, NOW);

  it('orders lanes as a tree: the main agent, then its subagents indented', () => {
    expect(model.agents.map(agent => [agent.id, agent.depth])).toEqual([
      ['main', 0],
      ['sub-1', 1],
    ]);
    expect(model.agents[1].type).toBe('Explore');
  });

  it('puts each tool call on the lane of the agent that made it, with its duration', () => {
    const grep = model.agents[1].spans[0];
    expect(grep.name).toBe('Grep');
    expect(grep.endMs - grep.startMs).toBe(1000);
  });

  it('counts finished and running subagents apart', () => {
    expect(model.activeAgents).toBe(0);

    const running = buildSessionModel(SESSION_EVENTS.slice(0, 7), NOW);
    expect(running.activeAgents).toBe(1);
    expect(running.range.endMs).toBe(NOW);
  });

  it('keeps every test run in order, last one last', () => {
    expect(model.tests.map(run => run.failed)).toEqual([1, 0]);
  });

  it('tracks containers, files and resources', () => {
    expect(model.containers).toEqual([
      expect.objectContaining({ name: 'db', state: 'running', agentId: 'main' }),
    ]);
    expect(model.filesChanged).toEqual([
      { path: '/repo/src/app.js', changes: 1, agents: ['main'], source: 'tool' },
    ]);
    expect(model.filesRead).toBe(1);
    expect(model.resources.skills).toEqual([{ name: 'code-style', count: 1 }]);
    expect(model.resources.agentTypes).toEqual([{ name: 'Explore', count: 1 }]);
  });

  it('raises no alert once the tests pass again', () => {
    expect(model.alerts).toEqual([]);
  });

  it('raises alerts for failing tests, a dead container and a stuck tool', () => {
    const failures = [
      extra(100, { kind: 'test.result', data: { runner: 'node', passed: 1, failed: 2 } }),
      extra(101, {
        kind: 'container.die',
        data: { containerId: 'c1', name: 'db', exitCode: 137 },
      }),
      ...[102, 103, 104].map(seq =>
        extra(seq, { kind: 'tool.end', spanId: `x${seq}`, name: 'Bash', status: 'error' })
      ),
    ];

    const alerts = buildSessionModel([...SESSION_EVENTS, ...failures], NOW).alerts;

    expect(alerts.map(alert => alert.message)).toEqual([
      '2 teste(s) falhando na última execução',
      'Container db caiu (código 137)',
      'Bash falhou 3 vezes seguidas',
    ]);
  });

  it('counts MCP servers by prefix', () => {
    const mcp = extra(200, {
      kind: 'tool.start',
      spanId: 'm1',
      name: 'mcp__github__create_issue',
      category: 'mcp',
    });
    expect(buildSessionModel([mcp], NOW).resources.mcp).toEqual([{ name: 'github', count: 1 }]);
  });

  it('draws a subagent whose parent it never saw under the main agent', () => {
    const orphan = extra(300, {
      kind: 'agent.start',
      agentId: 'sub-9',
      agentType: 'Plan',
      parentAgentId: 'ghost',
    });
    const lanes = buildSessionModel([SESSION_EVENTS[0], orphan], NOW).agents;
    expect(lanes.map(lane => [lane.id, lane.depth])).toEqual([
      ['main', 0],
      ['sub-9', 1],
    ]);
  });

  it('returns an empty model for an empty log', () => {
    const empty = buildSessionModel([], NOW);
    expect(empty.agents).toEqual([]);
    expect(empty.range).toEqual({ startMs: NOW, endMs: NOW });
  });
});
