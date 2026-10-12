import {
  CRRT_RAPID_DRILL_IDS,
  baxterCrrtRapidDrills,
  getBaxterCrrtRapidDrill,
  type CrrtRapidDrillDefinition,
  type CrrtRapidDrillId,
} from './rapidDrills'

export const CRRT_REVIEWER_RAPID_DRILL_IDS = CRRT_RAPID_DRILL_IDS
export type CrrtReviewerRapidDrillId = CrrtRapidDrillId
export type CrrtReviewerRapidDrillDefinition = CrrtRapidDrillDefinition
export const baxterCrrtReviewerRapidDrills = baxterCrrtRapidDrills

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

export const CRRT_CAUSE_FIRST_STEPS: readonly CrrtCauseFirstStepDefinition[] = Object.freeze([
  Object.freeze({
    id: 'assess-patient-safety',
    label: 'Assess patient safety',
    reviewerBoundary:
      'Look at the patient before the screen: breathing, saturation, blood pressure, the catheter site. Call the nurse or a colleague to the bedside if the patient has changed.',
  }),
  Object.freeze({
    id: 'identify-device-response',
    label: 'Identify the device response',
    reviewerBoundary:
      'Read what the alarm detected and what the machine has done about it: which pumps have stopped, and whether the return clamp is closed.',
  }),
  Object.freeze({
    id: 'inspect-corresponding-domain',
    label: 'Inspect the corresponding domain',
    reviewerBoundary: 'Go to the part of the circuit the alarm points at and look at it.',
  }),
  Object.freeze({
    id: 'verify-cause-corrected',
    label: 'Verify that the cause is corrected',
    reviewerBoundary:
      'Silencing the alarm fixes nothing. Fix the cause, then confirm it with your eyes and the readings.',
  }),
  Object.freeze({
    id: 'resume-only-when-safe',
    label: 'Resume only when safe',
    reviewerBoundary:
      'Restart once the cause is fixed and the patient is stable. PrisMax enables Continue when its own check clears.',
  }),
  Object.freeze({
    id: 'reassess-delivery-and-patient',
    label: 'Reassess delivery and the patient',
    reviewerBoundary:
      'Check the patient again, then the treatment: how long it was off, what that did to the delivered dose and fluid balance, and whether the alarm comes back.',
  }),
])

export interface CrrtRapidDrillReviewState {
  readonly drillId: CrrtRapidDrillId
  readonly seed: number
  readonly predictionOptionId: string | null
  readonly faultRevealed: boolean
  readonly acknowledged: boolean
  readonly completedStepIds: readonly CrrtCauseFirstStepId[]
  readonly correctionVerified: boolean
  readonly reassessmentCompleted: boolean
  readonly outcome: 'in-progress' | 'safe' | 'accepted-alternative' | 'unsafe' | 'critical-error'
}

export type CrrtRapidDrillReviewAction =
  | { readonly type: 'SELECT_DRILL'; readonly drillId: CrrtRapidDrillId; readonly seed?: number }
  | { readonly type: 'REVEAL_EXAMPLE' }
  | { readonly type: 'COMMIT_PREDICTION'; readonly optionId: string }
  | { readonly type: 'ACKNOWLEDGE_SIGNAL' }
  | { readonly type: 'COMPLETE_NEXT_STEP' }
  | { readonly type: 'REVIEW_STEP'; readonly stepId: CrrtCauseFirstStepId }
  | { readonly type: 'RESET' }

function freezeState(state: CrrtRapidDrillReviewState): CrrtRapidDrillReviewState {
  return Object.freeze({ ...state, completedStepIds: Object.freeze([...state.completedStepIds]) })
}

export function createCrrtRapidDrillReviewState(
  drillId: CrrtRapidDrillId = CRRT_RAPID_DRILL_IDS[0],
  seed = 1,
): CrrtRapidDrillReviewState {
  if (!Number.isSafeInteger(seed) || seed < 0)
    throw new RangeError('Drill seed must be nonnegative.')
  return freezeState({
    drillId,
    seed,
    predictionOptionId: null,
    faultRevealed: false,
    acknowledged: false,
    completedStepIds: [],
    correctionVerified: false,
    reassessmentCompleted: false,
    outcome: 'in-progress',
  })
}

export const getCrrtReviewerRapidDrill = getBaxterCrrtRapidDrill

export function reduceCrrtRapidDrillReview(
  state: CrrtRapidDrillReviewState,
  action: CrrtRapidDrillReviewAction,
): CrrtRapidDrillReviewState {
  if (action.type === 'SELECT_DRILL') {
    return createCrrtRapidDrillReviewState(action.drillId, action.seed ?? state.seed)
  }
  if (action.type === 'RESET') return createCrrtRapidDrillReviewState(state.drillId, state.seed)

  const drill = getBaxterCrrtRapidDrill(state.drillId)
  if (action.type === 'REVEAL_EXAMPLE') return freezeState({ ...state, faultRevealed: true })
  if (action.type === 'COMMIT_PREDICTION') {
    if (state.predictionOptionId !== null) return state
    const prediction = drill.predictionOptions.find((option) => option.id === action.optionId)
    if (!prediction) return state
    const unsafeOutcome =
      prediction.disposition === 'unsafe'
        ? prediction.id === drill.unsafeOptionId
          ? 'critical-error'
          : 'unsafe'
        : 'in-progress'
    return freezeState({
      ...state,
      predictionOptionId: prediction.id,
      faultRevealed: true,
      outcome: unsafeOutcome,
    })
  }
  if (!state.faultRevealed) return state
  if (action.type === 'ACKNOWLEDGE_SIGNAL') {
    return state.acknowledged ? state : freezeState({ ...state, acknowledged: true })
  }
  if (action.type === 'COMPLETE_NEXT_STEP' || action.type === 'REVIEW_STEP') {
    const reviewedStep =
      action.type === 'REVIEW_STEP'
        ? action.stepId
        : CRRT_CAUSE_FIRST_STEP_IDS[state.completedStepIds.length]
    if (!reviewedStep || state.completedStepIds.includes(reviewedStep)) return state
    const completedStepIds = [...state.completedStepIds, reviewedStep]
    if (action.type === 'REVIEW_STEP') return freezeState({ ...state, completedStepIds })
    const completed = completedStepIds.length === CRRT_CAUSE_FIRST_STEP_IDS.length
    const prediction = drill.predictionOptions.find(
      (option) => option.id === state.predictionOptionId,
    )
    const outcome =
      state.outcome === 'critical-error'
        ? state.outcome
        : completed
          ? prediction?.disposition === 'accepted-alternative'
            ? 'accepted-alternative'
            : 'safe'
          : 'in-progress'
    return freezeState({
      ...state,
      completedStepIds,
      correctionVerified: state.correctionVerified || reviewedStep === 'verify-cause-corrected',
      reassessmentCompleted:
        state.reassessmentCompleted || reviewedStep === 'reassess-delivery-and-patient',
      outcome,
    })
  }
  return state
}
