# manager-1 notes

Read: manager.md, brief.json, codebase-map.json, intake-1.md, ledger.md, and source files app.ts, plugins/covers.ts, plugins/web.ts, routes/covers.ts, paths.ts, services/users.ts, services/sessions.ts, shared index.ts, router.ts, Caddyfile, and the backup/restore hints.

Decisions
- 7 tasks: T1 (contracts+schema+migration) -> T2, W1, D1 -> T3 (after T2, shared app.ts), W2, W3 (after W1). Ownership validated by script: no file shared between unordered tasks; AC1-AC22 all covered.
- AC naming wins over brief prose: the table is `user_links` and the column is `avatar_path`.
- updateProfileInput and setVerifiedInput are strict (400 on unknown keys) rather than stripping.
- All profile mutations and avatar endpoints return publicProfile; the web refreshes /auth/me afterwards.
- Multipart: T3 moves the single registration into plugins/uploads.ts and passes per-route limits to req.file(). Covers behavior must not change.
- helpers.ts is owned by T3 only (temp avatarsDir). T2 uses the existing helpers as they are.
- W1 creates placeholder ProfileView/EditProfileView so router.ts typechecks; W2 and W3 replace them.
- T1 owns the PublicUser fixture fixes in api and web tests (new required fields avatarUrl and verified). session.test.ts is then handed to W1, which depends on T1.
- Links accept any https URL for any platform; duplicates are allowed; credentials in a URL are rejected.
- Caddyfile proxies everything, so no change is needed; Docker and the volume are untouched.
- Test-name contract from the brief is kept as written: 'migration 0004', 'public profile', 'update profile', 'cannot self', 'verified', 'avatars', 'plain text', and 'no email'.

Risks for review: the 0004 SQL must show ON DELETE cascade and no DROP; PATCH /me/profile must give 401 before body validation; also check how vue-tsc handles the placeholder views.
Memory: used only the stored rule never to touch the Pennant org (already in constraints).
