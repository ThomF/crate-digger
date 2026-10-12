<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { AlbumDetail } from '@crate-digger/shared'
import { getAlbum } from '../api/albums.ts'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { useLibraryStore } from '../stores/library.ts'
import { useSessionStore } from '../stores/session.ts'
import RatingStars from '../components/album/RatingStars.vue'
import RecordStage from '../components/album/RecordStage.vue'
import TrackList from '../components/album/TrackList.vue'
import { formatDuration, totalDuration } from '../utils/tracks.ts'

const props = defineProps<{ id: number }>()

// Local state: only this screen needs the full album, so it doesn't go in the store.
const album = ref<AlbumDetail | null>(null)
const status = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const error = ref<string | null>(null)
const turned = ref(false)

// A message handed over by the previous page, e.g. "Saved, but the cover didn't upload".
// It rides along in the browser history entry (router.push({ state })), so it's gone
// once you navigate away and doesn't reappear on reload of a different entry.
const notice = ref<string | null>(null)

const library = useLibraryStore()
const session = useSessionStore()
library.load() // for the crate name; a no-op if already loaded

// If we came from the crate or the list, the store already has this album's summary,
// so the page can draw the sleeve immediately (which the pull-out animation needs)
// while notes and tracks load.
const summary = computed(() => library.albums.find((a) => a.id === props.id) ?? null)
const shown = computed(() => album.value ?? summary.value)

const crateName = computed(() => {
  if (!shown.value) return null
  const crate = library.crateById(shown.value.crateId)
  return crate ? (crate.label ?? crate.name) : null
})

const runtime = computed(() => {
  const total = album.value ? totalDuration(album.value.tracks) : null
  return total ? formatDuration(total) : null
})

async function load(id: number) {
  status.value = 'loading'
  album.value = null
  turned.value = false
  notice.value = typeof history.state?.notice === 'string' ? history.state.notice : null
  if (summary.value) document.title = `${summary.value.title} · Crate Digger`
  try {
    album.value = await getAlbum(id)
    status.value = 'ready'
    document.title = `${album.value.title} · Crate Digger`
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      status.value = 'not-found'
    } else {
      error.value = errorMessage(err)
      status.value = 'error'
    }
  }
}

// `immediate` runs it once now; the watch re-runs it if you navigate album → album.
watch(() => props.id, load, { immediate: true })
</script>

<template>
  <nav class="top">
    <RouterLink to="/" class="back">← Back to the crates</RouterLink>
    <RouterLink
      v-if="status === 'ready' && session.canEdit"
      :to="{ name: 'album-edit', params: { id } }"
      class="btn"
    >
      Edit
    </RouterLink>
  </nav>

  <p v-if="notice" class="notice" role="status">
    {{ notice }}
    <button type="button" aria-label="Dismiss" @click="notice = null">×</button>
  </p>

  <p v-if="status === 'not-found'" class="status-note">That record isn't in any crate.</p>

  <p v-else-if="status === 'error'" class="status-note is-error" role="alert">
    {{ error }}
    <button type="button" class="btn" @click="load(id)">Try again</button>
  </p>

  <p v-else-if="!shown" class="status-note">Pulling it out of the crate…</p>

  <article v-else class="album">
    <RecordStage v-model:turned="turned" :album="shown" :tracks="album?.tracks ?? null" />

    <header class="info">
      <p v-if="crateName" class="crate">{{ crateName }}</p>
      <h1>{{ shown.title }}</h1>
      <p class="artist">{{ shown.artist }}</p>
      <dl class="facts">
        <template v-if="shown.year">
          <dt>Year</dt>
          <dd>{{ shown.year }}</dd>
        </template>
        <template v-if="shown.genre">
          <dt>Genre</dt>
          <dd>{{ shown.genre }}</dd>
        </template>
        <dt>Format</dt>
        <dd>{{ shown.format }}</dd>
        <template v-if="runtime">
          <dt>Runtime</dt>
          <dd>{{ runtime }}</dd>
        </template>
        <dt>Rating</dt>
        <dd><RatingStars :rating="shown.rating" /></dd>
      </dl>
      <p v-if="album?.notes" class="notes">{{ album.notes }}</p>
    </header>

    <section class="tracks">
      <h2>Tracklist</h2>
      <TrackList v-if="album" :tracks="album.tracks" />
      <p v-else class="status-note">Reading the back of the sleeve…</p>
    </section>
  </article>
</template>

<style scoped>
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.back {
  font-family: var(--font-display);
}

.notice {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1.5rem;
  padding: 0.5rem 0.75rem;
  border-left: 4px solid var(--marker-red);
  background: #fdecea;
}

.notice button {
  background: none;
  border: none;
  font-size: 1.2rem;
  line-height: 1;
}

.top .btn {
  text-decoration: none;
}

.album {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.5rem 2.5rem;
  align-items: start;
}

.crate {
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
  margin: 0;
}

h1 {
  margin: 0;
  line-height: 1.15;
}

.artist {
  font-size: 1.2rem;
  margin: 0.25rem 0 1rem;
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 1rem;
  margin: 0;
}

dt {
  font-family: var(--font-display);
  color: var(--ink-soft);
}

dd {
  margin: 0;
}

/* Handwritten-ish note on an index card. */
.notes {
  font-family: var(--font-display);
  background: #fffbe6;
  border-left: 4px solid var(--marker-red);
  padding: 0.5rem 0.75rem;
  margin: 1rem 0 0;
}

.tracks {
  grid-column: 1 / -1;
}

.tracks h2 {
  font-family: var(--font-display);
  font-size: 1.1rem;
}

@media (max-width: 44rem) {
  .album {
    grid-template-columns: 1fr;
  }
}
</style>
