# ADR 0007 — A local dev admin login

- **Status:** Accepted
- **Date:** 2026-11-08
- **Builds on:** [ADR 0004](0004-user-accounts.md), [ADR 0006](0006-following-home-and-demo-content.md)

## Context

The `/admin` panel needs an admin to try it with, on any developer's database, without any setup.
`bootstrapAdmin` can't provide one. It does nothing when any admin exists, and it goes through
`hashPassword`, which throws a 400 under 8 characters. Inside the `server.ts` start-up block, that
error would stop the app from starting.

## Decision

- **A separate insert-only step.** `ensureDevAdmin` runs from `server.ts` right after
  `bootstrapFromEnv`, not from `buildApp`, so test databases still start empty. It inserts one
  `users` row, `admin@frisson.com` / `admin`, and touches no other row or table. It never updates an
  existing account: an admin with that email is left alone, and an ordinary account with it is
  refused promotion with a warning. If the username `admin` is taken it takes `admin-2` or the next
  free name. A failure is logged and the API starts anyway.
- **A narrow exception to the password policy.** `hashDevAdminPassword()` takes no argument and hashes
  a private constant. The unchecked helper behind it is not exported, so the 8-character minimum still
  holds for signup, `hashPassword` and `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **Production is checked first.** `NODE_ENV=production`, trimmed and case-insensitive, disables the
  step whatever else is set. `SEED_DEV_ADMIN=false` disables it elsewhere, and `SEED_DEV_ADMIN=true`
  cannot override production.
- **A real-server check.** `npm run check:dev-admin -w apps/api` starts the actual API on temporary
  databases and compares every table before and after.

## Consequences and accepted risk

- **The guard fails open.** A host started with `NODE_ENV` unset gets a working admin with a public
  password. The Dockerfile sets `NODE_ENV=production`, so the Compose deployment is safe. Anything
  started outside it must set the variable. We accept this because failing closed would mean every
  developer has to opt in, which is what this step exists to avoid. `docs/DEPLOY.md` carries the warning.
- **The row travels with the database.** A dev database restored or copied to production keeps a
  working `admin` / `admin` login, because the guard only stops the insert. Removing the row or using
  a clean database is a manual step.
- **It lands in developers' own databases.** The next `npm run dev` start adds the row to
  `data/crate.db`, including when `node --watch` restarts on a source change. With no earlier admin
  and no `ADMIN_EMAIL`, the dev admin becomes the earliest admin, and bootstrap hands it every ownerless
  crate on the following start.

## Alternatives considered

- **Reusing `bootstrapAdmin` with `ADMIN_PASSWORD=admin`:** the length check would stop the app from
  starting, and it would do nothing on a database that already has an admin.
- **Lowering the password minimum, or adding a `skipPolicy` option to `hashPassword`:** either one
  weakens or opens up the policy for every caller.
- **Opt-in with `SEED_DEV_ADMIN=true`:** safer on a misconfigured host, but it needs setup on each
  machine. The login should simply work in development.
- **Adding the account through `db:seed`:** that command wipes crates, so it can't be run safely on a
  database with content.
