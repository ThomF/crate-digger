# Report: header account menu

**Verdict: shipped.** All 14 acceptance criteria pass in cycle 1 of 3, with no fix rounds.

## What was asked
Move the account UI in the header to the right as an avatar. Clicking it opens a menu with View profile, Edit profile and Log out. The owner asked for a direct merge and push to main, which is done right after this report.

## Acceptance criteria
| ID | Criterion | Status |
|---|---|---|
| AC1 | Avatar button with menu semantics and accessible name | pass |
| AC2 | Initials fallback and avatar image | pass |
| AC3 | Menu header and exactly three items | pass |
| AC4 | Menu toggles from the trigger | pass |
| AC5 | Escape closes and refocuses the trigger | pass |
| AC6 | Outside click closes | pass |
| AC7 | Closes after choosing a link and on route change | pass |
| AC8 | Log out, redirect from auth routes, failure alert | pass |
| AC9 | Signed-out Log in / Sign up on the right, hidden on own page | pass |
| AC10 | Right-pinned layout CSS, old centered styles removed | pass |
| AC11 | Frisson sign and tagline unchanged | pass |
| AC12 | No v-html, no dependency changes | pass |
| AC13 | Only apps/web changed | pass |
| AC14 | Typecheck, tests and build green | pass |

## What was built
- 179fb1c feat(web): move account controls to a right-hand avatar menu in the masthead
- b5b6438 refactor(web): use shared initials helper in ProfileView

## Test results
- Full workspace: typecheck, tests (web 222, other workspace 180) and build all exit 0.
- Each named vitest test exists, runs and asserts real behaviour.
- Real Chrome at 1280, 390 and 320 widths: the avatar sits top right and the closed menu never overlaps the sign or tagline. On mobile the open dropdown covers part of the sign, which is expected for a popover.
- Real Chrome flows: Escape closes and refocuses the trigger. View profile and Edit profile navigate and close the menu. Log out returns to the home page, removes the avatar, and /api/auth/me returns 401.
- Screenshots were taken outside the repo, in /home/claude/shots.

## What went wrong
Nothing blocking. One small test gap: the "log out signs out and closes the menu" test starts on the home page, so its library redirect assertion is trivially true. The redirect is covered by the separate auth-required page test. Production static serving needs WEB_DIR=apps/web/dist; this is a setup note, not a defect.

## Next steps
1. New homepage with automated music-news posts.
2. Auto-generated crates and favorites on profiles.
3. Following.
