import {
  crrtCircuitNode,
  crrtPressureSignalDetails,
  type CrrtCircuitNodeId,
  type CrrtPressureSignalDetail,
  type CrrtPressureSignalId,
  type CrrtPressureSignalKind,
} from '../../content/circuitModel'
import { prismaxDeviceProfile } from '../../content/deviceProfiles'
import { CRRT_TREND_INTERVAL_SECONDS } from '../simulation'
import { prismaxCalculationAdapter } from './calculations'
import type {
  CrrtDeviceAdapter,
  DeviceValidationResult,
  DisplayAlarm,
  SetupStepDefinition,
} from './types'
import {
  crrtFlowRateKeys,
  type ActiveAlarm,
  type ConfiguredPrescriptionState,
  type CrrtDeviceState,
  type CrrtFlowRates,
  type CrrtModality,
  type CrrtPressureState,
  type CrrtSimulationState,
  type PrescriptionState,
  type TrendSample,
} from '../types'

export const PRISMAX_SETUP_SOURCE_ID = 'DEV-PM-005' as const

const setupStep = <const Id extends string>(id: Id, label: string) =>
  Object.freeze({
    id,
    label,
    sourceIds: Object.freeze([PRISMAX_SETUP_SOURCE_ID]),
    reviewStatus: 'pending' as const,
  }) satisfies SetupStepDefinition

export const prismaxSetupSteps = Object.freeze([
  setupStep('patient', 'Patient'),
  setupStep('therapy', 'Therapy'),
  setupStep('prescription', 'Prescription'),
  setupStep('sets', 'Sets'),
  setupStep('fluids', 'Fluids'),
  setupStep('prime', 'Prime'),
  setupStep('review', 'Review'),
  setupStep('connect-patient', 'Connect Patient'),
] as const)

export type PrismaxSetupStepId = (typeof prismaxSetupSteps)[number]['id']

export const prismaxStartOptions = Object.freeze([
  Object.freeze({
    id: 'new-patient' as const,
    label: 'New Patient',
    available: true as const,
    availabilityNote: null,
  }),
  Object.freeze({
    id: 'same-patient' as const,
    label: 'Same Patient',
    available: false as const,
    availabilityNote: 'Unavailable because the source timing expression is unresolved.',
  }),
])

const validationSourceIds = Object.freeze([PRISMAX_SETUP_SOURCE_ID])

function validationError(code: string, message: string) {
  return Object.freeze({
    code,
    message,
    sourceIds: validationSourceIds,
    reviewStatus: 'pending' as const,
  })
}

function isFiniteNonnegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

export function validatePrismaxPrescription(input: PrescriptionState): DeviceValidationResult {
  const errors: ReturnType<typeof validationError>[] = []

  if (input.status !== 'configured') {
    errors.push(validationError('PRESCRIPTION_REQUIRED', 'Complete the prescription first.'))
    return Object.freeze({ valid: false, errors: Object.freeze(errors) })
  }

  for (const field of crrtFlowRateKeys) {
    const value = input.flows[field]
    if (!isFiniteNonnegative(value)) {
      errors.push(
        validationError('INVALID_FLOW_VALUE', `${field} must be a finite, nonnegative value.`),
      )
    }
  }

  if (!(input.flows.bloodFlowMlMin > 0)) {
    errors.push(validationError('BLOOD_FLOW_REQUIRED', 'Enter blood flow before continuing.'))
  }
  const replacementFlow =
    input.flows.preReplacementFlowMlHour + input.flows.postReplacementFlowMlHour
  if (
    (input.modality === 'cvvhd' || input.modality === 'cvvhdf') &&
    !(input.flows.dialysateFlowMlHour > 0)
  ) {
    errors.push(validationError('DIALYSATE_REQUIRED', 'This modality requires dialysate flow.'))
  }
  if ((input.modality === 'cvvh' || input.modality === 'cvvhdf') && !(replacementFlow > 0)) {
    errors.push(
      validationError('REPLACEMENT_REQUIRED', 'This modality requires replacement-fluid flow.'),
    )
  }
  if (input.anticoagulation !== 'none') {
    errors.push(
      validationError(
        'CLINICAL_PROTOCOL_REQUIRED',
        'Medication workflows require a separate authorized local protocol; this adapter provides conceptual verification only.',
      ),
    )
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) })
}

