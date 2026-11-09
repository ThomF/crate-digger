# One crate at /crates/:id

## The job

Crate cards on Home, Following and Profile open `/crates/:id`. That page should be about that one crate, but it currently shows a tab for every crate in the database. We are removing that picker from the page and showing the crate's name as the page heading, because the tabs were its only readable label. `/shelf` stays the one place to choose between crates, and the owner has confirmed it keeps its tabs.

This is a display change only. Crate deep links stay public. The API, the shared package, the schema and the library store do not change.

## How it works today

`apps/web/src/views/CrateView.vue` serves both routes. `/shelf` has no `crateId` prop and shows the store's selected crate. `/crates/:id` passes a numeric `crateId` and shows exactly that crate or nothing. The picker is the `.tabs` button group, and a tab click calls `router.replace` to `/crates/:id`.

That last detail makes the change more than hiding some markup. If tabs kept navigating, the first click on `/shelf` would land on a page with no picker, and the picker would vanish.

## What changes

**On `/crates/:id`**, the picker is replaced by one `h1` showing `label ?? name`, the same text the tab showed. The picker renders only when `crateId` is undefined. These stay as they are:

- flipping by wheel, drag and keyboard
- pulling a record out, and spin counting
- the owner link and the empty message
- `LibraryToolbar`, including its Crates link to `/shelf`
- selecting the crate in the store, so `/shelf` remembers it
- the single forced reload for an unknown id
- `Crate not found`
- the error state with Try again
- the page title `Crates · Frisson`

**On `/shelf`**, a tab click now only updates the store selection and the URL stays `/shelf`. The trade-off, accepted in the brief, is that a crate chosen on `/shelf` no longer gives a shareable URL, and a reload returns to the first crate. `/shelf` gets no new heading.

**Long names.** The tabs had their own wrap rule, so the new heading needs one too. Tracing the 80-character case in AC12 turned up a second problem the brief did not name: `.crate-label` in `CrateBox.vue` has no wrap rule and no ancestor clips it, so an unbroken long name would widen the page at 320 px. T1 therefore adds a two-line CSS rule there. It should not change how normal names render.

**The router comment.** `router.ts` says "Crate tabs change the URL". This change makes that false, so the one comment line is reworded. The `scrollBehavior` code is unchanged, because moving between `/crates/:id` and `/shelf` through the toolbar should still not jump the page. `router.test.ts` still holds and is not touched.

**The toolbar comment.** `LibraryToolbar.vue` calls `/crates/:id` "still the crate browser". That is loose wording rather than a false statement, and the brief says to keep the toolbar as it is, so it stays.

## Tests

Most of the risk is in the test rewrite. `CrateView.test.ts` uses `pressedTab` on `/crates/:id` throughout, including in the reload cases, so a careless rewrite could quietly lose coverage of the reload and not-found logic. Only tests that assert tabs on `/crates/:id`, or a URL change from a tab click, may change, and each is replaced with an equivalent assertion, usually on the `h1`.

New tests cover:

- the absence of the picker on `/crates/:id`
- the heading, both with a label and with only a name
- URL-driven crate changes
- flipping, pulling out, the owner link and the empty crate on `/crates/:id`
- spin and add-record behaviour by ownership, in `editControls.test.ts`

## Docs and tooling

The README Pages row for `/crates/:id` and the SPEC line "Where the crate view lives" are updated to match. ADR 0006 is a historical record and stays as written.

Playwright (Apache-2.0, approved by the owner) is added as a root dev dependency so the tester can write `.shipyard/checks/browser.mjs` for AC12. The README documents the browser install and the need to run against a temp copy of the database, because starting the API otherwise adds demo content to the owner's data. No dev task writes the browser script.

## Task split

- **T1** owns the view, its tests, the `CrateBox` CSS and the router comment.
- **T2** owns the docs and the dependency.

They share no files and can run at the same time. AC8 and AC10 are repo-wide, so both tasks must leave them passing. For AC12, T1 supplies the feature and T2 supplies the dependency.

## Out of scope and known follow-ups

- `← Back to the crates` on the album page and the album editor's links still go to `/shelf`. A user who pulls a record from `/crates/:id` and follows that link sees the picker again, which is the most likely follow-up request.
- The picker still stacks at narrow widths on `/shelf` with 11 or more crates.
- Per-crate page titles were not requested.
- `CratesView` has no view test file, so reorder and crate-edit regressions are guarded by leaving that file unchanged (AC8) and by API tests.

## Note for the tester

`npm run lint` runs `eslint .`, and `eslint.config.js` does not ignore `.shipyard`, so `.shipyard/checks/browser.mjs` will be linted once it exists. It must pass lint, or AC10 will fail.
