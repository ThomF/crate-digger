# Tester 1 notes

Base 05d2ed6a4ffc2e6e319e5a09e639bf4a2db607a5, HEAD 3d60338 (4 commits). Worktree: only `?? .shipyard/` before and after.

## AC1: PASS
grep -rIniE 'crate[-_ ]?digger|cratedigger' (excl node_modules,.git,.shipyard) returns exactly 2 lines, both allowlisted: docs/DEPLOY.md:60 'git clone https://github.com/ThomF/crate-digger.git' and docs/DEPLOY.md:61 'cd crate-digger'.

## AC2: PASS
node -e prints: frisson, @frisson/api, @frisson/web, @frisson/shared. grep -rn '@crate-digger' (excl node_modules,.git,.shipyard) returns nothing (exit 1).

## AC3: PASS
grep -ci 'crate-digger' package-lock.json -> 0. git diff --stat base..HEAD package-lock.json: 19+/19-, only root name, 4 workspace names, @frisson/shared dep entries (re-sorted alphabetically) and node_modules/@frisson/* link entries; no version changes. Plain 'npm ci' exits 1 (node-gyp 403 downloading node-v22.23.4 headers for better-sqlite3, environmental); 'npm_config_nodedir=/opt/node22 npm ci' exits 0, as the plan specifies.

## AC4: PASS
After npm ci: npm run typecheck exit 0 (tsc + vue-tsc); npm run lint exit 0; npm test exit 0 (api 8 files/82 tests, web 13 files/102 tests); npm run build exit 0 (vite built in 2.29s). Also npm run format:check exit 0 ('All matched files use Prettier code style!').

## AC5: PASS
apps/web/index.html:6 '<title>Frisson</title>'. document.title lines with Frisson: 7; base commit document.title lines with 'Crate Digger': 7. App.vue:18 RouterLink 'Frisson'. grep -rn 'Crate Digger' apps/web (excl node_modules,dist) returns nothing.

## AC6: PASS
auth.ts:35 SESSION_COOKIE = 'frisson_session'; auth.ts:53 createHmac('sha256','frisson-session'); health.ts:7 and health.test.ts:11 service: 'frisson-api'; mkdtemp prefixes: frisson-auth-, frisson-covers- (x2), frisson-web- only.

## AC7: PASS
Dockerfile:7 'docker build -t frisson .', :8 '... frisson'; ci.yml:38 'tags: frisson:ci', :44 'docker run ... frisson:ci'. grep -i crate-digger Dockerfile ci.yml compose.yaml returns nothing.

## AC8: PASS
crate-data still at compose.yaml:19,43, Dockerfile:8, docs/DEPLOY.md:11. Only changed line containing crate-data/crate.db/DATA_DIR//data is Dockerfile:8, differing only in trailing image name crate-digger->frisson. compose.yaml has no top-level name: key.

## AC9: PASS
git diff --name-only 05d2ed6 HEAD | grep -c '^apps/api/drizzle/' -> 0.

## AC10: PASS
Over 187 changed lines (excl lockfile): CrateBox/CrateView/CratesView/CrateSettings/crate_sort_by counts 0 removed/0 added; 'crates' 1/1. After normalising product name (crate-digger variants and frisson -> X) every removed line matches an added line; the only unmatched line is '+.shipyard' in .prettierignore.

## AC11: PASS
README.md:1 '# 🎛️ Frisson'; SPEC.md:1 '# Frisson — Spec'; DEPLOY.md:1 '# Deploying Frisson'; SPEC.md:24 'frisson/'; grep -ri 'crate digger' docs README.md returns nothing.

## AC12: FAIL
66 files changed, all modifications, no new files, no B-Side code (grep -ri b-side apps packages empty; no added b-side lines). But .prettierignore (no old name at base) gains '+.shipyard': a non-rename tooling change outside the check's allowed set. It is planned (spec.md Tooling, T1) and harmless, but the criterion as written fails; either drop the line or amend AC12 to allowlist it.

## Notes
- First `npm ci` without nodedir failed (node-gyp 403 fetching node headers) and removed node_modules; the suite run in that state failed (exit 127, vue-tsc/vitest/vite missing) and format:check flagged CrateBox.test.ts and albumForm.ts. These were artifacts of the missing node_modules; after the nodedir `npm ci` every command passed, including format:check. Not product defects.
- AC12 defect: `.prettierignore` line `.shipyard` is outside rename scope. Planned in spec/T1 to keep format:check green once run artifacts are committed. Recommend manager either accept by amending AC12 or remove it.
- Lockfile diff reorders `@frisson/shared` in apps/api deps (alphabetical after @fastify/*) and moves link entries; consistent with npm install regeneration, no version drift.
