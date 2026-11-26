'use strict';

/**
 * `npm audit --json` → what the security instrument shows: how many known
 * vulnerabilities (CVE / GHSA advisories) the session's dependencies carry, by
 * severity, and the worst few by name.
 *
 * Also decides *when* an audit is worth running: when a session starts, and
 * whenever its dependencies may have changed — a manifest or lockfile was
 * written, or an install command ran.
 */

const SEVERITY_ORDER = Object.freeze(['critical', 'high', 'moderate', 'low', 'info']);

const ADVISORY_LIMIT = 20;

/** Files whose change means the dependency tree may have changed. */
const DEPENDENCY_FILES = Object.freeze(
  new Set(['package.json', 'package-lock.json', 'npm-shrinkwrap.json'])
);

const INSTALL_COMMAND =
  /\b(npm|pnpm|yarn|bun)\s+(install|i|add|update|upgrade|ci|remove|uninstall)\b/;

const rank = severity => {
  const index = SEVERITY_ORDER.indexOf(severity);
  return index === -1 ? SEVERITY_ORDER.length : index;
};

const parseJson = text => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// `via` mixes advisory objects with the names of the packages that pull a
// vulnerable one in; only the objects are advisories.
const advisoriesOf = vulnerability =>
  (vulnerability.via ?? [])
    .filter(via => typeof via === 'object' && via !== null)
    .map(via => ({
      package: via.name ?? vulnerability.name,
      severity: via.severity ?? vulnerability.severity,
      title: via.title ?? '',
      url: via.url ?? '',
      range: via.range ?? '',
    }));

const uniqueByUrl = advisories => [
  ...new Map(advisories.map(advisory => [advisory.url || advisory.title, advisory])).values(),
];

/**
 * @param {string} text  stdout of `npm audit --json`
 * @returns {{ tool: 'npm', counts: Record<string, number>, total: number, advisories: object[] } | null}
 */
export const parseNpmAudit = text => {
  const report = parseJson(text);

  if (!report?.metadata?.vulnerabilities) return null;

  const { total = 0, ...counts } = report.metadata.vulnerabilities;

  const advisories = uniqueByUrl(Object.values(report.vulnerabilities ?? {}).flatMap(advisoriesOf))
    .sort((a, b) => rank(a.severity) - rank(b.severity) || a.package.localeCompare(b.package))
    .slice(0, ADVISORY_LIMIT);

  return {
    tool: 'npm',
    counts: Object.fromEntries(SEVERITY_ORDER.map(level => [level, Number(counts[level] ?? 0)])),
    total: Number(total),
    advisories,
  };
};

/**
 * @param {string} path
 * @returns {boolean}
 */
export const isDependencyFile = path => DEPENDENCY_FILES.has(String(path).split(/[\\/]/).at(-1));

/**
 * @param {string} command
 * @returns {boolean}
 */
export const isInstallCommand = command => INSTALL_COMMAND.test(command ?? '');
