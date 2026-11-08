<script setup lang="ts">
import { ref, watch } from 'vue'
import { errorMessage } from '../../api/client.ts'
import { follow, unfollow } from '../../api/follows.ts'

// Data classification: PUBLIC. Holds only a public username and the viewer's follow state.

const props = defineProps<{ username: string; following: boolean }>()
const emit = defineEmits<{ changed: [following: boolean] }>()

const busy = ref(false)
const error = ref<string | null>(null)

// A reused button now showing someone else, or a new state, must not keep an old failure.
watch(
  () => [props.username, props.following],
  () => {
    error.value = null
  },
)

/**
 * Not optimistic: the label follows the prop, and the parent only changes the prop once the
 * server has agreed. So a failed request can't leave the button disagreeing with the server.
 */
async function toggle() {
  const username = props.username
  const next = !props.following
  busy.value = true
  error.value = null
  try {
    await (next ? follow(username) : unfollow(username))
    if (props.username === username) emit('changed', next)
  } catch (err) {
    if (props.username === username) error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <span class="follow-button">
    <button type="button" class="btn" :disabled="busy" :aria-busy="busy" @click="toggle">
      {{ following ? 'Unfollow' : 'Follow' }}
    </button>
    <span v-if="error" class="follow-error" role="alert">{{ error }}</span>
  </span>
</template>

<style scoped>
.follow-button {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  max-width: 100%;
}

.btn {
  margin-left: 0;
}

.btn:disabled {
  opacity: 0.6;
}

.follow-error {
  color: var(--marker-red);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
</style>