function createInitialPrismaxDeviceState(): CrrtDeviceState {
  return {
    deliveryState: 'idle',
    bloodPumpRunning: false,
    fluidPumpsRunning: false,
    patientConnected: false,
    returnClampClosed: true,
    adapterStatus: 'operational-v1',
  }
}

function mapPrismaxEngineAlarm(alarm: ActiveAlarm): DisplayAlarm {
  return Object.freeze({
    engineAlarmId: alarm.id,
    code: alarm.code,
    label: `Engine alarm: ${alarm.code}`,
    priorityLabel: 'Device mapping pending',
    mappingReviewStatus: 'pending',
  })
}

export const prismaxDeviceAdapter = Object.freeze({
  id: 'prismax-aw8035-2xx',
  runtimeStatus: 'operational-v1',
  profile: prismaxDeviceProfile,
  createInitialDeviceState: createInitialPrismaxDeviceState,
  getSetupSteps() {
    return prismaxSetupSteps
  },
  validatePrescription: validatePrismaxPrescription,
  reduceDeviceAction(state, action, context) {
    void context
    if (action.type === 'ACKNOWLEDGE_ALARM' || state.deliveryState === 'ended') return state
    const deliveryState = action.deliveryState
    const running = deliveryState === 'running'
    return {
      ...state,
      deliveryState,
      bloodPumpRunning: running,
      fluidPumpsRunning: running,
      patientConnected: running ? true : state.patientConnected,
      returnClampClosed: running ? false : state.returnClampClosed,
    }
  },
  mapEngineAlarm: mapPrismaxEngineAlarm,
  selectDisplayModel(state) {
    return Object.freeze({
      deviceId: 'prismax-aw8035-2xx' as const,
      deliveryState: state.device.deliveryState,
      adapterStatus: state.device.adapterStatus,
      alarms: Object.freeze(state.alarms.map(mapPrismaxEngineAlarm)),
      navigationParadigm: 'procedure-workflow' as const,
      scaleLayout: Object.freeze(['Effluent', 'PBP', 'Dialysate', 'Replacement']),
      displayedCalculationContexts: Object.freeze([
        'Effluent pump target',
        'Effluent dose section',
        'TMP',
        'Filter pressure drop',
      ]),
      historyAvailable: true as const,
      stopEndOptions: Object.freeze([
        'Pause treatment',
        'End treatment',
        'Frame blood disposition using device instructions and local policy',
      ]),
    })
  },
} satisfies CrrtDeviceAdapter)

export interface PrismaxPrescriptionDraft {
  readonly bloodFlowMlMin: number | null
  readonly dialysateFlowMlHour: number | null
  readonly patientFluidRemovalMlHour: number | null
}

export interface PrismaxPilotInterfaceState {
  readonly version: 1
  readonly screen: 'start' | 'setup' | 'operations'
  readonly startSelection: 'new-patient' | null
  /**
   * The learner-facing pilot reducer can still select only CVVHD. The wider
   * type lets an authored learning case project its already
   * configured modality without pretending that the pilot setup UI supports
   * selecting that modality.
   */
  readonly selectedModality: CrrtModality | null
  readonly completedStepIds: readonly PrismaxSetupStepId[]
  readonly prescriptionDraft: PrismaxPrescriptionDraft
  readonly committedPrescription: ConfiguredPrescriptionState | null
  readonly primeState: 'not-started' | 'in-progress' | 'complete'
  readonly treatmentState: 'idle' | 'running' | 'ended'
  readonly stopDialogOpen: boolean
}

export type PrismaxPrescriptionDraftField = keyof PrismaxPrescriptionDraft

