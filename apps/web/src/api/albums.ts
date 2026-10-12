import type {
  AlbumDetail,
  AlbumSummary,
  CreateAlbumRequest,
  TrackInput,
  UpdateAlbumInput,
} from '@crate-digger/shared'
import { request } from './client.ts'

export function listAlbums(filter: { crateId?: number } = {}) {
  const query = filter.crateId ? `?crateId=${filter.crateId}` : ''
  return request<AlbumSummary[]>(`/albums${query}`)
}

export function getAlbum(id: number) {
  return request<AlbumDetail>(`/albums/${id}`)
}

export function createAlbum(body: CreateAlbumRequest) {
  return request<AlbumDetail>('/albums', { method: 'POST', body: JSON.stringify(body) })
}

export function updateAlbum(id: number, body: UpdateAlbumInput) {
  return request<AlbumDetail>(`/albums/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function replaceTracks(id: number, tracks: TrackInput[]) {
  return request<AlbumDetail>(`/albums/${id}/tracks`, {
    method: 'PUT',
    body: JSON.stringify(tracks),
  })
}

export function deleteAlbum(id: number) {
  return request<void>(`/albums/${id}`, { method: 'DELETE' })
}
