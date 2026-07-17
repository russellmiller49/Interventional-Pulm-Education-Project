import type { CrrtEngineFaultId } from '../engine/types'
import type { CrrtRapidDrillId } from './rapidDrills'
import { BAXTER_CRRT_PHASE_7_CONTENT_VERSION } from './versions'

export const CRRT_REVIEWER_RAPID_DRILL_IDS = Object.freeze([
  'DRILL-AIR',
  'DRILL-BLOOD-LEAK',
  'DRILL-GAIN-LOSS',
  'DRILL-BAG-SCALE',
  'DRILL-POWER',
] as const satisfies readonly CrrtRapidDrillId[])

export type CrrtReviewerRapidDrillId = (typeof CRRT_REVIEWER_RAPID_DRILL_IDS)[number]

export const CRRT_CAUSE_FIRST_STEP_IDS = Object.freeze([
  'assess-patient-safety',
  'identify-device-response',
  'inspect-corresponding-domain',
  'verify-cause-corrected',
  'resume-only-when-safe',
  'reassess-delivery-and-patient',
] as const)

export type CrrtCauseFirstStepId = (typeof CRRT_CAUSE_FIRST_STEP_IDS)[number]

export interface CrrtCauseFirstStepDefinition {
  readonly id: CrrtCauseFirstStepId
  readonly label: string
  readonly reviewerBoundary: string
}

const causeFirstStepDefinitions = [
  {
    id: 'assess-patient-safety',
    label: 'Assess patient safety',
    reviewerBoundary:
      'Review whether immediate patient assessment and appropriate escalation are represented before any device interaction.',
  },
  {
    id: 'identify-device-response',
    label: 'Identify the device response',
    reviewerBoundary:
      'Separate the detected condition from the device response; the exact target-configuration response remains pending.',
  },
  {
    id: 'inspect-corresponding-domain',
    label: 'Inspect the corresponding domain',
    reviewerBoundary:
      'Review the named patient, circuit, fluid, power, or detector domain without supplying a corrective procedure.',
  },
  {
    id: 'verify-cause-corrected',
    label: 'Verify that the cause is corrected',
    reviewerBoundary:
      'Acknowledging a signal is not evidence of correction; this is an independent verification gate.',
  },
  {
    id: 'resume-only-when-safe',
    label: 'Resume only when safe',
    reviewerBoundary:
      'This review gate does not authorize a restart or replace the device manual, local policy, or clinical judgment.',
  },
  {
    id: 'reassess-delivery-and-patient',
    label: 'Reassess therapy delivery and the patient',
    reviewerBoundary:
      'Review patient status, actual delivery, interruption effects, and recurrence as separate reassessment domains.',
  },
] as const satisfies readonly CrrtCauseFirstStepDefinition[]

export const CRRT_CAUSE_FIRST_STEPS: readonly CrrtCauseFirstStepDefinition[] = Object.freeze(
  causeFirstStepDefinitions.map((step) => Object.freeze(step)),
)

if (
  CRRT_CAUSE_FIRST_STEPS.map((step) => step.id).join('|') !== CRRT_CAUSE_FIRST_STEP_IDS.join('|')
) {
  throw new Error('CRRT cause-first step definitions must preserve the stable safe order.')
}

export interface CrrtRapidDrillPredictionOption {
  readonly id: string
  readonly label: string
  readonly description: string
}

export interface CrrtReviewerRapidDrillDefinition {
  readonly id: CrrtReviewerRapidDrillId
  readonly contentVersion: typeof BAXTER_CRRT_PHASE_7_CONTENT_VERSION
  readonly title: string
  readonly engineFaultIds: readonly CrrtEngineFaultId[]
  readonly openingSignal: string
  readonly predictionPrompt: string
  readonly predictionOptions: readonly CrrtRapidDrillPredictionOption[]
  readonly candidateCauseOptionId: string
  readonly deviceResponseBoundary: string
  readonly inspectionDomain: string
  readonly correctionBoundary: string
  readonly reassessmentDomain: string
  readonly sourceRecordIds: readonly string[]
  readonly reviewStatus: 'pending'
  readonly learnerRunnable: false
  readonly scoringAvailable: false
  readonly analyticsAvailable: false
  readonly progressPersistenceAvailable: false
  readonly competencyAvailable: false
}

