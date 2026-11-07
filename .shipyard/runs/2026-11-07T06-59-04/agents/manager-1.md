# manager-1 notes (cycle 1)

Planned 7 tasks: T1 foundation (shared contract, schema, 0003 migration, passwords, migration test), T2 API auth core (users/sessions/permissions/bootstrap services, auth plugin rewrite, /api/auth routes, helpers.ts, auth-accounts + bootstrap tests, delete session.ts and auth.test.ts), T3 crate ownership (+ crates.test.ts rewrite, starts ownership.test.ts), T4 album/cover ownership (+ albums/covers tests, finishes ownership.test.ts), T5 web core (api/auth, store, permissions, Login/Signup, router, App header, removes old shared session schemas), T6 web per-crate controls (removes temporary canEdit alias), T7 docs/compose/.env/CI.

Graph: T1 -> T2 -> {T3 -> T4, T5 -> T6, T7}. Verified by script that no unordered pair shares a file and AC1..AC18 are all covered.

Judgement calls:
- The login schema is named credentialsInput because AC12's grep bans `loginInput` while AC13 accepts any of signupInput/loginInput/publicUser.
- Shared crate gets the owner fields in T1 (and the services/crates.ts select), so web T5/T6 can run in parallel with T3 without touching shared.
- Writes are deliberately unguarded between T2 and T3/T4, so old tests stay green, and each ownership task rewrites its own tests.
- A possible drizzle-kit table rebuild for crates.owner_id is handled in createDb (FK off around migrate + foreign_key_check), not in the SQL.
- AC12's banned identifiers (adminPassword, canLogIn, checkPassword) are called out in T2. Bootstrap reads env through bootstrapFromEnv, called from server.ts.
- T2 lists error-handler.ts in case the rate-limit 429 needs mapping through HttpError.
