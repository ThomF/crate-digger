# Run report: crate-sleeve-click-fix (run 2026-11-09T02-19-56)

**Verdict: shipped. 6 of 6 criteria pass, 1 cycle, 1 fix round. Not merged or pushed.** The work is on branch `shipyard/crate-sleeve-click-fix-2026-11-09T02-19-56`, based on ffb78fa.

## What was asked

Request: "issue: clicks after a flip: an invisible sleeve sits over the crate front, so clicking the tape label moves back one record. This wasn't re-tested after the fix."

Goal from `brief.json`:
- After a flip, no invisible flipped sleeve catches clicks.
- Clicking the crate front or tape label does nothing.
- The visible art still opens the record on show.
- All flip controls keep working.
- All of this is proven with real mouse and touch input sampled across the crate, not on one strip.

Constraints:
- Bug fix only, in `CrateBox.vue` and possibly `crateLayout.ts`.
- The flip-out animation stays. No `v-if` or `display:none`.
- Proof goes in `.shipyard/checks/browser.mjs`. Existing checks may be added to but not loosened.
- No merge or push.
- Out of scope, as known limits: phone swipe never scrolling the crate, "Back to the crates" returning to /shelf, and Firefox and Safari coverage.

## Acceptance criteria

| ID | Criterion (short) | Final | Evidence |
|---|---|---|---|
| AC1 | Crate front does nothing after a flip, across viewports, positions, input methods and sample points, plus (a) no-wait, (b) album and Back, (c) /shelf | pass | `cycles/1/browser-output-fix1.txt`: PASS AC1, 104 samples. Pre-fix source b7918c1 gives 6 of 104 failing (`retest-prefix1-output.txt`). |
| AC2 | Visible art opens the record on show | pass | PASS AC2, 21 of 21 samples. Back restores the crate URL and `.count`. Sweeps show `dead=[]`. |
| AC3 | Flip controls still work | pass | PASS AC3, 12 of 12 samples: back-sleeve edge click, Back button, ArrowUp, wheel -120 on the label, drag up and down. |
| AC4 | `node .shipyard/checks/browser.mjs` exits 0 with no FAIL, one line per sample, old checks kept | pass | Harbormaster ran it on the final check: exit 0. The earlier run (`ac4-output.txt`) found the only removed line vs ffb78fa was the old `process.exit`, relocated. |
| AC5 | Unit test for flipped sleeves still drawn, transform and opacity unchanged | pass | Test "keeps flipped sleeves drawn for the flip-out animation, without catching clicks". The existing "flips to a record further back when you click its edge" test is unmodified. |
| AC6 | Check fails without the fix, and `npm test`, typecheck and lint pass with it | pass | ffb78fa source gives exit 1, AC1 failing 53 of 103, with 49 FAIL lines naming the tape label. With the fix, `npm test` (328 tests), typecheck and lint exit 0. |

### AC1 was failed by the harbormaster, against the tester

The browser tester passed AC1. It asserted the no-wait click (a) after forward flips only, and flagged that limit.

The harbormaster read "a flip" in (a) as either direction and failed AC1 instead of narrowing the criterion. This was a harbormaster decision overruling the tester's forward-only reading. The tester's own evidence supported the failure: ArrowUp followed by a label-centre click at 0, 10 and 20ms opened /albums/N, while clicks at 30 and 40ms did nothing.

A direct fix round followed, and AC1 passed after it.

## What was built

1. **T1, commit f5f99b5.**
   - In `CrateBox.vue`, each flipped sleeve (`offset < 0`) gets inline `pointerEvents: 'none'`. Same element, transform, opacity and transition, so the flip-out animation is unchanged.
   - Added a CrateBox unit test for it.
   - Diagnosis from the code was confirmed in the browser: before the fix, label-centre clicks landed on `div.motif (in non-current .sleeve)` and moved the crate back.
2. **Browser check, commit b7918c1.** The tester extended `.shipyard/checks/browser.mjs`. Details:
   - Sample points: 9 per position.
   - Viewports and inputs: 1280 mouse, 390 mouse, 390 touch (Flip-button taps).
   - Reached by: ArrowDown, plus wheel and drag at 1280.
   - Positions: 2/4 and 3/4.
   - Cases (a), (b) and (c) on /shelf.
   - AC2 and AC3 sections.
