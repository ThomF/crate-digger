# ADR 0002 — Run TypeScript natively; share schemas as source

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Milestone 2 adds `packages/shared` (Zod schemas used by both the API and the web app).
Until now the API was compiled with `tsc` into `dist/`. Compiled JS importing a TypeScript
workspace package needs either a build step for the shared package or a bundler for the API,
both of which add moving parts to learn and to break.

Node 22.18+ runs `.ts` files directly by stripping type annotations ("type stripping").

## Decision

- The API runs its TypeScript source directly: `node src/server.ts` (and `node --watch` in dev).
  There is no API build step; `tsc` is only used to typecheck.
- `packages/shared` exports its `src/index.ts` directly. Node, Vite and Vitest all load it as-is.
- Relative imports use the real `.ts` extension (`import { x } from './app.ts'`).
- `tsconfig.base.json` enables `verbatimModuleSyntax` and `erasableSyntaxOnly`, so the compiler
  rejects anything Node can't strip (e.g. `enum`, constructor parameter properties) and forces
  type-only imports to be written `import type`.

## Consequences

- One fewer build step; dev, tests and production run the same files.
- Requires Node ≥ 22.18 (set in `engines` and `.nvmrc`).
- No `enum`s or `namespace`s — use `as const` arrays and unions instead (we already do).
- Type stripping doesn't work for `.ts` files inside `node_modules`. Workspace packages are fine
  because Node resolves their symlinks to `packages/…`, but a published package would need a build.
