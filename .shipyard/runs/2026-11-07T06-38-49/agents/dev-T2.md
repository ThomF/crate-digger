# DEV report: T2, rename product name in apps/api src and tests

Commit: 342ba16 on shipyard/rename-to-frisson-2026-11-07T06-38-49 (19 files, 33+/33-, only T2-owned files).

## Changes
- `@crate-digger/shared` and `@crate-digger/shared/sorting` imports -> `@frisson/...` in 11 src files and 5 test files.
- `apps/api/src/plugins/auth.ts`: `SESSION_COOKIE = 'frisson_session'`; HMAC fallback label `'frisson-session'`. Effect: existing sessions are invalidated once (accepted one-time logout).
- `apps/api/src/routes/health.ts` and `test/health.test.ts`: service `'frisson-api'`.
- Tests: mkdtemp prefixes `frisson-auth-`, `frisson-web-`, `frisson-covers-`; multipart boundary `----frisson-test-boundary`; admin password `'frisson'` used consistently across auth.test.ts (all 11 occurrences).

## Untouched
crate.db, DATA_DIR, crates routes/tables, crate_sort_by, apps/api/drizzle/**, apps/web.

## Verification
- `npm run typecheck -w apps/api`: pass
- `npm test -w apps/api`: 8 files, 82 tests passed
- `npx eslint apps/api`: pass
- `grep -rIniE 'crate[-_ ]?digger|cratedigger' apps/api`: no output
- AC6 greps match (cookie, health service in src and test, mkdtemp only frisson- prefixes).
- AC10: no changed line touches CrateBox/CrateView/CratesView/CrateSettings/crate_sort_by/crate.db/DATA_DIR.

## Notes
- No new tests were added; the existing tests that asserted old names were updated (health service assertion, auth flow with new cookie name via SESSION_COOKIE import).
- Repo-wide AC1, AC2, AC4 also depend on T1 and the parallel apps/web task; only the apps/api portion was verified here.
- No dependencies added. No blockers.
