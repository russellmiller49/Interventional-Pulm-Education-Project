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
import {
  crrtActionStartsDelivery,
  crrtUnmetMachineStepAssertions,
  selectCrrtMachineStartReadiness,
} from './setupWorkflow'
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
  | 'alarm-acknowledged'
  | 'time-advanced'
  | 'hint-used'
  | 'reassessment-committed'
  | 'debrief-revealed'

/** One parameter actually recorded with a timeline event, with its unit. */
export interface CrrtLearningTimelineDetail {
  readonly label: string
  readonly value: string
}

export interface CrrtLearningTimelineEntry {
  readonly sequence: number
  readonly atSeconds: number
  readonly type: CrrtLearningTimelineEventType
  readonly referenceId: string | null
  /**
   * Values recorded at the moment of the event. An entry without details was
   * recorded without values; a reader must say so rather than reconstruct them
   * from the final prescription or any later state.
   */
  readonly details?: readonly CrrtLearningTimelineDetail[]
  /**
   * Whether this dispatch changed the run. Entries recorded before an outcome
   * was tracked carry no value and must not be reported as either.
   */
  readonly outcome?: 'applied' | 'refused'
}

export interface CrrtLearningSessionState {
  readonly caseDefinition: RuntimeCrrtCase
  readonly fixture: CrrtEngineFixture
  readonly simulation: CrrtSimulationState
  readonly interfaceState: PrismaxPilotInterfaceState
  readonly experience: CrrtLearningExperience
  readonly persistenceEnabled: typeof CRRT_PROGRESS_PERSISTENCE_ENABLED
  readonly telemetryEnabled: typeof CRRT_TELEMETRY_ENABLED
  /** Content-owned capstone identity; null for every non-challenge session. */
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
  | { readonly type: 'SET_ROLE_LENS'; readonly roleLens: CrrtRoleLens }
  | {
      readonly type: 'ENTER_PRECOMMIT_REASONING_PHASE'
      readonly phase: CrrtPrecommitReasoningPhase
    }
  | { readonly type: 'COMMIT_PREDICTION'; readonly prediction: CrrtPredictionCommitment }
  | { readonly type: 'PERFORM_INTERVENTION'; readonly interventionId: string }
  | { readonly type: 'DEVICE_ACTION'; readonly action: PrismaxPilotInterfaceAction }
  | { readonly type: 'ACKNOWLEDGE_ALARM'; readonly alarmId: string }
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
  extra?: {
    readonly details?: readonly CrrtLearningTimelineDetail[]
    readonly outcome?: 'applied' | 'refused'
  },
): readonly CrrtLearningTimelineEntry[] {
  return [
    ...state.timeline,
    Object.freeze({
      sequence: state.timeline.length + 1,
      atSeconds: state.simulation.simulationTimeSeconds,
      type,
      referenceId,
      ...(extra?.details && extra.details.length > 0
        ? { details: Object.freeze([...extra.details]) }
        : {}),
      ...(extra?.outcome ? { outcome: extra.outcome } : {}),
    }),
  ]
}

const prismaxDraftFieldLabels: Readonly<
  Record<
    'bloodFlowMlMin' | 'dialysateFlowMlHour' | 'patientFluidRemovalMlHour',
    readonly [string, string]
  >
> = Object.freeze({
  bloodFlowMlMin: ['Blood flow', 'mL/min'],
  dialysateFlowMlHour: ['Dialysate flow', 'mL/h'],
  patientFluidRemovalMlHour: ['Patient fluid removal', 'mL/h'],
})

