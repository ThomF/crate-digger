# Surveyor 3, concern: relevant

Auth is one Fastify plugin (apps/api/src/plugins/auth.ts) with a single signed cookie `frisson_session` = `admin:<ts>`, three modes (open / read-only / password), and one global onRequest hook (L98) that gates every POST/PUT/PATCH/DELETE under /api/ except /api/session. Routes and services have no auth awareness and no user param.

Key gotchas for the change:
- authPlugin registers before dbPlugin in app.ts (L43 vs L49), so it has no app.db at register time.
- Migrations auto-run via createDb() (db/client.ts L27); journal has 3 entries (0000-0002); a backfill needs hand-edited SQL in a generated migration.
- test helpers addCrate inserts crates without owner; buildTestApp passes no auth opts (relies on open mode).
- seed.ts wipes and inserts crates with no owner.
- ADMIN_PASSWORD required in compose.yaml L27, ci.yml L44, Dockerfile L8 comment, README, DEPLOY.md, ADR 0003.
- Web gating is purely session.canEdit / canLogIn (7 components); router meta requiresEdit.
- Previous survey-relevant.json in run 06-38-49 is a rename survey, unrelated.
