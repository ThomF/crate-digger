# dev-D1

Task D1: docs and backup hints for user profiles. Commit d69b9e6.

- docs/DEPLOY.md: avatars/ in diagram, Backups and Restoring (with AVATARS_DIR note and an avatars copy step), new "Upgrading to user profiles" note that migration 0004 adds empty profiles automatically.
- backup.ts / restore.ts: hint strings mention avatars next to covers (strings only). Smoke-tested both scripts on a temp DATA_DIR.
- docs/adr/0005-user-profiles.md: Status Accepted, Date 2026-11-07; Context, Decision, Consequences, Alternatives considered, covering every point in the plan plus out of scope list.
- README.md: six API rows (profile, me/profile, me/avatar POST/DELETE, /avatars/:file, verified), AVATARS_DIR env var, data/avatars, Layout notes for profile routes/services, uploads plugin and data/ folder.
- Avatar multipart field name left unstated (T3 owns it).
- All five gates green (api 205, web 127). No dependencies added.
