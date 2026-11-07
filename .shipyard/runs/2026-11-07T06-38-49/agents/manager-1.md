# manager-1 notes (cycle 1)

Inputs: brief.json (AC1..AC12), codebase-map.json (relevant inventory, 64 files incl. lockfile). Live grep `grep -rIliE 'crate[-_ ]?digger|cratedigger'` (excluding node_modules/.git/.shipyard) matches the inventory exactly.

Decisions:
- 4 tasks, disjoint files. T1 manifests+lockfile+.prettierignore (the only task running npm install; owns package-lock.json). T2 api and T3 web depend on T1 (workspace symlink @frisson/shared needed for typecheck/test). T4 docs/Docker/CI independent.
- packages/shared/src/sorting.ts line 4 is a comment referencing '@crate-digger/shared/sorting'; given to T1 with the shared package.
- HMAC label: surveyor flagged it as a behaviour change, but brief assumptions accept renaming it (one-time logout). Rename to 'frisson-session'.
- Test admin password 'crate-digger' -> 'frisson' (brief assumption); must be consistent across auth.test.ts.
- DEPLOY.md 60-61 (clone URL, cd crate-digger) left alone: repo not renamed; directory determines Compose project name and thus volume prefix. These are the AC1 allowlist.
- compose.yaml: no hits and must not change (no name: key). Not owned by any task.
- SPEC.md tree root line 24 -> 'frisson/' per AC11, even though checkout dir stays crate-digger (doc illustration).
- AC4 is served by T1/T2/T3 per workspace plus a final gate after all tasks.
- Risk: npm install version drift in lockfile; T1 told to verify diff is name/link only.
- Sandbox: npm install needs npm_config_nodedir=/opt/node22.
