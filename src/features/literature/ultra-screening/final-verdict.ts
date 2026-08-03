import {
  compareNumericPmids,
  ultraScreeningResultSchema,
  type UltraRelevanceLabel,
  type UltraScreeningResult,
} from './core'

export const ULTRA_FINAL_VERDICT_SCHEMA_VERSION = '1.0.0' as const
export const ULTRA_FINAL_VERDICT_POLICY_VERSION = '1.0.0' as const

export const ULTRA_FINAL_VERDICT_POLICY_DESCRIPTION =
  'Safety-first deterministic reconciliation: honor every human-review requirement; never finalize a first-pass exclusion without an exclusion challenge; require escalation for pass disagreement or selected QC; require human review when escalation creates a new exclusion; otherwise use a clean escalation, challenge consensus, or first-pass inclusion in that order.' as const

export const ULTRA_FINAL_VERDICT_STATUSES = [
  'final',
  'awaiting_exclusion_challenge',
  'awaiting_escalation',
  'requires_human_review',
] as const

export type UltraFinalVerdictStatus = (typeof ULTRA_FINAL_VERDICT_STATUSES)[number]

export type UltraFinalVerdictAuditReason =
  | 'first_pass_only'
  | 'exclusion_challenge_missing'
  | 'exclusion_challenge_consensus'
  | 'screening_pass_disagreement'
  | 'qc_selected'
  | 'escalation_missing'
  | 'escalation_applied'
  | 'escalation_created_exclusion'
  | 'human_review_explicit'
  | 'human_review_required_by_result'
  | 'low_confidence_result'
  | 'uncertain_result'

export interface UltraHumanReviewRequirement {
  required: boolean
  reasons: readonly string[]
}

export interface UltraQcSelection {
  selected: boolean
  reasons: readonly string[]
}

export interface UltraFinalVerdictInput {
  pmid: string
  firstPass: UltraScreeningResult
  exclusionChallenge?: UltraScreeningResult | null
  escalation?: UltraScreeningResult | null
  humanReviewRequirement?: UltraHumanReviewRequirement
  qcSelection?: UltraQcSelection
}

export interface UltraFinalVerdictResultSummary {
  relevanceLabel: UltraRelevanceLabel
  decisionConfidence: UltraScreeningResult['decisionConfidence']
  requiresHumanReview: boolean
}

export interface UltraFinalVerdict {
  schemaVersion: typeof ULTRA_FINAL_VERDICT_SCHEMA_VERSION
  policyVersion: typeof ULTRA_FINAL_VERDICT_POLICY_VERSION
  pmid: string
  status: UltraFinalVerdictStatus
  relevanceLabel: UltraRelevanceLabel | null
  resolvedBy: 'first_pass' | 'exclusion_challenge_consensus' | 'escalation' | null
  humanReviewRequired: boolean
  humanReviewReasons: string[]
  qcSelected: boolean
  qcReasons: string[]
  auditReasons: UltraFinalVerdictAuditReason[]
  inputs: {
    firstPass: UltraFinalVerdictResultSummary
    exclusionChallenge: UltraFinalVerdictResultSummary | null
    escalation: UltraFinalVerdictResultSummary | null
  }
}

export interface UltraFinalVerdictBatch {
  schemaVersion: typeof ULTRA_FINAL_VERDICT_SCHEMA_VERSION
  policyVersion: typeof ULTRA_FINAL_VERDICT_POLICY_VERSION
  policyDescription: typeof ULTRA_FINAL_VERDICT_POLICY_DESCRIPTION
  verdictCount: number
  countsByStatus: Record<UltraFinalVerdictStatus, number>
  verdicts: UltraFinalVerdict[]
}

const AUDIT_REASON_ORDER: readonly UltraFinalVerdictAuditReason[] = [
  'first_pass_only',
  'exclusion_challenge_missing',
  'exclusion_challenge_consensus',
  'screening_pass_disagreement',
  'qc_selected',
  'escalation_missing',
  'escalation_applied',
  'escalation_created_exclusion',
  'human_review_explicit',
  'human_review_required_by_result',
  'low_confidence_result',
  'uncertain_result',
]

