<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CRATE_SORTS, type CrateSort } from '@crate-digger/shared/sorting'
import type { Crate } from '@crate-digger/shared'

// One crate's settings as a small form. The parent does the saving; this component
// keeps an editable draft and says what changed.
const props = defineProps<{
  /** null = the "new crate" form. */
  crate: Crate | null
  recordCount?: number
  errors?: Record<string, string>
  busy?: boolean
}>()

const emit = defineEmits<{
  save: [changes: { name?: string; label?: string | null; color?: string; sortBy?: CrateSort }]
  delete: []
}>()

const SORT_LABELS: Record<CrateSort, string> = {
  manual: 'As I arrange them',
  artist: 'A–Z by artist',
  title: 'A–Z by title',
  year: 'By year (decade dividers)',
}

const blank = () => ({
  name: props.crate?.name ?? '',
  label: props.crate?.label ?? '',
  color: props.crate?.color ?? '#c8a374',
  sortBy: props.crate?.sortBy ?? ('manual' as CrateSort),
})
const draft = ref(blank())
// When the saved crate changes (after a save), start again from it.
watch(
  () => props.crate,
  () => (draft.value = blank()),
)

const changes = computed(() => {
  const original = blank()
  const result: Record<string, unknown> = {}
  for (const key of ['name', 'label', 'color', 'sortBy'] as const) {
    if (draft.value[key] !== original[key]) result[key] = draft.value[key]
  }
  if ('label' in result) result.label = draft.value.label.trim() || null
  return result
})
const isNew = computed(() => props.crate === null)
const canSave = computed(() => !props.busy && (isNew.value || Object.keys(changes.value).length))

function submit() {
  emit(
    'save',
    isNew.value ? { ...draft.value, label: draft.value.label.trim() || null } : changes.value,
  )
  if (isNew.value) draft.value = blank()
}

const idFor = (field: string) => `crate-${props.crate?.id ?? 'new'}-${field}`
</script>

<template>
  <form class="settings" novalidate @submit.prevent="submit">
    <span class="swatch" :style="{ background: draft.color }" aria-hidden="true">
      {{ draft.label || draft.name || '?' }}
    </span>

    <div class="field">
      <label :for="idFor('name')">Name</label>
      <input
        :id="idFor('name')"
        v-model="draft.name"
        required
        :aria-invalid="!!errors?.name"
        placeholder="Jazz"
      />
      <p v-if="errors?.name" class="error">{{ errors.name }}</p>
    </div>

    <div class="field">
      <label :for="idFor('label')">Tape label</label>
      <input
        :id="idFor('label')"
        v-model="draft.label"
        :placeholder="draft.name || 'Same as name'"
      />
    </div>

    <div class="field">
      <label :for="idFor('sort')">Keep records</label>
      <select :id="idFor('sort')" v-model="draft.sortBy">
        <option v-for="sort in CRATE_SORTS" :key="sort" :value="sort">
          {{ SORT_LABELS[sort] }}
        </option>
      </select>
    </div>

    <div class="field color">
      <label :for="idFor('color')">Color</label>
      <input :id="idFor('color')" v-model="draft.color" type="color" />
    </div>

    <div class="actions">
      <button type="submit" class="btn" :disabled="!canSave">
        {{ isNew ? 'Add crate' : 'Save' }}
      </button>
      <slot name="actions" />
      <button
        v-if="!isNew"
        type="button"
        class="danger"
        :disabled="busy || (recordCount ?? 0) > 0"
        :title="recordCount ? `Move its ${recordCount} records out first` : undefined"
        @click="emit('delete')"
      >
        Delete
      </button>
    </div>

    <p v-if="!isNew && recordCount" class="hint">
      {{ recordCount }} {{ recordCount === 1 ? 'record' : 'records' }}. A crate can only be deleted
      once it's empty.
    </p>
    <p v-if="errors?._form" class="error" role="alert">{{ errors._form }}</p>
  </form>
</template>

<style scoped>
.settings {
  display: grid;
  grid-template-columns: 5rem repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem 1rem;
  align-items: end;
  padding: 1rem;
  background: #fffdf7;
  border: 1px solid var(--paper-dark);
  box-shadow: 3px 3px 0 rgb(0 0 0 / 0.08);
}

.swatch {
  grid-row: span 2;
  align-self: stretch;
  display: grid;
  place-items: center;
  padding: 0.25rem;
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: bold;
  text-align: center;
  word-break: break-word;
  border: 2px solid rgb(0 0 0 / 0.35);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

label {
  font-family: var(--font-display);
  font-size: 0.8rem;
  color: var(--ink-soft);
}

.color input {
  width: 3rem;
  height: 2.1rem;
  padding: 0;
}

.actions {
  grid-column: 2 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.actions .btn {
  margin-left: 0;
}

.actions :deep(button),
.danger {
  font-family: var(--font-display);
}

.btn:disabled,
.danger:disabled {
  opacity: 0.4;
  cursor: default;
}

.danger {
  margin-left: auto;
  background: none;
  border: 1px solid var(--marker-red);
  color: var(--marker-red);
  padding: 0.35rem 0.8rem;
}

.hint,
.error {
  grid-column: 2 / -1;
  margin: 0;
  font-size: 0.8rem;
}

.hint {
  color: var(--ink-soft);
}

.error {
  color: var(--marker-red);
}

@media (max-width: 36rem) {
  .settings {
    grid-template-columns: 1fr;
  }

  .swatch {
    grid-row: auto;
    min-height: 2.5rem;
  }

  .actions,
  .hint,
  .error {
    grid-column: auto;
  }
}
</style>
