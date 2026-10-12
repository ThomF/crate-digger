import type { ApiError } from '@crate-digger/shared'

/** Thrown for any non-2xx response. `body` is the API's { statusCode, error, message, issues? }. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly body: ApiError | null

  constructor(status: number, body: ApiError | null) {
    super(body?.message ?? `Request failed (${status})`)
    this.status = status
    this.body = body
  }
}

/**
 * The one place the web app talks HTTP. Paths are relative to /api, which Vite proxies
 * to Fastify in dev (see vite.config.ts) and the same server serves in production.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      // JSON bodies are strings. FormData (file uploads) sets its own multipart header.
      ...(typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null
    throw new ApiRequestError(res.status, body)
  }

  return (res.status === 204 ? undefined : await res.json()) as T
}

/** A message safe to show a person, whatever was thrown. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message
  if (err instanceof TypeError) return "Can't reach the API. Is it running?" // fetch network failure
  return 'Something went wrong'
}
