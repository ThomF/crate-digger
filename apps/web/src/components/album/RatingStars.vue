<script setup lang="ts">
defineProps<{ rating: number }>()
</script>

<template>
  <!-- Screen readers get the sentence; the stars themselves are decoration. -->
  <span class="stars" role="img" :aria-label="`Rated ${rating} out of 5`">
    <span v-for="n in 5" :key="n" :class="{ on: n <= rating }" aria-hidden="true">★</span>
  </span>
</template>

<style scoped>
.stars {
  letter-spacing: 0.1em;
  color: var(--paper-dark);
  white-space: nowrap;
}

.on {
  color: var(--star);
}
</style>
