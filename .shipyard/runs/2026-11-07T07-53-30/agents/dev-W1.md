# dev-W1

Task W1: web profiles API client, session refresh and save wrappers, profile routes, placeholder views, VerifiedBadge. Commit 5b8ba91.

- `api/profiles.ts` (PUBLIC): getProfile (encodeURIComponent), updateProfile PATCH /me/profile, uploadAvatar POST /me/avatar FormData `avatar`, removeAvatar DELETE, setVerified PATCH /users/:username/verified. Returns PublicProfile.
- Session store: `refresh()`, `saveProfile`, `saveAvatar`, `deleteAvatar` (API then refresh; return profile). Existing behaviour unchanged.
- Router: `/u/:username` (profile, public, props username) and `/profile/edit` (profile-edit, requiresAuth) before the catch-all.
- Tests: session refresh describe (5), router.test.ts (3), VerifiedBadge.test.ts (1). Web gates green (127 tests). No new dependencies.