function freezeDefinition(
  definition: CrrtReviewerRapidDrillDefinition,
): CrrtReviewerRapidDrillDefinition {
  Object.freeze(definition.engineFaultIds)
  definition.predictionOptions.forEach(Object.freeze)
  Object.freeze(definition.predictionOptions)
  Object.freeze(definition.sourceRecordIds)
  return Object.freeze(definition)
}

const sharedBoundary =
  'Exact PrisMax alarm name, priority, threshold, automatic pump/clamp reaction, and corrective instructions remain pending device review.'

export const baxterCrrtReviewerRapidDrills: readonly CrrtReviewerRapidDrillDefinition[] =
  Object.freeze([
    freezeDefinition({
      id: 'DRILL-AIR',
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      title: 'Air-detection fault preview',
      engineFaultIds: ['air-detected'],
      openingSignal:
        'The generic engine reports a synthetic air-detection fault and a therapy-interruption state.',
      predictionPrompt:
        'Which domain should the reviewer inspect before any reset or continuation?',
      predictionOptions: [
        {
          id: 'air-return-path',
          label: 'Patient safety, return path, detector, clamp, and circuit',
          description:
            'Preserves a cause-first inspection without supplying a correction sequence.',
        },
        {
          id: 'air-acknowledge-only',
          label: 'Acknowledge and continue without inspection',
          description: 'Acknowledgement does not establish that the underlying fault is corrected.',
        },
      ],
      candidateCauseOptionId: 'air-return-path',
      deviceResponseBoundary: sharedBoundary,
      inspectionDomain:
        'Patient, return line, air detector, return clamp, and visible circuit state',
      correctionBoundary:
        'The preview can record that correction was independently verified; it does not teach an air-removal or restart procedure.',
      reassessmentDomain: 'Patient safety, circuit state, therapy delivery, and recurrence',
      sourceRecordIds: ['DEV-PM-008', 'SAFETY-006', 'SYNTH-DRILL-AIR-001'],
      reviewStatus: 'pending',
      learnerRunnable: false,
      scoringAvailable: false,
      analyticsAvailable: false,
      progressPersistenceAvailable: false,
      competencyAvailable: false,
    }),
    freezeDefinition({
      id: 'DRILL-BLOOD-LEAK',
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      title: 'Blood-leak fault preview',
      engineFaultIds: ['blood-leak-detected'],
      openingSignal:
        'The generic engine reports a synthetic blood-leak detection fault and a safety-stop state.',
      predictionPrompt: 'What must be assessed before interpreting or clearing the signal?',
      predictionOptions: [
        {
          id: 'blood-leak-patient-effluent',
          label: 'Patient safety, effluent path, detector, filter, and circuit',
          description: 'Keeps detection, inspection, escalation, and correction as separate gates.',
        },
        {
          id: 'blood-leak-reset-only',
          label: 'Reset repeatedly until the signal disappears',
          description: 'A disappearing message is not proof that the cause has been resolved.',
        },
      ],
      candidateCauseOptionId: 'blood-leak-patient-effluent',
      deviceResponseBoundary: sharedBoundary,
      inspectionDomain:
        'Patient, filter, effluent line, blood-leak detector, and circuit integrity',
      correctionBoundary:
        'The preview records an independently verified correction/escalation gate only; it provides no discard, return, or restart instruction.',
      reassessmentDomain:
        'Patient safety, effluent/circuit state, treatment delivery, and recurrence',
      sourceRecordIds: ['DEV-PM-008', 'SAFETY-006', 'SYNTH-DRILL-BLOOD-LEAK-001'],
      reviewStatus: 'pending',
      learnerRunnable: false,
      scoringAvailable: false,
      analyticsAvailable: false,
      progressPersistenceAvailable: false,
      competencyAvailable: false,
    }),
    freezeDefinition({
      id: 'DRILL-GAIN-LOSS',
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      title: 'Fluid gain/loss fault preview',
      engineFaultIds: ['fluid-gain-loss'],
      openingSignal:
        'The generic engine reports a synthetic device-fluid variance while whole-patient balance remains a separate ledger.',
      predictionPrompt: 'Which distinction must be preserved during the first assessment?',
      predictionOptions: [
        {
          id: 'gain-loss-separate-ledgers',
          label: 'Separate device variance from whole-patient inputs and outputs',
          description:
            'Prevents a machine-fluid signal from being treated as the complete patient balance.',
        },
        {
          id: 'gain-loss-equals-balance',
          label: 'Treat the machine signal as the whole-patient balance',
          description: 'Collapses two separately modeled quantities into one.',
        },
      ],
      candidateCauseOptionId: 'gain-loss-separate-ledgers',
      deviceResponseBoundary: sharedBoundary,
      inspectionDomain:
        'Pumps, scales, bags, lines, measured variance, and the separate patient ledger',
      correctionBoundary:
        'No override count, catch-up behavior, restart threshold, or escalation rule is supplied by this preview.',
      reassessmentDomain:
        'Device variance, machine PFR, whole-patient balance, downtime, and recurrence',
      sourceRecordIds: ['DEV-PM-012', 'SAFETY-007', 'SYNTH-DRILL-GAIN-LOSS-001'],
      reviewStatus: 'pending',
      learnerRunnable: false,
      scoringAvailable: false,
      analyticsAvailable: false,
      progressPersistenceAvailable: false,
      competencyAvailable: false,
    }),
    freezeDefinition({
      id: 'DRILL-BAG-SCALE',
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      title: 'Bag/scale topology fault preview',
      engineFaultIds: ['supply-bag-empty', 'effluent-bag-full', 'scale-open'],
      openingSignal:
        'The reviewer chooses one synthetic bag/scale fault while exact local bag, line, and solution configuration remains unavailable.',
      predictionPrompt: 'What should be verified before a simulated restart gate?',
      predictionOptions: [
        {
          id: 'bag-scale-topology',
          label: 'Bag identity, line path, scale position, connection, and measured state',
          description: 'Uses topology inspection without asserting a stocked solution or set.',
        },
        {
          id: 'bag-scale-swap-unverified',
          label: 'Swap any bag and restart without verification',
          description: 'Bypasses the missing local configuration and independent check.',
        },
      ],
      candidateCauseOptionId: 'bag-scale-topology',
      deviceResponseBoundary: sharedBoundary,
      inspectionDomain: 'Selected bag, connected line, assigned scale, clamp, and neighboring bags',
      correctionBoundary:
        'The preview never names a commercial solution, compatible set, scale assignment, or restart procedure.',
      reassessmentDomain:
        'Bag/scale state, line topology, fluid delivery, variance, and recurrence',
      sourceRecordIds: ['DEV-PM-013', 'SAFETY-007', 'SAFETY-013', 'SYNTH-DRILL-BAG-SCALE-001'],
      reviewStatus: 'pending',
      learnerRunnable: false,
      scoringAvailable: false,
      analyticsAvailable: false,
      progressPersistenceAvailable: false,
      competencyAvailable: false,
    }),
    freezeDefinition({
      id: 'DRILL-POWER',
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      title: 'Power-interruption state preview',
      engineFaultIds: ['power-interruption'],
      openingSignal:
        'The generic engine reports a synthetic power interruption and paused delivery state.',
      predictionPrompt: 'What must be reviewed before any continuation decision?',
      predictionOptions: [
        {
          id: 'power-complete-state',
          label: 'Patient, device power/state, circuit, downtime, and treatment delivery',
          description:
            'Preserves device, circuit, patient, and delivery reassessment as separate tasks.',
        },
        {
          id: 'power-resume-only',
          label: 'Resume immediately because power is visible',
          description:
            'Power restoration alone does not verify complete device or circuit readiness.',
        },
      ],
      candidateCauseOptionId: 'power-complete-state',
      deviceResponseBoundary: sharedBoundary,
      inspectionDomain:
        'Patient, power source, device state, circuit state, downtime, and active messages',
      correctionBoundary:
        'Recovery, battery duration, continuation, and escalation steps remain target-configuration and device-review inputs.',
      reassessmentDomain:
        'Patient, device/circuit readiness, delivered therapy, downtime, and recurrence',
      sourceRecordIds: ['DEV-PM-008', 'SAFETY-010', 'SYNTH-DRILL-POWER-001'],
      reviewStatus: 'pending',
      learnerRunnable: false,
      scoringAvailable: false,
      analyticsAvailable: false,
      progressPersistenceAvailable: false,
      competencyAvailable: false,
    }),
  ])

