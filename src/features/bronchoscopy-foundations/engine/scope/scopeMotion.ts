import { BENCH_FLUID } from './benchFluid'
import { minus, scalar, unit, type OpticalFrame } from '@/lib/bronchoscopy-core/frame'
import { driveScope } from '@/lib/airway-anatomy/drive'
import { distance } from '@/lib/airway-anatomy/geometry'
import {
  createInitialScopeState,
  moveScope,
  sampleEdgePose,
  type ScopeState as EngineScopeState,
} from '@/lib/airway-anatomy/scope-state'
import type { Vec3 } from '@/lib/airway-anatomy/types'

import type { ScopeEventId, ScopeInputs, ScopeState } from '../../components/scope/types'
import { labelAncestry } from '../../content/airwayTree'
import { openingInsetMm, type ScopeCase } from './scopeCase'
import { enteredEvent, withdrewToEvent } from './scopeEvents'
import { aimAngleDeg, scopeFrame } from './scopeFrame'
import { SCOPE_MESSAGES } from './scopeMessages'
import { airwayDepthMm, inCarinaZone, tipBaseFrame, transportFor } from './scopePose'
import type { ScopeContext, ScopeRuntimeState } from './scopeRuntime'
import {
  AIM_CONE_DEG,
  BRANCH_APPROACH_MM,
  FORK_STANDOFF_MM,
  GLOTTIS_ALIGN_LIMIT_DEG,
  GUIDED_AIM_CONE_DEG,
  GUIDED_AIM_MARGIN_DEG,
  LARYNX_GLOTTIS_MM,
  LARYNX_LENGTH_MM,
  MOTION_INCREMENT_MM,
  TUBE_CONTACT_DEFLECTION_DEG,
  TUBE_START_MM,
  TUBE_TIP_MM,
  WALL_AIM_STEPS,
} from './scopeScripts'

/**
 * Insertion: one advance or withdraw, travelled in short increments so that every airway the tip
 * crosses, the carina zone and the end of the tube are each noticed once, in order.
 *
 * In the airway tree the tip follows the centerline (the moveScope engine), and a bifurcation is
 * crossed into the branch the optical axis points at; with the aim guard an undecided aim is
 * refused rather than resolved. With a loaded lumen and free drive, the tip moves along its own
 * axis against the collider instead (driveScope). The larynx, the tube and the bench are authored
 * one-axis geometry.
 *
 * Guided travel is forgiving on purpose (educator feedback, 2026-10-13). The lumen guides the tip,
 * so a bend registers no wall contact; at a fork the scope takes the opening nearest the centre of
 * the picture, or waits short of the fork while two are about equally near (`guidedForkChoice`);
 * and once through a fork the tip returns to neutral, as the lever is released on entering a
 * branch. What a wall feels like through the insertion tube is left to the scope in the hand.
 */

export interface InsertionResult {
  readonly place: ScopeState['place']
  readonly engine: EngineScopeState | null
  readonly depthMm: number
  readonly events: readonly ScopeEventId[]
  readonly message: string | null
  /** A wall contact was registered (a feedback signal, not a force). */
  readonly contact: boolean
  /** The lens met mucosa: the view turns red until the tip is withdrawn or the bend reduced. */
  readonly lensOnWall: boolean
  readonly travelledMm: number
  /** The aim guard refused an undecided bifurcation. */
  readonly aimGuardActed: boolean
  /** The tip travelled the airway tree along the centerline. */
  readonly centerlineTravel: boolean
  /** Guided travel carried a bent tip through a fork and returned it to neutral. */
  readonly straightened: boolean
}

const BENCH_TRAVEL_MM = 100

function outcome(state: ScopeRuntimeState, patch: Partial<InsertionResult>): InsertionResult {
  return {
    place: state.place,
    engine: state.engine,
    depthMm: state.depthMm,
    events: [],
    message: null,
    contact: false,
    lensOnWall: false,
    travelledMm: 0,
    aimGuardActed: false,
    centerlineTravel: false,
    straightened: false,
    ...patch,
  }
}

