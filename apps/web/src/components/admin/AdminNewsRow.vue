<script setup lang="ts">
import { reactive, ref, useId } from 'vue'
import type { AdminNewsItem } from '@frisson/shared'
import { deleteAdminNews, updateAdminNews } from '../../api/admin.ts'
import DemoTag from '../DemoTag.vue'
import AdminFormError from './AdminFormError.vue'
import { toFormError, type FormError } from './adminPanel.ts'

// Data classification: PUBLIC content, plus the admin-only isDemo flag.
const props = defineProps<{ item: AdminNewsItem }>()
const emit = defineEmits<{ changed: [] }>()

const id = useId()
const editing = ref(false)
const busy = ref(false)
const error = ref<FormError | null>(null)
const draft = reactive({ title: '', summary: '', source: '' })

// Fixed to UTC so the text matches the <time datetime> value for every admin, as on Home.
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const formatDate = (iso: string) => dateFormat.format(new Date(iso))

function startEdit() {
  draft.title = props.item.title
  draft.summary = props.item.summary
  draft.source = props.item.source
  error.value = null
  editing.value = true
}

function cancelEdit() {
  error.value = null
  editing.value = false
}

async function attempt(action: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    await action()
    editing.value = false
    emit('changed')
  } catch (err) {
    error.value = toFormError(err)
  } finally {
    busy.value = false
  }
}

function save() {
  return attempt(() => updateAdminNews(props.item.id, { ...draft }))
}

function remove() {
  if (!window.confirm(`Delete the news item “${props.item.title}”?`)) return
  return attempt(() => deleteAdminNews(props.item.id))
}
</script>

<template>
  <li class="admin-card">
    <form v-if="editing" class="admin-form" @submit.prevent="save">
      <div class="admin-field">
        <label :for="`${id}-title`">Title</label>
        <input :id="`${id}-title`" v-model="draft.title" required maxlength="200" />
      </div>
      <div class="admin-field">
        <label :for="`${id}-summary`">Summary</label>
        <textarea
          :id="`${id}-summary`"
          v-model="draft.summary"
          required
          maxlength="2000"
          rows="3"
        ></textarea>
      </div>
      <div class="admin-field">
        <label :for="`${id}-source`">Source</label>
        <input :id="`${id}-source`" v-model="draft.source" required maxlength="100" />
      </div>
      <div class="admin-actions">
        <button type="submit" class="btn" :disabled="busy">Save</button>
        <button type="button" class="admin-secondary" :disabled="busy" @click="cancelEdit">
          Cancel
        </button>
      </div>
    </form>

    <template v-else>
      <h3>{{ item.title }}</h3>
      <p class="admin-summary">{{ item.summary }}</p>
      <p class="admin-meta">
        <span>{{ item.source }}</span>
        <time :datetime="item.publishedAt">{{ formatDate(item.publishedAt) }}</time>
        <DemoTag v-if="item.isDemo" />
      </p>
      <div class="admin-actions">
        <button
          type="button"
          class="admin-secondary"
          :disabled="busy"
          :aria-label="`Edit: ${item.title}`"
          @click="startEdit"
        >
          Edit
        </button>
        <button
          type="button"
          class="admin-danger"
          :disabled="busy"
          :aria-label="`Delete: ${item.title}`"
          @click="remove"
        >
          Delete
        </button>
        <span v-if="item.isDemo" class="admin-hint">
          Demo news returns on the next restart while demo seeding is on.
        </span>
      </div>
    </template>

    <AdminFormError v-if="error" :error="error" />
  </li>
</template>
