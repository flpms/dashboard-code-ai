'use strict';

import { categorizeTool } from './tool-categories.js';
import { parseTestSummary } from './test-summary.js';

/**
 * Claude Code hook payload → the collector's common event shape.
 *
 * Every hook carries `session_id`, `cwd`, `hook_event_name` and, inside a
 * subagent, `agent_id` / `agent_type`. Each hook name is a row in
 * HOOK_HANDLERS; a hook we do not know yet is still recorded as a generic
 * `hook` event, so a new Claude Code release shows up instead of vanishing.
 *
 * A handler may return several events: a successful `Write` is both the end of
 * a tool span and a file change, and the dashboard counts them separately.
 *
 * @typedef {Object} CollectorEvent
 * @property {string} sessionId
 * @property {string} ts
 * @property {string} kind
 * @property {string} agentId
 * @property {string|null} agentType
 * @property {string|null} spanId
 * @property {string|null} name
 * @property {string|null} category
 * @property {'ok'|'error'|null} status
 * @property {Record<string, any>} data
 */

const MAIN_AGENT = 'main';
const TEXT_LIMIT = 2000;

const truncate = (value, limit = TEXT_LIMIT) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

// The one line a person needs to recognise a call on the timeline.
const SUMMARY_BY_TOOL = Object.freeze({
  Bash: input => input.description || input.command,
  Read: input => input.file_path,
  Edit: input => input.file_path,
  MultiEdit: input => input.file_path,
  Write: input => input.file_path,
  NotebookEdit: input => input.notebook_path,
  Glob: input => input.pattern,
  Grep: input => input.pattern,
  WebFetch: input => input.url,
  WebSearch: input => input.query,
  Agent: input => `${input.subagent_type ?? 'agent'}: ${input.description ?? ''}`,
  Task: input => `${input.subagent_type ?? 'agent'}: ${input.description ?? ''}`,
  Skill: input => input.skill ?? input.name,
});

const summarize = (toolName, input = {}) =>
  truncate(SUMMARY_BY_TOOL[toolName]?.(input) ?? input, 160);

// Bash answers with { stdout, stderr }; other tools with a string or an object.
const outputText = response => {
  if (typeof response === 'string') return response;
  if (response?.stdout !== undefined || response?.stderr !== undefined) {
    return [response.stdout, response.stderr].filter(Boolean).join('\n');
  }
  return JSON.stringify(response ?? '');
};

const filePathOf = input => input?.file_path ?? input?.notebook_path ?? null;

const base = (payload, now) => ({
  sessionId: payload.session_id,
  ts: now,
  agentId: payload.agent_id ?? MAIN_AGENT,
  agentType: payload.agent_type ?? null,
  spanId: null,
  name: null,
  category: null,
  status: null,
  data: {},
});

const toolBase = (payload, now) => ({
  ...base(payload, now),
  spanId: payload.tool_use_id ?? null,
  name: payload.tool_name,
  category: categorizeTool(payload.tool_name, payload.tool_input),
});

// What a finished tool call implies beyond its own span.
const DERIVED_BY_CATEGORY = Object.freeze({
  edit: (payload, event) => {
    const path = filePathOf(payload.tool_input);
    if (!path || event.status !== 'ok') return [];
    const op = payload.tool_name === 'Write' ? 'write' : 'edit';
    return [{ ...event, kind: 'file.change', data: { path, op, source: 'tool' } }];
  },
  read: (payload, event) => {
    const path = filePathOf(payload.tool_input);
    if (!path) return [];
    return [{ ...event, kind: 'file.read', data: { path } }];
  },
  test: (payload, event, output) => {
    const summary = parseTestSummary(output);
    if (!summary) return [];
    return [
      { ...event, kind: 'test.result', data: { ...summary, command: payload.tool_input?.command } },
    ];
  },
});

const toolEnd = status => (payload, now) => {
  const output = outputText(payload.tool_response ?? payload.error);
  const event = {
    ...toolBase(payload, now),
    kind: 'tool.end',
    status,
    data: { output: truncate(output) },
  };
  const derive = DERIVED_BY_CATEGORY[event.category];
  const derived = derive ? derive(payload, event, output) : [];
  return [event, ...derived];
};

const HOOK_HANDLERS = Object.freeze({
  SessionStart: (payload, now) => [
    {
      ...base(payload, now),
      kind: 'session.start',
      data: { cwd: payload.cwd, source: payload.source ?? null, model: payload.model ?? null },
    },
  ],
  SessionEnd: (payload, now) => [
    { ...base(payload, now), kind: 'session.end', data: { reason: payload.reason ?? null } },
  ],
  UserPromptSubmit: (payload, now) => [
    { ...base(payload, now), kind: 'prompt', data: { prompt: truncate(payload.prompt, 500) } },
  ],
  PreToolUse: (payload, now) => [
    {
      ...toolBase(payload, now),
      kind: 'tool.start',
      data: {
        summary: summarize(payload.tool_name, payload.tool_input),
        input: truncate(payload.tool_input),
      },
    },
  ],
  PostToolUse: toolEnd('ok'),
  PostToolUseFailure: toolEnd('error'),
  SubagentStart: (payload, now) => [{ ...base(payload, now), kind: 'agent.start' }],
  SubagentStop: (payload, now) => [{ ...base(payload, now), kind: 'agent.end' }],
  Stop: (payload, now) => [{ ...base(payload, now), kind: 'turn.end' }],
  PreCompact: (payload, now) => [
    { ...base(payload, now), kind: 'compact', data: { trigger: payload.trigger ?? null } },
  ],
  TaskCreated: (payload, now) => [
    { ...base(payload, now), kind: 'task.create', name: payload.task_subject ?? null },
  ],
  TaskCompleted: (payload, now) => [
    { ...base(payload, now), kind: 'task.complete', name: payload.task_subject ?? null },
  ],
  Notification: (payload, now) => [
    {
      ...base(payload, now),
      kind: 'notification',
      data: { message: truncate(payload.message, 500) },
    },
  ],
});

const unknownHook = (payload, now) => [
  { ...base(payload, now), kind: 'hook', name: payload.hook_event_name },
];

/**
 * @param {Record<string, any>} payload  a validated hook body
 * @param {string} now                   ISO timestamp of arrival
 * @returns {CollectorEvent[]}
 */
export const normalizeHook = (payload, now) =>
  (HOOK_HANDLERS[payload.hook_event_name] ?? unknownHook)(payload, now);

export const KNOWN_HOOKS = Object.freeze(Object.keys(HOOK_HANDLERS));
