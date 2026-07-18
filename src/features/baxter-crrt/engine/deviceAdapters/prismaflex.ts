import { prismaflexDeviceProfile } from '../../content/deviceProfiles'
import { prismaflexCalculationAdapter } from './prismaflexCalculations'
import type {
  CrrtDeviceAdapter,
  CrrtDeviceAction,
  DeviceValidationResult,
  DisplayAlarm,
  SetupStepDefinition,
} from './types'
import type {
  ActiveAlarm,
  CrrtDeviceState,
  CrrtFlowRates,
  CrrtSimulationState,
  PrescriptionState,
} from '../types'

export const PRISMAFLEX_SETUP_SOURCE_ID = 'DEV-PF-002' as const
export const PRISMAFLEX_ALARM_TAXONOMY_SOURCE_ID = 'DEV-PF-007' as const
export const PRISMAFLEX_VALIDATION_SOURCE_IDS = Object.freeze(['DEV-PF-006', 'DEV-PF-008'] as const)

const setupStep = <const Id extends string>(id: Id, label: string) =>
  Object.freeze({
    id,
    label,
    sourceIds: Object.freeze([PRISMAFLEX_SETUP_SOURCE_ID]),
    reviewStatus: 'pending' as const,
  }) satisfies SetupStepDefinition

/**
 * Source-mapped G5036003 setup sequence. Conditional screens remain visibly
 * conditional, and this metadata does not execute a prime or connect a patient.
 */
export const prismaflexSetupSteps = Object.freeze([
  setupStep('choose-patient', 'Choose Patient'),
  setupStep('enter-patient-information', 'Enter and Confirm Patient Information'),
  setupStep('choose-therapy', 'Choose Therapy'),
  setupStep('choose-anticoagulation', 'Choose and Confirm Anticoagulation Method'),
  setupStep('load-set', 'Load and Confirm Set'),
  setupStep('prepare-solutions', 'Prepare and Connect Solutions'),
  setupStep('install-syringe-if-applicable', 'Install and Confirm Syringe (if applicable)'),
  setupStep('verify-setup', 'Verify Setup'),
  setupStep('prime', 'Prime'),
  setupStep('prime-test', 'Prime Test'),
  setupStep('pretreatment-settings', 'Enter Pre-treatment Settings'),
  setupStep('flow-settings', 'Enter Flow Settings'),
  setupStep(
    'anticoagulation-settings-if-applicable',
    'Enter Anticoagulation Settings (if applicable)',
  ),
  setupStep('review-prescription', 'Review Prescription'),
  setupStep('connect-patient', 'Connect Patient'),
  setupStep('verify-patient-connection', 'Verify Patient Connection'),
  setupStep('start-treatment', 'Start Treatment'),
] as const)

export type PrismaflexSetupStepId = (typeof prismaflexSetupSteps)[number]['id']

export interface PrismaflexAlarmCategoryCandidate {
  readonly label: 'Warning' | 'Malfunction' | 'Caution' | 'Advisory'
  readonly sourceIds: readonly ['DEV-PF-007']
  readonly assignmentStatus: 'taxonomy-only-mapping-pending'
  readonly reviewStatus: 'pending'
}

const alarmCategory = (
  label: PrismaflexAlarmCategoryCandidate['label'],
): PrismaflexAlarmCategoryCandidate =>
  Object.freeze({
    label,
    sourceIds: Object.freeze([PRISMAFLEX_ALARM_TAXONOMY_SOURCE_ID] as const),
    assignmentStatus: 'taxonomy-only-mapping-pending',
    reviewStatus: 'pending',
  })

/** The manual taxonomy is represented without assigning any engine alarm to it. */
export const prismaflexAlarmCategoryCandidates = Object.freeze([
  alarmCategory('Warning'),
  alarmCategory('Malfunction'),
  alarmCategory('Caution'),
  alarmCategory('Advisory'),
])

const validationSourceIds = PRISMAFLEX_VALIDATION_SOURCE_IDS

const prismaflexFlowFields = Object.freeze([
  'bloodFlowMlMin',
  'dialysateFlowMlHour',
  'pbpFlowMlHour',
  'preReplacementFlowMlHour',
  'postReplacementFlowMlHour',
  'patientFluidRemovalMlHour',
  'syringeFlowMlHour',
  'makeupFlowMlHour',
] as const satisfies readonly (keyof CrrtFlowRates)[])

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

/**
 * Manual-reference structural validation. Passing this check means only that
 * the synthetic educational prescription is internally representable; it is
 * not a claim about an institution's configuration or patient-care protocol.
 */