3. **T1-fix1, commit 7622a3e (direct fix).**
   - Cause: after a backward flip, the new current sleeve (offset 0) animates up from the tipped pose in front of the panel, with pointer events on. A click in the first 20 to 30ms opened the album.
   - Fix: `onSleeveClick` now takes the click event. For offset 0 it returns early when the click's clientX/clientY fall inside the `.panel.front` bounding rect. A zero-size rect never counts, so happy-dom's all-zero rects still open the record.
   - Added test "ignores a click on the current sleeve that lands inside the crate front".
4. **Commit 2d93752** turned the backward no-wait observation into six asserted AC1(a) samples at 1280px: ArrowUp then a label-centre click at 0, 10 and 20ms, from 3/4 and from 2/4.

`crateLayout.ts` and `useCrateFlip.ts` were not touched. The dev for the fix round did not run the browser check. The harbormaster and the re-test tester did.

## Test results

The pre-fix runs below were done on scratch copies of the source.

**Against ffb78fa source with the new check** (`ac6-output-fix1.txt`): exit 1, `FAIL AC1 (53 of 103 samples failed)`. Examples:
```
FAIL AC1 1280-mouse pos=2 / 4 via=ArrowDown point="tape label centre" at=(640.0,749.0) hit=div.motif (in non-current .sleeve) count=2 / 4->1 / 4 url=/crates/4
FAIL AC1 390-touch pos=2 / 4 via=Flip-tap point="8px inside panel left at label height" at=(45.7,481.0) hit=div.panel.front count=2 / 4->1 / 4 url=/crates/4
FAIL AC1 (c) 1280-mouse /shelf crate=Crate 3 pos=2 / 4 via=ArrowDown point="tape label centre" ... count=2 / 4->1 / 4 url=/shelf
```
AC2 and AC3 passed on that source.

**Against b7918c1 source (T1 fix only, before fix round 1)** (`retest-prefix1-output.txt`): exit 1, `FAIL AC1 (6 of 104 samples failed)`. All six were the backward no-wait samples:
```
FAIL AC1 (a) 1280-mouse pos=3 / 4 via=ArrowUp point="tape label centre, 0ms after" at=(640.0,749.0) hit=div.motif (in .sleeve) count=3 / 4->null (expect 2 / 4) url=/albums/14
FAIL AC1 (a) 1280-mouse pos=2 / 4 via=ArrowUp point="tape label centre, 20ms after" ... count=2 / 4->null (expect 1 / 4) url=/albums/13
```
This is what the harbormaster used to fail AC1, and it shows the new assertions detect it.

**Final check on current code:** exit 0, PASS AC12, AC1, AC2, AC3, no FAIL line. Final `npm test` (328 tests), typecheck and lint exit 0. Baseline before the work was 326 tests.

## What went wrong and why

- **The first fix was incomplete.**
  - The spec's `offset < 0` rule covered flipped sleeves only. It did not cover the offset 0 sleeve animating back into place after an ArrowUp, which is also in front of the panel for about 20 to 30ms.
  - The tester found it but scoped criterion (a) to forward flips, so the first AC1 result was a pass. The harbormaster overruled that, which cost one fix round and a scoped re-test.
- **Process note.** dev-T1 did not write its report file, citing a standing rule against report files. The harbormaster saved its final message as `agents/dev-T1.md`.
- **No agent deaths.** The test stage took about 18 minutes, mostly the browser tester at about 12.5 minutes.

## What the cycle learned

- A hit-test defect has to be checked in both flip directions and in the first frames after a flip. A settled-state sample matrix misses the transition window.
- The earlier lesson from the prior run held: a click check on one strip proves nothing. Here, "just above tape label" and the 390-touch "8px inside panel" points failed pre-fix where the label centre alone would not have shown the full spread.
- The spec's hand-estimated catch-zone geometry was not relied on. The check samples the panel instead.

## Limits (from `report-notes.json` notes)

- **Hit testing during a backward flip.** For about 20ms the sleeve is still the hit target over the panel, and the click is ignored by the rect guard. The backward no-wait samples therefore assert count and URL but not the hit element. The pointer cursor could show for that moment.
- **Narrow coverage of the backward no-wait clicks.** They are asserted at 1280px mouse on the label centre only. They are not asserted at 390px, with touch, or at the points just outside the panel sides, where the rect guard does not apply.
- **Timing was measured in headless Chromium.** 20ms is not a guaranteed bound on slower machines.
- **Touch flips use the Flip button.** Playwright's touchscreen only taps, so touch-drag after the fix is not exercised.
- **Chromium only.** The out-of-scope known limits still stand: phone swipe, "Back to the crates", and Firefox and Safari.

## Observations for the owner to choose from

