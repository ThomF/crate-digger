<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import type { AlbumSummary, Crate } from '@crate-digger/shared'
import { useCrateFlip } from '../../composables/useCrateFlip.ts'
import { sleevePose, visibleRange } from '../../utils/crateLayout.ts'
import { dividerFor } from '@crate-digger/shared/sorting'
import SleeveArt from './SleeveArt.vue'
import { sleeveTransitionName } from '../../viewTransitions.ts'

const props = defineProps<{ crate: Crate; albums: AlbumSummary[] }>()
const index = defineModel<number>('index', { required: true })
const emit = defineEmits<{ open: [album: AlbumSummary] }>()

const flip = useCrateFlip(index, () => props.albums.length)

// In a sorted crate, the first record of each section (A, B, …, or 1990s, …) has a
// divider standing in front of it. Manual crates have none.
const dividers = computed(() =>
  props.albums.map((album, i) => {
    const label = dividerFor(props.crate.sortBy, album)
    const previous = i > 0 ? dividerFor(props.crate.sortBy, props.albums[i - 1]!) : null
    return label !== null && label !== previous ? label : null
  }),
)

// Only draw the sleeves near the front; a 500-record crate still renders ~16 elements.
const drawn = computed(() => {
  const [start, end] = visibleRange(index.value, props.albums.length)
  return props.albums.slice(start, end).map((album, i) => {
    const offset = start + i - index.value
    return { album, offset, pose: sleevePose(offset), divider: dividers.value[start + i] }
  })
})

