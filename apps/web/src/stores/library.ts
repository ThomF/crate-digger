import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AlbumSummary, Crate } from '@crate-digger/shared'
import { listAlbums } from '../api/albums.ts'
import { listCrates } from '../api/crates.ts'
import { errorMessage } from '../api/client.ts'

type Status = 'idle' | 'loading' | 'ready' | 'error'

// A Pinia "setup store": refs are state, computeds are getters, functions are actions.
// The library lives here because several screens need it (the list now, the crate view in M5).
// One-off data, like a single album's details, stays local to its view instead.
export const useLibraryStore = defineStore('library', () => {
  const crates = ref<Crate[]>([])
  const albums = ref<AlbumSummary[]>([])
  const status = ref<Status>('idle')
  const error = ref<string | null>(null)

  /** Crates in order, each with its albums in crate order (the API already sorts them). */
  const crateShelves = computed(() =>
    crates.value.map((crate) => ({
      crate,
      albums: albums.value.filter((a) => a.crateId === crate.id),
    })),
  )

  function crateById(id: number) {
    return crates.value.find((c) => c.id === id)
  }

  /** Loads crates + albums once; pass `force` to refetch. */
  async function load({ force = false } = {}) {
    if (!force && (status.value === 'ready' || status.value === 'loading')) return

    status.value = 'loading'
    error.value = null
    try {
      // Two independent requests → run them at the same time.
      const [crateList, albumList] = await Promise.all([listCrates(), listAlbums()])
      crates.value = crateList
      albums.value = albumList
      status.value = 'ready'
    } catch (err) {
      error.value = errorMessage(err)
      status.value = 'error'
    }
  }

  return { crates, albums, status, error, crateShelves, crateById, load }
})
