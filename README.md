# node-svelte-clean-template

A working two-tier application you can rename and build on: a layered Fastify
REST API and a SvelteKit single-page app, with the deploy pipelines, the
architecture rules, and the agent skills that keep both from drifting.

The architecture is lifted from a production system; the package versions and
idioms are current as of 2026. Everything here runs — 57 API tests, 20 web tests,
zero lint errors, zero type errors, out of the box.

---

## Start

```bash
node scripts/bootstrap.mjs --name="My Project"
```

Renames the packages and containers, generates real secrets, writes both `.env`
files. Then:

```bash
npm run db:up          # MongoDB in Docker
npm run install:all    # api + web
npm run dev:api        # http://localhost:3001
npm run dev:web        # http://localhost:5173
```

Create the first account (any 24-character hex string works as a tenant id):

```bash
cd api && npm run seed:admin -- --email=you@example.com --name="You" --tenantId=$(openssl rand -hex 12)
```

Verify everything at once:

```bash
npm run verify         # lint + type check + unit + integration
```

---

## What is in here

```
api/     Fastify 5 · MongoDB 7 · Joi 18 · JWT · Docker
web/     SvelteKit 2 · Svelte 5 runes · Tailwind 4 · Vite 8 · Vitest 4 · Playwright
docs/    architecture, deploy, environment, testing, ADRs
.github/ CI, two release pipelines, weekly audit, Dependabot
.claude/ five skills that encode the conventions
```

An example resource, `items`, exists end to end — route row, schema, controller,
use case, repository, serializer, tests, service, panel, page. Copy it; the
[`api-resource`](.claude/skills/api-resource/SKILL.md) skill walks the seven
files in order.

---

## The ideas worth knowing before you edit anything

**Layers, one-way.** `routes.json → guards → validation → controller → use case →
repository`. A change stays local because no layer knows the one above it.

**Dependencies are arguments.** Every unit is a factory receiving its
collaborators. There is one composition root per app. Nothing else imports a
connection or reads `process.env` — which is why the whole test suite runs with
no database and no mocking framework.

**Behaviour is data.** Routes are rows. Guard chains, HTTP outcomes, status
labels and UI variants are lookup tables. Adding a case adds a row; the control
flow never grows a branch.

**Tenancy is enforced.** Two guards, two questions: `permission` proves the
role, `tenant-scope` proves the caller belongs to *that* tenant. Role alone
leaves an admin of tenant A reading tenant B by editing the URL — a 200, and
invisible to any test that uses one tenant.

**The environment is one manifest.** `api/app/config/env.manifest.js` is read by
the config, by the boot check, and by the script that renders the release `.env`.
A variable the code needs cannot be missing from a deploy.

Full reasoning: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the
[ADRs](docs/adr/). Wondering why this is not just SvelteKit endpoints?
[ADR 0006](docs/adr/0006-separate-api-deployable.md) has the trade-off tables.

---

## Skills

`.claude/skills/` — Claude Code picks these up automatically in this repository.

| Skill | For |
| --- | --- |
| [`code-style`](.claude/skills/code-style/SKILL.md) | Functional composition, lookup tables over chained ifs, early returns, immutability |
| [`api-resource`](.claude/skills/api-resource/SKILL.md) | Adding a REST resource, all seven files, in order |
| [`web-feature`](.claude/skills/web-feature/SKILL.md) | Adding a screen without breaking the layer rules |
| [`deploy-runbook`](.claude/skills/deploy-runbook/SKILL.md) | Releasing, rolling back, debugging a failed deploy |
| [`architecture-review`](.claude/skills/architecture-review/SKILL.md) | Reviewing a diff before merge |

---

## Deploy

Push to `main`. `api/` builds an image, pushes it to GHCR, and the server pulls
it; `web/` builds static files and rsyncs them into a symlinked release
directory. Both run the full CI suite first, and the API deploy verifies the
rendered `.env` **by name** before touching the server.

Required repository settings are listed in
[`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md); the procedure and the failure modes
are in [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Also here

- [`ISSUES.md`](ISSUES.md) — what this template deliberately leaves unfinished,
  and what to do about each.
- [`AUDIT-CARDONIUM.md`](AUDIT-CARDONIUM.md) — the audit of the system this was
  derived from: what was worth keeping, what was fixed here, and what still
  needs fixing there.

## License

MIT.
