# dev-T1 report

Commit: 2e015fc on shipyard/single-crate-view-2026-11-09T01-05-12. Not pushed or merged.

## What changed

- `apps/web/src/views/CrateView.vue`: the `.tabs` picker renders only when `crateId === undefined`. Otherwise an `h1.crate-name` shows `crate.label ?? crate.name` in the same place, above OwnerLink. `chooseCrate` is removed, and a tab click calls `library.selectCrate(c.id)` with no router call. A comment says why. Added the `.crate-name` CSS. `router` stays because `open()` uses it.
- `apps/web/src/components/crate/CrateBox.vue`: CSS only. `.crate-label` gets `max-width: 100%; overflow-wrap: anywhere;`.
- `apps/web/src/router.ts`: the comment on line 112 is reworded. No code changed.
- `apps/web/src/views/CrateView.test.ts`: edited the tests the plan named, added `heading` and `albumList`, and added tests for AC2 and AC7.
- `apps/web/src/views/editControls.test.ts`: added two AC9 tests. The /shelf tests are unchanged.

## Results

Exit codes from the repo root, run just before committing:

| Command | Exit |
| --- | --- |
| `npm test` | 0 (api 360 tests in 21 files, web 326 tests in 31 files) |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run format:check` | 0 |

The AC8 diff command against 24dcabd prints nothing. I also included LibraryToolbar.vue and router.test.ts in that check, and they are unchanged too.

The other dev's files (README.md, docs/SPEC.md, package.json, package-lock.json) showed no changes in `git status` when I committed, so these checks did not exercise their work.

## Do the tests detect the change?

I temporarily restored the 24dcabd CrateView.vue and ran the two test files, then put the new version back. 7 tests failed against the old view: no picker on /crates/:id, deep link, reload, /shelf tab click, follows the URL, and both heading cases.

The AC7 and AC9 tests and the "no h1 on /shelf" test pass against the old view too. They pin behaviour that already existed, so they guard against regressions but do not show this change works.

## Not verified

- **No real browser run.** The CSS is not exercised by any test (jsdom does no layout). That covers the `.crate-name` and `.crate-label` wrap rules, and so AC12's scrollWidth check at 320 px for the 80-character name. From reading the CSS, `.crate-label` is a grid item in `.front`, so `max-width` applies to it. An 80-character label will wrap to several lines and may overflow the panel vertically. That would not affect scrollWidth, but it is worth a look in the AC12 pass.
- AC12 as a whole is left to the tester.

## Small additions beyond the plan

- A `control` helper in CrateView.test.ts finds the Flip and Back buttons by text.
- A test that /shelf has no h1 (the plan states this but listed no test for it).
- The "Pull it out" AC7 test flips first and expects /albums/22, so it proves the current record opens rather than the first.
- The AC9 tests also assert the route reached /albums/<id>, so "no POST" cannot pass just because the click did nothing.
- A comment on each new CSS rule explaining why it wraps.

No new dependencies. No shortcuts taken.

## Noted, not changed

- `apps/web/src/stores/library.ts` keeps its selection logic, untouched as required. A tab click on /shelf still updates the shared selection, so opening /shelf later keeps the last crate, as AC5 expects.
