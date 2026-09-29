import type { ScopePose, SpaceCommand } from '../../../components/space/types'
import type { PleuralZoneId } from '../../../content/pleuralZones'
import { acrossRibsLimitDeg, scopeGeometry, sleeveTipDepth, type ScopeGeometry } from '../fulcrum'
import type { Instrument } from '../instrument'
import type { PortFrame } from '../portDefinition'
import { radians } from '../vec'
import {
  AUTHORED_TOOL_VALUES,
  toolCapsules,
  jawsOut,
  toolWith,
  type Forceps,
  type ToolState,
} from '../toolChannel'
import {
  CLEARANCE_SKIN_MM,
  NUMERIC_MM,
  type ContactRuleFn,
  type InstrumentPart,
  type Obstacle,
  type PartCapsule,
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

export type SurfaceLimit = {
  readonly kind: Obstacle
  readonly part: InstrumentPart
  readonly triangle: number
  /** The region of the wall, where the wall stopped it and its regions are known (R8). */
  readonly zone?: PleuralZoneId
}

export type Limit =
  | SurfaceLimit
  | { readonly kind: 'ribs'; readonly part: 'sleeve' }
  | { readonly kind: 'fully-in' | 'back-in-sleeve'; readonly part: 'telescope' }
  | { readonly kind: 'tool-out' | 'tool-in'; readonly part: 'working-element' }
  /** The jaws open cannot come back into the channel, nor open inside it (R8). */
  | { readonly kind: 'jaws-open' | 'jaws-in-channel'; readonly part: 'working-element' }

export interface StepResult {
  readonly pose: ScopePose
  /** Why the step stopped short, or null if it was taken whole. */
  readonly limit: Limit | null
  /** With a tool in hand: where it is now, and whether a part allowed to touch is touching. */
  readonly tool?: ToolState
  readonly touching?: boolean
}

/** A tool in the channel, the table that says what it may touch, and the forceps' sizes. */
export interface ToolContext {
  readonly state: ToolState
  readonly tools: Forceps
  readonly rule: ContactRuleFn
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

/** The roll's change along the shorter way round, in degrees. */
const rollChange = (a: ScopePose, b: ScopePose) =>
  ((((b.rollDeg - a.rollDeg) % 360) + 540) % 360) - 180

const mix = (a: ScopePose, b: ScopePose, t: number): ScopePose => ({
  tiltAcrossRibsDeg: a.tiltAcrossRibsDeg + (b.tiltAcrossRibsDeg - a.tiltAcrossRibsDeg) * t,
  tiltAlongRibsDeg: a.tiltAlongRibsDeg + (b.tiltAlongRibsDeg - a.tiltAlongRibsDeg) * t,
  depthMm: a.depthMm + (b.depthMm - a.depthMm) * t,
  rollDeg: t >= 1 ? b.rollDeg : (((a.rollDeg + rollChange(a, b) * t) % 360) + 360) % 360,
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
  /** A tool in the channel, which moves with the telescope and meets the contact table. */
  context?: ToolContext,
): StepResult {
  if (command.kind === 'roll') {
    // A roll turns the tool about the axis too; with a tool out, it is a move like any other.
    if (!context || context.state.phase !== 'extended')
      return {
        pose: stepTarget(pose, command),
        limit: null,
        ...(context ? { tool: context.state, touching: false } : {}),
      }
    return advanceWithTool(
      world,
      port,
      device,
      pose,
      stepTarget(pose, command),
      context.state,
      context.state,
      context,
      lungStep,
    )
  }
  if (command.kind !== 'pivot' && command.kind !== 'depth')
    return { pose, limit: null, ...(context ? { tool: context.state, touching: false } : {}) }
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

  // Drawing the telescope out passes only through space it already fills, and a tool out with it only
  // through space the telescope or the tool already fills, each part where a part as strict or
  // stricter was: it is never refused by a surface, only by its fence.
  // (With the jaws open, the wider jaws come back where only the shaft was: that is a move like any.)
  if (
    command.kind === 'depth' &&
    target.depthMm <= pose.depthMm &&
    !(context && context.state.jaws === 'open')
  ) {
    return {
      pose: target,
      limit: fenced,
      ...(context
        ? {
            tool: context.state,
            touching: touchingAt(world, port, device, target, context.state, context, lungStep),
          }
        : {}),
    }
  }

  // With the tool in the channel, the telescope moves exactly as it does with no tool at all.
  const moved =
    context && context.state.phase === 'extended'
      ? advanceWithTool(
          world,
          port,
          device,
          pose,
          target,
          context.state,
          context.state,
          context,
          lungStep,
        )
      : {
          ...advance(world, port, device, pose, target, lungStep),
          ...(context ? { tool: context.state, touching: false } : {}),
        }
  return moved.limit ? moved : { ...moved, limit: fenced }
}

interface Measured {
  /** The least room over the pairs of part and surface: clearance less the pair's skin. */
  readonly room: number
  /** How long a piece of motion can be at the skin without crossing anything. */
  readonly pieceLimit: number
  readonly limit: SurfaceLimit
}

/**
 * Conservative advancement along a path from t = 0 to 1 whose points move no further than `motion`:
 * each advance is the room divided by the motion; at the skin, pieces shorter than the clearance of
 * everything that must stay clear, each kept only if it opens the room. Returns how far it got.
 */
function advanceBy(
  motion: number,
  measure: (t: number) => Measured,
): { t: number; limit: SurfaceLimit | null } {
  if (motion <= 0) return { t: 1, limit: null }
  let t = 0
  let found = measure(0)
  for (;;) {
    if (t >= 1) return { t: 1, limit: null }
    if (found.room > NUMERIC_MM) {
      t = Math.min(1, t + found.room / motion)
      found = measure(t)
      continue
    }
    const piece = Math.min(1 - t, (SKIN_PIECE_SHARE * found.pieceLimit) / motion)
    if (!(piece > 0)) break
    const next = measure(t + piece)
    if (next.room > found.room) {
      t += piece
      found = next
      continue
    }
    break
  }
  return { t, limit: found.limit }
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
  const reach =
    Math.max(from.depthMm, to.depthMm) + Math.max(device.sleeveRadiusMm, device.shaftRadiusMm)
  const motion = Math.abs(to.depthMm - from.depthMm) + reach * radians(turnOf(from, to))
  const { t, limit } = advanceBy(motion, (at) => {
    const found = world.clearance(scopeGeometry(mix(from, to, at), port, device), lungStep)
    return {
      room: found.clearance - CLEARANCE_SKIN_MM,
      pieceLimit: found.clearance,
      limit: { kind: found.obstacle, part: found.part, triangle: found.triangle },
    }
  })
  return { pose: t >= 1 ? to : mix(from, to, t), limit }
}

/**
 * The same with a tool in the channel, the tool moving too (its extension from `toolFrom` to
 * `toolTo`): every part against every surface under the contact table's rule. The reach adds the
 * tool's extension and the channel's offset from the axis.
 */
export function advanceWithTool(
  world: SpatialWorld,
  port: PortFrame,
  device: Instrument,
  from: ScopePose,
  to: ScopePose,
  toolFrom: ToolState,
  toolTo: ToolState,
  context: Omit<ToolContext, 'state'>,
  lungStep: number,
): StepResult {
  const { tools, rule } = context
  const reach =
    Math.max(from.depthMm, to.depthMm) +
    Math.max(toolFrom.extensionMm, toolTo.extensionMm) +
    tools.channelOffsetMm +
    Math.max(device.sleeveRadiusMm, device.shaftRadiusMm, toolRadius(tools, toolFrom, toolTo))
  // a roll swings the tool about the axis: no point of it lies further from the axis than the
  // channel's offset and the tool's radius
  const motion =
    Math.abs(to.depthMm - from.depthMm) +
    Math.abs(toolTo.extensionMm - toolFrom.extensionMm) +
    reach * radians(turnOf(from, to)) +
    (tools.channelOffsetMm + toolRadius(tools, toolFrom, toolTo)) *
      radians(Math.abs(rollChange(from, to)))
  let touching = false
  const at = (t: number) => ({
    pose: mix(from, to, t),
    tool: toolWith(
      toolFrom.extensionMm + (toolTo.extensionMm - toolFrom.extensionMm) * t,
      toolFrom.jaws ?? 'closed',
    ),
  })
  const measure = (t: number): Measured => {
    const { pose, tool } = at(t)
    const found = world.contact(
      partsOf(scopeGeometry(pose, port, device), tool, tools),
      lungStep,
      rule,
    )
    touching = found.touching
    return {
      room: found.room,
      pieceLimit: found.leastClearance,
      limit: {
        kind: found.obstacle,
        part: found.part,
        triangle: found.triangle,
        ...(found.zone ? { zone: found.zone } : {}),
      },
    }
  }
  const { t, limit } = advanceBy(motion, measure)
  const end = t >= 1 ? { pose: to, tool: toolTo } : at(t)
  // the touch as it stands where the move ended
  measure(t >= 1 ? 1 : t)
  return { pose: end.pose, tool: end.tool, limit, touching }
}

/** Every part of the instrument as a capsule: the sleeve, the telescope, and a tool out of the channel. */
function partsOf(geometry: ScopeGeometry, tool: ToolState, tools: Forceps): PartCapsule[] {
  const { shaft, workingElement } = toolCapsules(geometry, tool, tools)
  return [
    { part: 'sleeve', capsule: geometry.sleeve },
    ...(geometry.shaft ? [{ part: 'telescope' as const, capsule: geometry.shaft }] : []),
    ...(shaft ? [{ part: 'tool-shaft' as const, capsule: shaft }] : []),
    ...(workingElement ? [{ part: 'working-element' as const, capsule: workingElement }] : []),
  ]
}

/** Whether a part allowed to touch is touching, with the instrument where it is. */
function touchingAt(
  world: SpatialWorld,
  port: PortFrame,
  device: Instrument,
  pose: ScopePose,
  tool: ToolState,
  context: Omit<ToolContext, 'state'>,
  lungStep: number,
): boolean {
  if (tool.phase !== 'extended') return false
  const parts = partsOf(scopeGeometry(pose, port, device), tool, context.tools)
  return world.contact(parts, lungStep, context.rule).touching
}

function turnOf(from: ScopePose, to: ScopePose): number {
  return (
    Math.abs(to.tiltAcrossRibsDeg - from.tiltAcrossRibsDeg) +
    Math.abs(to.tiltAlongRibsDeg - from.tiltAlongRibsDeg)
  )
}

/** One step of the tool's control: out or in along the channel, the scope held still. */
export function takeToolStep(
  world: SpatialWorld,
  port: PortFrame,
  device: Instrument,
  pose: ScopePose,
  direction: 'extend' | 'retract',
  context: ToolContext,
  lungStep: number,
): StepResult {
  const { stepMm, reachMm } = AUTHORED_TOOL_VALUES
  const wanted = context.state.extensionMm + (direction === 'extend' ? stepMm : -stepMm)
  const fenced: Limit | null =
    wanted > reachMm
      ? { kind: 'tool-out', part: 'working-element' }
      : wanted < 0
        ? { kind: 'tool-in', part: 'working-element' }
        : null
  const jaws = context.state.jaws ?? 'closed'
  const target = toolWith(wanted, jaws)
  // The jaws must be closed to come back: open, they are wider than the shaft behind them.
  if (direction === 'retract' && jaws === 'open') {
    return {
      pose,
      tool: context.state,
      limit: { kind: 'jaws-open', part: 'working-element' },
      touching: touchingAt(world, port, device, pose, context.state, context, lungStep),
    }
  }
  // Back into the channel, the tool passes only through space it already fills.
  if (direction === 'retract') {
    return {
      pose,
      tool: target,
      limit: fenced,
      touching: touchingAt(world, port, device, pose, target, context, lungStep),
    }
  }
  const moved = advanceWithTool(
    world,
    port,
    device,
    pose,
    pose,
    context.state,
    target,
    context,
    lungStep,
  )
  return moved.limit ? moved : { ...moved, limit: fenced }
}

/** The widest the tool is about its line over a move. */
function toolRadius(tools: Forceps, from: ToolState, to: ToolState): number {
  return from.jaws === 'open' || to.jaws === 'open' ? tools.openJawsRadiusMm : tools.shaftRadiusMm
}

/**
 * The jaws opened or closed, the telescope and the forceps held still (independent review, R8).
 * Closing only narrows the working element, so it is never refused. Opening widens it about its
 * line, so every clearance falls as it opens and is least when it is open: checking the open jaws
 * where they are checks the whole opening. It is refused, with the part and what it meets named,
 * where the open jaws would come within a pair's skin, or while the jaws are not wholly out.
 */
export function takeJawStep(
  world: SpatialWorld,
  port: PortFrame,
  device: Instrument,
  pose: ScopePose,
  action: 'open' | 'close',
  context: ToolContext,
  lungStep: number,
): StepResult {
  const { state, tools, rule } = context
  if (action === 'close') {
    const closed: ToolState = { ...state, jaws: 'closed' }
    return {
      pose,
      tool: closed,
      limit: null,
      touching: touchingAt(world, port, device, pose, closed, context, lungStep),
    }
  }
  if (!jawsOut(state, tools))
    return {
      pose,
      tool: state,
      limit: { kind: 'jaws-in-channel', part: 'working-element' },
      touching: false,
    }
  const open: ToolState = { ...state, jaws: 'open' }
  const found = world.contact(
    partsOf(scopeGeometry(pose, port, device), open, tools),
    lungStep,
    rule,
  )
  if (found.room < -NUMERIC_MM)
    return {
      pose,
      tool: state,
      limit: {
        kind: found.obstacle,
        part: found.part,
        triangle: found.triangle,
        ...(found.zone ? { zone: found.zone } : {}),
      },
      touching: touchingAt(world, port, device, pose, state, context, lungStep),
    }
  return { pose, tool: open, limit: null, touching: found.touching }
}
