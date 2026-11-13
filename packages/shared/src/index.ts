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
  spinCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  tracks: z.array(track),
})

/** What POST /api/albums/:id/spins answers with. */
export const spinResult = z.object({ spinCount: z.number().int() })

// ── Crates ──────────────────────────────────────────────────────────────

export const crate = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  label: z.string().nullable(),
  sortBy: z.enum(CRATE_SORTS),
  sortOrder: z.number().int(),
  albumCount: z.number().int(),
  /** Who may edit this crate (besides admins). null = legacy crate, admins only. */
  ownerId: z.number().int().nullable(),
  ownerUsername: z.string().nullable(),
  ownerDisplayName: z.string().nullable(),
})

/** One crate as GET /crates/:id returns it. */
export const crateDetail = crate.extend({
  /** Does the signed-in viewer favorite this crate? Always false when signed out. */
  viewerFavorited: z.boolean(),
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

// ── Accounts ────────────────────────────────────────────────────────────

export const USER_ROLES = ['user', 'admin'] as const

/** A user as the API shows them. Never carries a password or hash. */
export const publicUser = z.object({
  id: z.number().int(),
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
  /** Where the user's avatar is served from, or null when they have none. */
  avatarUrl: z.string().nullable(),
  /** Set only by an admin. Users cannot verify themselves. */
  verified: z.boolean(),
})

/** The username rule: trimmed, lower-cased, 3-32 of a-z, 0-9, _ or -. */
const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .min(3, 'At least 3 characters')
      .max(32, 'Keep it under 32 characters')
      .regex(/^[a-z0-9_-]+$/, 'Use letters, numbers, _ or -'),
  )

const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email').max(254))

// z.object strips unknown keys, so a client cannot sign itself up with `role: 'admin'`.
export const signupInput = z.object({
  email: emailField,
  username: usernameField,
  /** Defaults to the username on the server when left out. */
  displayName: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(60, 'Keep it under 60 characters')
    .optional(),
  password: z.string().min(8, 'At least 8 characters').max(200, 'Keep it under 200 characters'),
})

/** Email + password, for logging in. */
export const credentialsInput = z.object({
  email: emailField,
  password: z.string().min(1, 'Required').max(200),
})

// ── Profiles ────────────────────────────────────────────────────────────

export const SOCIAL_PLATFORMS = [
  'instagram',
  'x',
  'tiktok',
  'youtube',
  'soundcloud',
  'spotify',
  'bandcamp',
  'discogs',
  'website',
] as const

/** Largest avatar image upload the API accepts. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

/** Up to this many social links per profile. */
export const MAX_PROFILE_LINKS = 6

export const usernameParams = z.object({ username: usernameField })

function isSafeHttpsUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value) // throws on relative URLs and garbage
  } catch {
    return false
  }
  // URL lower-cases the scheme, so 'HTTPS://' passes. Credentials in the URL are refused.
  return url.protocol === 'https:' && url.hostname !== '' && !url.username && !url.password
}

/** A link on a profile: an absolute https:// URL only (no http:, javascript:, data:, ...). */
export const profileLinkUrl = z
  .string()
  .trim()
  .max(2048, 'Keep it under 2048 characters')
  .refine(isSafeHttpsUrl, 'Use a full https:// link')

export const profileLinkInput = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: profileLinkUrl,
})

// strictObject: unknown keys (verified, role, email, username, ...) are a 400, not ignored.
export const updateProfileInput = z.strictObject({
  displayName: requiredText(60),
  bio: z.string().trim().max(500, 'Keep it under 500 characters').default(''),
  location: z
    .string()
    .trim()
    .max(80, 'Keep it under 80 characters')
    .nullish()
    .transform((value) => (value ? value : null)),
  links: z
    .array(profileLinkInput)
    .max(MAX_PROFILE_LINKS, `Up to ${MAX_PROFILE_LINKS} links`)
    .default([]),
})

