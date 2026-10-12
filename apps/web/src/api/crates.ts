import type { Crate } from '@crate-digger/shared'
import { request } from './client.ts'

export function listCrates() {
  return request<Crate[]>('/crates')
}
