<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { AlbumQuery, AlbumSummary } from '@crate-digger/shared'
import { LIST_SORTS, type ListSort } from '@crate-digger/shared/sorting'
import { errorMessage } from '../api/client.ts'
import { useAlbumSearch } from '../composables/useAlbumSearch.ts'
import { useLibraryStore } from '../stores/library.ts'
import { useSessionStore } from '../stores/session.ts'
import AlbumRow from '../components/album/AlbumRow.vue'
import EmptyShelf from '../components/crate/EmptyShelf.vue'
import LibraryToolbar from '../components/LibraryToolbar.vue'

// The list view: every crate as a plain list, where records can be rearranged, plus
// search across the whole collection.
const library = useLibraryStore()
const session = useSessionStore()
const route = useRoute()
const router = useRouter()

onMounted(() => {
  document.title = 'Crate Digger'
  library.load()
})

// ── Search and filters ──────────────────────────────────────────────────
// Kept in the URL (?q=…&genre=…&sort=…), so Back works and a search can be bookmarked.

const SORT_LABELS: Record<ListSort, string> = {
  crate: 'Crate order',
  artist: 'Artist A–Z',
  title: 'Title A–Z',
  year: 'Oldest first',
  rating: 'Best rated',
}

const one = (value: unknown) => (typeof value === 'string' ? value : '')
const filters = computed({
  get: () => ({
    q: one(route.query.q),
    genre: one(route.query.genre),
    sort: (LIST_SORTS as readonly string[]).includes(one(route.query.sort))
      ? (one(route.query.sort) as ListSort)
      : 'crate',
  }),
  set: (next) => {
    const query = Object.fromEntries(
      Object.entries(next).filter(
        ([key, value]) => value && !(key === 'sort' && value === 'crate'),
      ),
    )
    router.replace({ query }) // replace: typing shouldn't add a history entry per letter
  },
})
const update = (patch: Partial<typeof filters.value>) =>
  (filters.value = { ...filters.value, ...patch })

const searching = computed(
  () => !!filters.value.q || !!filters.value.genre || filters.value.sort !== 'crate',
)
const searchQuery = computed<AlbumQuery>(() => (searching.value ? filters.value : {}))
const search = useAlbumSearch(searchQuery)

const genres = computed(() =>
  [...new Set(library.albums.map((a) => a.genre).filter((g): g is string => !!g))].sort(),
)
const crateName = (crateId: number) => {
  const crate = library.crateById(crateId)
  return crate ? (crate.label ?? crate.name) : ''
}

// ── Moving records ──────────────────────────────────────────────────────

const moving = ref(false)
const moveMessage = ref<string | null>(null) // read out by screen readers (aria-live)
const moveError = ref<string | null>(null)

async function move(album: AlbumSummary, crateId: number, position: number) {
  moving.value = true
  moveError.value = null
  try {
    await library.moveAlbumTo(album.id, crateId, position)
    moveMessage.value = `Moved ${album.title} to ${crateName(crateId)}.`
  } catch (err) {
    moveError.value = errorMessage(err)
  } finally {
    moving.value = false
  }
}

/** Where `album` would land if dropped just before `target` (or at the end if null). */
function positionBefore(album: AlbumSummary, crateId: number, target: AlbumSummary | null) {
  const others = (library.crateShelves.find((s) => s.crate.id === crateId)?.albums ?? []).filter(
    (a) => a.id !== album.id,
  )
  const index = target ? others.findIndex((a) => a.id === target.id) : -1
  return index === -1 ? others.length : index
}

function nudge(album: AlbumSummary, albums: AlbumSummary[], delta: -1 | 1) {
  const index = albums.findIndex((a) => a.id === album.id)
  // Positions count the *other* records, so "one later" is index + 1, "one earlier" index - 1.
  return move(album, album.crateId, index + delta)
}

function moveToCrate(event: Event, album: AlbumSummary) {
  const select = event.target as HTMLSelectElement
  const crateId = Number(select.value)
  select.value = '' // back to "Move to…"
  if (crateId) return move(album, crateId, Number.MAX_SAFE_INTEGER) // to the back
}