function normalizedReasons(values: readonly string[] | undefined, field: string) {
  const normalized = (values ?? []).map((value) => value.trim())
  if (normalized.some((value) => !value)) throw new Error(`${field} contains an empty reason.`)
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${field} contains duplicate reasons.`)
  }
  return normalized.sort()
}

function validatedResult(
  result: UltraScreeningResult | null | undefined,
  field: string,
  expectedPmid: string,
) {
  if (!result) return null
  const parsed = ultraScreeningResultSchema.safeParse(result)
  if (!parsed.success) {
    throw new Error(
      `${field} is invalid: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'record'} ${issue.message}`)
        .join('; ')}`,
    )
  }
  if (parsed.data.pmid !== expectedPmid) {
    throw new Error(`${field} PMID ${parsed.data.pmid} does not match ${expectedPmid}.`)
  }
  return parsed.data
}

function summary(result: UltraScreeningResult | null): UltraFinalVerdictResultSummary | null {
  return result
    ? {
        relevanceLabel: result.relevanceLabel,
        decisionConfidence: result.decisionConfidence,
        requiresHumanReview: result.requiresHumanReview,
      }
    : null
}

function orderedAuditReasons(reasons: Set<UltraFinalVerdictAuditReason>) {
  return AUDIT_REASON_ORDER.filter((reason) => reasons.has(reason))
}

function emptyStatusCounts(): Record<UltraFinalVerdictStatus, number> {
  return {
    final: 0,
    awaiting_exclusion_challenge: 0,
    awaiting_escalation: 0,
    requires_human_review: 0,
  }
}

/**
 * Reconcile one article without consulting physician truth or mutating a database.
 *
 * Human-review flags are intentionally sticky across stages. A later automated pass cannot erase
 * an earlier explicit requirement for human review. This is stricter than simple majority voting
 * and prevents a clean-looking escalation from silently overriding a safety flag.
 */
