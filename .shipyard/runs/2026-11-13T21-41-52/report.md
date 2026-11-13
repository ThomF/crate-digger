# Shipyard run 2026-11-13T21-41-52: crate favorites

**Verdict: shipped. 11/11 criteria pass, 1 cycle, 0 fix rounds, 3 tasks.**

Branch: `shipyard/profile-crate-favorites-2026-11-13T21-41-52`, base 2b94aaf. Run directory: `/Users/thomasfuhriman/code/crate-digger/.shipyard/runs/2026-11-13T21-41-52/`.

## What was asked for
A signed-in user can favorite any crate they don't own from `/crates/:id`. Their favorites show in a separate Favorites section on their profile, apart from the Crates they created.

Constraints:
- A new table in migration 0006, with a unique index on (user_id, crate_id) and cascading foreign keys.
- Favorites only ever act for `request.user`.
- Favorites expose only public crate-card fields.
- PUT and DELETE copy the follow routes: 204, idempotent, and a signed-out caller gets 401 before 400.
- Browser checks run on a temp DB copy.

## Acceptance criteria
| ID | Check | Status | Evidence |
|---|---|---|---|
| AC1 | unit | pass | `migration.test.ts`: fresh DB and DB at 0005 with rows, plus structure (7 tests). |
| AC2 | api | pass | `favorites.test.ts`: PUT and DELETE return 204 and are idempotent. |
| AC3 | api | pass | `favorites.test.ts`: 400 on own crate, 401 signed out (including a non-numeric id), 404 on an unknown crate. |
| AC4 | api | pass | `favorites.test.ts`: `viewerFavorited` is true, false, and false when signed out. |
| AC5 | api | pass | `favorites.test.ts`: newest first, only owned crates in `crates`, no private fields. |
| AC6 | api | pass | `favorites.test.ts`: deleting the crate or the user removes the favorite rows. |
| AC7 | unit | pass | `ProfileView.test.ts` (35 tests): heading after Crates, link to `/crates/9`, owner name, "No favorites yet." |
| AC8 | unit | pass | `CrateView.test.ts` (40 tests) and `FavoriteButton.test.ts` (7 tests). |
| AC9 | browser | pass | `favorites.check.mjs` on a temp DB (port 4917): "PASS AC9". Favorite, profile listing, card click, unfavorite and reload all worked, at 9 click points. |
| AC10 | browser | pass | `favorites.check.mjs`: "PASS AC10". No Favorite button on the own crate. No horizontal overflow at 390px and 1280px. Centre clicks on the favorite cards opened the crates. |
| AC11 | command | pass | `test-output.txt`: API 25 files and 456 tests pass. Web suite passes, including 427 tests per the tester. Typecheck and lint ran clean. |

## What was built
`git diff --stat 2b94aaf HEAD`: 35 files, +2278 -18.
- **T1, backend (5603cf2):**
  - `apps/api/src/services/favorites.ts` (+80) and `routes/favorites.ts` (+32).
  - `schema.ts` (+29).
  - `drizzle/0006_crate_favorites.sql` (+11), plus a generated snapshot (+859).
  - Tests: `favorites.test.ts` (+366) and `migration.test.ts` (+122).
  - `packages/shared/src/index.ts` (+22).
- **T3, profile and docs (ee667c9, 686d282):**
  - The Favorites section in `ProfileView.vue` (+27), with tests (+69).
  - README, SPEC, DEPLOY and ADR 0008 (+59).
- **T2, crate page (aa6c09c):**
  - `FavoriteButton.vue` (+102) and its test (+131).
  - `CrateView.vue` (+55) and its test (+209).
  - `api/favorites.ts` (+18) and `api/crates.ts` (+6).

## Test results
There were no failures. `npm test`, typecheck and lint all exited 0. The baseline `npm test` also passed on the untouched branch. The harbormaster re-ran all checks by command after the testers returned, and all passed.

## What went wrong or needs your attention
1. **Public favorites is an assumption to confirm.**
   - Favorites are visible to anyone viewing `/u/:username` or `/profile`, like the Crates section. Follow lists stay private, so this differs from them.
   - The choice is recorded in ADR 0008. Intake flagged it as the most likely wrong assumption, and it is cheap to flip.
2. **Your `/harbor` call paused the build.** You invoked `/harbor` mid-run, and build paused after T1 until you said resume. T2 and T3 were then dispatched. No work was lost.
3. **T3 returned no handoff.**
   - It returned only "Placeholder", with no STATUS block, no test names and no statement that it ran the suite.
   - Its commits were real (ee667c9 and 686d282), with 68 test lines in `ProfileView.test.ts`. The harbormaster spot-checked the AC7 tests and found 5 real assertions.
   - The suite run, not T3's report, is what supports the AC7 pass.
4. **`browser.mjs` rewrote tracked PNGs again.** It rewrote the `ac12-long` PNGs, as the brief's risks predicted. The harbormaster restored them, so they are not in the diff.
5. **Browser criteria were untested in the first pass.** The unit tester marked AC9 and AC10 untested because no check or browser run existed then. The browser tester ran them afterwards and both passed.

## Observations for you to choose from
- T3's handoff was a placeholder with no tests or build notes. This is low severity, and the work itself checked out. Consider tightening the handoff requirement for sonnet tasks.
- At 390px the favorite cards lay out unevenly. On "Bea Jazz Box" the "by bea Display" owner text pushes "0 records" onto a second line, but "Bea Soul Box" doesn't wrap, so the card heights differ. This is cosmetic and low severity.
- T2 reported that CrateView logs `console.warn` when the favorite-state fetch fails, and the button then stays hidden. This is by design but worth knowing.
- The brief assumes a stale favorite row can stay if the viewer later becomes the crate's owner. Nothing cleans it up.

## Recommended next steps
1. Confirm or flip public favorites, per ADR 0008. Flipping means showing the section only to the profile owner.
2. Optionally fix the uneven card heights at 390px.
3. Review and merge the branch. The run directory and `.shipyard/checks/favorites.check.mjs` are committed with it.
## Token use

Size: standard. Reported total: 447,318 tokens across 11 agents.

| Role | Agents | Tokens | Share |
|---|---|---|---|
| dev | 3 | 146,529 | 33% |
| surveyor | 3 | 108,802 | 24% |
| browser-tester | 1 | 71,770 | 16% |
| manager | 1 | 57,442 | 13% |
| intake | 1 | 27,507 | 6% |
| tester | 1 | 18,702 | 4% |
| reporter | 1 | 16,566 | 4% |

| Agent | Model | Tokens | Tool uses | Seconds |
|---|---|---|---|---|
| survey-cd | sonnet | 29,217 | 19 | 34 |
| survey-st | sonnet | 41,324 | 16 | 30 |
| survey-rel | sonnet | 38,261 | 21 | 50 |
| intake | opus | 27,507 | 15 | 58 |
| manager-plan | opus | 57,442 | 26 | 168 |
| dev-T1 | opus | 65,429 | 33 | 258 |
| dev-T3 | sonnet | 34,062 | 8 | 49 |
| dev-T2 | opus | 47,038 | 14 | 142 |
| tester | sonnet | 18,702 | 9 | 23 |
| browser-tester | opus | 71,770 | 10 | 84 |
| reporter | sonnet | 16,566 | 7 | 20 |

The harbormaster's own tokens are not included: no figure was available.

### Dev models across 5 run(s)

| Model | Tasks | Fix agents | Fixes per task | Tokens |
|---|---|---|---|---|
| sonnet | 3 | 1 | 0.33 | 80,089 |
| opus | 7 | 1 | 0.14 | 509,024 |
