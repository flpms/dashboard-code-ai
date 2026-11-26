'use strict';

/**
 * Opens the SQLite file and brings its schema up to date.
 *
 * SQLite instead of a server database because the collector runs on the
 * developer's laptop: `npx` and it works, no container to start first. The
 * events table is append-only — a session is a log, and the dashboard is a
 * projection of it — so the one write path is an INSERT.
 */

const SCHEMA = Object.freeze([
  `CREATE TABLE IF NOT EXISTS events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_type TEXT,
    parent_agent_id TEXT,
    span_id TEXT,
    name TEXT,
    category TEXT,
    status TEXT,
    data TEXT NOT NULL DEFAULT '{}'
  )`,
  'CREATE INDEX IF NOT EXISTS events_session ON events (session_id, seq)',
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    cwd TEXT,
    started_at TEXT NOT NULL,
    last_event_at TEXT NOT NULL,
    ended_at TEXT,
    event_count INTEGER NOT NULL DEFAULT 0
  )`,
]);

const IN_MEMORY = ':memory:';

export const DBStartup = ({ env, logger, DatabaseSync, mkdirSync, dirname }) => {
  const { path } = env.db;

  if (path !== IN_MEMORY) mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);

  // WAL lets the dashboard read while a burst of hooks writes.
  db.exec('PRAGMA journal_mode = WAL');
  SCHEMA.forEach(statement => db.exec(statement));

  logger.info(`Database ready at ${path}`);

  return { db };
};
