# dev-T10: ADR 0006, spec, README, deployment docs and config

## What landed
- docs/adr/0006-following-home-and-demo-content.md (new).
- docs/adr/0005-user-profiles.md: one pointer line under the out-of-scope bullet; the rest is untouched.
- docs/SPEC.md: Follow, NewsItem, new columns, new endpoints, pages, crate view at /shelf.
- README.md: Pages table; "/" no longer implied to be the crate browser; API table and profile field
  note; Database section with a Demo content subsection; SEED_DEMO_DATA in the env table.
- .env.example: `SEED_DEMO_DATA=` with a comment, empty by default.
- compose.yaml: `SEED_DEMO_DATA: ${SEED_DEMO_DATA:-}` on the app service.
- docs/DEPLOY.md: note in the .env list, plus a short "Upgrading to following and the Home page".

## Where the merged code differs from the task text (docs follow the code)
- `SEED_DEMO_DATA=false` also exists and turns seeding off anywhere, including dev. The task only
  mentioned `true`. Values other than exactly `true`/`false` fall through to the default.
- Default is ON outside production, so `npm run dev` adds demo rows to whatever database it uses,
  including a developer's own data/crate.db. Flagged in the README and the ADR.
- The old README row said db:seed "Wipe the DB". It wipes crates, albums, tracks and covers, and keeps
  users, follows and news; it refuses production. Corrected.
- Extra behaviour recorded: a real account holding a demo username/email makes that demo user and its
  crates get skipped with a warning; a seed failure is logged and the API still starts; recommended
  leaves out ownerless crates; suggested collectors are demo users only; the seed writes no follows.

## Verification I ran
- format:check, lint, typecheck, test, build: all exit 0. API 360 tests (21 files), web 294 tests
  (31 files).
- No new tests: this task is docs and config only. The behaviour tests came with earlier tasks.
- `docker compose config` with placeholder values resolves SEED_DEMO_DATA to "" when unset and "true"
  when set. The image was not built and no container was run.
- Real `node src/server.ts` starts against temp DATA_DIRs (news / recommended / crates):
  - production, unset: 0/0/0
  - production, empty: 0/0/0
  - production, true: 9/7/9
  - production, unset again on that same DB: 9/7/9 (not removed)
  - dev, false: 0/0/0
  - dev, default: 9/7/9
  - after db:seed, flag false: 9/0/2 (news kept, demo crates gone)
  - after db:seed, next start: 9/7/11 (demo crates restored)
- data/ directory listing was identical before and after. Temp dirs were deleted.

## Doubts and shortcuts
- Not checked in a browser: Home's empty-state text is taken from reading HomeView.vue and from its
  tests. The API side of the empty state was checked above.
- "Removing a demo user by hand recreates it and leaves surviving demo crates ownerless" (ADR
  Consequences) comes from reading ensureUser/ensureCrate and the FK rule. I did not run it.
- Same for "demo crates get new ids after db:seed": it follows from delete and reinsert, and I did not
  compare ids.
- The Spec had no User entry in its data model. I added a one-line User row that points at ADR 0004/0005
  instead of documenting every column.
- The DEPLOY upgrade subsection goes slightly past "short note in the environment section". It follows
  the file's existing upgrade-note pattern and is the only place that tells existing deployments about
  the move to /shelf.
- Possible follow-up outside my files: NotFoundView still says "Back to the crates" and links to /shelf.
  That looks intended, so I left it and did not document it.

## Blockers
None.
