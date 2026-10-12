import { describe, expect, it } from 'vitest'
import type { AlbumDetail } from '@crate-digger/shared'
import { ApiRequestError } from '../api/client.ts'
import {
  checkCoverFile,
  emptyForm,
  errorsFromApi,
  formFromAlbum,
  newTrackRow,
  parseDuration,
  trackErrorKey,
  validateAlbumForm,
  FORM_ERROR,
  type AlbumFormState,
} from './albumForm.ts'

function filledForm(overrides: Partial<AlbumFormState> = {}): AlbumFormState {
  return { ...emptyForm(1), title: 'Dummy', artist: 'Portishead', ...overrides }
}

describe('parseDuration', () => {
  it.each([
    ['4:14', 254],
    [' 0:59 ', 59],
    ['62:05', 3725],
    ['', null],
    ['  ', null],
  ])('%j → %j', (input, expected) => {
    expect(parseDuration(input)).toBe(expected)
  })

  it.each(['4:6', '4:60', 'abc', '254', '0:00', '-1:00'])('rejects %j', (input) => {
    expect(parseDuration(input)).toBeUndefined()
  })
})

describe('validateAlbumForm', () => {
  it('builds an API payload: trims, converts year, blanks become null', () => {
    const result = validateAlbumForm(
      filledForm({ title: '  Dummy ', year: '1994', genre: ' ', notes: '' }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toMatchObject({
      crateId: 1,
      title: 'Dummy',
      year: 1994,
      genre: null,
      notes: null,
      format: 'LP',
    })
  })

  it('numbers tracks by their order within each side and ignores blank rows', () => {
    const result = validateAlbumForm(
      filledForm({
        tracks: [
          newTrackRow('A', 'Mysterons', '5:02'),
          newTrackRow('B', "It's a Fire"),
          newTrackRow('A', 'Sour Times'),
          newTrackRow('A', ''), // blank: ignored
        ],
      }),
    )

    expect(result.ok && result.data.tracks).toEqual([
      { side: 'A', position: 1, title: 'Mysterons', durationSec: 302 },
      { side: 'B', position: 1, title: "It's a Fire", durationSec: null },
      { side: 'A', position: 2, title: 'Sour Times', durationSec: null },
    ])
  })

  it('reports friendly messages per field', () => {
    const result = validateAlbumForm(
      filledForm({ crateId: null, title: ' ', artist: '', year: '19x4' }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual({
      crateId: 'Pick a crate',
      title: 'Required',
      artist: 'Required',
      year: 'Year must be a number',
    })
  })

  it('points track errors at the right row, even with blank rows in between', () => {
    const blank = newTrackRow('A')
    const badLength = newTrackRow('A', 'Roads', '5 mins')
    const noTitle = newTrackRow('B', '', '3:00')

    const result = validateAlbumForm(filledForm({ tracks: [blank, badLength, noTitle] }))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual({
      [trackErrorKey(badLength, 'duration')]: 'Use m:ss, like 4:14',
      [trackErrorKey(noTitle, 'title')]: 'Required',
    })
  })
})

describe('formFromAlbum', () => {
  it('turns an album into form state that validates back to the same data', () => {
    const album: AlbumDetail = {
      id: 7,
      crateId: 2,
      title: 'Mezzanine',
      artist: 'Massive Attack',
      year: 1998,
      genre: 'Trip-Hop',
      format: 'LP',
      coverPath: null,
      sleeveColor: '#1d1d1d',
      rating: 4,
      position: 0,
      notes: null,
      createdAt: '2026-10-12T00:00:00.000Z',
      updatedAt: '2026-10-12T00:00:00.000Z',
      tracks: [
        { id: 2, side: 'B', position: 1, title: 'Inertia Creeps', durationSec: 356 },
        { id: 1, side: 'A', position: 1, title: 'Angel', durationSec: 379 },
      ],
    }

    const form = formFromAlbum(album)
    const result = validateAlbumForm(form)

    expect(form.year).toBe('1998')
    expect(form.tracks.map((t) => [t.side, t.title, t.duration])).toEqual([
      ['A', 'Angel', '6:19'],
      ['B', 'Inertia Creeps', '5:56'],
    ])
    expect(result.ok && result.data.tracks).toEqual([
      { side: 'A', position: 1, title: 'Angel', durationSec: 379 },
      { side: 'B', position: 1, title: 'Inertia Creeps', durationSec: 356 },
    ])
  })
})

describe('errorsFromApi', () => {
  const issuesError = (issues: { path: string; message: string }[]) =>
    new ApiRequestError(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Request is invalid',
      issues,
    })

  it('maps album field paths and both styles of track paths onto the form', () => {
    const first = newTrackRow('A', 'One')
    const second = newTrackRow('A', 'Two')
    const form = filledForm({ tracks: [first, second] })

    const errors = errorsFromApi(
      issuesError([
        { path: 'body/title', message: 'Taken' },
        { path: 'body/tracks/1/title', message: 'Too long' }, // POST /albums
        { path: 'body/0/title', message: 'Nope' }, // PUT /albums/:id/tracks
      ]),
      form,
    )

    expect(errors).toEqual({
      title: 'Taken',
      [trackErrorKey(second, 'title')]: 'Too long',
      [trackErrorKey(first, 'title')]: 'Nope',
    })
  })

  it('falls back to a form-level message', () => {
    const notFound = new ApiRequestError(404, {
      statusCode: 404,
      error: 'Not Found',
      message: 'Album 9 not found',
    })

    expect(errorsFromApi(notFound, filledForm())).toEqual({ [FORM_ERROR]: 'Album 9 not found' })
    expect(errorsFromApi(new TypeError('Failed to fetch'), filledForm())).toEqual({
      [FORM_ERROR]: "Can't reach the API. Is it running?",
    })
  })
})

describe('cover files', () => {
  const file = (type: string, bytes: number) => new File([new Uint8Array(bytes)], 'cover', { type })

  it('accepts images up to the size limit', () => {
    expect(checkCoverFile(null)).toBeNull()
    expect(checkCoverFile(file('image/jpeg', 1000))).toBeNull()
  })

  it('rejects other file types and oversized images', () => {
    expect(checkCoverFile(file('application/pdf', 1000))).toMatch(/image file/)
    expect(checkCoverFile(file('image/png', 10 * 1024 * 1024 + 1))).toBe(
      'Images up to 10 MB, please',
    )
  })

  it('reports a bad cover as a form error alongside other fields', () => {
    const result = validateAlbumForm(filledForm({ coverFile: file('text/plain', 10) }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors.cover).toMatch(/image file/)
  })
})
