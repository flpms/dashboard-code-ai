/**
 * Presentation helpers. Pure functions in, strings out — no dates formatted
 * inside a template, so every screen renders the same way and one test covers
 * all of them.
 */

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * @param {string|Date|null|undefined} value
 * @returns {string}
 */
export const formatDateTime = value => (value ? dateFormatter.format(new Date(value)) : '—');

// Label lookups beat if-ladders: adding a status is one line, and an unknown
// value degrades to itself instead of rendering blank.
/** @type {Record<string, string>} */
const STATUS_LABELS = {
  draft: 'Rascunho',
  active: 'Ativo',
  archived: 'Arquivado',
};

/** @type {Record<string, string>} */
const STATUS_CLASSES = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-amber-100 text-amber-800',
};

/**
 * @param {string} status
 * @returns {string}
 */
export const statusLabel = status => STATUS_LABELS[status] ?? status;

/**
 * @param {string} status
 * @returns {string}
 */
export const statusClass = status => STATUS_CLASSES[status] ?? STATUS_CLASSES.draft;
