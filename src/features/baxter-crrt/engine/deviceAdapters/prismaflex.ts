import { prismaflexReviewCandidateDeviceProfile } from '../../content/deviceProfiles'
import { prismaflexCalculationAdapter } from './prismaflexCalculations'
import type {
  CrrtDeviceAdapter,
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
 * Structural reviewer validation only. It always retains the configuration
 * gate, so no prescription is declared runnable or locally compatible.
 */
export function validatePrismaflexReviewCandidatePrescription(
  input: PrescriptionState,
): DeviceValidationResult {
  const errors: ReturnType<typeof validationError>[] = []

  if (input.status !== 'configured') {
    errors.push(
      validationError('PRESCRIPTION_REQUIRED', 'A configured prescription is required for review.'),
    )
  } else {
    for (const field of prismaflexFlowFields) {
      const value = input.flows[field]
      if (!isFiniteNonnegative(value)) {
        errors.push(
          validationError(
            'INVALID_FLOW_VALUE',
            `${field} must be a finite, nonnegative value for structural review.`,
          ),
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
    if (input.anticoagulation !== 'none' || input.citrateRequestedButDisabled) {
      errors.push(
        validationError(
          'ANTICOAGULATION_NOT_ACTIVATED',
          'No actionable anticoagulation or citrate profile is activated for this reviewer candidate.',
        ),
      )
    }
  }

  errors.push(
    validationError(
      'TARGET_CONFIGURATION_REVIEW_REQUIRED',
      'Target market, software, therapy, set, accessory, solution, and local configuration review is required before runtime activation.',
    ),
  )

  return Object.freeze({ valid: false, errors: Object.freeze(errors) })
}

function createInitialPrismaflexReviewerDeviceState(): CrrtDeviceState {
  return {
    deliveryState: 'idle',
    bloodPumpRunning: false,
    fluidPumpsRunning: false,
    patientConnected: false,
    returnClampClosed: true,
    adapterStatus: 'deferred',
  }
}

function mapPrismaflexEngineAlarmPending(alarm: ActiveAlarm): DisplayAlarm {
  return Object.freeze({
    engineAlarmId: alarm.id,
    code: alarm.code,
    label: `Engine condition: ${alarm.code}`,
    priorityLabel: 'Prismaflex category mapping pending',
    mappingReviewStatus: 'pending',
  })
}

export interface PrismaflexReviewerOnlyDeviceAdapter extends CrrtDeviceAdapter {
  readonly id: 'prismaflex-g5036003-6xx'
  readonly candidateStatus: 'reviewer-only-not-runtime-registered'
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
 * Phase 8 reviewer-only contract implementation. It exposes sourced metadata,
 * structural validation, and display candidates but deliberately cannot reduce
 * a delivery action and is not registered in the learner runtime.
 */
export const prismaflexDeviceAdapter: PrismaflexReviewerOnlyDeviceAdapter = Object.freeze({
  id: 'prismaflex-g5036003-6xx',
  candidateStatus: 'reviewer-only-not-runtime-registered',
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
  profile: prismaflexReviewCandidateDeviceProfile,
  calculations: prismaflexCalculationAdapter,
  createInitialDeviceState: createInitialPrismaflexReviewerDeviceState,
  getSetupSteps() {
    return prismaflexSetupSteps
  },
  validatePrescription: validatePrismaflexReviewCandidatePrescription,
  reduceDeviceAction() {
    throw new Error(
      'Prismaflex delivery actions remain reviewer-only and are not registered in learner runtime.',
    )
  },
  mapEngineAlarm: mapPrismaflexEngineAlarmPending,
  selectDisplayModel(state: CrrtSimulationState) {
    if (state.deviceId !== 'prismaflex-g5036003-6xx') {
      throw new Error('Prismaflex display selection requires an unloaded Prismaflex review state.')
    }
    return Object.freeze({
      deviceId: 'prismaflex-g5036003-6xx' as const,
      deliveryState: state.device.deliveryState,
      adapterStatus: state.device.adapterStatus,
      alarms: Object.freeze(state.alarms.map(mapPrismaflexEngineAlarmPending)),
    })
  },
})
