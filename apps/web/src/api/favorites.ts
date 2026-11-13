import { request } from './client.ts'

// Data classification: INTERNAL. Which crates the signed-in user has favorited. Requests act only
// on the viewer's own favorites, through their session; nothing here names another user.

function favoritePath(crateId: number) {
  return `/crates/${crateId}/favorite`
}

/** Repeating it is fine: the API answers 204 either way. 400 on your own crate. */
export function favoriteCrate(id: number) {
  return request<void>(favoritePath(id), { method: 'PUT' })
}

/** Repeating it is fine: the API answers 204 either way. */
export function unfavoriteCrate(id: number) {
  return request<void>(favoritePath(id), { method: 'DELETE' })
}
