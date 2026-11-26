'use strict';

import { sessionId, sessionParams } from './commons/index.js';

const text = (Joi, max) => Joi.string().allow('').max(max);

/**
 * The hook body. Only the fields the collector reads are declared; the rest of
 * what Claude Code sends (permission mode, effort, transcript details…) is
 * stripped before the controller runs. `tool_input` and `tool_response` are
 * whatever the tool defines, so they are accepted as-is and truncated later.
 */
const hookBody = Joi =>
  Joi.object({
    hook_event_name: Joi.string().max(80).required(),
    session_id: sessionId(Joi).required(),
    cwd: text(Joi, 4096),
    transcript_path: text(Joi, 4096),
    agent_id: text(Joi, 200),
    agent_type: text(Joi, 200),
    tool_name: text(Joi, 200),
    tool_use_id: text(Joi, 200),
    tool_input: Joi.object().unknown(true),
    tool_response: Joi.any(),
    error: Joi.any(),
    prompt: Joi.string().allow(''),
    source: text(Joi, 80),
    model: Joi.alternatives(Joi.string().max(200), Joi.object().unknown(true)),
    reason: text(Joi, 200),
    trigger: text(Joi, 80),
    message: Joi.string().allow(''),
    task_subject: text(Joi, 500),
  });

export const CollectorSchema = Joi => ({
  ingestHook: {
    post: {
      body: hookBody(Joi),
    },
  },
  listSessions: {
    get: {
      query: Joi.object({
        limit: Joi.number().integer().min(1).max(200).default(50),
      }),
    },
  },
  listSessionEvents: {
    get: {
      params: sessionParams(Joi),
      query: Joi.object({
        after: Joi.number().integer().min(0).default(0),
        limit: Joi.number().integer().min(1).max(5000).default(2000),
      }),
    },
  },
});
