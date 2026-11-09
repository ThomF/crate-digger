# Admin panel and local admin login

## What we are building

Frisson has an admin role but almost nothing for an admin to use. The only admin endpoint is the verified toggle, which no screen calls, and news and recommended crates can only come from seed data. This run adds a panel at `/admin` where an admin can see all news, all crates and all users, grant or revoke the verified tag, and publish news and crates, one at a time or in bulk, that show up on the public site.

It also adds a working `admin@frisson.com` / `admin` login to the owner's existing database without resetting anything, and makes sure that login can never be created in production.

## The dev admin step

The existing `bootstrapAdmin` cannot do this job. It does nothing when any admin already exists, and it goes through `hashPassword`, which throws on passwords under 8 characters. Inside the `server.ts` try block, that throw would stop the app from starting.

So a new `ensureDevAdmin` step runs right after `bootstrapFromEnv`, in its own try/catch, and a failure there is logged without stopping the API. It only runs from `server.ts`, not `buildApp`, so tests and other callers never get an extra user.

The step only ever inserts one row:

- If the email already belongs to an admin, it does nothing, and the password is never rewritten.
- If the email belongs to an ordinary account, it warns and leaves that row untouched, matching bootstrap's refusal to promote silently.
- If username `admin` is taken, it uses the next free `admin-N`.

The short password gets a deliberately narrow path. `hashDevAdminPassword()` takes no argument and hashes only that one constant, so no caller can use it to get around the password policy. `hashPassword`, signup and the `ADMIN_PASSWORD` bootstrap keep the 8-character minimum, and `passwords.test.ts` and `auth-accounts.test.ts` stay unedited.

The production guard is checked first: `NODE_ENV=production` always refuses, even with `SEED_DEV_ADMIN=true`. `SEED_DEV_ADMIN=false` turns the step off everywhere else.

## The admin API

Every new endpoint lives in one encapsulated plugin under `/api/admin/*`. A single plugin-level `onRequest` hook calls the existing `requireAdmin`, so a route added later cannot forget the check, and refused callers are turned away before their body is parsed. The access test collects routes from Fastify itself through an `onRoute` option on `buildApp`, so it covers new routes automatically.

There is no migration, because the existing schema already holds everything:

- **Suggested** means `crates.recommended_rank` is non-NULL, the same column Home reads. Turning it on puts the crate last. Suggesting an ownerless crate returns 409, because Home's recommended list can only show crates with an owner.
- **Admin news** uses `news_items` with a generated `admin:<uuid>` seed key. It can't collide with the demo `news:` keys, the demo seed leaves it alone, and it never appears in a response.
- **Verified** stays on the existing `PATCH /api/users/:username/verified` route.
- **Bulk import** is validated whole by zod and then written in one transaction, so one bad entry means nothing is written and the 400 names the failing entry by path. A paste over Fastify's default limit of about 1 MB fails cleanly with 413, also writing nothing.

The users list holds every email address, so it is CONFIDENTIAL PII. Columns are selected by hand and responses pass through zod schemas, so password hashes and seed keys never leave the API.

## The panel

`/admin` is one lazy-loaded Vue view behind a new `requiresAdmin` route meta. Signed-out visitors go to login with `next=/admin`, and non-admins go home. The account menu shows an Admin link to admins only.

Each section loads independently through the existing `useAsyncSection`, so one failed list shows its own error and never looks like an empty list. Crate editing and deletion stay on the existing `/crates` page, which the panel links to.

The panel has to refresh the library store after crate changes. That store caches crates and albums for the session, so without a forced reload a newly created crate would be missing from `/list` and `/crates/:id` until a page reload.

## How the work is split

1. **dev-admin**: the step, the narrow hash path, tests, the repeatable `npm run check:dev-admin -w apps/api` command for AC3, and the docs and ADR.
2. **admin-api**: shared schemas, routes, service and API tests. It can run alongside dev-admin because they own different files.
3. **admin-web**: the panel, guard, menu link, unit tests, the browser check for AC10 and AC11, and the final repo-wide gate. It runs last because the browser check needs both of the others.

## How it is checked

The AC3 command starts the real server from a from-scratch environment on temporary databases, so neither `.env` values nor the caller's `NODE_ENV` can leak in. It refuses to use `data/crate.db` and fails if that file's size or modification time changes.

Its fixture has no ownerless crates. Bootstrap hands those to the earliest admin on the next start, which is existing behaviour and would change rows for a reason unrelated to this step. The docs describe that behaviour rather than the check hiding it.

AC2(e) needs care because the password `admin` is a substring of the email and of ordinary log text. A search for the string proves nothing, so the test compares every log message against the exact expected strings.

## Known limits and risks the owner should know

- The next `npm run dev` adds this login to `data/crate.db`, as requested. If that database has no admin yet and has ownerless crates, the following start gives those crates to the new admin. If the email already belongs to an ordinary account, a warning is logged and no login is created.
- The guard fails open if `NODE_ENV` is unset on an internet-facing host started outside Docker, the same weakness `shouldSeedDemo` has.
- The guard only stops the row being created. A dev database copied or restored to production brings a working admin/admin login with it. `docs/DEPLOY.md` will tell operators to remove it, and a startup check that detects it is a sensible follow-up.
- A demo news item deleted from the panel returns on restart while demo seeding is on, and the panel says so next to delete. Admin-created items do not come back.
- Panel changes are real data with no audit trail or undo, and bulk import does not de-duplicate.

## Open points for the owner

- The brief asks for confirmation that crates are one view with two sections, Suggested and User created. This plan builds them that way, as two headed sections on the panel.
- `.env` has `ADMIN_EMAIL=trf@frission.com`, spelled with a double s, while the new login uses `frisson.com` as the brief specifies. Nothing here changes `.env`.
- `AboutView` tells visitors the news and recommendations are demo data. That becomes untrue once an admin publishes real items. The brief does not cover this copy, so this plan leaves it unchanged and flags it for a decision.

## Out of scope

Role changes, deleting or suspending users, password reset or change, an audit log, permanently deleting demo rows, creating content on behalf of another user, a CLI seed command, and real news feeds or AI recommendations.