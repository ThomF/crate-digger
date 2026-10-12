<script setup lang="ts">
import { ALBUM_FORMATS, type Crate } from '@crate-digger/shared'
import { FORM_ERROR, type AlbumFormState, type FieldErrors } from '../../forms/albumForm.ts'
import RatingInput from './RatingInput.vue'
import TrackEditor from './TrackEditor.vue'

// This component only renders and edits the form. Saving is the parent view's job,
// so the same form works for both "add" and "edit".
const form = defineModel<AlbumFormState>({ required: true })

defineProps<{
  crates: Crate[]
  errors: FieldErrors
  saving: boolean
  submitLabel: string
  genreSuggestions: string[]
}>()

const emit = defineEmits<{ submit: []; cancel: [] }>()

// Links an input to its error message for screen readers.
const describedBy = (field: string, errors: FieldErrors) =>
  errors[field] ? `${field}-error` : undefined
</script>

<template>
  <form class="card" novalidate @submit.prevent="emit('submit')">
    <p v-if="errors[FORM_ERROR]" class="form-error" role="alert">{{ errors[FORM_ERROR] }}</p>

    <div class="grid">
      <div class="field wide">
        <label for="title">Title</label>
        <input
          id="title"
          v-model="form.title"
          autocomplete="off"
          :aria-invalid="!!errors.title"
          :aria-describedby="describedBy('title', errors)"
        />
        <p v-if="errors.title" id="title-error" class="error">{{ errors.title }}</p>
      </div>

      <div class="field wide">
        <label for="artist">Artist</label>
        <input
          id="artist"
          v-model="form.artist"
          autocomplete="off"
          :aria-invalid="!!errors.artist"
          :aria-describedby="describedBy('artist', errors)"
        />
        <p v-if="errors.artist" id="artist-error" class="error">{{ errors.artist }}</p>
      </div>

      <div class="field">
        <label for="crate">Crate</label>
        <select
          id="crate"
          v-model="form.crateId"
          :aria-invalid="!!errors.crateId"
          :aria-describedby="describedBy('crateId', errors)"
        >
          <option :value="null" disabled>Pick a crate…</option>
          <option v-for="crate in crates" :key="crate.id" :value="crate.id">
            {{ crate.label ?? crate.name }}
          </option>
        </select>
        <p v-if="errors.crateId" id="crateId-error" class="error">{{ errors.crateId }}</p>
      </div>

      <div class="field">
        <label for="year">Year</label>
        <input
          id="year"
          v-model="form.year"
          inputmode="numeric"
          placeholder="1994"
          :aria-invalid="!!errors.year"
          :aria-describedby="describedBy('year', errors)"
        />
        <p v-if="errors.year" id="year-error" class="error">{{ errors.year }}</p>
      </div>

      <div class="field">
        <label for="genre">Genre</label>
        <input
          id="genre"
          v-model="form.genre"
          list="genre-suggestions"
          autocomplete="off"
          :aria-invalid="!!errors.genre"
          :aria-describedby="describedBy('genre', errors)"
        />
        <datalist id="genre-suggestions">
          <option v-for="genre in genreSuggestions" :key="genre" :value="genre" />
        </datalist>
        <p v-if="errors.genre" id="genre-error" class="error">{{ errors.genre }}</p>
      </div>

      <div class="field">
        <label for="format">Format</label>
        <select id="format" v-model="form.format">
          <option v-for="format in ALBUM_FORMATS" :key="format" :value="format">
            {{ format }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="sleeve">Sleeve color</label>
        <span class="color">
          <input id="sleeve" v-model="form.sleeveColor" type="color" />
          <code>{{ form.sleeveColor }}</code>
        </span>
        <p v-if="errors.sleeveColor" class="error">{{ errors.sleeveColor }}</p>
      </div>

      <div class="field">
        <RatingInput v-model="form.rating" />
      </div>

      <div class="field wide">
        <label for="notes">Notes</label>
        <textarea
          id="notes"
          v-model="form.notes"
          rows="3"
          placeholder="Pressing, where you found it, which side to play first…"
          :aria-invalid="!!errors.notes"
          :aria-describedby="describedBy('notes', errors)"
        />
        <p v-if="errors.notes" id="notes-error" class="error">{{ errors.notes }}</p>
      </div>

      <div class="field wide">
        <TrackEditor v-model="form.tracks" :errors="errors" />
      </div>
    </div>

    <div class="buttons">
      <button type="submit" class="btn" :disabled="saving">
        {{ saving ? 'Saving…' : submitLabel }}
      </button>
      <button type="button" class="link" @click="emit('cancel')">Cancel</button>
      <slot name="extra-actions" />
    </div>
  </form>
</template>

<style scoped>
/* A record-store index card: ruled paper with a red header line. */
.card {
  background:
    linear-gradient(var(--marker-red), var(--marker-red)) 0 2.5rem / 100% 2px no-repeat,
    #fffdf7;
  border: 1px solid var(--paper-dark);
  box-shadow: 4px 4px 0 rgb(0 0 0 / 0.1);
  padding: 3.25rem 1.5rem 1.5rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 1rem 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.wide {
  grid-column: 1 / -1;
}

label {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-soft);
}

.color {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color input {
  width: 3rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--ink-soft);
}

.error {
  margin: 0;
  color: var(--marker-red);
  font-size: 0.85rem;
}

.form-error {
  margin: 0 0 1rem;
  padding: 0.5rem 0.75rem;
  border-left: 4px solid var(--marker-red);
  background: #fdecea;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.buttons .btn {
  margin-left: 0;
  padding: 0.5rem 1.4rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: progress;
}

.link {
  background: none;
  border: none;
  text-decoration: underline;
  font-family: var(--font-display);
}
</style>
