<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AlbumSummary } from '@crate-digger/shared'
import { readableInk } from '../../utils/color.ts'

const props = defineProps<{
  album: Pick<AlbumSummary, 'title' | 'artist' | 'sleeveColor' | 'format'>
}>()

// Spin by default; click the record to stop it, like lifting the needle.
const spinning = ref(true)

const ink = computed(() => readableInk(props.album.sleeveColor))
// 7" singles spin at 45 rpm, everything else at 33⅓.
const rpm = computed(() => (props.album.format === '7"' ? 45 : 33.33))
const secondsPerTurn = computed(() => (60 / rpm.value).toFixed(2))
const speedLabel = computed(() => (rpm.value === 45 ? '45 RPM' : '33⅓ RPM'))
</script>

<template>
  <button
    type="button"
    class="vinyl"
    :aria-pressed="spinning"
    :aria-label="spinning ? 'Stop the record' : 'Spin the record'"
    @click="spinning = !spinning"
  >
    <span class="disc" :class="{ spinning }" :style="{ '--turn': `${secondsPerTurn}s` }">
      <span class="label" :style="{ background: album.sleeveColor, color: ink }">
        <span class="label-title">{{ album.title }}</span>
        <span class="label-artist">{{ album.artist }}</span>
        <span class="label-speed">{{ speedLabel }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.vinyl {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  container-type: inline-size;
}

.vinyl:focus-visible {
  outline-offset: 4px;
}

/* The light catching the grooves. It sits on top and doesn't rotate, which is what
   makes the spinning record underneath look real. */
.vinyl::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 30deg,
    transparent 0deg,
    rgb(255 255 255 / 0.12) 25deg,
    transparent 60deg,
    transparent 180deg,
    rgb(255 255 255 / 0.1) 205deg,
    transparent 240deg
  );
  pointer-events: none;
}

.disc {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  /* Grooves: thin alternating rings. */
  background: repeating-radial-gradient(circle, #111 0 1px, #1b1b1b 1px 2.4px), #111;
  box-shadow:
    0 0 0 1.5cqw #0b0b0b inset,
    4px 6px 14px rgb(0 0 0 / 0.35);
}

.disc.spinning {
  animation: spin var(--turn) linear infinite;
}

.label {
  width: 36%;
  aspect-ratio: 1;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3cqw;
  font-family: var(--font-display);
  line-height: 1.15;
  /* The spindle hole. */
  background-image: radial-gradient(circle, var(--paper) 0 1.6cqw, transparent 1.7cqw);
}

.label-title {
  font-size: 3.4cqw;
  font-weight: bold;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4cqw; /* leave room for the spindle hole */
}

.label-artist,
.label-speed {
  font-size: 2.6cqw;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .disc.spinning {
    animation: none;
  }
}
</style>