function tipPoint(engine: EngineScopeState, scopeCase: ScopeCase): Vec3 {
  if (engine.freeFrame) return engine.freeFrame.position
  const edge = scopeCase.index.edgesById.get(engine.edgeId)
  return edge ? sampleEdgePose(edge, engine.distanceMm).point : [0, 0, 0]
}

/**
 * Whether an advance now would push the tip into the wall: the optical axis meets the wall of the
 * centerline's radius within `WALL_AIM_STEPS` steps. Near a bifurcation, an axis inside the aim
 * guard's cone around a branch points into that opening, not at the wall. A geometric proxy from
 * the centerline radius, not a collision model.
 */
export function aimsAtWall(
  engine: EngineScopeState,
  inputs: Pick<ScopeInputs, 'rotationDeg' | 'deflectionDeg' | 'stepMm'>,
  ctx: ScopeContext,
): boolean {
  const scopeCase = ctx.scopeCase
  const edge = scopeCase?.index.edgesById.get(engine.edgeId)
  if (!scopeCase || !edge) return false
  const base = tipBaseFrame(engine, ctx.view, scopeCase)
  const frame = scopeFrame(base, inputs)
  const node = scopeCase.index.nodesById.get(edge.endNodeId)
  if (
    node &&
    node.childEdgeIds.length > 0 &&
    edge.lengthMm - engine.distanceMm <= BRANCH_APPROACH_MM
  ) {
    const cone = Math.cos((AIM_CONE_DEG * Math.PI) / 180)
    for (const childId of node.childEdgeIds) {
      const child = scopeCase.index.edgesById.get(childId)
      if (!child) continue
      const probe = sampleEdgePose(child, Math.min(8, child.lengthMm)).point
      if (scalar(frame.forward, unit(minus(probe, node.lps))) >= cone) return false
    }
  }
  const angle = aimAngleDeg(base, frame)
  if (angle < 1e-6) return false
  if (angle >= 90) return true
  const radius = edge.radiusMm ?? 2
  return radius / Math.sin((angle * Math.PI) / 180) <= WALL_AIM_STEPS * inputs.stepMm
}

/** A fork ahead of a guided tip, and what its picture says about it. */
export interface GuidedFork {
  /** How far along the current edge the scope waits while the aim is undecided. */
  readonly standMm: number
  /** The frame at that place before rotation and deflection: what an aim is worked out against. */
  readonly base: OpticalFrame
  /** The view from that place with the controls as they are: where the fork is read from. */
  readonly frame: OpticalFrame
  /** The openings, nearest the centre of that picture first. */
  readonly openings: readonly {
    readonly edgeId: number
    /** The point inside the opening the picture is read against (`openingInsetMm`). */
    readonly aimPoint: Vec3
    /** Degrees between the view axis and that point. */
    readonly offAxisDeg: number
  }[]
  /** The opening the aim has chosen, or null while two are about equally near or none is in view. */
  readonly chosenEdgeId: number | null
}

/**
 * The fork at the end of an edge as a guided tip reads it (`scopeScripts.ts`, the aim guard).
 * Null when the edge does not end in a fork. Read from where the scope waits, with the controls as
 * they are, so the answer does not change as the tip covers the last stretch to the fork.
 */
