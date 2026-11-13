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

- Web: http://localhost:5173 (Vite, hot reload), which opens on Home. At `/shelf`, flip through a
  crate with the scroll wheel, by dragging down, or with ↑/↓, Home/End, PageUp/PageDown; Enter pulls
  the record out. In a sorted crate, type a letter to jump to its divider.
- API: http://localhost:3000/api/health (Fastify, restarts on save)

The web dev server proxies `/api/*` to the API, so the browser only ever talks to `:5173`.

A dev start adds fictional demo content to your database (see [Database](#database)).

## Pages

| Route                                    | What it shows                                             |
| ---------------------------------------- | --------------------------------------------------------- |
| `/`                                      | Home: music news and recommended crates                   |
| `/following`                             | Signed in: who you follow, their crates, suggested people |
| `/profile`                               | Signed in: your own profile                               |
| `/about`                                 | What Frisson is and which content is made up              |
| `/shelf`                                 | The crate browser: choose a crate and flip through it     |
| `/crates/:id`                            | One crate, no picker (public); signed in: Favorite button |
| `/list`                                  | Search and rearrange the collection                       |
| `/crates`                                | Signed in: add, rename and sort crates                    |
| `/u/:username`                           | Public profile: follow button, Crates and Favorites       |
| `/profile/edit`                          | Signed in: edit your profile                              |
| `/albums/:id`, `/albums/new`, `.../edit` | One album; adding and editing need a signed-in user       |
| `/login`, `/signup`                      | Log in or make an account                                 |
| `/admin`                                 | Admins only: users, suggested crates, news, bulk import   |

The masthead links to Home, Following, Profile and About. Signed-out visitors who open a signed-in
page are sent to log in first.

## Scripts

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `npm run dev`       | Run API + web together            |
| `npm test`          | Run all tests (Vitest, API + web) |
| `npm run lint`      | ESLint across the repo            |
| `npm run typecheck` | TypeScript / vue-tsc in every app |
| `npm run format`    | Prettier — format everything      |
| `npm run build`     | Production build of the web app   |

`npm run check:dev-admin -w apps/api` starts the real API on temporary databases and checks the
[local admin login](#local-admin-login): existing rows stay identical across two starts, the login
works, and a production start creates nothing. It prints PASS or FAIL per step and exits non-zero on
any failure.

### Browser checks

Playwright is a dev dependency. After `npm install`, run `npx playwright install chromium` once.
The browser binaries go outside the repo, in Playwright's default cache (`~/Library/Caches/ms-playwright`
on macOS, `~/.cache/ms-playwright` on Linux); set `PLAYWRIGHT_BROWSERS_PATH` to move them.

Run browser checks against a temp copy of the database: start the API with `DATA_DIR=<temp dir>` and
`SEED_DEMO_DATA=false`. Otherwise starting the API adds demo content to your own database.

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

### Local admin login

Outside production, each API start also makes sure `admin@frisson.com` with the password `admin`
exists, so you can log in as an admin straight away. This includes your own `data/crate.db` the next
time `npm run dev` starts or restarts. The step only ever inserts that one row:

- If an admin already has that email, nothing happens. If an ordinary account has it, the account is
  not promoted and a warning is logged.
- If the username `admin` is taken, the account gets `admin-2` (or the next free one).
- With no earlier admin and no `ADMIN_EMAIL`, it becomes the earliest admin, so ownerless crates
  are handed to it on the next start.

It never runs with `NODE_ENV=production`, even with `SEED_DEV_ADMIN=true`. Set `SEED_DEV_ADMIN=false`
to turn it off elsewhere. It is the only account allowed a password under 8 characters. See
[ADR 0007](docs/adr/0007-dev-admin-login.md) and the warnings in [docs/DEPLOY.md](docs/DEPLOY.md).

### Admin panel

Admins get an Admin link in the account menu, which opens `/admin`. It shows overview counts and lists
users, with a control for the verified badge. It also manages which crates are suggested (the
Recommended section on Home), adds and edits news, and bulk imports crates, albums and news in one
all-or-nothing request. Anyone else who opens `/admin` is sent to Home, and every `/api/admin/*` route
checks for an admin on the server. Demo rows deleted here return on the next start while seeding is on.

### Environment variables

| Variable                       | What it does                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `ADMIN_EMAIL`                  | Email of the first admin account (created on first start)                                      |
| `ADMIN_PASSWORD`               | Password of that admin, at least 8 characters                                                  |
| `TRUST_PROXY`                  | `true` behind a proxy you control, so rate limits are per IP                                   |
| `DATA_DIR`                     | Where the database, covers and avatars live (default `data/`)                                  |
| `DATABASE_PATH` / `COVERS_DIR` | Override the database file or covers folder individually                                       |
| `AVATARS_DIR`                  | Override the avatars folder (default `DATA_DIR/avatars`)                                       |
| `DOMAIN`                       | Compose only: the domain Caddy serves and gets a certificate for                               |
| `SEED_DEMO_DATA`               | `true` adds fictional demo content, `false` never; unset or empty adds it except in production |
| `SEED_DEV_ADMIN`               | `false` skips the local admin login; it never runs in production, even when set to `true`      |

`SESSION_SECRET` is no longer used.

## Database

Everything the app stores lives in `data/` (git-ignored), so backing up means copying one folder:

- `data/crate.db`: the SQLite database. Migrations run automatically when the API starts.
- `data/covers/`: uploaded cover art, re-encoded as 800×800 JPEGs.
- `data/avatars/`: uploaded profile pictures, re-encoded as 400×400 JPEGs.

Override the locations with `DATA_DIR`, or individually with `DATABASE_PATH`, `COVERS_DIR` and
`AVATARS_DIR`.

| Command                                    | What it does                                            |
| ------------------------------------------ | ------------------------------------------------------- |
| `npm run db:seed -w apps/api`              | Wipe crates, albums, tracks and covers, load samples    |
| `npm run db:generate -w apps/api`          | After editing `src/db/schema.ts`, write a new migration |
| `npm run db:studio -w apps/api`            | Browse the data in Drizzle Studio                       |
| `npm run db:backup -w apps/api`            | Consistent copy of the DB into `data/backups/`          |
| `npm run db:restore -w apps/api -- <file>` | Replace the DB with a backup (stop the app first)       |

`db:seed` refuses to run in production, and it keeps users, follows and news.

Migration 0005 adds a `follows` table (who follows whom, once per pair) and a `news_items` table
(local news; nothing is fetched from the network).

### Demo content

Each time the API starts, `apps/api/src/server.ts` adds any missing fictional demo users, crates,
albums and news items (`src/db/demo-content.ts`). This is on by default, except that with
`NODE_ENV=production`, which the Docker image sets, it needs `SEED_DEMO_DATA=true`. Set
`SEED_DEMO_DATA=false` to turn it off anywhere, including for `npm run dev`. Tests start from an empty
database, since `buildTestApp` never runs this step.

- It only inserts rows that are missing, so editing a demo crate sticks, but a deleted demo row comes
  back on the next start. So **`db:seed` wipes crates, but the next start restores the demo crates**.
- A track removed from a demo album stays removed; tracks return only if the whole album does.
- Demo users can't log in: no password matches, and their emails are undeliverable `.invalid`
  addresses. If a real account already has a demo username or email, that demo user and their crates
  are skipped.
- Demo users and crates are public, as real ones are, and turning the flag off doesn't remove them.
  There is no removal command. See [ADR 0006](docs/adr/0006-following-home-and-demo-content.md).

## API

| Method & path                         | Does                                                    |
| ------------------------------------- | ------------------------------------------------------- |
| `GET /api/health`                     | API + database check                                    |
| `POST /api/auth/signup`               | `{ email, username, password }`, logs in                |
| `POST /api/auth/login`                | `{ email, password }` (sets a cookie)                   |
| `POST /api/auth/logout`               | Log out                                                 |
| `GET /api/auth/me`                    | The signed-in user (401 if signed out)                  |
| `GET /api/crates`                     | Crates with album counts                                |
| `POST /api/crates`                    | New crate (at the end of the shelf)                     |
| `PATCH /api/crates/:id`               | Rename, recolor, change how it sorts                    |
| `DELETE /api/crates/:id`              | Delete an empty crate (409 if not empty)                |
| `PUT /api/crates/order`               | Reorder the shelf: `{ ids: [...] }`                     |
| `GET /api/albums`                     | Summaries; `?crateId= &q= &genre= &sort=`               |
| `PATCH /api/albums/:id/position`      | Move: `{ crateId, position }`                           |
| `GET /api/albums/:id`                 | One album with its tracks                               |
| `POST /api/albums`                    | Create (optionally with `tracks`)                       |
| `POST /api/albums/:id/cover`          | Upload cover art (multipart field `cover`)              |
| `DELETE /api/albums/:id/cover`        | Remove the cover                                        |
| `GET /covers/:file`                   | Cover images (cached for a year)                        |
| `PATCH /api/albums/:id`               | Change only the fields sent                             |
| `PUT /api/albums/:id/tracks`          | Replace the whole tracklist                             |
| `DELETE /api/albums/:id`              | Delete (its tracks go too)                              |
| `GET /api/users/:username`            | Public profile with links and crates (no email or role) |
| `PATCH /api/me/profile`               | Replace your `displayName`, `bio`, `location`, `links`  |
| `POST /api/me/avatar`                 | Upload your avatar (multipart image, 5 MB max)          |
| `DELETE /api/me/avatar`               | Remove your avatar                                      |
| `GET /avatars/:file`                  | Avatar images (immutable caching)                       |
| `PATCH /api/users/:username/verified` | Admin only: `{ verified }` sets the badge               |
| `PUT /api/users/:username/follow`     | Follow someone (204); following twice is fine           |
| `DELETE /api/users/:username/follow`  | Unfollow (204); not following them is fine              |
| `GET /api/me/following`               | Who you follow, most recently followed first            |
| `GET /api/me/feed`                    | Crates of people you follow, newest first, 50 at most   |
| `GET /api/me/suggested-collectors`    | Demo collectors you don't follow yet                    |
| `GET /api/news`                       | News items, newest first (public)                       |
| `GET /api/crates/recommended`         | Ranked crates, lowest rank first (public)               |
| `PUT /api/crates/:id/favorite`        | Favorite a crate (204); twice is fine; own crate is 400 |
| `DELETE /api/crates/:id/favorite`     | Unfavorite (204); not favorited is fine                 |

Creating needs a signed-in user; changing a crate or its albums needs its owner or an admin
(401 signed out, 403 not allowed). Profile routes return the public profile; the profile body is
strict, so sending `verified`, `role`, `email` or `username` is a 400. Errors always look like
`{ statusCode, error, message, issues? }`.

Profiles also carry `followerCount`, `followingCount`, `viewerFollows` (always false signed out) and
`isDemo`. Follow and `/api/me/*` routes need a signed-in user (401 otherwise). Following yourself is
a 400 and an unknown username a 404. Who follows whom stays private: the only list is your own.

`GET /api/crates/:id` returns the crate plus `viewerFavorited` (always false signed out). The
favorite routes need a signed-in user (401), an unknown crate is a 404, and favoriting your own
crate is a 400. Unlike follows, favorites are public: `GET /api/users/:username` lists them in
`favorites`, newest first, and the profile page shows them in a Favorites section below Crates.

## Layout

```
packages/shared   Zod schemas + types: the contract between API and web
  src/sorting.ts  filing rules shared by API and web (no Zod: safe for the main bundle)
apps/api          Fastify backend (src/app.ts builds the app, src/server.ts starts it)
  src/routes/     HTTP: schema in, status code out — thin (profiles: /api/users, /api/me)
  src/services/   business logic: plain functions taking (db, input), incl. profiles, demo-seed
  src/plugins/    db connection, error handler, uploads (covers + avatars)
  src/db/         schema.ts (tables), client.ts (connect + migrate), seed.ts, demo-content.ts
  drizzle/        generated SQL migrations — committed, never edited by hand
apps/web          Vue 3 frontend
  src/api/        typed fetch functions, one file per resource
  src/stores/     Pinia stores for state several screens share
  src/views/      one component per route (see src/router.ts)
  src/components/ reusable pieces, grouped by feature (crate/ is the 3D crate)
  src/composables/ reusable stateful logic (useCrateFlip: keys, wheel, drag → index)
  src/utils/      plain functions (easy to unit test)
docs/      Spec + architecture decision records
data/      git-ignored: crate.db, covers/, avatars/, backups/
```

## Deploying

```bash
cp .env.example .env   # set ADMIN_EMAIL, ADMIN_PASSWORD (and DOMAIN on a server)
docker compose up -d --build
```

The full walkthrough, with backups and restores, is in [docs/DEPLOY.md](docs/DEPLOY.md).

## Status

All spec milestones through deployment are done. Next up: polish (milestone 10).