export function validatePrismaflexPrescription(input: PrescriptionState): DeviceValidationResult {
  const errors: ReturnType<typeof validationError>[] = []

  if (input.status !== 'configured') {
    errors.push(validationError('PRESCRIPTION_REQUIRED', 'A configured prescription is required.'))
  } else {
    for (const field of prismaflexFlowFields) {
      const value = input.flows[field]
      if (!isFiniteNonnegative(value)) {
        errors.push(
          validationError('INVALID_FLOW_VALUE', `${field} must be a finite, nonnegative value.`),
        )
      }
    }
    if (!(input.flows.bloodFlowMlMin > 0)) {
      errors.push(
        validationError('BLOOD_FLOW_REQUIRED', 'A positive blood-flow value is required.'),
      )
    }
    if (input.flows.makeupFlowMlHour !== 0) {
      errors.push(
        validationError(
          'UNSOURCED_MAKEUP_FLOW',
          'The G5036003 Prismaflex CRRT Qeff equations do not include a makeup-flow term.',
        ),
      )
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
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) })
}

function createInitialPrismaflexDeviceState(): CrrtDeviceState {
  return {
    deliveryState: 'idle',
    bloodPumpRunning: false,
    fluidPumpsRunning: false,
    patientConnected: false,
    returnClampClosed: true,
    adapterStatus: 'operational-v1',
  }
}

function mapPrismaflexEngineAlarm(alarm: ActiveAlarm): DisplayAlarm {
  const priorityLabel =
    alarm.urgency === 'safety-stop'
      ? 'Warning'
      : alarm.urgency === 'therapy-interruption'
        ? 'Caution'
        : 'Advisory'
  return Object.freeze({
    engineAlarmId: alarm.id,
    code: alarm.code,
    label: `Engine condition: ${alarm.code}`,
    priorityLabel,
    mappingReviewStatus: 'pending',
  })
}

export interface PrismaflexOperationalDeviceAdapter extends CrrtDeviceAdapter {
  readonly id: 'prismaflex-g5036003-6xx'
  readonly runtimeStatus: 'operational-v1'
  readonly sourceIds: readonly [
    'DEV-PF-001',
    'DEV-PF-002',
    'DEV-PF-003',
    'DEV-PF-004',
    'DEV-PF-005',
    'DEV-PF-006',
    'DEV-PF-007',
    'DEV-PF-008',
  ]
  readonly calculations: typeof prismaflexCalculationAdapter
}

/**
 * Operational manual-reference Prismaflex adapter. The adapter owns its
 * softkey workflow, four-scale presentation, distinct Qeff contexts,
 * alarm/help vocabulary, and stop/end framing.
 */
export const prismaflexDeviceAdapter: PrismaflexOperationalDeviceAdapter = Object.freeze({
  id: 'prismaflex-g5036003-6xx',
  runtimeStatus: 'operational-v1',
  sourceIds: Object.freeze([
    'DEV-PF-001',
    'DEV-PF-002',
    'DEV-PF-003',
    'DEV-PF-004',
    'DEV-PF-005',
    'DEV-PF-006',
    'DEV-PF-007',
    'DEV-PF-008',
  ] as const),
  profile: prismaflexDeviceProfile,
  calculations: prismaflexCalculationAdapter,
  createInitialDeviceState: createInitialPrismaflexDeviceState,
  getSetupSteps() {
    return prismaflexSetupSteps
  },
  validatePrescription: validatePrismaflexPrescription,
  reduceDeviceAction(state: CrrtDeviceState, action: CrrtDeviceAction) {
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
  mapEngineAlarm: mapPrismaflexEngineAlarm,
  selectDisplayModel(state: CrrtSimulationState) {
    if (state.deviceId !== 'prismaflex-g5036003-6xx') {
      throw new Error('Prismaflex display selection requires a Prismaflex simulation state.')
    }
    return Object.freeze({
      deviceId: 'prismaflex-g5036003-6xx' as const,
      deliveryState: state.device.deliveryState,
      adapterStatus: state.device.adapterStatus,
      alarms: Object.freeze(state.alarms.map(mapPrismaflexEngineAlarm)),
      navigationParadigm: 'softkey-workflow' as const,
      scaleLayout: Object.freeze([
        'Dialysate scale',
        'Replacement scale',
        'PBP scale',
        'Effluent scale',
      ]),
      displayedCalculationContexts: Object.freeze([
        'Effluent-pump target Qeff (includes syringe flow)',
        'Dose-section Qeff (omits syringe flow)',
        'TMP',
        'Filter pressure drop',
      ]),
      historyAvailable: true as const,
      stopEndOptions: Object.freeze([
        'Stop treatment',
        'End treatment',
        'Frame blood disposition using device instructions and local policy',
      ]),
    })
  },
})

/** Compatibility alias for imports from the pre-v1 review build. */
export const validatePrismaflexReviewCandidatePrescription = validatePrismaflexPrescription
