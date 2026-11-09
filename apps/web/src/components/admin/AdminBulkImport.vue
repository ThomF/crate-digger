<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { AdminImportRequest, AdminImportResult } from '@frisson/shared'
import { runAdminImport } from '../../api/admin.ts'
import AdminFormError from './AdminFormError.vue'
import { toFormError, type FormError } from './adminPanel.ts'

// Data classification: INTERNAL. Crates, records and news an admin pastes in; no user data.
const emit = defineEmits<{ imported: [] }>()

const EXAMPLE = `{
  "crates": [
    {
      "name": "Late Night Dub",
      "suggested": true,
      "albums": [
        { "title": "Harbor Lights", "artist": "The Tide", "year": 1979 }
      ]
    }
  ],
  "news": [
    { "title": "Fair returns", "summary": "Back in spring.", "source": "The Wax Gazette" }
  ]
}`

const id = useId()
const text = ref('')
const busy = ref(false)
const error = ref<FormError | null>(null)
const result = ref<AdminImportResult | null>(null)

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const summary = computed(() => {
  const r = result.value
  if (!r) return ''
  const parts = [
    counted(r.crates, 'crate', 'crates'),
    counted(r.albums, 'album', 'albums'),
    counted(r.tracks, 'track', 'tracks'),
    counted(r.news, 'news item', 'news items'),
  ]
  return `Imported ${parts.join(', ')}.`
})

/** Returns the payload, or null after saying what is wrong with the text. */
function parsePayload(): AdminImportRequest | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.value)
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'it could not be read'
    error.value = { message: `That is not valid JSON: ${detail}`, issues: [] }
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    error.value = { message: 'The JSON must be an object with crates and/or news.', issues: [] }
    return null
  }
  // The shape is the API's to judge; it answers with one issue per bad field.
  return parsed as AdminImportRequest
}

async function submit() {
  if (busy.value) return // a double post would create everything twice
  error.value = null
  result.value = null
  const payload = parsePayload()
  if (!payload) return
  busy.value = true
  try {
    result.value = await runAdminImport(payload)
    text.value = ''
    emit('imported')
  } catch (err) {
    error.value = toFormError(err) // the pasted text stays, so it can be fixed
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="admin-section" aria-labelledby="admin-import-heading">
    <h2 id="admin-import-heading">Bulk import</h2>
    <p class="admin-hint">
      Bulk import is not de-duplicated: sending the same text twice creates everything twice. Run
      <code>npm run db:backup -w apps/api</code> first.
    </p>
    <form class="admin-form admin-card" aria-label="Bulk import" @submit.prevent="submit">
      <div class="admin-field">
        <label :for="`${id}-json`">JSON to import</label>
        <textarea
          :id="`${id}-json`"
          v-model="text"
          class="admin-code"
          rows="10"
          spellcheck="false"
          :readonly="busy"
          :aria-invalid="error ? 'true' : undefined"
        ></textarea>
      </div>
      <div class="admin-actions">
        <button type="submit" class="btn" :disabled="busy">Import</button>
      </div>
      <AdminFormError v-if="error" :error="error" />
      <p v-if="result" class="admin-success" role="status">{{ summary }}</p>
    </form>
    <details class="admin-example">
      <summary>Example</summary>
      <pre class="admin-code">{{ EXAMPLE }}</pre>
    </details>
  </section>
</template>
