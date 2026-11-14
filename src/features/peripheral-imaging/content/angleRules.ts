/**
 * The C-arm angle rules Sections 4, 5, 6, 9 and 19 print, as data the model-truth suite holds to
 * the course CT and to the course's angle convention (positive obliquity RAO, positive tilt
 * cranial).
 *
 * Expert-session round, part 2 (2026-10-20). The educators' slides confirmed each rule; their
 * wording, cases and images stay out of this public repository. Every angle printed below is a
 * reading of this course's own CT, not a number from the slides.
 */
export type ChestWallQuadrant =
  | 'left anterior'
  | 'left posterior'
  | 'right anterior'
  | 'right posterior'

/**
 * A hand laid flat on the chest wall over a peripheral nodule: the beam that runs along the palm,
 * through the nodule, tangent to the chest wall there, reaches the image receptor on this side.
 */
export const OBLIQUITY_ALONG_CHEST_WALL: Readonly<Record<ChestWallQuadrant, 'RAO' | 'LAO'>> = {
  'left anterior': 'RAO',
  'right posterior': 'RAO',
  'right anterior': 'LAO',
  'left posterior': 'LAO',
}

/** The course nodule lies in the posterior left lung, behind the heart. */
export const COURSE_NODULE_QUADRANT: ChestWallQuadrant = 'left posterior'

/** Views of the course nodule that the copy names, as view obliquity and beam tilt in degrees. */
export const ANGLE_EXAMPLES = {
  /** LAO far enough that only lung lies over the nodule. */
  clearOblique: { obliquity: -24, tilt: 0 },
  /** The two-axis example's LAO: the heart is off the nodule and a rib crosses it. */
  ribOblique: { obliquity: -20, tilt: 0 },
  /** The nudge that takes that rib off the nodule: a little cranial angulation. */
  ribNudgeTilt: 3,
  /** Straight on, cranial angulation alone clears the heart with only lung over the nodule. */
  cranialFrontal: { obliquity: 0, tilt: 12 },
  /** A wedge under the left side buys the clear view with less C-arm obliquity. */
  wedge: { wedge: 15, orbit: -9 },
  /** Section 19's room: the docked equipment leaves this much C-arm obliquity; the wedge adds view. */
  runThroughOrbitLimit: 10,
} as const

/** "LAO 24°", "RAO 10°", "0°": a signed obliquity in console terms. */
export function obliquityName(degrees: number): string {
  if (degrees === 0) return '0°'
  return `${degrees > 0 ? 'RAO' : 'LAO'} ${Math.abs(degrees)}°`
}
