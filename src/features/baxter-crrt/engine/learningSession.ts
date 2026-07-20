import type { BaxterCrrtDeviceId } from '../content/deviceProfiles'
import { isBaxterCrrtLearnerCaseDefinition } from '../content/learnerRegistry'
import { normalizeRuntimeCrrtCaseToEngineFixture } from '../content/runtimeCaseNormalization'
import type { RuntimeCrrtCase } from '../content/schema'
import {
  createInitialPrismaxPilotInterfaceState,
  prismaxSetupSteps,
  prismaxPilotInterfaceReducer,
  type PrismaxPilotInterfaceAction,
  type PrismaxPilotInterfaceState,
  type PrismaxSetupStepId,
} from './deviceAdapters/prismax'
import { createInitialCrrtSimulationState } from './initialState'
import { selectCrrtMasteryCapstoneId, selectTriggeredCriticalErrorIds } from './outcomes'
import { crrtSimulationReducer } from './reducer'
import { deriveDeterministicSeed } from './seededRandom'
import { applyScheduledEventAction, recomputeCrrtDerivedState } from './simulation'
import {
  crrtEngineFaultIds,
  type CrrtEngineFaultId,
  type CrrtEngineFixture,
  type CrrtFlowRates,
  type CrrtRoleLens,
  type CrrtSimulationState,
  type ExternalFluidRateKey,
} from './types'

export type CrrtLearningExperience = 'practice' | 'mastery'

export const CRRT_PROGRESS_PERSISTENCE_ENABLED = true as const
export const CRRT_TELEMETRY_ENABLED = true as const

export type CrrtReasoningPhase =
  | 'read'
  | 'define'
  | 'select'
  | 'predict'
  | 'run'
  | 'reassess'
  | 'reflect'

export type CrrtPrecommitReasoningPhase = Extract<
  CrrtReasoningPhase,
  'define' | 'select' | 'predict'
>

const crrtPrecommitReasoningPhases = [
  'read',
  'define',
  'select',
  'predict',
] as const satisfies readonly CrrtReasoningPhase[]

export interface CrrtPredictionCommitment {
  readonly goalOptionId: string
  readonly mechanismOptionId: string
  readonly controlOptionIds: readonly string[]
  readonly responseOptionId: string
  readonly reassessmentOptionIds: readonly string[]
}

export interface CrrtReassessmentCommitment {
  readonly committed: boolean
  readonly optionIds: readonly string[]
}

export type CrrtLearningTimelineEventType =
  | 'prediction-committed'
  | 'intervention-performed'
  | 'device-action'
  | 'time-advanced'
  | 'hint-used'
  | 'reassessment-committed'
  | 'debrief-revealed'

export interface CrrtLearningTimelineEntry {
  readonly sequence: number
  readonly atSeconds: number
  readonly type: CrrtLearningTimelineEventType
  readonly referenceId: string | null
}

export interface CrrtLearningSessionState {
  readonly caseDefinition: RuntimeCrrtCase
  readonly fixture: CrrtEngineFixture
  readonly simulation: CrrtSimulationState
  readonly interfaceState: PrismaxPilotInterfaceState
  readonly experience: CrrtLearningExperience
  readonly persistenceEnabled: typeof CRRT_PROGRESS_PERSISTENCE_ENABLED
  readonly telemetryEnabled: typeof CRRT_TELEMETRY_ENABLED
  /** Approved capstone identity; null for every non-Mastery or locked session. */
  readonly masteryCapstoneId: string | null
  readonly roleLens: CrrtRoleLens
  readonly attempt: number
  readonly prediction: CrrtPredictionCommitment | null
  readonly performedInterventionIds: readonly string[]
  readonly usedHintIds: readonly string[]
  readonly reassessment: CrrtReassessmentCommitment
  readonly reasoningPhase: CrrtReasoningPhase
  readonly timeline: readonly CrrtLearningTimelineEntry[]
  readonly criticalErrorIds: readonly string[]
  readonly debriefRevealed: boolean
}

