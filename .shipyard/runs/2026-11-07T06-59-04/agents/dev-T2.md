# DEV report: T2 (API auth core)

Commit c0ce0fd on shipyard/user-accounts-auth-2026-11-07T06-59-04. No dependencies added.

## What was built
- services/users.ts: createUser (lower-cases email/username, displayName defaults to username, 409 'Email already registered' / 'Username taken' via pre-check plus UNIQUE-violation mapping for races), findUserByEmail, findUserByUsername, getUserById, toPublicUser (no hash).
- services/sessions.ts: SESSION_TTL_MS = 30 days; createSession stores sha256 hex of a 32-byte base64url token, expiry rounded to whole seconds so cookie and row agree; findSessionUser deletes expired rows; deleteSession.
- services/permissions.ts: requireUser (401), canEditOwner, assertCanEditCrate (404/403), assertCanEditAlbum (album's crate, 404/403). Signatures take `PublicUser | null` and return the user.
- plugins/auth.ts: registers @fastify/cookie unsigned, decorateRequest('user', null) with module augmentation, onRequest hook sets request.user, `app.auth.setSessionCookie(reply, token, expiresAt)` / `app.auth.clearSessionCookie(reply)` (httpOnly, SameSite=Lax, path /, Secure only in production). Old modes, write gate and SESSION_SECRET gone.
- routes/auth.ts: signup (201), login (dummy scrypt verify for unknown email, identical 401), logout (204, idempotent), me (401 when signed out). @fastify/rate-limit scoped to signup/login, keyed by req.ip, errorResponseBuilder throws HttpError(429) so the error handler formats it.
- app.ts: order errorHandler, db, auth, coversPlugin, health, authRoutes, crates, albums, coverRoutes, web. `AppOptions.auth = { production?, rateLimit? }`.
- services/bootstrap.ts + server.ts: bootstrapAdmin / bootstrapFromEnv, awaited before listen. Smoke-tested: real server created the admin and login returned 200 with the cookie.
- test/helpers.ts: buildTestApp(opts), signUp, createAdmin, addCrate(app, name, sortOrder, ownerId = null), multipart.
- Deleted routes/session.ts and test/auth.test.ts. error-handler.ts needed no change.

## Gates
format:check 0, lint 0, typecheck 0, test 0 (api 110, web 102), build 0.

## Criteria self-check (tester decides)
AC1, AC5, AC6, AC7, AC8, AC9, AC17, AC18: checks pass locally.
AC12: partial by design. No matches in apps/api and session.ts is gone, but canLogIn remains in apps/web (App.vue, router.ts, stores/session.ts) and sessionInfo/loginInput in packages/shared. The spec leaves those to T5.

## Findings
See cycles/1/tasks/T2.json findings: web still calls /api/session until T5; logout with an empty JSON body returns 400; ADMIN_EMAIL colliding with an existing user is warned and skipped; a short ADMIN_PASSWORD crashes startup on purpose; docs/compose/.env.example still describe the old auth (not owned); the production-cookie test prints some log lines.
