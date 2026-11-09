# Run report: hide crate page actions on other users' crates

**Verdict: shipped. 12/12 acceptance criteria pass, 1 cycle, 0 fix rounds, 1 task.**

Run: /Users/thomasfuhriman/code/crate-digger/.shipyard/runs/2026-11-09T03-57-41
Commit: 5dbda2e `fix(web): hide crate page actions on crates that aren't the viewer's` (base 1c455a7)

## Decisions for the owner to confirm

I made three interpretation calls. Please confirm each one or tell me to change it.

1. **/shelf still shows both actions on another user's crate.**
   - The change covers /crates/:id only.
   - On /shelf, with another user's crate selected as the tab, "Edit crates" and "+ Add a record" still show at 1280px and 390px.
   - On /shelf the Add link is plain /albums/new, with no crateId, so it does not preselect that crate.
   - I left /shelf alone because it is a browse-everything page. Apart from /list, its toolbar is the only always-present route to making a crate. Hiding it could strand a new user whose selected crate belongs to someone else.
   - Extending the rule to /shelf is a small change if you want it. Severity: medium.
2. **Admins also lose the actions on other users' crates.**
   - I read "someones crate that I didnt make" literally.
   - If you sign in as the ADMIN_EMAIL admin, a fix based on the existing canEditCrate would change nothing for you.
   - Admins keep the actions on their own crates and on ownerless (ownerId null) crates.
   - Admins can still add records via /shelf or /list, and edit records from the album page.
3. **"New crate stuff" was read as the "Edit crates" link.**
   - No control on /crates/:id is labelled "New crate".
   - That heading is on the /crates page, which "Edit crates" opens.
   - The /crates page itself is unchanged.

## What was asked for

On /crates/:id, stop showing the signed-in viewer "+ Add a record" and "Edit crates" when the crate belongs to another user. The viewer's own crates keep both actions.

Constraints:
- Web client only.
- Hide by not rendering the controls, not by disabling them or using CSS.
- Do not change canEditCrate, because spin counting and edit access in other views depend on it.
- Leave /shelf, /list, /albums/:id, /albums/new and /crates unchanged.

## Acceptance criteria

| ID | Check | Status | Evidence |
|---|---|---|---|
| AC1 | unit: non-admin on another user's crate sees neither action | pass | crateActions.test.ts |
| AC2 | unit: non-admin on own crate sees both, with correct hrefs | pass | crateActions.test.ts |
| AC3 | unit: admin on another user's crate sees neither, empty-crate section has no Add link, spin POST still fires | pass | crateActions.test.ts |
| AC4 | unit: admin on own or ownerless crate sees both. Non-admin on an ownerless crate sees neither | pass | crateActions.test.ts |
| AC5 | unit: signed-out visitor sees neither, nav links remain | pass | crateActions.test.ts |
| AC6 | unit: hidden while loading, on error and on "Crate not found" | pass | crateActions.test.ts |
| AC7 | unit: actions react to router.push between crates | pass | crateActions.test.ts |
| AC8 | unit: /shelf and /list keep both actions | pass | crateActions.test.ts |
| AC9 | unit: browsing controls and nav intact. "Pull it out" opens the album with no spin POST for a non-admin | pass | crateActions.test.ts |
| AC10 | command: typecheck, lint, format:check, test | pass | all four exited 0 |
| AC11 | browser: no actions on another user's crate at 1280px and 390px | pass | crate-actions.check.mjs printed PASS AC11 |
| AC12 | browser: own-crate clicks land correctly, no actions via /u/<B> | pass | same run printed PASS AC12 |

## What was built

Diffstat against 1c455a7: 6 files changed, 435 insertions, 8 deletions.

- apps/web/src/components/LibraryToolbar.vue (7 lines changed)
- apps/web/src/utils/permissions.ts (+14) and permissions.test.ts (41 lines changed)
- apps/web/src/views/CrateView.vue (24 lines changed)
- apps/web/src/views/crateActions.test.ts (new, 355 lines, 20 tests)
- apps/web/src/views/editControls.test.ts (2 lines changed): the Add link assertion was updated in the test that encoded the old behaviour. Its spin and navigation assertions are kept.

