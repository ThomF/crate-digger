<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { AdminCrate } from '@frisson/shared'
import { createAdminCrate } from '../../api/admin.ts'
import AdminCrateRow from './AdminCrateRow.vue'
import AdminFormError from './AdminFormError.vue'
import AdminSectionStatus from './AdminSectionStatus.vue'
import { toFormError, type AsyncSection, type FormError } from './adminPanel.ts'

// Data classification: INTERNAL. Admin view of every crate and its owner's public names.
const props = defineProps<{ section: AsyncSection<AdminCrate[]> }>()
const emit = defineEmits<{ changed: []; updated: [crate: AdminCrate] }>()

const id = useId()
const name = ref('')
const suggestedOn = ref(false)
const busy = ref(false)
const error = ref<FormError | null>(null)

// Suggested means a non-null recommended rank, the column behind Home's Recommended crates.
const crates = computed(() => props.section.data.value ?? [])
const suggested = computed(() => crates.value.filter((c) => c.recommendedRank !== null))
const userCreated = computed(() => crates.value.filter((c) => c.recommendedRank === null))

async function create() {
  if (busy.value) return // a double post would create a duplicate
  busy.value = true
  error.value = null
  try {
    await createAdminCrate({ name: name.value, suggested: suggestedOn.value })
    name.value = ''
    suggestedOn.value = false
    emit('changed')
  } catch (err) {
    error.value = toFormError(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="admin-section" aria-labelledby="admin-new-crate-heading">
    <h2 id="admin-new-crate-heading">New crate</h2>
    <form class="admin-form admin-card" aria-label="New crate" @submit.prevent="create">
      <div class="admin-field">
        <label :for="`${id}-name`">Name</label>
        <input :id="`${id}-name`" v-model="name" required maxlength="60" />
      </div>
      <label class="admin-check">
        <input v-model="suggestedOn" type="checkbox" />
        Suggested
      </label>
      <div class="admin-actions">
        <button type="submit" class="btn" :disabled="busy">Create crate</button>
      </div>
      <AdminFormError v-if="error" :error="error" />
    </form>
  </section>

  <section class="admin-section" aria-labelledby="admin-suggested-heading">
    <h2 id="admin-suggested-heading">Suggested crates</h2>
    <AdminSectionStatus :section="section" loading-text="Pulling the picks…" />
    <template v-if="section.status.value === 'ready'">
      <ul v-if="suggested.length" class="admin-list">
        <AdminCrateRow
          v-for="c in suggested"
          :key="c.id"
          :crate="c"
          @updated="(c) => emit('updated', c)"
        />
      </ul>
      <p v-else class="status-note">No suggested crates yet.</p>
    </template>
  </section>

  <section class="admin-section" aria-labelledby="admin-user-created-heading">
    <h2 id="admin-user-created-heading">User created crates</h2>
    <AdminSectionStatus :section="section" loading-text="Counting crates…" />
    <template v-if="section.status.value === 'ready'">
      <ul v-if="userCreated.length" class="admin-list">
        <AdminCrateRow
          v-for="c in userCreated"
          :key="c.id"
          :crate="c"
          @updated="(c) => emit('updated', c)"
        />
      </ul>
      <p v-else class="status-note">No user created crates yet.</p>
    </template>
  </section>
</template>
