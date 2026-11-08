# dev-T6: Web API clients and shared follow and section pieces

Commit: 1cf8e15 `feat(web): add follow and news API clients, FollowButton, DemoTag and useAsyncSection`
Criteria served: AC17, AC18, AC25 (building blocks only; the views that complete them are T7 and T8).

## What landed

- `apps/web/src/api/news.ts`: `listNews()` GET /news.
- `apps/web/src/api/crates.ts`: added `listRecommendedCrates()` GET /crates/recommended, returns `CrateCard[]`.
- `apps/web/src/api/follows.ts`: `follow` PUT, `unfollow` DELETE (/users/:username/follow, username URL-encoded), `listFollowing`, `getFeed`, `listSuggestedCollectors`.
- `apps/web/src/components/DemoTag.vue`: inline stamp, exact text 'Demo', no text-transform.
- `apps/web/src/components/profile/FollowButton.vue`: props `username`, `following`; emits `changed` with the new boolean after success only; `aria-busy` and `disabled` in flight; failure shows `errorMessage` in `role="alert"`, label stays on the prop.
- `apps/web/src/composables/useAsyncSection.ts`: `{ data, status, error, load, refresh }`.
- Tests: `FollowButton.test.ts` (14), `useAsyncSection.test.ts` (10).

## Verification I ran

- `npx vitest run` on the two test files: 24 passed.
- `npm run typecheck` in apps/web (vue-tsc): exit 0.
- `prettier --check` and `eslint` on my 8 files: clean.
- Not run: the full `npm test`, repo-wide lint or build, or anything in a browser. Nothing here is reachable from a page until T7, T8 and T9 land.

## Behaviour choices beyond the task text

- `status` starts at 'loading' and nothing is requested until the caller calls `load()`. Views must call it.
- `load()` and `refresh()` never reject. Only the newest request may write state, so a slow older response or failure is ignored.
- A failed `refresh()` sets status 'error' but keeps old data in `data`. `load()` also leaves old `data` in place while loading. Views should branch on `status`, not on `data` being present.
- `refresh()` while status is 'error' stays 'error' until it succeeds; `refresh()` during a first load stays 'loading'.
- `error` is a display string from `errorMessage()`, not the thrown object.
- FollowButton: an answer for a username the prop has since moved away from is ignored (no emit, no alert), so a reused ProfileView cannot apply one user's result to another. The trade-off is that a follow which succeeded for the old user is not reported, which is correct for the new page because it fetches its own profile.
- FollowButton clears its alert when `username` or `following` changes and on a new click.
- FollowButton overrides the `.btn` left margin to 0 in scoped CSS and adds a disabled opacity of 0.6, since base.css has no disabled style.

## Doubts and shortcuts

- The API routes (T4, T5) did not exist in the tree when I wrote this. Paths and response shapes come from the T4 and T5 task text and the shared schemas, and were not exercised against a real server.
- `listNews` and `listRecommendedCrates` have no direct test of their path. The three follows GET clients and PUT/DELETE are tested through a stubbed fetch, with the client table placed in `FollowButton.test.ts` because no separate test file was in my owned list.
- `DemoTag.vue` has no test of its own (none was listed); T7 and T8 assert the Demo label.
- A disabled button can drop keyboard focus in some browsers while a request is in flight. The task asks for `disabled`, so I kept it; not checked in a browser.
- No dependencies added. No blockers.
