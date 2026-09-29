import {
  sameSnapshot,
  type ScopePose,
  type SpaceCommand,
  type SpaceInputMode,
  type SpaceSnapshotId,
} from '../../components/space/types'
import type { PleuralZoneId } from '../../content/pleuralZones'
import { addView, emptyCoverage, zonesInView, type Coverage } from './coverage'
import type { SpaceResolver, ToolInHand } from './loadSpace'
import { CLEARANCE_SKIN_MM } from './spatial/spatialWorld'
import type { Limit } from './spatial/sweep'
import { TOOL_IN_CHANNEL } from './toolChannel'

/**
 * The space engine's state and the one reducer that changes it (plan, section 4.5). The state is
 * plain JSON: no renderer object, no index, no clock and no callback. The reducer asks the resolver
 * its spatial questions and commits the answers, so it is a pure function of the state, the action
 * and the loaded space.
 *
 * Course navigation, loading a teaching example and a simulated action are three different types.
 * The reducer takes only the third, so navigating can never make a procedure event happen; a
 * teaching example is loaded by building a new state (`startEngine`), not by an action.
 *
 * The clock is an integer number of milliseconds that moves only on a tick. The lung moves one step
 * each `LUNG_STEP_MS`, and only with room to spare around the instrument; if the instrument is in
 * the way, the lung is held there and the state says so, and it tries again when the instrument
 * next moves, going on from then at the same pace. Under reduced motion the lung waits for Step.
 * Every event is stamped with the time it was due, not the time a tick happened to reach it, so
 * whatever the ticks, the same actions at the same times give the same events.
 *
 * A scenario may put the forceps in the working channel (the contact spike, slice 13). They move with
 * the telescope and along the channel, and meet the contact table: only their jaws may touch, and
 * only an authorised teaching target, with the forceps out. In the channel they change nothing: the
 * telescope moves exactly as it does with no tool.
 */
export const LUNG_STEP_MS = 400
export const LUNG_ROOM_MM = 0.5

export interface EngineEvent {
  readonly atMs: number
  readonly kind: 'moved' | 'stopped' | 'lung-moved' | 'lung-held' | 'lung-waits' | 'tool-moved'
  readonly detail: string
}

/** The forceps, for a scenario that has them. */
export interface EngineTool {
  readonly phase: 'in-channel' | 'extended'
  readonly extensionMm: number
  /** Whether the scenario's teaching target is one the jaws may touch. */
  readonly authorised: boolean
  /** The jaws are within touching distance of the target. */
  readonly touching: boolean
}

export interface EngineState {
  readonly snapshot: SpaceSnapshotId
  readonly scenario: string
  readonly pose: ScopePose
  readonly lungStep: number
  readonly lungTarget: number
  readonly clockMs: number
  readonly nextLungMoveAtMs: number | null
  readonly reducedMotion: boolean
  readonly clockHeld: boolean
  readonly lungHeld: boolean
  readonly coverage: Coverage
  readonly inView: readonly PleuralZoneId[]
  readonly limit: Limit | null
  readonly events: readonly EngineEvent[]
  /** The forceps in the channel, when the scenario has them. */
  readonly tool?: EngineTool
}

export interface NavigationAction {
  readonly type: 'navigate'
  readonly to: string
}

export interface TeachingExampleAction {
  readonly type: 'load-teaching-example'
  readonly example: string
}

export type SimulatedAction =
  | {
      readonly type: 'command'
      readonly command: SpaceCommand
      readonly input: SpaceInputMode
      /** The snapshot the command was issued against; a command for another changes nothing. */
      readonly snapshot: SpaceSnapshotId
    }
  | { readonly type: 'tick'; readonly ms: number }
  | { readonly type: 'lung-target'; readonly step: number }
  /** The learner's motion preference, which may change while the space is open. */
  | { readonly type: 'motion'; readonly reduced: boolean }

const SIMULATED = new Set(['command', 'tick', 'lung-target', 'motion'])

export function isSimulatedAction(action: { readonly type: string }): action is SimulatedAction {
  return SIMULATED.has(action.type)
}

