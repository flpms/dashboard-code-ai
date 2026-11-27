# dashboard-code-ai

Instruments for AI coding sessions. While Claude Code works, this dashboard
shows — live — which agents and subagents are running, every tool call on a
flamegraph-like timeline, the Docker containers the session started, how the
tests are going, which files changed, which skills and MCP servers were
used, and which known vulnerabilities (CVEs/GHSAs) the project's dependencies
carry.

```
Claude Code ── HTTP hooks ──┐
Claude Code ── transcripts ─┤
docker events ──────────────┼──► collector (api/, Node + SQLite) ── SSE ──► dashboard (web/, SvelteKit)
file watcher ───────────────┤
npm audit ──────────────────┘
```

Everything runs on your machine. The collector binds to `127.0.0.1` and refuses
any other caller; nothing is sent anywhere else.

---

## Run it while you work

Requires Node 24+.

```bash
npm run install:all
npm start                       # panel on http://127.0.0.1:4317
```

`npm start` builds the dashboard and starts the collector, which serves it on
the same address: one process, one port. Open `http://127.0.0.1:4317`; Claude
Code sessions on this machine show up on their own, including the ones that
were already open.

The collector listens to Claude Code two ways, with nothing to configure:

- **Hooks.** At boot it adds its HTTP hooks to `~/.claude/settings.json` when
  they are missing (your settings are kept; the first change saves
  `settings.json.bak`). Every session started from then on reports each step
  the moment it happens.
- **Transcripts.** It follows `~/.claude/projects/**/*.jsonl`, the log Claude
  Code writes for every session and subagent. That covers sessions opened
  before the hooks existed (Claude Code reads hooks only at start) and
  sessions with hooks turned off. Transcripts written in the last 6 hours are
  read from the start; older ones only from where they are now. A session that
  sends hooks is never counted twice.

Running natively is the simplest setup: the collector sees your project folders
and the Docker daemon exactly as Claude Code does.

Rather manage the hooks yourself? Set `AUTO_INSTALL_HOOKS=false` and use
`npm run hooks:install` / `npm run hooks:uninstall` (both keep a
`settings.json.bak`). To instrument one project only:

```bash
npm --prefix api run hooks:install -- --settings /path/to/project/.claude/settings.local.json
```

Another port? `PORT=5000 npm start` installs the hooks for that port.

### Run in Docker

```bash
docker compose up -d --build    # panel on http://127.0.0.1:4317
```

The collector watches the machine it runs on, so the container is wired to the
host on purpose:

| What | Why | Setting |
| --- | --- | --- |
| `network_mode: host` | Hooks must arrive from `127.0.0.1`; through a published port they come from the bridge gateway and the loopback guard refuses them. | On Docker Desktop (macOS/Windows), enable *Settings → Resources → Network → Enable host networking*. |
| Your projects folder, read-only, at the **same path** | Hooks report each session's folder as a host path; the file watcher and `npm audit` open that path. | `PROJECTS_DIR` (default: your home folder). |
| `~/.claude`, writable, at the same path | The collector adds its hooks to `settings.json` and follows the transcripts in `projects/`. | `AUTO_INSTALL_HOOKS=false` to leave `settings.json` alone. |
| `/var/run/docker.sock` | The Containers card follows `docker events`. Access to the socket is root-equivalent on the host. | Remove the line and set `WATCH_DOCKER=false` to run without it. |
| `panel-data` volume | Keeps the event history across restarts. | — |

For example, `PROJECTS_DIR=$HOME/code docker compose up -d` mounts only that
folder. Sessions outside it still show agents, tools and tests; only file
changes made outside tool calls and the security audit need the mount.

### Develop

```bash
npm run dev:api                 # collector on http://127.0.0.1:4317
npm run dev:web                 # dashboard with hot reload on http://localhost:5173
```

No session at hand? `npm run demo` plays a short made-up session
against the running collector.

Hooks that cannot reach the collector fail silently after at most 2 seconds;
Claude Code keeps working with the dashboard closed.

---

## What each instrument reads

| Instrument | Source |
| --- | --- |
| Agents and the timeline | `PreToolUse` / `PostToolUse` / `SubagentStart` / `SubagentStop` hooks, or the same steps read from the session's transcript when it sends no hooks. Both carry the agent id, so every call lands on the lane of the agent that made it. |
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
`DB_PATH` moves the SQLite file (default `api/data/events.db`); `WEB_ROOT` is
the dashboard build the collector serves (`npm start` sets it).

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
