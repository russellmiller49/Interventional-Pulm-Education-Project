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
  readonly rpmSetpoint: number
  readonly pVen: number | null
  readonly pInt: number | null
  readonly pArt: number | null
  readonly deltaP: number | null
  readonly sweepLpm: number
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
    rpmSetpoint: device.rpmSetpoint,
    pVen: circuit.readouts.pVen.displayed,
    pInt: circuit.readouts.pInt.displayed,
    pArt: circuit.readouts.pArt.displayed,
    deltaP: circuit.readouts.deltaP.displayed,
    sweepLpm: gas.sweepLpm,
    spo2: patient.spo2,
    paCO2: patient.paCO2,
    pH: patient.pH,
    venousLineSaturation: circuit.readouts.venousLineSaturation.displayed,
    systemicVenousSaturationEstimate: patient.systemicVenousSaturationEstimate,
    nativeCardiacOutputLpm: patient.nativeCardiacOutputLpm,
    recirculationAdjustedCircuitFlowLpm: circuit.recirculationAdjustedCircuitFlowLpm,
  }
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
   * Owned here rather than in component state because it belongs to the state that is loaded: a
   * variant that sits short of an authored timed fault has to be held, and it has to be held again
   * every time it is reloaded. Keeping it beside the variant makes that automatic instead of
   * something a caller has to remember.
   */
  readonly clockRunning: boolean
}

export type EcmoFoundationSessionAction =
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
  }
}

export function ecmoFoundationSessionReducer(
  state: EcmoFoundationSessionState,
  action: EcmoFoundationSessionAction,
): EcmoFoundationSessionState {
  switch (action.type) {
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
        // Re-held on every reload, so a state that must be read before it changes cannot be walked
        // past it by a clock the previous state left running.
        clockRunning: action.holdsClock !== true,
      }

    default:
      return state
  }
}
