import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { newsItem } from '@frisson/shared'
import { listNews } from '../services/news.ts'

// Data classification: PUBLIC. Anyone can read the news, signed in or not.
export const newsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/news', { schema: { response: { 200: newsItem.array() } } }, async () =>
    listNews(app.db),
  )
}
