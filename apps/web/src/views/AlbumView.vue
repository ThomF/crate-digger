<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { AlbumDetail } from '@crate-digger/shared'
import { getAlbum } from '../api/albums.ts'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { useLibraryStore } from '../stores/library.ts'
import RatingStars from '../components/album/RatingStars.vue'
import TrackList from '../components/album/TrackList.vue'
import SleeveArt from '../components/crate/SleeveArt.vue'
import { formatDuration, totalDuration } from '../utils/tracks.ts'

const props = defineProps<{ id: number }>()

// Local state: only this screen needs the full album, so it doesn't go in the store.
const album = ref<AlbumDetail | null>(null)
const status = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const error = ref<string | null>(null)

const library = useLibraryStore()
library.load() // for the crate name; a no-op if already loaded

const crateName = computed(() => {
  if (!album.value) return null
  const crate = library.crateById(album.value.crateId)
  return crate ? (crate.label ?? crate.name) : null
})

const runtime = computed(() => {
  const total = album.value ? totalDuration(album.value.tracks) : null
  return total ? formatDuration(total) : null
})

async function load(id: number) {
  status.value = 'loading'
  try {
    album.value = await getAlbum(id)
    status.value = 'ready'
    document.title = `${album.value.title} · Crate Digger`
  } catch (err) {
    album.value = null
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
    <RouterLink v-if="status === 'ready'" :to="{ name: 'album-edit', params: { id } }" class="btn">
      Edit
    </RouterLink>
  </nav>

  <p v-if="status === 'loading'" class="status-note">Pulling it out of the crate…</p>

  <p v-else-if="status === 'not-found'" class="status-note">That record isn't in any crate.</p>

  <p v-else-if="status === 'error'" class="status-note is-error" role="alert">
    {{ error }}
    <button type="button" class="btn" @click="load(id)">Try again</button>
  </p>

  <article v-else-if="album" class="album">
    <div class="sleeve" aria-hidden="true"><SleeveArt :album="album" /></div>

    <header class="info">
      <p v-if="crateName" class="crate">{{ crateName }}</p>
      <h1>{{ album.title }}</h1>
      <p class="artist">{{ album.artist }}</p>
      <dl class="facts">
        <template v-if="album.year">
          <dt>Year</dt>
          <dd>{{ album.year }}</dd>
        </template>
        <template v-if="album.genre">
          <dt>Genre</dt>
          <dd>{{ album.genre }}</dd>
        </template>
        <dt>Format</dt>
        <dd>{{ album.format }}</dd>
        <template v-if="runtime">
          <dt>Runtime</dt>
          <dd>{{ runtime }}</dd>
        </template>
        <dt>Rating</dt>
        <dd><RatingStars :rating="album.rating" /></dd>
      </dl>
      <p v-if="album.notes" class="notes">{{ album.notes }}</p>
    </header>

    <section class="tracks">
      <h2>Tracklist</h2>
      <TrackList :tracks="album.tracks" />
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

.top .btn {
  text-decoration: none;
}

.album {
  display: grid;
  grid-template-columns: minmax(8rem, 14rem) 1fr;
  gap: 1.5rem 2rem;
}

.sleeve {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid rgb(0 0 0 / 0.2);
  box-shadow: 6px 6px 0 rgb(0 0 0 / 0.15);
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

@media (max-width: 36rem) {
  .album {
    grid-template-columns: 1fr;
  }

  .sleeve {
    max-width: 14rem;
  }
}
</style>
