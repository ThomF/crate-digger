<script setup lang="ts">
import { reactive, ref, useId } from 'vue'
import type { AdminNewsItem } from '@frisson/shared'
import { createAdminNews } from '../../api/admin.ts'
import AdminFormError from './AdminFormError.vue'
import AdminNewsRow from './AdminNewsRow.vue'
import AdminSectionStatus from './AdminSectionStatus.vue'
import { toFormError, type AsyncSection, type FormError } from './adminPanel.ts'

// Data classification: PUBLIC content, plus the admin-only isDemo flag. Titles and summaries are
// typed text, so they are rendered with {{ }} only, never as HTML.
defineProps<{ section: AsyncSection<AdminNewsItem[]> }>()
const emit = defineEmits<{ changed: [] }>()

const id = useId()
const blank = { title: '', summary: '', source: '' }
const draft = reactive({ ...blank })
const busy = ref(false)
const error = ref<FormError | null>(null)

async function create() {
  if (busy.value) return // a double post would create a duplicate
  busy.value = true
  error.value = null
  try {
    await createAdminNews({ ...draft })
    Object.assign(draft, blank)
    emit('changed')
  } catch (err) {
    error.value = toFormError(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="admin-section" aria-labelledby="admin-news-heading">
    <h2 id="admin-news-heading">News</h2>

    <form class="admin-form admin-card" aria-label="New news item" @submit.prevent="create">
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
        <button type="submit" class="btn" :disabled="busy">Create news item</button>
      </div>
      <AdminFormError v-if="error" :error="error" />
    </form>

    <AdminSectionStatus :section="section" loading-text="Fetching the news…" />
    <template v-if="section.status.value === 'ready'">
      <ul v-if="section.data.value?.length" class="admin-list">
        <AdminNewsRow
          v-for="item in section.data.value"
          :key="item.id"
          :item="item"
          @changed="emit('changed')"
        />
      </ul>
      <p v-else class="status-note">No news yet.</p>
    </template>
  </section>
</template>
