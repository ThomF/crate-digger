# Surveyor 1: structure and tests (Frisson)

Monorepo (npm workspaces): packages/shared, apps/api (Fastify, native TS), apps/web (Vue/Vite).

app.ts buildApp order: error-handler, db, auth (cookie + req.user from frisson_session via onRequest hook), covers, then routes under /api: health, auth (own rate limit), crates, albums, covers, then web plugin last. server.ts adds bootstrapFromEnv for the first admin.

Tests: vitest in api (no config) and web (happy-dom in vite.config.ts, no setup file). API helpers in apps/api/test/helpers.ts: buildTestApp, signUp (real signup, returns cookie/headers), createAdmin (direct insert plus session), addCrate, multipart.

Root: npm test, npm run typecheck, lint, format:check, build. CI runs format:check, lint, typecheck, test, build, plus a Docker smoke test.

Not verified: auth route paths beyond signup/logout/me were not opened; nothing was run.