export function guidedFork(
  edgeId: number,
  inputs: Pick<ScopeInputs, 'rotationDeg' | 'deflectionDeg'>,
  ctx: ScopeContext,
): GuidedFork | null {
  const scopeCase = ctx.scopeCase
  const edge = scopeCase?.index.edgesById.get(edgeId)
  const node = edge ? scopeCase?.index.nodesById.get(edge.endNodeId) : undefined
  if (!scopeCase || !edge || !node || node.childEdgeIds.length < 2) return null
  const standMm = Math.max(0, edge.lengthMm - FORK_STANDOFF_MM)
  const base = transportFor(ctx.view, scopeCase).at(edgeId, standMm)
  const frame = scopeFrame(base, inputs)
  const openings = node.childEdgeIds
    .flatMap((childId) => {
      const child = scopeCase.index.edgesById.get(childId)
      if (!child) return []
      const aimPoint = sampleEdgePose(child, openingInsetMm(child)).point
      const cos = scalar(frame.forward, unit(minus(aimPoint, frame.position), frame.forward))
      const offAxisDeg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
      return [{ edgeId: childId, aimPoint, offAxisDeg }]
    })
    .sort((a, b) => a.offAxisDeg - b.offAxisDeg)
  const [nearest, next] = openings
  const decided =
    nearest !== undefined &&
    nearest.offAxisDeg <= GUIDED_AIM_CONE_DEG &&
    (next === undefined || next.offAxisDeg - nearest.offAxisDeg >= GUIDED_AIM_MARGIN_DEG)
  return { standMm, base, frame, openings, chosenEdgeId: decided ? nearest.edgeId : null }
}

function insertInLarynx(state: ScopeRuntimeState, mm: number, ctx: ScopeContext): InsertionResult {
  const from = state.depthMm
  const to = from + mm
  const events: ScopeEventId[] = []
  if (mm > 0 && from < LARYNX_GLOTTIS_MM && to >= LARYNX_GLOTTIS_MM) {
    const stop = Math.max(from, LARYNX_GLOTTIS_MM - 0.5)
    if (Math.abs(state.inputs.deflectionDeg) > GLOTTIS_ALIGN_LIMIT_DEG)
      return outcome(state, {
        depthMm: stop,
        events: ['wall-contact'],
        contact: true,
        message: SCOPE_MESSAGES.alignWithGlottis,
        travelledMm: stop - from,
      })
    if (state.inputs.cords !== 'abducted')
      return outcome(state, {
        depthMm: stop,
        events: ['advanced-against-closure'],
        message: SCOPE_MESSAGES.foldsNotApart,
        travelledMm: stop - from,
      })
    events.push('glottis-crossed-open')
  }
  const scopeCase = ctx.scopeCase
  if (to >= LARYNX_LENGTH_MM && scopeCase) {
    const trachea = scopeCase.originEdge.get('TR')
    if (trachea === undefined) throw new Error('The teaching graph has no trachea')
    const engine = createInitialScopeState(scopeCase.graph, trachea, to - LARYNX_LENGTH_MM)
    events.push(enteredEvent('TR'))
    return outcome(state, {
      place: 'airway',
      engine,
      depthMm: airwayDepthMm(engine, ctx.view, scopeCase),
      events,
      travelledMm: Math.abs(mm),
    })
  }
  const depthMm = Math.max(0, Math.min(scopeCase ? LARYNX_LENGTH_MM : LARYNX_LENGTH_MM - 0.01, to))
  return outcome(state, { depthMm, events, travelledMm: Math.abs(depthMm - from) })
}

