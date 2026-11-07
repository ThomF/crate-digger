# DEV report: T4 (album, track and cover ownership)

Commit 0a1b027 on shipyard/user-accounts-auth-2026-11-07T06-59-04. Only T4's nine files committed. No dependencies added.

## What was built
- services/albums.ts, services/covers.ts: every write takes `PublicUser | null` and calls permissions.ts. Create checks the target crate (400 missing kept, then 403); patch/position/tracks/spins/delete check the album (source crate) and, when crateId changes, the target crate.
- routes: pass req.user; cover upload checks permission before reading the file.
- albums.test.ts, covers.test.ts: sign in via signUp, crates owned by that user, assertions kept; added a spins 401 test.
- ownership.test.ts: 'ownership: albums and covers' block with the AC10/AC11 tests verbatim, full admin test replacing T3's crate-part one, ownerless test extended to albums, plus a 404-vs-401 album test.
- ADR 0003 marked partly superseded by ADR 0004; Dockerfile usage shows ADMIN_EMAIL and the 8+ char password.

## Gates
All five root gates exit 0 (132 api tests).

## Findings
See cycles/1/tasks/T4.json. AC17 password grep matches apps/web/src/stores/session.test.ts (not mine).