export type PrismaxPilotInterfaceAction =
  | { readonly type: 'SELECT_NEW_PATIENT' }
  | { readonly type: 'SELECT_CVVHD' }
  | {
      readonly type: 'SET_PRESCRIPTION_VALUE'
      readonly field: PrismaxPrescriptionDraftField
      readonly value: number | null
    }
  | { readonly type: 'COMMIT_PRESCRIPTION' }
  | { readonly type: 'START_PRIME' }
  | { readonly type: 'COMPLETE_PRIME' }
  | { readonly type: 'COMPLETE_SETUP_STEP'; readonly stepId: PrismaxSetupStepId }
  | { readonly type: 'START_TREATMENT' }
  | { readonly type: 'OPEN_STOP_DIALOG' }
  | { readonly type: 'CLOSE_STOP_DIALOG' }
  | { readonly type: 'END_TREATMENT' }
  | { readonly type: 'RESET_INTERFACE' }

export interface PrismaxPilotStepStatus {
  readonly step: SetupStepDefinition
  readonly status: 'complete' | 'current' | 'pending'
}

export interface PrismaxPilotInterfaceViewModel {
  readonly activeStep: SetupStepDefinition | null
  readonly stepStatuses: readonly PrismaxPilotStepStatus[]
  readonly canSetDialysateAndPatientFluidRemoval: boolean
  readonly canCommitPrescription: boolean
  readonly canStartTreatment: boolean
  readonly newPatientAvailable: true
  readonly samePatientAvailable: false
}

/**
 * Why a value is or is not a live model output. There is no per-site sensor
 * fault in this engine: `derivePressures` writes all six pressures together, so
 * "unavailable" is always a whole-model statement, never one bad transducer.
 */
export type CrrtPressureAvailability = 'live-model-value' | 'no-pressure-model' | 'no-case-attached'

/**
 * Whether the engine actually recorded this quantity over time. `TrendSample`
 * carries access, filter, return, and TMP — it does not carry effluent pressure
 * or filter pressure drop. Those two are current values only, and saying so is
 * the honest answer rather than rebuilding a series the engine never observed.
 */
export type CrrtPressureHistoryAvailability = 'sampled' | 'not-recorded'

export interface CrrtDevicePressureSample {
  readonly timeSeconds: number
  readonly valueMmHg: number | null
}

export interface CrrtDevicePressureValueDomain {
  readonly minMmHg: number
  readonly maxMmHg: number
}

/**
 * One pressure channel, fully described. Everything a surface needs to render
 * the value, say what kind of quantity it is, point at the circuit, and state
 * what is missing — with no arithmetic left for the component to do.
 */
export interface CrrtDevicePressureSignalView {
  readonly id: CrrtPressureSignalId
  readonly label: string
  readonly kind: CrrtPressureSignalKind
  readonly valueMmHg: number | null
  readonly unit: 'mmHg'
  readonly availability: CrrtPressureAvailability
  readonly unavailableReason: string | null
  /** The circuit node this value is read at. Null for calculated relationships. */
  readonly nodeId: CrrtCircuitNodeId | null
  /** Nodes a calculated relationship is computed from. Empty for modelled sites. */
  readonly derivedFromNodeIds: readonly CrrtCircuitNodeId[]
  readonly derivedFromSignalIds: readonly CrrtPressureSignalId[]
  /** Node labels, so a component never has to resolve circuit geometry itself. */
  readonly contributingSiteLabels: readonly string[]
  readonly history: readonly CrrtDevicePressureSample[]
  readonly historyAvailability: CrrtPressureHistoryAvailability
  readonly historyUnavailableReason: string | null
  /** Supplied so a component plots geometry rather than deciding a scale. */
  readonly historyValueDomainMmHg: CrrtDevicePressureValueDomain | null
  readonly sourceIds: readonly string[]
}

/**
 * Enough current context to read the pressure profile. Deliberately not a
 * console: no menu state, no alarm limits, no operating sequence.
 */
