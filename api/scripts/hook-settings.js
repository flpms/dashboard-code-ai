'use strict';

/**
 * Adds and removes the collector's hooks in a Claude Code settings object.
 *
 * Pure functions over plain objects: the CLI reads and writes the file, these
 * decide what goes in it. Everything the user already had — their own hooks,
 * permissions, env — is carried over untouched. Ours are recognised by URL, so
 * installing twice replaces instead of duplicating, and uninstalling removes
 * exactly what install added.
 */

/** Every hook the collector understands. */
export const COLLECTOR_HOOKS = Object.freeze([
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'Stop',
  'PreCompact',
  'TaskCreated',
  'TaskCompleted',
  'Notification',
]);

export const DEFAULT_COLLECTOR_URL = 'http://127.0.0.1:4317/v1/hooks';

// Seconds. A hook that cannot reach the collector must never slow the agent
// down: an unreachable URL is a non-blocking error in Claude Code, and this
// bounds the wait when the port is open but nobody answers.
const HOOK_TIMEOUT_S = 2;

const isOurs = url => hook => hook?.type === 'http' && hook.url === url;

const withoutOurs = (groups = [], url) =>
  groups
    .map(group => ({ ...group, hooks: (group.hooks ?? []).filter(hook => !isOurs(url)(hook)) }))
    .filter(group => group.hooks.length);

/**
 * @param {Record<string, any>} settings
 * @param {string} [url]
 * @returns {Record<string, any>} a new settings object
 */
export const withoutCollectorHooks = (settings, url = DEFAULT_COLLECTOR_URL) => {
  const hooks = Object.fromEntries(
    Object.entries(settings.hooks ?? {})
      .map(([event, groups]) => [event, withoutOurs(groups, url)])
      .filter(([, groups]) => groups.length)
  );

  const { hooks: _previous, ...rest } = settings;

  return Object.keys(hooks).length ? { ...rest, hooks } : rest;
};

/**
 * @param {Record<string, any>} settings
 * @param {string} [url]
 * @returns {Record<string, any>} a new settings object
 */
export const withCollectorHooks = (settings, url = DEFAULT_COLLECTOR_URL) => {
  const clean = withoutCollectorHooks(settings, url);
  const ours = { hooks: [{ type: 'http', url, timeout: HOOK_TIMEOUT_S }] };

  const hooks = COLLECTOR_HOOKS.reduce(
    (acc, event) => ({ ...acc, [event]: [...(acc[event] ?? []), ours] }),
    clean.hooks ?? {}
  );

  return { ...clean, hooks };
};
