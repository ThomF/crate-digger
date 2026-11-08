# Spec: Home, Following, Profile and About

## What we are building

Frisson today is one screen. The 3D crate browser sits at `/`, and everything else hangs off it. This work turns it into a four-page app with a permanent masthead nav:

- **Home** (`/`) shows demo music news and recommended crates.
- **Following** (`/following`) shows the collectors you follow and a feed of their crates.
- **Profile** (`/profile`) shows your own profile.
- **About** (`/about`) explains the app.

It also adds a real follow system, stored in SQLite, that works with both invented and real collectors.

The crate browser is not removed. It moves to `/shelf`, and `/crates/:id` deep-links to a single crate on it. Neither is a fifth nav entry.

## The premise we are correcting

The request assumed that seed data arrives on init. It does not. Seeding only happens through the manual `npm run db:seed`, and that command wipes crates, albums, tracks and covers. The owner's database holds two ownerless crates, ten albums and one real non-admin account, and none of it may change.

So demo content needs its own delivery route. A separate, non-destructive step runs at API start from `server.ts`, next to `bootstrapFromEnv`. It stays out of `buildApp`, so `buildTestApp` keeps starting empty and the existing tests stay valid.

## Data model

Migration `0005_follows_news_demo` is generated and only adds to the schema:

- **`follows`** has a unique index on (follower, followee), cascades when a user is deleted, and refuses self-follows.
- **`news_items`** holds the demo news. It has its own `seed_key`.
- **`demo_seed_key`** is a new nullable, unique column on `users`, `crates` and `albums`.
- **`crates.recommended_rank`** is a new nullable column. It is the editorial flag behind the recommended list.

Stable keys are the core of the design. Rows are matched by key, inserted if missing, and never overwritten. That gives the behaviour the brief asks for:

- Restarts add nothing.
- A renamed demo crate keeps its new name and does not duplicate.
- Demo crates return after `db:seed`, because the keys are matched against rows that are now gone.
- A real account that already holds a demo username is left alone, along with its crates, because that account has no key. Those demo rows are skipped.

Tracks have no key. They are inserted only with a newly inserted album. A single deleted demo track therefore does not return, and we accept that to avoid a key column on the largest table.

The step runs in one transaction. A failure is logged and does not stop the server, since demo content should never take down someone's real collection.

## Demo content

`apps/api/src/db/demo-content.ts` is data only and opens with a comment saying it is fictional. Names need real care:

- Every person, artist, label, venue and publication has to be invented, and each is checked for clashes with real ones.
- Demo users are `demo-*`, use `.invalid` emails, are never verified or admin, and have no links.
- Demo users cannot log in, because their password hash is a sentinel that `verifyPassword` rejects.

One constraint is easy to miss. AC9 allows only one occurrence of "AI" in the Recommended section, and tape labels are upper case. A crate called "Train Songs" or a collector called "Blair" would break it. Demo crate and user names therefore avoid the letters "ai" in any case, and a test enforces this.

Delivery defaults to on outside production. In production it is off unless `SEED_DEMO_DATA=true`, and a production instance without it shows Home's empty states. We also honour an explicit `SEED_DEMO_DATA=false` everywhere. The brief did not ask for this, but it is one condition and gives a development instance a way out.

## API

All new endpoints sit behind the existing routes, services and shared-schema pattern. The new response shapes land in `packages/shared` first.

| Endpoint | Access | Returns |
| --- | --- | --- |
| `PUT`/`DELETE /api/users/:username/follow` | signed in | 204, idempotent |
| `GET /api/me/following` | signed in | `collectorSummary[]` |
| `GET /api/me/feed` | signed in | `crateCard[]`, newest first, limit 50 |
| `GET /api/me/suggested-collectors` | signed in | demo users you don't follow |
| `GET /api/news` | public | `newsItem[]`, newest first |
| `GET /api/crates/recommended` | public | `crateCard[]` in rank order |

`GET /api/me/suggested-collectors` is not named in the brief, but AC16 needs it because no user-listing endpoint exists.

`crateCard` is a new shape rather than a reuse of `crate`, because `crate` exposes numeric `ownerId` and the public-data rule forbids that here.

`publicProfile` gains `followerCount`, `followingCount`, `viewerFollows` and `isDemo`. The demo marker reaches the UI only as that boolean, so a real user who signs up as `demo-something` gets no Demo label. Self-follow returns 400 on `PUT`. `DELETE` on yourself is a harmless 204.

## Web

The nav uses `RouterLink`'s own `aria-current`, which is set on exact match only. That is what AC2 wants: none on `/u/x` or `/shelf`, and none on `/profile/edit`. Two details matter:

- The "Frisson" sign links to `/` and would otherwise carry a second `aria-current`, so it renders as a plain anchor.
- The masthead's side padding leaves only 168px at a 320px viewport, and the nav does not fit in that. The nav gets its own full-width row.

The route name `library` moves with the crate browser to `/shelf`. Most existing `{ name: 'library' }` links then follow automatically, and only the hard-coded `to="/"` links in `AlbumView` and `NotFoundView`, the logout redirect and the toolbar's active state need edits. Logout from an auth-only page now goes to `home`.

`CrateView` must not fall back to the first crate when given an id. The store's `selectedCrate` does that today, and it would show `/crates/999999` as a different crate. Tab clicks use `router.replace`, so Back returns to Home rather than walking through tabs.

Home and Following load each section independently through a small composable, so one failed request leaves the others working (AC25). Home deliberately avoids the library store, which loads every album. `/profile` is a thin wrapper around `ProfileView` using the session's username, so the URL and nav state stay put.

Follow buttons are not optimistic. They wait for the server, which keeps the failure case in AC17 simple and correct.

## Order of work

The schema comes first. Shared contracts and the profile shape follow, and the demo seeder runs alongside them. From there API and web run in parallel:

```
T1 schema ─┬─ T2 contracts ─┬─ T4 follows API ─┐
           │                │                  ├─ T5 news + recommended ─┐
           └─ T3 demo seed ─┼──────────────────┘                         │
                            └─ T6 web pieces ─┬─ T7 Home, About ─┐       ├─ T10 docs
                                              └─ T8 Following,   ├─ T9 ──┘
                                                 Profile ────────┘
```

- **`app.ts`** is touched by T4 and T5, so T5 waits for T4.
- **T2 updates existing test fixtures** because it makes profile fields required. This keeps the tree green rather than leaving breakage for later tasks.
- **The router comes after the views** (T9), so no task needs stub views and no file is shared across parallel tasks.
- **Docs come last** and cover ADR 0006, `docs/SPEC.md`, the README, `DEPLOY.md`, `.env.example` and `compose.yaml`. ADR 0005 gets a one-line pointer, because it lists follows and the feed as out of scope.

## Safety

Nothing in this work may write to the owner's `data/` folder. Tests use in-memory or temp databases. Any manual run sets `DATA_DIR` to a temp directory holding a copy of all three SQLite files, because recent data sits in the `-wal` file. `db:seed` is never run against the real folder.

## Out of scope

These are left out by the brief:

- A real recommendation model or personalisation
- Live news, outbound links or detail pages for news
- Per-album activity, notifications, likes or comments
- Follower and following lists for other users (counts only)
- Auto-following anyone
- A removal command for demo data, recorded as a known consequence in ADR 0006
- Changes to who owns crates 24 and 25
