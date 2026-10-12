import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { DRAG_STEP, WHEEL_STEP, useCrateFlip } from './useCrateFlip.ts'

function setup(count = 10, start = 0) {
  const index = ref(start)
  return { index, flip: useCrateFlip(index, () => count) }
}

const wheel = (deltaY: number) => ({ deltaY, preventDefault: vi.fn() })

describe('useCrateFlip', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('never goes past either end of the crate', () => {
    const { index, flip } = setup(3)

    flip.prev()
    expect(index.value).toBe(0)

    flip.goTo(99)
    expect(index.value).toBe(2)
    flip.next()
    expect(index.value).toBe(2)
  })

  it.each([
    ['ArrowDown', 3, 4],
    ['ArrowRight', 3, 4],
    ['ArrowUp', 3, 2],
    ['PageDown', 3, 8],
    ['PageUp', 3, 0],
    ['Home', 3, 0],
    ['End', 3, 9],
  ])('%s from %i goes to %i', (key, start, expected) => {
    const { index, flip } = setup(10, start)

    expect(flip.onKeydown({ key })).toBe(true)
    expect(index.value).toBe(expected)
  })

  it('ignores keys it does not use (letters jump to dividers instead)', () => {
    const { index, flip } = setup(10, 3)

    expect(flip.onKeydown({ key: 'Enter' })).toBe(false)
    expect(flip.onKeydown({ key: 'j' })).toBe(false)
    expect(index.value).toBe(3)
  })

  it('flips once per WHEEL_STEP of scrolling, adding up small trackpad deltas', () => {
    const { index, flip } = setup()
    const event = wheel(WHEEL_STEP / 3)

    flip.onWheel(event)
    flip.onWheel(wheel(WHEEL_STEP / 3))
    expect(index.value).toBe(0)

    flip.onWheel(wheel(WHEEL_STEP / 3))
    expect(index.value).toBe(1)
    expect(event.preventDefault).toHaveBeenCalled() // the page doesn't scroll

    flip.onWheel(wheel(-WHEEL_STEP * 1.5))
    expect(index.value).toBe(0)
  })

  it('starts a fresh scroll gesture after a pause', () => {
    const { index, flip } = setup()

    flip.onWheel(wheel(WHEEL_STEP * 0.8))
    vi.advanceTimersByTime(300)
    flip.onWheel(wheel(WHEEL_STEP * 0.8))

    expect(index.value).toBe(0)
  })

  it('flips one record per DRAG_STEP dragged, and remembers it was a drag', () => {
    const { index, flip } = setup(10, 5)

    flip.onPointerDown({ clientY: 100 })
    flip.onPointerMove({ clientY: 100 + DRAG_STEP * 2 + 5 })
    expect(index.value).toBe(7)
    expect(flip.dragged.value).toBe(true)

    flip.onPointerMove({ clientY: 100 - DRAG_STEP }) // back up past the start
    expect(index.value).toBe(4)

    flip.onPointerUp()
    flip.onPointerMove({ clientY: 900 }) // moving without a button held does nothing
    expect(index.value).toBe(4)
  })

  it('treats a press without movement as a click, not a drag', () => {
    const { flip } = setup()

    flip.onPointerDown({ clientY: 100 })
    flip.onPointerMove({ clientY: 103 })
    flip.onPointerUp()

    expect(flip.dragged.value).toBe(false)
  })
})
