# Contributing

How a change gets from an idea to `main`. The rules for the code itself are in
[`CLAUDE.md`](CLAUDE.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the
skills in `.claude/skills/`; this file is about the pull request around it.

---

## Set up

Node 24 or newer.

```bash
npm run install:all
npm run dev:api        # collector on http://127.0.0.1:4317
npm run dev:web        # dashboard with hot reload on http://localhost:5173
npm run demo           # plays a made-up session against the running collector
```

Testing against a real Claude Code session from a dev checkout installs the
hooks in your own `~/.claude/settings.json`. To keep that file out of it, point
the collector at a scratch folder: `CLAUDE_HOME=/tmp/claude-dev npm run dev:api`.
Never commit a real transcript or a real `settings.json`: they hold your
prompts, commands and paths.

---

## Every pull request

1. **One branch per change**, named `<type>-<short-description>`: `feat-`,
   `fix-`, `ci-`, `docs-`, `refactor-`. No slashes.
2. **Commits** read `type: what now behaves differently`, in English, with a
   body that says why.
3. **Update [`CHANGELOG.md`](CHANGELOG.md)** under `## [Unreleased]` (see
   [below](#changelog)). CI fails a pull request that does not touch it.
4. **Update the docs the change makes wrong** (see [the map](#which-doc-to-update)).
   A pull request that adds a variable, a command, an instrument or a route and
   leaves the README describing the old behaviour is not done.
5. **`npm run verify` is green**, and `npm run check` reports 0 errors.
6. **Fill in the pull request template.** "Tests pass" is not verification; say
   what you ran and which cases you exercised.
7. **Screens** that change visibly carry before/after screenshots.

Rebase on `main` to pick up new commits; do not merge `main` into the branch.

---

## Changelog

[`CHANGELOG.md`](CHANGELOG.md) follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Add one line (or a
few) under `## [Unreleased]`, in the section that fits:

| Section | For |
| --- | --- |
| Added | A new instrument, command, variable, route or behaviour. |
| Changed | Something that existed now behaves or looks different, including dependency upgrades someone could notice. |
| Deprecated | Still works, will be removed. Say what replaces it. |
| Removed | Gone. Say what to use instead, if anything. |
| Fixed | A bug that a person running the panel could hit. |
| Security | An advisory fixed, or a change to what the collector exposes. Name the advisory. |

Write for the person running the panel, not for the reviewer: what they will
see or have to do, not which file moved. Name new environment variables and
commands in backticks. End the entry with the pull request link once it exists:
`([#42](https://github.com/flpms/dashboard-code-ai/pull/42))`. Newest entries go
at the top of their section.

A pull request with nothing a person could notice (a refactor with no change in
behaviour, a test-only change, a typo) may skip the entry: add the
`skip-changelog` label and say why in the description. Dependabot pull requests
are exempt from the check; whoever merges a group of them adds one line under
Changed or Security.

**Releasing.** Rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`, start a
fresh empty `## [Unreleased]` above it, update the compare links at the bottom,
bump `version` in the root `package.json`, and tag `vx.y.z`.

---

## Which doc to update

| When the change… | Update |
| --- | --- |
| Adds or changes an environment variable | `api/app/config/env.manifest.js`, `api/.env.example`, the README's Configuration section, and `docker-compose.yml` if Docker needs it |
| Adds or changes an `npm` script or a way to run the panel | README (Run it while you work / Develop) |
| Changes what an instrument reads or when it alerts | README, "What each instrument reads" |
| Changes how sessions are captured (hooks, transcripts) | README, "Run it while you work" and "Troubleshooting" |
| Adds a route | `api/app/v1/routes.json` with `local: true`, and `api/ARCHITECTURE.md` if it introduces a new kind of endpoint |
| Moves a responsibility between layers, or adds a layer | `docs/ARCHITECTURE.md`, `api/ARCHITECTURE.md` or `web/ARCHITECTURE.md`, and the matching skill in `.claude/skills/` |
| Makes a decision someone will later ask "why?" about | A new ADR in `docs/adr/`, linked from `docs/ARCHITECTURE.md` |
| Changes how tests are run or structured | `docs/TESTING.md` |
| Changes the Docker setup | README, "Run in Docker" |

When unsure, search the docs for the name you changed:
`grep -rn "OLD_NAME" README.md docs api/ARCHITECTURE.md web/ARCHITECTURE.md .claude/skills`.
