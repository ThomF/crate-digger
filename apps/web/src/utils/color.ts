/**
 * Picks dark or light text for a background color, so labels printed on a sleeve stay
 * readable whatever color the sleeve is. Uses WCAG relative luminance.
 */
export function readableInk(hex: string): '#1b1712' | '#f7f1e4' {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!match) return '#1b1712'

  const value = parseInt(match[1]!, 16)
  const [r, g, b] = [value >> 16, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // 0.18 is roughly where dark and light text have equal contrast.
  return luminance > 0.18 ? '#1b1712' : '#f7f1e4'
}
