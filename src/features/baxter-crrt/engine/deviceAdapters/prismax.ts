import { prismaxDraftDeviceProfile } from '../../content/deviceProfiles'
import { prismaxCalculationAdapter } from './calculations'
import type {
  CrrtDeviceAdapter,
  DeviceValidationResult,
  DisplayAlarm,
  SetupStepDefinition,
} from './types'
import type {
  ActiveAlarm,
  ConfiguredPrescriptionState,
  CrrtDeviceState,
  CrrtFlowRates,
  CrrtSimulationState,
  PrescriptionState,
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
    availabilityNote: 'Not available in the Phase 3 pilot interface.',
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

function validatePrismaxPilotPrescription(input: PrescriptionState): DeviceValidationResult {
  const errors: ReturnType<typeof validationError>[] = []

  if (input.status !== 'configured') {
    errors.push(validationError('PRESCRIPTION_REQUIRED', 'Complete the pilot prescription first.'))
    return Object.freeze({ valid: false, errors: Object.freeze(errors) })
  }

  if (input.modality !== 'cvvhd') {
    errors.push(
      validationError('PILOT_MODALITY_ONLY', 'Only CVVHD is available in the Phase 3 pilot.'),
    )
  }

  const flowEntries = Object.entries(input.flows) as [keyof CrrtFlowRates, number][]
  for (const [field, value] of flowEntries) {
    if (!isFiniteNonnegative(value)) {
      errors.push(
        validationError(
          'INVALID_FLOW_VALUE',
          `${field} must be a finite, nonnegative value for this interface pilot.`,
        ),
      )
    }
  }

  if (!(input.flows.bloodFlowMlMin > 0)) {
    errors.push(validationError('BLOOD_FLOW_REQUIRED', 'Enter blood flow before continuing.'))
  }
  if (!(input.flows.dialysateFlowMlHour > 0)) {
    errors.push(validationError('DIALYSATE_REQUIRED', 'Enter dialysate flow before continuing.'))
  }
  if (
    input.flows.pbpFlowMlHour !== 0 ||
    input.flows.preReplacementFlowMlHour !== 0 ||
    input.flows.postReplacementFlowMlHour !== 0 ||
    input.flows.syringeFlowMlHour !== 0 ||
    input.flows.makeupFlowMlHour !== 0
  ) {
    errors.push(
      validationError(
        'PILOT_FLOW_TERMS_DISABLED',
        'PBP, replacement, syringe, and makeup flows remain unavailable in this pilot.',
      ),
    )
  }
  if (input.anticoagulation !== 'none' || input.citrateRequestedButDisabled) {
    errors.push(
      validationError(
        'PILOT_ANTICOAGULATION_DISABLED',
        'Anticoagulation and citrate are not enabled in this pilot interface.',
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
    adapterStatus: 'available-phase-3',
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
  profile: prismaxDraftDeviceProfile,
  createInitialDeviceState: createInitialPrismaxDeviceState,
  getSetupSteps() {
    return prismaxSetupSteps
  },
  validatePrescription: validatePrismaxPilotPrescription,
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
  readonly selectedModality: 'cvvhd' | null
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

export interface PrismaxPilotOperationsDisplay {
  readonly treatmentState: PrismaxPilotInterfaceState['treatmentState']
  readonly modality: 'cvvhd' | null
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
    citrateRequestedButDisabled: false,
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

export function selectPrismaxPilotOperationsDisplay(
  state: PrismaxPilotInterfaceState,
): PrismaxPilotOperationsDisplay {
  const prescription = state.committedPrescription
  return Object.freeze({
    treatmentState: state.treatmentState,
    modality: prescription?.modality === 'cvvhd' ? 'cvvhd' : null,
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
  })
}

/** Projects the shared case engine onto the narrow, source-mapped PrisMax pilot display. */
export function selectPrismaxPilotCaseOperationsDisplay(
  interfaceState: PrismaxPilotInterfaceState,
  simulation: CrrtSimulationState,
): PrismaxPilotOperationsDisplay {
  const prescription = simulation.prescription
  const pressure = simulation.circuit.pressures
  return Object.freeze({
    treatmentState: interfaceState.treatmentState,
    modality: prescription.modality === 'cvvhd' ? 'cvvhd' : null,
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
  })
}

function assertNever(value: never): never {
  throw new Error(`Unhandled PrisMax pilot interface action: ${JSON.stringify(value)}`)
}
