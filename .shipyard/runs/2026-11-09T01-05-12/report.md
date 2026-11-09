# Run report: single-crate view (run 2026-11-09T01-05-12)

**Verdict: shipped, with one reversal along the way.** All 12 acceptance criteria are passing at the end. AC12(b) first passed on a weak check, was reversed to fail, and passed only after a fix round. Nothing is merged or pushed. The branch is `shipyard/single-crate-view-2026-11-09T01-05-12`.

## What was asked

"I want update the crate view. currently it uses the old system which shows all crates in the db as a choice. this should only show the crate you are on and not all the choices to view other crates as this is viewing the one crate."

Interpretation (brief.json): "the crate view" means `/crates/:id`. That page now shows only its own crate and has the crate's name as its heading. `/shelf` shares the component and keeps its tabs, because it is the only public way to browse crates. The owner confirmed this before planning. The owner also approved adding Playwright as a dev dependency, because AC12 needs a real browser.

## Acceptance criteria

| AC | What it checks | Final | Evidence |
|---|---|---|---|
| AC1 | `/crates/2`: no `button.tab`, no Crates group, no "Guitars" or "Dub" text | pass | CrateView.test.ts |
| AC2 | Exactly one h1, equal to the label or, if the label is null, the name | pass | CrateView.test.ts, both cases |
| AC3 | Navigating from `/crates/2` to `/crates/3` updates the h1, `.now h2` and `selectedCrate`, with no tabs | pass | CrateView.test.ts |
| AC4 | Not-found, one forced reload, and the error state with Try again are kept | pass | 4 tests in CrateView.test.ts |
| AC5 | `/shelf` shows all tabs in order and remembers Dub | pass | CrateView.test.ts |
| AC6 | A tab click on `/shelf` stays on `/shelf`, with no push or replace | pass | CrateView.test.ts |
| AC7 | Flip, Back, Pull it out, ArrowDown, owner link and empty crate on `/crates/:id` | pass | CrateView.test.ts |
| AC8 | API, packages, store, CratesView, AlbumView and AlbumEditorView untouched since 24dcabd | pass | `git diff --name-only` printed nothing |
| AC9 | Spin POST and `crateId` preselect, for own crate vs another user's | pass | editControls.test.ts, 2 new tests |
| AC10 | `npm test`, typecheck and lint exit 0 | pass | api 360 tests, web 326 tests, typecheck and lint clean |
| AC11 | README row says one crate; SPEC says the picker appears only at `/shelf` | pass | checked by the tester |
| AC12 | Real-browser pass across (a) Home card, widths and the 80-char name, (b) wheel, keys, sleeve click and Back, (c) toolbar to `/shelf` | pass, after reversal | See below |

## What was built

- **T1** changed `apps/web/src/views/CrateView.vue`. The picker renders only when the `crateId` prop is undefined. `/crates/:id` gets an h1 showing `label ?? name`. A tab click on `/shelf` now switches the crate in place and no longer navigates.
- **T1** also rewrote the affected `CrateView.test.ts` cases and added two `editControls.test.ts` cases.
- **T2** changed README.md and docs/SPEC.md, and added Playwright as a dev dependency.
- **Fix round 1** was commit `57302be`, "let clicks pass through the crate box to the front sleeve". It touched `apps/web/src/components/crate/CrateBox.vue`.
- The browser script is `.shipyard/checks/browser.mjs`. Lint was run with it present.

## Test results

- Baseline before the change: `npm test` exit 0, 316 web tests.
- tester-1: 12 of 12 passed, tree clean.
- After the fix, the harbormaster ran `npm test`, typecheck, lint and format:check, and all exited 0. tester-2 reported AC12 passing with a tightened script. The final `npm test` ran 360 api tests (21 files) and 326 web tests (31 files).
- The final browser run is `cycles/1/browser-output-2.txt`. It ends `PASS AC12`, and every checked line is `ok`.
  - 11 or more crates were seeded (12), including one with an 80-character name.
  - At 1280, 390 and 320 px, a Home card lands on `/crates/:id` with no visible `.tab` and one h1 equal to the name.
  - `scrollWidth <= clientWidth` at all three widths, for the long-named crate and a normal one.
  - At 1280, the wheel, ArrowDown and ArrowRight advance `.count` from 1/4 to 4/4. A drag flips and does not open the album.
  - The sleeve click was tried at 25%, 50% and 75% of the visible art and 2px above the panel top, at 1280 and 390. Each opened `/albums/13`, and Back returned to `/crates/4`. A touch tap at 390 also opened it.
  - Clicking 10px below the panel top does nothing (`div.panel.front`, stays on `/crates/4`, count 1 / 4).
  - The toolbar Crates link opens `/shelf` with 12 tabs. A tab click switched the crate from "Album 2-1" to "Album 11-1" and the URL stayed `/shelf`.

There was no failing test output in the final run. The failure on the way is described next.

## What went wrong and why