1. **Offset-13 invisible sleeve catches clicks (medium). Confirmed, not fixed here.**
   - Evidence: in a 16-record crate at 1/16 and 1280px, a click above the visible stack hit `p.edge` in an opacity 0 sleeve (top about 348 against 353 for the last visible sleeve) and jumped to 14/16 with no visible target.
   - This is a different defect from the flipped sleeves, and the 4-record check cannot see it. A fix round might not have taken it.
   - The manager suggests the pointer-events condition could become `pose.opacity === 0`.
2. **Tracked PNGs modified on every run (low).**
   - The check writes `.shipyard/checks/ac12-long-*.png`, which are tracked, so every run leaves them modified. The harbormaster restored them after each run in this one.
   - The owner should decide whether to commit them, untrack them, or have the check write elsewhere.
3. **Wheel step (low).** One -120 wheel event moves one record though `WHEEL_STEP` is 60, apparently because `goTo` reads a model value not yet updated in that tick. AC3(d) depends on this.
4. **Drag down from the tape label (low).** It leaves `.scene` after about 40px, so that drag ends early and moves one record rather than two.

## Recommended next steps

1. Review and merge the branch if satisfied. Nothing was merged or pushed.
2. Open a follow-up for the offset-13 defect first, probably with the `pose.opacity === 0` condition. Add a long-crate (14 or more records) sample to the browser check.
3. Decide how to handle the tracked `ac12-long-*.png` files.
4. Optionally widen the backward no-wait assertions to 390px and touch, if the 20ms window matters to you. If it does not, a cursor-only flicker is the residual effect.
5. Confirm the assumption that clicking the crate front or tape label should do nothing. If the owner wants the label to open the record, AC1 changes.

Run artifacts: `/Users/thomasfuhriman/code/crate-digger/.shipyard/runs/2026-11-09T02-19-56/` (spec, defects, test reports and outputs under `cycles/1/`; agent notes under `agents/`).
## Token use

Size: standard. Reported total: 453,276 tokens across 11 agents.

| Role | Agents | Tokens | Share |
|---|---|---|---|
| tester | 3 | 228,937 | 51% |
| surveyor | 3 | 66,348 | 15% |
| reporter | 1 | 55,059 | 12% |
| intake | 1 | 39,231 | 9% |
| dev | 2 | 34,138 | 8% |
| manager | 1 | 29,563 | 7% |

| Agent | Model | Tokens | Tool uses | Seconds |
|---|---|---|---|---|
| surveyor-structure-tests | sonnet | 14,424 | 10 | 15 |
| surveyor-relevant | sonnet | 22,885 | 9 | 22 |
| surveyor-conventions-docs | sonnet | 29,039 | 18 | 30 |
| intake-1 | opus | 39,231 | 16 | 122 |
| manager-1 | opus | 29,563 | 8 | 79 |
| dev-T1 | sonnet | 18,347 | 10 | 40 |
| tester-checklist | sonnet | 49,857 | 4 | 14 |
| tester-browser | opus | 123,423 | 21 | 751 |
| dev-T1-fix1 (fix of T1) | sonnet | 15,791 | 6 | 34 |
| tester-retest-1 | sonnet | 55,657 | 7 | 242 |
| reporter-1 | sonnet | 55,059 | 14 | 39 |

The harbormaster's own tokens are not included: no figure was available.

### Dev models across 2 run(s)

| Model | Tasks | Fix agents | Fixes per task | Tokens |
|---|---|---|---|---|
| sonnet | 2 | 1 | 0.50 | 46,027 |
| opus | 1 | 1 | 1.00 | 55,558 |

## Addendum: offset-13 sleeve fixed after the run

At the owner's request, observation 1 was fixed in 679b6bd, by the harbormaster directly and outside the circuit. No tester agent re-verified it; the harbormaster ran the checks. The pointer-events rule in `CrateBox.vue` is now `pose.opacity === 0`, covering both flipped sleeves and the faded sleeve past the back of the stack.

The browser check gained a LONG-STACK section: 16 records, 1280 and 390 mouse, positions 1 and 3. On the source before 679b6bd it exits 1 with 4 of 12 samples failing (clicks jumped to 14/16 and 16/16). On the fixed source it exits 0, with PASS AC12, AC1, AC2, AC3 and LONG-STACK. `npm test`, typecheck, lint and format:check exit 0.

A click in that roughly 5px band now reaches the crate owner's link, which the invisible sleeve had been covering. The check asserts the hit on that link but does not click it.
