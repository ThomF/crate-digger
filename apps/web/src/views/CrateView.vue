<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { AlbumSummary } from '@frisson/shared'
import { spinAlbum } from '../api/albums.ts'
import { useLibraryStore } from '../stores/library.ts'
import { useSessionStore } from '../stores/session.ts'
import { canEditCrate, showsCrateActions } from '../utils/permissions.ts'
import CrateBox from '../components/crate/CrateBox.vue'
import OwnerLink from '../components/crate/OwnerLink.vue'
import EmptyShelf from '../components/crate/EmptyShelf.vue'
import LibraryToolbar from '../components/LibraryToolbar.vue'
import RatingStars from '../components/album/RatingStars.vue'

// Data classification: PUBLIC. Crates and albums are shown to anyone.

// Set on /crates/:id. Without it (/shelf) the view shows whichever crate is selected.
const props = defineProps<{ crateId?: number }>()

const library = useLibraryStore()
const session = useSessionStore()
const router = useRouter()

onMounted(() => {
  document.title = 'Crates · Frisson'
  library.load()
})

// A deep link shows exactly that crate or nothing, never some other crate in its place.
const crate = computed(() =>
  props.crateId === undefined ? library.selectedCrate : library.crateById(props.crateId),
)

// Remember it, so going back to /shelf from here stays in the same crate.
watch(
  () => props.crateId,
  (id) => {
    if (id !== undefined) library.selectCrate(id)
  },
  { immediate: true },
)

// The store loads once, so it can miss a crate made since, in another tab or by someone else.
// An unknown id gets one reload before it counts as not found. A load already under way when we
// arrive counts as that reload, and the marker is what stops a missing id from looping.
let reloadedFor: number | null = null
watch(
  [() => props.crateId, () => library.status],
  ([id, status]) => {
    if (id === undefined || library.crateById(id)) {
      reloadedFor = null
    } else if (status !== 'ready') {
      reloadedFor = id
    } else if (reloadedFor !== id) {
      reloadedFor = id
      void library.load({ force: true })
    }
  },
  { immediate: true },
)

const albums = computed(
  () => library.crateShelves.find((s) => s.crate.id === crate.value?.id)?.albums ?? [],
)

// v-model target for CrateBox. Reads/writes the store, clamped in case albums were removed.
const index = computed({
  get: () =>
    crate.value
      ? Math.min(library.positionIn(crate.value.id), Math.max(albums.value.length - 1, 0))
      : 0,
  set: (i: number) => crate.value && library.setPosition(crate.value.id, i),
})

const current = computed(() => albums.value[index.value])
const canEditThisCrate = computed(() => canEditCrate(session.user, crate.value))

// On /crates/:id the toolbar actions default to hidden until the crate is confirmed as one the
// viewer manages. The status check matters: the store keeps its crates during a forced reload and
// after a failed one, so `crate` can be set while the body shows the loading or error state.
// /shelf keeps its toolbar.
const hideToolbarActions = computed(
  () =>
    props.crateId !== undefined &&
    !(library.status === 'ready' && showsCrateActions(session.user, crate.value)),
)
const canAddFromEmptyCrate = computed(() =>
  props.crateId === undefined
    ? canEditThisCrate.value
    : showsCrateActions(session.user, crate.value),
)

async function open(album: AlbumSummary) {
  // Count the spin *before* opening the album, so the album page loads the new total
  // instead of showing one less. Only spins of your own records count (admins: any).
  if (canEditCrate(session.user, library.crateById(album.crateId))) {
    await spinAlbum(album.id).catch(() => {}) // never block opening on it
  }
  router.push({ name: 'album', params: { id: album.id } })
}
</script>

