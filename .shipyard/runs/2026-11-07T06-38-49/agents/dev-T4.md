# DEV report: T4 (Rename product name in docs, Dockerfile and CI)

Commit: cae9e17 (`docs: rename product to Frisson in docs, Dockerfile and CI`), only the 7 owned files.

## Changes
- README.md:1 `# 🎛️ Frisson` (emoji kept)
- docs/SPEC.md:1 `# Frisson — Spec`; line 24 tree root `frisson/`
- docs/DEPLOY.md:1 `# Deploying Frisson`; lines 60-61 (clone URL, `cd crate-digger`) left unchanged as allowlisted
- docs/adr/0001-stack.md:8, docs/adr/0003-deployment.md:8 `Crate Digger` -> `Frisson`
- Dockerfile:7-8 image tag `frisson`; `-v crate-data:/data` kept
- .github/workflows/ci.yml:38,44 `frisson:ci` in build tags and docker run

## Verification
- grep for old name in owned files: only DEPLOY.md:60-61 remain.
- crate-data, crate.db, DATA_DIR, /data: no token removed or altered. Note for AC8: Dockerfile line 8 shows as a changed line in git diff because it contains `crate-data` alongside the image name; the crate-data token itself is identical. The plan required this edit.
- compose.yaml not touched.
- `npx prettier --check` on the edited md/yml files: pass (Dockerfile is not a prettier-supported file).
- No tests written: changes are docs/config text; checks above cover AC1, AC7, AC8, AC11 for these files. AC1 repo-wide also depends on other tasks.
- The working tree also contains uncommitted or concurrent edits by other devs (package manifests, lockfile, sorting.ts, .prettierignore); not touched or staged by T4.
