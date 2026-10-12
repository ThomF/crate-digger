# Crate Digger — Spec

A self-hosted music collection tracker. Your albums live as vinyl sleeves in 90s-style
record crates: flip through them, pull one out, and it opens to show the record and its
tracklist. Everything is added manually — no external music APIs required.

## 1. Stack

| Layer      | Choice                                                             | Why                                                                                         |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Frontend   | Vue 3 + Vite + TypeScript, Pinia, Vue Router                       | Standard modern Vue setup, heavily documented                                               |
| Backend    | Node + TypeScript + Fastify                                        | Same language as the frontend; routes, validation and plugins are explicit and easy to read |
| Validation | Zod, in a shared package                                           | One schema validates the server and types the frontend                                      |
| Database   | SQLite + Drizzle ORM                                               | No DB server, one backup-able file; Drizzle reads like SQL, so you learn SQL too            |
| Images     | Cover uploads saved to disk (`/data/covers`), resized with `sharp` | Real file uploads without needing S3                                                        |
| Tests      | Vitest (both apps), Playwright (one end-to-end test later)         |                                                                                             |
| Hosting    | Docker Compose + Caddy on a VPS or home server                     | One-command deploy, automatic HTTPS                                                         |

See [ADR 0001](adr/0001-stack.md) for the reasoning.

## 2. Repo structure (npm workspaces monorepo)

```
crate-digger/
├── apps/
│   ├── web/                    # Vue frontend
│   │   ├── src/
│   │   │   ├── api/            # typed fetch client (albums.ts, crates.ts)
│   │   │   ├── components/
│   │   │   │   ├── crate/      # CrateBox.vue, RecordSleeve.vue, CrateDivider.vue
│   │   │   │   ├── album/      # AlbumDetail.vue, VinylDisc.vue, Tracklist.vue
│   │   │   │   └── forms/      # AlbumForm.vue, TrackEditor.vue, CoverUpload.vue
│   │   │   ├── composables/    # useCrateFlip.ts, useKeyboardNav.ts
│   │   │   ├── stores/         # Pinia: albums.ts, crates.ts
│   │   │   ├── views/          # CrateView, AlbumView, AddAlbumView
│   │   │   ├── styles/         # tokens.css, textures, 90s fonts
│   │   │   └── router.ts
│   │   └── vite.config.ts      # proxies /api → backend in dev
│   └── api/                    # Fastify backend
│       ├── src/
│       │   ├── db/             # schema.ts (Drizzle), migrations/, seed.ts
│       │   ├── routes/         # albums.ts, tracks.ts, crates.ts, covers.ts
│       │   ├── services/       # business logic, kept separate from HTTP
│       │   ├── plugins/        # db, static files, error handler
│       │   ├── app.ts          # builds the Fastify instance (used by tests)
│       │   └── server.ts       # starts listening
│       └── test/
├── packages/
│   └── shared/                 # Zod schemas + TS types used by both apps (added in M2)
├── docker/                     # Dockerfile, Caddyfile
├── docker-compose.yml
├── .github/
│   ├── workflows/ci.yml        # lint, typecheck, test, build on every PR
│   └── pull_request_template.md
└── docs/                       # this spec, ADRs, deploy notes
```

The key backend pattern: **`routes/` handle HTTP, `services/` hold logic.** Routes stay thin;
services are testable on their own.

## 3. Data model

```
Crate   id, name, color, label (handwritten-style text), sortOrder
Album   id, crateId, title, artist, year, genre, format (LP/EP/7"),
        coverPath?, sleeveColor (fallback when no cover), rating 0–5,
        notes, position (order in crate), createdAt, updatedAt
Track   id, albumId, side ('A'|'B'|'C'|'D'), position, title, durationSec?
```

Albums without cover art get a generated plain sleeve with a typed label.

## 4. API (REST, JSON)

```
GET    /api/health
GET    /api/crates                    list crates with album counts
POST   /api/crates                    PATCH/DELETE /api/crates/:id
GET    /api/crates/:id/albums         albums in crate order
GET    /api/albums?q=&genre=&sort=    search/filter across all crates
GET    /api/albums/:id                album + tracks
POST   /api/albums                    PATCH/DELETE /api/albums/:id
PUT    /api/albums/:id/tracks         replace the whole tracklist
PATCH  /api/albums/:id/position       move within or between crates
POST   /api/albums/:id/cover          multipart upload → resized jpg
GET    /covers/:file                  static
```

## 5. UI / UX

- **Crate view:** a wood/cardboard box in CSS 3D (`perspective`, `rotateX`). Sleeves stand
  upright showing only the top edge and spine. Scroll wheel, arrow keys or drag flips the
  front sleeve forward to reveal the next. Lettered dividers (A–Z or genre) poke up between
  sections.
- **Pull out:** clicking a sleeve lifts it out of the crate (FLIP animation via Vue
  `<Transition>`) and centers it.
- **Album view:** the sleeve slides aside, the vinyl rolls out and spins slowly with a
  printed center label. The back of the sleeve shows the tracklist by side, plus year,
  genre, rating stars and handwritten notes.
- **Add/edit:** a form styled like a record-store index card, with cover upload and
  drag-to-reorder tracks.
- **90s feel:** paper/cardboard textures, price-tag stickers (rating), marker-style labels,
  a light grain overlay, a pixel or typewriter display font.
- **Accessibility:** full keyboard navigation, `prefers-reduced-motion` respected, real
  buttons behind the 3D effects.

## 6. Milestones (one PR to `main` each)

| #   | Branch                | Delivers                                                                              |
| --- | --------------------- | ------------------------------------------------------------------------------------- |
| 0   | `chore/scaffold`      | Monorepo, Vite + Fastify hello world, `/api/health`, ESLint/Prettier, CI, PR template |
| 1   | `feat/db-schema`      | Drizzle schema, migrations, seed data (~10 albums)                                    |
| 2   | `feat/albums-api`     | `packages/shared`, CRUD routes, services, Zod validation, API tests                   |
| 3   | `feat/album-list-ui`  | Router + Pinia; plain list + detail view wired to the API                             |
| 4   | `feat/add-album-form` | Create/edit form, tracklist editor                                                    |
| 5   | `feat/crate-view`     | 3D crate, flipping, keyboard nav                                                      |
| 6   | `feat/album-pullout`  | Pull-out animation, vinyl, tracklist on the sleeve back                               |
| 7   | `feat/covers`         | Cover upload + resize, generated fallback sleeves                                     |
| 8   | `feat/crates-sorting` | Multiple crates, dividers, drag between crates, search                                |
| 9   | `chore/docker-deploy` | Dockerfile, Compose, Caddy, deploy docs                                               |
| 10  | `feat/polish`         | Textures, optional crackle sounds, Playwright e2e                                     |

Data flows end to end first (M1–M4), visuals second, so every PR leaves a working app.

## 7. Git workflow

- `main` is protected: PRs only, CI must pass.
- Branches: `feat/…`, `fix/…`, `chore/…`. Commits follow Conventional Commits
  (`feat(api): add album routes`).
- Squash-merge, so `main` reads as one commit per milestone.
- Significant decisions get a short note in `docs/adr/`.

## 8. Self-hosting (later)

One container serves the API and the built Vue files, behind Caddy. A `./data` volume holds
`crate.db` and `covers/` — back up that folder and you've backed up everything. Host on a
~$5/month VPS (Hetzner, DigitalOcean) or at home behind a Cloudflare Tunnel. For showing
off: a read-only public mode plus a simple admin login for editing.
