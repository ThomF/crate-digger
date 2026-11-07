# Ledger

- 2026-11-07T06:59:04Z preflight: branched shipyard/user-accounts-auth-2026-11-07T06-59-04 from b628a8defcdbc00c7ff1578a963673267c01e4f4. Owner override: merge and push to main when shipped.
- 2026-11-07T06:59:04Z survey cache invalid (package.json changed since cached commit): full survey, 3 surveyors, dispatched with intake. PROJECT-REPORT.md read: prior run notes npm_config_nodedir=/opt/node22.
- 2026-11-07T07:02:46Z brief AC1..AC18 accepted (ids unique, all checkable). Survey complete, cache refreshed. Baseline gates green in 44s. manager-1 dispatched.
- 2026-11-07T07:07:48Z plan validated: 7 tasks, uncovered=[], conflicts=0.
- 2026-11-07T07:07:48Z dispatched dev-T1.
- 2026-11-07T07:13:00Z dev-T1 blocker: shared crate schema adds owner fields; web fixtures in library.test.ts and CrateBox.test.ts fail typecheck. Harbormaster grants T1 those two files (later tasks are ordered after T1, so no concurrency conflict). Noted: owner_id FK lacks ON DELETE SET NULL; user deletion out of scope, flag for a later phase.
- 2026-11-07T07:15:39Z done: T1.
- 2026-11-07T07:15:39Z dispatched dev-T2.
- 2026-11-07T07:25:47Z done: T2.
- 2026-11-07T07:25:47Z harbormaster flags for triage: (a) ADMIN_PASSWORD under 8 chars aborts startup, which could break an existing deploy with a short password; should warn and skip bootstrap instead. (b) logout 400 on empty JSON body; web client must not trip it.
- 2026-11-07T07:25:47Z dispatched dev-T3, dev-T5, dev-T7.
- 2026-11-07T07:31:26Z done: T3, T5, T7.
- 2026-11-07T07:31:26Z T7 left ADR 0003 and the Dockerfile comment stale (not its files); reassigned to T4 (concurrent T6 owns neither). Tree clean; the staged session.ts deletion landed correctly in T5's commit.
- 2026-11-07T07:31:27Z dispatched dev-T4, dev-T6.
- 2026-11-07T07:37:12Z done: T4, T6.
- 2026-11-07T07:37:12Z build complete (7 tasks). T6 added editControls.test.ts outside its list (unowned, accepted). tester-1 dispatched on AC1..AC18.
- 2026-11-07T07:42:33Z tester-1: 18/18 pass, end-to-end smoke on a base-commit database passes. Tree unchanged. reporter-1 dispatched.
- 2026-11-07T07:44:09Z verdict shipped. Fast-forward merge to main and push per owner override.
