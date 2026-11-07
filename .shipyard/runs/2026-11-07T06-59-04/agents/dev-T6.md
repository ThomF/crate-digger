# dev-T6

Task T6: web per-crate edit controls. Commit be8910a.

- Removed temporary `canEdit` from stores/session.ts; grep for session.canEdit / .canEdit is empty.
- Global actions (LibraryToolbar Edit crates / Add a record, EmptyShelf first crate) use `session.signedIn`.
- LibraryView: tools, add link, draggable, drop targets and Move-to options gated per crate with canEditCrate (source and target).
- CrateView: spin and "Add a record" link per crate; toolbar preselect only for editable crate.
- AlbumView: Edit button via the album's crate from the library store.
- CratesView: lists editable crates only; reorder buttons admin-only.
- AlbumEditorView: crate picker filtered; edit route redirects to album page if not editable.
- New apps/web/src/views/editControls.test.ts (8 tests; file not in owned list, flagged).

Web gates (typecheck, test 118, build, eslint, prettier) exit 0.