if (
  baxterCrrtReviewerRapidDrills.map((drill) => drill.id).join('|') !==
  CRRT_REVIEWER_RAPID_DRILL_IDS.join('|')
) {
  throw new Error('CRRT reviewer rapid-drill definitions must match the stable preview registry.')
}

export interface CrrtRapidDrillReviewState {
  readonly drillId: CrrtReviewerRapidDrillId
  readonly predictionOptionId: string | null
  readonly faultRevealed: boolean
  readonly acknowledged: boolean
  readonly completedStepIds: readonly CrrtCauseFirstStepId[]
  readonly correctionVerified: boolean
}

export type CrrtRapidDrillReviewAction =
  | { readonly type: 'SELECT_DRILL'; readonly drillId: CrrtReviewerRapidDrillId }
  | { readonly type: 'COMMIT_PREDICTION'; readonly optionId: string }
  | { readonly type: 'ACKNOWLEDGE_SIGNAL' }
  | { readonly type: 'COMPLETE_NEXT_STEP' }
  | { readonly type: 'RESET' }

export function createCrrtRapidDrillReviewState(
  drillId: CrrtReviewerRapidDrillId = CRRT_REVIEWER_RAPID_DRILL_IDS[0],
): CrrtRapidDrillReviewState {
  return freezeReviewState({
    drillId,
    predictionOptionId: null,
    faultRevealed: false,
    acknowledged: false,
    completedStepIds: [],
    correctionVerified: false,
  })
}

