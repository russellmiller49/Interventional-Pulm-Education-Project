import type { ScopePose, SpaceCommand } from '../../../components/space/types'
import { acrossRibsLimitDeg, scopeGeometry, sleeveTipDepth } from '../fulcrum'
import type { Instrument } from '../instrument'
import type { PortFrame } from '../portDefinition'
import { radians } from '../vec'
import {
  CLEARANCE_SKIN_MM,
  NUMERIC_MM,
  type InstrumentPart,
  type SpatialWorld,
} from './spatialWorld'

/**
 * One step of one control, advanced only as far as the instrument's measured clearance allows
 * (plan, section 4.5). No point of the instrument moves further than the move's bound on motion, so
 * advancing by (clearance − skin) ÷ bound can never carry it through a surface, however thin the
 * surface and however large the move. The clearance is then measured again, until the move is done
 * or the instrument is at the clearance skin; what is left is refused with the part named.
 *
 * The step sizes are the engine's own, authored for the interaction, not device facts.
 */
export const STEP = { tiltDeg: 2, depthMm: 2, rollDeg: 5 } as const

/**
 * At the clearance skin the move goes on in pieces, each shorter than the clearance it starts from
 * by this share, so that nothing can be crossed within one; a piece is kept only if it opens the
 * clearance.
 */
export const SKIN_PIECE_SHARE = 0.9

export type Limit =
  | { readonly kind: 'wall' | 'lung'; readonly part: InstrumentPart; readonly triangle: number }
  | { readonly kind: 'ribs'; readonly part: 'sleeve' }
  | { readonly kind: 'fully-in' | 'back-in-sleeve'; readonly part: 'telescope' }

export interface StepResult {
  readonly pose: ScopePose
  /** Why the step stopped short, or null if it was taken whole. */
  readonly limit: Limit | null
}

/** The pose a whole step would reach. The tip swings the other way to the hand. */
export function stepTarget(pose: ScopePose, command: SpaceCommand): ScopePose {
  switch (command.kind) {
    case 'pivot': {
      const [across, along] = { head: [-1, 0], feet: [1, 0], front: [0, -1], back: [0, 1] }[
        command.hand
      ]
      return {
        ...pose,
        tiltAcrossRibsDeg: pose.tiltAcrossRibsDeg + across * STEP.tiltDeg,
        tiltAlongRibsDeg: pose.tiltAlongRibsDeg + along * STEP.tiltDeg,
      }
    }
    case 'depth':
      return {
        ...pose,
        depthMm: pose.depthMm + (command.direction === 'in' ? STEP.depthMm : -STEP.depthMm),
      }
    case 'roll':
      return {
        ...pose,
        rollDeg:
          (((pose.rollDeg + (command.direction === 'clockwise' ? STEP.rollDeg : -STEP.rollDeg)) %
            360) +
            360) %
          360,
      }
    default:
      return pose
  }
}

export function depthRange(
  port: PortFrame,
  device: Instrument,
  wallThicknessMm: number,
  sleeveHeadMm: number,
): readonly [number, number] {
  const outside = wallThicknessMm - port.pleuraDepthMm + sleeveHeadMm
  return [sleeveTipDepth(port, device), device.shaftLengthMm - outside]
}

const mix = (a: ScopePose, b: ScopePose, t: number): ScopePose => ({
  tiltAcrossRibsDeg: a.tiltAcrossRibsDeg + (b.tiltAcrossRibsDeg - a.tiltAcrossRibsDeg) * t,
  tiltAlongRibsDeg: a.tiltAlongRibsDeg + (b.tiltAlongRibsDeg - a.tiltAlongRibsDeg) * t,
  depthMm: a.depthMm + (b.depthMm - a.depthMm) * t,
  rollDeg: b.rollDeg,
})

/**
 * Take one step from `pose`, as far as it can go. `depthLimits` are the least and greatest depth of
 * the tip from the pivot.
 */
