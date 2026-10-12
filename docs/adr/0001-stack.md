# ADR 0001 — Stack choice

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

Crate Digger is a learning project as much as a product. The frontend is fixed as Vue. The
backend should be easy to follow, cheap to self-host, and teach transferable patterns.

## Decision

- **TypeScript everywhere** (Vue 3 + Vite frontend, Node + Fastify backend), one language to learn.
- **Fastify** over Express: built-in schema validation, a plugin system that makes app
  structure explicit, first-class TypeScript, and `app.inject()` for testing without a network.
- **SQLite + Drizzle**: a single-file database needs no server and is trivially backed up.
  Drizzle's query builder mirrors SQL, so the SQL knowledge transfers.
- **npm workspaces monorepo**: frontend, backend and shared types in one repo, one PR per feature.

## Alternatives considered

- **Python + FastAPI + SQLModel**: equally good to learn, but means two languages.
- **Postgres**: more "production", but needs a running server; overkill for one user's collection.
- **Prisma**: friendlier at first, but hides SQL behind its own schema language.

## Consequences

SQLite handles one writer at a time — fine for a personal collection. Moving to Postgres later
is mostly a Drizzle driver swap.
