# 🎛️ Crate Digger

Your music collection as 90s record crates. Flip through the sleeves, pull one out, and spin it.

Self-hosted, manually curated, built with Vue 3 + Fastify + SQLite.

- 📄 [Spec](docs/SPEC.md)
- 🧭 [Architecture decisions](docs/adr/)

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev
```

- Web: http://localhost:5173 (Vite, hot reload)
- API: http://localhost:3000/api/health (Fastify, restarts on save)

The web dev server proxies `/api/*` to the API, so the browser only ever talks to `:5173`.

## Scripts

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `npm run dev`       | Run API + web together            |
| `npm test`          | Run all tests (Vitest)            |
| `npm run lint`      | ESLint across the repo            |
| `npm run typecheck` | TypeScript / vue-tsc in every app |
| `npm run format`    | Prettier — format everything      |
| `npm run build`     | Production build of every app     |

## Database

SQLite file at `data/crate.db` (git-ignored). Migrations run automatically when the API starts.

| Command                           | What it does                                            |
| --------------------------------- | ------------------------------------------------------- |
| `npm run db:seed -w apps/api`     | Wipe the DB and load sample records                     |
| `npm run db:generate -w apps/api` | After editing `src/db/schema.ts`, write a new migration |
| `npm run db:studio -w apps/api`   | Browse the data in Drizzle Studio                       |

## Layout

```
apps/api   Fastify backend  (src/app.ts builds the app, src/server.ts starts it)
  src/db/    schema.ts (tables), client.ts (connect + migrate), seed.ts
  drizzle/   generated SQL migrations — committed, never edited by hand
apps/web   Vue 3 frontend   (src/App.vue is the entry component)
docs/      Spec + architecture decision records
```

## Status

🚧 Early development — see the milestone table in the [spec](docs/SPEC.md#6-milestones-one-pr-to-main-each).
