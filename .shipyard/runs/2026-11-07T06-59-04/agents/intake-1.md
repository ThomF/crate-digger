# Intake notes (run 2026-11-07T06-59-04)

Read: auth plugin, session routes, app.ts, schema, db client, route list, web router/session store, compose/.env.example/DEPLOY.md, prior brief format.

Key findings
- Current auth has three modes (open/read-only/password). Open mode is relied on by existing tests; removing it forces a test rewrite via a sign-in helper. Brief assumes this.
- drizzle-kit may rebuild the crates table for owner_id; the data-survival test (AC3) is the guard. Backfill is done in app code at startup, not by editing the generated migration.
- Mutating routes beyond crates: albums (create/patch/delete/move/reorder/spin), PUT /crates/order, covers upload/delete. Ownership must be enforced on all.
- Rate limiting: @fastify/rate-limit is already a dependency; no new dependency needed.
- Judgement calls flagged for the owner: spin-count requires a session; signup returns 409 on duplicates; admin-less upgrade if ADMIN_EMAIL is missing; compose now requires ADMIN_EMAIL.
- AC2/AC16/AC17 reference "base"; the builder should substitute the branch's merge-base (git merge-base HEAD main).
