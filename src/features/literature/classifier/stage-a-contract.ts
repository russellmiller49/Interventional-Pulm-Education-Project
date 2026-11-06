import { z } from 'zod'

import { COORDINATOR_RISK_FLAGS } from './risk-lexicon'

/**
 * Stage-A universal negative-triage contract for the literature Luna classifier lane.
 *
 * This module is deliberately pure and browser-safe: it imports only `zod` and the sibling
 * risk lexicon (itself import-free), touches no filesystem, network, environment, or crypto,
 * and never sees a PMID. Everything here is a
 * closed vocabulary or a total function over already-validated values, so the same contract
 * can back the node CLI, tests, and any future review surface without duplication.
 *
 * The contract encodes one asymmetry everywhere: a mistake that advances an article costs a
 * later classification pass, while a mistake that deprioritizes a relevant article is the
 * failure mode the whole platform exists to prevent. Every ambiguous state therefore resolves
 * to advancement.
 */

export const STAGE_A_CONTRACT_VERSION = 'literature-luna-stage-a/1.0.0'

export const STAGE_A_TRIAGE_DECISIONS = [
  'obvious_irrelevant',
  'potentially_relevant',
  'insufficient_evidence',
] as const

export type StageATriageDecision = (typeof STAGE_A_TRIAGE_DECISIONS)[number]

/** Ordinal model-reported confidence. Not a calibrated probability. */
export const STAGE_A_CONFIDENCE_BANDS = ['high', 'medium', 'low'] as const

export type StageAConfidenceBand = (typeof STAGE_A_CONFIDENCE_BANDS)[number]

/**
 * Reasons that may support `obvious_irrelevant`, and nothing else. Each asserts a positive
 * identification of a domain clearly outside interventional pulmonology's reach.
 */
export const STAGE_A_NEGATIVE_ONLY_REASON_CODES = [
  'clearly_nonpulmonary_domain',
  'clearly_nonthoracic_procedure',
  'clearly_unrelated_anatomy_or_specialty',
  'nonpulmonary_basic_science',
  'unrelated_condition_or_population',
] as const

export type StageANegativeOnlyReasonCode = (typeof STAGE_A_NEGATIVE_ONLY_REASON_CODES)[number]

/**
 * Protective and escalation reasons. Any one of these names a signal that the article could
 * matter to the specialty, or that the evidence is too weak to say. Their presence makes an
 * `obvious_irrelevant` decision invalid by contract.
 */
export const STAGE_A_PROTECTIVE_REASON_CODES = [
  'possible_airway_relevance',
  'possible_pleural_relevance',
  'possible_thoracic_oncology_relevance',
  'possible_pulmonary_procedural_relevance',
  'possible_critical_care_relevance',
  'pulmonary_relevance_unclear',
  'possible_anesthesia_relevance',
  'possible_imaging_relevance',
  'possible_pathology_relevance',
  'legacy_or_unfamiliar_terminology',
  'ambiguous_or_nonspecific_title',
  'metadata_insufficient',
  'title_abstract_conflict',
] as const

export type StageAProtectiveReasonCode = (typeof STAGE_A_PROTECTIVE_REASON_CODES)[number]

export const STAGE_A_REASON_CODES = [
  ...STAGE_A_NEGATIVE_ONLY_REASON_CODES,
  ...STAGE_A_PROTECTIVE_REASON_CODES,
] as const

export type StageAReasonCode = (typeof STAGE_A_REASON_CODES)[number]

const NEGATIVE_ONLY_REASON_SET: ReadonlySet<string> = new Set(STAGE_A_NEGATIVE_ONLY_REASON_CODES)
const PROTECTIVE_REASON_SET: ReadonlySet<string> = new Set(STAGE_A_PROTECTIVE_REASON_CODES)

export function isNegativeOnlyReasonCode(value: string): value is StageANegativeOnlyReasonCode {
  return NEGATIVE_ONLY_REASON_SET.has(value)
}

