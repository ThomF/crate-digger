# tester-1 notes (cycle 1)

Verdict: all AC1..AC14 pass, no defects.

- Full test command exit 0 (web 222 tests, other workspace 180 tests, vite build ok).
- Each named vitest test exists, runs (1 passed, 13 skipped) and asserts real behaviour. Small gap: 'log out signs out and closes the menu' starts on '/', so its library redirect assertion is trivially true; the redirect is covered by 'log out on an auth-required page redirects to the library'.
- initials.ts matches the baseline ProfileView initials logic exactly.
- Server note: production static serving needs WEB_DIR=apps/web/dist; without it '/' is a 404. Not a defect, just setup.
- Real Chrome (playwright, /usr/bin/google-chrome) against the production server on localhost:3917:
  - Avatar sits top right at 1280, 390, 320 widths. Signed out Log in / Sign up top right; on /login only Sign up shows.
  - Closed menu never overlaps sign or tagline (box checks at 390 and 320). The open dropdown overlays part of the sign on mobile, which is expected for a popover.
  - Escape closes and refocuses the trigger; tagline click closes.
  - View profile -> /u/admin, Edit profile -> /profile/edit, menu closes each time. Log out from /profile/edit -> '/', avatar gone, /api/auth/me 401.
- Screenshots: /home/claude/shots/header-signed-out-desktop.png, header-signed-in-desktop.png, header-menu-open-desktop.png, header-menu-open-mobile.png.
- Server killed; temp data in /tmp/cd-tester. No tracked files touched.
