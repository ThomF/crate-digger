# syntax=docker/dockerfile:1
#
# Builds one image that runs the API and serves the built web app.
# Multi-stage: build tools and dev dependencies stay in the earlier stages, so the final
# image only holds what's needed to run.
#
#   docker build -t crate-digger .
#   docker run -p 3000:3000 -v crate-data:/data -e ADMIN_PASSWORD=… crate-digger

# Debian-based (not Alpine): sharp ships prebuilt binaries for it, and anything that has to
# be compiled (see below) builds against the same C library the final image uses.
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Copy only the package files first. Docker caches each step, so `npm ci` (the slow part)
# only re-runs when dependencies change, not on every code change.
FROM base AS manifests
# Compilers, in case a native module (better-sqlite3) has no prebuilt binary for this CPU,
# e.g. Linux on ARM. Only the build stages get these; the final image doesn't.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# ── Stage 1: build the web app (needs dev dependencies like Vite) ──────────
FROM manifests AS web-build
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w apps/web

# ── Stage 2: production dependencies for the API only ───────────────────────
FROM manifests AS api-deps
RUN npm ci --omit=dev -w apps/api

# ── Stage 3: the image that actually runs ───────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    WEB_DIR=/app/apps/web/dist

COPY --from=api-deps /app/node_modules node_modules
COPY package.json ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/drizzle apps/api/drizzle
COPY --from=web-build /app/apps/web/dist apps/web/dist

# Everything the app writes (database, covers, backups) goes in /data, a volume.
# Run as the unprivileged "node" user that the base image provides, not root.
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

# Lets Docker (and Compose) know whether the app is actually answering.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Node runs the TypeScript source directly (ADR 0002), so there's no build step for the API.
CMD ["node", "apps/api/src/server.ts"]
