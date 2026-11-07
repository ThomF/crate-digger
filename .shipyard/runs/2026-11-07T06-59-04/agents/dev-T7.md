# DEV report: T7 (docs and deploy config for accounts)

Commit 9b5474f on shipyard/user-accounts-auth-2026-11-07T06-59-04. No dependencies added. No code changed.

## What changed
- .env.example: ADMIN_EMAIL beside ADMIN_PASSWORD (first admin on first start; changing the password later does not change an existing admin); SESSION_SECRET marked unused.
- compose.yaml: ADMIN_EMAIL required with a :? message; SESSION_SECRET passthrough removed (old .env files still fine). Volume, /data untouched. Verified with docker compose config.
- docs/DEPLOY.md: ADMIN_EMAIL setup, "Upgrading to user accounts" (add ADMIN_EMAIL or no admin and existing crates stay locked; password at least 8; everyone signed out once; no data moves), Accounts section incl. TRUST_PROXY for per-IP limits; removed the "change admin password" row.
- README.md: accounts model replaces the "Who can edit" table, env var table with ADMIN_EMAIL, /api/auth routes replace /api/session.
- docs/SPEC.md section 8 and new docs/adr/0004-user-accounts.md.
- ci.yml smoke run: -e ADMIN_EMAIL=ci@example.invalid, password lengthened to ci-only-password (the old 7-char one would make the app exit).

## Checks
prettier --check on own files 0; npm run format:check 0. Other gates not run (docs-only).

## Findings
See cycles/1/tasks/T7.json. Notably ADR 0003 and the Dockerfile comment still describe the old model (not owned), and my first commit briefly included another dev's staged deletion; fixed by recommitting only T7 paths.
