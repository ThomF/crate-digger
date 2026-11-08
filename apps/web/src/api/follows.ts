import type { CollectorSummary, CrateCard } from '@frisson/shared'
import { request } from './client.ts'

// Data classification: PUBLIC. Responses hold public summaries only (no email, role or user id).
// Who the signed-in user follows is only ever requested for that user, through their session.

function followPath(username: string) {
  return `/users/${encodeURIComponent(username)}/follow`
}

/** Repeating it is fine: the API answers 204 either way. */
export function follow(username: string) {
  return request<void>(followPath(username), { method: 'PUT' })
}

/** Repeating it is fine: the API answers 204 either way. */
export function unfollow(username: string) {
  return request<void>(followPath(username), { method: 'DELETE' })
}

/** The signed-in user's follows, most recently followed first. */
export function listFollowing() {
  return request<CollectorSummary[]>('/me/following')
}

/** Crates owned by people the signed-in user follows, newest first. */
export function getFeed() {
  return request<CrateCard[]>('/me/feed')
}

/** Demo collectors the signed-in user does not follow yet. */
export function listSuggestedCollectors() {
  return request<CollectorSummary[]>('/me/suggested-collectors')
}
