<script setup lang="ts">
import { computed } from 'vue'
import type { AlbumSummary, Track } from '@crate-digger/shared'
import { groupBySide, formatDuration } from '../../utils/tracks.ts'
import { readableInk } from '../../utils/color.ts'

// The printed back of the sleeve. Decorative (the page shows the same facts as real text),
// so it's aria-hidden by its parent.
const props = defineProps<{
  album: Pick<AlbumSummary, 'id' | 'title' | 'artist' | 'year' | 'format' | 'sleeveColor'>
  tracks: Track[] | null // null while the full album is still loading
}>()

const sides = computed(() => (props.tracks ? groupBySide(props.tracks) : []))
const trackCount = computed(() => props.tracks?.length ?? 0)
const ink = computed(() => readableInk(props.album.sleeveColor))
const catalogNo = computed(() => `CDR-${String(props.album.id).padStart(4, '0')}`)
</script>

<template>
  <div
    class="sleeve-back"
    :class="{ dense: trackCount > 12 }"
    :style="{ '--sleeve-color': album.sleeveColor, '--ink': ink }"
  >
    <p class="heading">
      <strong>{{ album.artist }}</strong> — {{ album.title }}
    </p>

    <div v-if="sides.length" class="sides">
      <section v-for="group in sides" :key="group.side">
        <h4>Side {{ group.side }}</h4>
        <ol>
          <li v-for="track in group.tracks" :key="track.id">
            <span>{{ group.side }}{{ track.position }}. {{ track.title }}</span>
            <span v-if="track.durationSec">{{ formatDuration(track.durationSec) }}</span>
          </li>
        </ol>
      </section>
    </div>
    <p v-else class="no-tracks">{{ tracks ? 'Tracklist not printed.' : '…' }}</p>

    <footer class="small-print">
      <span>{{ catalogNo }}</span>
      <span>{{ [album.format, album.year].filter(Boolean).join(' · ') }}</span>
      <span class="barcode" />
    </footer>
  </div>
</template>

<style scoped>
.sleeve-back {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* % here, not cqw: an element's cqw is measured against its *ancestor* container,
     and this element is the container. Its children can use cqw. */
  gap: 3%;
  padding: 7%;
  /* Back covers were often a paler print of the front color. */
  background: color-mix(in srgb, var(--sleeve-color), #fff 18%);
  color: var(--ink);
  font-family: var(--font-display);
  container-type: inline-size;
}

.heading {
  margin: 0;
  font-size: 5cqw;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 0.5cqw solid currentColor;
  padding-bottom: 2cqw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sides {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2cqw 5cqw;
  align-content: start;
  min-height: 0;
}

h4 {
  margin: 0 0 1cqw;
  font-size: 4.2cqw;
  letter-spacing: 0.1em;
}

ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: flex;
  justify-content: space-between;
  gap: 2cqw;
  font-size: 4cqw;
  line-height: 1.35;
}

li span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dense li {
  font-size: 3.2cqw;
}

.no-tracks {
  flex: 1;
  margin: 0;
  font-size: 4cqw;
  opacity: 0.7;
}

.small-print {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  font-size: 3.6cqw;
}

/* A fake barcode, because every back cover had one. */
.barcode {
  width: 22cqw;
  height: 9cqw;
  background:
    repeating-linear-gradient(
      90deg,
      #111 0 0.5cqw,
      transparent 0.5cqw 1cqw,
      #111 1cqw 2cqw,
      transparent 2cqw 2.4cqw
    ),
    #fff;
  border: 1cqw solid #fff;
}
</style>
