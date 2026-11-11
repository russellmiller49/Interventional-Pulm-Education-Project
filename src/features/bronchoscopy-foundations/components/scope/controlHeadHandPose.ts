/**
 * Where the left hand's moving parts go on the control head: the lever's thumb pad, and the
 * knuckle of a thumb reaching it. Plain arithmetic in the head's own coordinates, apart from the
 * drawing so it can be checked on its own.
 */

export type Point = readonly [number, number, number]

/** Where the thumb's knuckle goes, for a thumb of two fixed lengths reaching from base to pad. */
export function thumbKnuckle(base: Point, pad: Point, firstMm: number, secondMm: number): Point {
  const dx = pad[0] - base[0]
  const dy = pad[1] - base[1]
  const reach = Math.hypot(dx, dy)
  // Keep the triangle closable: neither folded flat nor stretched past straight.
  const span = Math.min(
    firstMm + secondMm - 0.01,
    Math.max(Math.abs(firstMm - secondMm) + 0.01, reach),
  )
  const toward = Math.atan2(dy, dx)
  const open = Math.acos(
    Math.min(1, Math.max(-1, (firstMm ** 2 + span ** 2 - secondMm ** 2) / (2 * firstMm * span))),
  )
  // Two knuckle positions close the triangle; a thumb's knuckle is the one away from the fingers,
  // which on this left hand is the one further to the viewer's left.
  const candidates = [toward + open, toward - open].map(
    (angle): Point => [
      base[0] + firstMm * Math.cos(angle),
      base[1] + firstMm * Math.sin(angle),
      base[2] + (pad[2] - base[2]) * 0.55 + 2,
    ],
  )
  return candidates[0][0] <= candidates[1][0] ? candidates[0] : candidates[1]
}

/** The lever's thumb pad, in the head's coordinates, for a lever turned `bendRad` about its pivot. */
export function leverPadPoint(pivot: Point, bendRad: number): Point {
  // The pad sits 23 units out along the lever arm and a little proud of it (build-control-head.py).
  const x = -23
  const z = 6
  return [pivot[0] + x * Math.cos(bendRad), pivot[1] + x * Math.sin(bendRad), pivot[2] + z]
}
