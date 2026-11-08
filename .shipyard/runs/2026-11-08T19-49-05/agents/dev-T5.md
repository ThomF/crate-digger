# dev-T5: News and recommended crates API

Commit: 37ac1ee `feat(api): add public news and recommended crates routes`

## What landed

- `apps/api/src/services/news.ts`: `listNews(db)`. Columns are listed by hand, so `seed_key` is never selected. Order is published_at desc, then id desc. `publishedAt` goes through `.toISOString()`.
- `apps/api/src/routes/news.ts`: `newsRoutes`, public GET /news, response `newsItem.array()`.
- `apps/api/src/app.ts`: registers `newsRoutes` under /api, before webPlugin.
- `apps/api/src/services/crates.ts`: `listRecommendedCrates(db)`. Inner join on owner, left join on albums, `recommended_rank IS NOT NULL`, order by rank then id, `createdAt` through `.toISOString()`. Existing functions and `crateColumns` are unchanged.
- `apps/api/src/routes/crates.ts`: public GET /crates/recommended, response `crateCard.array()`, declared ahead of /crates/:id.
- Tests: `apps/api/test/news.test.ts` (6), `apps/api/test/recommended.test.ts` (11). `apps/api/test/web.test.ts`: it.each gains /following, /profile, /about, /shelf and /crates/5; the /api 404 JSON check is untouched. Prettier reflowed that it.each, so the diff looks larger than the change.

## Web client paths (read only)

`apps/web/src/api/news.ts` calls `/news` and `apps/web/src/api/crates.ts` calls `/crates/recommended`. `client.ts` prefixes `/api`. Both match what is registered.

## Results (run by me, not a verdict)

- `npx vitest run` in apps/api: 21 files, 360 tests, all pass, in the shared tree.
- `npx tsc --noEmit` in apps/api: exit 0.
- eslint and prettier on my 8 files: clean.
- Real HTTP, temp DB under the scratchpad (deleted afterwards), NODE_ENV=test, port 3987, start-up seeding on: GET /api/news 200 with 9 items; GET /api/crates/recommended 200 with 7 crates, all albumCount 4, owner fields present.
- Not run: root `npm run build`, repo-wide lint and format, web tests.

## AC coverage

- AC6: API half covered. Home rendering is another task.
- AC8: API half covered, with Guitars and Beats & Bass present in the test database. The browser card count is not checked here.
- AC3: only the fallback, using a stand-in web dir in web.test.ts. The real production build, curl and browser reload part of AC3 was NOT done by me, and neither was the check that Vue renders the right page. The tester needs to do that.

## Doubts and behaviour to check

1. The endpoint does not filter on albumCount. AC8's "at least 4 albums" holds because the seed gives each ranked crate exactly 4. If albums are removed from a ranked crate, or it is emptied, it still appears with a lower count; a test pins the empty case at albumCount 0. The task says "left join for albumCount" and names no filter, so I followed that. Likewise "at least 6" comes only from the seed's 7 ranked crates; the endpoint has no minimum.
2. A ranked crate with no owner is dropped by the inner join, as specified. A test pins this. It means the demo crate-loss case in T3's report (a demo user deleted, crate handed to an admin) would show the admin as the owner on the card.
3. A test also asserts `/api/crates/recommendations` is 400, which is the existing idParams behaviour, not something new.
4. The "keeps the /crates shapes" test checks `crate` schema parsing and ownerId present, createdAt absent. Existing `crates.test.ts` still passes unmodified.
5. Fastify's router prefers static segments regardless of declaration order, so the declaration order in routes/crates.ts is not what makes it work. It is kept to match the task; the test covers the behaviour either way.

## Other notes

- First commit attempt hit `.git/index.lock` from another dev's concurrent commit. I waited and retried, and did not remove the lock. The commit used explicit paths and contains only my 8 files.
- No browser check: this task has no UI of its own.
- No new dependencies, no credentials. Tests use in-memory databases and `data/` was not touched.

## Shortcuts

None in the implementation. `allKeys` is a third copy in the tests (feed and follows have their own), because `test/helpers.ts` is not mine to change.

No blockers.
