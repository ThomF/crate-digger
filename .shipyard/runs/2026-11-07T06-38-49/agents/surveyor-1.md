# Surveyor 1: structure and tests (crate-digger)

Read-only survey. Nothing installed or run.

## Structure
- npm workspaces monorepo: packages/shared, apps/api, apps/web. Root package.json is private, ESM, engines node >=22.18, .nvmrc = 22.
- TypeScript throughout (tsconfig.base.json strict, noUncheckedIndexedAccess, verbatimModuleSyntax, erasableSyntaxOnly). API runs src/server.ts directly with node (native TS), so no API build.
- shared: zod ^4; exports ./src/index.ts and ./sorting. Only script: typecheck.
- api: Fastify 5, better-sqlite3, drizzle-orm/kit (migrations apps/api/drizzle 0000-0002), sharp, @fastify/* plugins. NodeNext module resolution.
- web: Vue 3, Pinia, vue-router, Vite 6, vue-tsc. Bundler resolution, DOM lib. Dev proxy /api and /covers to 127.0.0.1:3000.
- Docker: multi-stage Dockerfile (node:22-bookworm-slim), compose.yaml with Caddy (docker/Caddyfile). Needs ADMIN_PASSWORD.
- CI (.github/workflows/ci.yml): npm ci, format:check, lint, typecheck, test, build; separate docker build + smoke test.
- Lint: eslint.config.js flat config (eslint-plugin-vue essential, typescript-eslint recommended, prettier skip-formatting). Prettier config present.
- Docs: README, docs/SPEC.md, docs/DEPLOY.md, docs/adr/0001-0003.

## Tests
- vitest ^3.2 in api and web. api: 9 files in apps/api/test (albums, auth, covers, crates, health, schema, sorting, web, helpers). web: 13 colocated *.test.ts, environment happy-dom set in apps/web/vite.config.ts.
- shared: no tests, no test script.
- Absent: root vitest config, api vitest config, coverage config, e2e tests, per-workspace lint scripts.

## Commands from repo root
- npm ci
- npm run typecheck
- npm run lint
- npm run format:check
- npm test (or npm test -w apps/api / -w apps/web)
- npm run build (web only)

Note: node_modules already present at root. Native deps (better-sqlite3, sharp) matter for the harbormaster's test runs; Node must be >=22.18.
