import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AlbumSummary, Crate } from '@crate-digger/shared'
import { useLibraryStore } from './library.ts'

const crates: Crate[] = [
  { id: 1, name: 'Guitars', color: '#c8a374', label: 'ROCK', sortOrder: 0, albumCount: 1 },
  { id: 2, name: 'Empty', color: '#a67c52', label: null, sortOrder: 1, albumCount: 0 },
]
const albums = [{ id: 10, crateId: 1, title: 'Nevermind' }] as AlbumSummary[]

// Stand-in for the real API: answers by URL.
function fakeFetch(routes: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    if (!(url in routes)) return new Response('{}', { status: 500 })
    return Response.json(routes[url])
  })
}

describe('library store', () => {
  beforeEach(() => setActivePinia(createPinia())) // a fresh store per test
  afterEach(() => vi.unstubAllGlobals())

  it('loads crates and albums and groups albums into crate shelves', async () => {
    vi.stubGlobal('fetch', fakeFetch({ '/api/crates': crates, '/api/albums': albums }))
    const library = useLibraryStore()

    await library.load()

    expect(library.status).toBe('ready')
    expect(library.crateShelves.map((s) => [s.crate.name, s.albums.length])).toEqual([
      ['Guitars', 1],
      ['Empty', 0],
    ])
  })

  it('only fetches once unless forced', async () => {
    const fetch = fakeFetch({ '/api/crates': crates, '/api/albums': albums })
    vi.stubGlobal('fetch', fetch)
    const library = useLibraryStore()

    await library.load()
    await library.load()
    expect(fetch).toHaveBeenCalledTimes(2) // crates + albums, once

    await library.load({ force: true })
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('records a readable error when the API fails', async () => {
    vi.stubGlobal('fetch', fakeFetch({}))
    const library = useLibraryStore()

    await library.load()

    expect(library.status).toBe('error')
    expect(library.error).toBe('Request failed (500)')
  })

  it('explains when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const library = useLibraryStore()

    await library.load()

    expect(library.error).toBe("Can't reach the API. Is it running?")
  })
})