export interface CrrtDeviceTreatmentContextView {
  readonly deliveryState: CrrtDeviceState['deliveryState']
  readonly treatmentState: PrismaxPilotInterfaceState['treatmentState']
  readonly bloodPumpRunning: boolean
  readonly modality: CrrtModality | null
  readonly bloodFlowMlMin: number | null
  readonly dialysateFlowMlHour: number | null
  readonly preReplacementFlowMlHour: number | null
  readonly postReplacementFlowMlHour: number | null
  readonly patientFluidRemovalMlHour: number | null
  /**
   * Mirrors the engine's own gate: blood flow reaches the pressure model only
   * while the pump is running and both lumens are connected. Without this a
   * surface cannot tell a stopped circuit from a running one, because the
   * engine keeps publishing plausible zero-flow numbers either way.
   */
  readonly bloodFlowContributesToPressures: boolean
  readonly accessConnected: boolean
  readonly returnConnected: boolean
  readonly simulationTimeSeconds: number
  readonly cumulativeDowntimeSeconds: number
  readonly historyIntervalSeconds: number
  readonly historyTimeDomainSeconds: Readonly<{ startSeconds: number; endSeconds: number }> | null
}

export interface PrismaxPilotOperationsDisplay {
  readonly treatmentState: PrismaxPilotInterfaceState['treatmentState']
  readonly modality: CrrtModality | null
  readonly flows: CrrtFlowRates | null
  readonly effluentPumpTargetMlHour: number | null
  readonly effluentDoseMlKgHour: number | null
  readonly deliveredDoseMlKgHour: number | null
  readonly cumulativeMachinePatientFluidRemovalMl: number | null
  readonly cumulativeWholePatientBalanceMl: number | null
  readonly activeAlarmCodes: readonly string[]
  readonly pressures: Readonly<{
    accessPressureMmHg: number | null
    filterPressureMmHg: number | null
    returnPressureMmHg: number | null
    effluentPressureMmHg: number | null
    transmembranePressureMmHg: number | null
    filterPressureDropMmHg: number | null
  }>
  /** The six channels above, described. Same numbers, never recomputed. */
  readonly pressureSignals: readonly CrrtDevicePressureSignalView[]
  readonly treatmentContext: CrrtDeviceTreatmentContextView
}

const blankPrescriptionDraft = (): PrismaxPrescriptionDraft => ({
  bloodFlowMlMin: null,
  dialysateFlowMlHour: null,
  patientFluidRemovalMlHour: null,
})

export function createInitialPrismaxPilotInterfaceState(): PrismaxPilotInterfaceState {
  return {
    version: 1,
    screen: 'start',
    startSelection: null,
    selectedModality: null,
    completedStepIds: [],
    prescriptionDraft: blankPrescriptionDraft(),
    committedPrescription: null,
    primeState: 'not-started',
    treatmentState: 'idle',
    stopDialogOpen: false,
  }
}

function activeSetupStep(state: PrismaxPilotInterfaceState): SetupStepDefinition | null {
  return prismaxSetupSteps[state.completedStepIds.length] ?? null
}

function isActiveSetupStep(state: PrismaxPilotInterfaceState, stepId: PrismaxSetupStepId): boolean {
  return activeSetupStep(state)?.id === stepId
}

function canCompleteActiveSetupStep(
  state: PrismaxPilotInterfaceState,
  stepId: PrismaxSetupStepId,
): boolean {
  if (!isActiveSetupStep(state, stepId)) return false
  if (stepId === 'patient') return state.startSelection === 'new-patient'
  if (stepId === 'therapy') return state.selectedModality === 'cvvhd'
  if (stepId === 'prescription') return state.committedPrescription !== null
  if (stepId === 'prime') return state.primeState === 'complete'
  return true
}

function canSetDownstreamPrescriptionValues(state: PrismaxPilotInterfaceState): boolean {
  return (
    isActiveSetupStep(state, 'prescription') &&
    state.prescriptionDraft.bloodFlowMlMin !== null &&
    state.prescriptionDraft.bloodFlowMlMin > 0
  )
}

export function canCommitPrismaxPrescriptionDraft(draft: PrismaxPrescriptionDraft): boolean {
  return (
    draft.bloodFlowMlMin !== null &&
    Number.isFinite(draft.bloodFlowMlMin) &&
    draft.bloodFlowMlMin > 0 &&
    draft.dialysateFlowMlHour !== null &&
    Number.isFinite(draft.dialysateFlowMlHour) &&
    draft.dialysateFlowMlHour > 0 &&
    (draft.patientFluidRemovalMlHour === null ||
      isFiniteNonnegative(draft.patientFluidRemovalMlHour))
  )
}

