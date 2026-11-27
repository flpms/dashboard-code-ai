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

Two controls sit at the top right of the panel:

- **atualizar** rescans the transcripts folder by hand. It picks up anything
  the file watcher missed (a Docker or network mount can drop events) and, with
  a wider recovery window, older sessions the collector has never shown. It
  says how many new sessions it found.
- **configurações** opens the side menu. It shows whether the hooks are in
  `settings.json` and installs or removes them on the spot, turns automatic
  installation on or off, sets how many hours back a refresh and the next start
  recover, and shows the address, version and which watchers are on. The two
  settings are saved in `panel-settings.json` beside the database (`DB_PATH`) and
  win over `AUTO_INSTALL_HOOKS` and `TRANSCRIPT_BACKFILL_HOURS`. Address, port
  and watchers stay in the environment: change them there and restart.

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

Every variable has a default, so the collector starts with no `.env` at all.
[`api/app/config/env.manifest.js`](api/app/config/env.manifest.js) is the
source of truth; [`api/.env.example`](api/.env.example) lists them for copying.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `4317` | Port of the collector and the panel. The hooks are installed for this port. |
| `HOST` | `127.0.0.1` | Interface to bind. Every route still refuses non-loopback callers. |
| `DB_PATH` | `data/events.db` (in `api/`) | SQLite file with every event. `:memory:` keeps nothing. |
| `WEB_ROOT` | unset (`npm start` sets it) | Built dashboard to serve at `/`. Unset = API only. |
| `AUTO_INSTALL_HOOKS` | `true` | Add the hooks to `<CLAUDE_HOME>/settings.json` at boot when missing. The settings menu overrides it. |
| `CLAUDE_HOME` | `~/.claude` | Where Claude Code keeps `settings.json` and `projects/`. |
| `WATCH_TRANSCRIPTS` | `true` | Follow the transcripts in `<CLAUDE_HOME>/projects`. |
| `TRANSCRIPT_BACKFILL_HOURS` | `6` | At boot and on refresh, read transcripts written in the last N hours from their start. The settings menu overrides it. |
| `WATCH_DOCKER` | `true` | Follow `docker events` for the Containers card. |
| `WATCH_FILES` | `true` | Watch session folders for changes made outside tool calls. |
| `WATCH_SECURITY` | `true` | Run `npm audit` (calls the npm registry; turn off when offline). |
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, `verbose` or `debug`. |
| `LOG_PATH` | unset | Folder for log files. Unset = console only. |
| `CORS_ALLOWED_ORIGINS` | the dev server's origins | Origins allowed to call the API (only `npm run dev:web` needs it). |

In Docker, set `PANEL_PORT`, `PROJECTS_DIR`, `AUTO_INSTALL_HOOKS` and the
`WATCH_*` switches in the shell or an `.env` beside `docker-compose.yml`.

---

## Troubleshooting

**No session shows up.** Go through these in order; each one rules out a layer.

1. **Is the collector running on the port you think?**
   `curl -s http://127.0.0.1:4317/v1` answers `{"status":"ok",…}`. If not,
   start it with `npm start` (or check `docker compose logs panel`).
2. **Were the hooks installed?** The boot log says one of
   `HooksInstaller::installed`, `::present` or `::failed`. Confirm with
   `grep -c '127.0.0.1:4317/v1/hooks' ~/.claude/settings.json` (it should print
   a number above 0), or open **configurações** in the panel. `::failed` (or
   "settings.json ilegível" in the menu) means `settings.json` is not valid
   JSON; the collector never overwrites a file it cannot read, so fix it (or
   restore `settings.json.bak`) and restart. With automatic installation off,
   use **instalar hooks** in the menu or `npm run hooks:install`.
3. **Is the session newer than the hooks?** Claude Code reads hooks only when a
   session starts. Open a new session, or rely on the transcript watcher: with
   `WATCH_TRANSCRIPTS=true` an already-open session appears as soon as it writes
   its next line, if its transcript changed in the last
   `TRANSCRIPT_BACKFILL_HOURS`. For an older one, widen the window in
   **configurações** and press **atualizar**.
4. **Did anything happen yet?** Claude Code does not send HTTP hooks for
   `SessionStart`, so a session appears on its first prompt or tool call, not
   when the window opens.
5. **Is the session on this machine?** Sessions running in the cloud (Claude
   Code on the web, a remote container, a VM) post to their own `127.0.0.1` and
   never reach this collector. Run the panel where Claude Code runs.
6. **Does the log show `Loopback::refused`?** The hook arrived from an address
   that is not loopback and got a 403. In Docker this means host networking is off (see
   [Run in Docker](#run-in-docker)); outside Docker, check that nothing proxies
   `127.0.0.1:4317`.

**Changed the port and sessions stopped arriving.** Hooks carry the URL they
were installed with. Starting on a new port adds hooks for it but leaves the
old ones. Remove them with
`npm --prefix api run hooks:uninstall -- --url http://127.0.0.1:<old port>/v1/hooks`.

**Undo everything the collector did to Claude Code.** **remover hooks** in the
settings menu (which also turns automatic installation off, or the next start
would put them back) or `npm run hooks:uninstall` removes exactly its hooks and keeps the rest of `settings.json`. The file as it
was before the first install is in `~/.claude/settings.json.bak`.

**The Containers card stays empty.** The collector needs the Docker CLI and
daemon (natively) or the socket mount (Docker), and `WATCH_DOCKER=true`.
Containers are attributed to a session only if a `docker …` or test command ran
in that session in the 2 minutes before.

**The Security card stays empty.** `npm audit` needs a `package-lock.json` in
the session folder and access to the npm registry. In Docker, the session folder
must be inside `PROJECTS_DIR`.

**Claude Code got slow.** It should not: each hook times out after 2 seconds
and an unreachable collector fails immediately. If a hook hangs, something is
listening on the port without answering; stop it or turn the hooks off.

---

## Verify

```bash
npm run verify         # lint + type check + unit + integration
npm --prefix web run test:e2e
```

---

## How the code is organised

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): the two apps, the layering,
  dependency injection and "behaviour is data" rules. Per side:
  [`api/ARCHITECTURE.md`](api/ARCHITECTURE.md) and
  [`web/ARCHITECTURE.md`](web/ARCHITECTURE.md).
- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) and
  [`docs/TESTING.md`](docs/TESTING.md).
- The [ADRs](docs/adr/) record the decisions;
  [ADR 0008](docs/adr/0008-local-collector-with-sqlite.md) is why the API is a
  local collector on SQLite.
- The skills in `.claude/skills/` are the same conventions, written for an agent.

## Contributing and changes

What changed and when is in [`CHANGELOG.md`](CHANGELOG.md). How to open a pull
request, and which changelog entry and docs it must update, is in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT.
