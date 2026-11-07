# dev-T2

Task T2: API public profile, PATCH /api/me/profile, admin verified flag. Commit 967d91e.

- services/profiles.ts: toPublicProfile (explicit public fields only), getPublicProfile (lower-cased lookup, 404 'User not found'), updateOwnProfile (requireUser, server-side 6-link cap, one transaction: update users, delete+insert links with position = index), setVerified (requireAdmin, 404, update). Crates via Drizzle leftJoin + count, ordered sortOrder, id.
- permissions.ts: requireAdmin (401 then 403, role check only).
- routes/profiles.ts: three routes; preValidation requireUser / requireAdmin so 401/403 win over 400. No reply.code.
- app.ts: profileRoutes under /api after coverRoutes, before webPlugin.
- test/profiles.test.ts: describes 'public profile', 'update profile', 'cannot self', 'verified', 'crate responses: no email' (26 tests).
- api typecheck, tests (205), eslint, prettier green. Full repo gates not run (parallel web/docs work). No new deps.
- Uncommitted backup.ts/restore.ts edits in tree are not T2's.
