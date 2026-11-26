import { browser } from '$app/environment';

/**
 * The only mutable global in the app.
 *
 * Svelte 5 runes replace the writable-store ceremony: `$state` in a `.svelte.js`
 * module is reactive everywhere it is read. Exporting an object with getters
 * (rather than the raw `$state` binding) keeps writes funnelled through the
 * named methods below, so "who changed the session?" has a small answer.
 *
 * @import { Session } from '$lib/types.js'
 */

const STORAGE_KEY = 'session';

/** @type {Session} */
const empty = { token: null, user: null };

/** @returns {Session} */
const restore = () => {
  if (!browser) return empty;

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') || empty;
  } catch {
    return empty;
  }
};

let current = $state(restore());

/** @param {Session} value */
const persist = value => {
  if (!browser) return;
  if (!value.token) return localStorage.removeItem(STORAGE_KEY);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const session = {
  get token() {
    return current.token;
  },
  get user() {
    return current.user;
  },
  get tenantId() {
    return current.user?.tenantId ?? null;
  },
  get isAuthenticated() {
    return Boolean(current.token);
  },

  /** @param {Session} value */
  start(value) {
    current = value;
    persist(value);
  },

  clear() {
    current = empty;
    persist(empty);
  },
};
