# Intake notes, Frisson Phase 2 (user profiles)

Read: intake agent spec, Phase 1 brief and report, schema.ts, covers plugin/service/route, paths.ts, app.ts, users service, permissions, web plugin, router, shared index, migration test, test helpers.

Key findings from the code
- Covers pipeline: sharp, 800px square JPEG, 50 MP guard, random file name, basename-guarded delete, multipart registered inside coversPlugin (limit MAX_COVER_BYTES, files 1, fields 0). Registering multipart a second time for avatars will conflict; plan a shared registration.
- web.ts SPA fallback excludes only /api/ and /covers/; /avatars/ must be added.
- publicUser (shared) includes email and role and is the private /auth shape; toPublicUser must NOT be reused for public profiles.
- crate schema already has ownerId and ownerUsername; crate pages need only link them (plus optional display name).
- Username charset [a-z0-9_-], 3-32, lower-cased: safe in URLs.
- Phase 1 drizzle-kit dropped an ON DELETE action on an ALTER ADD FK; new FK is on CREATE TABLE so should be fine but check.
- Backup/restore scripts and DEPLOY.md only mention covers; avatars need the same note.
- No git base tag; base is HEAD 8eaedeb.

Judgment calls (all in assumptions): full-replace PATCH semantics for links, 5 MB / 400px avatar, field name 'avatar', no host-platform matching, duplicate platforms allowed.
Memory: no relevant stored facts used beyond the Never edit Pennant org constraint.