export function isProtectiveReasonCode(value: string): value is StageAProtectiveReasonCode {
  return PROTECTIVE_REASON_SET.has(value)
}

/**
 * Opaque record ids are minted by the coordinator: 64 lowercase hex characters derived from an
 * operation-owned salt and the packet content. The model can neither predict nor reverse them.
 */
export const STAGE_A_RECORD_ID_PATTERN = /^[0-9a-f]{64}$/u

/**
 * The strict model-output schema. No free-text rationale field exists, deliberately: rationale
 * invites unverifiable narrative, while closed reason codes stay auditable and aggregable.
 */
export const stageAOutputSchema = z
  .object({
    record_id: z.string().regex(STAGE_A_RECORD_ID_PATTERN),
    triage_decision: z.enum(STAGE_A_TRIAGE_DECISIONS),
    confidence_band: z.enum(STAGE_A_CONFIDENCE_BANDS),
    reason_codes: z.array(z.enum(STAGE_A_REASON_CODES)).min(1).max(STAGE_A_REASON_CODES.length),
  })
  .strict()
  .superRefine((output, context) => {
    const unique = new Set(output.reason_codes)
    if (unique.size !== output.reason_codes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason_codes'],
        message: 'Reason codes must be unique.',
      })
    }
    const protective = output.reason_codes.filter((code) => isProtectiveReasonCode(code))
    const negative = output.reason_codes.filter((code) => isNegativeOnlyReasonCode(code))
    if (output.triage_decision === 'obvious_irrelevant') {
      if (protective.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason_codes'],
          message:
            'obvious_irrelevant is invalid whenever any protective or escalation reason is ' +
            'present; the protective signal wins.',
        })
      }
      if (negative.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason_codes'],
          message: 'obvious_irrelevant requires at least one negative-only reason code.',
        })
      }
    } else if (negative.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason_codes'],
        message:
          `${output.triage_decision} may not carry negative-only reason codes; those assert ` +
          'clear irrelevance.',
      })
    }
  })

export type StageAOutput = z.infer<typeof stageAOutputSchema>

export type StageAOutputValidation =
  | { readonly ok: true; readonly output: StageAOutput }
  | { readonly ok: false; readonly issues: readonly string[] }

/** Validate one parsed (already-JSON) model output value against the strict contract. */
export function validateStageAOutput(value: unknown): StageAOutputValidation {
  const parsed = stageAOutputSchema.safeParse(value)
  if (parsed.success) {
    return { ok: true, output: parsed.data }
  }
  const issues = parsed.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `${path}: ${issue.message}`
  })
  return { ok: false, issues }
}

/**
 * Independent risk-analysis evidence for exactly one record.
 *
 * The coordinator's deterministic risk pass is mandatory evidence, not optional metadata: a
 * record with no risk result has not been scanned, and an unscanned record is unknown risk,
 * never zero risk. The shape is exactly what the risk pass writes, so the routing contract can
 * re-validate the stored evidence instead of trusting a caller-built map.
 */
export const stageARiskAnalysisResultSchema = z
  .object({
    recordId: z.string().regex(STAGE_A_RECORD_ID_PATTERN),
    riskFlags: z.array(z.enum(COORDINATOR_RISK_FLAGS)),
  })
  .strict()
  .superRefine((result, context) => {
    if (new Set(result.riskFlags).size !== result.riskFlags.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['riskFlags'],
        message: 'Risk flags must be unique.',
      })
    }
  })

export type StageARiskAnalysisResult = z.infer<typeof stageARiskAnalysisResultSchema>

export type StageARiskAnalysisValidation =
  | { readonly ok: true; readonly result: StageARiskAnalysisResult }
  | { readonly ok: false; readonly issues: readonly string[] }

/** Validate one stored risk-analysis result. An empty `riskFlags` array is a completed scan. */
export function validateStageARiskAnalysisResult(value: unknown): StageARiskAnalysisValidation {
  const parsed = stageARiskAnalysisResultSchema.safeParse(value)
  if (parsed.success) {
    return { ok: true, result: parsed.data }
  }
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `${path}: ${issue.message}`
    }),
  }
}

