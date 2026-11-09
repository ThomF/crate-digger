import { randomUUID } from 'node:crypto'
import { asc, count, desc, eq, isNotNull, max, sql } from 'drizzle-orm'
import type {
  AdminCrate,
  AdminCreateCrateInput,
  AdminImportInput,
  AdminImportResult,
  AdminNewsInput,
  AdminNewsItem,
  AdminOverview,
  AdminUpdateNewsInput,
  AdminUser,
  PublicUser,
} from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { albums, crates, newsItems, tracks, users } from '../db/schema.ts'
import { HttpError, notFound } from '../errors.ts'

// Everything behind /api/admin/*. The route plugin's onRequest hook has already called
// requireAdmin, so nothing here decides who may do what.
//
// Data classification: CONFIDENTIAL. listAdminUsers returns PII (emails) to admins only.
// Columns are selected by hand so passwordHash never enters a result, and the demo and seed keys
// are reduced to an isDemo boolean before anything is returned.

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Seed keys of admin-written news start with this; demo news uses 'news:'. */
const ADMIN_NEWS_KEY_PREFIX = 'admin:'

function countRows(db: Db, table: typeof users | typeof crates | typeof albums | typeof newsItems) {
  return db.select({ value: count() }).from(table).get()?.value ?? 0
}

export function getAdminOverview(db: Db): AdminOverview {
  const suggestedCrates =
    db.select({ value: count() }).from(crates).where(isNotNull(crates.recommendedRank)).get()
      ?.value ?? 0
  return {
    users: countRows(db, users),
    crates: countRows(db, crates),
    suggestedCrates,
    albums: countRows(db, albums),
    news: countRows(db, newsItems),
  }
}

/** Data classification: CONFIDENTIAL (PII). Every user, including demo users, oldest id first. */
export function listAdminUsers(db: Db): AdminUser[] {
  const rows = db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      verified: users.verified,
      demoSeedKey: users.demoSeedKey,
      createdAt: users.createdAt,
      // LEFT JOIN so a user with no crates still shows up, with crateCount 0.
      crateCount: count(crates.id),
    })
    .from(users)
    .leftJoin(crates, eq(crates.ownerId, users.id))
    .groupBy(users.id)
    .orderBy(asc(users.id))
    .all()
  return rows.map(({ demoSeedKey, createdAt, ...row }) => ({
    ...row,
    isDemo: demoSeedKey !== null,
    createdAt: createdAt.toISOString(),
  }))
}

// LEFT JOINs so empty crates and ownerless crates still show up.
function selectAdminCrates(db: Db) {
  return db
    .select({
      id: crates.id,
      name: crates.name,
      label: crates.label,
      color: crates.color,
      albumCount: count(albums.id),
      ownerUsername: users.username,
      ownerDisplayName: users.displayName,
      recommendedRank: crates.recommendedRank,
      demoSeedKey: crates.demoSeedKey,
      createdAt: crates.createdAt,
    })
    .from(crates)
    .leftJoin(albums, eq(albums.crateId, crates.id))
    .leftJoin(users, eq(users.id, crates.ownerId))
    .groupBy(crates.id)
    .$dynamic()
}

type AdminCrateRow = ReturnType<ReturnType<typeof selectAdminCrates>['all']>[number]

function toAdminCrate({ demoSeedKey, createdAt, ...row }: AdminCrateRow): AdminCrate {
  return { ...row, isDemo: demoSeedKey !== null, createdAt: createdAt.toISOString() }
}

/** Suggested crates first, by rank then id; then the rest by id. */
export function listAdminCrates(db: Db): AdminCrate[] {
  return selectAdminCrates(db)
    .orderBy(sql`${crates.recommendedRank} IS NULL`, asc(crates.recommendedRank), asc(crates.id))
    .all()
    .map(toAdminCrate)
}

function getAdminCrate(db: Db, id: number): AdminCrate {
  const row = selectAdminCrates(db).where(eq(crates.id, id)).get()
  if (!row) throw notFound(`Crate ${id}`)
  return toAdminCrate(row)
}

/** The rank that puts a crate last among the suggested ones. */
function nextRank(tx: Tx) {
  const last = tx
    .select({ value: max(crates.recommendedRank) })
    .from(crates)
    .get()?.value
  return (last ?? 0) + 1
}

/** The sort order that puts a crate last on the shelf. */
function nextSortOrder(tx: Tx) {
  const last = tx
    .select({ value: max(crates.sortOrder) })
    .from(crates)
    .get()?.value
  return (last ?? -1) + 1
}

/** A new crate owned by the admin, last on the shelf and, if suggested, last on Home. */
export function createAdminCrate(
  db: Db,
  admin: PublicUser,
  { suggested, ...fields }: AdminCreateCrateInput,
): AdminCrate {
  const id = db.transaction((tx) => {
    return tx
      .insert(crates)
      .values({
        ...fields,
        ownerId: admin.id,
        sortOrder: nextSortOrder(tx),
        recommendedRank: suggested ? nextRank(tx) : null,
      })
      .returning({ id: crates.id })
      .get().id
  })
  return getAdminCrate(db, id)
}

