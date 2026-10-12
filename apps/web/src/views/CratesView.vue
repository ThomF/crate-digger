<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { useLibraryStore } from '../stores/library.ts'
import CrateSettings from '../components/crate/CrateSettings.vue'

const library = useLibraryStore()

onMounted(() => {
  document.title = 'Your crates · Crate Digger'
  library.load()
})

// Errors and busy state per crate id ('new' for the add form).
type Key = number | 'new'
const errors = ref<Record<string, Record<string, string>>>({})
const busy = ref<Key | null>(null)

/** Runs one change, recording field errors from the API against that crate's form. */
async function attempt(key: Key, action: () => Promise<unknown>) {
  busy.value = key
  errors.value[key] = {}
  try {
    await action()
  } catch (err) {
    const issues = err instanceof ApiRequestError ? err.body?.issues : undefined
    errors.value[key] = issues?.length
      ? Object.fromEntries(issues.map((i) => [i.path.replace(/^body\//, ''), i.message]))
      : { _form: errorMessage(err) }
  } finally {
    busy.value = null
  }
}

function recordsIn(crateId: number) {
  return library.albums.filter((a) => a.crateId === crateId).length
}

function move(index: number, delta: -1 | 1) {
  const ids = library.crates.map((c) => c.id)
  const target = index + delta
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  return attempt(ids[target]!, () => library.reorderShelf(ids))
}

function remove(crateId: number, name: string) {
  if (!window.confirm(`Delete the empty crate “${name}”?`)) return
  return attempt(crateId, () => library.removeCrate(crateId))
}
</script>

<template>
  <RouterLink :to="{ name: 'library' }" class="back">← Back to the crates</RouterLink>
  <h1>Your crates</h1>

  <p v-if="library.status === 'loading' || library.status === 'idle'" class="status-note">
    Counting crates…
  </p>
  <p v-else-if="library.status === 'error'" class="status-note is-error" role="alert">
    {{ library.error }}
  </p>

  <template v-else>
    <ol class="shelf">
      <li v-for="(crate, i) in library.crates" :key="crate.id">
        <CrateSettings
          :crate="crate"
          :record-count="recordsIn(crate.id)"
          :errors="errors[crate.id]"
          :busy="busy !== null"
          @save="(changes) => attempt(crate.id, () => library.saveCrate(crate.id, changes))"
          @delete="remove(crate.id, crate.name)"
        >
          <template #actions>
            <button
              type="button"
              class="order"
              :disabled="i === 0 || busy !== null"
              :aria-label="`Move ${crate.name} up the shelf`"
              @click="move(i, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="order"
              :disabled="i === library.crates.length - 1 || busy !== null"
              :aria-label="`Move ${crate.name} down the shelf`"
              @click="move(i, 1)"
            >
              ↓
            </button>
          </template>
        </CrateSettings>
      </li>
    </ol>

    <h2>New crate</h2>
    <CrateSettings
      :crate="null"
      :errors="errors.new"
      :busy="busy !== null"
      @save="(changes) => attempt('new', () => library.saveCrate(null, changes))"
    />
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

h2 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  margin: 2rem 0 0.75rem;
}

.shelf {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

.order {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--ink-soft);
  background: var(--paper);
}

.order:disabled {
  opacity: 0.3;
  cursor: default;
}
</style>
