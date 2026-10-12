# ADR 0003 — Deployment: one container behind Caddy

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Crate Digger should be easy to self-host on a small VPS or a home machine, safe to expose
publicly, and simple to back up.

## Decision

- **One app container** runs the API and serves the built Vue app (`WEB_DIR`). No separate web
  server for static files, and no CORS, because everything is one origin.
- **Caddy in front** for automatic HTTPS (Let's Encrypt), compression and security headers (CSP,
  HSTS, nosniff, Referrer-Policy). The app has no published port; only Caddy can reach it, which
  is what makes trusting `X-Forwarded-For` (`TRUST_PROXY`) safe.
- **All state in one volume** (`/data`): SQLite database, covers, backups. A backup is
  `backup.ts` (SQLite's online backup, written as a self-contained file) plus copying `/data`;
  restoring goes through SQLite too (`restore.ts`), never a raw file copy over a live database.
- **Image hygiene:** multi-stage build; compilers only in build stages (better-sqlite3 has no
  prebuilt binary for every platform, e.g. Linux on ARM); runs as the unprivileged `node` user;
  a health check so Compose starts Caddy only once the app answers.
- **Fail closed:** in production without `ADMIN_PASSWORD` the app is read-only, and Compose
  refuses to start without it.

## Alternatives considered

- **Nginx + certbot:** more moving parts for the same result; Caddy renews certificates itself.
- **Serving the app from a CDN / static host:** needs CORS and two deployments for one small app.
- **A managed platform (Fly.io, Render):** less to learn about servers, which is part of the point.

## Consequences

One machine, one process: fine for a personal collection, no horizontal scaling (SQLite has one
writer anyway). The image is ~530 MB uncompressed, mostly Node itself and the native image and
database libraries.
