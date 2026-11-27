'use strict';

/**
 * The settings menu's view of the collector. Paths are this machine's own,
 * shown so the person knows which file a button edits; nothing here is a
 * secret, and the route is loopback-only like every other.
 *
 * @param {{
 *   env: Record<string, any>,
 *   hookUrl: string,
 *   hooks: { installed: boolean, readable: boolean, settingsPath: string },
 *   saved: { autoInstallHooks: boolean, backfillHours: number },
 * }} source
 */
export const serializeSettings = ({ env, hookUrl, hooks, saved }) => ({
  settings: {
    autoInstallHooks: saved.autoInstallHooks,
    backfillHours: saved.backfillHours,
  },
  hooks: {
    installed: hooks.installed,
    readable: hooks.readable,
    url: hookUrl,
    settingsPath: hooks.settingsPath,
  },
  collector: {
    version: env.app.version,
    host: env.app.host,
    port: env.app.port,
    claudeHome: env.claude.home,
  },
  watchers: {
    docker: Boolean(env.watchers.docker),
    files: Boolean(env.watchers.files),
    security: Boolean(env.watchers.security),
    transcripts: Boolean(env.watchers.transcripts),
  },
});
