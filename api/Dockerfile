# syntax=docker/dockerfile:1

# Two stages: dependencies are resolved once, in a layer that only changes when
# the lockfile does, and the runtime image never carries npm's cache or the dev
# dependencies. A one-stage `npm install` rebuilds the world on every source edit.
FROM node:26-slim AS deps

WORKDIR /home/node/app

COPY package.json package-lock.json ./

# `npm ci` installs exactly the lockfile — `npm install` would silently resolve
# a newer transitive version than the one CI tested.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev


FROM node:26-slim AS runtime

ENV NODE_ENV=production

# curl is here only for HEALTHCHECK. Drop it and use a node one-liner if the
# image needs to be smaller than this.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /home/node/app

COPY --from=deps /home/node/app/node_modules ./node_modules
COPY package.json ./
COPY app ./app
COPY scripts ./scripts

# The base image ships a `node` user. Running as root inside a container turns
# any RCE into root on the container filesystem for free.
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --silent --fail http://localhost:3001/v1 || exit 1

# No npm in the entrypoint: npm swallows SIGTERM, so `docker stop` would kill
# the container on the timeout instead of letting the app drain.
CMD ["node", "app/index.js"]
