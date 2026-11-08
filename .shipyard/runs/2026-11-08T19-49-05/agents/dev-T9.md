# dev-T9: router, masthead nav, crate browser at /shelf

Criteria served: AC1, AC2, AC3, AC4, AC5, AC10, AC11, AC15, AC19, AC27. The tester decides whether they are met.

## What landed
- `router.ts`: `/` home (eager HomeView), `/shelf` library, `/crates/:id(\d+)` crate (public, numeric `crateId` prop), `/following` and `/profile` (requiresAuth), `/about`. New routes are lazy. CrateView was eager and is now lazy, shared through one loader const. scrollBehavior returns `false` between `library` and `crate`, otherwise `{ top: 0 }` as before.
- `App.vue`: `nav.main-nav` with four links as a full-width row. Side padding moved to a new `.brand` wrapper around the sign and tagline. The sign uses RouterLink `custom` with a plain `<a>`. `.account`, `.tagline`, `nav.user-menu` kept. Active link is ink background with paper text, matching the toolbar's active style.
- `AccountMenu.vue`: logout on a requiresAuth route pushes `home`.
- `CrateView.vue`: optional `crateId`, no fallback when it is set, 'Crate not found' note with a link to `library`, watch selects the crate, tab click calls `selectCrate` then `router.replace`, title 'Crates · Frisson', tabs wrap at `max-width: 100%`.
- `LibraryToolbar.vue`: Crates active through a computed class on `library` and `crate`.
- `AlbumView.vue`, `NotFoundView.vue`: back links go to `{ name: 'library' }`.
- Tests: `App.test.ts`, `router.test.ts`, `editControls.test.ts` updated; `CrateView.test.ts` new.
- `styles/base.css`: not changed; nothing needed it.

## Evidence
Web suite: 294 passed across 31 files. `vue-tsc`, eslint on `apps/web/src` and prettier were clean.

Real browser against the production build, on an empty temp DATA_DIR/DATABASE_PATH with demo seed only (no copy of `data/` was made or read). Server stopped and temp dir removed afterwards.

| Check | Result |
| --- | --- |
| curl /, /following, /profile, /about, /shelf, /crates/1, /crates/999999 | 200 text/html |
| curl /api/does-not-exist | 404 JSON |
| 320 scrollWidth, signed out: /, /shelf | 320; on / the links span 17 to 303px |
| 320 scrollWidth, signed in: /following, /profile, /about, /shelf | 320; links inside the viewport where measured (/following, /profile) |
| 390 signed in: /following, /shelf | scrollWidth 390 |
| 1280 signed in: /profile | scrollWidth 1280 |
| aria-current | single correct link at /, /following, /profile, /about; none on /shelf |
| Tab click on /shelf with page scrolled to 250 | URL /crates/3, scrollY stays 250 |
| Reload /crates/2 | same crate pressed, toolbar Crates active |
| /crates/999999 | 'Crate not found' |
| Log out on /following | lands on / |
| Signed-out /profile | /login?next=/profile |

## Not checked in a browser
- The full 3 x 5 width and page matrix. Only the subsets above were measured: 390 and 1280 were not run on every page.
- AC1 on /list and /albums/<id> in a browser (component test only for /list; /albums/<id> not visited).
- Logging in and landing back on `next` (AC15). Redirect seen; the return trip was not driven.
- AC5 3D box absence, AC11 link walk from /albums/<id>, a not-found URL and /crates, AC19 edit then reload, and the AC27 smoke. AC11 links are covered only by source change, not by a test or a click.
- Owner's real crates (Guitars, Beats & Bass): the temp DB has demo crates only, so these were not seen.

## Doubts and shortcuts
- **Hidden browser pane delays tab URLs.** With the pane hidden, a tab click selected the crate but the URL stayed /shelf for 3.6s of polling, then changed as soon as a screenshot forced a frame. `startViewTransition` was in flight, and I traced this to no frames being produced. I believe it is a test-harness artifact, not an app bug, but I did not confirm it in a visible pane. A tester reading the URL right after a click should force a frame or use a visible pane.
- **Stale store.** The library store loads once, so a crate created by someone else after that load shows 'Crate not found' on /crates/:id until a reload. The spec asks for exactly this on a loaded store, so I did not add a refetch.
- **Toolbar aria-current.** The toolbar Crates link gets `aria-current` from RouterLink on /shelf but not on /crates/:id. It is outside the main nav, so AC2 is unaffected.
- **Selected tab contrast.** Ink text on a dark crate colour is hard to read on 'DUB / AFTER DARK'. This is the existing tab style with demo colours, and I left it.
- **Test account.** I signed up a throwaway user through `fetch` in the page rather than the form, on the temp DB only. The form path was not exercised.

## Commit
1776cf2. The browser tab is closed and no server is left running.