function configuredPrescriptionFromDraft(
  draft: PrismaxPrescriptionDraft,
): ConfiguredPrescriptionState | null {
  if (!canCommitPrismaxPrescriptionDraft(draft)) return null
  return {
    status: 'configured',
    modality: 'cvvhd',
    flows: {
      bloodFlowMlMin: draft.bloodFlowMlMin!,
      dialysateFlowMlHour: draft.dialysateFlowMlHour!,
      patientFluidRemovalMlHour: draft.patientFluidRemovalMlHour ?? 0,
      pbpFlowMlHour: 0,
      preReplacementFlowMlHour: 0,
      postReplacementFlowMlHour: 0,
      syringeFlowMlHour: 0,
      makeupFlowMlHour: 0,
    },
    anticoagulation: 'none',
    reviewStatus: 'pending',
    sourceIds: [...prismaxCalculationAdapter.sourceIds.effluentPumpTarget],
  }
}

export function canStartPrismaxTreatment(state: PrismaxPilotInterfaceState): boolean {
  return (
    state.treatmentState === 'idle' &&
    state.completedStepIds.length === prismaxSetupSteps.length &&
    state.committedPrescription !== null &&
    state.primeState === 'complete'
  )
}

export function prismaxPilotInterfaceReducer(
  state: PrismaxPilotInterfaceState,
  action: PrismaxPilotInterfaceAction,
): PrismaxPilotInterfaceState {
  if (action.type === 'RESET_INTERFACE') return createInitialPrismaxPilotInterfaceState()
  if (state.treatmentState === 'ended') return state

  switch (action.type) {
    case 'SELECT_NEW_PATIENT':
      if (state.screen !== 'start') return state
      return { ...state, screen: 'setup', startSelection: 'new-patient' }
    case 'SELECT_CVVHD':
      if (!isActiveSetupStep(state, 'therapy')) return state
      return { ...state, selectedModality: 'cvvhd' }
    case 'SET_PRESCRIPTION_VALUE': {
      if (!isActiveSetupStep(state, 'prescription')) return state
      if (action.value !== null && !isFiniteNonnegative(action.value)) return state
      if (action.field !== 'bloodFlowMlMin' && !canSetDownstreamPrescriptionValues(state)) {
        return state
      }
      const clearingBloodFlow =
        action.field === 'bloodFlowMlMin' && (action.value === null || action.value === 0)
      return {
        ...state,
        prescriptionDraft: clearingBloodFlow
          ? {
              bloodFlowMlMin: action.value,
              dialysateFlowMlHour: null,
              patientFluidRemovalMlHour: null,
            }
          : { ...state.prescriptionDraft, [action.field]: action.value },
        committedPrescription: null,
      }
    }
    case 'COMMIT_PRESCRIPTION': {
      if (!isActiveSetupStep(state, 'prescription') || state.selectedModality !== 'cvvhd') {
        return state
      }
      const committedPrescription = configuredPrescriptionFromDraft(state.prescriptionDraft)
      return committedPrescription ? { ...state, committedPrescription } : state
    }
    case 'START_PRIME':
      if (!isActiveSetupStep(state, 'prime') || state.primeState !== 'not-started') return state
      return { ...state, primeState: 'in-progress' }
    case 'COMPLETE_PRIME':
      if (!isActiveSetupStep(state, 'prime') || state.primeState !== 'in-progress') return state
      return { ...state, primeState: 'complete' }
    case 'COMPLETE_SETUP_STEP':
      if (!canCompleteActiveSetupStep(state, action.stepId)) return state
      return { ...state, completedStepIds: [...state.completedStepIds, action.stepId] }
    case 'START_TREATMENT':
      if (!canStartPrismaxTreatment(state)) return state
      return { ...state, screen: 'operations', treatmentState: 'running' }
    case 'OPEN_STOP_DIALOG':
      return state.treatmentState === 'running' ? { ...state, stopDialogOpen: true } : state
    case 'CLOSE_STOP_DIALOG':
      return state.stopDialogOpen ? { ...state, stopDialogOpen: false } : state
    case 'END_TREATMENT':
      return state.treatmentState === 'running' && state.stopDialogOpen
        ? { ...state, treatmentState: 'ended', stopDialogOpen: false }
        : state
    default:
      return assertNever(action)
  }
}

