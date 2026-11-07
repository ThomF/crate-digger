/**
 * Up to two letters for an avatar placeholder, e.g. "Mary Jane" -> "MJ".
 * Uses the display name when it has text, otherwise the username.
 */
export function initials(displayName: string, username: string): string {
  const name = displayName.trim() || username
  const words = name.split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0]![0]! + words[1]![0]! : name.slice(0, 2)
  return letters.toUpperCase()
}
