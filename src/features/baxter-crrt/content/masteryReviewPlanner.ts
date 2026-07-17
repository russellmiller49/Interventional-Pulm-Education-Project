import { baxterCrrtMasteryManifest } from './mastery'
import { baxterCrrtPhase7ReviewCases } from './phase7ReviewCases'
import { BAXTER_CRRT_PHASE_7_CONTENT_VERSION } from './versions'

export const BAXTER_CRRT_MASTERY_REVIEW_CASE_IDS = Object.freeze([
  'CRRT-01',
  'CRRT-02',
  'CRRT-05',
  'CRRT-06',
  'CRRT-07',
  'CRRT-11',
  'CRRT-15',
] as const)

export type BaxterCrrtMasteryReviewCaseId = (typeof BAXTER_CRRT_MASTERY_REVIEW_CASE_IDS)[number]

export type BaxterCrrtMasteryProblemDomainId =
  | 'treatment-goal-framing'
  | 'electrolyte-acid-base-priority'
  | 'replacement-flow-distribution'
  | 'prescribed-versus-delivered-therapy'
  | 'patient-input-verification'
  | 'fluid-removal-tolerance'
  | 'pressure-trend-localization'

export type BaxterCrrtMasteryCandidateRuleId =
  | 'unseen-title'
  | 'no-hints'
  | 'clean-initial-state'
  | 'minimum-problem-domains'
  | 'reassessment-required'
  | 'minimum-score-candidate'
  | 'zero-critical-errors'

export interface BaxterCrrtMasteryReviewCaseCandidate {
  readonly caseId: BaxterCrrtMasteryReviewCaseId
  readonly title: string
  readonly primaryProblemDomainId: BaxterCrrtMasteryProblemDomainId
  readonly primaryProblemDomainLabel: string
  readonly reviewStatus: 'pending'
  readonly candidateUse: 'thematic-review-input-only'
  readonly masteryRuntimeCaseId: null
}

export interface BaxterCrrtMasteryCandidateRule {
  readonly id: BaxterCrrtMasteryCandidateRuleId
  readonly label: string
  readonly detail: string
  readonly approvalState: 'unapproved-candidate-rule'
  readonly sourceRecordIds: readonly ['BRIEF-MASTERY-001']
}

export interface BaxterCrrtMasteryReviewPlannerManifest {
  readonly id: 'MASTERY-COMPOSITION-REVIEW-01'
  readonly contentVersion: typeof BAXTER_CRRT_PHASE_7_CONTENT_VERSION
  readonly audience: 'reviewer'
  readonly activationState: 'draft-reviewer-only'
  readonly reviewStatus: 'pending'
  readonly exactCandidateIdentity: null
  readonly ruleSetApprovalState: 'unapproved-candidate-rules'
  readonly learnerAvailable: false
  readonly capstoneRuntimeAvailable: false
  readonly sessionCreationAvailable: false
  readonly scoringAvailable: false
  readonly analyticsAvailable: false
  readonly progressPersistenceAvailable: false
  readonly competencyAvailable: false
  readonly sourceRecordIds: readonly ['BRIEF-MASTERY-001']
  readonly candidateCases: readonly BaxterCrrtMasteryReviewCaseCandidate[]
  readonly candidateRules: readonly BaxterCrrtMasteryCandidateRule[]
  readonly blockingInputs: readonly string[]
}

export interface BaxterCrrtMasteryCompositionPreview {
  readonly selectedCaseIds: readonly BaxterCrrtMasteryReviewCaseId[]
  readonly selectedCases: readonly BaxterCrrtMasteryReviewCaseCandidate[]
  readonly selectedProblemDomainIds: readonly BaxterCrrtMasteryProblemDomainId[]
  readonly selectedProblemDomainLabels: readonly string[]
  readonly selectedCaseCount: number
  readonly selectedProblemDomainCount: number
  readonly minimumProblemDomainsCandidate: number
  readonly minimumProblemDomainsRepresented: boolean
  readonly reviewOnly: true
  readonly capstoneRuntimeCreated: false
}

interface MasteryReviewCaseBlueprint {
  readonly caseId: BaxterCrrtMasteryReviewCaseId
  readonly primaryProblemDomainId: BaxterCrrtMasteryProblemDomainId
  readonly primaryProblemDomainLabel: string
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
    Object.freeze(value)
  }
  return value
}

const reviewCaseBlueprints: readonly MasteryReviewCaseBlueprint[] = [
  {
    caseId: 'CRRT-01',
    primaryProblemDomainId: 'treatment-goal-framing',
    primaryProblemDomainLabel: 'Treatment-goal framing',
  },
  {
    caseId: 'CRRT-02',
    primaryProblemDomainId: 'electrolyte-acid-base-priority',
    primaryProblemDomainLabel: 'Electrolyte and acid-base priority',
  },
  {
    caseId: 'CRRT-05',
    primaryProblemDomainId: 'replacement-flow-distribution',
    primaryProblemDomainLabel: 'Replacement-flow distribution',
  },
  {
    caseId: 'CRRT-06',
    primaryProblemDomainId: 'prescribed-versus-delivered-therapy',
    primaryProblemDomainLabel: 'Prescribed-versus-delivered therapy',
  },
  {
    caseId: 'CRRT-07',
    primaryProblemDomainId: 'patient-input-verification',
    primaryProblemDomainLabel: 'Patient-input verification',
  },
  {
    caseId: 'CRRT-11',
    primaryProblemDomainId: 'fluid-removal-tolerance',
    primaryProblemDomainLabel: 'Fluid-removal tolerance',
  },
  {
    caseId: 'CRRT-15',
    primaryProblemDomainId: 'pressure-trend-localization',
    primaryProblemDomainLabel: 'Pressure-trend localization',
  },
]