// Drag and drop (HTML5). The keyboard alternative is the "Move to" menu and ↑/↓ buttons.
const dragged = ref<AlbumSummary | null>(null)
const dropTarget = ref<string | null>(null)

function onDragStart(event: DragEvent, album: AlbumSummary) {
  if (!session.canEdit) return event.preventDefault()
  dragged.value = album
  event.dataTransfer?.setData('text/plain', album.title)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  dragged.value = null
  dropTarget.value = null
}

function onDrop(crateId: number, target: AlbumSummary | null) {
  const album = dragged.value
  onDragEnd()
  if (!album || album.id === target?.id) return
  return move(album, crateId, positionBefore(album, crateId, target))
}
</script>

<template>
  <LibraryToolbar />

  <form class="filters" role="search" @submit.prevent>
    <label class="sr-only" for="q">Search title or artist</label>
    <input
      id="q"
      type="search"
      placeholder="Search title or artist…"
      :value="filters.q"
      @input="update({ q: ($event.target as HTMLInputElement).value })"
    />
    <label class="sr-only" for="genre">Genre</label>
    <select
      id="genre"
      :value="filters.genre"
      @change="update({ genre: ($event.target as HTMLSelectElement).value })"
    >
      <option value="">All genres</option>
      <option v-for="genre in genres" :key="genre" :value="genre">{{ genre }}</option>
    </select>
    <label class="sr-only" for="sort">Sort</label>
    <select
      id="sort"
      :value="filters.sort"
      @change="update({ sort: ($event.target as HTMLSelectElement).value as ListSort })"
    >
      <option v-for="sort in LIST_SORTS" :key="sort" :value="sort">{{ SORT_LABELS[sort] }}</option>
    </select>
    <button v-if="searching" type="button" class="clear" @click="router.replace({ query: {} })">
      Clear
    </button>
  </form>

  <p v-if="library.status === 'loading' || library.status === 'idle'" class="status-note">
    Flipping through the crates…
  </p>

  <p v-else-if="library.status === 'error'" class="status-note is-error" role="alert">
    {{ library.error }}
    <button type="button" class="btn" @click="library.load({ force: true })">Try again</button>
  </p>

  <EmptyShelf v-else-if="library.crates.length === 0" />

  <!-- Search results: one flat list across all crates. -->
  <section v-else-if="searching" class="results" aria-live="polite">
    <p v-if="search.status.value === 'error'" class="status-note is-error">
      {{ search.error.value }}
    </p>
    <p v-else-if="search.status.value !== 'done'" class="status-note">Digging…</p>
    <template v-else>
      <p class="count">
        {{ search.results.value.length }}
        {{ search.results.value.length === 1 ? 'record' : 'records' }}
      </p>
      <ul v-if="search.results.value.length" class="albums boxed">
        <li v-for="album in search.results.value" :key="album.id" class="with-crate">
          <AlbumRow :album="album" />
          <span class="crate-chip">{{ crateName(album.crateId) }}</span>
        </li>
      </ul>
      <p v-else class="status-note">Nothing in the crates matches that.</p>
    </template>
  </section>

  <!-- Every crate, with tools to rearrange records. -->
  <div v-else class="shelves">
    <p v-if="moveError" class="status-note is-error" role="alert">{{ moveError }}</p>
    <p class="sr-only" aria-live="polite">{{ moveMessage }}</p>

    <section
      v-for="{ crate, albums } in library.crateShelves"
      :key="crate.id"
      class="crate"
      :class="{ 'drop-here': dropTarget === `crate-${crate.id}` }"
      @dragover.prevent="dragged && (dropTarget = `crate-${crate.id}`)"
      @drop.prevent="onDrop(crate.id, null)"
    >
      <h2 class="crate-label" :style="{ background: crate.color }">
        {{ crate.label ?? crate.name }}
        <small>
          {{ albums.length }} {{ albums.length === 1 ? 'record' : 'records' }}
          <template v-if="session.canEdit">
            ·
            <RouterLink :to="{ name: 'album-new', query: { crateId: crate.id } }">add</RouterLink>
          </template>
        </small>
      </h2>
      <p v-if="crate.sortBy !== 'manual'" class="sorted-note">
        Sorted by {{ crate.sortBy }}: records file themselves.
      </p>

      <ul v-if="albums.length" class="albums">
        <li
          v-for="(album, i) in albums"
          :key="album.id"
          class="movable"
          :class="{
            'drop-before': dropTarget === `album-${album.id}`,
            'being-dragged': dragged?.id === album.id,
          }"
          :draggable="session.canEdit"
          @dragstart="onDragStart($event, album)"
          @dragend="onDragEnd"
          @dragover.prevent.stop="dragged && (dropTarget = `album-${album.id}`)"
          @drop.prevent.stop="onDrop(crate.id, crate.sortBy === 'manual' ? album : null)"
        >
          <AlbumRow :album="album" />
          <span v-if="session.canEdit" class="tools">
            <template v-if="crate.sortBy === 'manual'">
              <button
                type="button"
                :disabled="moving || i === 0"
                :aria-label="`Move ${album.title} earlier`"
                @click="nudge(album, albums, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                :disabled="moving || i === albums.length - 1"
                :aria-label="`Move ${album.title} later`"
                @click="nudge(album, albums, 1)"
              >
                ↓
              </button>
            </template>
            <select
              v-if="library.crates.length > 1"
              :aria-label="`Move ${album.title} to another crate`"
              :disabled="moving"
              @change="moveToCrate($event, album)"
            >
              <option value="">Move to…</option>
              <template v-for="other in library.crates" :key="other.id">
                <option v-if="other.id !== crate.id" :value="other.id">
                  {{ other.label ?? other.name }}
                </option>
              </template>
            </select>
          </span>
        </li>
      </ul>
      <p v-else class="status-note">
        Empty crate.<template v-if="session.canEdit"> Drag a record here.</template>
      </p>
    </section>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.filters input {
  flex: 1 1 14rem;
}

