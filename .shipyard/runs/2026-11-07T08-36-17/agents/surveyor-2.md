# Surveyor 2: conventions and docs (Frisson web)
- SFC order: script setup ts, template, style scoped. Only EmptyShelf and NotFoundView lack styles.
- Tokens only in base.css :root (9 colours, 2 fonts); Courier New display, system-ui body; no webfonts. 25 raw hex literals in .vue.
- Global :focus-visible is 3px marker-red outline, offset 2px; a few component overrides.
- .btn is global; header links are ink-soft, Log out is a button styled as a link.
- Header: App.vue masthead + nav.user-menu (tests select by class). Crates/List nav lives in LibraryToolbar, inside views.
- Prettier: no semi, single quotes, width 100. ESLint flat, vue essential, formatting delegated to Prettier.
- Docs: nothing on header or nav. SPEC section 5 has the 90s style description; SPEC mentions tokens.css and textures that do not exist.
