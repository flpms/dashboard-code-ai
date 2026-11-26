/**
 * How each tool category looks and reads. One table, used by the timeline,
 * its legend and the details panel, so a colour means the same thing
 * everywhere. Class names are literal so Tailwind finds them.
 */

/**
 * @typedef {Object} CategoryStyle
 * @property {string} label
 * @property {string} fill    SVG fill class for timeline blocks
 * @property {string} swatch  background class for legends and badges
 */

/** @type {Readonly<Record<string, CategoryStyle>>} */
export const CATEGORIES = Object.freeze({
  read: { label: 'Leitura', fill: 'fill-sky-400', swatch: 'bg-sky-400' },
  edit: { label: 'Edição', fill: 'fill-amber-400', swatch: 'bg-amber-400' },
  shell: { label: 'Shell', fill: 'fill-slate-400', swatch: 'bg-slate-400' },
  test: { label: 'Teste', fill: 'fill-emerald-400', swatch: 'bg-emerald-400' },
  docker: { label: 'Docker', fill: 'fill-cyan-400', swatch: 'bg-cyan-400' },
  git: { label: 'Git', fill: 'fill-orange-400', swatch: 'bg-orange-400' },
  web: { label: 'Web', fill: 'fill-violet-400', swatch: 'bg-violet-400' },
  agent: { label: 'Subagente', fill: 'fill-fuchsia-400', swatch: 'bg-fuchsia-400' },
  skill: { label: 'Skill', fill: 'fill-pink-400', swatch: 'bg-pink-400' },
  mcp: { label: 'MCP', fill: 'fill-indigo-400', swatch: 'bg-indigo-400' },
  plan: { label: 'Planejamento', fill: 'fill-lime-400', swatch: 'bg-lime-400' },
  other: { label: 'Outros', fill: 'fill-zinc-400', swatch: 'bg-zinc-400' },
});

/**
 * @param {string} category
 * @returns {CategoryStyle}
 */
export const categoryStyle = category => CATEGORIES[category] ?? CATEGORIES.other;
