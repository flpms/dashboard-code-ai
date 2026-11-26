# 4. One environment manifest

**Status:** accepted

## Context

The `.env` that runs in production is not `.env.example`: it is assembled by the
release pipeline. Hand-written pipelines grow a ladder of
`echo NAME=$NAME >> .env` lines, and the ladder drifts. Someone adds a variable
to the code, forgets the echo, and the service boots with `undefined` — failing
later, inside a use case, far from the cause, and often only on the code path
that happens to need it.

## Decision

`app/config/env.manifest.js` declares every variable once: kind, required,
fallback, secret, and the reason it exists. It imports nothing, so it can be
executed before `npm ci`.

Three consumers and no fourth:

1. `env.config.js` builds the typed config object;
2. `StartupConfig` refuses to boot on a missing required name, and says which;
3. `scripts/render-env.js` writes the release `.env` from CI's environment, and
   `scripts/check-env.js` verifies the result before the deploy touches the server.

## Consequences

- Adding a variable is one edit plus a repository setting.
- A missing variable fails the *release*, by name, rather than a request.
- The manifest is a second place to keep in sync with the config object. A test
  asserts every entry is documented; keeping the two aligned is still manual.
