# Intake 1

Read apps/web/src/App.vue and App.test.ts. Current header: centered masthead, nav.user-menu with a.who, Edit profile link, Log out button, role=alert menu-error. Initials logic exists only in ProfileView.vue (computed `initials`); the brief requires the same logic in the header, so extract to apps/web/src/utils (e.g. initials.ts with a unit test) or duplicate; either passes. Route names: library, login, signup, profile, profile-edit. requiresAuth meta drives the logout redirect.

Needs from the owner: none blocking. AC10 and AC12/13 checks assume git is available in the repo; /home/claude/crate-digger reported "not a git repository" in the environment, so those checks may need adaptation (use a file hash or diff against a snapshot). Test names in AC1 to AC9 are binding: builder must create tests with those exact titles in App.test.ts and delete the obsolete ones.
