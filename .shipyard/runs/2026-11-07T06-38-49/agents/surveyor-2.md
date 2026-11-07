# Surveyor 2: conventions + docs (crate-digger)

See survey-conventions-docs.json for the structured map.

Name counts (excluding node_modules, .git, .shipyard, lockfile): "Crate Digger" 14 lines, "crate-digger" 80, "crate_digger" 1 (cookie in apps/api/src/plugins/auth.ts). Locations: README, SPEC, DEPLOY, ADRs, Dockerfile comments, compose/.env.example/Caddy possibly, ci.yml image tag crate-digger:ci, apps/web/index.html title, package names @crate-digger/{api,web,shared}, GitHub URL ThomF/crate-digger in DEPLOY.md, web source imports of @crate-digger/shared.
Tooling: Prettier + ESLint 9 flat + editorconfig + VS Code format-on-save. CI: format:check, lint, typecheck, test, build, plus docker smoke test.
PR template: What/Why/How to test/Screenshots/Checklist (lint, typecheck, test; spec/ADRs updated if a decision changed).
Absent: CLAUDE.md, CONTRIBUTING.md, commitlint/husky, a rename or branding doc.
Git: single commit visible (05d2ed6, merge PR #12), so commit style can't be confirmed locally.
