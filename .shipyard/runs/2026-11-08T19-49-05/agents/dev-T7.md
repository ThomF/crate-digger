# dev-T7: Home and About views

Commit: 0326e4c `feat(web): add Home and About views`
Criteria served: AC4, AC5, AC6, AC8, AC9, AC11, AC20, AC24, AC25 (the view side of each only; routes and nav are T9, API is T3/T4/T5).

## What landed

- `apps/web/src/views/HomeView.vue`: two independent `useAsyncSection` sections, `section.news` and `section.recommended`, plus 'Browse all crates' outside both. Each section has loading (`.status-note`, `role="status"`), failure (`role="alert"` with 'Try again', which calls `load()`), and an empty state. No CrateBox, no library store.
- `apps/web/src/views/AboutView.vue`: static copy, no router dependency.
- `HomeView.test.ts` (20 tests) and `AboutView.test.ts` (5 tests).

## Verification I ran

- `npx vitest run` on the two test files: 25 passed.
- `npm run typecheck` in apps/web: exit 0.
- `prettier --check` and `eslint` on my 4 files: clean.
- Real browser, 320px wide, through a temporary Vite server in the scratchpad (not in the repo) that mounted the views with a stubbed fetch and a memory router, with deliberately long unbroken names:
  - `documentElement.scrollWidth` was 320 with innerWidth 320 for Home in the ok, error, empty and loading states, and for About.
  - `innerText` of the Recommended section had exactly one 'AI' in all four states.
  - 7 stub crates gave 7 cards; cards sat inside 16px to 304px.
  - I also looked at the error state at desktop width. No screenshot was taken of About.
- Not run: the full `npm test`, repo-wide lint or build, 390px and 1280px overflow measurements, or anything against the real API or the real App shell. The views are not reachable from a page until T9 adds routes, so AC4 (which includes the nav) still needs the real check.

## Behaviour choices beyond the task text

- Cards show `label ?? name` as the link text, and also the crate name on its own line when there is a label. The task says "label or name" but AC8 says the card shows "its name", and the demo labels ('DUB / AFTER DARK') are not the names. This follows ProfileView's existing pattern.
- Added a visually hidden `<h1 class="sr-only">Home</h1>`. The masthead sign is a link, so the page otherwise has no h1. Not asked for; easy to remove if a test counts headings.
- The owner is plain text, not a link to the profile, because the task's test router defines only home, crate and library.
- Dates use `en-US` and UTC ('Oct 27, 2026') so the text matches the `datetime` value for every visitor, rather than following the viewer's locale. No shared date helper exists; T8 may format differently, though its task text asks for no dates.
- The failure message is `errorMessage()` output, as in ProfileView. See the first doubt.

## Doubts and shortcuts

- AC9 depends on data I do not control. A server error message, a crate label or an owner name with upper-case 'AI' would add an occurrence. I grepped `apps/api/src/db/demo-content.ts`: no shown label, name, display name or username contains 'ai' in any case. User data only reaches this section if it is recommended, and only demo crates carry a rank as far as the demo content shows; I did not read T4's query.
- 'Try again' contains lower-case 'ai' by requirement. AC9 is case-sensitive only if read that way; the task text confirms this is intended.
- The ban on `text-transform` is tested by searching the SFC source (`?raw` import), since happy-dom does not apply scoped CSS. That covers this file only: a future global rule or T9's base.css change could still upper-case it. The browser `innerText` check is the real one and the tester should repeat it after T9. The same `?raw` approach backs the no-v-html, no-CrateBox and no-library-store tests.
- The `crate` and `library` route names do not point at their final targets until T9. The tests use the local memory router as instructed.
- API routes (`/news`, `/crates/recommended`) were uncommitted work by other devs while I worked, and were not exercised from these views.
- No dependencies added. No blockers.
