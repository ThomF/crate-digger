# Cycle 1 spec: header account menu

## What and why
Today the Frisson masthead is centered and the account controls (name link, Edit profile, Log out, or Log in / Sign up) sit as a centered text row under the tagline (App.vue `nav.user-menu`). The request moves account UI to the right of the masthead as a round avatar button that opens an accessible dropdown, matching common web conventions while keeping the 90s paper and marker look from docs/SPEC.md section 5. The sign and tagline stay exactly as they are (AC11). Everything stays in apps/web (AC13) with no new dependencies and no v-html (AC12).

## Design
- **utils/initials.ts**: one exported function with the ProfileView rule (displayName trimmed, else username; two words give first letters of the first two, otherwise first two chars; uppercase). The survey found the logic only lives inline in ProfileView, so extracting it guarantees "identical" initials. Unit tested.
- **components/profile/UserAvatar.vue**: round avatar; img when avatarUrl is set, initials span otherwise. Decorative inside the trigger (the button carries the name).
- **components/AccountMenu.vue**: wrapper `nav.user-menu` (aria-label Account) with `button.avatar-btn` (aria-haspopup=menu, aria-expanded, accessible name containing the display name). When open, a `role=menu` panel, right aligned, with a header (name, @username, VerifiedBadge for verified users) and three `role=menuitem` entries: View profile (/u/alice), Edit profile (/profile/edit), Log out (button). Closed by default via v-if. Closes on trigger toggle, Escape (focus returns to trigger), outside document click (contains check against the wrapper so the trigger click and header clicks do not close it), item choice, and route change (watch route.fullPath). Document listeners removed on unmount. No arrow key roving; Tab order is enough.
- **Log out** keeps the existing behaviour: session.logOut() (POST /api/auth/logout), close menu, redirect to library when the current route has meta.requiresAuth, role=alert message with errorMessage on failure.
- **App.vue**: `.masthead` gets position: relative; account area absolutely positioned with top and right; signed-out Log in / Sign up live in that area and stay hidden on their own pages. Horizontal padding is reserved around the sign so the control cannot overlap on narrow screens. Old centered `.user-menu` row styles are deleted (AC10). Styling uses base.css tokens only.
- **ProfileView** (T2) switches to the shared helper without changing its DOM.

## Tests (App.test.ts, exact titles, old tests removed)
- renders an avatar trigger with menu semantics (AC1)
- shows initials when there is no avatar; shows the avatar image when avatarUrl is set (AC2)
- opens a menu with header and three items (AC3)
- toggles the menu from the trigger (AC4)
- closes on Escape and refocuses the trigger (AC5)
- closes on outside click (AC6)
- closes after choosing a link; closes on route change (AC7)
- log out signs out and closes the menu; log out on an auth-required page redirects to the library; log out failure shows an alert (AC8; add a requiresAuth stub route in the test router)
- shows log in and sign up when signed out; hides the link for the current auth page (AC9)

Use attachTo: document.body where focus or document clicks matter (happy-dom risk).

## Tasks
T1 owns the helper, UserAvatar, AccountMenu, App.vue and App.test.ts and serves every criterion. T2 depends on T1 and only touches ProfileView.vue. No shared files.

## Gate notes
AC10's grep for `right:` looks at src/App.vue and top-level src/components/*.vue, which is why the menu lives at src/components/AccountMenu.vue (not a subfolder) and the absolute/right positioning sits in App.vue. AC12/AC13 rely on git; the target may lack a git repo, so the orchestrator may need to verify against the base commit snapshot.
