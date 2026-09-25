import {
  advanceMcsSimulation,
  createInitialMcsState,
  totalMcsCirculatingVolume,
} from '../engine/model'
import { mcsReducer } from '../engine/reducer'
import type {
  McsAction,
  McsDerivedMetrics,
  McsDeviceKind,
  McsModuleSection,
  McsScenarioDefinition,
  McsSimulationState,
  McsSupportDiagnostics,
} from '../engine/types'

/**
 * One deterministic replay harness over the production reducer and model.
 *
 * MCS-PRE-REVIEW-02 has to answer questions of the form "what actually happened between these two
 * states, and which term caused it" — for the suction predicate, the displayed LV surrogate, the
 * IABP timing landmarks and the durable-pump estimator. The rule the task sets is that those
 * answers come from the shipped engine, never from a second hand-written simulator, so everything
 * here drives `mcsReducer` and `advanceMcsSimulation` and then *reads*. No formula is duplicated:
 * the unrounded intermediates come back from the model itself through `McsSupportDiagnostics`.
 *
 * A probe is a photograph of one state: the model's clock, the device, the conserved compartments,
 * the unrounded support intermediates, the rounded displayed metrics, the active alarms and the
 * recorded action ids. Two probes taken at the same model time from the same setup are directly
 * comparable; that matched-time discipline is what separates "the action did this" from "eight
 * seconds passed".
 *
 * Nothing in this file is learner-facing and nothing here writes to a learner session: every run
 * forks its own state from `createInitialMcsState`.
 */

export interface McsReplayProbe {
  /** The model's own clock, not wall time. */
  readonly timeSeconds: number
  readonly patient: McsSimulationState['patient']
  readonly device: McsSimulationState['device']
  /** Rounded, exactly as the monitor and the worked explanations read them. */
  readonly metrics: McsDerivedMetrics
  /** Unrounded intermediates, straight from the production support computation. */
  readonly diagnostics: McsSupportDiagnostics
  readonly compartments: McsSimulationState['compartments']
  readonly totalCirculatingVolumeMl: number
  readonly activeAlarmIds: readonly string[]
  readonly actionIds: readonly string[]
  readonly causalExplanation: string
  readonly criticalErrors: readonly string[]
  readonly state: McsSimulationState
}

export interface McsReplaySetup {
  readonly id: string
  readonly section?: McsModuleSection
  readonly device?: McsDeviceKind
  readonly scenario?: McsScenarioDefinition | null
  readonly seed?: number
  /** Applied before the settle interval; this is the constructed starting state. */
  readonly setup?: readonly McsAction[]
  /** Authored settle interval in simulated seconds. Not a clinical stabilization time. */
  readonly settleSeconds?: number
}

export interface McsReplayArm {
  readonly id: string
  /** `[]` is the no-action control. */
  readonly actions?: readonly McsAction[]
  /** Simulated seconds observed after the arm's actions, identical across compared arms. */
  readonly observeSeconds?: number
}

export interface McsReplayResult {
  readonly setupId: string
  readonly seed: number
  readonly settleSeconds: number
  readonly observeSeconds: number
  /** The shared starting state every arm forks from. */
  readonly baseline: McsReplayProbe
  readonly arms: Readonly<Record<string, McsReplayProbe>>
}

/** Default authored settle/observe interval. Matches `MCS_OBSERVATION_SECONDS`. */
export const MCS_REPLAY_DEFAULT_SECONDS = 8

export function mcsProbe(state: McsSimulationState): McsReplayProbe {
  return {
    timeSeconds: state.timeSeconds,
    patient: state.patient,
    device: state.device,
    metrics: state.metrics,
    diagnostics: state.supportDiagnostics,
    compartments: state.compartments,
    totalCirculatingVolumeMl: totalMcsCirculatingVolume(state),
    activeAlarmIds: state.alarms.filter((entry) => entry.active).map((entry) => entry.id),
    actionIds: state.actionIds,
    causalExplanation: state.causalExplanation,
    criticalErrors: state.criticalErrors,
    state,
  }
}

/** Builds the shared starting state: initial state → setup actions → settle. */
export function mcsReplayBaseline(setup: McsReplaySetup): McsSimulationState {
  const seed = setup.seed ?? 417
  let state = createInitialMcsState(
    setup.section ?? 'learn',
    setup.device ?? 'iabp',
    setup.scenario ?? null,
    seed,
  )
  for (const action of setup.setup ?? []) state = mcsReducer(state, action)
  return advanceMcsSimulation(state, setup.settleSeconds ?? MCS_REPLAY_DEFAULT_SECONDS)
}

/**
 * Forks one settled starting state into several arms and observes each for the same interval.
 *
 * Every arm receives the identical baseline object, so "no action" and "the intended action" and
 * "a plausible alternative" differ only by their dispatched actions and are read at the same model
 * time. Arms are compared to each other, never to the baseline alone — a difference from the
 * baseline can be elapsed time.
 */
export function mcsReplay(
  setup: McsReplaySetup,
  arms: readonly McsReplayArm[],
  observeSeconds = MCS_REPLAY_DEFAULT_SECONDS,
): McsReplayResult {
  const baseline = mcsReplayBaseline(setup)
  if (arms.some((arm) => (arm.observeSeconds ?? observeSeconds) !== observeSeconds))
    throw new Error('Compared replay arms must use the same observation interval')
  let states = arms.map(() => baseline)
  const slots = Math.max(0, ...arms.map((arm) => arm.actions?.length ?? 0))
  for (let slot = 0; slot < slots; slot++) {
    states = states.map((state, index) => {
      const action = arms[index].actions?.[slot]
      return action ? mcsReducer(state, action) : state
    })
    // Control changes advance the production solver by one fixed step. Advance the
    // other arms through that same slot before applying the next action.
    const targetTime = Math.max(...states.map((state) => state.timeSeconds))
    states = states.map((state) => {
      const remaining = targetTime - state.timeSeconds
      return remaining > 1e-9 ? advanceMcsSimulation(state, remaining) : state
    })
  }
  const probes: Record<string, McsReplayProbe> = {}
  arms.forEach((arm, index) => {
    probes[arm.id] = mcsProbe(advanceMcsSimulation(states[index], observeSeconds))
  })
  return {
    setupId: setup.id,
    seed: setup.seed ?? 417,
    settleSeconds: setup.settleSeconds ?? MCS_REPLAY_DEFAULT_SECONDS,
    observeSeconds,
    baseline: mcsProbe(baseline),
    arms: probes,
  }
}

/** One arm's rounded displayed value, and its difference from another arm at the same time. */
export function mcsCompare(
  result: McsReplayResult,
  metric: keyof McsDerivedMetrics,
  fromArm: string,
  toArm: string,
): { from: number | null; to: number | null; delta: number | null } {
  const raw = (armId: string) => {
    const value = result.arms[armId]?.metrics[metric]
    return typeof value === 'number' ? value : null
  }
  const from = raw(fromArm)
  const to = raw(toArm)
  return { from, to, delta: from === null || to === null ? null : to - from }
}
