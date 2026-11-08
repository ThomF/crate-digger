# tester-2: scoped re-test after 3769352

Verdict: pass. Details and evidence are in `cycles/1/test-report-retest.json`.

- Regression guard: test, typecheck, lint, format:check and build all exit 0 (api 360 tests, web 316 tests).
- Criteria: AC10, AC4, AC9, AC17, AC18, AC19 pass. All 6 F1 items pass.
- Setup: built web app served by Fastify on port 3111 against a temp database copy, NODE_ENV unset. Real clicks and real Tab/Enter in the built-in browser with an emulated viewport.
- Scope limits: AC4 covered /, /following and /profile only. The AC17 failure path relies on component tests, as the brief specifies.
- Open note: one recommended-card count click did not navigate on its first attempt. It did not reproduce in 3 later attempts and its cause was not established.
- Cleanup: server stopped, tab closed, viewport reset, temp database copies deleted, `data/` checksums match the baseline.