/** Typing a letter (or digit) jumps to the first section that starts with it. */
function jumpToDivider(key: string): boolean {
  if (key.length !== 1 || !/[a-z0-9#?]/i.test(key)) return false
  const wanted = key.toUpperCase()
  const target = dividers.value.findIndex((label) => label?.startsWith(wanted))
  if (target === -1) return false
  flip.goTo(target)
  return true
}

/** Staggers divider tabs left to right, like the cut tabs on real dividers. */
const tabOffset = (label: string) => `${8 + ((label.charCodeAt(0) * 7) % 5) * 15}%`

const current = computed(() => props.albums[index.value])

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return // leave browser shortcuts alone
  if (flip.onKeydown(event) || jumpToDivider(event.key)) return event.preventDefault()
  if (event.key === 'Enter' && current.value) {
    event.preventDefault()
    emit('open', current.value)
  }
}

function onSleeveClick(offset: number, album: AlbumSummary) {
  if (flip.dragged.value) return // that was the end of a drag, not a click
  if (offset === 0) emit('open', album)
  else flip.goTo(index.value + offset) // clicking a record further back flips to it
}

// Wheel must be a non-passive listener so preventDefault can stop the page scrolling.
const scene = useTemplateRef<HTMLElement>('scene')
onMounted(() => scene.value?.addEventListener('wheel', flip.onWheel, { passive: false }))
onBeforeUnmount(() => scene.value?.removeEventListener('wheel', flip.onWheel))

defineExpose({ focus: () => scene.value?.focus() })
</script>

<template>
  <div
    ref="scene"
    class="scene"
    tabindex="0"
    role="group"
    aria-roledescription="record crate"
    :aria-label="`${crate.label ?? crate.name} crate. Arrow keys flip, Enter pulls out the record.${
      crate.sortBy === 'manual' ? '' : ' Type a letter to jump to its divider.'
    }`"
    @keydown="onKeydown"
    @pointerdown="flip.onPointerDown"
    @pointermove="flip.onPointerMove"
    @pointerup="flip.onPointerUp"
    @pointercancel="flip.onPointerUp"
    @pointerleave="flip.onPointerUp"
  >
    <div class="crate" :style="{ '--crate-color': crate.color }">
      <div class="panel back" aria-hidden="true" />

      <div
        v-for="{ album, offset, pose, divider } in drawn"
        :key="album.id"
        class="sleeve"
        :class="{ current: offset === 0 }"
        :style="{
          transform: pose.transform,
          opacity: pose.opacity,
          zIndex: pose.zIndex,
          '--shade': pose.shade,
          // Only the front sleeve gets a name, so it alone lifts out to the album page.
          'view-transition-name': offset === 0 ? sleeveTransitionName(album.id) : 'none',
        }"
        aria-hidden="true"
        @click="onSleeveClick(offset, album)"
      >
        <span v-if="divider" class="divider-tab" :style="{ left: tabOffset(divider) }">
          {{ divider }}
        </span>
        <SleeveArt :album="album" />
      </div>

      <div class="panel front" aria-hidden="true">
        <span class="crate-label">{{ crate.label ?? crate.name }}</span>
      </div>
    </div>

    <p v-if="albums.length === 0" class="empty">Empty crate</p>
  </div>
</template>

<style scoped>
.scene {
  --sleeve: min(64vw, 17rem);
  --depth: 340px;

  position: relative;
  height: calc(var(--sleeve) * 1.5);
  /* Looking from above and in front, like standing over a crate in a shop. */
  perspective: 1100px;
  perspective-origin: 50% -30%;
  touch-action: none; /* we handle drags ourselves */
  user-select: none;
  cursor: grab;
  outline: none;
}

.scene:active {
  cursor: grabbing;
}

.scene:focus-visible .crate-label {
  outline: 3px solid var(--marker-red);
  outline-offset: 3px;
}

.crate {
  position: absolute;
  left: 50%;
  bottom: 6%;
  width: calc(var(--sleeve) * 1.18);
  height: var(--sleeve);
  transform: translateX(-50%);
  transform-style: preserve-3d;
}

.sleeve {
  position: absolute;
  left: calc(50% - var(--sleeve) / 2);
  bottom: 0;
  width: var(--sleeve);
  height: var(--sleeve);
  transform-origin: 50% 100%; /* pivot on the bottom edge, like a real record */
  transition:
    transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.3s;
  box-shadow: 0 -2px 6px rgb(0 0 0 / 0.25);
  backface-visibility: hidden;
  cursor: pointer;
}

/* The tab of a divider card standing just in front of this record. */
.divider-tab {
  position: absolute;
  bottom: 100%;
  min-width: 18%;
  padding: 0.15rem 0.5rem 0.4rem;
  text-align: center;
  font-family: var(--font-display);
  font-weight: bold;
  font-size: clamp(0.75rem, 3.5vw, 1rem);
  color: var(--ink);
  background: #e9dcc0;
  border: 1px solid rgb(0 0 0 / 0.25);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
}

/* Darken records deeper in the crate. */
.sleeve::after {
  content: '';
  position: absolute;
  inset: 0;
  background: #000;
  opacity: var(--shade);
  transition: opacity 0.45s;
  pointer-events: none;
}

.panel {
  position: absolute;
  left: 0;
  width: 100%;
  background:
    repeating-linear-gradient(90deg, rgb(0 0 0 / 0.06) 0 3px, transparent 3px 22px),
    linear-gradient(var(--crate-color), color-mix(in srgb, var(--crate-color), #000 25%));
  border: 2px solid color-mix(in srgb, var(--crate-color), #000 45%);
}

.front {
  bottom: -4%;
  height: 42%;
  transform: translateZ(70px);
  display: grid;
  place-items: center;
  box-shadow: 0 10px 18px rgb(0 0 0 / 0.3);
}

/* Hand-holes and the tape label, like a real milk-crate-style record box. */
.front::before {
  content: '';
  position: absolute;
  top: 14%;
  left: 50%;
  width: 28%;
  height: 12%;
  transform: translateX(-50%);
  border-radius: 999px;
  background: rgb(0 0 0 / 0.45);
}

.crate-label {
  margin-top: 12%;
  padding: 0.25rem 0.75rem;
  background: #f4efe2;
  color: var(--ink);
  font-family: var(--font-display);
  font-weight: bold;
  letter-spacing: 0.12em;
  font-size: clamp(0.7rem, 3.5vw, 0.95rem);
  transform: rotate(-1.5deg);
  box-shadow: 1px 1px 0 rgb(0 0 0 / 0.2);
}

.back {
  bottom: 0;
  height: 70%;
  transform: translateZ(calc(var(--depth) * -1));
  filter: brightness(0.6);
}

.empty {
  position: absolute;
  inset: 30% 0 auto;
  text-align: center;
  font-family: var(--font-display);
  color: var(--ink-soft);
}

@media (prefers-reduced-motion: reduce) {
  .sleeve,
  .sleeve::after {
    transition: none;
  }
}
</style>
