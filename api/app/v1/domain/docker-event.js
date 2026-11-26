'use strict';

/**
 * One line of `docker events --format '{{json .}}'` → a container event, or
 * null for anything the dashboard does not show.
 *
 * Only lifecycle actions are kept. `exec_start`, `attach` and the health-check
 * chatter would bury the two facts that matter: what came up, and what died.
 */

const KEPT_ACTIONS = Object.freeze({
  create: 'container.create',
  start: 'container.start',
  die: 'container.die',
  stop: 'container.stop',
  kill: 'container.kill',
  destroy: 'container.destroy',
});

const parseJson = line => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};

const exitCodeOf = attributes =>
  attributes.exitCode === undefined ? null : Number(attributes.exitCode);

// `timeNano` is nanoseconds since the epoch; milliseconds are enough here.
const timestampOf = raw =>
  new Date(Math.floor(Number(raw.timeNano ?? Date.now() * 1e6) / 1e6)).toISOString();

const describeContainer = (raw, kind) => {
  const attributes = raw.Actor?.Attributes ?? {};
  return {
    kind,
    containerId: String(raw.Actor?.ID ?? raw.id ?? '').slice(0, 12),
    name: attributes.name ?? '',
    image: attributes.image ?? raw.from ?? '',
    exitCode: exitCodeOf(attributes),
    ts: timestampOf(raw),
  };
};

/**
 * @param {string} line
 * @returns {{ kind: string, containerId: string, name: string, image: string, exitCode: number|null, ts: string } | null}
 */
export const parseDockerLine = line => {
  const raw = parseJson(line);

  if (!raw || raw.Type !== 'container') return null;

  const kind = KEPT_ACTIONS[raw.Action];

  if (!kind) return null;

  return describeContainer(raw, kind);
};
