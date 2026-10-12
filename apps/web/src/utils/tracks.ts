// Type-only import: erased at build time. Importing a *value* from @crate-digger/shared
// would pull the whole of Zod into the browser bundle.
import type { Track, TrackSide } from '@crate-digger/shared'

export type SideGroup = { side: TrackSide; tracks: Track[] }

/** Splits a tracklist into sides (A, B, …) that have tracks, each sorted by position. */
export function groupBySide(tracks: Track[]): SideGroup[] {
  const sides = [...new Set(tracks.map((t) => t.side))].sort()
  return sides.map((side) => ({
    side,
    tracks: tracks.filter((t) => t.side === side).sort((a, b) => a.position - b.position),
  }))
}

/** 254 → "4:14". Null/undefined → "" (durations are optional). */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Total running time, or null if any track is missing a duration. */
export function totalDuration(tracks: Track[]): number | null {
  if (tracks.length === 0 || tracks.some((t) => t.durationSec == null)) return null
  return tracks.reduce((sum, t) => sum + (t.durationSec ?? 0), 0)
}
