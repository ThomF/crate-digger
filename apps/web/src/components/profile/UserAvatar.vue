<script setup lang="ts">
// A round avatar: the uploaded picture, or the user's initials on cardboard.
// Decorative: whatever wraps it (e.g. the header account button) carries the name.
import { computed } from 'vue'
import { initials } from '../../utils/initials.ts'

const props = defineProps<{
  avatarUrl: string | null
  displayName: string
  username: string
  /** Extra class for sizing, e.g. "is-small". */
  size?: string
}>()

const letters = computed(() => initials(props.displayName, props.username))
</script>

<template>
  <img v-if="avatarUrl" class="user-avatar" :class="size" :src="avatarUrl" alt="" />
  <span v-else class="user-avatar placeholder" :class="size" aria-hidden="true">{{ letters }}</span>
</template>

<style scoped>
.user-avatar {
  display: inline-flex;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: 2px solid var(--ink);
  object-fit: cover;
  flex: none;
}

.placeholder {
  align-items: center;
  justify-content: center;
  background: var(--cardboard);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: bold;
  line-height: 1;
}
</style>
