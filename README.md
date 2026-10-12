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

- Web: http://localhost:5173 (Vite, hot reload). Flip through a crate with the scroll wheel,
  by dragging down, or with ↑/↓, Home/End, PageUp/PageDown; Enter pulls the record out.
  `/list` shows the same collection as a plain list.
- API: http://localhost:3000/api/health (Fastify, restarts on save)

The web dev server proxies `/api/*` to the API, so the browser only ever talks to `:5173`.

## Scripts

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `npm run dev`       | Run API + web together            |
| `npm test`          | Run all tests (Vitest, API + web) |
| `npm run lint`      | ESLint across the repo            |
| `npm run typecheck` | TypeScript / vue-tsc in every app |
| `npm run format`    | Prettier — format everything      |
| `npm run build`     | Production build of the web app   |

## Database

Everything the app stores lives in `data/` (git-ignored), so backing up means copying one folder:

- `data/crate.db`: the SQLite database. Migrations run automatically when the API starts.
- `data/covers/`: uploaded cover art, re-encoded as 800×800 JPEGs.

Override the locations with `DATA_DIR`, or individually with `DATABASE_PATH` and `COVERS_DIR`.

| Command                           | What it does                                            |
| --------------------------------- | ------------------------------------------------------- |
| `npm run db:seed -w apps/api`     | Wipe the DB and load sample records                     |
| `npm run db:generate -w apps/api` | After editing `src/db/schema.ts`, write a new migration |
| `npm run db:studio -w apps/api`   | Browse the data in Drizzle Studio                       |

## API

| Method & path                  | Does                                       |
| ------------------------------ | ------------------------------------------ |
| `GET /api/health`              | API + database check                       |
| `GET /api/crates`              | Crates with album counts                   |
| `GET /api/albums?crateId=`     | Album summaries in crate order             |
| `GET /api/albums/:id`          | One album with its tracks                  |
| `POST /api/albums`             | Create (optionally with `tracks`)          |
| `POST /api/albums/:id/cover`   | Upload cover art (multipart field `cover`) |
| `DELETE /api/albums/:id/cover` | Remove the cover                           |
| `GET /covers/:file`            | Cover images (cached for a year)           |
| `PATCH /api/albums/:id`        | Change only the fields sent                |
| `PUT /api/albums/:id/tracks`   | Replace the whole tracklist                |
| `DELETE /api/albums/:id`       | Delete (its tracks go too)                 |

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
apps/web          Vue 3 frontend
  src/api/        typed fetch functions, one file per resource
  src/stores/     Pinia stores for state several screens share
  src/views/      one component per route (see src/router.ts)
  src/components/ reusable pieces, grouped by feature (crate/ is the 3D crate)
  src/composables/ reusable stateful logic (useCrateFlip: keys, wheel, drag → index)
  src/utils/      plain functions (easy to unit test)
docs/      Spec + architecture decision records
```

## Status

🚧 Early development — see the milestone table in the [spec](docs/SPEC.md#6-milestones-one-pr-to-main-each).
