# dashboard-code-ai

Instruments for AI coding sessions. While Claude Code works, this dashboard
shows — live — which agents and subagents are running, every tool call on a
flamegraph-like timeline, the Docker containers the session started, how the
tests are going, which files changed, which skills and MCP servers were
used, and which known vulnerabilities (CVEs/GHSAs) the project's dependencies
carry.

```
Claude Code ── HTTP hooks ──┐
docker events ──────────────┼──► collector (api/, Node + SQLite) ── SSE ──► dashboard (web/, SvelteKit)
file watcher ───────────────┤
npm audit ──────────────────┘
```

Everything runs on your machine. The collector binds to `127.0.0.1` and refuses
any other caller; nothing is sent anywhere else.

---

## Start

Requires Node 24+.

```bash
npm run install:all
npm run dev:api                 # collector on http://127.0.0.1:4317
npm run dev:web                 # dashboard on http://localhost:5173
npm run hooks:install
```

`hooks:install` adds the collector's HTTP hooks to `~/.claude/settings.json`
(your existing settings and hooks are kept; the old file is saved as
`settings.json.bak`). Every new Claude Code session on this machine then appears
on the dashboard. To instrument one project only:

```bash
npm --prefix api run hooks:install -- --settings /path/to/project/.claude/settings.local.json
```

Remove them with `npm run hooks:uninstall` (same flags).

No session at hand? `npm run demo` plays a short made-up session
against the running collector.

Hooks that cannot reach the collector fail silently after at most 2 seconds;
Claude Code keeps working with the dashboard closed.

---

## What each instrument reads

| Instrument | Source |
| --- | --- |
| Agents and the timeline | `PreToolUse` / `PostToolUse` / `SubagentStart` / `SubagentStop` hooks. Hooks carry `agent_id`, so every call lands on the lane of the agent that made it. |
| Containers | `docker events`, attributed to the session (and agent) whose `docker …` or test command ran in the 2 minutes before. |
| Tests | The summary line of the runner's output (Vitest, Jest, `node --test`, pytest), read from the Bash hook. |
| Files | `Edit` / `Write` hooks (with author), plus a watcher on the session folder for changes made by scripts and generators. |
| Resources | `Skill`, `Agent` and `mcp__*` tool calls. |
| Security | `npm audit --json` in the session folder: at session start, and again when `package.json` / `package-lock.json` change or an install command runs. Needs a `package-lock.json`; npm only for now. |
| Alerts | Critical or high vulnerabilities, last test run failing, a container that died with a non-zero code, a tool failing 3 times in a row. |

---

## Configuration

Every variable has a default; see [`api/.env.example`](api/.env.example).
`WATCH_DOCKER=false`, `WATCH_FILES=false` and `WATCH_SECURITY=false` turn the
watchers off (the audit calls the npm registry, so turn it off when offline);
`DB_PATH` moves the SQLite file (default `api/data/events.db`).

---

## Verify

```bash
npm run verify         # lint + type check + unit + integration
npm --prefix web run test:e2e
```

---

## How the code is organised

The layering, dependency injection and "behaviour is data" rules from the
template this repository started from still apply:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), the [ADRs](docs/adr/) and the
skills in `.claude/skills/`. [ADR 0008](docs/adr/0008-local-collector-with-sqlite.md)
records why the API became a local collector on SQLite.

## License

MIT.
