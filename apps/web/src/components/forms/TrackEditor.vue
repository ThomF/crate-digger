<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import { TRACK_SIDES } from '@crate-digger/shared'
import {
  newTrackRow,
  trackErrorKey,
  type FieldErrors,
  type TrackRow,
} from '../../forms/albumForm.ts'

const rows = defineModel<TrackRow[]>({ required: true })
defineProps<{ errors: FieldErrors }>()

const titleInputs = useTemplateRef<HTMLInputElement[]>('titles')

/** "A1", "A2", "B1"… — numbered by order within each side, like the label on the record. */
const labels = computed(() => {
  const perSide: Record<string, number> = {}
  return rows.value.map((row) => `${row.side}${(perSide[row.side] = (perSide[row.side] ?? 0) + 1)}`)
})

// Always assign a new array: it's the parent's data, and replacing it keeps v-model honest.
async function addRow() {
  rows.value = [...rows.value, newTrackRow(rows.value.at(-1)?.side ?? 'A')]
  await nextTick() // wait for Vue to render the new input, then put the cursor in it
  titleInputs.value?.at(-1)?.focus()
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
}

function moveRow(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= rows.value.length) return
  const next = [...rows.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  rows.value = next
}

const nameFor = (row: TrackRow, i: number) => row.title.trim() || `track ${i + 1}`
</script>

<template>
  <fieldset class="tracks">
    <legend>Tracklist</legend>

    <ol v-if="rows.length" class="rows">
      <li v-for="(row, i) in rows" :key="row.key" class="row">
        <span class="label" aria-hidden="true">{{ labels[i] }}</span>

        <label class="sr-only" :for="`side-${row.key}`">Side for {{ nameFor(row, i) }}</label>
        <select :id="`side-${row.key}`" v-model="row.side" class="side">
          <option v-for="side in TRACK_SIDES" :key="side" :value="side">{{ side }}</option>
        </select>

        <label class="sr-only" :for="`title-${row.key}`">Title of track {{ i + 1 }}</label>
        <input
          :id="`title-${row.key}`"
          ref="titles"
          v-model="row.title"
          class="title"
          placeholder="Track title"
          :aria-invalid="!!errors[trackErrorKey(row, 'title')]"
          @keydown.enter.prevent="i === rows.length - 1 ? addRow() : undefined"
        />

        <label class="sr-only" :for="`duration-${row.key}`">Length of {{ nameFor(row, i) }}</label>
        <input
          :id="`duration-${row.key}`"
          v-model="row.duration"
          class="duration"
          placeholder="m:ss"
          inputmode="numeric"
          :aria-invalid="!!errors[trackErrorKey(row, 'duration')]"
        />

        <span class="actions">
          <button
            type="button"
            :disabled="i === 0"
            :aria-label="`Move ${nameFor(row, i)} up`"
            @click="moveRow(i, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            :disabled="i === rows.length - 1"
            :aria-label="`Move ${nameFor(row, i)} down`"
            @click="moveRow(i, 1)"
          >
            ↓
          </button>
          <button type="button" :aria-label="`Remove ${nameFor(row, i)}`" @click="removeRow(i)">
            ×
          </button>
        </span>

        <p
          v-if="errors[trackErrorKey(row, 'title')] || errors[trackErrorKey(row, 'duration')]"
          class="error"
        >
          {{ errors[trackErrorKey(row, 'title')] ?? errors[trackErrorKey(row, 'duration')] }}
        </p>
      </li>
    </ol>
    <p v-else class="empty">No tracks yet.</p>

    <button type="button" class="add" @click="addRow">+ Add track</button>
    <p class="hint">Enter on the last title adds another row. Blank rows are ignored.</p>
  </fieldset>
</template>

<style scoped>
.tracks {
  border: none;
  margin: 0;
  padding: 0;
}

legend {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
  padding: 0;
  margin-bottom: 0.5rem;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.row {
  display: grid;
  grid-template-columns: 2.25rem 3.5rem 1fr 4.5rem auto;
  gap: 0.4rem;
  align-items: center;
}

.label {
  font-family: var(--font-display);
  color: var(--ink-soft);
}

.actions {
  display: flex;
  gap: 0.2rem;
}

.actions button {
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border: 1px solid var(--ink-soft);
  background: var(--paper);
}

.actions button:disabled {
  opacity: 0.3;
  cursor: default;
}

.error {
  grid-column: 3 / -1;
  margin: 0;
  color: var(--marker-red);
  font-size: 0.85rem;
}

.add {
  margin-top: 0.6rem;
  background: none;
  border: 1px dashed var(--ink-soft);
  padding: 0.35rem 0.9rem;
  font-family: var(--font-display);
}

.hint,
.empty {
  font-size: 0.8rem;
  color: var(--ink-soft);
  margin: 0.4rem 0 0;
}

@media (max-width: 36rem) {
  .row {
    grid-template-columns: 2rem 3.25rem 1fr 4rem;
  }

  .actions {
    grid-column: 3 / -1;
    justify-content: flex-end;
  }
}
</style>
