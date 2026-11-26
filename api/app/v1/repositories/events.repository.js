'use strict';

/**
 * The append-only event log. One INSERT path; everything else reads.
 *
 * Statements are prepared once, when the repository is built: a burst of
 * hooks from parallel subagents then costs a bind and a step each, not a parse.
 */

const COLUMNS =
  'seq, session_id, ts, kind, agent_id, agent_type, parent_agent_id, span_id, name, category, status, data';

export const EventsRepository = ({ db, logger }) => {
  logger.info('Start Table - events');

  const statements = {
    insert: db.prepare(
      `INSERT INTO events (session_id, ts, kind, agent_id, agent_type, parent_agent_id, span_id, name, category, status, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    bySession: db.prepare(
      `SELECT ${COLUMNS} FROM events WHERE session_id = ? AND seq > ? ORDER BY seq LIMIT ?`
    ),
    agentLaunches: db.prepare(
      `SELECT ${COLUMNS} FROM events
       WHERE session_id = ? AND kind = 'tool.start' AND category = 'agent'
       ORDER BY seq DESC LIMIT 50`
    ),
    linkedLaunches: db.prepare(
      `SELECT json_extract(data, '$.parentSpanId') AS span FROM events
       WHERE session_id = ? AND kind = 'agent.start'`
    ),
    agentOf: db.prepare(
      `SELECT ${COLUMNS} FROM events
       WHERE session_id = ? AND agent_id = ? AND kind = 'agent.start' LIMIT 1`
    ),
    latestInCategories: db.prepare(
      `SELECT ${COLUMNS} FROM events
       WHERE kind = 'tool.start' AND category IN ('docker', 'test') AND ts >= ?
       ORDER BY seq DESC LIMIT 1`
    ),
  };

  /**
   * @param {import('../domain/hook-normalizer.js').CollectorEvent & { parentAgentId?: string|null }} event
   * @returns {number} the new sequence number
   */
  const insert = event =>
    Number(
      statements.insert.run(
        event.sessionId,
        event.ts,
        event.kind,
        event.agentId,
        event.agentType,
        event.parentAgentId ?? null,
        event.spanId,
        event.name,
        event.category,
        event.status,
        JSON.stringify(event.data ?? {})
      ).lastInsertRowid
    );

  return {
    insert,
    listBySession: (sessionId, afterSeq, limit) =>
      statements.bySession.all(sessionId, afterSeq, limit),
    agentLaunches: sessionId => statements.agentLaunches.all(sessionId),
    linkedLaunchSpans: sessionId =>
      statements.linkedLaunches
        .all(sessionId)
        .map(row => row.span)
        .filter(Boolean),
    findAgentStart: (sessionId, agentId) => statements.agentOf.get(sessionId, agentId) ?? null,
    latestContainerCause: sinceTs => statements.latestInCategories.get(sinceTs) ?? null,
  };
};