export interface CreateCrrtLearningSessionOptions {
  readonly caseDefinition: RuntimeCrrtCase
  readonly experience: CrrtLearningExperience
  readonly roleLens: CrrtRoleLens
  readonly attempt: number
  readonly deviceId?: BaxterCrrtDeviceId
  readonly seed?: number
  /** A registry may cache the already validated normalization result. */
  readonly fixture?: CrrtEngineFixture
}

export type CrrtLearningSessionAction =
  | ({ readonly type: 'LOAD_CASE' } & CreateCrrtLearningSessionOptions)
  | {
      readonly type: 'RESET'
      readonly experience?: CrrtLearningExperience
      readonly roleLens?: CrrtRoleLens
      readonly attempt?: number
    }
  | {
      readonly type: 'ENTER_PRECOMMIT_REASONING_PHASE'
      readonly phase: CrrtPrecommitReasoningPhase
    }
  | { readonly type: 'COMMIT_PREDICTION'; readonly prediction: CrrtPredictionCommitment }
  | { readonly type: 'PERFORM_INTERVENTION'; readonly interventionId: string }
  | { readonly type: 'DEVICE_ACTION'; readonly action: PrismaxPilotInterfaceAction }
  | { readonly type: 'ADVANCE_TIME'; readonly seconds: number }
  | { readonly type: 'USE_HINT' }
  | { readonly type: 'COMMIT_REASSESSMENT'; readonly optionIds: readonly string[] }
  | { readonly type: 'REVEAL_DEBRIEF' }

export class UnsupportedCrrtLearningEffectError extends Error {
  constructor(target: string, reason = 'unsupported target') {
    super(`CRRT learning effect rejected for ${target}: ${reason}.`)
    this.name = 'UnsupportedCrrtLearningEffectError'
  }
}

const flowKeys = new Set<keyof CrrtFlowRates>([
  'bloodFlowMlMin',
  'dialysateFlowMlHour',
  'pbpFlowMlHour',
  'preReplacementFlowMlHour',
  'postReplacementFlowMlHour',
  'patientFluidRemovalMlHour',
  'syringeFlowMlHour',
  'makeupFlowMlHour',
])

const externalFluidRateKeys = new Set<ExternalFluidRateKey>([
  'maintenanceInputMlHour',
  'medicationCarrierInputMlHour',
  'nutritionInputMlHour',
  'bloodProductInputMlHour',
  'bolusInputMlHour',
  'otherInputMlHour',
  'urineOutputMlHour',
  'drainOutputMlHour',
  'otherOutputMlHour',
])

const engineFaultIds = new Set<CrrtEngineFaultId>(crrtEngineFaultIds)

type CaseEffect = RuntimeCrrtCase['interventions'][number]['effects'][number]
type NumericCaseEffect = Extract<CaseEffect, { valueType: 'number' }>

function appendTimeline(
  state: CrrtLearningSessionState,
  type: CrrtLearningTimelineEventType,
  referenceId: string | null,
): readonly CrrtLearningTimelineEntry[] {
  return [
    ...state.timeline,
    Object.freeze({
      sequence: state.timeline.length + 1,
      atSeconds: state.simulation.simulationTimeSeconds,
      type,
      referenceId,
    }),
  ]
}

function uniqueIds(ids: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(ids)])
}

function freezePrediction(prediction: CrrtPredictionCommitment): CrrtPredictionCommitment {
  return Object.freeze({
    goalOptionId: prediction.goalOptionId,
    mechanismOptionId: prediction.mechanismOptionId,
    controlOptionIds: uniqueIds(prediction.controlOptionIds),
    responseOptionId: prediction.responseOptionId,
    reassessmentOptionIds: uniqueIds(prediction.reassessmentOptionIds),
  })
}

function optionIds(options: readonly { readonly id: string }[]): ReadonlySet<string> {
  return new Set(options.map((option) => option.id))
}

