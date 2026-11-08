<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSessionStore } from '../stores/session.ts'

// Global actions: anyone signed in may make a crate or add a record to one of theirs.
// addToCrateId preselects a crate, so only pass one the user can edit.
defineProps<{ addToCrateId?: number }>()
const session = useSessionStore()
const route = useRoute()
// One crate's own URL (/crates/:id) is still the crate browser, so Crates stays lit there.
const onCrates = computed(() => route.name === 'library' || route.name === 'crate')
</script>

<template>
  <div class="toolbar">
    <nav class="views" aria-label="View">
      <RouterLink :to="{ name: 'library' }" :class="{ active: onCrates }">Crates</RouterLink>
      <RouterLink :to="{ name: 'list' }" exact-active-class="active">List</RouterLink>
    </nav>
    <div v-if="session.signedIn" class="end">
      <RouterLink :to="{ name: 'crates' }" class="manage">Edit crates</RouterLink>
      <RouterLink
        :to="{ name: 'album-new', query: addToCrateId ? { crateId: addToCrateId } : {} }"
        class="btn"
      >
        + Add a record
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.views {
  display: flex;
  border: 2px solid var(--ink);
}

.views a {
  padding: 0.3rem 0.9rem;
  font-family: var(--font-display);
  text-decoration: none;
}

.views a.active {
  background: var(--ink);
  color: var(--paper);
}

.end {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.manage {
  font-family: var(--font-display);
  font-size: 0.9rem;
}

.btn {
  text-decoration: none;
  margin-left: 0;
}

@media (max-width: 30rem) {
  .toolbar {
    flex-wrap: wrap;
  }
}
</style>
