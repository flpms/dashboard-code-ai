/**
 * The collector's sessions and their event logs. Stateless factory over
 * `ApiClient`, no stores, no other services — composition happens in the page.
 *
 * @import { CollectorEvent, HttpClient, RefreshResult, SessionSummary } from '$lib/types.js'
 */

/**
 * @param {HttpClient} client
 */
export const SessionsService = client => {
  /**
   * @param {{ limit?: number }} [query]
   * @returns {Promise<SessionSummary[]>}
   */
  const list = async ({ limit = 50 } = {}) => {
    const { sessions } = await client.get(`/v1/sessions?limit=${limit}`);
    return sessions;
  };

  /**
   * @param {string} sessionId
   * @param {{ after?: number }} [query]
   * @returns {Promise<{ events: CollectorEvent[], last: number }>}
   */
  const events = (sessionId, { after = 0 } = {}) =>
    client.get(`/v1/sessions/${encodeURIComponent(sessionId)}/events?after=${after}`);

  /**
   * Every new event of every session, as it happens.
   *
   * @param {(event: unknown) => void} onevent
   * @param {(status: 'open'|'error') => void} [onstatus]
   * @returns {() => void} closes the stream
   */
  const stream = (onevent, onstatus) =>
    client.subscribe('/v1/stream', { onmessage: onevent, onstatus });

  /**
   * Asks the collector to rescan Claude Code's transcripts for sessions it
   * has not seen yet. New ones then arrive through the stream like any event.
   *
   * @returns {Promise<RefreshResult>}
   */
  const refresh = () => client.post('/v1/sessions/refresh');

  return { events, list, refresh, stream };
};
