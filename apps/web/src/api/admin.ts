import type {
  AdminCrate,
  AdminCreateCrateRequest,
  AdminImportRequest,
  AdminImportResult,
  AdminNewsItem,
  AdminNewsRequest,
  AdminOverview,
  AdminUpdateNewsRequest,
  AdminUser,
} from '@frisson/shared'
import { request } from './client.ts'

// Every call here is admin only; the API answers 401 or 403 for anyone else.

export function getAdminOverview() {
  return request<AdminOverview>('/admin/overview')
}

// Data classification: CONFIDENTIAL (PII). The answer holds every user's email. Never persist or
// log it.
export function listAdminUsers() {
  return request<AdminUser[]>('/admin/users')
}

export function listAdminCrates() {
  return request<AdminCrate[]>('/admin/crates')
}

export function createAdminCrate(input: AdminCreateCrateRequest) {
  return request<AdminCrate>('/admin/crates', { method: 'POST', body: JSON.stringify(input) })
}

/** The API answers 409 when asked to suggest an ownerless crate. */
export function setCrateSuggested(id: number, suggested: boolean) {
  return request<AdminCrate>(`/admin/crates/${id}/suggested`, {
    method: 'PATCH',
    body: JSON.stringify({ suggested }),
  })
}

export function listAdminNews() {
  return request<AdminNewsItem[]>('/admin/news')
}

export function createAdminNews(input: AdminNewsRequest) {
  return request<AdminNewsItem>('/admin/news', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAdminNews(id: number, input: AdminUpdateNewsRequest) {
  return request<AdminNewsItem>(`/admin/news/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteAdminNews(id: number) {
  return request<void>(`/admin/news/${id}`, { method: 'DELETE' })
}

export function runAdminImport(input: AdminImportRequest) {
  return request<AdminImportResult>('/admin/import', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
