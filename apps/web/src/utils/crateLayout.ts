// Where each sleeve sits in the 3D crate, as a pure function of its distance from the
// sleeve you're looking at. Keeping the math here (not in CSS or the component) makes it
// easy to tweak and to test.
//
//   offset < 0   already flipped: tipped toward you and faded out (in a real crate they'd
//                lean against your hand, out of your line of sight)
//   offset = 0   the sleeve you're looking at: standing up, face visible
//   offset > 0   still behind it: further back, only their top edges peek out

/** How many sleeves behind the current one are drawn. */
export const VISIBLE_BEHIND = 12
/** How many flipped sleeves stay drawn, so the most recent flip can animate out. */
export const VISIBLE_FLIPPED = 1
/** Distance between sleeves, in px. */
export const SLEEVE_GAP = 26

export type SleevePose = {
  transform: string
  opacity: number
  /** 0 = fully lit, 1 = black. Sleeves further back sit in the crate's shadow. */
  shade: number
  zIndex: number
}

export function sleevePose(offset: number): SleevePose {
  if (offset < 0) {
    return {
      // Pivot on the bottom edge and tip toward you while fading out.
      transform: 'translateZ(40px) rotateX(-55deg)',
      opacity: 0,
      shade: 0,
      zIndex: 101,
    }
  }

  const depth = Math.min(offset, VISIBLE_BEHIND + 1)
  return {
    // Further back, lifted so each top edge peeks over the one in front (the first few
    // the most, so their labels are readable), and leaning back a little more.
    transform: [
      `translateZ(${-depth * SLEEVE_GAP}px)`,
      `translateY(${-peekLift(depth)}px)`,
      `rotateX(${8 + Math.min(depth, 4) * 1.5}deg)`,
    ].join(' '),
    opacity: depth > VISIBLE_BEHIND ? 0 : 1,
    shade: Math.min(depth * 0.07, 0.6),
    zIndex: 100 - depth,
  }
}

/** How far up a sleeve `depth` records back sits, in px. */
export function peekLift(depth: number) {
  return Math.min(depth, 3) * 14 + Math.max(depth - 3, 0) * 5
}

/** Indexes worth rendering around `index`: drawn sleeves plus one invisible on each side. */
export function visibleRange(index: number, count: number): [start: number, end: number] {
  const start = Math.max(0, index - VISIBLE_FLIPPED - 1)
  const end = Math.min(count, index + VISIBLE_BEHIND + 2)
  return [start, end]
}
