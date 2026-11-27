# Working in this repository

Two apps: `api/` — the local collector (Fastify 5 + SQLite via `node:sqlite`) that
receives Claude Code hooks — and `web/` — the dashboard (SvelteKit 2 + Svelte 5
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
| Reviewing a diff before merge | `architecture-review` |

## Non-negotiables

- No `else` — guards are early returns.
- No chained `if`/`switch` choosing among known values — that is a lookup table.
- No `class`. Every unit is a factory taking its dependencies as an argument.
- `process.env` is read in `api/app/config/env.config.js` and nowhere else.
- No `fetch` outside `web/src/lib/services/api-client.js`.
- Services never import stores or other services.
- **Every route declares `local: true`.** The collector receives every command
  and path an agent touches; only this machine may read or write it.
- Hook payloads are untrusted input: declare the fields you read in
  `collector.schema.js`, everything else is stripped.
- New environment variables go in `api/app/config/env.manifest.js`.
- A route that reads input is `validate: true`; controllers read `request.body`,
  which Fastify has already replaced with the validated, stripped value.
- A guard that refuses **returns the reply** (`return reply.code(403).send(…)`);
  otherwise the next hook runs.
- The dashboard draws only what `buildSessionModel(events)` derives; never keep a
  second copy of session state in a component.
- Branches are `<type>-<short-description>` (`feat-`, `fix-`, `ci-`, `docs-`,
  `refactor-`), no slashes.

## Every pull request updates the changelog and the docs

- Add an entry to [`CHANGELOG.md`](CHANGELOG.md) under `## [Unreleased]`, in the
  Keep a Changelog section that fits, written for the person running the panel.
  CI fails a pull request that does not touch it; only a change nobody could
  notice takes the `skip-changelog` label, with the reason in the description.
- Update every doc the change makes wrong, in the same pull request. The map of
  which change touches which doc is in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#which-doc-to-update). A new variable,
  command, instrument or capture path without its README line is not done.

## Verify before claiming done

```bash
npm run verify   # api lint + tests + integration, web lint + check + tests
```

`npm run check` must report **0 errors**. It is a JSDoc type gate, not advice.
