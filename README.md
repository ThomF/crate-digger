# 🎛️ Frisson

Your music collection as 90s record crates. Flip through the sleeves, pull one out, and spin it.

Self-hosted, manually curated, built with Vue 3 + Fastify + SQLite.

- 📄 [Spec](docs/SPEC.md)
- 🚀 [Deploying it](docs/DEPLOY.md): Docker Compose + Caddy, backups and restores
- 🧭 [Architecture decisions](docs/adr/)

## Getting started

Requires Node 22.18+ (the API runs TypeScript directly — see [ADR 0002](docs/adr/0002-native-typescript-and-shared-package.md)).

```bash
npm install
npm run dev
```

- Web: http://localhost:5173 (Vite, hot reload). Flip through a crate with the scroll wheel,
  by dragging down, or with ↑/↓, Home/End, PageUp/PageDown; Enter pulls the record out.
  In a sorted crate, type a letter to jump to its divider.
  `/list` searches and rearranges the collection; `/crates` adds, renames and sorts crates.
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

## Accounts

- Anyone can browse, signed in or not.
- Signed-in users can create crates and edit only their own crates and the albums in them.
- Admins can edit everything, including crates from before accounts existed.
- Sign up at `/signup`. Sessions last 30 days. Log in and sign up are rate limited to 10 tries per
  15 minutes per IP.

The first admin comes from `ADMIN_EMAIL` + `ADMIN_PASSWORD`: on a start with no admin yet, the API
creates one. Changing them later does not change an existing admin. Try it locally with
`ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=pick-something npm run dev`, or leave them out and
just sign up.

### Environment variables

| Variable                       | What it does                                                     |
| ------------------------------ | ---------------------------------------------------------------- |
| `ADMIN_EMAIL`                  | Email of the first admin account (created on first start)        |
| `ADMIN_PASSWORD`               | Password of that admin, at least 8 characters                    |
| `TRUST_PROXY`                  | `true` behind a proxy you control, so rate limits are per IP     |
| `DATA_DIR`                     | Where the database and covers live (default `data/`)             |
| `DATABASE_PATH` / `COVERS_DIR` | Override the database file or covers folder individually         |
| `DOMAIN`                       | Compose only: the domain Caddy serves and gets a certificate for |

`SESSION_SECRET` is no longer used.

## Database

Everything the app stores lives in `data/` (git-ignored), so backing up means copying one folder:

- `data/crate.db`: the SQLite database. Migrations run automatically when the API starts.
- `data/covers/`: uploaded cover art, re-encoded as 800×800 JPEGs.

Override the locations with `DATA_DIR`, or individually with `DATABASE_PATH` and `COVERS_DIR`.

| Command                                    | What it does                                            |
| ------------------------------------------ | ------------------------------------------------------- |
| `npm run db:seed -w apps/api`              | Wipe the DB and load sample records                     |
| `npm run db:generate -w apps/api`          | After editing `src/db/schema.ts`, write a new migration |
| `npm run db:studio -w apps/api`            | Browse the data in Drizzle Studio                       |
| `npm run db:backup -w apps/api`            | Consistent copy of the DB into `data/backups/`          |
| `npm run db:restore -w apps/api -- <file>` | Replace the DB with a backup (stop the app first)       |

## API

| Method & path                    | Does                                       |
| -------------------------------- | ------------------------------------------ |
| `GET /api/health`                | API + database check                       |
| `POST /api/auth/signup`          | `{ email, username, password }`, logs in   |
| `POST /api/auth/login`           | `{ email, password }` (sets a cookie)      |
| `POST /api/auth/logout`          | Log out                                    |
| `GET /api/auth/me`               | The signed-in user (401 if signed out)     |
| `GET /api/crates`                | Crates with album counts                   |
| `POST /api/crates`               | New crate (at the end of the shelf)        |
| `PATCH /api/crates/:id`          | Rename, recolor, change how it sorts       |
| `DELETE /api/crates/:id`         | Delete an empty crate (409 if not empty)   |
| `PUT /api/crates/order`          | Reorder the shelf: `{ ids: [...] }`        |
| `GET /api/albums`                | Summaries; `?crateId= &q= &genre= &sort=`  |
| `PATCH /api/albums/:id/position` | Move: `{ crateId, position }`              |
| `GET /api/albums/:id`            | One album with its tracks                  |
| `POST /api/albums`               | Create (optionally with `tracks`)          |
| `POST /api/albums/:id/cover`     | Upload cover art (multipart field `cover`) |
| `DELETE /api/albums/:id/cover`   | Remove the cover                           |
| `GET /covers/:file`              | Cover images (cached for a year)           |
| `PATCH /api/albums/:id`          | Change only the fields sent                |
| `PUT /api/albums/:id/tracks`     | Replace the whole tracklist                |
| `DELETE /api/albums/:id`         | Delete (its tracks go too)                 |

Creating needs a signed-in user; changing a crate or its albums needs its owner or an admin
(401 signed out, 403 not allowed). Errors always look like `{ statusCode, error, message, issues? }`.

## Layout

```
packages/shared   Zod schemas + types: the contract between API and web
  src/sorting.ts  filing rules shared by API and web (no Zod: safe for the main bundle)
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

## Deploying

```bash
cp .env.example .env   # set ADMIN_EMAIL, ADMIN_PASSWORD (and DOMAIN on a server)
docker compose up -d --build
```

The full walkthrough, with backups and restores, is in [docs/DEPLOY.md](docs/DEPLOY.md).

## Status

All spec milestones through deployment are done. Next up: polish (milestone 10).
