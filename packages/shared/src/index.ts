import { z } from 'zod'
import { CRATE_SORTS, LIST_SORTS } from './sorting.ts'

export * from './sorting.ts'

// The contract between the API and the web app. The API validates requests and
// responses against these schemas; the web app uses the inferred types.
// Input schemas describe what clients may send; the others describe what the API returns.

export const ALBUM_FORMATS = ['LP', 'EP', '7"', '12"'] as const
export const TRACK_SIDES = ['A', 'B', 'C', 'D'] as const

/** Largest cover image upload the API accepts. */
export const MAX_COVER_BYTES = 10 * 1024 * 1024

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Must be a hex color like #c8a374')
const optionalText = (max: number) =>
  z.string().trim().max(max, `Keep it under ${max} characters`).nullish()
const requiredText = (max: number) =>
  z.string().trim().min(1, 'Required').max(max, `Keep it under ${max} characters`)

export const idParams = z.object({ id: z.coerce.number().int().positive() })

// ── Tracks ──────────────────────────────────────────────────────────────

export const trackInput = z.object({
  side: z.enum(TRACK_SIDES),
  position: z.number().int().positive(),
  title: requiredText(200),
  durationSec: z.number().int().positive().nullish(),
})

export const tracklistInput = z
  .array(trackInput)
  .max(100, 'Up to 100 tracks')
  .refine(
    (tracks) => new Set(tracks.map((t) => `${t.side}${t.position}`)).size === tracks.length,
    'Each side + position pair must be unique (e.g. only one A1)',
  )

export const track = trackInput.extend({
  id: z.number().int(),
  durationSec: z.number().int().nullable(),
})

// ── Albums ──────────────────────────────────────────────────────────────

// No defaults here on purpose: a PATCH built from this must not reset fields the client left out.
const albumFields = z.object({
  crateId: z.number({ error: 'Pick a crate' }).int().positive(),
  title: requiredText(200),
  artist: requiredText(200),
  year: z
    .number({ error: 'Year must be a number' })
    .int('Year must be a whole number')
    .min(1900, 'Year must be 1900–2100')
    .max(2100, 'Year must be 1900–2100')
    .nullish(),
  genre: optionalText(60),
  format: z.enum(ALBUM_FORMATS),
  sleeveColor: hexColor,
  rating: z.number().int().min(0).max(5),
  notes: optionalText(2000),
})

export const createAlbumInput = albumFields.extend({
  format: albumFields.shape.format.default('LP'),
  sleeveColor: hexColor.optional(), // the database picks a default
  rating: albumFields.shape.rating.default(0),
  tracks: tracklistInput.optional(),
})

export const updateAlbumInput = albumFields
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to update')

export const albumQuery = z.object({
  crateId: z.coerce.number().int().positive().optional(),
  /** Matches title or artist, anywhere, ignoring case. */
  q: z.string().trim().max(100).optional(),
  genre: z.string().trim().max(60).optional(),
  sort: z.enum(LIST_SORTS).default('crate'),
})

/** Move a record: to another crate and/or to a position (0 = front) within it. */
export const moveAlbumInput = z.object({
  crateId: z.number({ error: 'Pick a crate' }).int().positive(),
  position: z.number().int().min(0),
})

export const albumSummary = z.object({
  id: z.number().int(),
  crateId: z.number().int(),
  title: z.string(),
  artist: z.string(),
  year: z.number().int().nullable(),
  genre: z.string().nullable(),
  format: z.enum(ALBUM_FORMATS),
  coverPath: z.string().nullable(),
  sleeveColor: z.string(),
  rating: z.number().int(),
  position: z.number().int(),
})

export const albumDetail = albumSummary.extend({
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  tracks: z.array(track),
})

// ── Crates ──────────────────────────────────────────────────────────────

export const crate = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  label: z.string().nullable(),
  sortBy: z.enum(CRATE_SORTS),
  sortOrder: z.number().int(),
  albumCount: z.number().int(),
})

const crateFields = z.object({
  name: requiredText(60),
  label: optionalText(40), // the text on the crate's tape label; defaults to the name
  color: hexColor,
  sortBy: z.enum(CRATE_SORTS),
})

export const createCrateInput = crateFields.extend({
  color: hexColor.default('#c8a374'),
  sortBy: crateFields.shape.sortBy.default('manual'),
})

export const updateCrateInput = crateFields
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to update')

/** The complete new order of crates, as a list of every crate id. */
export const crateOrderInput = z.object({
  ids: z
    .array(z.number().int().positive())
    .refine((ids) => new Set(ids).size === ids.length, 'Each crate may appear only once'),
})

// ── Session (admin login) ───────────────────────────────────────────────

export const sessionInfo = z.object({
  /** May this visitor change the collection right now? */
  canEdit: z.boolean(),
  /** Is there a password to log in with? (false when the app is open or read-only) */
  canLogIn: z.boolean(),
})

export const loginInput = z.object({
  password: z.string().min(1, 'Required').max(200),
})

// ── Errors ──────────────────────────────────────────────────────────────

export const apiError = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
})

// ── Types (inferred, so they can never drift from the schemas) ──────────

export type TrackSide = (typeof TRACK_SIDES)[number]
export type AlbumFormat = (typeof ALBUM_FORMATS)[number]
export type TrackInput = z.infer<typeof trackInput>
export type Track = z.infer<typeof track>
/** What the API sees after validation (defaults filled in). */
export type CreateAlbumInput = z.infer<typeof createAlbumInput>
/** What a client sends (defaulted fields may be left out). */
export type CreateAlbumRequest = z.input<typeof createAlbumInput>
export type UpdateAlbumInput = z.infer<typeof updateAlbumInput>
export type AlbumSummary = z.infer<typeof albumSummary>
export type AlbumDetail = z.infer<typeof albumDetail>
export type Crate = z.infer<typeof crate>
export type CreateCrateInput = z.infer<typeof createCrateInput>
export type CreateCrateRequest = z.input<typeof createCrateInput>
export type UpdateCrateInput = z.infer<typeof updateCrateInput>
export type AlbumQuery = z.input<typeof albumQuery>
export type MoveAlbumInput = z.infer<typeof moveAlbumInput>
export type ApiError = z.infer<typeof apiError>
export type SessionInfo = z.infer<typeof sessionInfo>
