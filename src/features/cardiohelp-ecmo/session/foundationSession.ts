import {
  type EcmoFoundationGuidedAction,
  type EcmoFoundationStateVariant,
} from '../content/foundationLessonRuntime'
import type { EcmoLearnStateSource } from '../content/referenceProfiles'
import {
  createInitialSimulationState,
  createReferenceSimulationState,
  ecmoSimulationReducer,
} from '../engine'
import type { EcmoSimulationState, SimulationAction } from '../engine/types'

/**
 * Session state for the foundation Learn activity, and the one atomic action that replaced the
 * restore-then-act sequence.
 *
 * The previous shape could not express "reload this state, then do something to it" in a single
 * dispatch: the restore had to land before the action could be resolved against it, so the action
 * was queued in component state and fired from an effect with an `exhaustive-deps` suppression.
 * That put a restored-but-untouched frame on screen for one render and made the ordering depend on
 * React's scheduling rather than on the reducer.
 *
 * `RESTORE_SOURCE_AND_APPLY` builds the source state and folds every supplied engine action into it
 * inside one transition. Zero, one, or many actions are all supported, the fold is a plain
 * left-to-right `reduce`, and the caller sees only the final state. Nothing here dispatches into the
 * core ECMO reducer on its own schedule.
 *
 * A scenario loaded through this reducer is a **teaching preview**: it uses the existing scenario
 * definition and the existing engine, and this module never records a scenario result, never writes
 * mastery, and never touches Practice progress.
 */

/** The signals a baseline review compares. A small record on purpose — never a whole engine state. */
export interface EcmoFoundationSnapshot {
  readonly simulationTime: number
  readonly bloodFlow: number
  readonly displayedBloodFlow: number | null
  readonly rpmSetpoint: number
  readonly pVen: number | null
  readonly pInt: number | null
  readonly pArt: number | null
  readonly deltaP: number | null
  readonly sweepLpm: number
  readonly gasOxygenFraction: number
  readonly postOxygenatorSaturation: number
  readonly rightRadialSpo2: number
  readonly femoralArterialSpo2: number
  readonly spo2: number
  readonly paCO2: number
  readonly pH: number
  readonly venousLineSaturation: number | null
  readonly systemicVenousSaturationEstimate: number
  readonly nativeCardiacOutputLpm: number
  readonly recirculationAdjustedCircuitFlowLpm: number
}

export function ecmoFoundationSnapshot(state: EcmoSimulationState): EcmoFoundationSnapshot {
  const { circuit, patient, gas, device } = state
  return {
    simulationTime: state.simulationTime,
    bloodFlow: circuit.bloodFlow,
    displayedBloodFlow: circuit.flowSensorConnected ? circuit.bloodFlow : null,
    rpmSetpoint: device.rpmSetpoint,
    pVen: circuit.readouts.pVen.displayed,
    pInt: circuit.readouts.pInt.displayed,
    pArt: circuit.readouts.pArt.displayed,
    deltaP: circuit.readouts.deltaP.displayed,
    sweepLpm: gas.sweepLpm,
    gasOxygenFraction: gas.fio2,
    postOxygenatorSaturation: circuit.postOxygenatorSaturation,
    rightRadialSpo2: patient.rightRadialSpo2,
    femoralArterialSpo2: patient.femoralArterialSpo2,
    spo2: patient.spo2,
    paCO2: patient.paCO2,
    pH: patient.pH,
    venousLineSaturation: circuit.readouts.venousLineSaturation.displayed,
    systemicVenousSaturationEstimate: patient.systemicVenousSaturationEstimate,
    nativeCardiacOutputLpm: patient.nativeCardiacOutputLpm,
    recirculationAdjustedCircuitFlowLpm: circuit.recirculationAdjustedCircuitFlowLpm,
  }
}

/** Session-only demonstration evidence, separate from independent attempts and progress. */
export interface EcmoFoundationComparison {
  readonly taskId: string
  readonly actionId: string
  readonly before: EcmoFoundationSnapshot
  readonly after: EcmoFoundationSnapshot
  readonly beforeLabel: string
  readonly afterLabel: string
  /** Retained so Back can show the actual circuit without rerunning an intervention. */
  readonly result: EcmoSimulationState
  readonly resultVariantId: string
  readonly resultSource: EcmoLearnStateSource
}

export interface EcmoFoundationComparisonPlan {
  readonly taskId: string
  readonly baselineVariant: EcmoFoundationStateVariant
  readonly resultVariant: EcmoFoundationStateVariant
  readonly guided: EcmoFoundationGuidedAction
}

