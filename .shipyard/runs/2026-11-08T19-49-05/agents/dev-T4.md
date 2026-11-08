# dev-T4: Follow, following, feed and suggestions API

Commit: 88309b8 `feat(api): add follow, following, feed and suggested collectors routes`

## What landed

- `apps/api/src/services/follows.ts`: followUser, unfollowUser, listFollowing, getFeed, listSuggestedCollectors, FEED_LIMIT = 50.
- `apps/api/src/routes/follows.ts`: `followRoutes` with a data-classification comment. All five routes use a `preValidation` calling requireUser, so signed-out callers get 401 before param validation.
- `apps/api/src/app.ts`: registers `followRoutes` under /api, before webPlugin.
- `apps/api/test/follows.test.ts` (26 tests) and `apps/api/test/feed.test.ts` (18 tests).

Behaviour as specified:
- PUT follow: 204, repeat 204 with no new row (onConflictDoNothing), 404 unknown, 400 self.
- DELETE follow: 204, repeat 204, 404 unknown, self is a no-op 204.
- GET /me/following: created_at desc, id desc.
- GET /me/feed: crates.created_at desc, id desc, limit 50, albumCount via left join, createdAt via `.toISOString()`.
- GET /me/suggested-collectors: demo users not followed and not the viewer, by username.

`isDemo` is computed in SQL (`demo_seed_key IS NOT NULL`), so the demo key is never selected into a response.

## Test results (run by me; a tester decides whether this is done)

- `npm test -w apps/api`: 18 files, 294 tests, all pass.
- `npm run typecheck -w apps/api`: no errors printed. The exit code I echoed was tail's, so rely on the empty output, or rerun.
- eslint and prettier on my 5 files: clean. I did not run root `npm run lint`, `format:check`, `build` or web tests.

All tests use buildTestApp (in-memory). Nothing touched data/.

## Coverage against criteria

- AC12: every status, row counts, the unique constraint, cascade in both directions on direct user delete.
- AC13: counts move by exactly 1 after follow and unfollow, repeats do not move them, viewerFollows true/false/signed-out, key absence.
- AC14: three users, set created_at values, inclusion, exclusion, order, limit of 50, key absence.
- AC16: API side only (suggested-collectors contains every unfollowed demo user). The view is not part of this task.

## Doubts and things to check

1. "Numeric id" absence is not a literal recursive check on `id` everywhere. `crateCard.id` and `publicProfile.crates[].id` are crate ids and part of the shared contract. The tests assert no `id` recursively on collector summaries; on the feed they assert the exact card key set and the absence of email/role/ownerId/userId/followerId/followeeId recursively; on profiles they assert no top-level `id` and the absence of the same private keys recursively. A tester reading "absence of those keys at every nesting level" strictly should know this.
2. AC13's profile fields were already implemented by an earlier task in services/profiles.ts. I only tested them and did not change that file.
3. Follow `created_at` has one-second resolution, so same-second follows fall back to id desc. Tested.
4. A malformed username (for example `x`) from a signed-in user returns 400 from param validation, not 404. Signed out it returns 401. The criteria do not list this case; I kept the shared `usernameParams` behaviour.
5. Suggested collectors can include demo users with no crates, and a demo user who has been followed then unfollowed returns to the list. Both follow the spec as written.
6. Small test duplication: `allKeys` is defined in both test files because `test/helpers.ts` is not mine to change.

## Shortcuts

None in the implementation. No dependencies added. No blockers.
