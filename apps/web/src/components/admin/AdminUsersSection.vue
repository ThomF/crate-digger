<script setup lang="ts">
import type { AdminUser } from '@frisson/shared'
import AdminSectionStatus from './AdminSectionStatus.vue'
import AdminUserRow from './AdminUserRow.vue'
import type { AsyncSection } from './adminPanel.ts'

// Data classification: CONFIDENTIAL (PII). The users list holds every user's email. It lives only
// in memory for this page; never persist or log it.
defineProps<{ section: AsyncSection<AdminUser[]> }>()
const emit = defineEmits<{ verified: [id: number, verified: boolean] }>()
</script>

<template>
  <section class="admin-section" aria-labelledby="admin-users-heading">
    <h2 id="admin-users-heading">Users</h2>
    <AdminSectionStatus :section="section" loading-text="Looking up users…" />
    <template v-if="section.status.value === 'ready'">
      <ul v-if="section.data.value?.length" class="admin-list">
        <AdminUserRow
          v-for="user in section.data.value"
          :key="user.id"
          :user="user"
          @verified="(id, verified) => emit('verified', id, verified)"
        />
      </ul>
      <p v-else class="status-note">No users yet.</p>
    </template>
  </section>
</template>
