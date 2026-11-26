'use strict';

/**
 * Fragments shared by more than one schema, so "what a session id looks like"
 * is stated once.
 */

// Claude Code session ids are UUIDs; other tools may send their own format, so
// the rule is a safe character set rather than a UUID check.
export const sessionId = Joi =>
  Joi.string()
    .pattern(/^[\w.:-]+$/)
    .max(200);

export const sessionParams = Joi =>
  Joi.object({
    sessionId: sessionId(Joi).required(),
  });
