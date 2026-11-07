# Intake 2: Crate Digger -> Frisson rename

Survey (grep, read only): ~63 files contain the old name. Variants found: "Crate Digger" (UI, docs), crate-digger (packages, imports x55, image tag, temp prefixes, test password, HMAC label, health service, repo path), crate_digger_session (cookie). package-lock.json has 10 matches.

Key findings
- Domain word crate is pervasive (CrateBox, CratesView, crate-data volume, crate-backup, crate.db): replace only the product-name tokens, never bare "crate".
- compose.yaml has no name:, so the Compose project name comes from the directory. Renaming the checkout directory would prefix the volume differently and orphan data. This PR does not rename directories.
- Cookie and HMAC label rename logs everyone out once.
- docs/DEPLOY.md clones github.com/ThomF/crate-digger and cds into it; only changes if the GitHub repo is renamed, so it is the one grep allowlist entry.
- Drizzle migration files contain no old name; leave untouched.

Open questions (recorded as assumptions): repo rename timing, health service value, image tag, one-time logout acceptable.

See brief.json for goal, constraints, assumptions, risks and AC1-AC12.
