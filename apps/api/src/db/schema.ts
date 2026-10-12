import { relations, sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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

export const crates = sqliteTable('crates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#c8a374'),
  label: text('label'), // the handwritten text on the front of the crate
  sortOrder: integer('sort_order').notNull().default(0),
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

// Relations don't change the database. They teach Drizzle's query API how tables
// connect, so you can write db.query.albums.findFirst({ with: { tracks: true } }).
export const cratesRelations = relations(crates, ({ many }) => ({
  albums: many(albums),
}))

export const albumsRelations = relations(albums, ({ one, many }) => ({
  crate: one(crates, { fields: [albums.crateId], references: [crates.id] }),
  tracks: many(tracks),
}))

export const tracksRelations = relations(tracks, ({ one }) => ({
  album: one(albums, { fields: [tracks.albumId], references: [albums.id] }),
}))

export type Crate = typeof crates.$inferSelect
export type NewCrate = typeof crates.$inferInsert
export type Album = typeof albums.$inferSelect
export type NewAlbum = typeof albums.$inferInsert
export type Track = typeof tracks.$inferSelect
export type NewTrack = typeof tracks.$inferInsert
