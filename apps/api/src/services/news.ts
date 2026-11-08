import { desc } from 'drizzle-orm'
import type { NewsItem } from '@frisson/shared'
import type { Db } from '../db/client.ts'
import { newsItems } from '../db/schema.ts'

// Data classification: PUBLIC. Fictional demo news. Columns are listed by hand so the seed key
// is never selected into a response.

/** Newest first; items published at the same moment fall back to the higher id first. */
export function listNews(db: Db): NewsItem[] {
  const rows = db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      summary: newsItems.summary,
      source: newsItems.source,
      publishedAt: newsItems.publishedAt,
    })
    .from(newsItems)
    .orderBy(desc(newsItems.publishedAt), desc(newsItems.id))
    .all()
  return rows.map((row) => ({ ...row, publishedAt: row.publishedAt.toISOString() }))
}
