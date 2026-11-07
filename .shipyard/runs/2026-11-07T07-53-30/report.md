# Report: Frisson 1.0 Phase 2 (profiles, avatars, social links, verified badge)

**Verdict: shipped.** All 22 acceptance criteria pass, the gates are green, and the end-to-end smoke from a base-commit database passes. Branch: `shipyard/profiles-social-links-2026-11-07T07-53-30`, base `8eaedeb`.

## What was asked
Frisson 1.0 Phase 2: user profiles with bio, location, avatar, up to 6 social links and an admin-only verified badge. API: public profile, self-edit, avatar upload/delete, admin verified toggle. Web: public profile page, edit profile page, header links, crate owner links. The owner asked for a direct merge and push to main. The harbormaster does that right after this report.

## Acceptance criteria
| AC | Summary | Status |
|---|---|---|
| AC1 | All repo gates green | pass |
| AC2 | Single additive migration 0004, no DROP/RENAME, drizzle-kit reports no changes | pass |
| AC3 | Data survives migration, empty profiles for existing users | pass |
| AC4 | Schema columns, user_links with ON DELETE CASCADE and index | pass |
| AC5 | Shared zod contracts and URL/limit rules | pass |
| AC6 | Public profile endpoint, no email/role leak, 404, case-insensitive | pass |
| AC7 | PATCH /api/me/profile, ordered links, atomic | pass |
| AC8 | No self-verify or role/email/username change | pass |
| AC9 | Admin-only verified endpoint | pass |
| AC10 | Avatar upload/replace/delete, 400x400 JPEG, limits | pass |
| AC11 | Covers approach reused, no new dependency, no path changes | pass |
| AC12 | /u/ serves the SPA, /avatars/missing is a JSON 404 | pass |
| AC13 | Private responses carry avatarUrl and verified; no owner email/role in crates | pass |
| AC14 | Phase 1 permission tests unchanged | pass |
| AC15 | Web routes and auth redirect | pass |
| AC16 | Profile page rendering, safe link attributes | pass |
| AC17 | Plain-text rendering, no v-html | pass |
| AC18 | Edit profile page, 7th link blocked, no verified control | pass |
| AC19 | Header links, badge, crate owner link | pass |
| AC20 | API client and session store refresh | pass |
| AC21 | Security hygiene | pass |
| AC22 | Docs, ADR 0005, backup/restore hints | pass |

## What was built (7 task commits)
- `7d81910` feat(shared,api): profile contracts, users/user_links schema and migration 0004 (T1)
- `5b8ba91` feat(web): profiles API client, session refresh, profile routes and verified badge (W1)
- `967d91e` feat(api): public profiles, self-edit and admin verified flag (T2)
- `d69b9e6` docs: user profiles, avatars backups and ADR 0005 (D1)
- `0341332` feat(web): edit profile page with links editor and avatar upload (W3)
- `e43bb6e` feat(web): public profile page, header profile links, crate owner link (W2)
- `10a7668` feat(api): avatar upload/delete, shared multipart registration and /avatars static (T3)

## Test results
Full chain `format:check && lint && typecheck && test && build` exited 0:
- api: Test Files 16 passed, Tests 222 passed
- web: Test Files 23 passed, Tests 167 passed
- vite build ok
- `npx drizzle-kit generate`: "No schema changes, nothing to migrate"
- Migration SQL: CREATE TABLE user_links, CREATE INDEX, 4x ALTER TABLE users ADD; zero DROP/RENAME; FK is ON DELETE cascade.
- No package.json or lockfile changes; no Dockerfile/compose changes.

**E2E smoke** (base `8eaedeb` seeded on a data dir, then the branch server in production mode on the same dir):
- 5 migrations applied; users have bio "", location null, avatar null, verified 0; sessions, crates and albums intact; the old session cookie still works.
- Public profile `/api/users/dee` returns the expected shape, with no email/role/password; `DEE` returns 200, unknown user 404.
- Profile PATCH ok; 7 links 400, http:// 400, `verified:true` 400, profile unchanged after rejects, signed out 401.
- Avatar: 640x480 PNG gave a 400x400 JPEG at `/avatars/2-f0cf654a.jpg`, served immutable; non-image 400; DELETE removed the file and the old URL 404s as JSON; `/avatars/missing.jpg` JSON 404; `/u/dee` serves HTML.
- Admin verified true/false 200; non-admin 403 (own username and others); signed out 401.
- Cover upload still works.

## What went wrong
Nothing blocking. No deaths, no fix rounds.
- W2 ran `prettier --write apps/web/src` across the web tree, which may have reformatted W3's in-progress files. It was formatting only, and the tree was clean after all commits.
- Tester flag 1: base signup returned 500 (ResponseSerializationError) during seeding because the symlinked node_modules made the base API load the branch's `@frisson/shared`. This was a harness artifact, not a branch defect. The user, session and crate were still created. Future base runs should use a separate `npm ci`.
- Tester flag 2: the literal credential grep on `git diff` hit 3 unchanged context lines (README SESSION_SECRET note, `'secret'` test mocks). Grep restricted to added/removed lines is empty.
- Tester flag 3: the 6-link limit is app-enforced (zod), not a DB CHECK. The criterion allowed either.

## Before you deploy
- Avatars live in `DATA_DIR/avatars`, inside the existing `/data` volume. No compose change is needed.
- Back up that folder alongside covers. DEPLOY.md and the backup/restore hints now mention it.
- Migration 0004 runs automatically on start. It is additive.

## Known limits
- The 6-link cap is app-enforced only.
- No avatar file cleanup if a user is ever deleted (account deletion is out of scope).
- The `owner_id` FK on crates still lacks ON DELETE SET NULL, carried over from Phase 1.

## Next
Phase 3: favorites and crate likes.