function reviewCaseCandidate(
  blueprint: MasteryReviewCaseBlueprint,
): BaxterCrrtMasteryReviewCaseCandidate {
  const sourceCase = baxterCrrtPhase7ReviewCases.cases.find(
    (candidate) => candidate.id === blueprint.caseId,
  )
  if (!sourceCase) {
    throw new Error(`Missing Phase 7 review case for Mastery planner: ${blueprint.caseId}.`)
  }

  return {
    ...blueprint,
    title: sourceCase.title,
    reviewStatus: 'pending',
    candidateUse: 'thematic-review-input-only',
    masteryRuntimeCaseId: null,
  }
}

function candidateRule(
  id: BaxterCrrtMasteryCandidateRuleId,
  label: string,
  detail: string,
): BaxterCrrtMasteryCandidateRule {
  return {
    id,
    label,
    detail,
    approvalState: 'unapproved-candidate-rule',
    sourceRecordIds: ['BRIEF-MASTERY-001'],
  }
}

const candidateRules: readonly BaxterCrrtMasteryCandidateRule[] = [
  candidateRule(
    'unseen-title',
    'Unseen title before debrief',
    `Keep the learner-facing title nonrevealing: “${baxterCrrtMasteryManifest.learnerTitleBeforeDebrief}.”`,
  ),
  candidateRule('no-hints', 'No hints', 'Do not expose a hint ladder during a future attempt.'),
  candidateRule(
    'clean-initial-state',
    'Clean initial state',
    'A future attempt must not inherit Practice choices, hints, or progress state.',
  ),
  candidateRule(
    'minimum-problem-domains',
    `At least ${baxterCrrtMasteryManifest.minimumProblemDomains} problem domains`,
    'A newly authored capstone must integrate multiple independently reviewed problem domains.',
  ),
  candidateRule(
    'reassessment-required',
    'Reassessment required',
    'A future rubric must require completion of the approved reassessment sequence.',
  ),
  candidateRule(
    'minimum-score-candidate',
    `Candidate score ≥ ${baxterCrrtMasteryManifest.minimumScoreCandidate}%`,
    'This threshold is a product-requirement candidate and is not an approved competency standard.',
  ),
  candidateRule(
    'zero-critical-errors',
    `Zero critical errors allowed`,
    'Any future critical-error definitions require independent exact-version review before use.',
  ),
]

export const baxterCrrtMasteryReviewPlanner: BaxterCrrtMasteryReviewPlannerManifest = deepFreeze({
  id: 'MASTERY-COMPOSITION-REVIEW-01',
  contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
  audience: 'reviewer',
  activationState: 'draft-reviewer-only',
  reviewStatus: 'pending',
  exactCandidateIdentity: null,
  ruleSetApprovalState: 'unapproved-candidate-rules',
  learnerAvailable: false,
  capstoneRuntimeAvailable: false,
  sessionCreationAvailable: false,
  scoringAvailable: false,
  analyticsAvailable: false,
  progressPersistenceAvailable: false,
  competencyAvailable: false,
  sourceRecordIds: ['BRIEF-MASTERY-001'],
  candidateCases: reviewCaseBlueprints.map(reviewCaseCandidate),
  candidateRules,
  blockingInputs: [
    'Author a new integrated capstone rather than reusing any source review case as a Mastery runtime.',
    'Complete exact-version review of its mechanisms, accepted alternatives, score, critical errors, and reassessment rules.',
    'Complete device, clinical, accessibility, localization, and publication review before learner activation.',
  ],
})

const candidateById = new Map(
  baxterCrrtMasteryReviewPlanner.candidateCases.map((candidate) => [candidate.caseId, candidate]),
)

export function createBaxterCrrtMasteryCompositionPreview(
  selectedCaseIds: readonly BaxterCrrtMasteryReviewCaseId[],
): BaxterCrrtMasteryCompositionPreview {
  const requestedIds = new Set<string>(selectedCaseIds)
  const unknownIds = [...requestedIds].filter(
    (caseId) => !candidateById.has(caseId as BaxterCrrtMasteryReviewCaseId),
  )
  if (unknownIds.length > 0) {
    throw new Error(`Unknown Mastery review-planner case ID: ${unknownIds.join(', ')}.`)
  }

  const selectedCases = BAXTER_CRRT_MASTERY_REVIEW_CASE_IDS.filter((caseId) =>
    requestedIds.has(caseId),
  ).map((caseId) => candidateById.get(caseId)!)
  const domainById = new Map<BaxterCrrtMasteryProblemDomainId, string>()
  for (const candidate of selectedCases) {
    domainById.set(candidate.primaryProblemDomainId, candidate.primaryProblemDomainLabel)
  }

  return deepFreeze({
    selectedCaseIds: selectedCases.map((candidate) => candidate.caseId),
    selectedCases,
    selectedProblemDomainIds: [...domainById.keys()],
    selectedProblemDomainLabels: [...domainById.values()],
    selectedCaseCount: selectedCases.length,
    selectedProblemDomainCount: domainById.size,
    minimumProblemDomainsCandidate: baxterCrrtMasteryManifest.minimumProblemDomains,
    minimumProblemDomainsRepresented:
      domainById.size >= baxterCrrtMasteryManifest.minimumProblemDomains,
    reviewOnly: true,
    capstoneRuntimeCreated: false,
  })
}
