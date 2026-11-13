<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { PublicProfile, ProfileLink } from '@frisson/shared'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { getProfile } from '../api/profiles.ts'
import { useSessionStore } from '../stores/session.ts'
import DemoTag from '../components/DemoTag.vue'
import FollowButton from '../components/profile/FollowButton.vue'
import VerifiedBadge from '../components/profile/VerifiedBadge.vue'
import { initials as initialsFor } from '../utils/initials.ts'

// Data classification: PUBLIC. A profile is shown to anyone. Every piece of it is user
// typed text, so it is rendered with {{ }} only (escaped by Vue), never as HTML.

const props = defineProps<{ username: string }>()

const profile = ref<PublicProfile | null>(null)
const status = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const error = ref<string | null>(null)

const session = useSessionStore()
const isOwner = computed(
  () => profile.value !== null && session.user?.username === profile.value.username,
)

/** Only called after the server has agreed, so the count moves by exactly one per real change. */
function onFollowChanged(following: boolean) {
  const current = profile.value
  if (!current || current.viewerFollows === following) return
  current.viewerFollows = following
  current.followerCount += following ? 1 : -1
}

const PLATFORM_LABELS: Record<ProfileLink['platform'], string> = {
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  spotify: 'Spotify',
  bandcamp: 'Bandcamp',
  discogs: 'Discogs',
  website: 'Website',
}

/** Avatar placeholder letters, shared with the header avatar via utils/initials.ts. */
const initials = computed(() =>
  profile.value ? initialsFor(profile.value.displayName, profile.value.username) : '',
)

/** The link's accessible name: its two lines of text, spelled out so they read as two. */
const crateLinkName = (crate: { name: string; label: string | null }) =>
  crate.label ? `${crate.label}: ${crate.name}` : crate.name

const albumCount = (n: number) => (n === 1 ? '1 record' : `${n} records`)

async function load(username: string) {
  status.value = 'loading'
  profile.value = null
  error.value = null
  try {
    profile.value = await getProfile(username)
    status.value = 'ready'
    document.title = `${profile.value.displayName} · Frisson`
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      status.value = 'not-found'
    } else {
      error.value = errorMessage(err)
      status.value = 'error'
    }
  }
}

// `immediate` loads now; the watch reloads when you go from one profile to another.
watch(() => props.username, load, { immediate: true })
</script>

<template>
  <p v-if="status === 'loading'" class="status-note">Looking up the collector…</p>

  <p v-else-if="status === 'not-found'" class="status-note">Profile not found.</p>

  <p v-else-if="status === 'error'" class="status-note is-error" role="alert">
    {{ error }}
    <button type="button" class="btn" @click="load(username)">Try again</button>
  </p>

  <article v-else-if="profile" class="profile">
    <header class="card">
      <img
        v-if="profile.avatarUrl"
        class="avatar"
        :src="profile.avatarUrl"
        :alt="profile.displayName"
      />
      <span v-else class="avatar placeholder" aria-hidden="true">{{ initials }}</span>

      <div class="who">
        <h1>
          {{ profile.displayName }}
          <VerifiedBadge v-if="profile.verified" />
          <DemoTag v-if="profile.isDemo" />
        </h1>
        <p class="handle">@{{ profile.username }}</p>
        <p v-if="profile.location" class="location">{{ profile.location }}</p>
        <p class="counts">
          <span class="count-item">
            <strong class="follower-count">{{ profile.followerCount }}</strong>
            {{ profile.followerCount === 1 ? 'follower' : 'followers' }}
          </span>
          {{ ' ' }}
          <span class="count-item">
            <strong class="following-count">{{ profile.followingCount }}</strong> following
          </span>
        </p>
        <RouterLink v-if="isOwner" :to="{ name: 'profile-edit' }" class="btn">
          Edit profile
        </RouterLink>
        <!-- Decided from session.user, so logging out during the visit swaps the control. -->
        <div v-else class="follow-control">
          <FollowButton
            v-if="session.user"
            :username="profile.username"
            :following="profile.viewerFollows"
            @changed="onFollowChanged"
          />
          <RouterLink
            v-else
            :to="{ name: 'login', query: { next: `/u/${profile.username}` } }"
            class="login-to-follow"
          >
            Log in to follow
          </RouterLink>
        </div>
      </div>
    </header>

    <p v-if="profile.bio" class="bio">{{ profile.bio }}</p>

    <section v-if="profile.links.length" class="links">
      <h2>Find them on</h2>
      <ul>
        <li v-for="link in profile.links" :key="link.url">
          <span class="platform">{{ PLATFORM_LABELS[link.platform] }}</span>
          <a :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.url }}</a>
        </li>
      </ul>
    </section>

    <section class="crates">
      <h2>Crates</h2>
      <ul v-if="profile.crates.length">
        <li v-for="crate in profile.crates" :key="crate.id" class="crate">
          <span class="swatch" :style="{ background: crate.color }" aria-hidden="true"></span>
          <RouterLink
            :to="{ name: 'crate', params: { id: crate.id } }"
            class="crate-link"
            :aria-label="crateLinkName(crate)"
          >
            <span class="name">{{ crate.label ?? crate.name }}</span>
            <span v-if="crate.label" class="sub">{{ crate.name }}</span>
          </RouterLink>
          <span class="count">{{ albumCount(crate.albumCount) }}</span>
        </li>
      </ul>
      <p v-else class="status-note">No crates yet.</p>
    </section>

    <section class="favorites">
      <h2>Favorites</h2>
      <ul v-if="profile.favorites.length">
        <li v-for="fav in profile.favorites" :key="fav.id" class="crate">
          <span class="swatch" :style="{ background: fav.color }" aria-hidden="true"></span>
          <RouterLink
            :to="{ name: 'crate', params: { id: fav.id } }"
            class="crate-link"
            :aria-label="crateLinkName(fav)"
          >
            <span class="name">{{ fav.label ?? fav.name }}</span>
            <span v-if="fav.label" class="sub">{{ fav.name }}</span>
          </RouterLink>
          <!-- Plain text on purpose: the stretched link covers the card, so a link here is unreachable. -->
          <span v-if="fav.ownerDisplayName" class="owner">by {{ fav.ownerDisplayName }}</span>
          <span class="count">{{ albumCount(fav.albumCount) }}</span>
        </li>
      </ul>
      <p v-else class="status-note">No favorites yet.</p>
    </section>
  </article>
