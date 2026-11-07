<script setup lang="ts">
import { RouterLink } from 'vue-router'

// Data classification: PUBLIC. A crate owner's username and display name.
// Shows "by <owner>" linking to their profile; renders nothing for ownerless crates.
defineProps<{ username: string | null; displayName?: string | null }>()
</script>

<template>
  <p v-if="username" class="owner">
    by
    <RouterLink :to="`/u/${encodeURIComponent(username)}`">{{
      displayName ?? username
    }}</RouterLink>
  </p>
</template>

<style scoped>
.owner {
  text-align: center;
  margin: 0.5rem 0 0;
  font-family: var(--font-display);
  font-size: 0.9rem;
  color: var(--ink-soft);
}

.owner a {
  color: var(--ink);
  font-weight: bold;
}
</style>
