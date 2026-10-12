import { describe, expect, it } from 'vitest'
import type { Track } from '@crate-digger/shared'
import { formatDuration, groupBySide, totalDuration } from './tracks.ts'

let nextId = 1
const track = (
  side: Track['side'],
  position: number,
  durationSec: number | null = null,
): Track => ({
  id: nextId++,
  side,
  position,
  title: `${side}${position}`,
  durationSec,
})

describe('groupBySide', () => {
  it('groups by side in A–D order, sorts by position, and skips empty sides', () => {
    const groups = groupBySide([track('C', 1), track('A', 2), track('A', 1)])

    expect(groups.map((g) => [g.side, g.tracks.map((t) => t.title)])).toEqual([
      ['A', ['A1', 'A2']],
      ['C', ['C1']],
    ])
  })

  it('returns nothing for an empty tracklist', () => {
    expect(groupBySide([])).toEqual([])
  })
})

describe('formatDuration', () => {
  it.each([
    [254, '4:14'],
    [60, '1:00'],
    [5, '0:05'],
    [3725, '62:05'],
    [null, ''],
  ])('%s → %j', (input, expected) => {
    expect(formatDuration(input)).toBe(expected)
  })
})

describe('totalDuration', () => {
  it('adds up durations', () => {
    expect(totalDuration([track('A', 1, 100), track('A', 2, 50)])).toBe(150)
  })

  it('is null if any duration is unknown, or there are no tracks', () => {
    expect(totalDuration([track('A', 1, 100), track('A', 2)])).toBeNull()
    expect(totalDuration([])).toBeNull()
  })
})
