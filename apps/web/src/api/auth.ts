import type { CredentialsInput, PublicUser, SignupInput } from '@frisson/shared'
import { ApiRequestError, request } from './client.ts'

// Data classification: CONFIDENTIAL (PII + credentials). Emails and passwords pass
// through here on their way to the API; nothing is stored in the browser except the
// HttpOnly session cookie the API sets.

/** The signed-in user, or null when nobody is signed in (the API answers 401). */
export async function me(): Promise<PublicUser | null> {
  try {
    return await request<PublicUser>('/auth/me')
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) return null
    throw err
  }
}

export function signUp(input: SignupInput) {
  return request<PublicUser>('/auth/signup', { method: 'POST', body: JSON.stringify(input) })
}

export function logIn(credentials: CredentialsInput) {
  return request<PublicUser>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
}

/** Sent with no body (and so no JSON content-type): the API rejects an empty JSON body. */
export function logOut() {
  return request<void>('/auth/logout', { method: 'POST' })
}
