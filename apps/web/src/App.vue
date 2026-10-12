<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="masthead">
    <RouterLink to="/" class="sign">Crate Digger</RouterLink>
    <p class="tagline">Used &amp; new vinyl · est. 1994</p>
  </header>

  <main class="page">
    <RouterView />
  </main>
</template>

<style scoped>
.masthead {
  text-align: center;
  padding: 2rem 1rem 1rem;
  border-bottom: 3px double var(--cardboard-dark);
}

.sign {
  font-family: var(--font-display);
  font-size: clamp(2rem, 7vw, 3.5rem);
  font-weight: bold;
  letter-spacing: 0.05em;
  color: var(--marker-red);
  text-shadow: 3px 3px 0 var(--cardboard);
  text-decoration: none;
}

.tagline {
  font-family: var(--font-display);
  color: var(--ink-soft);
  margin: 0.25rem 0 0;
}

.page {
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}
</style>
