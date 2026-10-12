import type { AlbumDetail, AlbumSummary } from '@crate-digger/shared'
import { request } from './client.ts'

export function listAlbums(filter: { crateId?: number } = {}) {
  const query = filter.crateId ? `?crateId=${filter.crateId}` : ''
  return request<AlbumSummary[]>(`/albums${query}`)
}

export function getAlbum(id: number) {
  return request<AlbumDetail>(`/albums/${id}`)
}
