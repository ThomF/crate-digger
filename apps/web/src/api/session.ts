import type { SessionInfo } from '@crate-digger/shared'
import { request } from './client.ts'

export function getSession() {
  return request<SessionInfo>('/session')
}

export function logIn(password: string) {
  return request<SessionInfo>('/session', { method: 'POST', body: JSON.stringify({ password }) })
}

export function logOut() {
  return request<SessionInfo>('/session', { method: 'DELETE' })
}