function validatePrediction(
  definition: RuntimeCrrtCase,
  prediction: CrrtPredictionCommitment,
): CrrtPredictionCommitment | null {
  const frozen = freezePrediction(prediction)
  if (!optionIds(definition.goalOptions).has(frozen.goalOptionId)) return null
  if (!optionIds(definition.mechanismOptions).has(frozen.mechanismOptionId)) return null
  if (!optionIds(definition.responseOptions).has(frozen.responseOptionId)) return null
  const controls = optionIds(definition.controlOptions)
  const reassessments = optionIds(definition.reassessmentOptions)
  if (
    frozen.controlOptionIds.length === 0 ||
    frozen.controlOptionIds.some((id) => !controls.has(id)) ||
    frozen.reassessmentOptionIds.length === 0 ||
    frozen.reassessmentOptionIds.some((id) => !reassessments.has(id))
  ) {
    return null
  }
  return frozen
}

function sessionSeed(options: CreateCrrtLearningSessionOptions): number {
  return options.seed ?? deriveDeterministicSeed(options.caseDefinition.id, options.attempt)
}

type InitialDeviceOverrides = NonNullable<RuntimeCrrtCase['initialDeviceOverrides']>
type InitialWorkflowPhase = NonNullable<InitialDeviceOverrides['workflowPhase']>
type ConfiguredSimulationPrescription = Extract<
  CrrtSimulationState['prescription'],
  { readonly status: 'configured' }
>

function resolveInitialWorkflowPhase(
  overrides: InitialDeviceOverrides | undefined,
): InitialWorkflowPhase {
  if (overrides?.workflowPhase) return overrides.workflowPhase
  if (overrides?.treatmentState === 'running' || overrides?.treatmentState === 'paused') {
    return 'operations'
  }
  if (overrides?.treatmentState === 'stopped') return 'stop'
  return 'new-patient'
}

function completedSetupStepsForPhase(phase: InitialWorkflowPhase): readonly PrismaxSetupStepId[] {
  const stepIds = prismaxSetupSteps.map((step) => step.id)
  switch (phase) {
    case 'new-patient':
    case 'setup':
      return []
    case 'prime':
      return stepIds.slice(0, stepIds.indexOf('prime'))
    case 'review':
      return stepIds.slice(0, stepIds.indexOf('review'))
    case 'connect':
      return stepIds.slice(0, stepIds.indexOf('connect-patient'))
    case 'operations':
    case 'stop':
      return stepIds
    default:
      return assertNever(phase)
  }
}

function configuredInitialPrescription(
  simulation: CrrtSimulationState,
): ConfiguredSimulationPrescription {
  if (simulation.prescription.status !== 'configured') {
    throw new Error('An in-progress CRRT device workflow requires a configured prescription.')
  }
  return {
    ...simulation.prescription,
    flows: { ...simulation.prescription.flows },
    sourceIds: [...simulation.prescription.sourceIds],
  }
}

function createCaseInitialInterfaceState(
  definition: RuntimeCrrtCase,
  simulation: CrrtSimulationState,
): PrismaxPilotInterfaceState {
  const overrides = definition.initialDeviceOverrides
  const phase = resolveInitialWorkflowPhase(overrides)
  if (overrides?.activeAlarmIds && overrides.activeAlarmIds.length > 0) {
    throw new Error(
      'Initial device alarms remain disabled until reviewed alarm mapping is enabled.',
    )
  }

  const fresh = createInitialPrismaxPilotInterfaceState()
  if (phase === 'new-patient') return fresh

  const completedStepIds = completedSetupStepsForPhase(phase)
  const prescriptionLoaded = completedStepIds.includes('prescription')
  const committedPrescription = prescriptionLoaded
    ? configuredInitialPrescription(simulation)
    : null
  const treatmentState = interfaceTreatmentStateForDeliveryState(simulation.device.deliveryState)

  return {
    ...fresh,
    screen: phase === 'operations' || phase === 'stop' ? 'operations' : 'setup',
    startSelection: 'new-patient',
    selectedModality: committedPrescription?.modality ?? null,
    completedStepIds,
    prescriptionDraft: committedPrescription
      ? {
          bloodFlowMlMin: committedPrescription.flows.bloodFlowMlMin,
          dialysateFlowMlHour: committedPrescription.flows.dialysateFlowMlHour,
          patientFluidRemovalMlHour: committedPrescription.flows.patientFluidRemovalMlHour,
        }
      : fresh.prescriptionDraft,
    committedPrescription,
    primeState:
      phase === 'review' || phase === 'connect' || phase === 'operations' || phase === 'stop'
        ? 'complete'
        : 'not-started',
    treatmentState,
  }
}