export interface EcmoFoundationSessionState {
  readonly simulation: EcmoSimulationState
  /** Which authored variant produced the state on screen. */
  readonly variantId: string
  readonly source: EcmoLearnStateSource
  /** Reset whenever a source is restored, so evidence never carries across a state change. */
  readonly interactionsSinceRestore: readonly string[]
  /** Captured by the learner for a baseline comparison; cleared by any restore. */
  readonly snapshot: EcmoFoundationSnapshot | null
  /**
   * Whether the lesson clock advances on its own.
   *
   * A lesson opens with the clock running on a state that is at rest, and held on a state authored
   * to be read before it changes. ECMO-FELLOW-02 (S17-4): after that, only the learner starts it.
   * A restore used to restart it for any variant that did not hold it — a phase change into the VV
   * capstone's transfer step, the "reveal the evolved state" button, every mechanism preview — so a
   * learner who had been reading a held case watched PaCO₂ climb from 50 to 90 across two reads
   * without having asked for time to pass. A restore now keeps whatever the clock was doing, and
   * holds it where the loaded variant must be held; `SET_CLOCK_RUNNING` ("Let the circuit run on")
   * is the one thing that starts it.
   */
  readonly clockRunning: boolean
  readonly comparisons: Readonly<Record<string, EcmoFoundationComparison>>
}

export type EcmoFoundationSessionAction =
  | { readonly type: 'RUN_COMPARISON'; readonly plan: EcmoFoundationComparisonPlan }
  | {
      readonly type: 'OPEN_COMPARISON'
      readonly plan: EcmoFoundationComparisonPlan
      readonly reset?: boolean
    }
  | { readonly type: 'SIMULATION'; readonly action: SimulationAction }
  | { readonly type: 'RECORD_INTERACTION'; readonly id: string }
  | { readonly type: 'CAPTURE_SNAPSHOT'; readonly id: string }
  | { readonly type: 'SET_CLOCK_RUNNING'; readonly running: boolean }
  /** Advance the clock on the state already loaded, in one transition. */
  | { readonly type: 'ADVANCE'; readonly seconds: number; readonly id?: string }
  | {
      readonly type: 'RESTORE_SOURCE_AND_APPLY'
      readonly source: EcmoLearnStateSource
      readonly actions: readonly SimulationAction[]
      readonly variantId: string
      /** Interaction evidence written in the same transition as the restore. */
      readonly evidenceId?: string
      /** The restored variant holds the clock; set from the variant, not by the caller. */
      readonly holdsClock?: boolean
    }

/**
 * Build the clean state a source names.
 *
 * A reference profile is the authored teaching circuit. A scenario is the existing drill definition
 * run through the existing engine, un-paused so the preview is a circuit that is actually running
 * rather than a frozen frame. Nothing about the scenario's scoring runtime is consumed here.
 */
export function createFoundationSourceState(source: EcmoLearnStateSource): EcmoSimulationState {
  if (source.kind === 'reference-profile') {
    return createReferenceSimulationState(source.profileId)
  }
  return ecmoSimulationReducer(createInitialSimulationState(source.scenarioId, 'guided'), {
    type: 'SET_PAUSED',
    paused: false,
  })
}

/** The state a variant describes: its source, then its own setup actions, in authored order. */
export function createFoundationVariantState(
  variant: EcmoFoundationStateVariant,
): EcmoSimulationState {
  return (variant.setupActions ?? []).reduce(
    ecmoSimulationReducer,
    createFoundationSourceState(variant.source),
  )
}

function settleActions(seconds: number): readonly SimulationAction[] {
  return Array.from({ length: Math.max(0, Math.floor(seconds)) }, () => ({ type: 'STEP' }) as const)
}

/**
 * The single dispatch a restore-and-act button issues.
 *
 * Anything the guided action resolves is resolved against the freshly built variant state — the
 * same state the reducer will build — so "raise the speed by 200 rpm" means 200 above the restored
 * profile's speed and not 200 above whatever was on screen a moment ago. The reducer rebuilds that
 * state deterministically, so the two never diverge.
 */
