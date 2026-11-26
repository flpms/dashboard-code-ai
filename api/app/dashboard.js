'use strict';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import fastifyStatic from '@fastify/static';

import { RequireLoopback } from './v1/guards/loopback.hook.js';

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

/**
 * CSP hashes of the inline scripts in a page. SvelteKit boots the app from one
 * inline <script> in index.html; helmet's default `script-src 'self'` blocks it.
 * Allowing exactly those bytes keeps every other inline script blocked, which
 * `'unsafe-inline'` would not.
 *
 * @param {string} html
 * @returns {string[]} e.g. ["'sha256-…'"]
 */
export const inlineScriptHashes = html =>
  [...html.matchAll(INLINE_SCRIPT)]
    .map(([, body]) => body)
    .filter(body => body.trim())
    .map(body => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);

/**
 * The page's policy: helmet's defaults, plus the boot script's hash, minus
 * `upgrade-insecure-requests` (the collector is plain HTTP on loopback).
 *
 * @param {string[]} hashes
 */
export const dashboardPolicy = hashes =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' https: data:",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "script-src-attr 'none'",
    "style-src 'self' https: 'unsafe-inline'",
  ].join(';');

// Hashed file names under _app/immutable never change; everything else
// (index.html first) must be re-read so a rebuild shows up on reload.
const cacheControlFor = path =>
  path.includes('/_app/immutable/') ? 'public, max-age=31536000, immutable' : 'no-cache';

/**
 * Serves the built dashboard at `/` when WEB_ROOT points at it, so the whole
 * panel is one process on one address: no second server, no CORS, and the
 * browser talks to the same origin that receives the hooks.
 *
 * The files hold no session data, but they sit behind the same loopback guard
 * as every API route: "only this machine" is easier to reason about when it
 * has no exceptions.
 */
export const Dashboard = deps => async app => {
  const { env, Logger } = deps;
  const root = env.app.webRoot;

  const policy = dashboardPolicy(
    inlineScriptHashes(readFileSync(join(root, 'index.html'), 'utf8'))
  );

  app.addHook('onRequest', RequireLoopback(deps));
  app.addHook('onSend', async (request, reply) => {
    reply.header('content-security-policy', policy);
  });

  await app.register(fastifyStatic, {
    root,
    // The build is precompressed (svelte.config.js), so .br/.gz siblings are
    // sent as-is to browsers that accept them.
    preCompressed: true,
    cacheControl: false,
    setHeaders: (reply, path) => reply.header('cache-control', cacheControlFor(path)),
  });

  Logger.info(`Dashboard served from ${root}`);
};