/**
 * A new state for a scenario: the lung at a step, the telescope at a pose that must be clear, and,
 * if the scenario has them, the forceps in the channel.
 */
export function startEngine(
  resolver: SpaceResolver,
  {
    scenario,
    lungStep,
    pose,
    reducedMotion,
    snapshot,
    tool,
  }: {
    readonly scenario: string
    readonly lungStep: number
    readonly pose: ScopePose
    readonly reducedMotion: boolean
    readonly snapshot: SpaceSnapshotId
    readonly tool?: { readonly authorised: boolean }
  },
): EngineState {
  const problem = resolver.startProblem(pose, lungStep)
  if (problem) throw new Error(`The telescope cannot start there: ${problem}`)
  const view = resolver.view(pose, lungStep)
  return {
    snapshot,
    scenario,
    pose,
    lungStep,
    lungTarget: lungStep,
    clockMs: 0,
    nextLungMoveAtMs: null,
    reducedMotion,
    clockHeld: false,
    lungHeld: false,
    coverage: addView(emptyCoverage(resolver.sampleCount), view),
    inView: zonesInView(view, resolver.samples),
    limit: null,
    events: [],
    ...(tool
      ? {
          tool: {
            phase: TOOL_IN_CHANNEL.phase,
            extensionMm: TOOL_IN_CHANNEL.extensionMm,
            authorised: tool.authorised,
            touching: false,
          } as EngineTool,
        }
      : {}),
  }
}

/** The forceps as the resolver takes them. */
export function toolInHand(tool: EngineTool): ToolInHand {
  return {
    state: { phase: tool.phase, extensionMm: tool.extensionMm },
    authorised: tool.authorised,
  }
}

function withView(state: EngineState, resolver: SpaceResolver): EngineState {
  const view = resolver.view(state.pose, state.lungStep)
  return {
    ...state,
    coverage: addView(state.coverage, view),
    inView: zonesInView(view, resolver.samples),
  }
}

function event(
  state: EngineState,
  atMs: number,
  kind: EngineEvent['kind'],
  detail: string,
): EngineState {
  return { ...state, events: [...state.events, { atMs, kind, detail }] }
}

/** One step of the lung toward its target at `atMs`, if there is room around the instrument. */
function moveLung(state: EngineState, resolver: SpaceResolver, atMs: number): EngineState {
  if (state.lungStep === state.lungTarget)
    return { ...state, nextLungMoveAtMs: null, clockHeld: false }
  const next = state.lungStep + Math.sign(state.lungTarget - state.lungStep)
  const tool = state.tool ? toolInHand(state.tool) : undefined
  if (resolver.lungClearance(state.pose, next, tool) < CLEARANCE_SKIN_MM + LUNG_ROOM_MM) {
    return state.lungHeld
      ? state
      : event({ ...state, lungHeld: true }, atMs, 'lung-held', `step ${state.lungStep}`)
  }
  let moved: EngineState = {
    ...state,
    lungStep: next,
    lungHeld: false,
    snapshot: { ...state.snapshot, lungAndFluid: `lung step ${next}` },
  }
  moved = event(withView(moved, resolver), atMs, 'lung-moved', `step ${next}`)
  const more = next !== state.lungTarget
  return moved.reducedMotion
    ? { ...moved, clockHeld: more, nextLungMoveAtMs: null }
    : { ...moved, nextLungMoveAtMs: more ? atMs + LUNG_STEP_MS : null }
}

/** The lung's moves that have fallen due by the clock, each at its own time. */
function dueLungMoves(state: EngineState, resolver: SpaceResolver): EngineState {
  let current = state
  while (
    !current.reducedMotion &&
    !current.lungHeld &&
    current.nextLungMoveAtMs !== null &&
    current.nextLungMoveAtMs <= current.clockMs &&
    current.lungStep !== current.lungTarget
  ) {
    current = moveLung(current, resolver, current.nextLungMoveAtMs)
  }
  return current
}

