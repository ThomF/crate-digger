# Run report: admin panel (2026-11-09T06-16-12)

**Verdict: shipped. 12/12 acceptance criteria pass, 1 cycle, 0 fix rounds, 3 tasks.**

## What the owner needs to know first

- **The login is already on your local database.** Your dev server (node --watch) restarted while the work was being built. It applied the dev admin to `data/crate.db`. A read-only check afterwards found 9 users, 1 admin and 0 ownerless crates, so no crate ownership was reassigned.
- **It is dev-only.** `admin@frisson.com` / `admin` is never created when `NODE_ENV=production`. That holds even with `SEED_DEV_ADMIN=true`. `SEED_DEV_ADMIN=false` turns it off in other environments. `.env` sets no `NODE_ENV`, so locally it runs. Intake chose the dev-only reading, so please confirm it.
- **It is now the only admin on that database, and the earliest.** The existing bootstrap only acts when no admin exists. So `ADMIN_EMAIL` in `.env` will not create a second admin on this database.
- **Credential travels with the data.** A dev database restored into production would carry the working admin/admin row. The guard only stops creation. `docs/DEPLOY.md` says to remove that row or use a clean production database.

## How the two crate sections were read

The brief's phrase "crates by the suggestions, by user created" was read as one crates view with two sections:
- **Suggested crates:** crates with `recommended_rank` set, in rank order. This is the same column that drives Home's Recommended crates. No second flag was added.
- **User created crates:** every other crate, each showing its owner.

This was an assumption, not something the owner confirmed. Please check it.

## What was asked for

An admin-only `/admin` panel that:
- lists all news, crates and users;
- lets an admin grant or revoke the verified tag;
- lets an admin create news and crates, singly or in bulk, that show on the public front end;
- adds an `admin@frisson.com` / `admin` login idempotently, with no data reset, and never in production.

## Acceptance criteria

| AC | Check | Status |
|---|---|---|
| AC1 | Dev-admin step on a populated DB: one new row, existing rows deep-equal, login 200, second run idempotent (unit) | Pass |
| AC2 | Production, `SEED_DEV_ADMIN=false`, email clash, `admin-2` username, no plaintext in logs, 8-char minimum intact (unit) | Pass |
| AC3 | Real API, two starts on a temp DB, only one row added, hash identical, login 200 as admin; production start creates nothing and login gives 401 (command) | Pass |
| AC4 | Every `/api/admin` route, collected by hook, plus PATCH verified: 401 signed out, 403 as user, counts unchanged (api) | Pass |
| AC5 | Overview counts, users list with no password hash or seed key, verified toggle reflected in the admin list and on the public profile (api) | Pass |
| AC6 | Admin crates list, create, suggested toggle, 409 for ownerless, 404 for unknown id (api) | Pass |
| AC7 | News create, edit, delete, validation 400s, survives the demo seed with no duplicates (api) | Pass |
| AC8 | Bulk import, publicly readable afterwards, all-or-nothing on a bad entry (api) | Pass |
| AC9 | Web unit tests: route guard redirects, four section headings, owners shown, error on failed load, Admin menu link (unit) | Pass |
| AC10 | Browser: login form, Admin link, create news and a Suggested crate, signed-out Home and /list show them, non-admin is bounced from /admin (browser) | Pass |
| AC11 | Browser: verify toggle and public badge, bulk paste success and invalid-JSON error, no overflow at 1280 or 390px, mouse and touch work (browser) | Pass |
| AC12 | `format:check`, `lint`, `typecheck`, `test`, `build` all exit 0; `passwords.test.ts` and `auth-accounts.test.ts` unchanged (command) | Pass |

## What was built

37 files changed, 4,272 insertions and 12 deletions across three commits:
- `90dead2` is the admin-only API (overview, users, crates, news, import).
- `6f8406a` is the insert-only dev admin login.
- `e47d46c` is the admin panel, its route guard and the account menu link.

Other additions:
- an ADR, `docs/adr/0007-dev-admin-login.md`;
- documentation in `README.md`, `docs/DEPLOY.md` and `.env.example`;
- a `check:dev-admin` script;
- the browser check `.shipyard/checks/admin-panel.check.mjs`.

## Test results

- The final gate ran on a clean export of HEAD. All five commands exited 0, with 428 API tests and 400 web tests passing.
- Browser check: 99 steps, 0 failures, on a temporary database, in Chromium only.
- The only existing test file touched was `apps/web/src/router.test.ts` (22 lines added).
- No failures occurred, so there is no failure output to quote.
- The baseline figure was corrected twice during planning (326, then 357, then 717 = 360 API + 357 web). The checklist tester could not reconcile the 357 figure per workspace. It judged by the unchanged pre-existing tests instead.

