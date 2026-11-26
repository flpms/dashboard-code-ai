# Working in this repository

Two deployables: `api/` (Fastify 5 + MongoDB) and `web/` (SvelteKit 2 + Svelte 5
runes). Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before changing
structure.

## Skills

Load the matching skill before starting. They are the conventions, not
suggestions.

| Task | Skill |
| --- | --- |
| Writing or reviewing any JS/Svelte here | `code-style` |
| Adding an API endpoint or collection | `api-resource` |
| Adding a screen, form or listing | `web-feature` |
| Deploying, rolling back, debugging a release | `deploy-runbook` |
| Reviewing a diff before merge | `architecture-review` |

## Non-negotiables

- No `else` — guards are early returns.
- No chained `if`/`switch` choosing among known values — that is a lookup table.
- No `class`. Every unit is a factory taking its dependencies as an argument.
- `process.env` is read in `api/app/config/env.config.js` and nowhere else.
- No `fetch` outside `web/src/lib/services/api-client.js`.
- Services never import stores or other services.
- **Every route with `:tenantId` declares `tenant: true`.** Omitting it lets a
  valid token from one tenant read another's data with a clean 200.
- New environment variables go in `api/app/config/env.manifest.js`.
- A route that reads input is `validate: true`; controllers read `request.body`,
  which Fastify has already replaced with the validated, stripped value.
- A guard that refuses **returns the reply** (`return reply.code(403).send(…)`);
  otherwise the next hook runs.
- Branches are `<type>-<short-description>` (`feat-`, `fix-`, `ci-`, `docs-`,
  `refactor-`), no slashes.

## Verify before claiming done

```bash
npm run verify   # api lint + tests + integration, web lint + check + tests
```

`npm run check` must report **0 errors**. It is a JSDoc type gate, not advice.