export function reduce(
  state: EngineState,
  action: SimulatedAction,
  resolver: SpaceResolver,
): EngineState {
  if (!isSimulatedAction(action)) {
    throw new Error(
      `Only a simulated action reaches the space engine, not ${(action as { type: string }).type}`,
    )
  }
  switch (action.type) {
    case 'tick': {
      if (!Number.isInteger(action.ms) || action.ms < 0)
        throw new Error('A tick is a whole, non-negative number of milliseconds')
      return dueLungMoves({ ...state, clockMs: state.clockMs + action.ms }, resolver)
    }
    case 'lung-target': {
      if (
        !Number.isInteger(action.step) ||
        action.step < 0 ||
        action.step >= resolver.lungStepCount
      ) {
        throw new Error(`No lung step ${action.step}`)
      }
      const moving = action.step !== state.lungStep
      if (state.reducedMotion) {
        const held = {
          ...state,
          lungTarget: action.step,
          clockHeld: moving,
          nextLungMoveAtMs: null,
        }
        return moving
          ? event(held, state.clockMs, 'lung-waits', `toward step ${action.step}`)
          : held
      }
      return {
        ...state,
        lungTarget: action.step,
        lungHeld: false,
        nextLungMoveAtMs: moving ? state.clockMs + LUNG_STEP_MS : null,
      }
    }
    case 'motion': {
      if (action.reduced === state.reducedMotion) return state
      const moving = state.lungStep !== state.lungTarget
      // Reduced, the clock waits for Step; released, the lung goes on from now at its own pace.
      return action.reduced
        ? { ...state, reducedMotion: true, clockHeld: moving, nextLungMoveAtMs: null }
        : {
            ...state,
            reducedMotion: false,
            clockHeld: false,
            nextLungMoveAtMs: moving ? state.clockMs + LUNG_STEP_MS : null,
          }
    }
    case 'command': {
      if (!sameSnapshot(action.snapshot, state.snapshot)) return state
      const { command } = action
      if (command.kind === 'retry-geometry') return state
      if (command.kind === 'step-clock') {
        return state.reducedMotion && state.clockHeld
          ? moveLung(state, resolver, state.clockMs)
          : state
      }
      if (command.kind === 'tool') {
        if (!state.tool) return state
        const moved = resolver.toolStep(
          state.pose,
          command.direction,
          state.lungStep,
          toolInHand(state.tool),
        )
        const reached = moved.tool ?? toolInHand(state.tool).state
        let next: EngineState = {
          ...state,
          limit: moved.limit,
          tool: {
            ...state.tool,
            phase: reached.phase === 'extended' ? 'extended' : 'in-channel',
            extensionMm: reached.extensionMm,
            touching: moved.touching ?? false,
          },
        }
        if (reached.extensionMm !== state.tool.extensionMm)
          next = event(next, state.clockMs, 'tool-moved', command.direction)
        if (moved.limit)
          next = event(next, state.clockMs, 'stopped', `${moved.limit.part} ${moved.limit.kind}`)
        return next
      }
      const result = resolver.step(
        state.pose,
        command,
        state.lungStep,
        state.tool ? toolInHand(state.tool) : undefined,
      )
      const movedPose =
        result.pose.depthMm !== state.pose.depthMm ||
        result.pose.tiltAcrossRibsDeg !== state.pose.tiltAcrossRibsDeg ||
        result.pose.tiltAlongRibsDeg !== state.pose.tiltAlongRibsDeg ||
        result.pose.rollDeg !== state.pose.rollDeg
      let next: EngineState = {
        ...state,
        pose: result.pose,
        limit: result.limit,
        ...(state.tool ? { tool: { ...state.tool, touching: result.touching ?? false } } : {}),
      }
      if (movedPose) next = event(withView(next, resolver), state.clockMs, 'moved', command.kind)
      if (result.limit)
        next = event(next, state.clockMs, 'stopped', `${result.limit.part} ${result.limit.kind}`)
      // A lung held for want of room tries again now the instrument has moved, and goes on from now.
      // Under reduced motion it still waits for Step.
      if (!movedPose || !next.lungHeld || next.reducedMotion) return next
      return moveLung(next, resolver, state.clockMs)
    }
  }
}
