# dev-F1 report

Commit: 3769352 `fix(web): make crate cards whole links, singular follower count, reload stale crates`

No blockers. Only files on the task list changed. `MyProfileView.vue` needed no change (it renders ProfileView); its test did.

## What changed

1. **Home (AC10).** Each recommended crate card has one RouterLink, stretched with `.crate-link::after` over the positioned `.crate-card`. Pointer cursor on the card, hover state, and a focus ring drawn on the `::after`. Tape label and crate name are both inside the link. `aria-label` is `LABEL: Name`, or `Name` when there is no label. Count and owner are plain text, so nothing interactive is nested.
2. **Following feed.** Same stretched link, on `li.row.crate-card` only, so collector rows with Follow buttons are not affected. The crate name now shows.
3. **Profile and /profile.** Each `li.crate` is a stretched link to `/crates/<id>`, with the same `aria-label`.
4. **Follower count.** "1 follower", otherwise "N followers". `.follower-count` and `.following-count` are kept. This is the only place the count renders, and `/profile` reuses it. I added `{{ ' ' }}` between the two count items, because without it the text content read "5 followers2 following".
5. **Stale store.** A watcher in CrateView on crateId and library.status forces one reload when the store is ready and the id is unknown. A `reloadedFor` marker stops the loop. Status goes to loading before render, so "Crate not found" does not flash.

## Checks

`npm test` (api 360 passed, web 316 passed), `npm run typecheck`, `npm run lint` and `npm run format:check` all exit 0 on the committed code.

Real browser, production build, temp DATA_DIR and DATABASE_PATH on 127.0.0.1:3122, viewport 1000x800. `data/` was not touched. The server is stopped and the temp data deleted. Its background task reports exit 144, which is my own kill.

- Home: trusted click on an empty part of the first card went to /crates/1, with that tab pressed.
- Home, feed card and profile row: elementFromPoint at the corners returns the link. On Home and the profile row, cursor is pointer.
- Profile: real Tab to the crate link gives :focus-visible, with a 3px solid red ring around the whole row (seen in a screenshot).
- Stale store: POST a crate from outside the store, SPA navigate: the crate shows with its tab pressed, no full load.
- SPA navigation to /crates/999999 ends at "Crate not found". Resource entries for /api/crates totalled 4, which I read as the first load, the POST, and one reload for each of the two navigations. I did not separately time the end state beyond 700ms, but the unit test asserts exactly 2 fetches.
- /following feed card reads "AMBIENT / LOW TIDE / Slow Tide Ambient / owner / 4 records". The Follow button in Suggested still receives hits.
- /u/demo-odessa-quillfern after a follow reads "1 follower / 0 following".

## Not verified, and doubts

- **`aria-label` was added after the browser pass, and I did not rebuild to re-check it.** Only unit tests cover it. In the browser pass, the read_page tool listed those links with no name when their text sat in nested spans. I do not know whether that is the tool's heuristic or the real accessible name, so I added the explicit label to settle it. The tester should read the names in the browser.
- Not exercised in a browser: focus ring on Home and Following (same CSS, computed only on the profile), 320 and 390 widths after this change, real click on the feed card and profile row (unit tests click through the bubbling path; hit testing was checked with elementFromPoint), and /profile signed in (unit tests only).
- The stretched-link CSS tests read the raw source, because happy-dom does no layout or hit testing. They guard the rule's presence, not its behaviour. The browser checks above are the real evidence.

## Shortcuts and decisions

- `/crates/<unknown>` on a first load does one fetch, not two. The load in flight on arrival counts as the reload, since it is already fresh. This is a reading of "force one reload"; a load in flight could in theory predate the crate, which I judged negligible.
- A missing id gets another single reload if you leave to a known crate or /shelf and come back. This is deliberate and still terminates.
- `crateLinkName` and the stretched-link CSS are duplicated across three views, because a shared file was not on my list. A later refactor could extract them.
- Text inside the cards can no longer be selected by dragging, which is normal for a stretched link.
- I added a `Data classification: PUBLIC` comment to CrateView, which had none.
- `apps/web/dist` was rebuilt; it is git-ignored. No dependencies added.
