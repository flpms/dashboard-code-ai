import { z } from 'zod';

/**
 * What an event from the collector must look like before the dashboard draws
 * it. The stream is a boundary like any form: a malformed line is dropped and
 * logged, never drawn half-way.
 */
export const eventSchema = z.object({
  seq: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
  ts: z.string().min(1),
  kind: z.string().min(1),
  agentId: z.string().min(1),
  agentType: z.string().nullable(),
  parentAgentId: z.string().nullable(),
  spanId: z.string().nullable(),
  name: z.string().nullable(),
  category: z.string().nullable(),
  status: z.enum(['ok', 'error']).nullable(),
  data: z.record(z.string(), z.any()),
});
