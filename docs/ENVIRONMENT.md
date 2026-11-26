# Environment

## The manifest

`api/app/config/env.manifest.js` declares every API variable once — kind,
required, fallback, secret, and why it exists.

```javascript
JWT_SECRET: { required: true, secret: true, doc: 'HMAC key used to sign access tokens' },
STORAGE_SIGNED_URL_TTL: { kind: 'number', fallback: 900, doc: 'Signed URL lifetime in seconds' },
```

Three consumers, and no fourth:

| Consumer | What it does |
| --- | --- |
| `app/config/env.config.js` | Builds the frozen, typed config the app injects |
| `StartupConfig` | Refuses to boot on a missing required name, and says which |
| `scripts/render-env.js` | Writes the release `.env` from CI's environment |

`scripts/check-env.js` verifies a rendered file. Both scripts import only the
manifest, which imports nothing — so they run before `npm ci`.

## Adding a variable

1. Add the entry to `env.manifest.js`.
2. Expose it under `config` in `env.config.js`.
3. Add it to `.env.example` and to the `Render .env` step's `env:` block in
   `.github/workflows/release-api.yml`.
4. Set it in **Settings → Secrets and variables → Actions**.

Step 3 is the only manual sync left. Miss it and the release fails at
*Check environment*, naming the variable — which is the point.

---

## Web variables

Every variable the browser receives must carry a `PUBLIC_` prefix, and is
therefore **not secret**: it is compiled into the bundle and readable by anyone.

They are baked in at **build time**. Changing one requires a rebuild; restarting
nothing will help.

| Name | Example |
| --- | --- |
| `PUBLIC_API_URL` | `https://api.example.com` |
| `PUBLIC_APP_NAME` | `Order Book` |

---

## GitHub repository settings

**Secrets** — values that must never appear in a log:

| Name | Notes |
| --- | --- |
| `JWT_SECRET` | `openssl rand -base64 48`. Rotating it invalidates every session. |
| `MONGO_CONNECTION` | Full connection string, credentials included |
| `MONGO_INITDB_ROOT_USERNAME` / `_PASSWORD` / `_DATABASE` | Container bootstrap |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | Object storage |
| `SSH_HOST`, `SSH_USERNAME`, `SSH_KEY` | Deploy target. The key should be deploy-only. |

**Variables** — non-secret configuration:

| Name | Example |
| --- | --- |
| `PORT` | `3001` |
| `LOG_LEVEL` | `info` |
| `LOG_PATH` | `/home/node/app/logs` |
| `APP_URL` | `https://app.example.com` |
| `CORS_ALLOWED_ORIGINS` | `https://app.example.com` |
| `JWT_EXPIRES_IN` | `2h` |
| `USERS_COLLECTION`, `ITEMS_COLLECTION`, `HISTORY_COLLECTION` | Collection names |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_FILES_BUCKET`, `STORAGE_SIGNED_URL_TTL` | Object storage |
| `PUBLIC_API_URL`, `PUBLIC_APP_NAME` | Web build |
| `DEPENDENCY_REVIEW` | `true` to run the dependency-review check on a private repository. It needs GitHub Advanced Security; without it the action fails every pull request, so the job skips on private repositories by default. |

---

## Local development

`node scripts/bootstrap.mjs --name="…"` writes both `.env` files with generated
secrets. To regenerate later, delete them and pass `--force-env`.

Never commit a `.env`. `.gitignore` covers `.env*` except `.env.example`.
