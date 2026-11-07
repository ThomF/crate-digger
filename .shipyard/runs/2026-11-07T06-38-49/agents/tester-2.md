# tester-2 (fix round 1, scoped retest)

- Scope: AC12 only (amended allowlist '.prettierignore: .shipyard'), plus one full regression run.
- AC12: pass. 66 modified files, 0 added. Only file lacking the old name at base is .prettierignore; its sole change is '+.shipyard' (allowlisted). Only non-'frisson' added line outside the lockfile is that one. No B-Side code.
- Regression: `npm run format:check && npm run typecheck && npm run lint && npm test && npm run build` exit 0. api 82/82, web 102/102, build ok (zod Rollup annotation warnings only, pre-existing noise).
- Result: AC1-AC12 all pass. Worktree: only untracked .shipyard/.
