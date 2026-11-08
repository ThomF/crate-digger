# dev-T3: Fictional demo content and idempotent start-up seeding

## What landed
- `apps/api/src/db/demo-content.ts`: data only, fictional header comment. 7 users, 9 crates (7 ranked), 36 albums (4 per crate), 135 tracks, 9 news items.
- `apps/api/src/services/demo-seed.ts`: `DEMO_PASSWORD_HASH`, `shouldSeedDemo`, `seedDemoContent`, `seedDemoFromEnv`.
- `apps/api/src/server.ts`: calls `seedDemoFromEnv` after `bootstrapFromEnv`, before listen, in its own try/catch.
- `apps/api/test/demo-seed.test.ts`: 44 tests.

## Checked
Automated: demo-seed.test.ts passes (44/44); the whole API suite passed (338 tests, 19 files) in the shared tree; tsc, eslint and prettier results are in the commit step and were clean on these files unless the hand-off says otherwise.

Manual, against temp dirs only (DATA_DIR, DATABASE_PATH, COVERS_DIR, AVATARS_DIR all set; `data/` checksums identical before and after):
- 0004-level file DB with one user, crates 24/25, an album and a track: first start migrated and added 7 users, 9 crates, 36 albums, 135 tracks, 9 news. Second and third start: counts identical.
- Renamed demo crate: name kept, no duplicate, after restart.
- `npm run db:seed` on the temp DB then restart: 9 demo crates and 7 ranked back, sorted after Guitars and Beats & Bass.
- NODE_ENV=production, SEED_DEMO_DATA='': 0 rows. With SEED_DEMO_DATA=true: 7 users, 9 crates, 9 news.
- news_items dropped, seeding forced on: error logged, no rows left behind (transaction), server still answered /api/health with 200.

## Doubts and shortcuts
- My before/after diff in the manual 0004 run was invalid: the "before" dump queried demo_seed_key, which does not exist before 0005, so it came out empty. The "after" dump shows the rows exactly as I inserted them, and the automated "existing row unchanged" test covers this, but the sqlite3 dump-and-diff for AC21 has not been done properly, and not on a copy of the owner's real DB. The tester should do it.
- Names: I checked every proper noun against what I know, and replaced some near-clashes (for example "Second Helpings", "Breakwater", "Spindle", "Run-Out Groove"). I cannot prove none matches an obscure real act; no web search was done. Short generic track titles (for example "Steam", "Crumbs") may coincide with real songs; AC7 does not list track titles, but the tester may want to look.
- I went beyond the brief: album titles and artists also avoid 'ai', in case a card shows them. Track titles and news text do not ("Empty Chair Skank", for example), and the bios were not checked.
- Tracks have no durations (null), like most of seed.ts.
- Users have location null: fewer invented places.
- Login with an empty password is 400 from the existing schema, not 401. AC23 says "any password"; I tested non-empty ones only and did not change this (not my file).
- A collision with any row holding the username or email is skipped, including a row with a different non-NULL key (the brief only names NULL), because inserting would break the unique index.
- If a demo user is deleted, their crates go ownerless and bootstrap hands them to an admin on the next start. The user is recreated, but the crate stays with the admin because the seed never updates rows. Rare, left as is.
- Restored albums go to the end of their crate rather than their original slot, so manual order is not disturbed.

## Not in this task
GET /api/news and /api/crates/recommended (T5), so AC6 and AC8 API checks are not exercised here; the fixtures only meet the counts. README, .env.example and compose.yaml for SEED_DEMO_DATA are T10. The demo label is T7/T8.
