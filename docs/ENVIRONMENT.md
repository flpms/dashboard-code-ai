# Environment

## The manifest

`api/app/config/env.manifest.js` declares every collector variable once — kind,
fallback, and why it exists. Every one has a fallback: the collector must start
with no `.env` at all.

| Consumer | What it does |
| --- | --- |
| `app/config/env.config.js` | Builds the frozen, typed config the app injects |
| `StartupConfig` | Refuses to boot on a missing required name, and says which |

## Adding a variable

1. Add the entry to `env.manifest.js`, with a fallback.
2. Expose it under `config` in `env.config.js`.
3. Add it to `api/.env.example` (a test fails otherwise).

---

## Web variables

Every variable the browser receives must carry a `PUBLIC_` prefix, and is
therefore **not secret**: it is compiled into the bundle and readable by anyone.

They are baked in at **build time**. Changing one requires a rebuild; restarting
nothing will help.

| Name | Example |
| --- | --- |
| `PUBLIC_API_URL` | `http://127.0.0.1:4317` |
| `PUBLIC_APP_NAME` | `Painel de IA` |
