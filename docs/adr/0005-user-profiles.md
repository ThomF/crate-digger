# ADR 0005 — Public user profiles

- **Status:** Accepted
- **Date:** 2026-11-07
- **Builds on:** [ADR 0004](0004-user-accounts.md)

## Context

Since ADR 0004 every crate has an owner, but an owner is only a username. Frisson should give each
account a public face at `/u/:username`: a display name, a short bio, an optional location, a
square avatar, a few social links and a verified badge, visible to anyone, signed in or not. It
must not leak private account data (email, role), must not let users verify themselves, and must
not add services or dependencies.

## Decision

- **Profile columns on `users`, links in their own table.** `users` gains `bio` (not null,
  default `''`, up to 500 chars), `location` (up to 80), `avatar_path` and `verified` (not null,
  default 0). The columns are additive with defaults, so existing users get empty profiles
  without a backfill. Links live in an ordered `user_links` table (`position`, FK to `users`
  with `ON DELETE CASCADE`, index on `(user_id, position)`), at most six per user, enforced in
  the shared zod schema and again in the service. drizzle-kit generates migration 0004.
- **Full-replace PATCH.** `PATCH /api/me/profile` replaces `displayName`, `bio`, `location` and
  `links` in full. Array order becomes `position`, and the whole change runs in one transaction,
  so a rejected request changes nothing.
- **Strict body, so users cannot self-verify.** `updateProfileInput` is a `z.strictObject`:
  `verified`, `role`, `email` or `username` in the body is a 400 and changes nothing. There is no
  route that edits a username.
- **Verified is admin-only.** Only `PATCH /api/users/:username/verified`, guarded by
  `requireAdmin`, changes the badge. A regular user gets 403 there, even for their own name.
- **A dedicated `publicProfile` schema.** `publicUser` carries email and role and stays private
  to `/auth/*`. Public responses go through their own schema and mapper (`toPublicProfile`) with
  no email and no `role` key, and a test checks the JSON for both. Every profile endpoint
  (`GET /api/users/:username`, `PATCH /api/me/profile`, `POST/DELETE /api/me/avatar` and the
  verified route) returns `publicProfile`.
- **https-only links, no host matching.** A link URL must parse with `URL`, use `https:`, have a
  host, carry no credentials and be at most 2048 characters. Any platform accepts any https URL
  and duplicate platforms are allowed. The web renders text with `{{ }}`, never `v-html`, and
  opens links with `target="_blank" rel="noopener noreferrer"`.
- **Avatars reuse the covers pipeline.** sharp applies EXIF rotation and resizes to a 400×400
  JPEG with the same 50 MP guard; uploads are capped at 5 MB. Files get random names
  (`<userId>-<8hex>.jpg`), deletes are basename-guarded, and they live under `DATA_DIR/avatars`
  (`AVATARS_DIR` overrides it), served by a second `@fastify/static` with immutable caching. The
  database stores only the `/avatars/...` path.
- **One shared multipart registration.** `@fastify/multipart` used to be registered inside the
  covers plugin. It moves into a single `uploads` plugin whose ceiling covers both uploads, and
  each route passes its own limit to `req.file()` (10 MB for covers, 5 MB for avatars).

## Consequences

- Upgrading needs no manual step: migration 0004 runs on start and existing users get empty
  profiles.
- Backups now have a second folder of plain files, `avatars/`, to copy and restore next to
  `covers/` (see [DEPLOY.md](../DEPLOY.md)).
- Profiles, including links and the avatar, are public to anyone who knows a username.
- Without host matching, a link labeled with one platform may point anywhere on https. Accepted:
  the label is the user's own claim, and https-only blocks `javascript:` and similar schemes.
- Out of scope: favorites, likes, follows, a feed, B-Side, email verification, password change
  and account deletion.

## Alternatives considered

- **Links as a JSON column on `users`:** simpler, but ordering, the per-user limit and cascade
  deletes are clearer as rows, and SQLite JSON is awkward to validate.
- **Merge-style PATCH (only the fields sent):** needs per-link ids and partial list updates; a
  profile form always sends the whole thing, so full replace is simpler and atomic.
- **Reusing `publicUser` with fields stripped:** one forgotten `omit` leaks email. A separate
  schema makes the public shape explicit.
- **Matching link hosts to platforms:** brittle (custom domains, regional hosts, link
  shorteners) for little safety gain over https-only.
- **A separate multipart registration per plugin:** registering `@fastify/multipart` twice
  clashes on its request decorators, so covers and avatars share one with per-route limits.
