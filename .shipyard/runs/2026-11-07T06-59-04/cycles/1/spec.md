# Cycle 1 spec: user accounts and per-crate ownership (Frisson 1.0, phase 1)

## What we are building

Today Frisson has one shared `ADMIN_PASSWORD`. `plugins/auth.ts` signs an `admin:<ts>` cookie, a global `onRequest` hook blocks writes under `/api/` unless that cookie is present, and three modes (open, read-only, login) decide who may edit. `routes/session.ts` is the whole login API. README's "Who can edit" table and ADR 0001 ("single-user collection") describe that model.

This cycle replaces it with real accounts. There is a `users` table with scrypt hashes and a `sessions` table that holds only the sha256 of an opaque random token. The routes are `/api/auth/{signup,login,logout,me}`. Each crate gets an `owner_id`. Anyone can browse. You need a session to write (401 without one). A user may change only crates they own, plus the albums, tracks and covers inside them (403 otherwise). Admins may change anything. On startup the first admin is created from `ADMIN_EMAIL` + `ADMIN_PASSWORD`, so `ADMIN_PASSWORD` still means "the admin password". The web gets Sign up and Log in pages, a header user menu with Log out, and edit controls only where `canEditCrate(user, crate)` is true. The old modes, the cookie format, `checkPassword`/`logIn`/`logOut`, `/api/session` and the password-only LoginView are deleted, not kept alongside.

## Key decisions

- **Contract first.** T1 adds `publicUser`, `signupInput`, `credentialsInput` and the crate owner fields (`ownerId`, `ownerUsername`, `ownerDisplayName`) to `@frisson/shared`, following its `xInput` naming. The login schema is deliberately not called `loginInput`: AC12 bans that identifier. The old `sessionInfo`/`loginInput` stay until T5 removes the last web consumer, so every task leaves the gates green.
- **Migration safety.** `0003_accounts.sql` comes from drizzle-kit and is never hand-edited. If drizzle-kit rebuilds `crates` to add the FK column, that rebuild clashes with `foreign_keys=ON` (albums reference crates with restrict). The fix goes in app code: `createDb` turns FKs off around `migrate()` and then runs `foreign_key_check`. `migration.test.ts` proves the data survives by applying 0000-0002 to a file DB, inserting rows, then letting `createDb` apply 0003.
- **Backfill in code.** `bootstrapAdmin` runs from `server.ts`, not `buildApp`, so tests stay hermetic. It does nothing without both env vars and never resets an existing admin's password. On every start it assigns NULL-owner crates to the admin. NULL owner means only admins can edit.
- **Auth plumbing.** `authPlugin` is registered after `dbPlugin` and sets `request.user`. Authorization goes through one module, `services/permissions.ts` (`requireUser`, `canEditOwner`, `assertCanEditCrate`, `assertCanEditAlbum`), which throws literal `HttpError(401/403)`. Routes pass `request.user` into it, and services never touch `reply`. Album moves check both the source and the target crate. Crate reorder needs every id to be editable. Spins count as a write.
- **Security.** scrypt (N=16384, r=8, p=1, 64-byte key, 16-byte random salt) runs async with `timingSafeEqual`. An unknown email still runs a dummy verify, and both failure cases return the same 401 body. Sessions last 30 days. The cookie keeps the name `frisson_session`, unsigned and opaque, with httpOnly, SameSite=Lax, and Secure in production. Logout deletes the row. `@fastify/rate-limit` (already installed) is scoped to signup and login, keyed per IP (with `TRUST_PROXY` behind Caddy), 10 per 15 min by default, and tests can configure it via `AppOptions.auth.rateLimit`. No new dependencies.
- **Test churn ownership.** T2 owns `test/helpers.ts` (`signUp`, `createAdmin`, `addCrate(..., ownerId)`, configurable `buildTestApp`) and deletes the old `auth.test.ts`. After T2, writes are temporarily unguarded, so the untouched tests stay green. T3 guards crates and rewrites `crates.test.ts` (including its album writes) to sign in. T4 does the same for albums, covers and their tests. `ownership.test.ts` is started by T3 and finished by T4, in sequence.
- **Web.** `api/auth.ts` replaces `api/session.ts`. The session store exposes `user`, `signedIn`, `isAdmin`, `load`, `logIn`, `signUp` and `logOut`. `utils/permissions.ts` has `canEditCrate`. The router meta becomes `requiresAuth` and there is a new `/signup` route. `/login` keeps `?next=`. T5 leaves a temporary `canEdit` alias so the views compile. T6 switches the views to `canEditCrate` and deletes the alias.

## Task graph

T1 → T2 → {T3 → T4, T5 → T6, T7}. At most 3 tasks run at once, and no two unordered tasks share a file.

## Out of scope

Profiles, favorites, likes, follows, feed, B-Side, email verification, password reset, OAuth, user deletion, CSRF tokens.

## Flagged for owner

Spins need edit permission. Duplicate signups return 409, which reveals that an account exists. Compose now requires `ADMIN_EMAIL`. Upgraded deploys without it have no admin, and their legacy crates stay locked. Everyone logs in again once after the upgrade.
