# dev-W2

Task W2: public profile page, header profile links, crate owner link. Commit e43bb6e.

- `views/ProfileView.vue`: getProfile(username) with watch immediate; loading / not-found ("Profile not found.") / error (Try again) / ready. Avatar or initials placeholder, displayName + VerifiedBadge when verified, @username, location, bio (pre-line), links (`target=_blank rel="noopener noreferrer"`, platform label + url text), crates (swatch, label ?? name, name sub, record count). Owner sees Edit profile (route name `profile-edit`). Text only via `{{ }}`.
- `App.vue`: `a.who` RouterLink to `/u/<username>` with badge, Edit profile link, Log out kept.
- `components/crate/OwnerLink.vue` used in CrateView under the tabs; nothing for null owners.
- Tests: ProfileView.test.ts (14, incl. "plain text"), App.test.ts (5), ownerLink.test.ts (4). Web gates green, 167 tests. No v-html, no new deps.
- Note: ran `prettier --write apps/web/src` once, which may have reformatted W3's in-progress files (formatting only).
