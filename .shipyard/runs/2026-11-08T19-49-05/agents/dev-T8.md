# dev-T8: Following view, own profile view, follow controls on profiles

Commit: 0b8468e `feat(web): add Following and own profile views and follow controls on profiles`
Criteria served: AC4 (layout CSS only), AC16, AC17, AC18, AC19, AC23 (Demo label), AC25.

## What landed

- `views/FollowingView.vue`: title 'Following · Frisson'; three independent `useAsyncSection` sections (Following, Crates from people you follow, Suggested collectors). Each has a `role="status"` loading note and a `role="alert"` with 'Try again' (calls `load()`). The template branches on status, so a failed refresh shows the alert, not stale rows. Any FollowButton `changed` calls `refresh()` on all three.
- `views/ProfileView.vue`: follower and following counts for everyone, DemoTag beside the name, and the three viewer states decided from `session.user`. `changed` updates `viewerFollows` and moves `followerCount` by exactly 1, with no refetch.
- `views/MyProfileView.vue`: the thin wrapper from the task.
- Tests: `FollowingView.test.ts` (15), `ProfileView.test.ts` (23, 9 new), `MyProfileView.test.ts` (4). All mock the API modules. No server and no data/ access.

## Verification I ran

- `npx vitest run` on the three test files: 42 passed.
- `npm run typecheck` in apps/web: no errors on the final run. An earlier run showed two errors in `HomeView.test.ts` (T7's file); they had gone by the final run and I did not touch that file.
- `prettier --write` and `eslint` on my 6 files: clean.
- NOT run: the full `npm test`, a build, or anything in a real browser.

## Not verified / doubts

- AC4 at 320px is untested. I added wrapping CSS (`overflow-wrap: anywhere`, `min-width: 0`, `flex-wrap`), but never measured `scrollWidth`. `/following` and `/profile` do not exist until T9 adds the routes.
- AC17 reload persistence, AC19 edit-then-reload and the real API responses are not exercised here. These need the browser check after T9. The AC17 component tests use a stateful fake of the API.
- `views/FollowingView.vue` renders `RouterLink` to `{ name: 'crate' }`, and MyProfileView relies on a `my-profile` route. Neither is in `router.ts` yet (T9 owns it). Until then a RouterLink to `crate` would throw at render in the real app. The tests supply their own routes.

## Behaviour choices beyond the task text

- Count labels are always plural: '1 followers'. The task gives the exact labels 'followers' and 'following', so I did not singularise. This reads badly at a count of 1, and the owner may want to change it.
- FollowingView h2s have no `text-transform: uppercase`, unlike ProfileView's, so browser checks reading innerText see the exact heading text. This means the two pages' headings differ slightly in appearance.
- The Suggested section shows while loading or on error, and disappears only when ready and empty. If a refresh fails, the section stays with its alert even if the list was empty before.
- After a successful follow, the row stays in Suggested with 'Follow' until the refresh returns. A second click in that window repeats an idempotent PUT.
- A failed refresh after a successful follow shows that section's alert. The other sections update normally.
- Added to ProfileView beyond the task: VerifiedBadge on FollowingView rows, and wrapping CSS on `.who`, `.handle`, `.location`, `.name`, `.sub` and `.crate` for narrow widths.
- The 'Log in to follow' link is a plain underlined link, not `.btn`.

## Shortcuts and known gaps

- ProfileView's existing `load()` still has no guard against a slow older response when the username changes quickly. This was already there and I left it. A stale response could show the previous profile, with its follow button pointing at that profile's username.
- Feed cards show the owner as text, not a link to their profile (the task only asks for the owner to be shown).
- No dependencies added. No blockers. I did not edit `router.ts` or any file outside my list.
