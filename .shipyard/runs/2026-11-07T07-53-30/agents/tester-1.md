# tester-1 notes (cycle 1)

Verdict: AC1..AC22 all pass. Smoke pass. Report: cycles/1/test-report.json.

## What I did
- Ran the full gate chain once: exit 0 (api 16 files / 222 tests, web 23 files / 167 tests, vite build ok).
- Ran every `check` from brief.json: each named vitest filter (all matched tests, none 0-match), every grep/ls/diff, and `npx drizzle-kit generate` ("No schema changes").
- Read the assertions in migration, profiles, avatars, shared-profile, web, auth-accounts and the web ProfileView, EditProfileView, router, App, ownerLink and session tests. None are trivial. They check status codes and also the resulting state: DB rows deep-equal to the snapshot, the profile unchanged after a rejected PATCH, files present or absent in the avatars dir, sharp metadata, and exact key sets.
- Smoke: extracted base 8eaedeb with git archive into /tmp/sy2-base and ran it on /tmp/sy2-data. Seeded user dee, a crate and an album, then ran the branch server on the same DATA_DIR with ADMIN_EMAIL/ADMIN_PASSWORD in production mode. Everything listed in the brief behaved: migration preserved the data and gave empty profiles, the old session still works, the public profile has no email or role, PATCH accepts and rejects the right payloads, the avatar is served as a 400x400 JPEG with immutable caching, DELETE removes the file, admin verified works and a non-admin gets 403, and cover upload still works. Both servers killed.

## Flags for the harbormaster
1. Not a defect: base signup returned 500 during seeding (ResponseSerializationError, avatarUrl/verified missing). That is because I symlinked node_modules from the repo, so the base API loaded the branch's @frisson/shared. The user, session and crate were created anyway. Future testers should use a separate `npm ci` for a clean base run.
2. AC21: the literal credential grep on `git diff` has 3 hits (the README note about SESSION_SECRET, plus `'secret'` mocks in shared-auth.test.ts). All 3 are unchanged context lines. A grep limited to added and removed lines is empty.
3. AC4: the 6-link limit is enforced in the app (zod max 6), not by a DB CHECK. The criterion allows either.

## Worktree
I touched no tracked files. git status shows only the untracked run dir. Temp files are in /tmp/sy2-base, /tmp/sy2-data, /tmp/sy2-img, /tmp/sy2-scripts and /tmp/*.log|jar.