export const profileLink = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.string(),
})

export const profileCrate = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  label: z.string().nullable(),
  albumCount: z.number().int(),
})

// Data classification: PUBLIC. A crate someone favorited, as their profile lists it. Owner
// username and display name only (null for ownerless legacy crates). No owner id.
export const profileFavorite = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  label: z.string().nullable(),
  albumCount: z.number().int(),
  ownerUsername: z.string().nullable(),
  ownerDisplayName: z.string().nullable(),
})

// Data classification: PUBLIC. Anyone may read this, signed in or not, so it must never
// carry the user's id, email, role or anything else from the private publicUser shape.
export const publicProfile = z.object({
  username: z.string(),
  displayName: z.string(),
  bio: z.string(),
  location: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  verified: z.boolean(),
  links: z.array(profileLink),
  crates: z.array(profileCrate),
  /** Crates this user favorited, newest favorited first. */
  favorites: z.array(profileFavorite),
  /** How many users follow this user. */
  followerCount: z.number().int(),
  /** How many users this user follows. */
  followingCount: z.number().int(),
  /** Does the signed-in viewer follow this user? Always false when signed out. */
  viewerFollows: z.boolean(),
  /** A fictional demo collector, labelled as such in the UI. */
  isDemo: z.boolean(),
})

/** Admin only: mark a user verified or not. */
export const setVerifiedInput = z.strictObject({ verified: z.boolean() })

// ── Following, feed and news ────────────────────────────────────────────

// Data classification: PUBLIC. A user as lists show them: no id, email or role.
export const collectorSummary = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  verified: z.boolean(),
  isDemo: z.boolean(),
})

// Data classification: PUBLIC. A crate in the feed or the recommended list. Deliberately not
// built on `crate`: that shape carries the numeric ownerId, which these lists must not expose.
export const crateCard = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  label: z.string().nullable(),
  albumCount: z.number().int(),
  createdAt: z.iso.datetime(),
  ownerUsername: z.string(),
  ownerDisplayName: z.string(),
})

// Data classification: PUBLIC. A crate on Home's recommended list. isDemo is a boolean, never the
// demo seed key, so Home can label demo crates apart from ones an admin suggested.
export const recommendedCrateCard = crateCard.extend({ isDemo: z.boolean() })

// Data classification: PUBLIC. Demo or admin-written news shown on Home. isDemo is a boolean,
// never the seed key.
export const newsItem = z.object({
  id: z.number().int(),
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  publishedAt: z.iso.datetime(),
  isDemo: z.boolean(),
})

// ── Admin ───────────────────────────────────────────────────────────────

/** How many rows of each kind exist. Suggested crates are those with a recommended rank. */
export const adminOverview = z.object({
  users: z.number().int(),
  crates: z.number().int(),
  suggestedCrates: z.number().int(),
  albums: z.number().int(),
  news: z.number().int(),
})

// Data classification: CONFIDENTIAL (PII: email). Admins only. Never carries a password hash
// or a demo seed key.
export const adminUser = z.object({
  id: z.number().int(),
  email: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
  verified: z.boolean(),
  /** A fictional demo collector. */
  isDemo: z.boolean(),
  createdAt: z.iso.datetime(),
  crateCount: z.number().int(),
})

// Data classification: INTERNAL. Admins only. The owner fields are null on an ownerless crate.
export const adminCrate = z.object({
  id: z.number().int(),
  name: z.string(),
  label: z.string().nullable(),
  color: z.string(),
  albumCount: z.number().int(),
  ownerUsername: z.string().nullable(),
  ownerDisplayName: z.string().nullable(),
  /** Non-null means suggested: lower ranks come first in Home's Recommended crates. */
  recommendedRank: z.number().int().nullable(),
  isDemo: z.boolean(),
  createdAt: z.iso.datetime(),
})

// Data classification: PUBLIC. The same shape as the public item. Never carries the seed key.
export const adminNewsItem = newsItem

