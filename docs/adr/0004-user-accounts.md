# ADR 0004 — User accounts replace the shared admin password

- **Status:** Accepted
- **Date:** 2026-11-07
- **Supersedes:** the "Staff log in" password and `SESSION_SECRET` parts of
  [ADR 0003](0003-deployment.md)

## Context

Until now one shared `ADMIN_PASSWORD` unlocked editing for whoever knew it, and sessions were
signed cookies keyed from that password (or `SESSION_SECRET`). Frisson should let several people
keep their own crates on one instance, without anyone being able to edit someone else's, and
without adding services (no external identity provider, no email server).

## Decision

- **Accounts in SQLite.** A `users` table (email, username, display name, role `user` or
  `admin`, password hash). Anyone can sign up at `/signup`; the API always creates role `user`.
- **Passwords hashed with scrypt from `node:crypto`.** No native or third-party hashing
  dependency. Each hash stores its own parameters and salt (`scrypt$N$r$p$salt$hash`), so the
  cost can be raised later without breaking old hashes. Comparison is constant-time, and a login
  for an unknown email still runs a full scrypt verify so timing does not reveal which emails
  exist.
- **Opaque session tokens, stored hashed.** Logging in creates 32 random bytes sent as an
  httpOnly cookie; the database keeps only the token's SHA-256 and an expiry 30 days out. A
  leaked database therefore holds no usable sessions, logging out deletes the row, and no signing
  secret is needed (`SESSION_SECRET` is gone).
- **Ownership via `crates.owner_id`.** A crate belongs to one user; its albums and tracks follow
  their crate. Owners edit their crates, admins edit everything, everyone can read. `NULL` means
  admin-owned: only admins can edit it.
- **Backfill in app code at startup, not in the migration.** On every start the API creates the
  first admin from `ADMIN_EMAIL` + `ADMIN_PASSWORD` if no admin exists (it never changes an
  existing admin's password), then assigns every ownerless crate to the earliest admin. It is
  idempotent. The migration cannot do this because the password must be hashed in Node.
- **SameSite=Lax cookies as the CSRF mitigation.** The browser does not send the session cookie
  on cross-site POST, PUT, PATCH or DELETE requests, and the web app and API share one origin.
  No separate CSRF token.
- **Rate limits** on log in and sign up: 10 tries per 15 minutes per IP (`@fastify/rate-limit`),
  using `X-Forwarded-For` only when `TRUST_PROXY=true`.

## Consequences

- Existing deploys must add `ADMIN_EMAIL`; Compose refuses to start without it. An instance
  started without it has no admin, and its existing crates stay locked until one exists.
- Everyone is signed out once on upgrade, since the old signed cookies are no longer accepted.
- Signing up with an email that is already registered returns 409, which reveals that the
  account exists. Accepted for a small self-hosted app.
- Out of scope for now: email verification, password reset or change, OAuth, deleting users.

## Alternatives considered

- **bcrypt or argon2 packages:** native builds (already a pain for better-sqlite3 on ARM) for no
  real gain over scrypt, which Node ships.
- **Signed, stateless cookies (JWT-style):** cannot be revoked on logout without a denylist, and
  need a secret to manage.
- **Backfilling ownership in SQL:** the migration would need a user to point at, and creating
  that user needs a hashed password, which SQL cannot produce.
