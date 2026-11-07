# Surveyor 3 notes (relevant)
- Stack: Fastify + zod type provider, drizzle/better-sqlite3, sharp, Vue 3 + pinia + vue-router; npm workspaces (apps/api, apps/web, packages/shared).
- Admin = user.role === 'admin' (permissions.ts:21-25); no admin-only helper yet.
- Cover pipeline is the model for avatars: processCover (800px JPEG), random filename, deleteCoverFile, multipart field name, static serving at /covers/ only. Avatars would need a new dir/prefix or reuse covers dir; web.ts SPA fallback (web.ts:34) and vite proxy only know /api and /covers.
- multipart registered globally with fields:0, files:1 (plugins/covers.ts:23-25).
- Crate owner info already in API (ownerUsername/ownerDisplayName) but not rendered anywhere in web.
- Session store has no way to update user after profile edit; header shows plain text name.
- Absent: users GET route, profile fields, social links table, verified flag, profile views/routes.
- Memory preference noted: never edit Pennant GitHub org (not relevant here); none else applicable.
