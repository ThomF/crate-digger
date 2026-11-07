# tester-1 notes (cycle 1)

Verdict: AC1..AC18 all pass. Smoke pass. Report: cycles/1/test-report.json.

## What I did
- Ran the full gate chain once: exit 0 (api 13 files / 132 tests, web 16 files / 118 tests, vite build ok).
- Listed every test name with the verbose reporter and matched each name in brief.json. All present and passing.
- Read migration, passwords, auth-accounts, bootstrap, ownership, shared-auth tests, the api test helpers and the web session/permissions tests. None are trivial: each checks status codes plus the resulting DB or API state (unchanged names, album lists, covers dir, session rows, hashes).
- Ran each grep/ls check from brief.json, plus `npx drizzle-kit generate` ("No schema changes").
- Smoke: extracted the base commit with git archive into /tmp/sy-base, ran it in open mode on /tmp/sy-data, seeded a crate, album and track, stopped it. Then ran the branch server on the same DATA_DIR with ADMIN_EMAIL/ADMIN_PASSWORD. Legacy data survived, the crate was backfilled to the new admin, and signup, login, me, create crate, 403 on the admin crate/album, admin override, logout (old cookie then 401) and anonymous write 401 all behaved. POST /api/session is 404. Both servers killed.

## Flags for the harbormaster
1. AC16: the literal `git diff base -- Dockerfile docker | grep ...` is not empty. It hits the Dockerfile header comment `docker run ... -v crate-data:/data ...`, re-wrapped to add `-e ADMIN_EMAIL`. The mount text is unchanged and no real path moved, so I passed it on the criterion text. Your call if the literal grep must be empty.
2. Non-blocking: schema.ts says `owner_id` uses onDelete 'set null', but drizzle-kit's SQLite `ALTER TABLE ADD` emitted `REFERENCES users(id)` with no ON DELETE. The migrated DB reports on_delete NO ACTION. That doesn't matter yet (no user deletion this phase), but it differs from the brief's assumption and will matter when user deletion arrives.
3. AC17: the password-literal grep has 2 hits, both mock inputs in apps/web/src/stores/session.test.ts (a test file). There are no secrets in non-test source.

## Worktree
I touched no tracked files. git status shows only the untracked run dir. Temp files are in /tmp/sy-base, /tmp/sy-data and /tmp/*.log|jar.
