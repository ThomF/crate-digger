# Ledger

- 2026-11-07T06:38:49Z preflight: branched shipyard/rename-to-frisson-2026-11-07T06-38-49 from 05d2ed6a4ffc2e6e319e5a09e639bf4a2db607a5. User override: merge and push to main at the end (SHIPYARD.md default is no push).
- 2026-11-07T06:38:49Z intake + full survey (127 tracked files, 3 surveyors) dispatched together.
- 2026-11-07T06:39:31Z intake-1 died (API safeguard flag, no output). Respawned as intake-2 on sonnet (1 of 2 respawns).
- 2026-11-07T06:40:54Z intake-2 returned brief with AC1..AC12. Survey complete (3 surveyors), map cached at .git/shipyard.
- 2026-11-07T06:40:54Z npm ci needed npm_config_nodedir=/opt/node22 (node-gyp header download blocked in sandbox). Baseline typecheck+lint+test+build green in 31s. Baseline format:check fails only on .shipyard/ artifacts, so .prettierignore needs .shipyard.
- 2026-11-07T06:40:54Z plan: manager-1 dispatched.
- 2026-11-07T06:42:19Z plan validated (4 tasks, all ACs covered, no concurrent file overlap). Build: dev-T1 and dev-T4 dispatched in parallel.
- 2026-11-07T06:46:46Z T4 done (cae9e17), T1 done (9251784). T2 and T3 unblocked, dispatched in parallel.
- 2026-11-07T06:49:38Z T2 done (342ba16), T3 done (3d60338). Build complete. tester-1 dispatched on all 12 criteria.
- 2026-11-07T06:52:57Z tester-1: 11/12 pass; AC12 fail only because the planned .shipyard line in .prettierignore was not allowlisted. Tree unchanged after tester. Triage (direct-fix): contract defect, not code; AC12 amended with explicit allowlist entry. Scoped retest: tester-2 on AC12 + regression run.
- 2026-11-07T06:55:01Z tester-2: AC12 pass, regression green (format, typecheck, lint, 82+102 tests, build). Tree unchanged. All 12 criteria pass. reporter-1 dispatched.
- 2026-11-07T06:56:39Z report written. Verdict shipped. Merging to main and pushing per owner override.