function insertInTree(state: ScopeRuntimeState, mm: number, ctx: ScopeContext): InsertionResult {
  const scopeCase = ctx.scopeCase
  if (!scopeCase || !state.engine) return outcome(state, {})
  const { view } = ctx
  let inputs = state.inputs
  const advancing = mm > 0
  const free = Boolean(state.engine.freeFrame && scopeCase.collider)
  const guided = view.mode === 'guided-walk'

  if (advancing) {
    if (state.signals.view === 'red-out')
      return outcome(state, {
        events: ['advanced-in-red-out', 'wall-contact'],
        contact: true,
        message: SCOPE_MESSAGES.advancedInRedOut,
      })
    if (state.place === 'tube' && Math.abs(inputs.deflectionDeg) > TUBE_CONTACT_DEFLECTION_DEG)
      return outcome(state, {
        events: ['wall-contact'],
        contact: true,
        message: SCOPE_MESSAGES.tubeWall,
      })
    if (state.place === 'airway' && !free && !guided && aimsAtWall(state.engine, inputs, ctx))
      return outcome(state, {
        events: ['wall-contact'],
        contact: true,
        lensOnWall: true,
        message: SCOPE_MESSAGES.wallFromBend,
      })
  }

  const requireAim = guided && view.assists['aim-guard'] !== false
  const labelOf = (engine: EngineScopeState) => scopeCase.labelAt(engine.edgeId)
  const events: ScopeEventId[] = []
  let engine = state.engine
  let place = state.place
  let message: string | null = null
  let contact = false
  let lensOnWall = false
  let aimGuardActed = false
  let straightened = false
  let travelledMm = 0
  let remaining = mm
  let guard = 0
  const travel = (viewForward: Vec3) => ({
    requireAim,
    viewForward,
    lookAheadMm: scopeCase.interaction.lookAheadMm,
    trailMaxPoints: scopeCase.interaction.trailMaxPoints,
  })
  /** The direction a branch leaves its fork in: what carries the tip into the chosen opening. */
  const branchDirection = (childEdgeId: number, from: Vec3, fallback: Vec3): Vec3 => {
    const child = scopeCase.index.edgesById.get(childEdgeId)
    if (!child) return fallback
    return unit(minus(sampleEdgePose(child, Math.min(8, child.lengthMm)).point, from), fallback)
  }
  while (Math.abs(remaining) > 1e-6 && guard < 100_000) {
    guard += 1
    const step = Math.sign(remaining) * Math.min(MOTION_INCREMENT_MM, Math.abs(remaining))
    const inTrachea = labelOf(engine) === 'TR'
    if (step < 0 && place === 'tube' && engine.distanceMm + step < TUBE_START_MM) {
      message = SCOPE_MESSAGES.tubeStart
      break
    }
    if (step < 0 && view.mode === 'larynx-entry' && inTrachea && engine.distanceMm <= 1e-6)
      return outcome(state, {
        place: 'larynx',
        engine: null,
        depthMm: Math.max(0, LARYNX_LENGTH_MM + remaining),
        events,
        message,
        travelledMm: travelledMm + Math.abs(remaining),
      })

    const frame = scopeFrame(tipBaseFrame(engine, view, scopeCase), inputs)
    let next: EngineScopeState
    let stopAfter = false
    if (free) {
      next = driveScope(
        { ...engine, freeFrame: frame, movementMessage: undefined },
        step,
        scopeCase.graph,
        transportFor(view, scopeCase),
        frame,
        scopeCase.collider,
      )
      if (next.movementMessage) {
        if (/wall contact/i.test(next.movementMessage)) {
          contact = true
          lensOnWall = true
          events.push('wall-contact')
          message = SCOPE_MESSAGES.wallContact
        } else message = SCOPE_MESSAGES.historyLimit
        next = { ...next, movementMessage: undefined }
        stopAfter = true
      }
    } else {
      const fork = requireAim && step > 0 ? guidedFork(engine.edgeId, inputs, ctx) : null
      if (fork && fork.chosenEdgeId === null && engine.distanceMm + step > fork.standMm) {
        // Undecided on the way in: wait short of the fork, where both openings are in the picture.
        // Never backward: a tip already past that place waits where it is.
        events.push('aim-refused')
        message = SCOPE_MESSAGES.aimRefused
        aimGuardActed = true
        next = {
          ...engine,
          distanceMm: Math.max(engine.distanceMm, Math.min(fork.standMm, engine.distanceMm + step)),
          movementMessage: undefined,
        }
        stopAfter = true
      } else {
        // A chosen opening is entered by pointing the engine down that branch itself.
        const forkNode =
          fork && fork.chosenEdgeId !== null
            ? scopeCase.index.nodesById.get(scopeCase.index.edgesById.get(engine.edgeId)!.endNodeId)
            : undefined
        const viewForward =
          fork && fork.chosenEdgeId !== null && forkNode
            ? branchDirection(fork.chosenEdgeId, forkNode.lps, frame.forward)
            : frame.forward
        next = moveScope(
          { ...engine, movementMessage: undefined },
          scopeCase.graph,
          step,
          travel(viewForward),
        )
        if (next.movementMessage) {
          events.push('aim-refused')
          message = SCOPE_MESSAGES.aimRefused
          aimGuardActed = true
          next = { ...next, movementMessage: undefined }
          stopAfter = true
        } else if (
          step > 0 &&
          next.edgeId === engine.edgeId &&
          Math.abs(next.distanceMm - engine.distanceMm) < 1e-9
        ) {
          events.push('lumen-end')
          message = SCOPE_MESSAGES.lumenEnd
          break
        }
      }
    }

    const previousLabel = labelOf(engine)
    const nextLabel = labelOf(next)
    if (
      step > 0 &&
      nextLabel &&
      nextLabel !== previousLabel &&
      view.inaccessible?.includes(nextLabel)
    ) {
      events.push('entry-refused')
      message = SCOPE_MESSAGES.entryRefused(nextLabel)
      break
    }
    if (nextLabel && previousLabel && nextLabel !== previousLabel) {
      if (labelAncestry(previousLabel).includes(nextLabel)) {
        events.push(withdrewToEvent(nextLabel))
        if (nextLabel === 'TR') events.push('returned-to-trachea')
      } else events.push(enteredEvent(nextLabel))
    }
    if (step > 0 && !inCarinaZone(engine, scopeCase) && inCarinaZone(next, scopeCase))
      events.push('reached-carina')
    if (place === 'tube' && labelOf(next) === 'TR' && next.distanceMm >= TUBE_TIP_MM) {
      place = 'airway'
      events.push('tube-exited')
    } else if (
      place === 'airway' &&
      view.mode === 'tube' &&
      labelOf(next) === 'TR' &&
      next.distanceMm < TUBE_TIP_MM
    )
      place = 'tube'
    // Through a fork under guided travel, the bend that chose the branch is let go.
    if (guided && step > 0 && next.edgeId !== engine.edgeId && inputs.deflectionDeg !== 0) {
      const crossed = scopeCase.index.edgesById.get(engine.edgeId)
      const fork = crossed ? scopeCase.index.nodesById.get(crossed.endNodeId) : undefined
      if (fork && fork.childEdgeIds.length > 1) {
        inputs = { ...inputs, deflectionDeg: 0 }
        straightened = true
        message = message ?? SCOPE_MESSAGES.tipStraightened
      }
    }
    travelledMm += distance(tipPoint(engine, scopeCase), tipPoint(next, scopeCase))
    engine = next
    remaining -= step
    if (stopAfter) break
  }
  return outcome(state, {
    place,
    engine,
    depthMm: airwayDepthMm(engine, view, scopeCase),
    events,
    message,
    contact,
    lensOnWall,
    travelledMm,
    aimGuardActed,
    centerlineTravel: !free && travelledMm > 0,
    straightened,
  })
}

/** Advance (positive) or withdraw (negative) the scope by `mm`. */
export function insertScope(
  state: ScopeRuntimeState,
  mm: number,
  ctx: ScopeContext,
): InsertionResult {
  if (!Number.isFinite(mm) || mm === 0) return outcome(state, {})
  switch (state.place) {
    case 'bench': {
      const depthMm = ctx.view.benchSuction
        ? Math.max(0, Math.min(BENCH_FLUID.bottomMm - 1, state.depthMm + mm))
        : Math.max(-BENCH_TRAVEL_MM, Math.min(BENCH_TRAVEL_MM, state.depthMm + mm))
      return outcome(state, { depthMm, travelledMm: Math.abs(depthMm - state.depthMm) })
    }
    case 'larynx':
      return insertInLarynx(state, mm, ctx)
    case 'tube':
    case 'airway':
      return insertInTree(state, mm, ctx)
  }
}