export function selectPrismaxPilotInterface(
  state: PrismaxPilotInterfaceState,
): PrismaxPilotInterfaceViewModel {
  const completed = new Set(state.completedStepIds)
  const activeStep = activeSetupStep(state)
  return Object.freeze({
    activeStep,
    stepStatuses: Object.freeze(
      prismaxSetupSteps.map((step) =>
        Object.freeze({
          step,
          status: completed.has(step.id)
            ? ('complete' as const)
            : step.id === activeStep?.id
              ? ('current' as const)
              : ('pending' as const),
        }),
      ),
    ),
    canSetDialysateAndPatientFluidRemoval: canSetDownstreamPrescriptionValues(state),
    canCommitPrescription:
      isActiveSetupStep(state, 'prescription') &&
      state.selectedModality === 'cvvhd' &&
      canCommitPrismaxPrescriptionDraft(state.prescriptionDraft),
    canStartTreatment: canStartPrismaxTreatment(state),
    newPatientAvailable: true as const,
    samePatientAvailable: false as const,
  })
}

const nullPressures: PrismaxPilotOperationsDisplay['pressures'] = Object.freeze({
  accessPressureMmHg: null,
  filterPressureMmHg: null,
  returnPressureMmHg: null,
  effluentPressureMmHg: null,
  transmembranePressureMmHg: null,
  filterPressureDropMmHg: null,
})

/* ------------------------------------------------------------------ *
 * Pressure-profile projection
 *
 * Every number below is read straight off engine state. Nothing here
 * recalculates a pressure: TMP and filter pressure drop are already
 * display-corrected on `circuit.pressures`, and recomputing either one would
 * drop or double-apply the device display offset.
 * ------------------------------------------------------------------ */

/** Which engine pressure field carries each signal. */
const pressureFieldBySignalId: Readonly<Record<CrrtPressureSignalId, keyof CrrtPressureState>> =
  Object.freeze({
    access: 'accessPressureMmHg',
    filter: 'filterPressureMmHg',
    return: 'returnPressureMmHg',
    effluent: 'effluentPressureMmHg',
    tmp: 'prismaxTransmembranePressureMmHg',
    'filter-drop': 'prismaxFilterPressureDropMmHg',
  })

/**
 * Which recorded sample field carries each signal. `TrendSample` records four
 * of the six. Effluent pressure and filter pressure drop are deliberately null
 * here: the engine never wrote them to the trend record, and reconstructing
 * them would present derived points as observations.
 */
const trendFieldBySignalId: Readonly<Record<CrrtPressureSignalId, keyof TrendSample | null>> =
  Object.freeze({
    access: 'accessPressureMmHg',
    filter: 'filterPressureMmHg',
    return: 'returnPressureMmHg',
    effluent: null,
    tmp: 'transmembranePressureMmHg',
    'filter-drop': null,
  })

const NO_HISTORY_REASON =
  'Not kept over time by this model. The recorded history covers access, filter, return, and TMP; this channel is a current value only.'

const NO_PRESSURE_MODEL_REASON =
  'This case has no pressure model loaded, so no site is being modelled. Every pressure reads as unavailable together — this is not a single failed sensor, and it is not a reading of zero.'

const NO_CASE_REASON =
  'No case is attached, so the model is not producing pressures. This is not a reading of zero.'

/** Signal that owns each circuit node, so a relationship can name its sources. */
const signalIdByNodeId: ReadonlyMap<CrrtCircuitNodeId, CrrtPressureSignalId> = new Map(
  crrtPressureSignalDetails
    .filter(
      (detail): detail is CrrtPressureSignalDetail & { nodeId: CrrtCircuitNodeId } =>
        detail.nodeId !== null,
    )
    .map((detail) => [detail.nodeId, detail.id]),
)

function valueDomain(values: readonly number[]): CrrtDevicePressureValueDomain | null {
  if (values.length === 0) return null
  return Object.freeze({ minMmHg: Math.min(...values), maxMmHg: Math.max(...values) })
}

