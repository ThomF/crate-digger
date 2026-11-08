# dev-T2: shared contracts and extended public profile

Commit: 396de6b `feat(shared): add feed contracts and follow fields on the public profile`

## What landed

- `packages/shared/src/index.ts`: `newsItem`, `collectorSummary`, `crateCard` with inferred types and `Data classification: PUBLIC` comments. `crateCard` is standalone, with no `ownerId`. `publicProfile` gains required `followerCount`, `followingCount`, `viewerFollows`, `isDemo`.
- `apps/api/src/services/profiles.ts`: `toPublicProfile(db, user, viewerId = null)` and `getPublicProfile(db, username, viewer = null)`. `isDemo = user.demoSeedKey !== null`. The field list stays explicit. `updateOwnProfile` passes the acting user's id and `setVerified` passes the actor. `services/avatars.ts` is unchanged and uses the default.
- `apps/api/src/routes/profiles.ts`: GET /users/:username passes `req.user`.
- Fixtures and key lists updated in the five test files named by the task.

## Tests added

- `apps/api/test/profiles.test.ts`, new `follow fields on the public profile` block:
  - fresh user has zero counts and viewerFollows false
  - counts per direction change by exactly 1
  - viewerFollows per viewer, including signed out, the reverse direction and self
  - PATCH /me/profile and PATCH verified responses carry real counts
  - isDemo is set and the seed key is not emitted
  - nested-key walk, signed out and as two signed-in viewers
  - a check that the walk itself catches a leak
- `apps/api/test/shared-profile.test.ts`: the four new profile fields are required; `collectorSummary`, `crateCard` and `newsItem` strip unknown keys; `crateCard` has no `ownerId` and needs an owner; ISO dates are enforced.

## Results (run by me, not a verdict)

- `npm test`: api 16 files, 250 tests pass; web 24 files, 180 tests pass.
- `npm run typecheck`: exit 0.
- `eslint` and `prettier` on my 8 files: clean. I did not run repo-wide `npm run lint`, `npm run format:check` or `npm run build`.

## Doubts and shortcuts

1. AC13 says no "numeric id" at every nesting level, but `crates[].id` is a public crate id that the web app needs for links, and the task keeps `profileCrate` as is. The walk therefore forbids `id` everywhere except directly on `crates[]` items; `email`, `role`, `passwordHash` and `demoSeedKey` are forbidden at every level. A tester reading AC13 literally for any `id` key would flag this. The task text says "at user level", which is what I followed.
2. The follows routes do not exist yet (not in this task), so the count tests insert and delete rows in the `follows` table directly. AC13's "after a follow and after an unfollow" through the real routes is not covered here and needs the follows task's tests.
3. AC23 is only partly served: this task supplies the `isDemo` field. The demo marker, login rejection, collision handling and the visible 'Demo' label belong to other tasks.
4. Nothing consumes `newsItem`, `collectorSummary` or `crateCard` yet. They are tested only at schema level. `crateCard.createdAt` and `newsItem.publishedAt` use `z.iso.datetime()`, so the services that fill them must emit a UTC `Z` string. `crates.created_at` is a Drizzle `timestamp` column that reads as a `Date`, so those services need `.toISOString()`.
5. `viewerFollows` in the PATCH verified response reflects the acting admin, as the task specifies. The avatar routes use the default, so their responses always report `viewerFollows: false`, which is correct because they only target the user's own profile.

No new dependencies. Tests used in-memory databases only; `data/` was not touched. No blockers.
