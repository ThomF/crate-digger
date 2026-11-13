import { relations, sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { CRATE_SORTS } from '@frisson/shared/sorting'
import { SOCIAL_PLATFORMS, USER_ROLES } from '@frisson/shared'

// Every table here becomes a real SQLite table. After changing this file, run
// `npm run db:generate -w apps/api` to write a new SQL migration into apps/api/drizzle/.

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
}

// Data classification: CONFIDENTIAL (PII + credentials). email is personal data;
// password_hash is a scrypt hash and must never leave the API (see publicUser).
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(), // stored lower-cased
  username: text('username').notNull().unique(), // stored lower-cased
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: USER_ROLES }).notNull().default('user'),
  createdAt: timestamps.createdAt,
  // Profile fields, added in migration 0004. These are PUBLIC once shown on a profile.
  bio: text('bio').notNull().default(''),
  location: text('location'),
  avatarPath: text('avatar_path'), // the public URL path of the avatar image, or NULL
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false), // set by admins only
  // Added in migration 0005. Stable key of a fictional demo user; non-NULL means demo user.
  demoSeedKey: text('demo_seed_key').unique(),
})

// Data classification: PUBLIC. Social links shown on a user's profile.
// 'cascade' = deleting a user deletes their links. The 6-per-user limit is enforced by the
// app (shared zod schema + profile service), not the database.
export const userLinks = sqliteTable(
  'user_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform', { enum: SOCIAL_PLATFORMS }).notNull(),
    url: text('url').notNull(),
    position: integer('position').notNull(), // order on the profile, 0 first
  },
  (t) => [index('user_links_user_position_idx').on(t.userId, t.position)],
)

// Data classification: CONFIDENTIAL (credentials). id is the sha256 hex of the opaque
// session token; the token itself is only ever in the user's cookie.
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
)

export const crates = sqliteTable('crates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#c8a374'),
  label: text('label'), // the handwritten text on the front of the crate
  // How records in this crate are ordered. Added in migration 0001: existing crates get 'manual'.
  sortBy: text('sort_by', { enum: CRATE_SORTS }).notNull().default('manual'),
  sortOrder: integer('sort_order').notNull().default(0),
  // Who may edit this crate. NULL = legacy crate from before accounts: only admins may edit.
  // 'set null' = deleting a user leaves their crates behind for admins.
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'set null' }),
  // Added in migration 0005. Stable key of a demo crate; NULL for everything else.
  demoSeedKey: text('demo_seed_key').unique(),
  // Added in migration 0005. NULL = not recommended; lower ranks come first on Home.
  recommendedRank: integer('recommended_rank'),
  ...timestamps,
})

export const ALBUM_FORMATS = ['LP', 'EP', '7"', '12"'] as const

export const albums = sqliteTable(
  'albums',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // 'restrict' = you can't delete a crate that still has records in it.
    crateId: integer('crate_id')
      .notNull()
      .references(() => crates.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    artist: text('artist').notNull(),
    year: integer('year'),
    genre: text('genre'),
    format: text('format', { enum: ALBUM_FORMATS }).notNull().default('LP'),
    coverPath: text('cover_path'),
    sleeveColor: text('sleeve_color').notNull().default('#2b2118'),
    rating: integer('rating').notNull().default(0),
    notes: text('notes'),
    position: integer('position').notNull().default(0), // order within its crate
    spinCount: integer('spin_count').notNull().default(0), // times pulled out of the crate
    // Added in migration 0005. Stable key of a demo album; NULL for everything else.
    demoSeedKey: text('demo_seed_key').unique(),
    ...timestamps,
  },
  (t) => [
    index('albums_crate_position_idx').on(t.crateId, t.position),
    check('albums_rating_range', sql`${t.rating} BETWEEN 0 AND 5`),
  ],
)

export const TRACK_SIDES = ['A', 'B', 'C', 'D'] as const