function alignSimulationToInitialDeviceOverrides(
  simulation: CrrtSimulationState,
  overrides: InitialDeviceOverrides | undefined,
): CrrtSimulationState {
  if (!overrides?.treatmentState || overrides.treatmentState === 'not-started') {
    return simulation
  }

  const deliveryState =
    overrides.treatmentState === 'stopped' ? ('ended' as const) : overrides.treatmentState
  let aligned = crrtSimulationReducer(simulation, {
    type: 'SET_DELIVERY_STATE',
    deliveryState,
  })
  if (aligned.device.deliveryState !== deliveryState) {
    throw new Error(
      `CRRT case ${simulation.scenario.fixtureId ?? 'unloaded'} cannot enter its authored ${deliveryState} device state.`,
    )
  }

  const patientConnected =
    overrides.connectedToPatient ?? (deliveryState === 'running' || deliveryState === 'paused')
  const pumpsPaused = overrides.pumpsPaused ?? deliveryState !== 'running'
  if (deliveryState === 'running' && (!patientConnected || pumpsPaused)) {
    throw new Error('A running CRRT case requires a connected patient and unpaused pumps.')
  }
  if (deliveryState === 'paused' && !pumpsPaused) {
    throw new Error('A paused CRRT case requires paused pumps.')
  }

  aligned = recomputeCrrtDerivedState({
    ...aligned,
    device: {
      ...aligned.device,
      patientConnected,
      bloodPumpRunning: deliveryState === 'running' && !pumpsPaused,
      fluidPumpsRunning: deliveryState === 'running' && !pumpsPaused,
      returnClampClosed: !patientConnected,
    },
  })
  return aligned
}

export function createCrrtLearningSession(
  options: CreateCrrtLearningSessionOptions,
): CrrtLearningSessionState {
  if (!Number.isSafeInteger(options.attempt) || options.attempt < 1) {
    throw new RangeError('CRRT learning-session attempt must be a positive integer.')
  }
  if (!isBaxterCrrtLearnerCaseDefinition(options.caseDefinition)) {
    throw new Error(
      `CRRT case ${options.caseDefinition.id} is not registered in the unified learner curriculum.`,
    )
  }
  const deviceId = options.deviceId ?? 'prismax-aw8035-2xx'
  if (!options.caseDefinition.compatibleDevices.includes(deviceId)) {
    throw new Error(`CRRT case ${options.caseDefinition.id} is not compatible with ${deviceId}.`)
  }
  const masteryCapstoneId =
    options.experience === 'mastery' ? selectCrrtMasteryCapstoneId(options.caseDefinition) : null
  if (options.experience === 'mastery' && masteryCapstoneId === null) {
    throw new Error(
      'CRRT Mastery is locked to its content-owned capstone case with at least two problem domains.',
    )
  }
  const fixture = options.fixture ?? normalizeRuntimeCrrtCaseToEngineFixture(options.caseDefinition)
  if (fixture.id !== options.caseDefinition.id) {
    throw new Error('CRRT learning-session fixture ID must match the runtime case ID.')
  }
  const simulation = alignSimulationToInitialDeviceOverrides(
    createInitialCrrtSimulationState({
      fixture,
      experience: options.experience,
      roleLens: options.roleLens,
      attempt: options.attempt,
      deviceId,
      seed: sessionSeed(options),
    }),
    options.caseDefinition.initialDeviceOverrides,
  )
  const interfaceState = createCaseInitialInterfaceState(options.caseDefinition, simulation)
  return {
    caseDefinition: options.caseDefinition,
    fixture,
    simulation,
    interfaceState,
    experience: options.experience,
    persistenceEnabled: CRRT_PROGRESS_PERSISTENCE_ENABLED,
    telemetryEnabled: CRRT_TELEMETRY_ENABLED,
    masteryCapstoneId,
    roleLens: options.roleLens,
    attempt: options.attempt,
    prediction: null,
    performedInterventionIds: [],
    usedHintIds: [],
    reassessment: Object.freeze({ committed: false, optionIds: [] }),
    reasoningPhase: 'read',
    timeline: [],
    criticalErrorIds: [],
    debriefRevealed: false,
  }
}