</template>

<style scoped>
.profile {
  display: grid;
  gap: 1.5rem;
}

.card {
  display: flex;
  gap: 1.25rem;
  align-items: center;
  flex-wrap: wrap;
  padding: 1rem;
  background: var(--paper);
  border: 2px solid var(--ink);
  box-shadow: 4px 4px 0 var(--cardboard-dark);
}

.avatar {
  width: 6rem;
  height: 6rem;
  object-fit: cover;
  border: 2px solid var(--ink);
  flex: none;
}

.placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--cardboard);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: bold;
}

.who {
  min-width: 0;
  max-width: 100%;
}

.who h1 {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-display);
  font-size: 1.75rem;
}

.handle,
.location {
  margin: 0.15rem 0 0;
  font-family: var(--font-display);
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}

.who .btn {
  margin-top: 0.6rem;
}

.counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 1rem;
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
}

.follow-control {
  margin-top: 0.6rem;
}

.login-to-follow {
  font-family: var(--font-display);
}

.bio {
  margin: 0;
  white-space: pre-line; /* keep the line breaks the user typed */
  overflow-wrap: anywhere;
}

h2 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-bottom: 3px double var(--cardboard-dark);
  margin: 0 0 0.5rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.links li {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.platform {
  font-family: var(--font-display);
  font-weight: bold;
  min-width: 7rem;
}

.links a {
  overflow-wrap: anywhere;
}

.crate {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  padding: 0.4rem 0.6rem;
  background: var(--paper-dark);
  border: 1px solid var(--cardboard-dark);
}

/* A stretched link: the ::after covers the whole card, so a click anywhere opens the crate and
   there is still only one link, with nothing interactive nested in it. */
.crate {
  position: relative;
  cursor: pointer;
}

.crate:hover {
  background: var(--paper);
}

.crate-link {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: baseline;
  min-width: 0;
  text-decoration: none;
}

.crate:hover .crate-link {
  text-decoration: underline;
}

.crate-link::after {
  content: '';
  position: absolute;
  inset: 0;
}

/* The focus ring goes around the card the link covers, not just its text. */
.crate-link:focus-visible {
  outline: none;
}

.crate-link:focus-visible::after {
  outline: 3px solid var(--marker-red);
  outline-offset: 2px;
}

.swatch {
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--ink);
  flex: none;
}

.name {
  font-weight: bold;
  overflow-wrap: anywhere;
}

.sub {
  color: var(--ink-soft);
  overflow-wrap: anywhere;
}

.owner {
  color: var(--ink-soft);
  overflow-wrap: anywhere;
  min-width: 0;
}

.count {
  margin-left: auto;
  font-family: var(--font-display);
  color: var(--ink-soft);
}
</style>
