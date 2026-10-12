<script setup lang="ts">
import { onMounted, ref } from 'vue'

type Health = { status: string; service: string }

const health = ref<Health | null>(null)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    health.value = await res.json()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <main class="shop">
    <h1 class="sign">Crate Digger</h1>
    <p class="tagline">Used &amp; new vinyl · est. 1994</p>

    <p v-if="health" class="status ok">● API {{ health.status }}</p>
    <p v-else-if="error" class="status err">● API unreachable ({{ error }})</p>
    <p v-else class="status">● checking API…</p>
  </main>
</template>

<style scoped>
.shop {
  min-height: 100vh;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 0.5rem;
  padding: 1rem;
}

.sign {
  font-family: 'Courier New', monospace;
  font-size: clamp(2.5rem, 8vw, 5rem);
  letter-spacing: 0.05em;
  color: var(--marker-red);
  text-shadow: 3px 3px 0 var(--cardboard-dark);
  margin: 0;
}

.tagline {
  font-family: 'Courier New', monospace;
  color: var(--ink-soft);
  margin: 0 0 1.5rem;
}

.status {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.ok {
  color: var(--ok-green);
}

.err {
  color: var(--marker-red);
}
</style>
