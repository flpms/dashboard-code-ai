---
name: deploy-runbook
description: Deploy, roll back, or debug a release of this project — environment variables, GitHub Actions workflows, Docker images, the SSH target, and health checks. Use when asked to deploy, when a release fails, when a new environment variable must reach production, or when the app boots with a missing-variable error.
---

# Deploy runbook

Two deployables, two pipelines, one server.

```
GitHub push to main
├── api  → build image → GHCR → ssh: pull + compose up  (Docker)
└── web  → vite build  → rsync build/ to the web root   (static files)
```

---

## The environment, once

`api/app/config/env.manifest.js` is the single source of truth. It is read by
three things and nothing else:

1. `env.config.js`, which builds the typed config the app injects;
2. `StartupConfig`, which refuses to boot when a required name is missing;
3. `scripts/render-env.js`, which writes the `.env` the release ships.

**Adding a variable is one edit.** Add the entry to the manifest, expose it under
`config`, set it in GitHub → Settings → Secrets and variables. The release picks
it up automatically.

This is deliberately not the hand-written `echo NAME=$NAME >> .env` ladder that
release workflows tend to grow. That ladder drifts: someone adds a variable to
the code, forgets the echo, and the service boots with `undefined`, failing later
inside a use case, far from the cause.

Secrets (`secret: true`) go in **Secrets**; everything else in **Variables**.

---

## Deploying the API

Automatic on push to `main`. Manually: Actions → *Release API* → Run workflow.

The workflow, in order:

1. `npm ci && npm run lint && npm test` — a red test does not deploy.
2. `node scripts/render-env.js` writes `.env` from CI's environment.
3. `node scripts/check-env.js` verifies it. **A missing name fails here, by
   name**, before anything touches the server.
4. Build the image and push to `ghcr.io/<owner>/<repo>-api:<sha>` and `:latest`.
5. `scp` the `.env` and `docker-compose.yml` to the server.
6. `docker compose pull && docker compose up -d` — the image is pulled, not
   rebuilt on the box. The server does not need the source, a toolchain, or a
   `git pull`.
7. Poll `/v1` until the health check passes, then fail the job if it never does.

### Rolling back

```bash
ssh <server> 'cd /srv/<project>/api && API_IMAGE=ghcr.io/<owner>/<repo>-api:<good-sha> docker compose up -d'
```

Every commit is a tagged image, so a rollback is a pull — no rebuild, no branch
surgery. Find the good sha in the Actions run summary.

---

## Deploying the web app

Automatic on push to `main`. The build is static files: `rsync` into the web
root, atomically, then the old directory is removed.

`PUBLIC_*` variables are compiled **into the bundle** at build time. Changing one
requires a rebuild — restarting nothing will help. And they are public by
construction: never put a secret behind a `PUBLIC_` prefix.

---

## First-time server setup

```bash
mkdir -p /srv/<project>/api
# copy docker-compose.yml there; the .env arrives with each release
echo "<token>" | docker login ghcr.io -u <user> --password-stdin
```

The API container reaches Mongo over the compose network. Mongo's port is bound
to `127.0.0.1` on purpose — an internet-reachable database is how they end up in
ransom notes.

---

## When something breaks

| Symptom | Where to look |
| --- | --- |
| Release fails at *Check environment* | The named variable is missing in GitHub Secrets/Variables. |
| Container restarts in a loop | `docker compose logs api`. A `STARTUP ERROR:` line names the cause. |
| `STARTUP ERROR: missing environment variables` | The manifest and the repository settings disagree. Add it in GitHub. |
| API answers, web shows CORS errors | `CORS_ALLOWED_ORIGINS` does not list the web origin. It is an allow-list; empty means refuse. |
| 401 on every request after deploy | `JWT_SECRET` changed. Every issued token is now invalid — expected, users sign in again. |
| 403 where 200 is expected | The caller's `tenantId` differs from the URL's. That is the tenant-scope guard doing its job. |
| Health check never green | `curl localhost:3001/v1` inside the container. A 500 here usually means Mongo is unreachable. |

### Useful commands

```bash
docker compose ps
docker compose logs -f api --tail=200
docker compose exec api node -e "console.log(process.env.NODE_ENV)"
node api/scripts/check-env.js /srv/<project>/api/.env
```

---

## Rules

- Never edit `.env` on the server by hand. It is generated; the next release
  overwrites it and the change disappears silently.
- Never `docker compose build` on the production host. The image CI tested is
  the image that runs.
- Never deploy a branch that has not passed CI.
- Rotate `JWT_SECRET` deliberately, not accidentally — it signs every session.
