<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useSessionStore } from '../../stores/session.ts'

// What to show when there are no crates at all, for whoever is looking.
const session = useSessionStore()
const isDev = import.meta.env.DEV
</script>

<template>
  <p v-if="session.canEdit" class="status-note">
    No crates yet. <RouterLink :to="{ name: 'crates' }">Make your first crate.</RouterLink>
    <span v-if="isDev">
      (Or run <code>npm run db:seed -w apps/api</code> for sample records.)
    </span>
  </p>
  <p v-else class="status-note">The crates are still being unpacked. Check back soon.</p>
</template>
