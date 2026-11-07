<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { MAX_AVATAR_BYTES, type PublicProfile } from '@frisson/shared'
import { errorMessage } from '../../api/client.ts'
import { useSessionStore } from '../../stores/session.ts'

// Data classification: PUBLIC. The avatar is shown to anyone on the profile page.
// Unlike the album cover, the avatar is uploaded (or removed) as soon as it's picked:
// there is no separate save step for it.
const props = defineProps<{ avatarUrl: string | null; displayName: string }>()
const emit = defineEmits<{ changed: [profile: PublicProfile] }>()

const ACCEPT = 'image/jpeg,image/png,image/webp'
const ACCEPTED = new Set(ACCEPT.split(','))
const MAX_MB = Math.round(MAX_AVATAR_BYTES / (1024 * 1024))

const session = useSessionStore()
const busy = ref(false)
const error = ref<string | null>(null)

// A temporary local URL so the picked file shows while (and after) it uploads.
// Each one holds the file in memory until revoked, so revoke the old one on every change.
const previewUrl = ref<string | null>(null)
function setPreview(next: string | null) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = next
}
onBeforeUnmount(() => setPreview(null))

const shown = computed(() => previewUrl.value ?? props.avatarUrl)
const initial = computed(() => props.displayName.trim().charAt(0).toUpperCase() || '?')

async function upload(file: File) {
  error.value = null
  if (!ACCEPTED.has(file.type)) {
    error.value = 'Use a JPEG, PNG or WebP image.'
    return
  }
  if (file.size > MAX_AVATAR_BYTES) {
    error.value = `That image is too big. Keep it under ${MAX_MB} MB.`
    return
  }

  const before = previewUrl.value
  previewUrl.value = URL.createObjectURL(file)
  busy.value = true
  try {
    const profile = await session.saveAvatar(file)
    if (before) URL.revokeObjectURL(before)
    emit('changed', profile)
  } catch (err) {
    // Didn't upload: go back to whatever was showing before.
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = before
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  input.value = '' // so picking the same file again still fires a change
  if (picked) void upload(picked)
}

async function remove() {
  error.value = null
  busy.value = true
  try {
    const profile = await session.deleteAvatar()
    setPreview(null)
    emit('changed', profile)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="avatar-field">
    <span class="label">Avatar</span>
    <div class="row">
      <div class="preview">
        <img v-if="shown" :src="shown" alt="Avatar preview" />
        <span v-else class="empty" aria-hidden="true">{{ initial }}</span>
      </div>

      <div class="actions">
        <!-- A real file input (focusable, screen-reader friendly), dressed up as a button. -->
        <label class="pick" :class="{ busy }">
          <input
            type="file"
            :accept="ACCEPT"
            class="sr-only"
            :disabled="busy"
            :aria-invalid="!!error"
            :aria-describedby="error ? 'avatar-error' : undefined"
            @change="onInput"
          />
          {{ busy ? 'Working…' : shown ? 'Choose another…' : 'Choose image…' }}
        </label>
        <button v-if="shown" type="button" class="link" :disabled="busy" @click="remove">
          Remove avatar
        </button>
        <p class="hint">JPEG, PNG or WebP, up to {{ MAX_MB }} MB. Saved right away.</p>
      </div>
    </div>
    <p v-if="error" id="avatar-error" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.label {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
}

.row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-top: 0.25rem;
}

.preview {
  flex: none;
  width: 6rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid var(--ink-soft);
  background: var(--cardboard);
  box-shadow: 3px 3px 0 rgb(0 0 0 / 0.12);
  overflow: hidden;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty {
  font-family: var(--font-display);
  font-size: 2.5rem;
  color: var(--paper);
}

.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
}

.pick {
  font-family: var(--font-display);
  border: 1px solid var(--ink);
  padding: 0.35rem 0.9rem;
  cursor: pointer;
  background: var(--paper);
}

.pick.busy {
  cursor: progress;
  opacity: 0.6;
}

.pick:focus-within {
  outline: 3px solid var(--marker-red);
  outline-offset: 2px;
}

.link {
  background: none;
  border: none;
  padding: 0;
  text-decoration: underline;
  font-family: var(--font-display);
  font-size: 0.85rem;
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
}

.error {
  margin: 0.35rem 0 0;
  color: var(--marker-red);
  font-size: 0.85rem;
}
</style>
