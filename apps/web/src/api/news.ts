import type { NewsItem } from '@frisson/shared'
import { request } from './client.ts'

// Data classification: PUBLIC. Fictional demo news, readable by anyone.

/** Newest first. */
export function listNews() {
  return request<NewsItem[]>('/news')
}
