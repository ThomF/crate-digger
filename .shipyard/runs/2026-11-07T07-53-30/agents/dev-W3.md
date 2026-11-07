# dev-W3

Task W3: edit profile page. Commit 0341332.

- `views/EditProfileView.vue`: loads via getProfile(session.user.username); displayName (60), bio (500, live n/500), location (80); saves exactly { displayName, bio, location|null, links } through session.saveProfile; shows API message plus per-field issues; links to /u/<username> after save. No v-html, no forbidden word, no extra controls.
- `components/profile/LinksEditor.vue`: v-model ProfileLinkInput[]; add/remove/move up/down; platform select from SOCIAL_PLATFORMS; type=url; add disabled and refused at 6.
- `components/profile/AvatarUpload.vue`: accept jpeg/png/webp, client size check vs MAX_AVATAR_BYTES ('5 MB' hint), object URL preview, Remove; calls session.saveAvatar/deleteAvatar immediately.
- Tests: EditProfileView.test.ts (10), LinksEditor.test.ts (7). Web gates green (167). No new dependencies.
