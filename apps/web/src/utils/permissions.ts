import type { PublicUser } from '@frisson/shared'

/**
 * May this user change this crate (and the records in it)? Admins may edit every crate,
 * including legacy ones with no owner; everyone else only their own. The API checks the
 * same rule on every write; this only decides which controls to show.
 */
export function canEditCrate(
  user: PublicUser | null,
  crate: { ownerId: number | null } | null | undefined,
): boolean {
  if (!user || !crate) return false
  if (user.role === 'admin') return true
  return crate.ownerId !== null && crate.ownerId === user.id
}
