/**
 * Presentation helpers. Pure functions in, strings out — nothing is formatted
 * inside a template, so every screen renders the same way and one test covers
 * all of them.
 */

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const clockFormatter = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/**
 * @param {string|Date|number|null|undefined} value
 * @returns {string}
 */
export const formatDateTime = value => (value ? dateFormatter.format(new Date(value)) : '—');

/**
 * @param {string|Date|number|null|undefined} value
 * @returns {string}
 */
export const formatClock = value =>
  value === null || value === undefined ? '—' : clockFormatter.format(new Date(value));

// Each unit is a row: the first whose limit the value is under wins.
const DURATION_UNITS = Object.freeze([
  { below: 1_000, render: (/** @type {number} */ ms) => `${Math.round(ms)} ms` },
  { below: 60_000, render: (/** @type {number} */ ms) => `${decimal.format(ms / 1000)} s` },
  {
    below: Infinity,
    render: (/** @type {number} */ ms) =>
      `${Math.floor(ms / 60_000)} min ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')} s`,
  },
]);

/**
 * @param {number|null|undefined} ms
 * @returns {string}
 */
export const formatDuration = ms => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const unit = DURATION_UNITS.find(({ below }) => ms < below) ?? DURATION_UNITS[2];
  return unit.render(Math.max(0, ms));
};

/**
 * A path as a reviewer reads it: relative to the session folder when inside it.
 *
 * @param {string} path
 * @param {string|null} [cwd]
 * @returns {string}
 */
export const shortPath = (path, cwd) => {
  if (!cwd || !path.startsWith(`${cwd}/`)) return path;
  return path.slice(cwd.length + 1);
};

/**
 * The last folder of a path, for naming a session by where it runs.
 *
 * @param {string|null|undefined} path
 * @returns {string}
 */
export const baseName = path => (path ? (path.split(/[\\/]/).filter(Boolean).at(-1) ?? path) : '—');
