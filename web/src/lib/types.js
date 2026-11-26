/**
 * Shared type definitions.
 *
 * Plain JSDoc, no TypeScript build step: `npm run check` reads these as real
 * types, and the editor autocompletes from them. Keeping them in one file is
 * what stops the same shape being described four slightly different ways.
 */

/**
 * One entry of the collector's log, as the API serializes it.
 *
 * @typedef {Object} CollectorEvent
 * @property {number} seq
 * @property {string} sessionId
 * @property {string} ts
 * @property {string} kind
 * @property {string} agentId
 * @property {string|null} agentType
 * @property {string|null} parentAgentId
 * @property {string|null} spanId
 * @property {string|null} name
 * @property {string|null} category
 * @property {'ok'|'error'|null} status
 * @property {Record<string, any>} data
 */

/**
 * @typedef {Object} SessionSummary
 * @property {string} id
 * @property {string|null} cwd
 * @property {string} startedAt
 * @property {string} lastEventAt
 * @property {string|null} endedAt
 * @property {number} eventCount
 */

/**
 * A tool call on the timeline: from PreToolUse to PostToolUse.
 *
 * @typedef {Object} ToolSpan
 * @property {string} id
 * @property {string} agentId
 * @property {string} name
 * @property {string} category
 * @property {string} summary
 * @property {number} startMs
 * @property {number|null} endMs
 * @property {'running'|'ok'|'error'} status
 * @property {string} input
 * @property {string} output
 */

/**
 * @typedef {Object} AgentLane
 * @property {string} id
 * @property {string} type
 * @property {string|null} parentId
 * @property {number} depth
 * @property {number} startMs
 * @property {number|null} endMs
 * @property {ToolSpan[]} spans
 */

/**
 * @typedef {Object} ContainerState
 * @property {string} id
 * @property {string} name
 * @property {string} image
 * @property {'running'|'stopped'|'failed'} state
 * @property {number|null} exitCode
 * @property {string} agentId
 */

/**
 * @typedef {Object} TestRun
 * @property {number} ms
 * @property {string} runner
 * @property {number} passed
 * @property {number} failed
 * @property {number} skipped
 */

/**
 * @typedef {Object} FileActivity
 * @property {string} path
 * @property {number} changes
 * @property {string[]} agents
 * @property {'tool'|'watcher'} source
 */

/**
 * @typedef {Object} Count
 * @property {string} name
 * @property {number} count
 */

/**
 * @typedef {Object} Alert
 * @property {'warning'|'critical'} level
 * @property {string} message
 */

/**
 * Everything the dashboard draws, derived from the event log alone.
 *
 * @typedef {Object} SessionModel
 * @property {{ startMs: number, endMs: number }} range
 * @property {AgentLane[]} agents
 * @property {number} activeAgents
 * @property {ContainerState[]} containers
 * @property {TestRun[]} tests
 * @property {FileActivity[]} filesChanged
 * @property {number} filesRead
 * @property {{ skills: Count[], mcp: Count[], agentTypes: Count[] }} resources
 * @property {Alert[]} alerts
 */

/**
 * @typedef {Object} RequestOptions
 * @property {string} [method]
 * @property {unknown} [body]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} StreamHandlers
 * @property {(data: unknown) => void} onmessage
 * @property {(status: 'open'|'error') => void} [onstatus]
 */

/**
 * @typedef {Object} HttpClient
 * @property {(path: string, options?: RequestOptions) => Promise<any>} request
 * @property {(path: string, options?: RequestOptions) => Promise<any>} get
 * @property {(path: string, body: unknown, options?: RequestOptions) => Promise<any>} post
 * @property {(path: string, body: unknown, options?: RequestOptions) => Promise<any>} patch
 * @property {(path: string, options?: RequestOptions) => Promise<any>} remove
 * @property {(path: string, handlers: StreamHandlers) => () => void} subscribe
 */

export {};