export function reconcileUltraFinalVerdict(input: UltraFinalVerdictInput): UltraFinalVerdict {
  if (!/^[0-9]{1,12}$/u.test(input.pmid)) throw new Error('pmid is invalid.')
  const firstPass = validatedResult(input.firstPass, 'firstPass', input.pmid)
  if (!firstPass) throw new Error('firstPass is required.')
  const challenge = validatedResult(input.exclusionChallenge, 'exclusionChallenge', input.pmid)
  const escalation = validatedResult(input.escalation, 'escalation', input.pmid)
  const humanReviewReasons = normalizedReasons(
    input.humanReviewRequirement?.reasons,
    'humanReviewRequirement.reasons',
  )
  const qcReasons = normalizedReasons(input.qcSelection?.reasons, 'qcSelection.reasons')
  const explicitHumanReview = input.humanReviewRequirement?.required === true
  const qcSelected = input.qcSelection?.selected === true
  if (challenge && firstPass.relevanceLabel !== 'exclude') {
    throw new Error('exclusionChallenge is valid only after a first-pass exclusion.')
  }
  const preEscalationStages = [firstPass, challenge].filter(
    (result): result is UltraScreeningResult => result !== null,
  )
  const screeningPassDisagreement =
    challenge !== null && firstPass.relevanceLabel !== challenge.relevanceLabel
  const stickyHumanReviewRoute =
    explicitHumanReview ||
    preEscalationStages.some(
      (result) =>
        result.requiresHumanReview ||
        result.decisionConfidence === 'low' ||
        result.relevanceLabel === 'uncertain',
    )
  if (escalation && !screeningPassDisagreement && !stickyHumanReviewRoute && !qcSelected) {
    throw new Error(
      'escalation requires a screening-pass disagreement, sticky human-review route, or QC selection.',
    )
  }
  const stages = [firstPass, challenge, escalation].filter(
    (result): result is UltraScreeningResult => result !== null,
  )
  const auditReasons = new Set<UltraFinalVerdictAuditReason>()
  if (explicitHumanReview) auditReasons.add('human_review_explicit')
  if (qcSelected) auditReasons.add('qc_selected')
  if (stages.some((result) => result.requiresHumanReview)) {
    auditReasons.add('human_review_required_by_result')
  }
  if (stages.some((result) => result.decisionConfidence === 'low')) {
    auditReasons.add('low_confidence_result')
  }
  if (stages.some((result) => result.relevanceLabel === 'uncertain')) {
    auditReasons.add('uncertain_result')
  }

  const resultRequiresHumanReview = stages.some(
    (result) =>
      result.requiresHumanReview ||
      result.decisionConfidence === 'low' ||
      result.relevanceLabel === 'uncertain',
  )
  const inputs = {
    firstPass: summary(firstPass) as UltraFinalVerdictResultSummary,
    exclusionChallenge: summary(challenge),
    escalation: summary(escalation),
  }
  const base = {
    schemaVersion: ULTRA_FINAL_VERDICT_SCHEMA_VERSION,
    policyVersion: ULTRA_FINAL_VERDICT_POLICY_VERSION,
    pmid: input.pmid,
    humanReviewReasons,
    qcSelected,
    qcReasons,
    inputs,
  }

  if (explicitHumanReview || resultRequiresHumanReview) {
    return {
      ...base,
      status: 'requires_human_review',
      relevanceLabel: null,
      resolvedBy: null,
      humanReviewRequired: true,
      auditReasons: orderedAuditReasons(auditReasons),
    }
  }

  if (firstPass.relevanceLabel === 'exclude' && !challenge) {
    auditReasons.add('exclusion_challenge_missing')
    return {
      ...base,
      status: 'awaiting_exclusion_challenge',
      relevanceLabel: null,
      resolvedBy: null,
      humanReviewRequired: false,
      auditReasons: orderedAuditReasons(auditReasons),
    }
  }

  if (escalation) {
    auditReasons.add('escalation_applied')
    if (challenge && firstPass.relevanceLabel !== challenge.relevanceLabel) {
      auditReasons.add('screening_pass_disagreement')
    }
    const escalationCreatedExclusion =
      escalation.relevanceLabel === 'exclude' &&
      firstPass.relevanceLabel !== 'exclude' &&
      challenge?.relevanceLabel !== 'exclude'
    if (escalationCreatedExclusion) {
      auditReasons.add('escalation_created_exclusion')
      return {
        ...base,
        status: 'requires_human_review',
        relevanceLabel: null,
        resolvedBy: null,
        humanReviewRequired: true,
        auditReasons: orderedAuditReasons(auditReasons),
      }
    }
    return {
      ...base,
      status: 'final',
      relevanceLabel: escalation.relevanceLabel,
      resolvedBy: 'escalation',
      humanReviewRequired: false,
      auditReasons: orderedAuditReasons(auditReasons),
    }
  }

  if (challenge && firstPass.relevanceLabel !== challenge.relevanceLabel) {
    auditReasons.add('screening_pass_disagreement')
    auditReasons.add('escalation_missing')
    return {
      ...base,
      status: 'awaiting_escalation',
      relevanceLabel: null,
      resolvedBy: null,
      humanReviewRequired: false,
      auditReasons: orderedAuditReasons(auditReasons),
    }
  }

  if (qcSelected) {
    auditReasons.add('escalation_missing')
    return {
      ...base,
      status: 'awaiting_escalation',
      relevanceLabel: null,
      resolvedBy: null,
      humanReviewRequired: false,
      auditReasons: orderedAuditReasons(auditReasons),
    }
  }

  if (challenge) {
    auditReasons.add('exclusion_challenge_consensus')
    return {
      ...base,
      status: 'final',
      relevanceLabel: challenge.relevanceLabel,
      resolvedBy: 'exclusion_challenge_consensus',
      humanReviewRequired: false,
      auditReasons: orderedAuditReasons(auditReasons),
    }
  }

  auditReasons.add('first_pass_only')
  return {
    ...base,
    status: 'final',
    relevanceLabel: firstPass.relevanceLabel,
    resolvedBy: 'first_pass',
    humanReviewRequired: false,
    auditReasons: orderedAuditReasons(auditReasons),
  }
}

export function reconcileUltraFinalVerdictBatch(
  inputs: readonly UltraFinalVerdictInput[],
): UltraFinalVerdictBatch {
  const pmids = inputs.map((input) => input.pmid)
  if (new Set(pmids).size !== pmids.length) {
    throw new Error('Final-verdict batch contains duplicate PMIDs.')
  }
  const verdicts = inputs
    .map(reconcileUltraFinalVerdict)
    .sort((left, right) => compareNumericPmids(left.pmid, right.pmid))
  const countsByStatus = emptyStatusCounts()
  for (const verdict of verdicts) countsByStatus[verdict.status] += 1
  return {
    schemaVersion: ULTRA_FINAL_VERDICT_SCHEMA_VERSION,
    policyVersion: ULTRA_FINAL_VERDICT_POLICY_VERSION,
    policyDescription: ULTRA_FINAL_VERDICT_POLICY_DESCRIPTION,
    verdictCount: verdicts.length,
    countsByStatus,
    verdicts,
  }
}
