# DEV report: T3 (crate ownership)

Commit c51c28c on shipyard/user-accounts-auth-2026-11-07T06-59-04. No dependencies added. Only T3's four files committed.

## What was built
- services/crates.ts: writes take `PublicUser | null`. createCrate requires a user (401) and sets ownerId. updateCrate/deleteCrate call assertCanEditCrate (401/404/403) first. reorderCrates: requireUser, existing "every crate once" 400, then for non-admins a Drizzle query (inArray + isNull/ne) finds any listed crate not theirs and throws HttpError(403, 'You can only reorder crates you own').
- routes/crates.ts: passes req.user through; reads stay public.
- test/crates.test.ts: every write signs up via helpers.signUp and uses crates owned by that user; position moves send the cookie; assertions kept (create also checks ownerId; sort PATCH now asserts 200).
- test/ownership.test.ts: 'ownership: crates' block with the AC10/AC11 crate tests verbatim, a crate-only admin test for T4 to finish, and a 404-vs-401 test.

## Gates
api typecheck, tests (123), eslint, prettier: all 0. Full repo gates not run (others mid-change).

## Findings
See cycles/1/tasks/T3.json. Main one: non-admin reorder only works when they own every crate on the shelf.
