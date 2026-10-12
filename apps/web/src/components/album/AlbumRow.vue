<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { AlbumSummary } from '@crate-digger/shared'
import RatingStars from './RatingStars.vue'
import { sleeveTransitionName } from '../../viewTransitions.ts'

defineProps<{ album: AlbumSummary }>()
</script>

<template>
  <RouterLink :to="{ name: 'album', params: { id: album.id } }" class="row">
    <!-- A tiny sleeve: the cover if there is one, otherwise the sleeve color. -->
    <span
      class="sleeve"
      :style="{
        background: album.sleeveColor,
        'view-transition-name': sleeveTransitionName(album.id),
      }"
      aria-hidden="true"
    >
      <img v-if="album.coverPath" :src="album.coverPath" alt="" loading="lazy" decoding="async" />
    </span>
    <span class="text">
      <span class="title">{{ album.title }}</span>
      <span class="artist">{{ album.artist }}</span>
    </span>
    <span class="meta">
      <span>{{ [album.year, album.format].filter(Boolean).join(' · ') }}</span>
      <RatingStars :rating="album.rating" />
    </span>
  </RouterLink>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 3rem 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0.75rem;
  text-decoration: none;
  border-bottom: 1px solid var(--paper-dark);
}

.row:hover {
  background: var(--paper-dark);
}

.sleeve img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sleeve {
  width: 3rem;
  aspect-ratio: 1;
  border: 1px solid rgb(0 0 0 / 0.2);
  box-shadow: 2px 2px 0 rgb(0 0 0 / 0.15);
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist {
  color: var(--ink-soft);
}

.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
}
</style>