/**
 * Terminal accounting states for one selected record. Exactly one applies. Everything except
 * `valid_prediction` and `valid_abstention` advances by default and may never be treated as a
 * negative signal about the article.
 */
export const STAGE_A_TERMINAL_STATES = [
  'valid_prediction',
  'valid_abstention',
  'refusal',
  'invalid_quarantined',
  'missing',
  'duplicate',
  'no_attempt',
] as const

export type StageATerminalState = (typeof STAGE_A_TERMINAL_STATES)[number]

export const STAGE_A_ROUTES = [
  'deprioritization_candidate',
  'advance_to_full_relevance_classification',
] as const

export type StageARoute = (typeof STAGE_A_ROUTES)[number]

export interface StageARoutingInput {
  /** The record being routed. Risk evidence must bind to exactly this id. */
  readonly recordId: string
  /** Terminal accounting state assigned by strict ingestion. */
  readonly terminalState: StageATerminalState
  /** The validated output, present only when the terminal state is a valid one. */
  readonly output: StageAOutput | null
  /**
   * The record's independent risk-analysis result, exactly as the coordinator stored it.
   * Mandatory: `null`, a foreign record id, or any malformed value is *missing* evidence and
   * may never be read as zero risk. Never derived from model output.
   */
  readonly riskAnalysisResult: unknown
}

export interface StageARoutingDecision {
  readonly route: StageARoute
  /** Ordered, closed-vocabulary explanation of why the route was chosen. */
  readonly routeReasons: readonly string[]
}

/**
 * The routing contract. Only a schema-valid, identity-bound, high-confidence
 * `obvious_irrelevant` output carrying exclusively negative-only reasons, for a record whose
 * own schema-valid risk-analysis result reports zero flags, may enter
 * `deprioritization_candidate`. Everything else advances.
 */
export function routeStageARecord(input: StageARoutingInput): StageARoutingDecision {
  // Defense in depth. The coordinator already asserts exact one-to-one risk coverage before
  // calling this; if it somehow did not, unusable risk evidence advances the record rather
  // than letting a missing scan masquerade as a clean one.
  const risk = validateStageARiskAnalysisResult(input.riskAnalysisResult)
  if (!risk.ok || risk.result.recordId !== input.recordId) {
    return {
      route: 'advance_to_full_relevance_classification',
      routeReasons: ['risk_evidence_missing_or_unusable_advances_by_default'],
    }
  }
  if (input.terminalState !== 'valid_prediction' || input.output === null) {
    return {
      route: 'advance_to_full_relevance_classification',
      routeReasons: [`terminal_state_${input.terminalState}_advances_by_default`],
    }
  }
  const output = input.output
  if (output.triage_decision !== 'obvious_irrelevant') {
    return {
      route: 'advance_to_full_relevance_classification',
      routeReasons: [`decision_${output.triage_decision}`],
    }
  }
  if (output.confidence_band !== 'high') {
    return {
      route: 'advance_to_full_relevance_classification',
      routeReasons: [`confidence_band_${output.confidence_band}_below_high`],
    }
  }
  if (output.reason_codes.some((code) => isProtectiveReasonCode(code))) {
    return {
      route: 'advance_to_full_relevance_classification',
      routeReasons: ['protective_reason_present'],
    }
  }
  if (!output.reason_codes.every((code) => isNegativeOnlyReasonCode(code))) {
    return {
      route: 'advance_to_full_relevance_classification',
      routeReasons: ['reason_codes_not_negative_only'],
    }
  }
  if (risk.result.riskFlags.length > 0) {
    return {
      route: 'advance_to_full_relevance_classification',
      routeReasons: ['coordinator_risk_flag_present'],
    }
  }
  return {
    route: 'deprioritization_candidate',
    routeReasons: ['high_confidence_negative_with_negative_only_reasons_and_no_risk_flag'],
  }
}
