# syntax=docker/dockerfile:1
# Built ON the VPS (amd64). Three stages: build (all deps + vite build),
# prod-deps (production node_modules, native module compiled), runtime.

ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base
RUN npm install -g pnpm@10 && pnpm --version
WORKDIR /app

# Toolchain in case better-sqlite3 has no prebuilt binary for the platform.
FROM base AS toolchain
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

FROM toolchain AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM toolchain AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_PATH=/data/nusuk-keys.db \
    MIGRATIONS_DIR=/app/migrations
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY scripts/start.mjs scripts/seed.mjs scripts/migrate.mjs ./scripts/
COPY migrations ./migrations
COPY seed ./seed
# /data is a bind mount from the host; compose runs the container as the
# host's deploy uid so the database stays readable by the backup job.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
