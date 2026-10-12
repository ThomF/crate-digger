<script setup lang="ts">
import type { AlbumSummary, Track } from '@crate-digger/shared'
import { sleeveTransitionName } from '../../viewTransitions.ts'
import SleeveArt from '../crate/SleeveArt.vue'
import SleeveBack from './SleeveBack.vue'
import VinylDisc from './VinylDisc.vue'

defineProps<{
  album: Pick<AlbumSummary, 'id' | 'title' | 'artist' | 'year' | 'format' | 'sleeveColor'>
  tracks: Track[] | null
}>()

/** Showing the back of the sleeve? */
const turned = defineModel<boolean>('turned', { default: false })
</script>

<template>
  <div class="stage">
    <!-- Behind the sleeve, sliding out to the right once the page appears. -->
    <div class="vinyl-slot">
      <VinylDisc :album="album" />
    </div>

    <!-- view-transition-name matches the sleeve in the crate, so it morphs into place. -->
    <div class="sleeve" :style="{ 'view-transition-name': sleeveTransitionName(album.id) }">
      <div class="flipper" :class="{ turned }" aria-hidden="true">
        <div class="face front"><SleeveArt :album="album" /></div>
        <div class="face back"><SleeveBack :album="album" :tracks="tracks" /></div>
      </div>
    </div>

    <button type="button" class="turn" :aria-pressed="turned" @click="turned = !turned">
      {{ turned ? 'Show the front' : 'Turn it over' }}
    </button>
  </div>
</template>

<style scoped>
.stage {
  /* Sleeve + the part of the vinyl that slides out must fit the screen (minus page padding). */
  --size: min(calc((100vw - 2rem) / 1.55), 17rem);
  --slide: 52%;

  position: relative;
  width: calc(var(--size) * (1 + 0.52));
  max-width: 100%;
  padding-bottom: 2.75rem; /* room for the button */
}

.sleeve,
.vinyl-slot {
  width: var(--size);
  aspect-ratio: 1;
}

.sleeve {
  position: relative;
  z-index: 1;
  perspective: 900px;
  filter: drop-shadow(6px 6px 0 rgb(0 0 0 / 0.15));
}

.vinyl-slot {
  position: absolute;
  top: 0;
  left: 0;
  padding: 3%;
  /* Hidden until the sleeve has landed (the page transition takes 0.55s), then slides out. */
  animation: slide-out 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.55s both;
}

.flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.2, 1);
}

.flipper.turned {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}

.back {
  transform: rotateY(180deg);
}

.turn {
  position: absolute;
  left: 0;
  bottom: 0;
  font-family: var(--font-display);
  font-size: 0.85rem;
  background: none;
  border: 1px solid var(--ink-soft);
  padding: 0.3rem 0.8rem;
}

@keyframes slide-out {
  from {
    opacity: 0;
    transform: translateX(0) rotate(-40deg);
  }
  10% {
    opacity: 1;
  }
  to {
    transform: translateX(var(--slide)) rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .vinyl-slot {
    animation: none;
    transform: translateX(var(--slide));
  }

  .flipper {
    transition: none;
  }
}
</style>
