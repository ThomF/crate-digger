// How records are ordered and filed, shared by the API and the web app so they always agree.
//
// This file deliberately imports nothing at runtime (only types), so the web app can use it
// via '@crate-digger/shared/sorting' without pulling Zod into the main bundle.
import type { AlbumSummary } from './index.ts'

/** How a crate keeps its records. 'manual' = the order you arranged them in. */
export const CRATE_SORTS = ['manual', 'artist', 'title', 'year'] as const
export type CrateSort = (typeof CRATE_SORTS)[number]

/** Orders for search results across all crates. */
export const LIST_SORTS = ['crate', 'artist', 'title', 'year', 'rating'] as const
export type ListSort = (typeof LIST_SORTS)[number]

type Sortable = Pick<AlbumSummary, 'id' | 'artist' | 'title' | 'year' | 'rating' | 'position'>

/**
 * Record shops ignore a leading "The" ("The Notorious B.I.G." is filed under N) and so do we.
 * Accents are folded so "Björk" sits with the B's.
 */
export function filingName(name: string): string {
  return name
    .trim()
    .replace(/^the\s+/i, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
const byText = (a: string, b: string) => collator.compare(filingName(a), filingName(b))
const byYear = (a: number | null, b: number | null) =>
  (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER) // unknown years go last

/** Compares two albums for a sort. Ties fall through to sensible next keys, then id. */
export function compareAlbums(sort: CrateSort | ListSort, a: Sortable, b: Sortable): number {
  const primary = {
    manual: () => a.position - b.position,
    crate: () => a.position - b.position, // callers group by crate first
    artist: () => byText(a.artist, b.artist) || byYear(a.year, b.year),
    title: () => byText(a.title, b.title),
    year: () => byYear(a.year, b.year) || byText(a.artist, b.artist),
    rating: () => b.rating - a.rating || byText(a.artist, b.artist), // best first
  }[sort]()
  return primary || byText(a.title, b.title) || a.id - b.id
}

export function sortAlbums<T extends Sortable>(albums: readonly T[], sort: CrateSort | ListSort) {
  return [...albums].sort((a, b) => compareAlbums(sort, a, b))
}

/**
 * The divider an album files under in a sorted crate: a letter for artist/title ('#' for
 * numbers and symbols), a decade for year. Manual crates have no dividers.
 */
export function dividerFor(
  sort: CrateSort,
  album: Pick<AlbumSummary, 'artist' | 'title' | 'year'>,
): string | null {
  if (sort === 'manual') return null
  if (sort === 'year') return album.year ? `${Math.floor(album.year / 10) * 10}s` : '?'
  const first = filingName(sort === 'artist' ? album.artist : album.title).charAt(0)
  return /[a-z]/.test(first) ? first.toUpperCase() : '#'
}
