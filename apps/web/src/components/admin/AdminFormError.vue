<script setup lang="ts">
import type { FormError } from './adminPanel.ts'

defineProps<{ error: FormError }>()
</script>

<template>
  <div class="admin-error" role="alert">
    <p>{{ error.message }}</p>
    <ul v-if="error.issues.length">
      <li v-for="(issue, i) in error.issues" :key="i">{{ issue }}</li>
    </ul>
  </div>
</template>
