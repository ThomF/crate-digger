# dev-T5

Task T5: web accounts core. Commit 9b5474f.

- Replaced api/session.ts with api/auth.ts (me/signUp/logIn/logOut; me maps 401 to null; logout sent without body).
- stores/session.ts: user, loaded, signedIn, isAdmin, load, logIn(email, password), signUp, logOut; temporary canEdit = signedIn for T6.
- utils/permissions.ts canEditCrate plus the 5 named tests; session.test.ts with the named AC14 test plus 2 extras.
- LoginView (email + password, link to signup), new SignupView (zod safeParse client check, per-field 400 issues, 409 message).
- router: /signup route, requiresAuth meta, guard loads session and redirects to login?next=.
- App.vue: masthead user menu (Log in / Sign up, or name + Log out); footer staff link removed.
- shared: removed sessionInfo, loginInput, SessionInfo.

Gates (web typecheck/test/build, eslint, prettier, all-workspace typecheck) exit 0. AC15 view wiring is T6.