function formatTimelineSeconds(seconds: number): string {
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hr`
  if (seconds % 60 === 0) return `${seconds / 60} min`
  return `${seconds} sec`
}

const effectTargetLabels: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  'prescription.flows.bloodFlowMlMin': ['Blood flow', 'mL/min'],
  'prescription.flows.dialysateFlowMlHour': ['Dialysate flow', 'mL/h'],
  'prescription.flows.pbpFlowMlHour': ['Pre-blood-pump flow', 'mL/h'],
  'prescription.flows.preReplacementFlowMlHour': ['Pre-filter replacement', 'mL/h'],
  'prescription.flows.postReplacementFlowMlHour': ['Post-filter replacement', 'mL/h'],
  'prescription.flows.patientFluidRemovalMlHour': ['Patient fluid removal', 'mL/h'],
  'prescription.flows.syringeFlowMlHour': ['Syringe flow', 'mL/h'],
  'prescription.flows.makeupFlowMlHour': ['Makeup flow', 'mL/h'],
  'patient.bodyWeightKg': ['Entered body weight', 'kg'],
  'patient.hematocritFraction': ['Entered hematocrit', 'fraction'],
  'access.accessResistanceMmHgPerMlMin': ['Access resistance', 'mmHg per mL/min'],
  'access.returnResistanceMmHgPerMlMin': ['Return resistance', 'mmHg per mL/min'],
  'circuit.filter.procoagulantBurdenFraction': ['Procoagulant burden', 'fraction'],
  'circuit.filter.lowEffectiveBloodFlowFraction': ['Low effective blood flow', 'fraction'],
})

const effectOperationVerbs: Readonly<Record<string, string>> = Object.freeze({
  set: 'set to',
  add: 'changed by',
  multiply: 'multiplied by',
})

/**
 * The parameter changes an authored action carries. They come from the action
 * itself at the moment it is performed, never from the final prescription.
 */
function interventionDetails(
  effects: readonly CaseEffect[],
): readonly CrrtLearningTimelineDetail[] {
  const details: CrrtLearningTimelineDetail[] = []
  for (const effect of effects) {
    if (effect.valueType !== 'number') {
      if (effect.target === 'device.deliveryState') {
        details.push({ label: 'Treatment state', value: String(effect.value) })
      }
      continue
    }
    if (effect.target === 'simulation.advanceTimeSeconds') {
      details.push({
        label: 'Simulated time advanced',
        value: formatTimelineSeconds(effect.value),
      })
      continue
    }
    const descriptor = effectTargetLabels[effect.target]
    if (!descriptor) continue
    const verb = effectOperationVerbs[effect.operation] ?? 'changed to'
    details.push({
      label: descriptor[0],
      value: `${verb} ${effect.value} ${descriptor[1]}`,
    })
  }
  if (details.length === 0) {
    details.push({ label: 'Parameter change', value: 'None recorded for this action' })
  }
  return details
}

/** Values carried by the device action itself — never read back from later state. */
function deviceActionDetails(
  action: PrismaxPilotInterfaceAction,
): readonly CrrtLearningTimelineDetail[] {
  if (action.type === 'SET_PRESCRIPTION_VALUE') {
    const label = prismaxDraftFieldLabels[action.field]
    if (!label) return []
    return [
      {
        label: label[0],
        value: action.value === null ? 'Cleared' : `${action.value} ${label[1]}`,
      },
    ]
  }
  if (action.type === 'COMPLETE_SETUP_STEP') {
    const step = prismaxSetupSteps.find((candidate) => candidate.id === action.stepId)
    return [{ label: 'Setup step', value: step?.label ?? action.stepId }]
  }
  if (action.type === 'SELECT_CVVHD') {
    return [{ label: 'Therapy', value: 'CVVHD' }]
  }
  return []
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
    prescriptionInUse: committedPrescription,
    treatmentStarted: phase === 'operations' || phase === 'stop',
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
      'The CRRT challenge uses its content-owned capstone case with at least two problem domains.',
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

function canModifyRun(state: CrrtLearningSessionState): boolean {
  return !state.debriefRevealed
}

/** Opening a dialog or editing an uncommitted draft does not perform a run action. */
export function hasCrrtRunActivity(state: CrrtLearningSessionState): boolean {
  return state.timeline.some(
    (entry) =>
      entry.outcome !== 'refused' &&
      (entry.type === 'intervention-performed' ||
        entry.type === 'time-advanced' ||
        (entry.type === 'device-action' &&
          [
            'COMMIT_PRESCRIPTION',
            'START_PRIME',
            'COMPLETE_PRIME',
            'COMPLETE_SETUP_STEP',
            'START_TREATMENT',
            'END_TREATMENT',
          ].includes(entry.referenceId ?? ''))),
  )
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
  const before = previousSimulation.prescription
  const after = nextSimulation.prescription
  const changed =
    before.status !== after.status ||
    (before.status === 'configured' &&
      after.status === 'configured' &&
      (before.modality !== after.modality ||
        before.anticoagulation !== after.anticoagulation ||
        Object.keys(before.flows).some(
          (key) =>
            before.flows[key as keyof typeof before.flows] !==
            after.flows[key as keyof typeof after.flows],
        )))
  let next = previousInterface
  if (changed) {
    next = {
      ...next,
      prescriptionInUse: after.status === 'configured' ? after : null,
      prescriptionReviewStale:
        next.prescriptionReviewStale || next.completedStepIds.includes('review'),
    }
  }
  if (nextSimulation.device.deliveryState === previousSimulation.device.deliveryState) return next
  return {
    ...next,
    screen: 'operations',
    treatmentState: interfaceTreatmentStateForDeliveryState(nextSimulation.device.deliveryState),
    treatmentStarted: next.treatmentStarted || nextSimulation.device.deliveryState === 'running',
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
    case 'SET_ROLE_LENS': {
      // The role lens is a presentational choice. It must never restart the run,
      // so it changes only the lens itself — no fixture, time, prescription,
      // action history or reassessment is touched.
      if (action.roleLens === state.roleLens) return state
      if (!state.caseDefinition.roleLenses.includes(action.roleLens)) return state
      return {
        ...state,
        roleLens: action.roleLens,
        simulation: { ...state.simulation, roleLens: action.roleLens },
      }
    }
    case 'ENTER_PRECOMMIT_REASONING_PHASE': {
      if (state.prediction || state.debriefRevealed) return state
      if (action.phase === state.reasoningPhase) return state
      return { ...state, reasoningPhase: action.phase }
    }
    case 'COMMIT_PREDICTION': {
      if (state.prediction || state.debriefRevealed) return state
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
      if (!canModifyRun(state)) return state
      const intervention = state.caseDefinition.interventions.find(
        (candidate) => candidate.id === action.interventionId,
      )
      if (!intervention) return state
      const performed = new Set(state.performedInterventionIds)
      // A refused attempt is part of what actually happened in this run. It is
      // recorded on the session timeline only; nothing is persisted or scored.
      if (performed.has(intervention.id) && !intervention.repeatable) {
        return {
          ...state,
          timeline: appendTimeline(state, 'intervention-performed', intervention.id, {
            outcome: 'refused',
            details: [{ label: 'Refused because', value: 'it was already performed in this run' }],
          }),
        }
      }
      const missingPrerequisite = intervention.prerequisites.find((id) => !performed.has(id))
      if (missingPrerequisite !== undefined) {
        const prerequisite = state.caseDefinition.interventions.find(
          (candidate) => candidate.id === missingPrerequisite,
        )
        return {
          ...state,
          timeline: appendTimeline(state, 'intervention-performed', intervention.id, {
            outcome: 'refused',
            details: [
              {
                label: 'Refused because',
                value: `it requires ${prerequisite?.label ?? missingPrerequisite} first`,
              },
            ],
          }),
        }
      }
      // A case card cannot claim a machine step the facsimile has not recorded.
      // Prime, review and connection are completed on the device workflow; this
      // action only declares them, so an unmet declaration is refused rather
      // than written into the case as a completed step.
      const unmetAssertions = crrtUnmetMachineStepAssertions(intervention, state.interfaceState)
      if (unmetAssertions.length > 0) {
        return {
          ...state,
          timeline: appendTimeline(state, 'intervention-performed', intervention.id, {
            outcome: 'refused',
            details: [
              {
                label: 'Refused because',
                value: `the machine has not recorded ${unmetAssertions
                  .map((assertion) => assertion.label)
                  .join(
                    ' or ',
                  )}; complete ${unmetAssertions.length === 1 ? 'it' : 'them'} on the machine first`,
              },
            ],
          }),
        }
      }
      // No host or sidebar control may start delivery around the machine's own
      // start interlock. The facsimile's condition stays authoritative; this only
      // stops an authored effect from bypassing it. An action that resumes a run
      // already delivering bypasses nothing, so it is left alone.
      if (
        crrtActionStartsDelivery(intervention) &&
        state.interfaceState.treatmentState !== 'running'
      ) {
        const readiness = selectCrrtMachineStartReadiness(state.interfaceState)
        if (!readiness.ready) {
          return {
            ...state,
            timeline: appendTimeline(state, 'intervention-performed', intervention.id, {
              outcome: 'refused',
              details: [
                {
                  label: 'Refused because',
                  value: `the machine is not ready to start delivery: ${readiness.missing.join('; ')}`,
                },
              ],
            }),
          }
        }
      }
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
        timeline: appendTimeline(state, 'intervention-performed', intervention.id, {
          outcome: 'applied',
          details: interventionDetails(intervention.effects),
        }),
      })
    }
    case 'DEVICE_ACTION': {
      if (!canModifyRun(state)) return state
      if (action.action.type === 'RESET_INTERFACE') {
        throw new Error('Reset the complete CRRT learning session instead of only the interface.')
      }
      let interfaceState = prismaxPilotInterfaceReducer(state.interfaceState, action.action)
      const details = [
        ...deviceActionDetails(action.action),
        ...(interfaceState !== state.interfaceState &&
        action.action.type === 'COMPLETE_SETUP_STEP' &&
        action.action.stepId === 'review' &&
        state.simulation.prescription.status === 'configured'
          ? Object.entries(state.simulation.prescription.flows).map(([key, value]) => ({
              label: `Reviewed ${effectTargetLabels[`prescription.flows.${key}`]?.[0] ?? key}`,
              value: `${value} ${effectTargetLabels[`prescription.flows.${key}`]?.[1] ?? ''}`,
            }))
          : []),
      ]
      if (interfaceState === state.interfaceState) {
        return {
          ...state,
          timeline: appendTimeline(state, 'device-action', action.action.type, {
            outcome: 'refused',
            details,
          }),
        }
      }
      const simulation = syncInterfaceActionToEngine(
        state.interfaceState,
        interfaceState,
        state.simulation,
      )
      if (action.action.type === 'COMMIT_PRESCRIPTION') {
        interfaceState = {
          ...interfaceState,
          prescriptionInUse: interfaceState.committedPrescription,
        }
      }
      if (
        action.action.type === 'START_TREATMENT' &&
        interfaceState.treatmentState === 'running' &&
        simulation.device.deliveryState !== 'running'
      ) {
        return {
          ...state,
          timeline: appendTimeline(state, 'device-action', action.action.type, {
            outcome: 'refused',
            details: [
              { label: 'Refused because', value: 'the circuit was not ready to start treatment' },
            ],
          }),
        }
      }
      return withDerivedCriticalErrors({
        ...state,
        interfaceState,
        simulation,
        reasoningPhase: 'run',
        timeline: appendTimeline(state, 'device-action', action.action.type, {
          outcome: 'applied',
          details,
        }),
      })
    }
    case 'ACKNOWLEDGE_ALARM': {
      if (!canModifyRun(state)) return state
      const simulation = crrtSimulationReducer(state.simulation, action)
      if (simulation === state.simulation) return state
      return {
        ...state,
        simulation,
        timeline: appendTimeline(state, 'alarm-acknowledged', action.alarmId, {
          outcome: 'applied',
        }),
      }
    }
    case 'ADVANCE_TIME': {
      if (!canModifyRun(state)) return state
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
        timeline: appendTimeline(state, 'time-advanced', String(action.seconds), {
          outcome: 'applied',
          details: [{ label: 'Elapsed', value: formatTimelineSeconds(action.seconds) }],
        }),
      })
    }
    case 'USE_HINT': {
      if (state.debriefRevealed) return state
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
      if (state.debriefRevealed || state.reassessment.committed || !hasCrrtRunActivity(state)) {
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
      if (state.debriefRevealed) return state
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
