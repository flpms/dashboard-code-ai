# Deploy

```
push to main
├── api/**  changed → Release API : CI → image → GHCR → ssh pull + compose up → health gate
└── web/**  changed → Release Web : CI → vite build → rsync → symlink swap
```

Both call `ci.yml`, so a deploy runs exactly the checks a pull request ran —
not a second, drifting copy of them.

---

## Release API

1. **CI** — lint, format, unit and integration tests, on Node 24 and 26.
2. **Build** — `docker build` from `api/Dockerfile`, pushed to
   `ghcr.io/<owner>/<repo>-api` tagged with the commit sha *and* `latest`.
3. **Render `.env`** — `scripts/render-env.js` writes it from the workflow's
   environment, driven by the manifest.
4. **Check `.env`** — `scripts/check-env.js` fails the release, naming any
   missing variable, **before** the job touches the server.
5. **Ship** — `scp` the `.env` and `docker-compose.yml`.
6. **Restart** — `docker compose pull && up -d`. The server pulls the image CI
   built; it never builds. It needs no source checkout and no toolchain.
7. **Health gate** — poll `/v1` for up to 150 s. On failure the job prints the
   last 100 log lines and fails, so a broken deploy is red rather than quiet.

### Rollback

```bash
ssh <server> 'cd /srv/<project>/api && \
  sed -i "s|^API_IMAGE=.*|API_IMAGE=ghcr.io/<owner>/<repo>-api:<good-sha>|" .env && \
  docker compose up -d'
```

Every commit is a tagged image, so this is a pull, not a rebuild. Find the sha
in the Actions run summary.

---

## Release Web

Builds static files, rsyncs them into `releases/<sha>/`, then atomically moves
the `current` symlink. The web root points at `current`, so the site is never
serving a half-uploaded directory. The five most recent releases are kept —
rolling back is re-pointing the symlink.

---

## Before the first deploy

Both release workflows check `secrets.SSH_HOST` and **skip cleanly** when it is
absent, so a fresh clone of this template does not fail its first push. Setting
that secret is what arms them.

## Server, once

```bash
mkdir -p /srv/<project>/api /srv/<project>/web/releases
echo "<ghcr-token>" | docker login ghcr.io -u <user> --password-stdin
# point the web server's root at /srv/<project>/web/current
```

Mongo's port is bound to `127.0.0.1` in `docker-compose.yml`. Leave it that way.

**The `MONGO_CONNECTION` secret must use `mongodb` as the host**, not
`localhost`: in production the API runs inside the compose network, where the
database answers to its service name. `.env.example` uses `localhost` because it
describes the local flow, where the API runs on the host and only Mongo is
containerised.

---

## Failure modes

| Symptom | Cause |
| --- | --- |
| Fails at *Check environment* | The named variable is missing from Secrets/Variables. |
| Container restart loop | `docker compose logs api` — a `STARTUP ERROR:` line names it. |
| Health gate times out | Usually Mongo unreachable. `docker compose ps`, then the API logs. |
| CORS errors in the browser | `CORS_ALLOWED_ORIGINS` does not list the web origin. Empty means refuse — that is deliberate. |
| Everyone logged out after deploy | `JWT_SECRET` changed. Expected: every issued token is now invalid. |
| 403 where 200 was expected | The caller's tenant differs from the URL's. That is `tenant-scope` working. |
| Web shows an old API URL | `PUBLIC_*` is compiled in. Rebuild; restarting will not help. |

## Rules

- Never hand-edit `.env` on the server — it is regenerated on the next release
  and the change disappears silently.
- Never `docker compose build` in production. Run the image CI tested.
- Never deploy a branch that has not passed CI.
