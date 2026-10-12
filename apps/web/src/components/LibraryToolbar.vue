<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ addToCrateId?: number }>()
</script>

<template>
  <div class="toolbar">
    <nav class="views" aria-label="View">
      <RouterLink :to="{ name: 'library' }" exact-active-class="active">Crates</RouterLink>
      <RouterLink :to="{ name: 'list' }" exact-active-class="active">List</RouterLink>
    </nav>
    <RouterLink
      :to="{ name: 'album-new', query: addToCrateId ? { crateId: addToCrateId } : {} }"
      class="btn"
    >
      + Add a record
    </RouterLink>
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

.btn {
  text-decoration: none;
  margin-left: 0;
}
</style>