export function ecmoFoundationRestoreAction(
  variant: EcmoFoundationStateVariant,
  guided?: EcmoFoundationGuidedAction,
): Extract<EcmoFoundationSessionAction, { type: 'RESTORE_SOURCE_AND_APPLY' }> {
  const setup = variant.setupActions ?? []
  const resolved = guided?.resolve ? guided.resolve(createFoundationVariantState(variant)) : []
  return {
    type: 'RESTORE_SOURCE_AND_APPLY',
    source: variant.source,
    variantId: variant.id,
    actions: [...setup, ...resolved, ...settleActions(guided?.settleSeconds ?? 0)],
    ...(guided ? { evidenceId: guided.id } : {}),
    ...(variant.holdsClock ? { holdsClock: true } : {}),
  }
}

export function createEcmoFoundationSessionState(
  variant: EcmoFoundationStateVariant,
): EcmoFoundationSessionState {
  return {
    simulation: createFoundationVariantState(variant),
    variantId: variant.id,
    source: variant.source,
    interactionsSinceRestore: [],
    snapshot: null,
    clockRunning: variant.holdsClock !== true,
    comparisons: {},
  }
}

export function ecmoFoundationSessionReducer(
  state: EcmoFoundationSessionState,
  action: EcmoFoundationSessionAction,
): EcmoFoundationSessionState {
  switch (action.type) {
    case 'RUN_COMPARISON': {
      const { taskId, baselineVariant, resultVariant, guided } = action.plan
      const before = ecmoFoundationSnapshot(createFoundationVariantState(baselineVariant))
      const restored = ecmoFoundationSessionReducer(
        state,
        ecmoFoundationRestoreAction(resultVariant, guided),
      )
      const comparison: EcmoFoundationComparison = {
        taskId,
        actionId: guided.id,
        before,
        after: ecmoFoundationSnapshot(restored.simulation),
        beforeLabel: baselineVariant.label,
        afterLabel: resultVariant.label,
        result: restored.simulation,
        resultVariantId: resultVariant.id,
        resultSource: resultVariant.source,
      }
      return {
        ...restored,
        clockRunning: false,
        comparisons: { ...state.comparisons, [taskId]: comparison },
      }
    }
    case 'OPEN_COMPARISON': {
      const { taskId, baselineVariant } = action.plan
      const comparisons = { ...state.comparisons }
      if (action.reset) delete comparisons[taskId]
      const saved = comparisons[taskId]
      if (saved) {
        return {
          ...state,
          simulation: saved.result,
          variantId: saved.resultVariantId,
          source: saved.resultSource,
          snapshot: null,
          clockRunning: false,
          interactionsSinceRestore: [saved.actionId],
          comparisons,
        }
      }
      return {
        ...ecmoFoundationSessionReducer(state, ecmoFoundationRestoreAction(baselineVariant)),
        clockRunning: false,
        comparisons,
      }
    }
    case 'SIMULATION':
      return { ...state, simulation: ecmoSimulationReducer(state.simulation, action.action) }

    case 'RECORD_INTERACTION':
      return {
        ...state,
        interactionsSinceRestore: state.interactionsSinceRestore.includes(action.id)
          ? state.interactionsSinceRestore
          : [...state.interactionsSinceRestore, action.id],
      }

    case 'CAPTURE_SNAPSHOT':
      return {
        ...state,
        snapshot: ecmoFoundationSnapshot(state.simulation),
        interactionsSinceRestore: state.interactionsSinceRestore.includes(action.id)
          ? state.interactionsSinceRestore
          : [...state.interactionsSinceRestore, action.id],
      }

    case 'SET_CLOCK_RUNNING':
      return { ...state, clockRunning: action.running }

    case 'ADVANCE': {
      const simulation = settleActions(action.seconds).reduce(
        ecmoSimulationReducer,
        state.simulation,
      )
      const id = action.id
      return {
        ...state,
        simulation,
        interactionsSinceRestore:
          id && !state.interactionsSinceRestore.includes(id)
            ? [...state.interactionsSinceRestore, id]
            : state.interactionsSinceRestore,
      }
    }

    case 'RESTORE_SOURCE_AND_APPLY':
      return {
        // One fold, one returned state. No intermediate frame is ever handed back.
        simulation: action.actions.reduce(
          ecmoSimulationReducer,
          createFoundationSourceState(action.source),
        ),
        variantId: action.variantId,
        source: action.source,
        interactionsSinceRestore: action.evidenceId ? [action.evidenceId] : [],
        snapshot: null,
        // Held on reload where the variant must be read before it changes, so a clock the previous
        // state left running cannot walk past it; otherwise left exactly as it was. A restore never
        // starts time (S17-4).
        clockRunning: action.holdsClock === true ? false : state.clockRunning,
        comparisons: state.comparisons,
      }

    default:
      return state
  }
}
