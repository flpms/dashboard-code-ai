'use strict';

/**
 * The shapes the API promises. What is not listed here is not sent — a new
 * column stays internal until someone decides the dashboard needs it.
 */

const parseData = raw => {
  try {
    return JSON.parse(raw ?? '{}');
  } catch {
    return {};
  }
};

export const serializeEvent = row => ({
  seq: Number(row.seq),
  sessionId: row.session_id,
  ts: row.ts,
  kind: row.kind,
  agentId: row.agent_id,
  agentType: row.agent_type ?? null,
  parentAgentId: row.parent_agent_id ?? null,
  spanId: row.span_id ?? null,
  name: row.name ?? null,
  category: row.category ?? null,
  status: row.status ?? null,
  data: parseData(row.data),
});

export const serializeEventList = rows => rows.map(serializeEvent);

export const serializeSession = row => ({
  id: row.id,
  cwd: row.cwd ?? null,
  startedAt: row.started_at,
  lastEventAt: row.last_event_at,
  endedAt: row.ended_at ?? null,
  eventCount: Number(row.event_count),
});

export const serializeSessionList = rows => rows.map(serializeSession);
