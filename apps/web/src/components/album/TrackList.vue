<script setup lang="ts">
import { computed } from 'vue'
import type { Track } from '@crate-digger/shared'
import { formatDuration, groupBySide } from '../../utils/tracks.ts'

const props = defineProps<{ tracks: Track[] }>()

const sides = computed(() => groupBySide(props.tracks))
</script>

<template>
  <div v-if="sides.length" class="tracklist">
    <section v-for="group in sides" :key="group.side" class="side">
      <h3>Side {{ group.side }}</h3>
      <ol>
        <li v-for="track in group.tracks" :key="track.id">
          <span class="num">{{ group.side }}{{ track.position }}</span>
          <span class="title">{{ track.title }}</span>
          <span class="time">{{ formatDuration(track.durationSec) }}</span>
        </li>
      </ol>
    </section>
  </div>
  <p v-else class="empty">No tracklist yet.</p>
</template>

<style scoped>
.tracklist {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1.5rem;
}

h3 {
  font-family: var(--font-display);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px dashed var(--ink-soft);
  margin: 0 0 0.5rem;
}

ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: grid;
  grid-template-columns: 2.5rem 1fr auto;
  gap: 0.5rem;
  padding: 0.2rem 0;
}

.num,
.time {
  font-family: var(--font-display);
  color: var(--ink-soft);
}

.empty {
  font-family: var(--font-display);
  color: var(--ink-soft);
}
</style>
