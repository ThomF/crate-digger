# dev-T3

Task T3: avatar upload/delete, shared multipart registration, /avatars static and routing. Commit 10a7668.

- plugins/uploads.ts registers @fastify/multipart once (fileSize max(cover, avatar), files 1, fields 0); covers.ts no longer registers it; covers route passes MAX_COVER_BYTES per request.
- plugins/avatars.ts: mkdir, app.avatarsDir, @fastify/static at /avatars/ (immutable, 365d).
- paths.ts: DEFAULT_AVATARS_DIR = AVATARS_DIR ?? DATA_DIR/avatars. Other paths unchanged.
- services/avatars.ts mirrors covers: 400x400 JPEG q82 mozjpeg, rotate, 50 MP guard, server-generated names, basename deletes, write-then-update with cleanup. Returns getPublicProfile.
- routes/avatars.ts: POST/DELETE /me/avatar, requireUser before stream, field 'avatar', no reply.code.
- web.ts SPA fallback excludes /avatars/; vite proxies /avatars.
- helpers: temp avatarsDir, pngBuffer. Tests: avatars.test.ts (15), web.test.ts 'avatars'.
- All five root gates green. No new deps.
