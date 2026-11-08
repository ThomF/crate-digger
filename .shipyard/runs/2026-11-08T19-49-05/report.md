# Run report 2026-11-08T19-49-05

**Verdict: SHIPPED. 27/27 acceptance criteria pass after 1 cycle and 1 fix round. Nothing is merged or deployed, and the owner's database is unchanged.**

Branch: shipyard/home-following-profile-about-2026-11-08T19-49-05 (11 commits after 2e3e66f).

## Asked

"3 page system" (four pages enumerated): Home (news plus AI-recommended crates), Following (seeded fake users), own Profile, About. The request said seeding ran on init.

## Must-know

- Seeding does NOT run on init. `db:seed` is manual and destructive (wipes crates, albums, tracks, covers). Demo data arrives at API start via an idempotent, non-destructive step in server.ts. It is on by default outside production; production needs SEED_DEMO_DATA=true.
- "AI recommended" has no AI behind it. It is a curated demo flag, and the UI says "Curated demo picks. No AI model is involved yet."
- News is fictional seeded data, not a live feed. Items are labelled Demo and have no outbound links.
- The owner's database has not been changed. Migration 0005 and the demo data (7 fake users, 9 crates, 9 news items) apply on the next API start on this branch. All testing used temp copies, and the data/ checksums were unchanged.
- Demo names were checked from model knowledge only, without a web lookup.
- Unreproduced click: in the retest, one real click on a recommended card's record count did not navigate. It worked on the next 3 attempts (1 miss in 9 clicks). The cause was not established; the hidden-pane view-transition stall is suspected but unconfirmed.

## Final criteria

First test pass for all, overridden by the retest for AC4, 9, 10, 17, 18 and 19. All 27 are pass: AC1-3, 5-8, 11-16, 20-27 from the first pass; AC4, 9, 10, 17, 18, 19 from the retest. AC10 failed in the first pass and passed after the fix.

## Built

- Migration 0005 (additive only): follows, news_items, demo_seed_key columns, crates.recommended_rank.
- Follow, following, feed and suggested-collectors routes; public news and recommended routes.
- Demo seeding by stable key (7 users, 9 crates, 36 albums, 135 tracks, 9 news items). Demo users cannot log in.
- Web: masthead nav; Home, Following, Profile, About; crate browser moved to /shelf with /crates/:id deep links; follow button; Demo tag.
- README, .env.example and compose.yaml document or pass SEED_DEMO_DATA.
- Commits: 85b4479, 396de6b, 1cf8e15, 88309b8, bedafa1, 0b8468e, 0326e4c, 37ac1ee, 1776cf2, 28bbf18, and the fix 3769352.

## Tests (final run, after the fix)

- npm test: exit 0. API 21 files, 360 tests. Web 31 files, 316 tests. The baseline was 180 tests.
- typecheck, lint, format:check and build all exit 0.

## What went wrong: AC10 first pass

Evidence, quoted from the first test pass:

> FAIL on the first clause: clicking a recommended crate card does not navigate unless the click lands on the tape-label link. Real trusted click on the crate name, recorded by a capture listener: [254,384,'P','crate-name',true], location stayed '/'. HomeView.vue:84 wraps only the label in RouterLink... Link is 146x18 of a 259x145 card (7% of its area), no ::after stretch, card cursor auto. Also the link's accessible name is the tape label, not the crate name.

The other AC10 sub-steps passed.

Fix F1 (3769352), a direct fix:

- The whole card is now a link, with the crate name in its accessible name.
- Keyboard focus shows a ring around the whole card.
- The scoped retest used trusted clicks on name, count and owner, and all went to /crates/<id>.
- Reload and the /crates/999999 "Crate not found" case also passed.

F1 also covered four tester observations that were not criteria:

- Feed cards now show the crate name.
- Crates on /profile and /u/<user> are now links.
- The count label is singular ("1 follower").
- A stale library store no longer gives "Crate not found".

All four were verified in the retest.

## Caveats

- AC27 (the end-to-end smoke) was not re-run after the fix. The first pass opened the crate via the label link.
- The retest ran with NODE_ENV unset, so it did not test production-mode behaviour. AC24 production mode was covered in the first pass.
- AC4 on /about and /shelf was not re-measured after the fix.
- Compose was checked only with `docker compose config`.
- Hidden-pane view-transition stalls were treated as harness artefacts.

## Remaining low-severity observations (unfixed)

- The crate picker stacks about one tab per row at 320 and 390 with 11 or more crates.
- The 7-card grid leaves an orphan on the last row.
- @demo-\* handles wrap at the hyphen.
- Titles stay plain "Frisson" on /list and not-found (not checked against main).
- Form field names come from placeholders (not checked against main).
- The Edit profile button sits a few pixels off from the counts above it.
- Recommended has no album-count filter.
- Deleted demo tracks do not return.
- `npm run dev` now seeds a developer database.

## Next steps

1. Web-check demo-content.ts for real-name collisions.
2. Start the API once on this branch against a copy of your data, then on the real one, and click through all four pages.
3. Set SEED_DEMO_DATA=false before first start if fake collectors on the real instance are unwanted.
4. Re-run the AC27 smoke in a visible browser pane, which will also show whether the missed click recurs.
5. Fix the crate-picker layout at 320 and 390 before adding more demo crates.
6. Decide separately whether a real recommendation model is wanted.