.clear {
  background: none;
  border: none;
  text-decoration: underline;
  font-family: var(--font-display);
}

.count {
  font-family: var(--font-display);
  color: var(--ink-soft);
  margin: 0 0 0.5rem;
}

.shelves {
  display: grid;
  gap: 2rem;
}

.crate,
.boxed {
  border: 2px solid var(--cardboard-dark);
  background: var(--paper);
}

.crate.drop-here {
  outline: 3px dashed var(--marker-red);
  outline-offset: 3px;
}

/* Looks like a strip of tape with marker on it. */
.crate-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 0;
  padding: 0.5rem 0.75rem;
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  color: var(--ink);
  border-bottom: 2px solid var(--cardboard-dark);
}

.crate-label small {
  font-size: 0.8rem;
  letter-spacing: normal;
}

.sorted-note {
  margin: 0;
  padding: 0.3rem 0.75rem;
  font-size: 0.8rem;
  color: var(--ink-soft);
  border-bottom: 1px solid var(--paper-dark);
}

.albums {
  list-style: none;
  margin: 0;
  padding: 0;
}

.movable,
.with-crate {
  display: flex;
  align-items: center;
}

.movable > :first-child,
.with-crate > :first-child {
  flex: 1;
  min-width: 0;
}

.movable {
  cursor: grab;
}

.movable.being-dragged {
  opacity: 0.4;
}

.movable.drop-before {
  box-shadow: inset 0 3px 0 var(--marker-red);
}

.tools {
  display: flex;
  gap: 0.25rem;
  padding: 0 0.5rem;
}

.tools button {
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border: 1px solid var(--ink-soft);
  background: var(--paper);
}

.tools button:disabled {
  opacity: 0.3;
  cursor: default;
}

.tools select {
  font-size: 0.8rem;
  padding: 0.25rem;
  max-width: 8rem;
}

.crate-chip {
  font-family: var(--font-display);
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  margin-right: 0.75rem;
  border: 1px solid var(--ink-soft);
  white-space: nowrap;
}

@media (max-width: 36rem) {
  .movable {
    flex-wrap: wrap;
  }

  .tools {
    width: 100%;
    justify-content: flex-end;
    padding: 0 0.5rem 0.5rem;
  }

  .crate-chip {
    display: none;
  }
}
</style>
