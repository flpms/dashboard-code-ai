#!/usr/bin/env node
'use strict';

/**
 * Installs or removes the collector's hooks in a Claude Code settings file.
 *
 * Usage:
 *   node scripts/hooks.js install   [--settings <path>] [--url <collector url>]
 *   node scripts/hooks.js uninstall [--settings <path>] [--url <collector url>]
 *
 * Defaults to the user-level file (~/.claude/settings.json), so every session
 * on this machine reports to the dashboard. Pass a project's
 * `.claude/settings.local.json` to instrument only that project.
 *
 * The previous file is kept beside it as `<name>.bak` before anything is
 * written.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  COLLECTOR_HOOKS,
  DEFAULT_COLLECTOR_URL,
  withCollectorHooks,
  withoutCollectorHooks,
} from '../app/v1/domain/hook-settings.js';

const ACTIONS = Object.freeze({
  install: withCollectorHooks,
  uninstall: withoutCollectorHooks,
});

const MESSAGES = Object.freeze({
  install: (path, url) =>
    `Installed ${COLLECTOR_HOOKS.length} hooks in ${path}, reporting to ${url}.\nNew Claude Code sessions will appear on the dashboard.`,
  uninstall: path => `Removed the collector hooks from ${path}.`,
});

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    settings: { type: 'string', default: join(homedir(), '.claude', 'settings.json') },
    url: { type: 'string', default: DEFAULT_COLLECTOR_URL },
  },
});

const [action] = positionals;
const apply = ACTIONS[action];

if (!apply) {
  console.error('Usage: node scripts/hooks.js <install|uninstall> [--settings path] [--url url]');
  process.exit(1);
}

const path = values.settings;

const read = () => {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`${path} is not valid JSON (${error.message}). Nothing was changed.`);
    process.exit(1);
  }
};

const next = apply(read(), values.url);

mkdirSync(dirname(path), { recursive: true });
if (existsSync(path)) copyFileSync(path, `${path}.bak`);
writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);

console.log(MESSAGES[action](path, values.url));
