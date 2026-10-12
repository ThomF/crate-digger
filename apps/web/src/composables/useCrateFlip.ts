import { ref, type Ref } from 'vue'

// All the ways to flip through a crate (keys, scroll wheel, dragging) turned into one thing:
// changing `index`. The component decides what index *means* visually.

/** Scroll distance per flip. Trackpads send many small deltas, mice a few big ones. */
export const WHEEL_STEP = 60
/** Drag distance per flip, in px. */
export const DRAG_STEP = 36

export function useCrateFlip(index: Ref<number>, count: () => number) {
  const clamp = (i: number) => Math.max(0, Math.min(i, count() - 1))

  function goTo(i: number) {
    index.value = clamp(i)
  }
  const next = () => goTo(index.value + 1)
  const prev = () => goTo(index.value - 1)

  // ── Scroll wheel ──────────────────────────────────────────────────────
  // Add up deltas and flip once per WHEEL_STEP, so one notch ≈ one record on any device.
  let wheelTotal = 0
  let wheelIdle: ReturnType<typeof setTimeout> | undefined

  function onWheel(event: Pick<WheelEvent, 'deltaY' | 'preventDefault'>) {
    event.preventDefault() // flip the crate instead of scrolling the page
    wheelTotal += event.deltaY
    while (wheelTotal >= WHEEL_STEP) {
      next()
      wheelTotal -= WHEEL_STEP
    }
    while (wheelTotal <= -WHEEL_STEP) {
      prev()
      wheelTotal += WHEEL_STEP
    }
    clearTimeout(wheelIdle)
    wheelIdle = setTimeout(() => (wheelTotal = 0), 200) // a pause starts a fresh gesture
  }

  // ── Dragging (mouse, pen or finger) ───────────────────────────────────
  // Pull down toward you to flip forward, push up to go back, like fingering through records.
  let dragStartY: number | null = null
  let dragStartIndex = 0
  const dragged = ref(false) // true once a drag actually moved, so it doesn't also count as a click

  function onPointerDown(event: Pick<PointerEvent, 'clientY'>) {
    dragStartY = event.clientY
    dragStartIndex = index.value
    dragged.value = false
  }

  function onPointerMove(event: Pick<PointerEvent, 'clientY'>) {
    if (dragStartY === null) return
    const steps = Math.trunc((event.clientY - dragStartY) / DRAG_STEP)
    if (steps !== 0) dragged.value = true
    goTo(dragStartIndex + steps)
  }

  function onPointerUp() {
    dragStartY = null
  }

  // ── Keyboard ──────────────────────────────────────────────────────────
  /** Returns true if the key was handled, so the caller can preventDefault. */
  function onKeydown(event: Pick<KeyboardEvent, 'key'>): boolean {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'j':
        next()
        return true
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'k':
        prev()
        return true
      case 'PageDown':
        goTo(index.value + 5)
        return true
      case 'PageUp':
        goTo(index.value - 5)
        return true
      case 'Home':
        goTo(0)
        return true
      case 'End':
        goTo(count() - 1)
        return true
      default:
        return false
    }
  }

  return {
    goTo,
    next,
    prev,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeydown,
    dragged,
  }
}
