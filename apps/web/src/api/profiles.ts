import type { PublicProfile, SetVerifiedInput, UpdateProfileRequest } from '@frisson/shared'
import { request } from './client.ts'

// Data classification: PUBLIC. Profiles (username, display name, bio, location, avatar,
// links, verified flag, public crates) are shown to anyone; the API never includes email.

/** Usernames are already URL-safe by the shared rule, but encode anyway. */
function userPath(username: string) {
  return `/users/${encodeURIComponent(username)}`
}

export function getProfile(username: string) {
  return request<PublicProfile>(userPath(username))
}

export function updateProfile(input: UpdateProfileRequest) {
  return request<PublicProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify(input) })
}

/** Sends the image as multipart/form-data under the field name `avatar`. */
export function uploadAvatar(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  return request<PublicProfile>('/me/avatar', { method: 'POST', body: form })
}

export function removeAvatar() {
  return request<PublicProfile>('/me/avatar', { method: 'DELETE' })
}

/** Admin only; the API answers 403 for anyone else. */
export function setVerified(username: string, verified: boolean) {
  const body: SetVerifiedInput = { verified }
  return request<PublicProfile>(`${userPath(username)}/verified`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
