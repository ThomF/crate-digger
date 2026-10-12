// Everything about the album form that isn't rendering: its state shape, converting to and
// from API data, and validation. Plain functions, so they're easy to test.
//
// This file imports a Zod schema as a *value* (createAlbumInput), which brings Zod into the
// bundle. That's deliberate: the browser validates with exactly the rules the API enforces.
// Only the lazily loaded editor page imports this file, so the list pages stay small.
import {
  createAlbumInput,
  type AlbumDetail,
  type AlbumFormat,
  type CreateAlbumInput,
  type TrackSide,
} from '@crate-digger/shared'
import { ApiRequestError, errorMessage } from '../api/client.ts'
import { formatDuration } from '../utils/tracks.ts'

/** One editable row in the tracklist. `key` identifies the row while it's moved around. */
export type TrackRow = { key: number; side: TrackSide; title: string; duration: string }

/** What the inputs bind to: strings where people type, before any conversion. */
export type AlbumFormState = {
  crateId: number | null
  title: string
  artist: string
  year: string
  genre: string
  format: AlbumFormat
  sleeveColor: string
  rating: number
  notes: string
  tracks: TrackRow[]
}

/**
 * Field name → message. Album fields use their name ('title'); track fields use
 * 'track.<rowKey>.<field>'; problems not tied to a field use FORM_ERROR.
 */
export type FieldErrors = Record<string, string>
export const FORM_ERROR = '_form'

export const trackErrorKey = (row: TrackRow, field: 'title' | 'duration') =>
  `track.${row.key}.${field}`

let nextRowKey = 1
export function newTrackRow(side: TrackSide = 'A', title = '', duration = ''): TrackRow {
  return { key: nextRowKey++, side, title, duration }
}

export function emptyForm(crateId: number | null = null): AlbumFormState {
  return {
    crateId,
    title: '',
    artist: '',
    year: '',
    genre: '',
    format: 'LP',
    sleeveColor: '#2b2118',
    rating: 0,
    notes: '',
    tracks: [newTrackRow('A')],
  }
}

export function formFromAlbum(album: AlbumDetail): AlbumFormState {
  return {
    crateId: album.crateId,
    title: album.title,
    artist: album.artist,
    year: album.year?.toString() ?? '',
    genre: album.genre ?? '',
    format: album.format,
    sleeveColor: album.sleeveColor,
    rating: album.rating,
    notes: album.notes ?? '',
    tracks: [...album.tracks]
      .sort((a, b) => a.side.localeCompare(b.side) || a.position - b.position)
      .map((t) => newTrackRow(t.side, t.title, formatDuration(t.durationSec))),
  }
}

/** "4:14" → 254. Blank → null (durations are optional). Anything else → undefined (invalid). */
export function parseDuration(text: string): number | null | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(trimmed)
  if (!match) return undefined
  const seconds = Number(match[1]) * 60 + Number(match[2])
  return seconds > 0 ? seconds : undefined
}

/** Rows the person actually filled in; completely blank rows are ignored, not errors. */
const filledRows = (form: AlbumFormState) =>
  form.tracks.filter((r) => r.title.trim() !== '' || r.duration.trim() !== '')

export type ValidationResult =
  { ok: true; data: CreateAlbumInput } | { ok: false; errors: FieldErrors }

/** Converts the form to an API payload and validates it with the shared schema. */
export function validateAlbumForm(form: AlbumFormState): ValidationResult {
  const errors: FieldErrors = {}
  const rows = filledRows(form)

  // Positions come from the order of rows within each side: the 2nd 'B' row is B2.
  const perSide: Partial<Record<TrackSide, number>> = {}
  const tracks = rows.map((row) => {
    const durationSec = parseDuration(row.duration)
    if (durationSec === undefined) errors[trackErrorKey(row, 'duration')] = 'Use m:ss, like 4:14'
    perSide[row.side] = (perSide[row.side] ?? 0) + 1
    return { side: row.side, position: perSide[row.side]!, title: row.title, durationSec }
  })

  const year = form.year.trim()
  const result = createAlbumInput.safeParse({
    crateId: form.crateId ?? undefined,
    title: form.title,
    artist: form.artist,
    year: year === '' ? null : Number(year),
    genre: form.genre.trim() || null,
    format: form.format,
    sleeveColor: form.sleeveColor,
    rating: form.rating,
    notes: form.notes.trim() || null,
    tracks,
  })

  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = keyForPath(issue.path, rows)
      errors[key] ??= issue.message // keep the first message per field
    }
  }

  if (Object.keys(errors).length > 0 || !result.success) return { ok: false, errors }
  return { ok: true, data: result.data }
}

/** ['tracks', 2, 'title'] → 'track.<key of 3rd filled row>.title'; ['title'] → 'title'. */
function keyForPath(path: PropertyKey[], rows: TrackRow[]): string {
  const [first, index, field] = path
  if (first === 'tracks' && typeof index === 'number' && rows[index]) {
    return trackErrorKey(rows[index], field === 'durationSec' ? 'duration' : 'title')
  }
  return typeof first === 'string' ? first : FORM_ERROR
}

/**
 * Turns a failed save into field errors. The API reports paths like 'body/title',
 * 'body/tracks/2/title' (create) or 'body/2/title' (replacing the tracklist).
 */
export function errorsFromApi(err: unknown, form: AlbumFormState): FieldErrors {
  if (!(err instanceof ApiRequestError) || !err.body?.issues?.length) {
    return { [FORM_ERROR]: errorMessage(err) }
  }

  const rows = filledRows(form)
  const errors: FieldErrors = {}
  for (const issue of err.body.issues) {
    const parts = issue.path
      .replace(/^body\/?/, '')
      .split('/')
      .filter(Boolean)
    const path: PropertyKey[] = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : p))
    if (typeof path[0] === 'number') path.unshift('tracks')
    errors[keyForPath(path, rows)] ??= issue.message
  }
  return errors
}
