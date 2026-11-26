'use strict';

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * PLACEHOLDER credential handling — one module so the hash written by
 * `scripts/seed-admin.js` and the check done by the sign-in use case cannot
 * drift apart.
 *
 * SHA-256 is NOT an acceptable password hash: it is fast, which is exactly what
 * an offline cracker wants. Before this template holds a real account, replace
 * the two functions below with argon2id (`npm i argon2`) or bcrypt. Nothing
 * outside this file needs to change — that is the point of putting them here.
 *
 * What must survive the replacement: a constant-time comparison, and a caller
 * that cannot tell "unknown user" from "wrong password".
 */

export const hashPassword = plain => createHash('sha256').update(String(plain)).digest('hex');

const fixedLength = value => createHash('sha256').update(String(value)).digest();

/**
 * @param {string} candidate  password as typed
 * @param {string} storedHash value produced by hashPassword
 * @returns {boolean}
 */
export const verifyPassword = (candidate, storedHash) => {
  if (!storedHash) return false;
  // Both sides are hashed again so the buffers are always 32 bytes:
  // timingSafeEqual throws on a length mismatch, and that throw would itself
  // leak whether the stored hash was well-formed.
  return timingSafeEqual(fixedLength(hashPassword(candidate)), fixedLength(storedHash));
};
