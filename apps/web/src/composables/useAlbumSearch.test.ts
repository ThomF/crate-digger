import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { AlbumQuery } from '@crate-digger/shared'
import { SEARCH_DELAY, useAlbumSearch } from './useAlbumSearch.ts'

// A fake API: each request waits until the test resolves it, so we control the timing.
type Pending = { url: string; signal: AbortSignal; respond: (titles: string[]) => void }
let pending: Pending[] = []

beforeEach(() => {
  vi.useFakeTimers()
  pending = []
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string, init: RequestInit) =>
        new Promise<Response>((resolve) =>
          pending.push({
            url,
            signal: init.signal!,
            respond: (titles) => resolve(Response.json(titles.map((title) => ({ title })))),
          }),
        ),
    ),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setup(initial: AlbumQuery) {
  const query = ref<AlbumQuery>(initial)
  const scope = effectScope() // stands in for a component's lifetime
  const search = scope.run(() => useAlbumSearch(query))!
  return { query, search, scope }
}

const titles = (search: ReturnType<typeof setup>['search']) =>
  search.results.value.map((a) => a.title)

describe('useAlbumSearch', () => {
  it('waits for typing to pause before searching', async () => {
    const { query } = setup({ q: 'n' })

    query.value = { q: 'ni' }
    await nextTick()
    query.value = { q: 'nir' }
    await nextTick()
    vi.advanceTimersByTime(SEARCH_DELAY - 1)
    expect(pending).toHaveLength(0)

    vi.advanceTimersByTime(1)
    expect(pending.map((p) => p.url)).toEqual(['/api/albums?q=nir'])
  })

  it('ignores a slow old response that arrives after a newer search', async () => {
    const { query, search } = setup({ q: 'old' })
    vi.advanceTimersByTime(SEARCH_DELAY)
    query.value = { q: 'new' }
    await nextTick()
    vi.advanceTimersByTime(SEARCH_DELAY)
    const [older, newer] = pending

    expect(older!.signal.aborted).toBe(true) // cancelled when the new search started

    newer!.respond(['Fresh'])
    older!.respond(['Stale'])
    await vi.runAllTimersAsync()

    expect(search.status.value).toBe('done')
    expect(titles(search)).toEqual(['Fresh'])
  })

  it('cancels everything when its component goes away', () => {
    const { scope } = setup({ q: 'x' })
    vi.advanceTimersByTime(SEARCH_DELAY)

    scope.stop()

    expect(pending[0]!.signal.aborted).toBe(true)
  })
})
