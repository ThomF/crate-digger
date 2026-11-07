<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import { MAX_PROFILE_LINKS, SOCIAL_PLATFORMS, type ProfileLinkInput } from '@frisson/shared'

// Data classification: PUBLIC. Profile links are shown to anyone on the profile page.
// Edits the list in display order. Errors are keyed like 'links.0.url' (see EditProfileView).
const links = defineModel<ProfileLinkInput[]>({ required: true })
defineProps<{ errors?: Record<string, string> }>()

const urlInputs = useTemplateRef<HTMLInputElement[]>('urls')

const PLATFORM_LABELS: Record<ProfileLinkInput['platform'], string> = {
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
  spotify: 'Spotify',
  bandcamp: 'Bandcamp',
  discogs: 'Discogs',
  website: 'Website',
}

// Always assign a new array: it's the parent's data, and replacing it keeps v-model honest.
async function add() {
  if (links.value.length >= MAX_PROFILE_LINKS) return // the API refuses a 7th too
  links.value = [...links.value, { platform: 'website', url: '' }]
  await nextTick() // wait for Vue to render the new row, then put the cursor in it
  urlInputs.value?.at(-1)?.focus()
}

function remove(index: number) {
  links.value = links.value.filter((_, i) => i !== index)
}

function move(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= links.value.length) return
  const next = [...links.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  links.value = next
}

const nameFor = (link: ProfileLinkInput, i: number) =>
  `${PLATFORM_LABELS[link.platform] ?? link.platform} link ${i + 1}`
</script>

<template>
  <fieldset class="links">
    <legend>Links</legend>

    <ol v-if="links.length" class="rows">
      <li v-for="(link, i) in links" :key="i" class="row">
        <label class="sr-only" :for="`link-platform-${i}`">Platform for link {{ i + 1 }}</label>
        <select :id="`link-platform-${i}`" v-model="link.platform" class="platform">
          <option v-for="platform in SOCIAL_PLATFORMS" :key="platform" :value="platform">
            {{ PLATFORM_LABELS[platform] }}
          </option>
        </select>

        <label class="sr-only" :for="`link-url-${i}`">Address of link {{ i + 1 }}</label>
        <input
          :id="`link-url-${i}`"
          ref="urls"
          v-model="link.url"
          type="url"
          class="url"
          placeholder="https://…"
          maxlength="2048"
          autocomplete="off"
          :aria-invalid="!!errors?.[`links.${i}.url`]"
        />

        <span class="actions">
          <button
            type="button"
            :disabled="i === 0"
            :aria-label="`Move ${nameFor(link, i)} up`"
            @click="move(i, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            :disabled="i === links.length - 1"
            :aria-label="`Move ${nameFor(link, i)} down`"
            @click="move(i, 1)"
          >
            ↓
          </button>
          <button type="button" :aria-label="`Remove ${nameFor(link, i)}`" @click="remove(i)">
            ×
          </button>
        </span>

        <p v-if="errors?.[`links.${i}.url`] || errors?.[`links.${i}`]" class="error">
          {{ errors?.[`links.${i}.url`] ?? errors?.[`links.${i}`] }}
        </p>
      </li>
    </ol>
    <p v-else class="empty">No links yet.</p>

    <button type="button" class="add" :disabled="links.length >= MAX_PROFILE_LINKS" @click="add">
      + Add link
    </button>
    <p class="hint">
      Up to {{ MAX_PROFILE_LINKS }} links, each a full https:// address. Shown in this order.
    </p>
    <p v-if="errors?.links" class="error">{{ errors.links }}</p>
  </fieldset>
</template>

<style scoped>
.links {
  border: none;
  margin: 0;
  padding: 0;
}

legend {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
  padding: 0;
  margin-bottom: 0.25rem;
}

.rows {
  list-style: none;
  margin: 0 0 0.5rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.row {
  display: grid;
  grid-template-columns: 9rem 1fr auto;
  gap: 0.4rem;
  align-items: center;
}

.actions {
  display: flex;
  gap: 0.2rem;
}

.actions button {
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--ink-soft);
  background: var(--paper);
  font-family: var(--font-display);
}

.actions button:disabled {
  opacity: 0.35;
  cursor: default;
}

.error {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--marker-red);
  font-size: 0.85rem;
}

.empty,
.hint {
  margin: 0.25rem 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
}

.add {
  font-family: var(--font-display);
  border: 1px dashed var(--ink-soft);
  background: none;
  padding: 0.35rem 0.9rem;
}

.add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 30rem) {
  .row {
    grid-template-columns: 1fr auto;
  }

  .url {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
