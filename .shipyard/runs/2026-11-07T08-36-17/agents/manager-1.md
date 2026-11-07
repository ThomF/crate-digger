# Manager 1

Plan: two tasks. T1 (header menu, shared avatar + initials helper, App.vue, AccountMenu.vue, App.test.ts rewrite) serves AC1..AC14. T2 (ProfileView adopts initials helper, DOM unchanged) depends on T1.

Decisions:
- Component named src/components/AccountMenu.vue (top level) because AC10's checks grep src/components/*.vue and name AccountMenu.vue explicitly; the request's suggested UserMenu name was not used for that reason.
- position: relative and the absolute/right rule for the account area live in App.vue so AC10 passes on App.vue alone.
- Signed-out links stay in App.vue inside the same right-hand area.
- ProfileView.test.ts is not owned and should pass untouched.
Risk: intake flagged that AC12/AC13 checks need git; environment reported no git repo.
