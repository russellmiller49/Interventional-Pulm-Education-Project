import {
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_EXPECTED_CLASS_COUNTS,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_EXPECTED_PROVENANCE_COUNTS,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_EXPECTED_RELEVANT_COUNT,
} from '../literature-reviewed-overlay/constants'

/**
 * Fixed identities for the Luna universal triage lane.
 *
 * Truth and corpus pins are imported from the reviewed-overlay package — the single existing
 * authority — never re-declared, so drift between lanes is structurally impossible. Everything
 * declared here is lane-local: versions, seeds, directory names, and spend-estimation defaults.
 */

export const LUNA_TRIAGE_LANE_VERSION = 'literature-luna-triage/1.0.0'

/** Re-exported truth/corpus authorities (single source: reviewed-overlay constants). */
export {
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_EXPECTED_CLASS_COUNTS,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_EXPECTED_PROVENANCE_COUNTS,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_EXPECTED_RELEVANT_COUNT,
}

/** Deterministic split identities. */
export const LUNA_SPLIT_SEED = 'literature-luna-split-v1'
export const LUNA_SPLIT_VERSION = 'literature-luna-split/1.0.0'
export const LUNA_DEVELOPMENT_COHORT_SIZE = 430
export const LUNA_LOCKED_SANITY_COHORT_SIZE = 200

/** Deterministic sampling seeds for the rollout cohorts. */
export const LUNA_SMOKE_SEED = 'literature-luna-smoke-v1'
export const LUNA_SMOKE_COHORT_SIZE = 30
export const LUNA_PILOT_SEED = 'literature-luna-pilot-v1'
export const LUNA_PILOT_COHORT_SIZE = 1_000
export const LUNA_AUDIT_SAMPLE_SEED = 'literature-luna-audit-v1'

/** Record-id minting. */
export const LUNA_RECORD_ID_VERSION = 'literature-luna-record-id/1.0.0'

/** Cohort names accepted by `--cohort`. */
export const LUNA_COHORTS = [
  'smoke-30',
  'development-430',
  'locked-sanity-200',
  'pilot-1000',
  'full-corpus',
] as const

export type LunaCohort = (typeof LUNA_COHORTS)[number]

/** The calibration cohorts drawn from the physician-reviewed 630. */
export const LUNA_CALIBRATION_COHORTS: readonly LunaCohort[] = [
  'smoke-30',
  'development-430',
  'locked-sanity-200',
]

/** State layout. All real artifacts live below this gitignored root. */
export const LUNA_DEFAULT_STATE_DIRECTORY = 'local-data/literature-luna-triage'

/**
 * Model defaults for offline request preparation. No base URL and no credential name are
 * declared anywhere in this lane: it prepares request bytes and never sends them.
 */
export const LUNA_DEFAULT_MODEL = 'gpt-5.6-luna'
export const LUNA_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high'] as const
export type LunaReasoningEffort = (typeof LUNA_REASONING_EFFORTS)[number]
export const LUNA_DEFAULT_REASONING_EFFORT: LunaReasoningEffort = 'low'

/** Structured-output identity. */
export const LUNA_OUTPUT_SCHEMA_NAME = 'stage_a_triage'
export const LUNA_MAX_OUTPUT_TOKENS = 2_048

/**
 * Cost estimation. The prices are assumptions recorded for planning and ceiling enforcement,
 * not billing truth. No spend can occur from this lane; the estimate exists so a future,
 * separately authorized adapter can be reviewed against a number computed here in advance.
 */
export const LUNA_COST_ESTIMATOR_VERSION = 'literature-luna-cost-estimator/1.0.0'
export const LUNA_ASSUMED_PRICING = {
  version: LUNA_COST_ESTIMATOR_VERSION,
  assumed: true,
  inputUsdPerMillionTokens: 1.25,
  outputUsdPerMillionTokens: 10,
  batchDiscountMultiplier: 0.5,
} as const
export const LUNA_TOKENS_PER_CHARACTER = 0.25
export const LUNA_REQUEST_TOKEN_OVERHEAD = 48
export const LUNA_STRUCTURED_OUTPUT_TOKEN_ALLOWANCE = 96
export const LUNA_REASONING_OUTPUT_TOKEN_ALLOWANCE: Readonly<Record<LunaReasoningEffort, number>> =
  {
    minimal: 64,
    low: 256,
    medium: 768,
    high: 2_048,
  }

/** Batch sharding ceilings (defaults; the CLI can lower but not remove them). */
export const LUNA_BATCH_MAX_RECORDS_PER_SHARD = 5_000
export const LUNA_BATCH_MAX_ESTIMATED_TOKENS_PER_SHARD = 6_000_000
/** The relative request path written into each prepared Batch line. Not a host. */
export const LUNA_BATCH_ENDPOINT = '/v1/responses'

/** Evaluation identity. Evaluation is descriptive; this lane declares no qualification. */
export const LUNA_EVALUATION_VERSION = 'literature-luna-evaluation/1.0.0'
export const LUNA_SUBGROUP_SUPPRESSION_MINIMUM = 20

/** Review artifacts. */
export const LUNA_REVIEW_ARTIFACT_VERSION = 'literature-luna-review/1.0.0'
export const LUNA_REVIEW_ACTIONS = [
  'retain_for_stage_b',
  'confirm_deprioritization_candidate',
  'insufficient_evidence',
  'flag_systematic_miss',
] as const
export type LunaReviewAction = (typeof LUNA_REVIEW_ACTIONS)[number]

/** Loopback review server. */
export const LUNA_REVIEW_APP_HOST = '127.0.0.1'
export const LUNA_REVIEW_APP_DEFAULT_PORT = 4630
