/**
 * Shared type definitions.
 *
 * Plain JSDoc, no TypeScript build step: `npm run check` reads these as real
 * types, and the editor autocompletes from them. Keeping them in one file is
 * what stops the same shape being described four slightly different ways.
 */

/**
 * @typedef {Object} SessionUser
 * @property {string} email
 * @property {string} name
 * @property {string} role
 * @property {string} tenantId
 */

/**
 * @typedef {Object} Session
 * @property {string|null} token
 * @property {SessionUser|null} user
 */

/**
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {'draft'|'active'|'archived'} status
 * @property {string[]} tags
 * @property {string} createdAt
 * @property {string|null} updatedAt
 */

/**
 * @template T
 * @typedef {Object} Paged
 * @property {T[]} items
 * @property {number} page
 * @property {number} total
 * @property {number} totalPages
 */

/**
 * @typedef {Object} RequestOptions
 * @property {string} [method]
 * @property {unknown} [body]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} HttpClient
 * @property {(path: string, options?: RequestOptions) => Promise<any>} request
 * @property {(path: string, options?: RequestOptions) => Promise<any>} get
 * @property {(path: string, body: unknown, options?: RequestOptions) => Promise<any>} post
 * @property {(path: string, body: unknown, options?: RequestOptions) => Promise<any>} patch
 * @property {(path: string, options?: RequestOptions) => Promise<any>} remove
 */

export {};
