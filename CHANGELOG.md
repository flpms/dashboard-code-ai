# Changelog

Every change a person running or developing the panel would notice lands here,
in the same pull request that makes it. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project will
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from its first
tag. Until then everything sits under **Unreleased**; cutting a release moves
those entries under a version heading with its date.

How to write an entry is in [CONTRIBUTING.md](CONTRIBUTING.md#changelog).

## [Unreleased]

### Added

- `CHANGELOG.md`, `CONTRIBUTING.md` and a troubleshooting guide for hooks in
  the README. Every pull request now updates the changelog and the docs it
  affects, and CI checks the changelog.
  ([#28](https://github.com/flpms/dashboard-code-ai/pull/28))
- Sessions show up without any manual step. At boot the collector adds its
  HTTP hooks to `~/.claude/settings.json` when they are missing, keeping the
  rest of the file and a one-off `settings.json.bak`; `AUTO_INSTALL_HOOKS=false`
  turns this off and `CLAUDE_HOME` points it at another folder.
  ([#27](https://github.com/flpms/dashboard-code-ai/pull/27))
- The collector follows Claude Code's transcripts in `~/.claude/projects`, so
  sessions opened before the hooks existed, or with hooks off, appear live too,
  subagents included. Transcripts from the last `TRANSCRIPT_BACKFILL_HOURS`
  (default 6) are read from the start; `WATCH_TRANSCRIPTS=false` turns it off.
  A session that sends hooks is never counted twice.
  ([#27](https://github.com/flpms/dashboard-code-ai/pull/27))
- Live tiles design system: glass tiles tinted per instrument on a dark field,
  big thin readings, a panorama header for sessions, and a signal tint only when
  a tile has something to say (failing tests, high or critical advisories,
  alerts). Running calls are drawn striped on the timeline.
  ([#23](https://github.com/flpms/dashboard-code-ai/pull/23))
- CI installs both apps on Node 24.0.0 with `--engine-strict`, the oldest
  version the README promises.
  ([#24](https://github.com/flpms/dashboard-code-ai/pull/24))
- `npm start` runs the panel as one process: it builds the dashboard and the
  collector serves it at `http://127.0.0.1:4317` (`WEB_ROOT`), behind the
  loopback guard and a CSP that allows only SvelteKit's boot script.
  ([#18](https://github.com/flpms/dashboard-code-ai/pull/18))
- `Dockerfile` and `docker-compose.yml`, with host networking, the projects
  folder mounted read-only at the same path (`PROJECTS_DIR`) and the Docker
  socket for the Containers card.
  ([#18](https://github.com/flpms/dashboard-code-ai/pull/18))
- Local collector for Claude Code: receives HTTP hooks on `POST /v1/hooks`,
  `docker events` and file changes, keeps them in an append-only SQLite log
  (`node:sqlite`) and streams them over SSE on `/v1/stream`. Every route refuses
  callers that are not loopback.
  ([#17](https://github.com/flpms/dashboard-code-ai/pull/17))
- Live dashboard: instrument strip (agents, containers, tests, files, resources,
  alerts), a flamegraph-like timeline of tool calls per agent, and a details
  panel. `npm run demo` plays a made-up session against a running collector.
  ([#17](https://github.com/flpms/dashboard-code-ai/pull/17))
- Security instrument: `npm audit` runs in the session folder when a session
  starts and again when dependency files change or an install command runs;
  critical or high findings raise an alert. `WATCH_SECURITY=false` turns it off.
  ([#17](https://github.com/flpms/dashboard-code-ai/pull/17))
- `npm run hooks:install` / `hooks:uninstall` to manage the hooks by hand, for
  the whole machine or one project.
  ([#17](https://github.com/flpms/dashboard-code-ai/pull/17))

### Changed

- `docs/ARCHITECTURE.md`, `web/ARCHITECTURE.md`, `docs/TESTING.md` and the pull
  request template describe the collector and dashboard instead of the
  template's auth, tenants and items.
  ([#28](https://github.com/flpms/dashboard-code-ai/pull/28))
- The agent timeline takes the top left of the dashboard with the call details
  beside it; the instrument wall moves below.
  ([#26](https://github.com/flpms/dashboard-code-ai/pull/26))
- Dependencies updated within their ranges, plus vitest 5,
  @vitest/coverage-v8 5, @testing-library/jest-dom 8 and dotenv 18. jsdom stays
  on 29.1, which supports every Node 24.
  ([#24](https://github.com/flpms/dashboard-code-ai/pull/24))
- eslint 10.15 and minimatch 11 in `api/`.
  ([#21](https://github.com/flpms/dashboard-code-ai/pull/21))
- The API is no longer the template's Mongo/JWT/multi-tenant example; it is a
  local collector on SQLite ([ADR 0008](docs/adr/0008-local-collector-with-sqlite.md)).
  The skills and `api/ARCHITECTURE.md` teach the new model.
  ([#17](https://github.com/flpms/dashboard-code-ai/pull/17))

### Removed

- The template's login and items screens and its server deploy pipeline.
  ([#17](https://github.com/flpms/dashboard-code-ai/pull/17))

### Fixed

- Installing on Node 24.0–24.14 no longer prints `EBADENGINE` warnings.
  ([#24](https://github.com/flpms/dashboard-code-ai/pull/24))
- The session name is the page's `h1` again, which the e2e suite relies on.
  ([#23](https://github.com/flpms/dashboard-code-ai/pull/23))

### Security

- @fastify/static 11, past the guard-bypass advisories GHSA-8pvw-jcv7-9cmj and
  GHSA-83w8-p2f5-377r.
  ([#18](https://github.com/flpms/dashboard-code-ai/pull/18))
- joi, zod, fast-uri and fastify updated past GHSA-wr44-6hxh-3jwq,
  GHSA-mrhx-c7xc-m3w5 and lower-severity advisories.
  ([#17](https://github.com/flpms/dashboard-code-ai/pull/17))

[Unreleased]: https://github.com/flpms/dashboard-code-ai/commits/main
