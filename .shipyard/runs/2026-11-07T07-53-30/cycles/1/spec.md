# Cycle 1 spec: Frisson Phase 2, user profiles

## What we are building

Every Frisson account gets a public face: a display name, a bio (up to 500 chars), an optional location (80), a square avatar, up to six ordered social links, and a verified badge that only an admin can grant. Anyone, signed in or not, can open `/u/:username` and see that profile plus the user's crates. Signed-in users edit their own profile at `/profile/edit`; the header links to both, and crate pages name their owner with a link to the profile.

## Why it is shaped this way

**Data.** Profile fields are additive columns on `users` (`bio` not null default `''`, `location`, `avatar_path`, `verified` not null default 0) so existing users pick up empty profiles through defaults alone. Links are their own `user_links` table (FK `ON DELETE CASCADE`, `position`, index on `(user_id, position)`) because they are an ordered list. The six-link limit lives in the shared zod schema and is checked again in the service. drizzle-kit generates migration 0004, which nobody edits by hand. A migration test in the 0003 style shows that every Phase 1 row survives.

**Contracts first.** `packages/shared/src/index.ts` is one file, so T1 owns it and writes every schema later tasks need: `SOCIAL_PLATFORMS`, `MAX_AVATAR_BYTES`, `usernameParams`, `profileLinkInput`, `updateProfileInput`, `setVerifiedInput`, `publicProfile`, plus `avatarUrl` and `verified` added to the private `publicUser`. The API and the web app then validate against the same rules.

**No leaks and no self-verify.** `publicUser` carries email and role, so it stays private to `/auth/*`. The public profile gets its own schema and its own mapper (`toPublicProfile`), and a test checks that the JSON contains no email and no `role` key. `updateProfileInput` is a `z.strictObject`, which means `verified`, `role`, `email` or `username` in the body gets a 400 and changes nothing. There is no `:username` edit route. Only `requireAdmin` guards `PATCH /api/users/:username/verified`, and a regular user gets 403 there even for their own name.

**Link safety.** A URL must parse with `URL`, use `https:`, have a host, carry no credentials and be at most 2048 chars. Any platform accepts any https URL, and duplicate platforms are allowed. The web renders everything through `{{ }}` and never `v-html`. Links open with `target="_blank" rel="noopener noreferrer"`.

**PATCH semantics.** `PATCH /api/me/profile` replaces `displayName`, `bio`, `location` and `links` in full. Array order becomes position, and the whole change runs in one transaction, so a rejected request changes nothing.

**Avatars reuse covers.** The pipeline is the same as for covers: sharp rotates (EXIF) and resizes to a 400x400 JPEG, with the same 50 MP guard. File names are random (`<userId>-<8hex>.jpg`) and deletes are basename-guarded. The files live under `DATA_DIR/avatars` (`AVATARS_DIR` overrides it), are served by a second `@fastify/static` with immutable caching, and the DB stores only the `/avatars/...` path. `@fastify/multipart` is registered globally today inside the covers plugin. T3 moves that registration into a single `uploads` plugin whose ceiling covers both cases, and each route passes its own limit to `req.file()` (10 MB for covers, 5 MB for avatars). The SPA fallback and the Vite proxy learn `/avatars/`, so a missing avatar returns a real 404 while `/u/x` still serves `index.html`. Caddy already proxies everything. No new dependencies.

**Responses.** `GET /api/users/:username`, `PATCH /api/me/profile`, `PATCH /api/users/:username/verified` and `POST/DELETE /api/me/avatar` all return `publicProfile`. After a change, the web session store calls `/api/auth/me` again so the header picks up the new name, avatar and badge.

## Task graph

- **T1** contracts, schema, migration 0004, `toPublicUser` fields, and fixture fixes. Every other task depends on it.
- **T2** (after T1) profile service and routes, `requireAdmin`, `profileRoutes` in `app.ts`, `profiles.test.ts` with the describe names `public profile`, `update profile`, `cannot self`, `verified` plus a `no email` crate test.
- **T3** (after T2, because both edit `app.ts`) avatars and the shared multipart refactor, `/avatars` static, `web.ts` fallback, Vite proxy, test helpers (sole owner), `avatars.test.ts`, and the `avatars` describe in `web.test.ts`.
- **W1** (after T1) web API client, session `refresh` and save wrappers, both routes with placeholder views, `router.test.ts`, `VerifiedBadge`.
- **W2** (after W1) ProfileView (including the `plain text` XSS test), header links and badge (`App.test.ts`), crate owner link (`ownerLink.test.ts`).
- **W3** (after W1) EditProfileView with LinksEditor and AvatarUpload. The word "verified" never appears in that view.
- **D1** (after T1) DEPLOY backups and restore, backup/restore hints, ADR 0005, README API table and env vars.

Waves: T1, then T2/W1/D1 in parallel, then T3/W2/W3 in parallel. That never exceeds the cap of 4, and no two unordered tasks share a file.

## Out of scope

Favorites, likes, follows, feed, B-Side, email verification, password change, account deletion. No changes to `crate.db`, `DATA_DIR`, `/data` or the `crate-data` volume. Nothing in the Pennant GitHub organization.
