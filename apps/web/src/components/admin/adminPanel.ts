import { ApiRequestError, errorMessage } from '../../api/client.ts'
import type { useAsyncSection } from '../../composables/useAsyncSection.ts'

/** One section of the panel, owned by AdminView so a bulk import can refresh them all. */
export type AsyncSection<T> = ReturnType<typeof useAsyncSection<T>>

/** The part of a section that does not depend on what it holds. */
export type SectionState = Pick<AsyncSection<unknown>, 'status' | 'error' | 'load'>

export interface FormError {
  message: string
  /** One line per failing field, naming it: 'crates/0/albums/1/artist: Required'. */
  issues: string[]
}

function issueText({ path, message }: { path: string; message: string }) {
  const where = path.replace(/^body\/?/, '')
  return where ? `${where}: ${message}` : message
}

/** errorMessage alone only says 'Request is invalid', so this keeps the API's per-field issues. */
export function toFormError(err: unknown): FormError {
  if (err instanceof ApiRequestError) {
    if (err.status === 413) {
      return { message: 'That is too large to send. Split it up and try again.', issues: [] }
    }
    const issues = err.body?.issues ?? []
    if (issues.length > 0) return { message: errorMessage(err), issues: issues.map(issueText) }
  }
  return { message: errorMessage(err), issues: [] }
}
