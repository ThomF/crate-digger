<script setup lang="ts">
import { useId } from 'vue'

// defineModel = this component supports v-model; `rating` reads and writes the parent's value.
const rating = defineModel<number>({ required: true })

const group = useId() // a unique name ties the radio buttons into one group
</script>

<template>
  <!-- Real radio buttons underneath, so arrow keys and screen readers work; stars on top. -->
  <fieldset class="rating">
    <legend>Rating</legend>
    <label v-for="n in 5" :key="n" class="star" :class="{ on: n <= rating }">
      <input v-model="rating" type="radio" :name="group" :value="n" class="sr-only" />
      <span aria-hidden="true">★</span>
      <span class="sr-only">{{ n }} {{ n === 1 ? 'star' : 'stars' }}</span>
    </label>
    <button type="button" class="clear" :disabled="rating === 0" @click="rating = 0">
      No rating
    </button>
  </fieldset>
</template>

<style scoped>
.rating {
  border: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.1rem;
}

legend {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
  padding: 0;
  margin-bottom: 0.25rem;
}

.star {
  font-size: 1.6rem;
  line-height: 1;
  color: var(--paper-dark);
  cursor: pointer;
}

.star.on {
  color: var(--star);
}

.star:has(:focus-visible) {
  outline: 3px solid var(--marker-red);
  outline-offset: 1px;
}

.clear {
  margin-left: 0.75rem;
  background: none;
  border: none;
  font-family: var(--font-display);
  font-size: 0.8rem;
  color: var(--ink-soft);
  text-decoration: underline;
}

.clear:disabled {
  visibility: hidden;
}
</style>