function pressureSignalView(
  detail: CrrtPressureSignalDetail,
  valueMmHg: number | null,
  availability: CrrtPressureAvailability,
  trends: readonly TrendSample[],
): CrrtDevicePressureSignalView {
  const trendField = trendFieldBySignalId[detail.id]
  const history =
    trendField === null
      ? []
      : trends.map((sample) =>
          Object.freeze({
            timeSeconds: sample.timeSeconds,
            valueMmHg: sample[trendField] as number | null,
          }),
        )
  const observed = history
    .map((sample) => sample.valueMmHg)
    .filter((value): value is number => value !== null)

  return Object.freeze({
    id: detail.id,
    label: detail.label,
    kind: detail.kind,
    valueMmHg,
    unit: 'mmHg' as const,
    availability,
    unavailableReason:
      availability === 'live-model-value'
        ? null
        : availability === 'no-case-attached'
          ? NO_CASE_REASON
          : NO_PRESSURE_MODEL_REASON,
    nodeId: detail.nodeId,
    derivedFromNodeIds: detail.derivedFromNodeIds,
    derivedFromSignalIds: Object.freeze(
      detail.derivedFromNodeIds
        .map((nodeId) => signalIdByNodeId.get(nodeId))
        .filter((id): id is CrrtPressureSignalId => id !== undefined),
    ),
    contributingSiteLabels: Object.freeze(
      detail.derivedFromNodeIds.map((nodeId) => crrtCircuitNode(nodeId).label),
    ),
    history: Object.freeze(history),
    historyAvailability: trendField === null ? ('not-recorded' as const) : ('sampled' as const),
    historyUnavailableReason: trendField === null ? NO_HISTORY_REASON : null,
    historyValueDomainMmHg: valueDomain(observed),
    sourceIds: detail.sourceIds,
  })
}

function pressureSignalViews(
  pressures: CrrtPressureState | null,
  trends: readonly TrendSample[],
): readonly CrrtDevicePressureSignalView[] {
  return Object.freeze(
    crrtPressureSignalDetails.map((detail) => {
      const value = pressures ? pressures[pressureFieldBySignalId[detail.id]] : null
      const availability: CrrtPressureAvailability =
        pressures === null
          ? 'no-case-attached'
          : value === null
            ? 'no-pressure-model'
            : 'live-model-value'
      return pressureSignalView(
        detail,
        typeof value === 'number' ? value : null,
        availability,
        trends,
      )
    }),
  )
}

function historyTimeDomain(
  trends: readonly TrendSample[],
): CrrtDeviceTreatmentContextView['historyTimeDomainSeconds'] {
  const first = trends.at(0)
  const last = trends.at(-1)
  if (!first || !last || first.timeSeconds === last.timeSeconds) return null
  return Object.freeze({ startSeconds: first.timeSeconds, endSeconds: last.timeSeconds })
}

export function selectPrismaxPilotOperationsDisplay(
  state: PrismaxPilotInterfaceState,
): PrismaxPilotOperationsDisplay {
  const prescription = state.committedPrescription
  return Object.freeze({
    treatmentState: state.treatmentState,
    modality: prescription?.modality ?? null,
    flows: prescription ? { ...prescription.flows } : null,
    effluentPumpTargetMlHour: prescription
      ? prismaxCalculationAdapter.calculateEffluentPumpTargetMlPerHour(prescription.flows)
      : null,
    effluentDoseMlKgHour: null,
    deliveredDoseMlKgHour: null,
    cumulativeMachinePatientFluidRemovalMl: null,
    cumulativeWholePatientBalanceMl: null,
    activeAlarmCodes: Object.freeze([]),
    pressures: nullPressures,
    pressureSignals: pressureSignalViews(null, []),
    treatmentContext: Object.freeze({
      deliveryState: state.treatmentState === 'running' ? ('running' as const) : ('idle' as const),
      treatmentState: state.treatmentState,
      bloodPumpRunning: false,
      modality: prescription?.modality ?? null,
      bloodFlowMlMin: prescription?.flows.bloodFlowMlMin ?? null,
      dialysateFlowMlHour: prescription?.flows.dialysateFlowMlHour ?? null,
      preReplacementFlowMlHour: prescription?.flows.preReplacementFlowMlHour ?? null,
      postReplacementFlowMlHour: prescription?.flows.postReplacementFlowMlHour ?? null,
      patientFluidRemovalMlHour: prescription?.flows.patientFluidRemovalMlHour ?? null,
      bloodFlowContributesToPressures: false,
      accessConnected: false,
      returnConnected: false,
      simulationTimeSeconds: 0,
      cumulativeDowntimeSeconds: 0,
      historyIntervalSeconds: CRRT_TREND_INTERVAL_SECONDS,
      historyTimeDomainSeconds: null,
    }),
  })
}

