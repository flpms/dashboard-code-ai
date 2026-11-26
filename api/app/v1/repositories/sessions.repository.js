'use strict';

/**
 * One row per Claude Code session: when it started, where it runs, how much
 * happened. Kept beside the event log so the session list is a single indexed
 * read instead of a GROUP BY over every event ever recorded.
 */
export const SessionsRepository = ({ db, logger }) => {
  logger.info('Start Table - sessions');

  const statements = {
    find: db.prepare('SELECT id, cwd FROM sessions WHERE id = ?'),
    upsert: db.prepare(
      `INSERT INTO sessions (id, cwd, started_at, last_event_at, event_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         cwd = COALESCE(sessions.cwd, excluded.cwd),
         last_event_at = excluded.last_event_at,
         event_count = sessions.event_count + excluded.event_count`
    ),
    end: db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?'),
    list: db.prepare(
      `SELECT id, cwd, started_at, last_event_at, ended_at, event_count
       FROM sessions ORDER BY last_event_at DESC LIMIT ?`
    ),
    mostRecentSince: db.prepare(
      'SELECT id FROM sessions WHERE last_event_at >= ? AND ended_at IS NULL ORDER BY last_event_at DESC LIMIT 1'
    ),
  };

  return {
    /**
     * Records activity on a session, creating it on first sight.
     * @returns {boolean} true when the session is new
     */
    touch: ({ id, cwd, ts, count }) => {
      const isNew = !statements.find.get(id);
      statements.upsert.run(id, cwd ?? null, ts, ts, count);
      return isNew;
    },
    end: (id, ts) => statements.end.run(ts, id),
    cwdOf: id => statements.find.get(id)?.cwd ?? null,
    list: limit => statements.list.all(limit),
    mostRecentActiveSince: sinceTs => statements.mostRecentSince.get(sinceTs)?.id ?? null,
  };
};