function freezeReviewState(state: CrrtRapidDrillReviewState): CrrtRapidDrillReviewState {
  return Object.freeze({
    ...state,
    completedStepIds: Object.freeze([...state.completedStepIds]),
  })
}

export function getCrrtReviewerRapidDrill(
  drillId: CrrtReviewerRapidDrillId,
): CrrtReviewerRapidDrillDefinition {
  const drill = baxterCrrtReviewerRapidDrills.find((candidate) => candidate.id === drillId)
  if (!drill) throw new Error(`Unknown CRRT reviewer rapid drill: ${drillId}`)
  return drill
}

export function reduceCrrtRapidDrillReview(
  state: CrrtRapidDrillReviewState,
  action: CrrtRapidDrillReviewAction,
): CrrtRapidDrillReviewState {
  if (action.type === 'SELECT_DRILL') return createCrrtRapidDrillReviewState(action.drillId)
  if (action.type === 'RESET') return createCrrtRapidDrillReviewState(state.drillId)

  const drill = getCrrtReviewerRapidDrill(state.drillId)
  if (action.type === 'COMMIT_PREDICTION') {
    if (state.predictionOptionId !== null) return state
    if (!drill.predictionOptions.some((option) => option.id === action.optionId)) return state
    return freezeReviewState({
      ...state,
      predictionOptionId: action.optionId,
      faultRevealed: true,
    })
  }
  if (!state.faultRevealed) return state
  if (action.type === 'ACKNOWLEDGE_SIGNAL') {
    if (state.acknowledged) return state
    return freezeReviewState({ ...state, acknowledged: true })
  }
  if (action.type === 'COMPLETE_NEXT_STEP') {
    const nextStep = CRRT_CAUSE_FIRST_STEP_IDS[state.completedStepIds.length]
    if (!nextStep) return state
    const completedStepIds = [...state.completedStepIds, nextStep]
    return freezeReviewState({
      ...state,
      completedStepIds,
      correctionVerified: state.correctionVerified || nextStep === 'verify-cause-corrected',
    })
  }
  return assertNever(action)
}

function assertNever(value: never): never {
  throw new Error(`Unhandled CRRT rapid-drill review action: ${JSON.stringify(value)}`)
}