function canAct(state: CrrtLearningSessionState): boolean {
  return state.prediction !== null && !state.debriefRevealed
}

function applyNumberOperation(current: number, effect: NumericCaseEffect): number {
  let next: number
  switch (effect.operation) {
    case 'set':
      next = effect.value
      break
    case 'add':
      next = current + effect.value
      break
    case 'multiply':
      next = current * effect.value
      break
    case 'move-toward':
      throw new UnsupportedCrrtLearningEffectError(
        effect.target,
        'move-toward requires an authored time constant and is not enabled',
      )
    default:
      return assertNever(effect.operation)
  }
  if (!Number.isFinite(next) || next < 0) {
    throw new RangeError(
      `CRRT learning effect ${effect.target} must remain finite and nonnegative.`,
    )
  }
  return next
}

function applyAllowlistedEffect(
  simulation: CrrtSimulationState,
  effect: CaseEffect,
): CrrtSimulationState {
  const flowPrefix = 'prescription.flows.'
  if (effect.target.startsWith(flowPrefix)) {
    if (effect.valueType !== 'number' || simulation.prescription.status !== 'configured') {
      throw new UnsupportedCrrtLearningEffectError(
        effect.target,
        'configured numeric flow required',
      )
    }
    const key = effect.target.slice(flowPrefix.length)
    if (!flowKeys.has(key as keyof CrrtFlowRates)) {
      throw new UnsupportedCrrtLearningEffectError(effect.target)
    }
    const flowKey = key as keyof CrrtFlowRates
    return crrtSimulationReducer(simulation, {
      type: 'SET_PRESCRIPTION',
      prescription: {
        ...simulation.prescription,
        flows: {
          ...simulation.prescription.flows,
          [flowKey]: applyNumberOperation(simulation.prescription.flows[flowKey], effect),
        },
      },
    })
  }

  const externalPrefix = 'scenario.externalFluidRates.'
  if (effect.target.startsWith(externalPrefix)) {
    if (effect.valueType !== 'number') {
      throw new UnsupportedCrrtLearningEffectError(effect.target, 'numeric rate required')
    }
    const key = effect.target.slice(externalPrefix.length)
    if (!externalFluidRateKeys.has(key as ExternalFluidRateKey)) {
      throw new UnsupportedCrrtLearningEffectError(effect.target)
    }
    const rateKey = key as ExternalFluidRateKey
    return crrtSimulationReducer(simulation, {
      type: 'SET_EXTERNAL_FLUID_RATES',
      rates: {
        ...simulation.scenario.externalFluidRates,
        [rateKey]: applyNumberOperation(simulation.scenario.externalFluidRates[rateKey], effect),
      },
    })
  }

  if (effect.target === 'patient.bodyWeightKg' || effect.target === 'patient.hematocritFraction') {
    if (
      effect.valueType !== 'number' ||
      simulation.patient.status !== 'configured' ||
      simulation.prescription.status !== 'configured'
    ) {
      throw new UnsupportedCrrtLearningEffectError(
        effect.target,
        'configured numeric patient input required',
      )
    }
    const current =
      effect.target === 'patient.bodyWeightKg'
        ? simulation.patient.bodyWeightKg
        : simulation.patient.hematocritFraction
    const nextValue = applyNumberOperation(current, effect)
    if (effect.target === 'patient.bodyWeightKg' && nextValue <= 0) {
      throw new RangeError('Synthetic body weight must remain positive.')
    }
    if (effect.target === 'patient.hematocritFraction' && nextValue > 1) {
      throw new RangeError('Synthetic hematocrit fraction must remain between zero and one.')
    }
    const patient = {
      ...simulation.patient,
      ...(effect.target === 'patient.bodyWeightKg'
        ? { bodyWeightKg: nextValue }
        : { hematocritFraction: nextValue }),
    }
    const nextSimulation = { ...simulation, patient }
    return crrtSimulationReducer(nextSimulation, {
      type: 'SET_PRESCRIPTION',
      prescription: simulation.prescription,
    })
  }

  if (effect.target === 'access.accessResistanceMmHgPerMlMin') {
    if (effect.valueType !== 'number' || simulation.access.status !== 'configured') {
      throw new UnsupportedCrrtLearningEffectError(
        effect.target,
        'configured numeric access resistance required',
      )
    }
    return recomputeCrrtDerivedState(
      applyScheduledEventAction(simulation, {
        type: 'SET_ACCESS_RESISTANCE',
        resistanceMmHgPerMlMin: applyNumberOperation(
          simulation.access.accessResistanceMmHgPerMlMin,
          effect,
        ),
      }),
    )
  }

  if (effect.target === 'access.returnResistanceMmHgPerMlMin') {
    if (effect.valueType !== 'number' || simulation.access.status !== 'configured') {
      throw new UnsupportedCrrtLearningEffectError(
        effect.target,
        'configured numeric return resistance required',
      )
    }
    return recomputeCrrtDerivedState(
      applyScheduledEventAction(simulation, {
        type: 'SET_RETURN_RESISTANCE',
        resistanceMmHgPerMlMin: applyNumberOperation(
          simulation.access.returnResistanceMmHgPerMlMin,
          effect,
        ),
      }),
    )
  }

  if (
    effect.target === 'circuit.filter.procoagulantBurdenFraction' ||
    effect.target === 'circuit.filter.lowEffectiveBloodFlowFraction'
  ) {
    if (effect.valueType !== 'number') {
      throw new UnsupportedCrrtLearningEffectError(effect.target, 'numeric filter risk required')
    }
    const filter = simulation.circuit.filter
    const nextValue = applyNumberOperation(
      effect.target === 'circuit.filter.procoagulantBurdenFraction'
        ? filter.procoagulantBurdenFraction
        : filter.lowEffectiveBloodFlowFraction,
      effect,
    )
    return recomputeCrrtDerivedState(
      applyScheduledEventAction(simulation, {
        type: 'SET_FILTER_RISK',
        procoagulantBurdenFraction:
          effect.target === 'circuit.filter.procoagulantBurdenFraction'
            ? nextValue
            : filter.procoagulantBurdenFraction,
        lowEffectiveBloodFlowFraction:
          effect.target === 'circuit.filter.lowEffectiveBloodFlowFraction'
            ? nextValue
            : filter.lowEffectiveBloodFlowFraction,
      }),
    )
  }

  const faultPrefix = 'scenario.activeFaults.'
  if (effect.target.startsWith(faultPrefix)) {
    if (effect.valueType !== 'boolean' || effect.operation !== 'set') {
      throw new UnsupportedCrrtLearningEffectError(effect.target, 'boolean set required')
    }
    const fault = effect.target.slice(faultPrefix.length)
    if (!engineFaultIds.has(fault as CrrtEngineFaultId)) {
      throw new UnsupportedCrrtLearningEffectError(effect.target, 'unknown engine fault')
    }
    return crrtSimulationReducer(simulation, {
      type: 'SET_FAULT',
      fault: fault as CrrtEngineFaultId,
      active: effect.value,
    })
  }

  if (effect.target === 'device.deliveryState') {
    if (effect.valueType !== 'enum' || effect.operation !== 'set') {
      throw new UnsupportedCrrtLearningEffectError(effect.target, 'enum set required')
    }
    if (!['idle', 'running', 'paused', 'ended'].includes(effect.value)) {
      throw new UnsupportedCrrtLearningEffectError(effect.target, 'invalid delivery state')
    }
    return crrtSimulationReducer(simulation, {
      type: 'SET_DELIVERY_STATE',
      deliveryState: effect.value as CrrtSimulationState['device']['deliveryState'],
    })
  }

  if (effect.target === 'simulation.advanceTimeSeconds') {
    if (effect.valueType !== 'number' || effect.operation !== 'add') {
      throw new UnsupportedCrrtLearningEffectError(
        effect.target,
        'nonnegative numeric add required',
      )
    }
    return crrtSimulationReducer(simulation, { type: 'ADVANCE_TIME', seconds: effect.value })
  }

  throw new UnsupportedCrrtLearningEffectError(effect.target)
}