export function takeStep(
  world: SpatialWorld,
  port: PortFrame,
  device: Instrument,
  pose: ScopePose,
  command: SpaceCommand,
  lungStep: number,
  depthLimits: readonly [number, number],
): StepResult {
  if (command.kind === 'roll') return { pose: stepTarget(pose, command), limit: null }
  if (command.kind !== 'pivot' && command.kind !== 'depth') return { pose, limit: null }
  let target = stepTarget(pose, command)
  let fenced: Limit | null = null

  // the fences that are not surfaces: the ellipse of tilt the ribs allow, and the depth range
  if (command.kind === 'pivot') {
    const a = acrossRibsLimitDeg(port, device)
    const b = device.alongRibsLimitDeg
    const inside = (t: number) => {
      const p = mix(pose, target, t)
      return (p.tiltAcrossRibsDeg / a) ** 2 + (p.tiltAlongRibsDeg / b) ** 2 <= 1
    }
    if (!inside(1)) {
      let lo = 0
      let hi = 1
      for (let i = 0; i < 50; i += 1) {
        const mid = (lo + hi) / 2
        if (inside(mid)) lo = mid
        else hi = mid
      }
      target = mix(pose, target, lo)
      fenced = { kind: 'ribs', part: 'sleeve' }
    }
  } else {
    const [least, most] = depthLimits
    if (target.depthMm > most) {
      target = { ...target, depthMm: Math.max(most, pose.depthMm) }
      fenced = { kind: 'fully-in', part: 'telescope' }
    } else if (target.depthMm < least) {
      target = { ...target, depthMm: Math.min(least, pose.depthMm) }
      fenced = { kind: 'back-in-sleeve', part: 'telescope' }
    }
  }

  const moved = advance(world, port, device, pose, target, lungStep)
  return moved.limit ? moved : { pose: moved.pose, limit: fenced }
}

/**
 * The furthest the instrument can move from `from` toward `to` along the straight path between the
 * two poses, and what stopped it. The bound on motion is the depth's change plus the furthest reach
 * of the instrument times the tilts' change: turning by one tilt and then the other moves the axis
 * through no more than the sum of the two angles, and no point of the instrument lies further from
 * the pivot than its depth plus its radius.
 */
export function advance(
  world: SpatialWorld,
  port: PortFrame,
  device: Instrument,
  from: ScopePose,
  to: ScopePose,
  lungStep: number,
): StepResult {
  const geometryAt = (t: number) => scopeGeometry(mix(from, to, t), port, device)
  const reach =
    Math.max(from.depthMm, to.depthMm) + Math.max(device.sleeveRadiusMm, device.shaftRadiusMm)
  const turn =
    Math.abs(to.tiltAcrossRibsDeg - from.tiltAcrossRibsDeg) +
    Math.abs(to.tiltAlongRibsDeg - from.tiltAlongRibsDeg)
  const motion = Math.abs(to.depthMm - from.depthMm) + reach * radians(turn)
  if (motion <= 0) return { pose: to, limit: null }
  let t = 0
  let found = world.clearance(geometryAt(0), lungStep)
  for (;;) {
    if (t >= 1) return { pose: to, limit: null }
    const room = found.clearance - CLEARANCE_SKIN_MM
    if (room > NUMERIC_MM) {
      t = Math.min(1, t + room / motion)
      found = world.clearance(geometryAt(t), lungStep)
      continue
    }
    // At the skin: only a move that opens the clearance is taken, in pieces shorter than the
    // clearance, so that no piece can cross anything.
    const piece = Math.min(1 - t, (SKIN_PIECE_SHARE * found.clearance) / motion)
    if (!(piece > 0)) break
    const next = world.clearance(geometryAt(t + piece), lungStep)
    if (next.clearance > found.clearance) {
      t += piece
      found = next
      continue
    }
    break
  }
  return {
    pose: mix(from, to, t),
    limit: { kind: found.obstacle, part: found.part, triangle: found.triangle },
  }
}
