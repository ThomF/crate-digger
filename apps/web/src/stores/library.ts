import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  AlbumDetail,
  AlbumSummary,
  Crate,
  CreateCrateRequest,
  UpdateCrateInput,
} from '@crate-digger/shared'
// The sorting entry point has no Zod in it, so this import keeps the main bundle small.
import { sortAlbums } from '@crate-digger/shared/sorting'
import { listAlbums, moveAlbum } from '../api/albums.ts'
import { createCrate, deleteCrate, listCrates, reorderCrates, updateCrate } from '../api/crates.ts'
import { errorMessage } from '../api/client.ts'

type Status = 'idle' | 'loading' | 'ready' | 'error'

// A Pinia "setup store": refs are state, computeds are getters, functions are actions.
// The library lives here because several screens need it (crate view, list, crate manager).
// One-off data, like a single album's details, stays local to its view instead.
export const useLibraryStore = defineStore('library', () => {
  const crates = ref<Crate[]>([])
  const albums = ref<AlbumSummary[]>([])
  const status = ref<Status>('idle')
  const error = ref<string | null>(null)

  /** Crates in shelf order, each with its albums sorted the way that crate is set to. */
  const crateShelves = computed(() =>
    crates.value.map((crate) => ({
      crate,
      albums: sortAlbums(
        albums.value.filter((a) => a.crateId === crate.id),
        crate.sortBy,
      ),
    })),
  )

  // ── Where you are in the crates ───────────────────────────────────────
  // Kept here (not in the crate view) so opening an album and coming back puts you
  // in the same crate, at the same record.
  const selectedCrateId = ref<number | null>(null)
  const positions = ref<Record<number, number>>({})

  const selectedCrate = computed(
    () => crates.value.find((c) => c.id === selectedCrateId.value) ?? crates.value[0] ?? null,
  )

  function selectCrate(id: number) {
    selectedCrateId.value = id
  }

  function positionIn(crateId: number) {
    return positions.value[crateId] ?? 0
  }

  function setPosition(crateId: number, index: number) {
    positions.value[crateId] = index
  }

  function crateById(id: number) {
    return crates.value.find((c) => c.id === id)
  }

  /** Loads crates + albums once; pass `force` to refetch. */
  async function load({ force = false } = {}) {
    if (!force && (status.value === 'ready' || status.value === 'loading')) return

    status.value = 'loading'
    error.value = null
    try {
      await refresh()
      status.value = 'ready'
    } catch (err) {
      error.value = errorMessage(err)
      status.value = 'error'
    }
  }

  /** Refetches everything without showing a loading state (used after a change). */
  async function refresh() {
    // Two independent requests → run them at the same time.
    const [crateList, albumList] = await Promise.all([listCrates(), listAlbums()])
    crates.value = crateList
    albums.value = albumList
  }

  /**
   * After saving an album, patch it into the list instead of refetching everything.
   * Only the summary fields are kept; the list never holds tracks or notes.
   */
  function upsertAlbum(album: AlbumDetail) {
    const summary: AlbumSummary = {
      id: album.id,
      crateId: album.crateId,
      title: album.title,
      artist: album.artist,
      year: album.year,
      genre: album.genre,
      format: album.format,
      coverPath: album.coverPath,
      sleeveColor: album.sleeveColor,
      rating: album.rating,
      position: album.position,
    }
    const index = albums.value.findIndex((a) => a.id === album.id)
    if (index === -1) albums.value.push(summary)
    else albums.value[index] = summary
  }

  function removeAlbum(id: number) {
    albums.value = albums.value.filter((a) => a.id !== id)
  }

  // ── Changing crates and moving records ────────────────────────────────
  // These throw on failure so the screen that called them can show the error.

  /** id null = create. For a create, `changes` must include a name (the API checks). */
  async function saveCrate(id: number | null, changes: UpdateCrateInput) {
    const saved =
      id === null
        ? await createCrate(changes as CreateCrateRequest)
        : await updateCrate(id, changes)
    const index = crates.value.findIndex((c) => c.id === saved.id)
    if (index === -1) crates.value.push(saved)
    else crates.value[index] = saved
    return saved
  }

  async function removeCrate(id: number) {
    await deleteCrate(id)
    crates.value = crates.value.filter((c) => c.id !== id)
    if (selectedCrateId.value === id) selectedCrateId.value = null
  }

  async function reorderShelf(ids: number[]) {
    crates.value = await reorderCrates(ids)
  }

  /** Moves a record (positions of its neighbours change too, so refetch the list). */
  async function moveAlbumTo(albumId: number, crateId: number, position: number) {
    await moveAlbum(albumId, { crateId, position })
    await refresh()
  }

  return {
    crates,
    albums,
    status,
    error,
    crateShelves,
    crateById,
    selectedCrate,
    selectCrate,
    positionIn,
    setPosition,
    load,
    upsertAlbum,
    removeAlbum,
    saveCrate,
    removeCrate,
    reorderShelf,
    moveAlbumTo,
  }
})
