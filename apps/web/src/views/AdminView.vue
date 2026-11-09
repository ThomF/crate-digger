<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { AdminCrate } from '@frisson/shared'
import { getAdminOverview, listAdminCrates, listAdminNews, listAdminUsers } from '../api/admin.ts'
import AdminBulkImport from '../components/admin/AdminBulkImport.vue'
import AdminCratesSection from '../components/admin/AdminCratesSection.vue'
import AdminNewsSection from '../components/admin/AdminNewsSection.vue'
import AdminSectionStatus from '../components/admin/AdminSectionStatus.vue'
import AdminUsersSection from '../components/admin/AdminUsersSection.vue'
import '../components/admin/admin-panel.css'
import { useAsyncSection } from '../composables/useAsyncSection.ts'
import { useLibraryStore } from '../stores/library.ts'

// The API is the real gatekeeper for all of this (requireAdmin); the router guard only keeps the
// page from being shown to anyone else.

const overview = useAsyncSection(getAdminOverview)
const news = useAsyncSection(listAdminNews)
const crates = useAsyncSection(listAdminCrates)
// Data classification: CONFIDENTIAL (PII). The users list holds every user's email. It lives only
// in this section's memory; never persist or log it.
const users = useAsyncSection(listAdminUsers)

const library = useLibraryStore()

const counts = computed(() => {
  const c = overview.data.value
  if (!c) return []
  return [
    { label: 'Users', value: c.users },
    { label: 'Crates', value: c.crates },
    { label: 'Suggested', value: c.suggestedCrates },
    { label: 'Albums', value: c.albums },
    { label: 'News', value: c.news },
  ]
})

// The library store caches crates and albums for /list, /crates/:id and the album editor, so a
// change made here must reach it. One forced load at a time, and one more if a change landed
// during it: otherwise a slow older answer could overwrite a newer one. Idle means nothing has
// been cached yet, and the next screen to need it will load fresh.
let syncing = false
let syncAgain = false
async function syncLibrary() {
  if (library.status === 'idle') return
  if (syncing) {
    syncAgain = true
    return
  }
  syncing = true
  do {
    syncAgain = false
    await library.load({ force: true })
  } while (syncAgain)
  syncing = false
}

function onNewsChanged() {
  news.refresh()
  overview.refresh()
}

function onCratesChanged() {
  crates.refresh()
  overview.refresh()
  users.refresh() // their crate counts
  syncLibrary()
}

/** Moves the row at once, so its button can't go on offering the old action during the refresh. */
function onCrateUpdated(updated: AdminCrate) {
  crates.data.value = (crates.data.value ?? []).map((c) => (c.id === updated.id ? updated : c))
  onCratesChanged()
}

function onUserVerified(id: number, verified: boolean) {
  users.data.value = (users.data.value ?? []).map((u) => (u.id === id ? { ...u, verified } : u))
}

function onImported() {
  news.refresh()
  onCratesChanged()
}

onMounted(() => {
  document.title = 'Admin · Frisson'
  overview.load()
  news.load()
  crates.load()
  users.load()
})
</script>

<template>
  <div class="admin-panel">
    <h1>Admin</h1>

    <section class="admin-section" aria-labelledby="admin-overview-heading">
      <h2 id="admin-overview-heading">Overview</h2>
      <AdminSectionStatus :section="overview" loading-text="Adding it all up…" />
      <dl v-if="overview.status.value === 'ready'" class="admin-counts">
        <div v-for="count in counts" :key="count.label">
          <dt>{{ count.label }}</dt>
          <dd>{{ count.value }}</dd>
        </div>
      </dl>
    </section>

    <AdminNewsSection :section="news" @changed="onNewsChanged" />
    <AdminCratesSection :section="crates" @changed="onCratesChanged" @updated="onCrateUpdated" />
    <AdminUsersSection :section="users" @verified="onUserVerified" />
    <AdminBulkImport @imported="onImported" />
  </div>
</template>
