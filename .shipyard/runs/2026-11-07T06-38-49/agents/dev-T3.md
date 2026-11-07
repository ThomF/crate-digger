# DEV T3 report: rename product name in apps/web

Commit: 3d60338 `refactor(web): rename product name to Frisson` (33 files, 43/43 lines, all under apps/web, all in T3's owned list).

## Changes
- All `@crate-digger/shared` and `@crate-digger/shared/sorting` imports changed to `@frisson/...` (including one comment in src/utils/tracks.ts).
- apps/web/index.html: `<title>Frisson</title>`.
- App.vue header RouterLink text: `Frisson`.
- 7 document.title strings (CratesView, LoginView, AlbumView x2, AlbumEditorView, LibraryView, CrateView) changed to Frisson, separators and other text unchanged.
- No component, route or domain "crate" token changed. Every changed line differs only in the product name substring.

## Verification
- `npm run typecheck -w apps/web`: exit 0
- `npm test -w apps/web`: exit 0, 13 files, 102 tests passed
- `npm run build -w apps/web`: exit 0
- `npm run build` (root): exit 0 (at the time of running; apps/api was being edited in parallel)
- `npx eslint apps/web`: exit 0
- `grep -rIniE 'crate[-_ ]?digger|cratedigger' apps/web --exclude-dir=node_modules --exclude-dir=dist`: empty
- `grep -rn 'document.title' apps/web/src | grep -c Frisson`: 7

## Notes
- No tests asserted the old name, so no test logic changed; test files only had their import paths updated.
- Uncommitted apps/api changes in the worktree belong to the parallel dev and were not staged.
- Repo-wide AC1/AC2 depend on other tasks too (e.g. apps/api still had `crate_digger_session` at the time).
- No dependencies added. No blockers.
