# 🎛️ Crate Digger

Your music collection as 90s record crates. Flip through the sleeves, pull one out, and spin it.

Self-hosted, manually curated, built with Vue 3 + Fastify + SQLite.

- 📄 [Spec](docs/SPEC.md)
- 🧭 [Architecture decisions](docs/adr/)

## Getting started

Requires Node 22.18+ (the API runs TypeScript directly — see [ADR 0002](docs/adr/0002-native-typescript-and-shared-package.md)).

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
| `npm run build`     | Production build of the web app   |

## Database

SQLite file at `data/crate.db` (git-ignored). Migrations run automatically when the API starts.

| Command                           | What it does                                            |
| --------------------------------- | ------------------------------------------------------- |
| `npm run db:seed -w apps/api`     | Wipe the DB and load sample records                     |
| `npm run db:generate -w apps/api` | After editing `src/db/schema.ts`, write a new migration |
| `npm run db:studio -w apps/api`   | Browse the data in Drizzle Studio                       |

## API

| Method & path                | Does                              |
| ---------------------------- | --------------------------------- |
| `GET /api/health`            | API + database check              |
| `GET /api/crates`            | Crates with album counts          |
| `GET /api/albums?crateId=`   | Album summaries in crate order    |
| `GET /api/albums/:id`        | One album with its tracks         |
| `POST /api/albums`           | Create (optionally with `tracks`) |
| `PATCH /api/albums/:id`      | Change only the fields sent       |
| `PUT /api/albums/:id/tracks` | Replace the whole tracklist       |
| `DELETE /api/albums/:id`     | Delete (its tracks go too)        |

Errors always look like `{ statusCode, error, message, issues? }`.

## Layout

```
packages/shared   Zod schemas + types: the contract between API and web
apps/api          Fastify backend (src/app.ts builds the app, src/server.ts starts it)
  src/routes/     HTTP: schema in, status code out — thin
  src/services/   business logic: plain functions taking (db, input)
  src/plugins/    db connection, error handler
  src/db/         schema.ts (tables), client.ts (connect + migrate), seed.ts
  drizzle/        generated SQL migrations — committed, never edited by hand
apps/web          Vue 3 frontend (src/App.vue is the entry component)
docs/      Spec + architecture decision records
```

## Status

🚧 Early development — see the milestone table in the [spec](docs/SPEC.md#6-milestones-one-pr-to-main-each).
