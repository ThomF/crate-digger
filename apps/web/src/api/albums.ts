import type {
  AlbumDetail,
  AlbumQuery,
  AlbumSummary,
  CreateAlbumRequest,
  MoveAlbumInput,
  TrackInput,
  UpdateAlbumInput,
} from '@crate-digger/shared'
import { request } from './client.ts'

/** `signal` lets a caller cancel a search that's been overtaken by a newer one. */
export function listAlbums(query: AlbumQuery = {}, signal?: AbortSignal) {
  // URLSearchParams handles encoding, so "AC/DC & friends" survives the trip.
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const search = params.size ? `?${params}` : ''
  return request<AlbumSummary[]>(`/albums${search}`, { signal })
}

export function moveAlbum(id: number, body: MoveAlbumInput) {
  return request<AlbumDetail>(`/albums/${id}/position`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
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

/** Sends the image as multipart/form-data, the same way a plain HTML file form would. */
export function uploadCover(id: number, file: File) {
  const form = new FormData()
  form.append('cover', file)
  return request<AlbumDetail>(`/albums/${id}/cover`, { method: 'POST', body: form })
}

export function removeCover(id: number) {
  return request<AlbumDetail>(`/albums/${id}/cover`, { method: 'DELETE' })
}
