# Surveyor 1: structure and tests (Frisson)
- Root workspaces: packages/*, apps/*; dirs apps/api, apps/web, packages/shared.
- Web: Vue 3 + Pinia + vue-router; src has App.vue, router.ts, main.ts, components/{album,forms,profile,crate}, views, stores (session, library), api, composables, utils, forms, styles/base.css (single file).
- Tests: vitest run with happy-dom set in apps/web/vite.config.ts; no setup file or separate config; tests colocated.
- App.test.ts: createPinia + memory-history router with Blank routes, mount with plugins [pinia, router], fetch stubbed globally.
- router.test.ts: real router, fresh pinia per test, api/auth.ts mocked.
- Root commands: npm test, npm run typecheck, npm run lint, npm run format:check, npm run build; web only: npm run test -w apps/web.