export const adminCreateCrateInput = createCrateInput.extend({
  suggested: z.boolean().default(false),
})

export const adminSetSuggestedInput = z.strictObject({ suggested: z.boolean() })

export const adminNewsInput = z.object({
  title: requiredText(200),
  summary: requiredText(2000),
  source: requiredText(100),
  /** Defaults to now on the server when left out. */
  publishedAt: z.iso.datetime().optional(),
})

export const adminUpdateNewsInput = adminNewsInput
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to update')

export const adminImportAlbum = createAlbumInput.omit({ crateId: true })

export const adminImportCrate = adminCreateCrateInput.extend({
  albums: z.array(adminImportAlbum).default([]),
})

export const adminImportInput = z
  .object({
    crates: z.array(adminImportCrate).default([]),
    news: z.array(adminNewsInput).default([]),
  })
  .refine(
    (body) => body.crates.length > 0 || body.news.length > 0,
    'Send at least one crate or news item',
  )

/** The empty body of an admin 204 response. */
export const adminNoContent = z.null()

/** How many rows a bulk import created. */
export const adminImportResult = z.object({
  crates: z.number().int(),
  albums: z.number().int(),
  tracks: z.number().int(),
  news: z.number().int(),
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
export type CrateDetail = z.infer<typeof crateDetail>
export type CreateCrateInput = z.infer<typeof createCrateInput>
export type CreateCrateRequest = z.input<typeof createCrateInput>
export type UpdateCrateInput = z.infer<typeof updateCrateInput>
export type AlbumQuery = z.input<typeof albumQuery>
export type MoveAlbumInput = z.infer<typeof moveAlbumInput>
export type ApiError = z.infer<typeof apiError>
export type UserRole = (typeof USER_ROLES)[number]
export type PublicUser = z.infer<typeof publicUser>
export type SignupInput = z.infer<typeof signupInput>
export type CredentialsInput = z.infer<typeof credentialsInput>
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]
export type ProfileLink = z.infer<typeof profileLink>
export type ProfileLinkInput = z.infer<typeof profileLinkInput>
export type ProfileCrate = z.infer<typeof profileCrate>
export type ProfileFavorite = z.infer<typeof profileFavorite>
export type PublicProfile = z.infer<typeof publicProfile>
/** What the API sees after validation (defaults filled in, empty location is null). */
export type UpdateProfileInput = z.infer<typeof updateProfileInput>
/** What a client sends. */
export type UpdateProfileRequest = z.input<typeof updateProfileInput>
export type SetVerifiedInput = z.infer<typeof setVerifiedInput>
export type CollectorSummary = z.infer<typeof collectorSummary>
export type CrateCard = z.infer<typeof crateCard>
export type RecommendedCrateCard = z.infer<typeof recommendedCrateCard>
export type NewsItem = z.infer<typeof newsItem>
export type AdminOverview = z.infer<typeof adminOverview>
export type AdminUser = z.infer<typeof adminUser>
export type AdminCrate = z.infer<typeof adminCrate>
export type AdminNewsItem = z.infer<typeof adminNewsItem>
export type AdminImportResult = z.infer<typeof adminImportResult>
/** What the API sees after validation (defaults filled in). */
export type AdminCreateCrateInput = z.infer<typeof adminCreateCrateInput>
export type AdminNewsInput = z.infer<typeof adminNewsInput>
export type AdminUpdateNewsInput = z.infer<typeof adminUpdateNewsInput>
export type AdminImportInput = z.infer<typeof adminImportInput>
/** What a client sends (defaulted fields may be left out). */
export type AdminCreateCrateRequest = z.input<typeof adminCreateCrateInput>
export type AdminNewsRequest = z.input<typeof adminNewsInput>
export type AdminUpdateNewsRequest = z.input<typeof adminUpdateNewsInput>
export type AdminImportRequest = z.input<typeof adminImportInput>
