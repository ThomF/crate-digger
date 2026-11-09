import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NewsItem } from '@frisson/shared'
import { newsItem } from '@frisson/shared'
import { newsItems } from '../src/db/schema.ts'
import { seedDemoContent } from '../src/services/demo-seed.ts'
import { buildTestApp, type TestApp } from './helpers.ts'

// GET /api/news: public, newest first, never the seed key.

let app: TestApp
beforeEach(async () => {
  app = await buildTestApp()
})
afterEach(() => app.close())

const getNews = () => app.inject({ url: '/api/news' })

const addNews = (seedKey: string, publishedAt: Date) =>
  app.db
    .insert(newsItems)
    .values({ seedKey, title: seedKey, summary: 'A summary', source: 'A source', publishedAt })
    .returning({ id: newsItems.id })
    .get().id

describe('GET /api/news', () => {
  it('is an empty array before any seeding', async () => {
    const res = await getNews()

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  describe('with demo content', () => {
    let items: NewsItem[]
    beforeEach(async () => {
      seedDemoContent(app.db)
      const res = await getNews()
      // No cookie was sent: public.
      expect(res.statusCode).toBe(200)
      items = res.json<NewsItem[]>()
    })

    it('returns at least 6 items with every field filled in', () => {
      expect(items.length).toBeGreaterThanOrEqual(6)
      for (const item of items) {
        expect(newsItem.safeParse(item).success).toBe(true)
        expect(item.title.length).toBeGreaterThan(0)
        expect(item.summary.length).toBeGreaterThan(0)
        expect(item.source.length).toBeGreaterThan(0)
      }
    })

    it('gives publishedAt as a full ISO string', () => {
      for (const item of items) {
        expect(new Date(item.publishedAt).toISOString()).toBe(item.publishedAt)
      }
    })

    it('sorts newest first', () => {
      const times = items.map((item) => Date.parse(item.publishedAt))
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })

    it('marks seeded news as demo', () => {
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) expect(item.isDemo).toBe(true)
    })

    it('exposes exactly the contract keys, so never the seed key', () => {
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual([
          'id',
          'isDemo',
          'publishedAt',
          'source',
          'summary',
          'title',
        ])
      }
    })
  })

  it('orders by date whatever the insert order, and by higher id on a tie', async () => {
    const tied = new Date('2026-03-01T12:00:00.000Z')
    const oldest = addNews('oldest', new Date('2026-01-01T12:00:00.000Z'))
    const tiedFirst = addNews('tied-first', tied)
    const newest = addNews('newest', new Date('2026-06-01T12:00:00.000Z'))
    const tiedSecond = addNews('tied-second', tied)

    const items = (await getNews()).json<NewsItem[]>()

    expect(items.map((item) => item.id)).toEqual([newest, tiedSecond, tiedFirst, oldest])
    expect(items[0]?.publishedAt).toBe('2026-06-01T12:00:00.000Z')
  })
})
