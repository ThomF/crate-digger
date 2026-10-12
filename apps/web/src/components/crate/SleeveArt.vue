<script setup lang="ts">
import { computed } from 'vue'
import type { AlbumSummary } from '@crate-digger/shared'
import { readableInk } from '../../utils/color.ts'

// A generated sleeve for albums without cover art (all of them until M7).
// The album id picks one of a few 90s-ish motifs, so each record looks distinct but stable.
const props = defineProps<{
  album: Pick<AlbumSummary, 'id' | 'title' | 'artist' | 'year' | 'sleeveColor'>
}>()

const MOTIFS = ['rings', 'stripes', 'sun', 'grid'] as const
const motif = computed(() => MOTIFS[props.album.id % MOTIFS.length])
const ink = computed(() => readableInk(props.album.sleeveColor))
</script>

<template>
  <div
    class="sleeve-art"
    :class="`motif-${motif}`"
    :style="{ '--sleeve-color': album.sleeveColor, '--ink': ink }"
  >
    <!-- The strip you see when it's buried in the crate. -->
    <p class="edge">
      <span class="artist">{{ album.artist }}</span>
      <span class="title">{{ album.title }}</span>
    </p>
    <div class="motif" aria-hidden="true" />
    <p class="sticker">
      <strong>{{ album.title }}</strong>
      <span>{{ [album.artist, album.year].filter(Boolean).join(' · ') }}</span>
    </p>
  </div>
</template>

<style scoped>
.sleeve-art {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--sleeve-color);
  color: var(--ink);
  font-family: var(--font-display);
  container-type: inline-size; /* text below scales with the sleeve via cqw units */
}

/* Faint cardboard wear on every sleeve. */
.sleeve-art::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.12), transparent 40%),
    repeating-linear-gradient(90deg, rgb(0 0 0 / 0.03) 0 2px, transparent 2px 5px);
  pointer-events: none;
}

.edge {
  position: absolute;
  inset: 0 0 auto;
  margin: 0;
  padding: 3cqw 5cqw;
  display: flex;
  justify-content: space-between;
  gap: 4cqw;
  font-size: 5.2cqw;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  border-bottom: 0.6cqw solid currentColor;
  z-index: 1;
}

.edge span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.edge .title {
  font-weight: normal;
  text-align: right;
}

.motif {
  position: absolute;
  inset: 16cqw 0 0;
  opacity: 0.35;
}

.motif-rings .motif {
  background: repeating-radial-gradient(
    circle at 50% 55%,
    currentColor 0 1.2cqw,
    transparent 1.2cqw 5cqw
  );
}

.motif-stripes .motif {
  background: repeating-linear-gradient(-45deg, currentColor 0 4cqw, transparent 4cqw 10cqw);
}

.motif-sun .motif {
  background: radial-gradient(circle at 70% 40%, currentColor 0 22cqw, transparent 22.5cqw);
}

.motif-grid .motif {
  background:
    linear-gradient(currentColor 0.6cqw, transparent 0.6cqw) 0 0 / 12cqw 12cqw,
    linear-gradient(90deg, currentColor 0.6cqw, transparent 0.6cqw) 0 0 / 12cqw 12cqw;
}

/* A typed label stuck on the front, slightly crooked. Sits high so it clears the crate wall. */
.sticker {
  position: absolute;
  left: 8cqw;
  top: 24cqw;
  max-width: 70cqw;
  margin: 0;
  padding: 3cqw 4cqw;
  background: #fffaf0;
  color: #1b1712;
  box-shadow: 1cqw 1cqw 0 rgb(0 0 0 / 0.25);
  transform: rotate(-2deg);
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.sticker strong {
  font-size: 7cqw;
  line-height: 1.1;
}

.sticker span {
  font-size: 5cqw;
}
</style>
