// Tests for packages/shared/src/sorting.ts (the shared package has no test runner of its own).
import { describe, expect, it } from 'vitest'
import { dividerFor, filingName, sortAlbums } from '@crate-digger/shared/sorting'

let nextId = 1
const album = (artist: string, title: string, year: number | null = null, rating = 0) => ({
  id: nextId++,
  artist,
  title,
  year,
  rating,
  position: 0,
})

describe('filingName', () => {
  it.each([
    ['The Notorious B.I.G.', 'notorious b.i.g.'],
    ['Björk', 'bjork'],
    ['  the The  ', 'the'],
    ['Theatre of Hate', 'theatre of hate'], // only the word "The"
  ])('%j → %j', (name, filed) => {
    expect(filingName(name)).toBe(filed)
  })
})

describe('sortAlbums', () => {
  it('sorts numbers naturally ("2" before "10")', () => {
    const sorted = sortAlbums([album('X', '10 Songs'), album('X', '2 Songs')], 'title')

    expect(sorted.map((a) => a.title)).toEqual(['2 Songs', '10 Songs'])
  })

  it('puts unknown years last and breaks ties by artist', () => {
    const sorted = sortAlbums(
      [album('B', 'b', 1994), album('Z', 'z'), album('A', 'a', 1994), album('C', 'c', 1991)],
      'year',
    )

    expect(sorted.map((a) => a.artist)).toEqual(['C', 'A', 'B', 'Z'])
  })

  it('puts the best rated first', () => {
    const sorted = sortAlbums([album('A', 'a', null, 3), album('B', 'b', null, 5)], 'rating')

    expect(sorted.map((a) => a.rating)).toEqual([5, 3])
  })

  it('does not change the array it was given', () => {
    const input = [album('B', 'b'), album('A', 'a')]

    sortAlbums(input, 'artist')

    expect(input.map((a) => a.artist)).toEqual(['B', 'A'])
  })
})

describe('dividerFor', () => {
  it.each([
    ['artist', 'The Notorious B.I.G.', 'N'],
    ['artist', 'Björk', 'B'],
    ['artist', '2Pac', '#'],
    ['title', 'OK Computer', 'O'],
  ] as const)('%s divider for %j is %j', (sort, text, divider) => {
    expect(dividerFor(sort, { artist: text, title: text, year: null })).toBe(divider)
  })

  it('groups years by decade, and has none for manual crates', () => {
    expect(dividerFor('year', { artist: '', title: '', year: 1997 })).toBe('1990s')
    expect(dividerFor('year', { artist: '', title: '', year: null })).toBe('?')
    expect(dividerFor('manual', { artist: 'Beck', title: '', year: 1996 })).toBeNull()
  })
})
