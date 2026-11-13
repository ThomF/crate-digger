# ADR 0008 — Public crate favorites

- **Status:** Accepted
- **Date:** 2026-11-13
- **Builds on:** [ADR 0005](0005-user-profiles.md), [ADR 0006](0006-following-home-and-demo-content.md)

## Context

Collectors want to keep track of other people's crates they like. Follows already connect people,
but they say nothing about a single crate, and follow lists are private.

## Decision

- **A `crate_favorites` table** (migration 0006) with `user_id`, `crate_id` and `created_at`, unique
  per pair. Both foreign keys cascade, so deleting a user or a crate removes its favorites.
- **Only `request.user` sets a favorite.** `PUT` and `DELETE /api/crates/:id/favorite` take no user
  from the body or path. Both are idempotent and return 204.
- **You cannot favorite your own crate** (400). Your crates already appear under Crates.
- **Favorites are public.** `GET /api/users/:username` returns them, newest first, to every viewer,
  and the profile page shows them in a Favorites section after Crates. This differs from follow
  lists, which stay private.
- **The owner is text.** Favorite cards name the owner but do not link to them, because the card is
  one stretched link and nested links are not allowed.

## Consequences

- Anyone can see what a user favorited. Users cannot hide a favorite short of removing it.
- A favorite of a crate whose owner is later removed disappears with the crate.
- Ownerless legacy crates can be favorited and show no owner line.
- Additive migration: older app versions simply ignore the table.
