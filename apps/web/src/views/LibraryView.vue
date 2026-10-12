<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import LibraryToolbar from '../components/LibraryToolbar.vue'
import { useLibraryStore } from '../stores/library.ts'
import AlbumRow from '../components/album/AlbumRow.vue'

// The plain list view: proves data flows end to end before the 3D crate arrives in M5.
const library = useLibraryStore()

onMounted(() => {
  document.title = 'Crate Digger'
  library.load()
})
</script>

<template>
  <LibraryToolbar />

  <p v-if="library.status === 'loading' || library.status === 'idle'" class="status-note">
    Flipping through the crates…
  </p>

  <p v-else-if="library.status === 'error'" class="status-note is-error" role="alert">
    {{ library.error }}
    <button type="button" class="btn" @click="library.load({ force: true })">Try again</button>
  </p>

  <p v-else-if="library.crates.length === 0" class="status-note">
    No crates yet. Run <code>npm run db:seed -w apps/api</code> for sample records.
  </p>

  <div v-else class="shelves">
    <section v-for="{ crate, albums } in library.crateShelves" :key="crate.id" class="crate">
      <h2 class="crate-label" :style="{ background: crate.color }">
        {{ crate.label ?? crate.name }}
        <small>
          {{ albums.length }} {{ albums.length === 1 ? 'record' : 'records' }} ·
          <RouterLink :to="{ name: 'album-new', query: { crateId: crate.id } }">add</RouterLink>
        </small>
      </h2>
      <ul v-if="albums.length" class="albums">
        <li v-for="album in albums" :key="album.id">
          <AlbumRow :album="album" />
        </li>
      </ul>
      <p v-else class="status-note">Empty crate.</p>
    </section>
  </div>
</template>

<style scoped>
.shelves {
  display: grid;
  gap: 2rem;
}

.crate {
  border: 2px solid var(--cardboard-dark);
  background: var(--paper);
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

.albums {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
