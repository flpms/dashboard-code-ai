#!/usr/bin/env node
'use strict';

/**
 * Plays a short, made-up Claude Code session against a running collector, so
 * the dashboard can be seen working without opening a real session.
 *
 * Usage: node scripts/demo-session.js [--url http://127.0.0.1:4317/v1/hooks] [--cwd /some/repo]
 *
 * The session reads files, launches three subagents (two in parallel), runs
 * the tests twice, starts a database with Docker and opens a pull request
 * through an MCP server. Everything it sends is a hook payload exactly as
 * Claude Code would send it; nothing touches the disk or Docker.
 */

import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:4317/v1/hooks' },
    cwd: { type: 'string', default: '/home/dev/projects/shop-api' },
  },
});

const sessionId = randomUUID();

const send = body =>
  fetch(values.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, cwd: values.cwd, ...body }),
  });

const agentFields = agent => (agent ? { agent_id: agent.id, agent_type: agent.type } : {});

const tool = async (agent, name, input, { ms = 400, response = 'ok', fails = false } = {}) => {
  const toolUseId = `toolu_${randomUUID().slice(0, 12)}`;
  const common = {
    tool_name: name,
    tool_use_id: toolUseId,
    tool_input: input,
    ...agentFields(agent),
  };
  await send({ hook_event_name: 'PreToolUse', ...common });
  await sleep(ms);
  const end = fails
    ? { hook_event_name: 'PostToolUseFailure', error: response }
    : { hook_event_name: 'PostToolUse', tool_response: response };
  await send({ ...end, ...common });
  return toolUseId;
};

const file = path => `${values.cwd}/${path}`;

const subagent = async (type, description, work) => {
  const launchId = `toolu_${randomUUID().slice(0, 12)}`;
  const launch = {
    tool_name: 'Agent',
    tool_use_id: launchId,
    tool_input: { subagent_type: type, description },
  };
  await send({ hook_event_name: 'PreToolUse', ...launch });
  const agent = { id: `agent_${randomUUID().slice(0, 8)}`, type };
  await send({ hook_event_name: 'SubagentStart', ...agentFields(agent) });
  await work(agent);
  await send({ hook_event_name: 'SubagentStop', ...agentFields(agent) });
  await send({ hook_event_name: 'PostToolUse', ...launch, tool_response: 'done' });
};

const main = async () => {
  console.log(`Demo session ${sessionId} → ${values.url}`);

  await send({ hook_event_name: 'SessionStart', source: 'startup' });
  await send({
    hook_event_name: 'UserPromptSubmit',
    prompt: 'Add pagination to the orders endpoint',
  });

  await tool(null, 'Read', { file_path: file('src/orders/orders.controller.js') }, { ms: 250 });
  await tool(null, 'Grep', { pattern: 'paginate', path: values.cwd }, { ms: 300 });

  await subagent('Explore', 'Map how listing endpoints paginate', async agent => {
    await tool(agent, 'Glob', { pattern: 'src/**/*.repository.js' }, { ms: 300 });
    await tool(agent, 'Read', { file_path: file('src/items/items.repository.js') }, { ms: 300 });
    await tool(agent, 'Read', { file_path: file('src/users/users.repository.js') }, { ms: 300 });
  });

  await tool(null, 'Skill', { skill: 'api-resource' }, { ms: 200 });

  await tool(
    null,
    'Bash',
    { command: 'docker compose up -d postgres', description: 'Start the test database' },
    { ms: 1200, response: { stdout: 'Container shop-postgres  Started', stderr: '' } }
  );

  await Promise.all([
    subagent('general-purpose', 'Implement pagination in the repository', async agent => {
      await tool(
        agent,
        'Read',
        { file_path: file('src/orders/orders.repository.js') },
        { ms: 300 }
      );
      await tool(
        agent,
        'Edit',
        { file_path: file('src/orders/orders.repository.js') },
        { ms: 500 }
      );
      await tool(
        agent,
        'Bash',
        { command: 'npm test -- orders', description: 'Run the orders tests' },
        {
          ms: 2200,
          response: { stdout: 'ℹ tests 14\nℹ pass 12\nℹ fail 2\nℹ skipped 0', stderr: '' },
        }
      );
      await tool(
        agent,
        'Edit',
        { file_path: file('src/orders/orders.repository.js') },
        { ms: 400 }
      );
    }),
    subagent('general-purpose', 'Write the API docs for the new query params', async agent => {
      await tool(agent, 'Read', { file_path: file('docs/api.md') }, { ms: 400 });
      await tool(agent, 'Write', { file_path: file('docs/orders-pagination.md') }, { ms: 900 });
    }),
  ]);

  await tool(
    null,
    'Bash',
    { command: 'npm run lint', description: 'Lint' },
    { ms: 600, response: '1 error: no-else-return', fails: true }
  );
  await tool(null, 'Edit', { file_path: file('src/orders/orders.controller.js') }, { ms: 300 });
  await tool(
    null,
    'Bash',
    { command: 'npm test', description: 'Run the whole suite' },
    { ms: 2500, response: { stdout: 'ℹ tests 96\nℹ pass 96\nℹ fail 0\nℹ skipped 0', stderr: '' } }
  );
  await tool(
    null,
    'mcp__github__create_pull_request',
    { title: 'Paginate orders listing' },
    { ms: 700 }
  );

  await send({ hook_event_name: 'Stop' });
  console.log('Done.');
};

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