## What went wrong

Nothing failed. There were three process incidents:
- Removing the admin guard made 3 AC4 tests fail while the API was being built. That showed the tests do catch it. The guard was restored.
- An uncommitted `apps/web/src/App.vue` edit appeared during the build. The owner confirmed it was theirs and removed it. It never reached the branch.
- The checklist tester was quick (8 tool calls) and judged AC3 from the PASS lines without reading the script. The harbormaster spot-checked the script and the test titles and accepted the verdicts.

## Known gaps

- The failure path of the new `server.ts` try/catch (the dev-admin step failing without stopping startup) is untested.
- `check-dev-admin` uses `process.execPath` instead of `node`. A change to `crate.db-wal` prints a warning rather than failing, because your dev server also writes that file.
- A verify click landing during an in-flight users refresh could be overwritten by the stale response.
- Bulk import is not de-duplicated, so pasting the same JSON twice creates duplicates. Run `db:backup` before large imports.
- Demo rows return after deletion on restart while demo seeding is on. Admin-created rows do not.
- The `NODE_ENV` guard fails open if `NODE_ENV` is unset on an internet-facing host started outside the Dockerfile or Compose. `shouldSeedDemo` has the same weakness, and `docs/DEPLOY.md` says so.

## Observations for the owner to choose from

1. **Top choice: the Demo tag on Home news (medium).** Home tags every news item Demo, including news an admin just created, because `HomeView.vue` renders `<DemoTag />` unconditionally. The Recommended section also still says "Curated demo picks". Admin-published content is presented to the public as demo. Fixing this is the recommended follow-up.
2. **Dev admin is the only admin on `data/crate.db` (medium).** See the top of this report. Decide whether `ADMIN_EMAIL=trf@frission.com` in `.env` should become a real admin some other way.
3. `.env` has `ADMIN_EMAIL=trf@frission.com` (double s), which differs from the `frisson.com` domain of the new login (low). Nothing here changed `.env`.
4. `AboutView` says the news and recommendations are demo data. That becomes untrue once an admin publishes real items (low).
5. The comment in `apps/api/src/db/schema.ts` still calls news fictional demo news (low).
6. For about 0.5s after a route change, the view transition in `viewTransitions.ts` swallows clicks and taps (low). This is pre-existing, not from this change.
7. `/admin` is very long at 390px, about 13,900 CSS px in the test data, with no way to jump between sections. Bulk import sits at the very bottom (low).
8. Info: a real-admin pass confirmed that Add records opens the editor with the crate preselected, the Suggest toggles move the row and show on signed-out Home, and double-clicking Create crate makes one crate.

## Recommended next steps

1. Fix the Demo tag so admin-created news and crates are not labelled demo.
2. Confirm the dev-only reading of the login and the two-section crate reading.
3. Consider a startup check that detects the dev admin row in a production database.
4. Add an in-page section jump for `/admin` on phones.
5. Update the About copy and the schema comment.
## Token use

Size: standard. Reported total: 682,066 tokens across 9 agents.

| Role | Agents | Tokens | Share |
|---|---|---|---|
| dev | 3 | 291,625 | 43% |
| browser-tester | 1 | 140,764 | 21% |
| manager | 1 | 93,166 | 14% |
| intake | 1 | 61,420 | 9% |
| surveyor | 1 | 47,412 | 7% |
| tester | 1 | 27,601 | 4% |
| reporter | 1 | 20,078 | 3% |

| Agent | Model | Tokens | Tool uses | Seconds |
|---|---|---|---|---|
| surveyor-relevant | sonnet | 47,412 | 33 | 74 |
| intake | opus | 61,420 | 32 | 153 |
| manager | opus | 93,166 | 52 | 301 |
| dev-admin-api | opus | 83,592 | 28 | 279 |
| dev-dev-admin | opus | 92,282 | 33 | 346 |
| dev-admin-web | opus | 115,751 | 37 | 669 |
| tester | sonnet | 27,601 | 8 | 30 |
| browser-tester | opus | 140,764 | 37 | 945 |
| reporter | sonnet | 20,078 | 7 | 24 |

The harbormaster's own tokens are not included: no figure was available.

### Dev models across 4 run(s)

| Model | Tasks | Fix agents | Fixes per task | Tokens |
|---|---|---|---|---|
| sonnet | 2 | 1 | 0.50 | 46,027 |
| opus | 5 | 1 | 0.20 | 396,557 |