<template>
  <LibraryToolbar
    :hide-actions="hideToolbarActions"
    :add-to-crate-id="canEditThisCrate ? crate?.id : undefined"
  />

  <p v-if="library.status === 'loading' || library.status === 'idle'" class="status-note">
    Flipping through the crates…
  </p>

  <p v-else-if="library.status === 'error'" class="status-note is-error" role="alert">
    {{ library.error }}
    <button type="button" class="btn" @click="library.load({ force: true })">Try again</button>
  </p>

  <div v-else-if="crateId !== undefined && !crate" class="status-note">
    <p>Crate not found</p>
    <RouterLink :to="{ name: 'library' }">Browse all crates</RouterLink>
  </div>

  <EmptyShelf v-else-if="!crate" />

  <template v-else>
    <!-- Crate picker, on /shelf only: tape labels along the top. Toggle buttons (aria-pressed).
         Tabs change the selection and not the URL: going to /crates/:id would hide the picker
         on the first click. -->
    <div v-if="crateId === undefined" class="tabs" role="group" aria-label="Crates">
      <button
        v-for="c in library.crates"
        :key="c.id"
        type="button"
        class="tab"
        :aria-pressed="c.id === crate.id"
        :style="{ '--tab-color': c.color }"
        @click="library.selectCrate(c.id)"
      >
        {{ c.label ?? c.name }}
      </button>
    </div>
    <h1 v-else class="crate-name">{{ crate.label ?? crate.name }}</h1>

    <!-- Whose crate this is, linking to /u/<ownerUsername>. Nothing for ownerless crates. -->
    <OwnerLink :username="crate.ownerUsername" :display-name="crate.ownerDisplayName" />

    <CrateBox v-model:index="index" :crate="crate" :albums="albums" @open="open" />

    <!-- What you're looking at, as real text (and the accessible way to open it). -->
    <section class="now" aria-live="polite">
      <template v-if="current">
        <p class="count">{{ index + 1 }} / {{ albums.length }}</p>
        <h2>
          <RouterLink :to="{ name: 'album', params: { id: current.id } }">
            {{ current.title }}
          </RouterLink>
        </h2>
        <p class="artist">{{ current.artist }}</p>
        <p class="meta">
          {{ [current.year, current.genre, current.format].filter(Boolean).join(' · ') }}
          <RatingStars :rating="current.rating" />
        </p>
      </template>
      <p v-else class="count">
        Nothing in here yet.
        <RouterLink
          v-if="canAddFromEmptyCrate"
          :to="{ name: 'album-new', query: { crateId: crate.id } }"
        >
          Add a record
        </RouterLink>
      </p>
    </section>

    <div v-if="albums.length" class="controls">
      <button type="button" :disabled="index === 0" @click="index = index - 1">◀ Back</button>
      <button type="button" class="pull" :disabled="!current" @click="current && open(current)">
        Pull it out
      </button>
      <button type="button" :disabled="index >= albums.length - 1" @click="index = index + 1">
        Flip ▶
      </button>
    </div>

    <p class="hint">
      Scroll, drag down, or use the arrow keys to flip. Enter or click to pull out.
    </p>
  </template>
</template>

<style scoped>
.crate-name {
  margin: 0;
  text-align: center;
  font-family: var(--font-display);
  font-size: 1.75rem;
  /* Long crate names wrap rather than widening the page. */
  overflow-wrap: anywhere;
  max-width: 100%;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.tab {
  font-family: var(--font-display);
  font-weight: bold;
  letter-spacing: 0.08em;
  padding: 0.35rem 0.9rem;
  border: 2px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  /* Long crate labels wrap inside the tab rather than widening the page. */
  max-width: 100%;
  overflow-wrap: anywhere;
}

.tab[aria-pressed='true'] {
  background: var(--tab-color);
  box-shadow: 3px 3px 0 var(--ink);
  transform: translate(-1px, -1px);
}

.now {
  text-align: center;
  min-height: 7.5rem;
}

.count {
  font-family: var(--font-display);
  color: var(--ink-soft);
  margin: 0;
}

.now h2 {
  margin: 0.15rem 0 0;
  font-size: 1.5rem;
}

.now h2 a {
  text-decoration: none;
}

.now h2 a:hover {
  text-decoration: underline;
}

.artist {
  margin: 0;
  font-size: 1.1rem;
}

.meta {
  margin: 0.25rem 0 0;
  font-family: var(--font-display);
  font-size: 0.9rem;
  color: var(--ink-soft);
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.controls button {
  font-family: var(--font-display);
  padding: 0.45rem 1rem;
  border: 2px solid var(--ink);
  background: var(--paper);
}

.controls button:disabled {
  opacity: 0.35;
  cursor: default;
}

.controls .pull {
  background: var(--ink);
  color: var(--paper);
}

.hint {
  text-align: center;
  font-size: 0.8rem;
  color: var(--ink-soft);
  margin-top: 1rem;
}
</style>
