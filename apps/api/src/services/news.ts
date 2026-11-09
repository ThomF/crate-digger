import { desc } from 'drizzle-orm'
import type { NewsItem } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { newsItems } from '../db/schema.ts'

// Data classification: PUBLIC. Demo or admin-written news. Columns are listed by hand so the seed
// key is reduced to isDemo before anything is returned.

/** Seed key prefix of admin-written news. Anything else came from the demo seed. */
export const ADMIN_NEWS_KEY_PREFIX = 'admin:'

export function isDemoNewsKey(seedKey: string): boolean {
  return !seedKey.startsWith(ADMIN_NEWS_KEY_PREFIX)
}

/** Newest first; items published at the same moment fall back to the higher id first. */
export function listNews(db: Db): NewsItem[] {
  const rows = db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      summary: newsItems.summary,
      source: newsItems.source,
      publishedAt: newsItems.publishedAt,
      seedKey: newsItems.seedKey,
    })
    .from(newsItems)
    .orderBy(desc(newsItems.publishedAt), desc(newsItems.id))
    .all()
  return rows.map(({ seedKey, publishedAt, ...row }) => ({
    ...row,
    publishedAt: publishedAt.toISOString(),
    isDemo: isDemoNewsKey(seedKey),
  }))
}
