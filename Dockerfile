# The panel in one image: the collector, with the built dashboard served at "/".
#
# The collector reads paths and sockets of the machine it watches, so the
# container needs host networking, the session folders mounted at the same
# path, and (for the Containers card) the Docker socket. docker-compose.yml
# wires all three; see "Run in Docker" in README.md.

FROM node:24-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Empty API URL: the page calls the origin that served it.
RUN PUBLIC_API_URL= PUBLIC_APP_NAME='Painel de IA' npm run build

FROM node:24-slim AS api
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/app ./app

# Only the client: it talks to the host's daemon through the mounted socket.
FROM docker:27-cli AS docker-cli

FROM node:24-slim
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /app/api
COPY --from=api /app/api ./
COPY --from=web /src/web/build /app/web/build

ENV NODE_ENV=production \
    HOST=127.0.0.1 \
    PORT=4317 \
    DB_PATH=/data/events.db \
    WEB_ROOT=/app/web/build

VOLUME /data
EXPOSE 4317

CMD ["node", "app/index.js"]
