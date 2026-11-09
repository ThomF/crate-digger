<script setup lang="ts">
import type { SectionState } from './adminPanel.ts'

// A section's loading note or its error. On a failed refresh the old data is still held, so the
// section shows this error instead of its list.
defineProps<{ section: SectionState; loadingText: string }>()
</script>

<template>
  <p v-if="section.status.value === 'loading'" class="status-note" role="status">
    {{ loadingText }}
  </p>
  <p v-else-if="section.status.value === 'error'" class="status-note is-error" role="alert">
    {{ section.error.value }}
    <button type="button" class="btn" @click="section.load()">Try again</button>
  </p>
</template>
