# dev T2

Commit b5b6438 on shipyard/header-user-menu-2026-11-07T08-36-17.

- ProfileView.vue: the inline initials logic now calls initials() from utils/initials.ts (imported as initialsFor). Markup, classes, alt text and styles unchanged; UserAvatar not used, to keep the DOM identical.
- No new tests. T1's initials.test.ts covers the helper and the existing ProfileView.test.ts (14) passes untouched.

All five gates passed (web 180 tests, api 222). No v-html, no dependency changes.
