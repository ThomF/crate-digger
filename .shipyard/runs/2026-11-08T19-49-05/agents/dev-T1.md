# dev-T1: Additive schema and generated migration 0005

Commit: 85b4479 (feat(api): add follows, news items and demo seed columns (migration 0005))
Criteria served: AC12, AC21, AC23 (schema layer only).

## What landed
- apps/api/src/db/schema.ts: `follows` and `newsItems` tables; nullable `demoSeedKey` on users, crates, albums;
  `crates.recommendedRank`; follows relations (users.following via relation 'follower', users.followers via
  'followee'); types Follow, NewsItem, NewNewsItem. Data-classification comments on both tables.
- apps/api/drizzle/0005_follows_news_demo.sql, meta/0005_snapshot.json, meta/_journal.json, generated with the
  specified command. SQL contains only CREATE TABLE, CREATE [UNIQUE] INDEX and ALTER TABLE ADD. No `__new_` rebuild.
- test/migration.test.ts: 'migration 0005' case (0000-0004 database with users, sessions, user_links, crates,
  albums, tracks; every row kept, new columns NULL, new tables empty), plus a check that the SQL is additive.
- test/schema.test.ts: unique constraint, self-follow check, cascade on user delete, FK rejection, relations,
  demo column defaults and uniqueness, news_items seed key.

## Results (run by me, the tester decides)
- `npm test -w apps/api`: 16 files, 234 tests pass.
- Root `npm run format:check`, `npm run lint`, `npm run typecheck` exit 0.
- `drizzle-kit check` is clean, and a second `drizzle-kit generate` reports no schema changes.
- Web tests and `npm run build` not run; no web files changed.

## Things to check / deviations
1. Generated files reformatted: I ran `prettier --write` on meta/0005_snapshot.json and meta/_journal.json after
   generating. The brief says not to hand-edit them, but format:check (AC26) fails otherwise, and the earlier
   snapshots in the repo are prettier-formatted. Whitespace only: sha256 of the parsed JSON is identical before and
   after. The SQL file was not touched.
2. Existing tests changed: the 0003 and 0004 migration tests compared whole rows after createDb, which now migrates
   to 0005, so the extra columns broke them. I added the new NULL columns to their expected rows. Their intent is
   unchanged, but this is more than the "extend" the task asked for.
3. `follows.created_at` is NOT NULL with the unixepoch default (reuses timestamps.createdAt). The task did not say
   NOT NULL explicitly. Same for news_items.created_at.
4. Classification of `follows` as INTERNAL is my judgement. The brief says counts are public and lists of other
   users' follows are not exposed in this scope.
5. No `NewFollow` type added, as the task listed only Follow, NewsItem, NewNewsItem.

## Not done / not verified
- AC12 endpoints, and AC21/AC23 demo seeding, are other tasks. Only their schema support is here.
- I did not run the migration against a copy of the owner's database. The test uses a synthetic 0004 database.
- data/ was never opened. drizzle-kit generate ran with DATABASE_PATH set to a temp path (a later no-op generate
  used a nonexistent path; `drizzle-kit check` reads only the migrations folder). File sizes and mtimes of
  data/crate.db* were the same on my first and last listing; I did not take checksums.

## Dependencies
None added.
