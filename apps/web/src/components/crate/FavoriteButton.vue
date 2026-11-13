<script setup lang="ts">
import { ref, watch } from 'vue'
import { errorMessage } from '../../api/client.ts'
import { favoriteCrate, unfavoriteCrate } from '../../api/favorites.ts'

// Data classification: INTERNAL. Holds a crate id and the signed-in viewer's favorite state.

const props = defineProps<{ crateId: number; favorited: boolean }>()
const emit = defineEmits<{ changed: [favorited: boolean] }>()

const busy = ref(false)
const error = ref<string | null>(null)

// A reused button now showing another crate, or a new state, must not keep an old failure.
watch(
  () => [props.crateId, props.favorited],
  () => {
    error.value = null
  },
)

/**
 * Not optimistic: aria-pressed follows the prop, and the parent only changes the prop once the
 * server has agreed. So a failed request can't leave the button disagreeing with the server.
 */
async function toggle() {
  const crateId = props.crateId
  const next = !props.favorited
  busy.value = true
  error.value = null
  try {
    await (next ? favoriteCrate(crateId) : unfavoriteCrate(crateId))
    if (props.crateId === crateId) emit('changed', next)
  } catch (err) {
    if (props.crateId === crateId) error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span class="favorite-button">
    <button
      type="button"
      class="favorite"
      :aria-pressed="favorited"
      :disabled="busy"
      :aria-busy="busy"
      @click="toggle"
    >
      <span class="star" aria-hidden="true">{{ favorited ? '★' : '☆' }}</span>
      Favorite
    </button>
    <span v-if="error" class="favorite-error" role="alert">{{ error }}</span>
  </span>
</template>

<style scoped>
.favorite-button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
}

.favorite {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-display);
  font-size: 0.9rem;
  padding: 0.3rem 0.8rem;
  border: 2px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
}

.favorite[aria-pressed='true'] {
  background: var(--ink);
  color: var(--paper);
  box-shadow: 3px 3px 0 var(--marker-red);
}

.favorite[aria-pressed='true'] .star {
  color: var(--marker-red);
}

.favorite:disabled {
  opacity: 0.6;
  cursor: default;
}

.favorite-error {
  color: var(--marker-red);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
  text-align: center;
}
</style>
