<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { AlbumSummary } from '@crate-digger/shared'
import { useLibraryStore } from '../stores/library.ts'
import { useSessionStore } from '../stores/session.ts'
import CrateBox from '../components/crate/CrateBox.vue'
import LibraryToolbar from '../components/LibraryToolbar.vue'
import RatingStars from '../components/album/RatingStars.vue'

const library = useLibraryStore()
const session = useSessionStore()
const router = useRouter()

onMounted(() => {
  document.title = 'Crate Digger'
  library.load()
})

const crate = computed(() => library.selectedCrate)
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

function open(album: AlbumSummary) {
  router.push({ name: 'album', params: { id: album.id } })
}
</script>

<template>
  <LibraryToolbar :add-to-crate-id="crate?.id" />

  <p v-if="library.status === 'loading' || library.status === 'idle'" class="status-note">
    Flipping through the crates…
  </p>

  <p v-else-if="library.status === 'error'" class="status-note is-error" role="alert">
    {{ library.error }}
    <button type="button" class="btn" @click="library.load({ force: true })">Try again</button>
  </p>

  <p v-else-if="!crate" class="status-note">
    No crates yet. Run <code>npm run db:seed -w apps/api</code> for sample records.
  </p>

  <template v-else>
    <!-- Crate picker: tape labels along the top. Toggle buttons (aria-pressed). -->
    <div class="tabs" role="group" aria-label="Crates">
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
          v-if="session.canEdit"
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