1. **AC12(b) passed for the wrong reason.** `browser.mjs` clicked the front sleeve and passed. It had only hit a strip about 5px tall at the top of the sleeve, which is 4% of the visible art at 1280 and 2% at 390. The first tester measured 16px, but that was taken during the 0.45s transition after a key press. At rest the strip is 4 to 6px.
2. **The exploratory pass exposed it.** Real clicks at 25%, 50% and 75% of the art stayed on `/crates/1`. A touch tap on mid-art also did nothing. A click in the middle of the 5px strip did open `/albums/5`.
3. **The harbormaster reversed AC12(b) to fail.** The ledger says "AC12(b) pass was trivial (5px strip). Marked fail, direct fix round 1."
4. **The cause was not the requested change.** It was a pre-existing bug. The same 5 to 6px strip was measured at 24dcabd, and the CrateBox diff in T1 only added `max-width` and `overflow-wrap` to `.crate-label`. The likely cause is that the front sleeve is rotated and `.crate`, a transparent flat plane, takes the hit. Injecting `.crate{pointer-events:none}.crate>*{pointer-events:auto}` made the whole art clickable. `transform-style: preserve-3d` goes back to at least 4ab0f2f, and when the bug began was not found.
5. **One fix round, within the 3 allowed.** Commit `57302be` applied that fix, and the tester tightened the script to the multi-point clicks above. The tester did not re-probe clicks below the panel after a flip.

## What the cycle learned

- A click check that targets one pixel strip proves nothing about whether a user can click. Sample the whole visible area and use real mouse and touch input.
- The page's own hint ("Enter or click to pull out") promised a click that had not worked for a user at least since 24dcabd.
- The 80-character name was written straight into the temp DB, because the API caps names at 60. It is unreachable through the API, but the layout handles it.

## Observations for the owner to choose from

From `report-notes.json`. None are fixed in this run.

- **Medium:** after a flip, the invisible previous sleeve (opacity 0) sits over the lower crate panel. Clicking the crate tape label moves back one record. Pre-existing. After the fix, the tester did not re-test this.
- **Medium:** on a phone, `.scene` is full width with `touch-action: none`, so a swipe on it never scrolls. Pull it out is below the fold at 390x740. A 150px swipe jumps from 1/4 to 4/4. Pre-existing CSS.
- **Low:** an empty crate shows near-unreadable "Empty crate" text. The panels float apart, and the flip hint still shows.
- **Low:** when a crate has a label, the page shows the label twice (h1 and tape) and never the name. This follows the spec (`label ?? name`).
- **Low:** "Back to the crates" on the album page goes to `/shelf`, so the picker reappears after viewing a `/crates/:id` record. This is the most likely follow-up request.
- **Low:** `/crates/9999` has no h1 and keeps the title "Crates · Frisson". `/shelf` and `/list` have no h1.
- **Low:** `/shelf` at phone width with 10 crates fills the viewport with tabs, and the crate starts off screen. Known limit.
- **Low:** after Back from an album, focus is on body, not the crate.
- **Low:** the top describe in CrateView.test.ts is still named "crate browser".
- **Low:** a crate chosen on `/shelf` is not in the URL, so a reload returns to the first crate. This is the documented trade-off.
- **Low:** a fast 144px drag jumps 1/4 to 4/4.

## Not covered

- Firefox and Safari were not tested, because only Chromium was available.
- Not tested: the edit-crate flow, a Following card, the Try again state in a browser, and login through the UI.
- The T2 dev note is short, and `npm ci` was not run.
- T1's dev did not run a real browser.

## Recommended next steps

1. Review and merge the branch. Note that it sits on the four-page branch, which is not merged to main, so do not diff against main.
2. Decide whether the album page's "Back to the crates" should return to the album's own crate.
3. Pick from the medium observations. The flipped-sleeve click catch and the phone scroll trap are the two with user impact. Re-probe the flipped-sleeve case in a browser first, since it was not re-tested after the fix.
4. Rename the "crate browser" describe in CrateView.test.ts.
## Token use

Size: standard. Reported total: 529,927 tokens across 12 agents.

| Role | Agents | Tokens | Share |
|---|---|---|---|
| tester | 3 | 263,173 | 50% |
| surveyor | 3 | 73,356 | 14% |
| dev | 3 | 67,447 | 13% |
| manager | 1 | 62,494 | 12% |
| intake | 1 | 37,745 | 7% |
| reporter | 1 | 25,712 | 5% |

| Agent | Model | Tokens | Tool uses | Seconds |
|---|---|---|---|---|
| surveyor-structure-tests | sonnet | 16,805 | 13 | 17 |
| surveyor-conventions-docs | sonnet | 33,032 | 18 | 30 |
| surveyor-relevant | sonnet | 23,519 | 9 | 32 |
| intake | opus | 37,745 | 24 | 96 |
| manager | opus | 62,494 | 29 | 150 |
| dev-T2 | sonnet | 11,889 | 6 | 63 |
| dev-T1 | opus | 46,305 | 13 | 139 |
| tester-1 | sonnet | 94,499 | 18 | 303 |
| tester-explore | opus | 109,835 | 20 | 372 |
| dev-T1-fix1 (fix of T1) | sonnet | 9,253 | 5 | 31 |
| tester-2 | sonnet | 58,839 | 4 | 55 |
| reporter | sonnet | 25,712 | 9 | 29 |

The harbormaster's own tokens are not included: no figure was available.

### Dev models across 1 run(s)

| Model | Tasks | Fix agents | Fixes per task | Tokens |
|---|---|---|---|---|
| sonnet | 1 | 0 | 0.00 | 11,889 |
| opus | 1 | 1 | 1.00 | 55,558 |
