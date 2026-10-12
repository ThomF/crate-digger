<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// Pick or drop an image, preview it, or remove the saved cover. Nothing is uploaded here:
// the editor uploads the chosen file after saving the album.
const props = defineProps<{
  coverPath: string | null
  sleeveColor: string
  error?: string
}>()
const file = defineModel<File | null>('file', { required: true })
const remove = defineModel<boolean>('remove', { required: true })

// A temporary local URL so the browser can show the picked file before it's uploaded.
// Each one holds the file in memory until revoked, so revoke the old one on every change.
const previewUrl = ref<string | null>(null)
watch(
  file,
  (next) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = next ? URL.createObjectURL(next) : null
  },
  { immediate: true },
)
onBeforeUnmount(() => previewUrl.value && URL.revokeObjectURL(previewUrl.value))

const shown = computed(() => previewUrl.value ?? (remove.value ? null : props.coverPath))
const dragging = ref(false)

function choose(picked: File | undefined) {
  if (!picked) return
  file.value = picked
  remove.value = false
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  choose(input.files?.[0])
  input.value = '' // so picking the same file again still fires a change
}

function onDrop(event: DragEvent) {
  dragging.value = false
  choose(event.dataTransfer?.files[0])
}

function clear() {
  if (file.value) file.value = null
  else remove.value = true
}
</script>

<template>
  <div class="cover-field">
    <span class="label">Cover</span>
    <div class="row">
      <div
        class="preview"
        :class="{ dragging }"
        :style="{ background: sleeveColor }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <img v-if="shown" :src="shown" alt="Cover preview" />
        <span v-else class="empty">Drop an image here</span>
      </div>

      <div class="actions">
        <!-- A real file input (focusable, screen-reader friendly), dressed up as a button. -->
        <label class="pick">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="sr-only"
            :aria-invalid="!!error"
            :aria-describedby="error ? 'cover-error' : undefined"
            @change="onInput"
          />
          {{ shown ? 'Choose another…' : 'Choose image…' }}
        </label>
        <button v-if="shown" type="button" class="link" @click="clear">
          {{ file ? 'Undo' : 'Remove cover' }}
        </button>
        <p v-if="file" class="hint">{{ file.name }} uploads when you save.</p>
        <p v-else-if="remove && coverPath" class="hint">The cover will be removed when you save.</p>
        <p v-else class="hint">JPEG, PNG or WebP, up to 10 MB. Cropped to a square.</p>
      </div>
    </div>
    <p v-if="error" id="cover-error" class="error">{{ error }}</p>
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
  width: 7rem;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid var(--ink-soft);
  box-shadow: 3px 3px 0 rgb(0 0 0 / 0.12);
  overflow: hidden;
}

.preview.dragging {
  outline: 3px dashed var(--marker-red);
  outline-offset: 3px;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty {
  font-family: var(--font-display);
  font-size: 0.75rem;
  text-align: center;
  padding: 0.5rem;
  color: #fff;
  mix-blend-mode: difference;
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
