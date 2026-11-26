'use strict';

/**
 * Which instrument a tool call belongs to.
 *
 * The category drives the colour of a block on the timeline and which counter
 * on the dashboard moves, so it is decided once, here, instead of in every
 * view. A tool not listed is `other`; an MCP tool is recognised by its prefix.
 */

const CATEGORY_BY_TOOL = Object.freeze({
  Read: 'read',
  Glob: 'read',
  Grep: 'read',
  LS: 'read',
  Edit: 'edit',
  MultiEdit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  Bash: 'shell',
  BashOutput: 'shell',
  WebFetch: 'web',
  WebSearch: 'web',
  Agent: 'agent',
  Task: 'agent',
  Skill: 'skill',
  TodoWrite: 'plan',
  TaskCreate: 'plan',
  TaskUpdate: 'plan',
});

// A shell command is refined by what it runs. Order matters: `docker compose
// run app npm test` is a test run that happens to use Docker, and the test
// counter is the one the developer is watching.
const SHELL_PATTERNS = Object.freeze([
  {
    category: 'test',
    pattern:
      /\b(vitest|jest|mocha|pytest|playwright test|node --test|go test|cargo test|(npm|pnpm|yarn|bun)( run)? test(:[\w-]+)?)\b/,
  },
  { category: 'docker', pattern: /\b(docker|docker-compose|podman)\b/ },
  { category: 'git', pattern: /^\s*(git|gh)\s/ },
]);

const MCP_PREFIX = 'mcp__';

/**
 * @param {string} command
 * @returns {string}
 */
export const categorizeCommand = command =>
  SHELL_PATTERNS.find(({ pattern }) => pattern.test(command ?? ''))?.category ?? 'shell';

/**
 * @param {string} toolName
 * @param {Record<string, any>} [toolInput]
 * @returns {string}
 */
export const categorizeTool = (toolName, toolInput = {}) => {
  if (toolName?.startsWith(MCP_PREFIX)) return 'mcp';

  const category = CATEGORY_BY_TOOL[toolName] ?? 'other';

  if (category !== 'shell') return category;

  return categorizeCommand(toolInput.command);
};
