# Surveyor 3 (relevant)
Map for header profile-button request. Details in survey-relevant.json.
- App.vue (124 lines): masthead is centered text; nav.user-menu L31-49 has name link + Edit profile link + Log out button; logOut L14-23; scoped styles L57-124.
- App.test.ts asserts on nav.user-menu, a.who, Edit profile link, first button 'Log out', badge inside a.who; these will need updating.
- Session store exposes user (avatarUrl, verified, displayName, username), loaded, logOut.
- No reusable avatar component or initials helper; ProfileView has local initials computed (L36-43) and avatar/placeholder markup + CSS. AvatarUpload has a separate single-letter initial.
- Routes: profile (/u/:username, public), profile-edit (/profile/edit, requiresAuth).
- No existing dropdown/click-outside/Escape pattern anywhere.
- Tokens in base.css L2-15; global focus-visible style.
