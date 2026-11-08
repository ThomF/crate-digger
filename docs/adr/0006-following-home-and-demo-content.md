# ADR 0006 — Following, a Home page and fictional demo content

- **Status:** Accepted
- **Date:** 2026-11-08
- **Builds on:** [ADR 0005](0005-user-profiles.md)

## Context

Frisson opened straight on the crate browser, with one person's records and nobody else in sight.
ADR 0005 gave every account a public profile but left follows and a feed out of scope. Frisson
should have a front page, let collectors follow each other, and show visitors what the app feels
like with people in it, even on a fresh instance with no other users. It must not add services or
network calls, must not pretend invented content is real, and must not let invented accounts be
used.

## Decision

- **Four main pages, and the crate browser moves to `/shelf`.** The masthead nav links to Home
  (`/`), Following (`/following`), Profile (`/profile`) and About (`/about`). Following and Profile
  need a signed-in user; the others are public. `/profile` shows your own profile with the
  `/u/:username` view and keeps its URL. The crate browser, previously at `/`, now lives at `/shelf`
  and at the public deep link `/crates/:id`. `/list`, `/crates`, `/albums/*`, `/u/:username`,
  `/profile/edit`, `/login` and `/signup` do not move.
- **A `follows` table, with public counts and private lists.** Each row is a follower and a followee,
  both FKs to `users` with `ON DELETE CASCADE`, unique per pair, and a `CHECK` rejects following
  yourself. Follower and following counts are public on a profile, along with `viewerFollows`, the
  viewer's own yes or no (always false signed out). The lists of who follows whom are not public: the
  only list route is `GET /api/me/following`, and it is always the viewer's own. Following twice keeps
  one row. Following yourself is a 400 and an unknown user a 404. All of this is added by migration 0005.
- **The feed is the crates of people you follow.** `GET /api/me/feed` returns crates owned by the
  viewer's followees, newest created first, at most 50, including empty ones. There is no ranking.
- **Public-data rule.** Follow, feed, news and recommendation responses use their own schemas
  (`collectorSummary`, `crateCard`, `newsItem`), built from explicit column lists. They carry no email,
  password hash, role, numeric user id or seed key. `isDemo` is the only trace of a seed key.
- **Recommendations are an editorial rank, with no AI model.** `crates.recommended_rank` is a nullable
  integer. `GET /api/crates/recommended` returns ranked crates, lowest rank first, leaving out any crate
  with no owner, since a card has to name one. Only demo content sets a rank today; no route or screen
  does. Home and About both say that no AI model is involved.
- **News is stored locally, with no network calls.** `news_items` holds the fictional items and
  `GET /api/news` returns them newest first. Nothing fetches from outside, and there is no route for
  writing news: the demo step is the only source of rows.
- **Demo content is delivered at API start, from `server.ts`.** `seedDemoFromEnv` runs next to
  `bootstrapFromEnv`, not in `buildApp`, so `buildTestApp` still starts from an empty database. The
  content is in `apps/api/src/db/demo-content.ts`, a data-only module marked as fictional, and
  `apps/api/src/services/demo-seed.ts` writes it. The whole seed is one transaction. If it fails the
  API logs the error and starts anyway, with no demo rows, because the content is optional.
- **Stable seed keys, insert-if-missing.** Demo users, crates and albums carry a unique
  `demo_seed_key`, and news rows a `seed_key`; these columns are `NULL` on real users, crates and
  albums. Each start matches rows by key and inserts only what is missing. It never updates, so a
  renamed demo crate stays renamed, and a deleted demo row comes back on the next start. New demo
  crates go after every current crate on the shelf. If a real account already holds a demo username
  or email, that demo user and their crates are skipped, a warning is logged and the real account is
  left alone.
- **`db:seed` cannot deliver it.** `npm run db:seed` deletes all crates, albums and tracks and the
  covers folder, refuses to run in production, and only runs when someone runs it. Instead, the next
  start after a `db:seed` restores the demo crates, under their demo owners. `db:seed` leaves users,
  follows and news alone.
- **Default on except in production, with `SEED_DEMO_DATA` to override.** `true` always adds the
  content and `false` never does. Anything else, including unset and the empty string that
  `compose.yaml` passes, means add it everywhere except `NODE_ENV=production`. The Docker image sets
  `NODE_ENV=production`, so a Compose deployment gets nothing unless its owner asks.
- **Demo users are inert.** Their stored password hash is a fixed sentinel that is not a scrypt string,
  so `verifyPassword` rejects every password, including the sentinel itself. Their emails use
  the reserved `.invalid` domain, so nothing can be delivered to them. They are never admins, never
  verified, and have no links or avatars. They follow nobody, because the seed writes no follow rows.
- **Demo content is labelled.** A `Demo` tag marks news items, and collectors with `isDemo` on profiles
  and the Following page. The Recommended section says its picks are curated demo picks, and About
  explains what is made up. `GET /api/me/suggested-collectors` suggests only demo users the viewer does
  not follow yet, so it is empty without demo data.
- **Tracks are not individually keyed.** Tracks are written only together with a newly inserted demo
  album. A track removed from a demo album that still exists does not come back.

## Consequences

- Upgrading needs no manual step: migration 0005 only adds tables and columns, and an upgraded
  production instance gets no demo rows.
- **Fake collectors stay visible until someone removes them.** On an instance where demo content was
  added, the demo users and crates are public like any others: on `/shelf`, `/list`, profiles and the
  API. Turning `SEED_DEMO_DATA` off stops further inserts but removes nothing, and **no removal command
  is in scope**. An admin can empty and delete demo crates, which then stay gone only if seeding is
  off. Demo users and news have no delete route, so removing them means editing the database by hand.
- `npm run dev` and any other start without `NODE_ENV=production` adds demo content to the database it
  uses, including a developer's own `data/crate.db`, unless `SEED_DEMO_DATA=false` is set.
- With seeding on, deleted demo rows come back on the next start, so seeding and manual removal work
  against each other. Removing a demo user by hand while seeding is on recreates the user with a new
  id; demo crates that survived stay ownerless, so only admins can edit them and they leave Recommended.
- Only admins can edit demo crates, since their owners cannot log in. Moved or edited demo albums are
  left as they are, because the seed only checks whether the key exists.
- With no demo content, Home shows an empty message in both sections, with no error.
- Demo crates get new ids each time `db:seed` wipes them, so links to `/crates/:id` stop working.

## Alternatives considered

- **Seeding from `npm run db:seed`:** it wipes crates, refuses production and needs someone to run it,
  so a deployed instance could never get the content and any dev wipe would lose it.
- **Seeding inside `buildApp`:** the simplest place to call it, but every test database would start
  full of demo rows and existing tests assume an empty one.
- **Matching demo rows by name rather than by key:** renaming a demo crate would seed a second copy,
  and a real crate that happened to share a name could be mistaken for demo content.
- **Re-applying demo content on each start (upsert):** this would overwrite edits to demo rows, while
  insert-if-missing never touches anything that already exists.
- **Keying every track:** a key per track only helps restore a single deleted track of a demo album.
  Not worth a column on a table of real data.
- **Live news or a model for recommendations:** either adds an external service and network calls,
  which Frisson's self-hosted, hand-curated design rules out. Home would also be making claims about
  real people and companies.
- **A separate `is_demo` flag plus a `seed_key`:** a nullable key already says both things, so one
  column is enough.
- **Public follower and following lists:** easy to add later, and hard to take back once public. Counts
  give profiles what they need for now.