/**
 * 404 for an unknown id. 409 when suggesting an ownerless crate: the recommended list inner-joins
 * the owner, since a card has to name one. Suggesting an already suggested crate keeps its rank.
 */
export function setCrateSuggested(db: Db, id: number, suggested: boolean): AdminCrate {
  db.transaction((tx) => {
    const crate = tx
      .select({ ownerId: crates.ownerId, recommendedRank: crates.recommendedRank })
      .from(crates)
      .where(eq(crates.id, id))
      .get()
    if (!crate) throw notFound(`Crate ${id}`)

    if (!suggested) {
      tx.update(crates).set({ recommendedRank: null }).where(eq(crates.id, id)).run()
      return
    }
    if (crate.ownerId === null) {
      throw new HttpError(409, 'A crate with no owner cannot be suggested')
    }
    if (crate.recommendedRank !== null) return
    tx.update(crates)
      .set({ recommendedRank: nextRank(tx) })
      .where(eq(crates.id, id))
      .run()
  })
  return getAdminCrate(db, id)
}

const adminNewsColumns = {
  id: newsItems.id,
  title: newsItems.title,
  summary: newsItems.summary,
  source: newsItems.source,
  publishedAt: newsItems.publishedAt,
  seedKey: newsItems.seedKey,
}

type AdminNewsRow = { publishedAt: Date; seedKey: string } & Omit<
  AdminNewsItem,
  'publishedAt' | 'isDemo'
>

function toAdminNewsItem({ seedKey, publishedAt, ...row }: AdminNewsRow): AdminNewsItem {
  return {
    ...row,
    publishedAt: publishedAt.toISOString(),
    isDemo: !seedKey.startsWith(ADMIN_NEWS_KEY_PREFIX),
  }
}

/** The same order as the public listNews: newest first, then the higher id first. */
export function listAdminNews(db: Db): AdminNewsItem[] {
  return db
    .select(adminNewsColumns)
    .from(newsItems)
    .orderBy(desc(newsItems.publishedAt), desc(newsItems.id))
    .all()
    .map(toAdminNewsItem)
}

function newNewsRow({ publishedAt, ...fields }: AdminNewsInput) {
  return {
    ...fields,
    seedKey: `${ADMIN_NEWS_KEY_PREFIX}${randomUUID()}`,
    publishedAt: publishedAt === undefined ? new Date() : new Date(publishedAt),
  }
}

export function createAdminNews(db: Db, input: AdminNewsInput): AdminNewsItem {
  return toAdminNewsItem(
    db.insert(newsItems).values(newNewsRow(input)).returning(adminNewsColumns).get(),
  )
}

/** Changes only the fields sent, on demo rows too. The seed key is never touched. */
export function updateAdminNews(
  db: Db,
  id: number,
  { publishedAt, ...fields }: AdminUpdateNewsInput,
): AdminNewsItem {
  const row = db
    .update(newsItems)
    .set({
      ...fields,
      ...(publishedAt === undefined ? {} : { publishedAt: new Date(publishedAt) }),
    })
    .where(eq(newsItems.id, id))
    .returning(adminNewsColumns)
    .get()
  if (!row) throw notFound(`News item ${id}`)
  return toAdminNewsItem(row)
}

export function deleteAdminNews(db: Db, id: number): void {
  const result = db.delete(newsItems).where(eq(newsItems.id, id)).run()
  if (result.changes === 0) throw notFound(`News item ${id}`)
}

/**
 * Creates everything or nothing, in one transaction. Crates are owned by the admin and keep the
 * request's order, on the shelf and among the suggested ones. Zod has rejected any bad entry
 * before this runs; the transaction covers a failure during the writes themselves.
 */
export function runAdminImport(
  db: Db,
  admin: PublicUser,
  input: AdminImportInput,
): AdminImportResult {
  const result: AdminImportResult = { crates: 0, albums: 0, tracks: 0, news: 0 }

  db.transaction((tx) => {
    let sortOrder = nextSortOrder(tx)
    let rank = nextRank(tx)

    for (const { suggested, albums: albumInputs, ...fields } of input.crates) {
      const crate = tx
        .insert(crates)
        .values({
          ...fields,
          ownerId: admin.id,
          sortOrder: sortOrder++,
          recommendedRank: suggested ? rank++ : null,
        })
        .returning({ id: crates.id })
        .get()
      result.crates += 1

      albumInputs.forEach(({ tracks: tracklist, ...albumFields }, position) => {
        const album = tx
          .insert(albums)
          .values({ ...albumFields, crateId: crate.id, position })
          .returning({ id: albums.id })
          .get()
        result.albums += 1

        if (tracklist?.length) {
          tx.insert(tracks)
            .values(tracklist.map((track) => ({ ...track, albumId: album.id })))
            .run()
          result.tracks += tracklist.length
        }
      })
    }

    for (const item of input.news) {
      tx.insert(newsItems).values(newNewsRow(item)).run()
      result.news += 1
    }
  })

  return result
}
