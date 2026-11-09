import type { NewsItem } from '@frisson/shared'
import { request } from './client.ts'

// Data classification: PUBLIC. Demo or admin-written news, readable by anyone.

/** Newest first. */
export function listNews() {
  return request<NewsItem[]>('/news')
}