/** Executes authored effects through an explicit target allowlist. */
export function executeCrrtInterventionEffects(
  simulation: CrrtSimulationState,
  effects: readonly CaseEffect[],
): CrrtSimulationState {
  return effects.reduce(applyAllowlistedEffect, simulation)
}

function withDerivedCriticalErrors(state: CrrtLearningSessionState): CrrtLearningSessionState {
  const triggered = selectTriggeredCriticalErrorIds(state)
  return {
    ...state,
    criticalErrorIds: [...new Set([...state.criticalErrorIds, ...triggered])].sort(),
  }
}

function syncInterfaceActionToEngine(
  previous: PrismaxPilotInterfaceState,
  next: PrismaxPilotInterfaceState,
  simulation: CrrtSimulationState,
): CrrtSimulationState {
  let synced = simulation
  if (next.committedPrescription && next.committedPrescription !== previous.committedPrescription) {
    synced = crrtSimulationReducer(synced, {
      type: 'SET_PRESCRIPTION',
      prescription: next.committedPrescription,
    })
  }
  if (next.treatmentState !== previous.treatmentState) {
    const deliveryState = next.treatmentState === 'running' ? 'running' : 'ended'
    synced = crrtSimulationReducer(synced, { type: 'SET_DELIVERY_STATE', deliveryState })
  }
  return synced
}

