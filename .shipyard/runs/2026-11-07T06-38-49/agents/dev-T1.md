# DEV T1 report

Task: rename workspace packages, regenerate lockfile, ignore .shipyard in Prettier.
Commit: 9251784 on shipyard/rename-to-frisson-2026-11-07T06-38-49.

## Changes
- package.json name: frisson
- apps/api/package.json: name @frisson/api, dependency @frisson/shared
- apps/web/package.json: name @frisson/web, dependency @frisson/shared
- packages/shared/package.json: name @frisson/shared
- packages/shared/src/sorting.ts: comment updated to '@frisson/shared/sorting'
- .prettierignore: added `.shipyard`
- package-lock.json: regenerated with `npm_config_nodedir=/opt/node22 npm install` (not hand edited)

No versions, scripts or other fields changed.

## Verification
- `grep -ci crate-digger package-lock.json` -> 0
- Lockfile diff (38 lines) touches only root/workspace names, the shared dependency entry (re-sorted alphabetically in apps/api), and node_modules/@crate-digger/* link entries replaced by node_modules/@frisson/*. No version drift.
- `npm ci` (with nodedir env) -> exit 0; node_modules/@frisson/{api,shared,web} symlinks exist, node_modules/@crate-digger gone.
- `npm run format:check` -> exit 0
- `npm run lint` -> exit 0
- `npm run typecheck` -> 2, `npm test` -> 1, `npm run build` -> 1. Cause: apps/api and apps/web source still imports `@crate-digger/shared` (30 files, owned by other devs). Expected per instructions.

## Criteria status (for tester)
- AC2: package names correct; repo-wide grep still matches in apps/* until other tasks land.
- AC3: satisfied as far as I can tell.
- AC4: blocked on other tasks.
- AC12: only owned files touched; no new files in repo.

## Tests
None added. The criteria are checked by commands, and packages/shared has no test script.
