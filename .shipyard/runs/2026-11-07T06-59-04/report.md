# Run report: Frisson 1.0 Phase 1, user accounts and auth

**Verdict: shipped.** All 7 tasks done, 18 of 18 acceptance criteria pass, and the end-to-end smoke test on a database created by the base commit passes. The owner asked for a direct merge and push to main (no PR). This report covers the work on branch `shipyard/user-accounts-auth-2026-11-07T06-59-04`. I have no evidence in the run artifacts that the merge or push has happened, so it is not claimed here.

## What was asked

Frisson 1.0 Phase 1. Replace the single ADMIN_PASSWORD cookie with real user accounts: signup, login, logout, server-side sessions, admin and user roles, and per-crate ownership. Anyone can browse. Signed-in users create crates and edit or delete only their own. Admins edit anything. Out of scope: profiles, social links, favorites, follows, email verification, password reset and OAuth.

## Acceptance criteria

| AC | Criterion | Status |
|---|---|---|
| AC1 | Repo gates green (format, lint, typecheck, test, build) | pass |
| AC2 | Generated migration 0003 only; old migrations untouched | pass |
| AC3 | Existing data survives the migration | pass |
| AC4 | scrypt, salt, timingSafeEqual, no new dependency | pass |
| AC5 | Signup normalises, enforces uniqueness, never returns the hash | pass |
| AC6 | Login, me, logout, generic failure message | pass |
| AC7 | Hashed session tokens, 30 day expiry, cookie flags | pass |
| AC8 | Per-IP rate limit on login and signup | pass |
| AC9 | Idempotent bootstrap admin and crate backfill | pass |
| AC10 | Anonymous browse; writes return 401 | pass |
| AC11 | Owner-only edits (403 for others), admin override | pass |
| AC12 | Old single-password flow removed | pass |
| AC13 | Shared zod auth schemas | pass |
| AC14 | Web signup and login pages, header with Log out | pass |
| AC15 | Edit controls only where permitted | pass |
| AC16 | ADMIN_EMAIL documented; data paths unchanged | pass (see note) |
| AC17 | Parameterized queries, no committed secrets | pass |
| AC18 | Errors go through HttpError | pass |

Notes from the tester:
- AC16: the literal Dockerfile grep is not empty. It hits a usage comment that was re-wrapped to add `-e ADMIN_EMAIL`. The volume mount text is identical and no real path moved. Judged pass on the criterion text.
- AC13: `loginInput` was renamed `credentialsInput` because AC12 forbids the old name.

## What was built (7 task commits)

| Task | Commit | Summary |
|---|---|---|
| T1 | cb34d03 | Accounts schema, 0003 migration, scrypt password hashing |
| T2 | c0ce0fd | Sessions, `/api/auth` routes, rate limiting, bootstrap admin |
| T3 | c51c28c | Ownership checks on crate writes |
| T7 | 4ad9025 | Docs and deploy config: ADMIN_EMAIL, upgrade notes, ADR 0004 |
| T5 | 9b5474f | Web: signup and login pages, session store, header user menu |
| T6 | be8910a | Web: per-crate edit controls (`canEditCrate`) |
| T4 | 0a1b027 | Ownership checks on album, track and cover writes; stale ADR 0003 and Dockerfile comment fixed |

No dependencies were added.

## Test results

Full gate chain `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` exited 0:
- API: `Test Files 13 passed (13), Tests 132 passed (132)`
- Web: `Test Files 16 passed (16), Tests 118 passed (118)`
- Build: `✓ built in 2.23s`
- `npx drizzle-kit generate`: "No schema changes, nothing to migrate"

**End-to-end smoke on a base-commit database.** The tester ran the base commit b628a8d in open mode and seeded the crate "Legacy Jazz" with the album "Kind of Blue" and the track "So What". It then ran the branch server on the same data directory with ADMIN_EMAIL and ADMIN_PASSWORD set.
- Startup log: "Created admin account admin" and "Assigned 1 ownerless crate(s) to the admin".
- The legacy crate and album survived. The crate now has `ownerId 1` and `ownerUsername 'admin'`.
- Signup returned 201 with the email normalised to `thom@smoke.test`. Login returned 200 with a cookie of `HttpOnly; SameSite=Lax`, expiring 30 days out.
- Unknown email and wrong password both returned 401 with identical bodies: `{"message":"Email or password is incorrect"}`.
- A regular user got 403 on the admin-owned crate and album. An admin edit of the user's crate returned 200.
- After logout (204) the old cookie returned 401.
- An anonymous `POST /api/crates` returned 401 "Sign in to make changes". `POST /api/session` returned 404.

## What went wrong and why

- **T1 blocker.** Adding owner fields to the shared crate schema broke typechecking of the web test fixtures in `library.test.ts` and `CrateBox.test.ts`, which were outside T1's file list. Resolved by granting T1 those two files. Later tasks were ordered after T1, so there was no concurrency conflict.
- **Stale docs.** T7 left ADR 0003 and the Dockerfile comment describing the old model, because they were not its files. Both were reassigned to T4 and fixed there.
- **Minor.** T7's first commit briefly included another dev's staged deletion. It was recommitted with only T7's paths, and the deletion landed correctly in T5's commit. T6 added `editControls.test.ts` outside its file list; accepted.
- **FK action missing.** The schema declares `owner_id` with ON DELETE SET NULL, but drizzle-kit's SQLite `ALTER TABLE ADD` emitted `REFERENCES users(id)` with no action. The migrated database reports `NO ACTION`. The SQL was not hand-edited, per the rules.

## Before you deploy

1. **Add `ADMIN_EMAIL` to the VPS `.env`.** Compose refuses to start without it.
2. **`ADMIN_PASSWORD` must be 8 or more characters.** A shorter one makes the app exit at startup. Check any existing short password first.
3. **Everyone is signed out once.** Old signed cookies are invalid, so everyone logs in again.
4. **Set `TRUST_PROXY` behind Caddy.** Without it, the per-IP rate limits key on the proxy's address.
5. **Existing crates are handed to the admin on first start.** Only admins can edit them until reassigned. Data paths and the `crate-data` volume are unchanged.

## Known limits

- `owner_id` has no ON DELETE SET NULL in the real database. Fix it with a later migration that rebuilds `crates` before any user-deletion feature, or deleting an owner will fail with an FK error.
- Crate reorder is effectively admin-only. A non-admin can reorder only when they own every crate on the shelf.
- Spins now need edit permission. They are no longer open to anyone.

## Next

Phase 2: profiles and social links.