export const tracks = sqliteTable(
  'tracks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // 'cascade' = deleting an album deletes its tracks too.
    albumId: integer('album_id')
      .notNull()
      .references(() => albums.id, { onDelete: 'cascade' }),
    side: text('side', { enum: TRACK_SIDES }).notNull().default('A'),
    position: integer('position').notNull(), // order within its side
    title: text('title').notNull(),
    durationSec: integer('duration_sec'),
  },
  (t) => [index('tracks_album_side_position_idx').on(t.albumId, t.side, t.position)],
)

// Data classification: INTERNAL (personal data: who follows whom). Only counts and the signed-in
// viewer's own follows leave the API, never numeric user ids (see the public-data rule).
// 'cascade' = deleting a user deletes their follow rows in both directions.
export const follows = sqliteTable(
  'follows',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    followerId: integer('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: integer('followee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('follows_follower_followee_unique').on(t.followerId, t.followeeId),
    index('follows_followee_idx').on(t.followeeId),
    check('follows_no_self', sql`${t.followerId} <> ${t.followeeId}`),
  ],
)

// Data classification: INTERNAL (personal data: which crates a user favorited). Profiles show a
// user's favorites as public crate cards; numeric ids never leave the API.
// 'cascade' = deleting the user or the crate deletes the favorite rows.
export const crateFavorites = sqliteTable(
  'crate_favorites',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    crateId: integer('crate_id')
      .notNull()
      .references(() => crates.id, { onDelete: 'cascade' }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    uniqueIndex('crate_favorites_user_crate_unique').on(t.userId, t.crateId),
    index('crate_favorites_crate_idx').on(t.crateId),
  ],
)

// Data classification: PUBLIC. Demo or admin-written news shown on Home. seed_key is the stable
// key the demo seeding step matches on, so a row is never inserted twice. Admin-written rows use
// an admin: prefix, which is how the two are told apart.
export const newsItems = sqliteTable('news_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seedKey: text('seed_key').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  source: text('source').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
  createdAt: timestamps.createdAt,
})

// Relations don't change the database. They teach Drizzle's query API how tables
// connect, so you can write db.query.albums.findFirst({ with: { tracks: true } }).
export const usersRelations = relations(users, ({ many }) => ({
  crates: many(crates),
  sessions: many(sessions),
  links: many(userLinks),
  following: many(follows, { relationName: 'follower' }),
  followers: many(follows, { relationName: 'followee' }),
  crateFavorites: many(crateFavorites),
}))

export const crateFavoritesRelations = relations(crateFavorites, ({ one }) => ({
  user: one(users, { fields: [crateFavorites.userId], references: [users.id] }),
  crate: one(crates, { fields: [crateFavorites.crateId], references: [crates.id] }),
}))

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: 'follower',
  }),
  followee: one(users, {
    fields: [follows.followeeId],
    references: [users.id],
    relationName: 'followee',
  }),
}))

export const userLinksRelations = relations(userLinks, ({ one }) => ({
  user: one(users, { fields: [userLinks.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const cratesRelations = relations(crates, ({ one, many }) => ({
  owner: one(users, { fields: [crates.ownerId], references: [users.id] }),
  albums: many(albums),
  favorites: many(crateFavorites),
}))

export const albumsRelations = relations(albums, ({ one, many }) => ({
  crate: one(crates, { fields: [albums.crateId], references: [crates.id] }),
  tracks: many(tracks),
}))

export const tracksRelations = relations(tracks, ({ one }) => ({
  album: one(albums, { fields: [tracks.albumId], references: [albums.id] }),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type UserLink = typeof userLinks.$inferSelect
export type NewUserLink = typeof userLinks.$inferInsert
export type Crate = typeof crates.$inferSelect
export type NewCrate = typeof crates.$inferInsert
export type Album = typeof albums.$inferSelect
export type NewAlbum = typeof albums.$inferInsert
export type Track = typeof tracks.$inferSelect
export type NewTrack = typeof tracks.$inferInsert
export type Follow = typeof follows.$inferSelect
export type CrateFavorite = typeof crateFavorites.$inferSelect
export type NewsItem = typeof newsItems.$inferSelect
export type NewNewsItem = typeof newsItems.$inferInsert
