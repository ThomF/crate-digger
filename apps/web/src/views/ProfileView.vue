<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { PublicProfile, ProfileLink } from '@frisson/shared'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { getProfile } from '../api/profiles.ts'
import { useSessionStore } from '../stores/session.ts'
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
        </h1>
        <p class="handle">@{{ profile.username }}</p>
        <p v-if="profile.location" class="location">{{ profile.location }}</p>
        <RouterLink v-if="isOwner" :to="{ name: 'profile-edit' }" class="btn">
          Edit profile
        </RouterLink>
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
          <span class="name">{{ crate.label ?? crate.name }}</span>
          <span v-if="crate.label" class="sub">{{ crate.name }}</span>
          <span class="count">{{ albumCount(crate.albumCount) }}</span>
        </li>
      </ul>
      <p v-else class="status-note">No crates yet.</p>
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

.who h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.75rem;
}

.handle,
.location {
  margin: 0.15rem 0 0;
  font-family: var(--font-display);
  color: var(--ink-soft);
}

.who .btn {
  margin-top: 0.6rem;
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
  gap: 0.6rem;
  align-items: center;
  padding: 0.4rem 0.6rem;
  background: var(--paper-dark);
  border: 1px solid var(--cardboard-dark);
}

.swatch {
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--ink);
  flex: none;
}

.name {
  font-weight: bold;
}

.sub {
  color: var(--ink-soft);
}

.count {
  margin-left: auto;
  font-family: var(--font-display);
  color: var(--ink-soft);
}
</style>
