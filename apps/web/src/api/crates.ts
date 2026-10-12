import type { Crate, CreateCrateRequest, UpdateCrateInput } from '@crate-digger/shared'
import { request } from './client.ts'

export function listCrates() {
  return request<Crate[]>('/crates')
}

export function createCrate(body: CreateCrateRequest) {
  return request<Crate>('/crates', { method: 'POST', body: JSON.stringify(body) })
}

export function updateCrate(id: number, body: UpdateCrateInput) {
  return request<Crate>(`/crates/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

/** Fails with 409 if the crate still holds records. */
export function deleteCrate(id: number) {
  return request<void>(`/crates/${id}`, { method: 'DELETE' })
}

/** Saves a new shelf order. `ids` must list every crate. */
export function reorderCrates(ids: number[]) {
  return request<Crate[]>('/crates/order', { method: 'PUT', body: JSON.stringify({ ids }) })
}
