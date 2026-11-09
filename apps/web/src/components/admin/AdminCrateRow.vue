<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { AdminCrate } from '@frisson/shared'
import { setCrateSuggested } from '../../api/admin.ts'
import DemoTag from '../DemoTag.vue'
import AdminFormError from './AdminFormError.vue'
import { toFormError, type FormError } from './adminPanel.ts'

// Data classification: INTERNAL. Crate and owner names are typed text, so they are rendered with
// {{ }} only, never as HTML.
const props = defineProps<{ crate: AdminCrate }>()
const emit = defineEmits<{ updated: [crate: AdminCrate] }>()

const busy = ref(false)
const error = ref<FormError | null>(null)

const suggested = computed(() => props.crate.recommendedRank !== null)
// The API refuses to suggest a crate with no owner, but one already suggested can be turned off.
const blocked = computed(() => !suggested.value && props.crate.ownerUsername === null)
const recordCount = computed(() =>
  props.crate.albumCount === 1 ? '1 record' : `${props.crate.albumCount} records`,
)

async function toggle() {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    emit('updated', await setCrateSuggested(props.crate.id, !suggested.value))
  } catch (err) {
    error.value = toFormError(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <li class="admin-card">
    <h3>
      <RouterLink :to="{ name: 'crate', params: { id: crate.id } }">{{ crate.name }}</RouterLink>
      <DemoTag v-if="crate.isDemo" />
    </h3>
    <p class="admin-meta">
      <span v-if="crate.ownerUsername">
        Owner: {{ crate.ownerDisplayName }}
        <RouterLink :to="{ name: 'profile', params: { username: crate.ownerUsername } }"
          >@{{ crate.ownerUsername }}</RouterLink
        >
      </span>
      <span v-else>No owner</span>
      <span>{{ recordCount }}</span>
    </p>
    <div class="admin-actions">
      <button
        type="button"
        class="admin-secondary"
        :disabled="busy || blocked"
        :aria-label="`${suggested ? 'Stop suggesting' : 'Suggest'}: ${crate.name}`"
        @click="toggle"
      >
        {{ suggested ? 'Stop suggesting' : 'Suggest' }}
      </button>
      <RouterLink
        class="admin-link"
        :to="{ name: 'album-new', query: { crateId: crate.id } }"
        :title="`Add records to ${crate.name}`"
      >
        Add records
      </RouterLink>
      <RouterLink class="admin-link" :to="{ name: 'crates' }">Edit or delete</RouterLink>
    </div>
    <p v-if="blocked" class="admin-hint">
      This crate has no owner, so it can't be suggested: Recommended crates shows each crate's
      owner.
    </p>
    <AdminFormError v-if="error" :error="error" />
  </li>
</template>