/**
 * The legacy PrisMax facsimile state has no paused enum. Project paused to idle so the
 * Operations facsimile fails safe as not running without locking the session as
 * ended; a later authored resume can project it back to running.
 */
function interfaceTreatmentStateForDeliveryState(
  deliveryState: CrrtSimulationState['device']['deliveryState'],
): PrismaxPilotInterfaceState['treatmentState'] {
  switch (deliveryState) {
    case 'running':
      return 'running'
    case 'ended':
      return 'ended'
    case 'idle':
    case 'paused':
      return 'idle'
    default:
      return assertNever(deliveryState)
  }
}

function syncEngineDeliveryToInterface(
  previousInterface: PrismaxPilotInterfaceState,
  previousSimulation: CrrtSimulationState,
  nextSimulation: CrrtSimulationState,
): PrismaxPilotInterfaceState {
  if (nextSimulation.device.deliveryState === previousSimulation.device.deliveryState) {
    return previousInterface
  }
  return {
    ...previousInterface,
    screen: 'operations',
    treatmentState: interfaceTreatmentStateForDeliveryState(nextSimulation.device.deliveryState),
    stopDialogOpen: false,
  }
}

export function crrtLearningSessionReducer(
  state: CrrtLearningSessionState,
  action: CrrtLearningSessionAction,
): CrrtLearningSessionState {
  switch (action.type) {
    case 'LOAD_CASE':
      return createCrrtLearningSession(action)
    case 'RESET':
      return createCrrtLearningSession({
        caseDefinition: state.caseDefinition,
        fixture: state.fixture,
        experience: action.experience ?? state.experience,
        roleLens: action.roleLens ?? state.roleLens,
        attempt: action.attempt ?? state.attempt,
        deviceId: state.simulation.deviceId,
      })
    case 'ENTER_PRECOMMIT_REASONING_PHASE': {
      if (state.prediction || state.debriefRevealed) return state
      const currentIndex = crrtPrecommitReasoningPhases.findIndex(
        (phase) => phase === state.reasoningPhase,
      )
      const requestedIndex = crrtPrecommitReasoningPhases.indexOf(action.phase)
      if (
        currentIndex < 0 ||
        requestedIndex === currentIndex ||
        requestedIndex > currentIndex + 1
      ) {
        return state
      }
      return { ...state, reasoningPhase: action.phase }
    }
    case 'COMMIT_PREDICTION': {
      if (state.prediction || state.debriefRevealed || state.reasoningPhase !== 'predict') {
        return state
      }
      const prediction = validatePrediction(state.caseDefinition, action.prediction)
      if (!prediction) return state
      return {
        ...state,
        prediction,
        reasoningPhase: 'run',
        timeline: appendTimeline(state, 'prediction-committed', null),
      }
    }
    case 'PERFORM_INTERVENTION': {
      if (!canAct(state)) return state
      const intervention = state.caseDefinition.interventions.find(
        (candidate) => candidate.id === action.interventionId,
      )
      if (!intervention) return state
      const performed = new Set(state.performedInterventionIds)
      if (performed.has(intervention.id) && !intervention.repeatable) return state
      if (intervention.prerequisites.some((id) => !performed.has(id))) return state
      const simulation = executeCrrtInterventionEffects(state.simulation, intervention.effects)
      const interfaceState = syncEngineDeliveryToInterface(
        state.interfaceState,
        state.simulation,
        simulation,
      )
      return withDerivedCriticalErrors({
        ...state,
        simulation,
        interfaceState,
        performedInterventionIds: [...state.performedInterventionIds, intervention.id],
        reasoningPhase: 'run',
        timeline: appendTimeline(state, 'intervention-performed', intervention.id),
      })
    }
    case 'DEVICE_ACTION': {
      if (!canAct(state)) return state
      if (action.action.type === 'RESET_INTERFACE') {
        throw new Error('Reset the complete CRRT learning session instead of only the interface.')
      }
      const interfaceState = prismaxPilotInterfaceReducer(state.interfaceState, action.action)
      if (interfaceState === state.interfaceState) return state
      const simulation = syncInterfaceActionToEngine(
        state.interfaceState,
        interfaceState,
        state.simulation,
      )
      if (
        action.action.type === 'START_TREATMENT' &&
        interfaceState.treatmentState === 'running' &&
        simulation.device.deliveryState !== 'running'
      ) {
        return state
      }
      return withDerivedCriticalErrors({
        ...state,
        interfaceState,
        simulation,
        reasoningPhase: 'run',
        timeline: appendTimeline(state, 'device-action', action.action.type),
      })
    }
    case 'ADVANCE_TIME': {
      if (!canAct(state)) return state
      if (!Number.isFinite(action.seconds) || action.seconds < 0) {
        throw new RangeError('CRRT learning-session time advance must be finite and nonnegative.')
      }
      if (action.seconds === 0) return state
      const simulation = crrtSimulationReducer(state.simulation, {
        type: 'ADVANCE_TIME',
        seconds: action.seconds,
      })
      const interfaceState = syncEngineDeliveryToInterface(
        state.interfaceState,
        state.simulation,
        simulation,
      )
      return withDerivedCriticalErrors({
        ...state,
        simulation,
        interfaceState,
        reasoningPhase: state.performedInterventionIds.length > 0 ? 'reassess' : 'run',
        timeline: appendTimeline(state, 'time-advanced', String(action.seconds)),
      })
    }
    case 'USE_HINT': {
      if (state.experience === 'mastery' || state.debriefRevealed) return state
      const nextHint = state.caseDefinition.hintLadder
        .slice()
        .sort((left, right) => left.sequence - right.sequence)
        .find((hint) => !state.usedHintIds.includes(hint.id))
      if (!nextHint) return state
      return {
        ...state,
        usedHintIds: [...state.usedHintIds, nextHint.id],
        timeline: appendTimeline(state, 'hint-used', nextHint.id),
      }
    }
    case 'COMMIT_REASSESSMENT': {
      if (
        !canAct(state) ||
        state.performedInterventionIds.length === 0 ||
        state.reasoningPhase !== 'reassess' ||
        state.reassessment.committed
      ) {
        return state
      }
      const validIds = optionIds(state.caseDefinition.reassessmentOptions)
      const selected = uniqueIds(action.optionIds)
      if (selected.length === 0 || selected.some((id) => !validIds.has(id))) return state
      return {
        ...state,
        reassessment: Object.freeze({ committed: true, optionIds: selected }),
        reasoningPhase: 'reflect',
        timeline: appendTimeline(state, 'reassessment-committed', null),
      }
    }
    case 'REVEAL_DEBRIEF':
      if (!state.reassessment.committed || state.debriefRevealed) return state
      return {
        ...state,
        debriefRevealed: true,
        reasoningPhase: 'reflect',
        timeline: appendTimeline(state, 'debrief-revealed', null),
      }
    default:
      return assertNever(action)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled CRRT learning-session value: ${JSON.stringify(value)}`)
}
