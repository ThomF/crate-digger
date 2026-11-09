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

/**
 * Does this crate's page offer this user the add and manage shortcuts? Narrower than
 * canEditCrate: an admin keeps edit rights on other users' crates but does not get these
 * shortcuts on that crate's page. Ownerless legacy crates still offer them to admins only.
 */
export function showsCrateActions(
  user: PublicUser | null,
  crate: { ownerId: number | null } | null | undefined,
): boolean {
  if (!user || !crate) return false
  if (crate.ownerId === null) return user.role === 'admin'
  return crate.ownerId === user.id
}