/** Projects the shared case engine onto the narrow, source-mapped PrisMax pilot display. */
export function selectPrismaxPilotCaseOperationsDisplay(
  interfaceState: PrismaxPilotInterfaceState,
  simulation: CrrtSimulationState,
): PrismaxPilotOperationsDisplay {
  const prescription = simulation.prescription
  const pressure = simulation.circuit.pressures
  const access = simulation.access
  const accessConnected = access.status === 'configured' && access.accessConnected
  const returnConnected = access.status === 'configured' && access.returnConnected
  const flows = simulation.circuit.flows
  return Object.freeze({
    treatmentState: interfaceState.treatmentState,
    modality: prescription.status === 'configured' ? prescription.modality : null,
    flows: prescription.status === 'configured' ? { ...prescription.flows } : null,
    effluentPumpTargetMlHour: simulation.deliveredTherapy.prescribedEffluentRateMlHour,
    effluentDoseMlKgHour: simulation.deliveredTherapy.prescribedEffluentDoseMlKgHour,
    deliveredDoseMlKgHour: simulation.deliveredTherapy.deliveredDoseMlKgHour,
    cumulativeMachinePatientFluidRemovalMl:
      simulation.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl,
    cumulativeWholePatientBalanceMl: simulation.deliveredTherapy.cumulativeWholePatientBalanceMl,
    activeAlarmCodes: Object.freeze(
      simulation.alarms.filter((alarm) => alarm.active).map((alarm) => alarm.code),
    ),
    pressures: Object.freeze({
      accessPressureMmHg: pressure.accessPressureMmHg,
      filterPressureMmHg: pressure.filterPressureMmHg,
      returnPressureMmHg: pressure.returnPressureMmHg,
      effluentPressureMmHg: pressure.effluentPressureMmHg,
      transmembranePressureMmHg: pressure.prismaxTransmembranePressureMmHg,
      filterPressureDropMmHg: pressure.prismaxFilterPressureDropMmHg,
    }),
    pressureSignals: pressureSignalViews(pressure, simulation.trends),
    treatmentContext: Object.freeze({
      deliveryState: simulation.device.deliveryState,
      treatmentState: interfaceState.treatmentState,
      bloodPumpRunning: simulation.device.bloodPumpRunning,
      modality: prescription.status === 'configured' ? prescription.modality : null,
      bloodFlowMlMin: flows.bloodFlowMlMin,
      dialysateFlowMlHour: flows.dialysateFlowMlHour,
      preReplacementFlowMlHour: flows.preReplacementFlowMlHour,
      postReplacementFlowMlHour: flows.postReplacementFlowMlHour,
      patientFluidRemovalMlHour: flows.patientFluidRemovalMlHour,
      // The engine's own gate, mirrored rather than re-derived: simulation.ts
      // feeds blood flow into the pressure model only under these three.
      bloodFlowContributesToPressures:
        simulation.device.bloodPumpRunning && accessConnected && returnConnected,
      accessConnected,
      returnConnected,
      simulationTimeSeconds: simulation.simulationTimeSeconds,
      cumulativeDowntimeSeconds: simulation.deliveredTherapy.cumulativeDowntimeSeconds,
      historyIntervalSeconds: CRRT_TREND_INTERVAL_SECONDS,
      historyTimeDomainSeconds: historyTimeDomain(simulation.trends),
    }),
  })
}

function assertNever(value: never): never {
  throw new Error(`Unhandled PrisMax interface action: ${JSON.stringify(value)}`)
}
