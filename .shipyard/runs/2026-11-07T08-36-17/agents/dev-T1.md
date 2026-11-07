# dev T1

Implemented the header account menu. Commit 179fb1c on shipyard/header-user-menu-2026-11-07T08-36-17.

- utils/initials.ts (+ 4 unit tests): ProfileView rule extracted verbatim.
- components/profile/UserAvatar.vue: round img (alt "") or aria-hidden initials span on cardboard.
- components/AccountMenu.vue: nav.user-menu, button.avatar-btn with aria-haspopup/expanded/controls and label "Account menu for <name>"; v-if role=menu paper panel (2px ink border, cardboard-dark offset shadow, right aligned, overflow-wrap) with name/@username/VerifiedBadge header and three menuitems. Closes on toggle, Escape (refocus trigger), outside click (contains check), item click, route.fullPath watch. Log out logic moved here from App.vue.
- App.vue: sign and tagline unchanged; masthead relative; .account absolute top/right; signed-out Log in / Sign up there, hidden on own pages; old centered .user-menu styles removed.
- App.test.ts: 14 tests with the brief's exact titles, attachTo body, unmount after each.

All five gates passed. Not checked visually in a browser.
