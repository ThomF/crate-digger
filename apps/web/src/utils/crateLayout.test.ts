import { describe, expect, it } from 'vitest'
import { readableInk } from './color.ts'
import { VISIBLE_BEHIND, peekLift, sleevePose, visibleRange } from './crateLayout.ts'

describe('sleevePose', () => {
  it('stands the current sleeve upright and fully lit', () => {
    const pose = sleevePose(0)

    expect(pose.transform).toContain('translateZ(0px)')
    expect(pose.opacity).toBe(1)
    expect(pose.shade).toBe(0)
  })

  it('hides flipped sleeves and keeps them in front', () => {
    const pose = sleevePose(-1)

    expect(pose.opacity).toBe(0)
    expect(pose.zIndex).toBeGreaterThan(sleevePose(0).zIndex)
  })

  it('pushes deeper sleeves further back, darker and lower in the stack', () => {
    const near = sleevePose(1)
    const far = sleevePose(5)

    expect(far.shade).toBeGreaterThan(near.shade)
    expect(far.zIndex).toBeLessThan(near.zIndex)
    expect(sleevePose(VISIBLE_BEHIND + 1).opacity).toBe(0)
  })

  it('lifts each sleeve higher than the one in front of it', () => {
    const lifts = [0, 1, 2, 3, 4, 8].map(peekLift)

    expect(lifts).toEqual([...lifts].sort((a, b) => a - b))
    expect(new Set(lifts).size).toBe(lifts.length)
  })
})

describe('visibleRange', () => {
  it('draws a window around the current sleeve, clipped to the crate', () => {
    expect(visibleRange(0, 3)).toEqual([0, 3])
    expect(visibleRange(50, 500)).toEqual([48, 64])
    expect(visibleRange(499, 500)).toEqual([497, 500])
  })
})

describe('readableInk', () => {
  it.each([
    ['#ffffff', '#1b1712'],
    ['#f1f1f1', '#1b1712'],
    ['#e0b43c', '#1b1712'],
    ['#000000', '#f7f1e4'],
    ['#2f6fa3', '#f7f1e4'],
    ['#5a2a6e', '#f7f1e4'],
    ['not a color', '#1b1712'],
  ])('%s → %s', (background, ink) => {
    expect(readableInk(background)).toBe(ink)
  })
})