The browser check is at .shipyard/checks/crate-actions.check.mjs, with a helper in lib.mjs. Both are committed with this run.

## Test results

- Checklist tester: AC1-AC10 pass, tree clean. Baseline `npm test` exited 0 before the change.
- The 20 tests in crateActions.test.ts pass.
- There were no failures, so there is no failure output to quote and no defects.json.
- Browser tester (temp DB, port 4327, users alice and bob confirmed as role 'user'):
  - **Other user's crate:** on bob's non-empty and empty crates, at 1280px and 390px, at normal speed and with every API call delayed 500ms, neither action text appeared. A MutationObserver and rAF recorder installed before the app scripts logged none.
  - **Control:** the same recorder did log both actions on alice's own crate, so the recorder works.
  - **Layout:** Crates and List links were visible. There was no horizontal overflow (1280/1280 and 390/390) and no page errors.
  - **Click paths:** "Add a record" on alice's second crate landed on /albums/new?crateId=2 with picker value 2. "Edit crates" landed on /crates with the "New crate" heading. Bob's card on /u/bob opened his crate with no actions, and so did reaching it via /shelf, the owner link and the profile card without a reload.
- The harbormaster re-ran the checks and they were green. It then restored the tracked PNGs that browser.mjs rewrites on every run (a known limit).

## What went wrong

Nothing failed. There were no fix rounds.

One addition beyond the task: the dev added an OWN_EMPTY fixture and test, plus `enableAutoUnmount` in crateActions.test.ts. It also proved the tests can fail by making three temporary mutations, then reverted them.

## Observations from report-notes.json

Choose which of these to act on:

1. **/shelf scope (medium).** Same as decision 1 above. /shelf with another user's crate selected still shows both actions, and the Add link has no crateId. It matches AC8 and the brief's assumption, but your request could be read as covering it.
2. **Admin assumption.** Same as decision 2 above.
3. **"New crate stuff" assumption.** Same as decision 3 above.
4. **Extra test scaffolding.** The OWN_EMPTY fixture and `enableAutoUnmount` were added beyond the task (see "What went wrong").

## Recommended next steps

1. Answer the three decisions above. If you want /shelf covered too, that is a small follow-up using the same rule.
2. Known risk accepted: a brand-new user who only reaches other users' crates via /crates/:id loses the shortcut there. They can still use the Crates and List nav from /shelf or /list.
## Token use

Size: standard. Reported total: 287,808 tokens across 7 agents.

| Role | Agents | Tokens | Share |
|---|---|---|---|
| browser-tester | 1 | 81,025 | 28% |
| dev | 1 | 49,374 | 17% |
| intake | 1 | 47,408 | 16% |
| manager | 1 | 41,366 | 14% |
| surveyor | 1 | 34,163 | 12% |
| tester | 1 | 19,373 | 7% |
| reporter | 1 | 15,099 | 5% |

| Agent | Model | Tokens | Tool uses | Seconds |
|---|---|---|---|---|
| surveyor-relevant | sonnet | 34,163 | 19 | 47 |
| intake | opus | 47,408 | 25 | 87 |
| manager | opus | 41,366 | 13 | 98 |
| dev-T1 | opus | 49,374 | 24 | 120 |
| tester | sonnet | 19,373 | 5 | 11 |
| browser-tester | opus | 81,025 | 14 | 142 |
| reporter | sonnet | 15,099 | 7 | 21 |

The harbormaster's own tokens are not included: no figure was available.

### Dev models across 3 run(s)

| Model | Tasks | Fix agents | Fixes per task | Tokens |
|---|---|---|---|---|
| sonnet | 2 | 1 | 0.50 | 46,027 |
| opus | 2 | 1 | 0.50 | 104,932 |
