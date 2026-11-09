# Stop invisible flipped sleeves catching clicks

## The problem

Commit 57302be fixed one hit-testing bug in the crate and exposed another. The `.crate` element is a transparent tilted plane that swallowed clicks meant for the sleeves, so that commit set `pointer-events: none` on it and restored `auto` on all of its children. Those children include flipped sleeves.

A flipped sleeve is invisible only because its opacity is 0. It is still in the DOM, and its pose tips it forward around its bottom edge, so from the code its top edge sits in front of the front panel's `translateZ(70px)`. A click on the crate front or tape label can therefore land on a sleeve the user cannot see. `onSleeveClick` receives a negative offset and calls `goTo(index + offset)`, so the crate moves back a record. At position 3 or later two flipped sleeves are drawn, because `visibleRange` starts at `index - 2`.

This diagnosis comes from reading the code. Nobody has reproduced it yet, and the catch-zone geometry in the brief is a hand estimate. The test stage has to confirm it, and AC6 does that by requiring the new check to fail against the unfixed source.

## What will change

Flipped sleeves stop taking part in hit testing. In `apps/web/src/components/crate/CrateBox.vue`, the inline style on each `div.sleeve` gains `pointerEvents: 'none'` when `offset < 0`. Everything else about those sleeves stays the same: same element, transform, opacity and transition, so the flip-out animation is unaffected.

The result at each kind of input:

- **Crate front and tape label:** the click lands on `.panel.front`, which has no click handler, so nothing happens. It still bubbles to `.scene`, which only handles pointer, wheel and key events.
- **Just outside the panel sides:** the estimated spill of the tipped sleeve past the panel disappears with it, because nothing in a flipped sleeve can be hit.
- **Visible art:** the current sleeve still receives clicks and opens the record on show.
- **Visible back-sleeve edges:** these still flip forward to that record.
- **Going back:** the Back button, ArrowUp, wheel up and drag up do not depend on flipped sleeves. Wheel and drag listeners are on `.scene`, so they work from the tape label too.

The style applies as soon as the index changes, so a click with no wait after a flip cannot land on a sleeve that is still animating out. `/shelf` uses the same `CrateBox` and gets the fix without further work.

## Alternatives rejected

- **`pointer-events: none` on the panel:** clicks would pass through to the current sleeve and open the album, which breaks AC1.
- **Ignoring `offset < 0` in the click handler:** the invisible sleeve would remain the hit target and still show a pointer cursor, and `elementFromPoint` would return it, which also breaks AC1.
- **`v-if`, `display: none` or filtering `drawn`:** this removes the flip-out animation, which the brief says must stay.
- **A CSS class instead of an inline style:** this would work, but happy-dom does not apply scoped CSS, so a unit test could only check that the class is present. The inline style is also where the rest of the pose is already applied.

## How it is proven

The dev adds a named test in `CrateBox.test.ts` that mounts at index 2 and asserts both flipped sleeves are still rendered with `translateZ(40px) rotateX(-55deg)` and opacity 0 (AC5), plus inline `pointer-events: none`. That test guards the animation constraint, but it cannot prove the bug is gone, because happy-dom does no layout or hit testing.

The real proof is `.shipyard/checks/browser.mjs`, written by the browser tester at test stage. It uses real mouse and touch input on a temp DB, sampling across the panel at several viewports and positions rather than on one strip (AC1 to AC4). It must then fail against the source at ffb78fa and pass with the fix (AC6). The fix task lists those criteria in its `criteriaIds` because its change is what they verify, but it does not write that check.

## Scope and known limits

The change is limited to `CrateBox.vue` and its test. `crateLayout.ts` is allowed by the brief but not needed, so it stays untouched, as does `useCrateFlip.ts`. These remain out of scope as recorded known limits:

- Phone swipe on the crate never scrolling.
- "Back to the crates" returning to `/shelf`.
- Firefox and Safari coverage.

Touch flips in the check use the Flip button because Playwright's touchscreen API only taps, so touch dragging after the fix is not exercised.

## One thing left alone, for the owner

Sleeves at offset 13 are also rendered with opacity 0 and can be hit, as the code stands. In a crate of 14 or more records, such a sleeve might catch a click above the visible stack and flip forward 13 records. This is unconfirmed, and it is a different defect: the sleeve is not flipped and the area is not the crate front. The brief's 4-record check will not exercise it, and this fix does not address it. If it proves real, changing the condition to `pose.opacity === 0` would likely cover both cases.
