<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRouter } from 'vue-router'
import type { AlbumDetail } from '@crate-digger/shared'
import { createAlbum, deleteAlbum, getAlbum, replaceTracks, updateAlbum } from '../api/albums.ts'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { useLibraryStore } from '../stores/library.ts'
import {
  emptyForm,
  errorsFromApi,
  formFromAlbum,
  validateAlbumForm,
  FORM_ERROR,
  type AlbumFormState,
  type FieldErrors,
} from '../forms/albumForm.ts'
import AlbumForm from '../components/forms/AlbumForm.vue'

// One view for both routes: /albums/new (no id) and /albums/:id/edit.
const props = defineProps<{ id?: number; crateId?: number | null }>()

const router = useRouter()
const library = useLibraryStore()

const form = ref<AlbumFormState | null>(null)
const errors = ref<FieldErrors>({})
const status = ref<'loading' | 'ready' | 'not-found' | 'error'>('loading')
const loadError = ref<string | null>(null)
const saving = ref(false)

const isEdit = computed(() => props.id !== undefined)
const heading = computed(() =>
  isEdit.value ? `Edit “${original.value?.title ?? ''}”` : 'Add a record',
)

// ── Loading ─────────────────────────────────────────────────────────────

const original = ref<AlbumDetail | null>(null)
let snapshot = '' // the form as loaded, to detect unsaved changes

async function load() {
  status.value = 'loading'
  try {
    await library.load() // the crate dropdown needs crates
    if (props.id !== undefined) {
      original.value = await getAlbum(props.id)
      form.value = formFromAlbum(original.value)
    } else {
      form.value = emptyForm(props.crateId ?? library.crates[0]?.id ?? null)
    }
    snapshot = JSON.stringify(form.value)
    status.value = 'ready'
    document.title = `${heading.value} · Crate Digger`
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) status.value = 'not-found'
    else {
      loadError.value = errorMessage(err)
      status.value = 'error'
    }
  }
}

onMounted(load)

const genreSuggestions = computed(() =>
  [...new Set(library.albums.map((a) => a.genre).filter((g): g is string => !!g))].sort(),
)

// ── Unsaved changes ─────────────────────────────────────────────────────

let leavingOnPurpose = false
const isDirty = () => !!form.value && JSON.stringify(form.value) !== snapshot

// In-app navigation (links, back button within the app)…
onBeforeRouteLeave(() => {
  if (leavingOnPurpose || !isDirty()) return true
  return window.confirm('You have unsaved changes. Leave anyway?')
})

// …and closing or reloading the tab.
function warnOnUnload(event: BeforeUnloadEvent) {
  if (isDirty()) event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', warnOnUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnOnUnload))

// ── Saving ──────────────────────────────────────────────────────────────

async function focusFirstError() {
  await nextTick()
  document.querySelector<HTMLElement>('[aria-invalid="true"], .form-error')?.focus()
}

async function save() {
  if (!form.value || saving.value) return

  // 1. Validate in the browser with the same schema the API uses.
  const result = validateAlbumForm(form.value)
  if (!result.ok) {
    errors.value = result.errors
    return focusFirstError()
  }

  // 2. Send it. The API validates again: never trust the client.
  errors.value = {}
  saving.value = true
  try {
    let saved: AlbumDetail
    if (props.id !== undefined) {
      const { tracks, ...fields } = result.data
      await updateAlbum(props.id, fields)
      saved = await replaceTracks(props.id, tracks ?? [])
    } else {
      saved = await createAlbum(result.data)
    }

    library.upsertAlbum(saved)
    leavingOnPurpose = true
    await router.push({ name: 'album', params: { id: saved.id } })
  } catch (err) {
    errors.value = errorsFromApi(err, form.value)
    focusFirstError()
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!original.value) return
  const ok = window.confirm(
    `Remove “${original.value.title}” from your collection? This can't be undone.`,
  )
  if (!ok) return

  try {
    await deleteAlbum(original.value.id)
    library.removeAlbum(original.value.id)
    leavingOnPurpose = true
    await router.push({ name: 'library' })
  } catch (err) {
    errors.value = { [FORM_ERROR]: errorMessage(err) }
    focusFirstError()
  }
}

function cancel() {
  router.push(isEdit.value ? { name: 'album', params: { id: props.id } } : { name: 'library' })
}
</script>

<template>
  <RouterLink :to="isEdit ? { name: 'album', params: { id } } : { name: 'library' }" class="back">
    ← {{ isEdit ? 'Back to the record' : 'Back to the crates' }}
  </RouterLink>

  <p v-if="status === 'loading'" class="status-note">Finding a blank index card…</p>

  <p v-else-if="status === 'not-found'" class="status-note">That record isn't in any crate.</p>

  <p v-else-if="status === 'error'" class="status-note is-error" role="alert">
    {{ loadError }}
    <button type="button" class="btn" @click="load">Try again</button>
  </p>

  <template v-else-if="form">
    <h1>{{ heading }}</h1>

    <p v-if="library.crates.length === 0" class="status-note">
      You need a crate first. Run <code>npm run db:seed -w apps/api</code> (crate editing arrives in
      M8).
    </p>

    <AlbumForm
      v-else
      v-model="form"
      :crates="library.crates"
      :errors="errors"
      :saving="saving"
      :submit-label="isEdit ? 'Save changes' : 'Add to collection'"
      :genre-suggestions="genreSuggestions"
      @submit="save"
      @cancel="cancel"
    >
      <template v-if="isEdit" #extra-actions>
        <button type="button" class="danger" @click="remove">Remove from collection</button>
      </template>
    </AlbumForm>
  </template>
</template>

<style scoped>
.back {
  display: inline-block;
  font-family: var(--font-display);
  margin-bottom: 1rem;
}

h1 {
  margin: 0 0 1rem;
}

.danger {
  margin-left: auto;
  background: none;
  border: 1px solid var(--marker-red);
  color: var(--marker-red);
  padding: 0.4rem 0.9rem;
  font-family: var(--font-display);
}
</style>
