# Tester 1, cycle 1

Verdict: fail. 26 pass, 1 fail (AC10), 0 untested. Per-criterion evidence is in `cycles/1/test-report.json`.

## Setup

- API path resolution read from `apps/api/src/paths.ts`: `DATABASE_PATH` falls back to `DATA_DIR/crate.db`, covers and avatars to `DATA_DIR`. `node src/server.ts` does not load `.env`, and I also unset ADMIN_*.
- Every server ran on a temp copy (crate.db, -wal, -shm) on ports 3111-3118. None touched `data/`.
- Production-build server: `NODE_ENV=production SEED_DEMO_DATA=true WEB_DIR=apps/web/dist`, port 3111. Secure cookies worked on localhost in the browser pane.
- No dev server was on 3000 or 5173 at the start or end. `data/` checksums are identical to the baseline (5 files).
- All servers stopped, browser viewport reset and tabs closed. Temp DB copies deleted because they held the owner's account row.

## The failure: AC10

"Clicking a recommended crate card navigates to /crates/<id>." In `apps/web/src/views/HomeView.vue:84` only the tape label is a RouterLink. The crate name, count and owner sit outside it, there is no stretched `::after`, and the card has no click handler or pointer cursor.

- Trusted click on the crate name, confirmed with a capture listener on target `P.crate-name`: URL stayed `/`.
- The link is 146x18 of a 259x145 card, about 7% of its area.
- The link's accessible name is "DUB / AFTER DARK", not the crate name.

The other AC10 clauses pass: label click, selected crate, reload, tab updates URL, `/crates/999999` not found.

This is a judgement on the criterion's plain wording. HomeView's test checks the card has a link, not that clicking the card works, so the suite passes regardless.

## AC21 method

Two copies were made before any server start. The "before" dump used only columns from `pragma_table_info` on the 0004-level copy, so it cannot name a post-0005 column. The same column lists were then applied to a copy of the run DB after shutdown, filtered to pre-existing ids. All six tables were identical. Added columns on old rows are NULL.

## AC7

Assessed from my own knowledge, no web lookup. No known real name found. Unsure flags are listed in the report: Quince Hollow Records, Saltmarsh Instruments, The Velvet Almanacs, Gutterball Regents, Delroy Quaverstone, Ostermere, Mossbank.

## Harness effects, not product failures

- Pane hidden: view transitions stall until a screenshot forces a frame. After a SPA navigation the crate page reported no pressed tab until a screenshot ran, and two clicks made in that state had no effect. Both worked once a frame had been forced.
- 1280 emulation in a smaller pane: screenshot frame is 800x500, so ref clicks land on the wrong spot. I used frame coordinates (CSS x 0.625) and confirmed targets with a listener.
- PUT and DELETE 204s show `net::ERR_ABORTED` in the network log. Server state confirms they applied.

## Limits of this run

- AC25 was verified through component tests only, which is what its verify field asks for, not in a browser.
- AC3's `/profile` browser check was a full-load navigation rather than `location.reload()`; my one reload attempt there fired before the login redirect finished.
- `/albums/105`'s back link was read by href, not clicked. The not-found and `/crates` back links were clicked.
- Observations marked "not checked against main" may predate this branch.

## Observations

See `observations` in the report. Main ones: "1 followers" at count 1; profile crate rows are not links; feed cards show the tape label but not the crate name. "Crate not found" does not occur for a crate created through `/crates`, but does when the loaded library store has not seen the crate, such as one created in another tab.
