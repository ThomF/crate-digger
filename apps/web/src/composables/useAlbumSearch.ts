import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { AlbumQuery, AlbumSummary } from '@crate-digger/shared'
import { listAlbums } from '../api/albums.ts'
import { errorMessage } from '../api/client.ts'

/** How long typing has to pause before we search, in ms. */
export const SEARCH_DELAY = 250

/**
 * Searches the API whenever `query` changes, with the two things every search box needs:
 * - debouncing: wait until typing pauses, instead of one request per keystroke
 * - cancellation: abort the previous request, so a slow old response can't arrive after
 *   a newer one and show stale results
 */
export function useAlbumSearch(query: Ref<AlbumQuery>) {
  const results = ref<AlbumSummary[]>([])
  const status = ref<'idle' | 'searching' | 'done' | 'error'>('idle')
  const error = ref<string | null>(null)

  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: AbortController | undefined

  async function run(current: AlbumQuery) {
    inFlight?.abort()
    const controller = (inFlight = new AbortController())
    try {
      const found = await listAlbums(current, controller.signal)
      if (controller.signal.aborted) return // overtaken while the response was arriving
      results.value = found
      status.value = 'done'
    } catch (err) {
      if (controller.signal.aborted) return // we cancelled it ourselves; not an error
      error.value = errorMessage(err)
      status.value = 'error'
    }
  }

  watch(
    query,
    (current) => {
      clearTimeout(timer)
      status.value = 'searching'
      error.value = null
      timer = setTimeout(() => run(current), SEARCH_DELAY)
    },
    { deep: true, immediate: true },
  )

  // Stop timers and requests when the component using this goes away.
  onScopeDispose(() => {
    clearTimeout(timer)
    inFlight?.abort()
  })

  return { results, status, error }
}
