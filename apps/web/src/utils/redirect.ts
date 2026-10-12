/**
 * Where to go after logging in. Only paths inside this app are allowed: otherwise a link
 * like /login?next=https://evil.example would bounce people to another site after they
 * type their password (an "open redirect").
 */
export function safeRedirect(next: string | undefined): string {
  if (!next || !next.startsWith('/')) return '/'
  // "//evil.example" and "/\evil.example" are read by browsers as other sites.
  if (next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}
