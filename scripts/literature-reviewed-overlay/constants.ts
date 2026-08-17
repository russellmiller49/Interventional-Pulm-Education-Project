/**
 * Pinned identities and exact expectations for the physician-reviewed overlay operator.
 *
 * Everything a receipt, checkpoint, or verifier compares is pinned here once and imported
 * everywhere, following `scripts/literature-production-ingest/constants.ts`: a check that accepts
 * "some nonempty string" accepts anything at all, so the values are compared by identity.
 */

/**
 * The engine version participates in the deterministic operation identity
 * (`overlayOperationId`), so it is frozen at 1.1.0: bumping it would silently rename the one
 * reviewed operation. Artifact-format evolution is carried by the three schema versions below
 * instead, which identify what a persisted checkpoint, receipt, or reconciliation receipt can
 * prove — never what operation it belongs to.
 */
export const OVERLAY_ENGINE_VERSION = 'literature-reviewed-overlay/1.1.0' as const
/**
 * Bumped to 1.2.0 when every batch began carrying its durable causal request mode
 * (`fresh` | `replay`, fixed before the request is sent and bound into the request body and
 * checksum), and the validator became relational across the whole checkpoint: phase-to-stage
 * agreement, temporal coherence, and mode-consistent effects. A 1.1.0 checkpoint cannot prove
 * in which causal context its requests were sent, so it is refused rather than reinterpreted.
 */
export const OVERLAY_CHECKPOINT_SCHEMA_VERSION =
  'literature-reviewed-overlay-checkpoint/1.2.0' as const
/**
 * Bumped to 1.2.0 when the receipt began carrying the operation's causal mode beside the
 * counters, so a completed receipt can only describe the causal history its checkpoint
 * durably recorded — never one inferred from the destination's later status.
 */
export const OVERLAY_RECEIPT_SCHEMA_VERSION = 'literature-reviewed-overlay-receipt/1.2.0' as const
/**
 * Bumped to 1.2.0 when the reconciliation receipt became a closed strict schema: exact keys
 * and primitive types, per-batch request checksum + causal mode + expected record count +
 * observation checksum, the operation-scope totals that make an extra event or article under
 * the operation visible, and full count arithmetic.
 */
export const OVERLAY_RECONCILIATION_SCHEMA_VERSION =
  'literature-reviewed-overlay-reconciliation/1.2.0' as const
export const OVERLAY_LEASE_SCHEMA_VERSION = 'literature-reviewed-overlay-lease/1.0.0' as const

/** The exact `actor_email` every overlay event carries, and the writer a receipt may name. */
export const OVERLAY_WRITER_IDENTITY = 'literature-reviewed-overlay' as const

/**
 * The cohort authority this operator may claim, mirrored on every operation row and receipt.
 *
 * Named the same way the canary contract names it (`owner-authorized-development-cohort-630`):
 * as a reviewed constant identifying the one authorized cohort, never as a per-row value read
 * back from any source.
 */
export const OVERLAY_SOURCE_IDENTITY =
  'owner-authorized-development-cohort-630/gold-set-v1/gold_standard@sha256:961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59' as const

/**
 * The finalized 630-row V3 development artifact, byte-exact.
 *
 * The artifact is coordinator-only: its bytes are hashed against this pin (and the owner's
 * environment pin) before parsing, and no row content may reach stdout, a log, a checkpoint,
 * a receipt, or an error message.
 */
export const OVERLAY_ARTIFACT_SHA256 =
  '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59' as const

/** The one gold-set batch whose development split is the reviewed-overlay authority. */
export const OVERLAY_BATCH_NAME = 'gold-set-v1' as const
export const OVERLAY_BATCH_KIND = 'gold_standard' as const

/** The development split. The only cohort value this package may name, only as a predicate. */
export const OVERLAY_DEVELOPMENT_SPLIT = 'development' as const

/** Exact expected cohort size and class distribution. Any deviation is a refusal, not a warning. */
export const OVERLAY_EXPECTED_RECORD_COUNT = 630 as const
export const OVERLAY_EXPECTED_CLASS_COUNTS = Object.freeze({
  include_core: 283,
  include_adjacent: 75,
  exclude: 272,
} as const)
export const OVERLAY_EXPECTED_RELEVANT_COUNT = 358 as const

/**
 * Owner-expected enrichment-provenance distribution, in the short cohort vocabulary.
 *
 * The repository does not record this triple elsewhere; the owner supplied it as the expected
 * distribution, and the operator requires the artifact-derived aggregate to equal it exactly.
 * A discrepancy stops the operator with a count-only report — an expectation is never adjusted
 * to match an observation.
 */
export const OVERLAY_EXPECTED_PROVENANCE_COUNTS = Object.freeze({
  physician_confirmed: 192,
  physician_modified: 133,
  qc_accepted: 305,
} as const)

export const OVERLAY_RELEVANCE_VALUES = ['include_core', 'include_adjacent', 'exclude'] as const
export type OverlayRelevance = (typeof OVERLAY_RELEVANCE_VALUES)[number]

export const OVERLAY_PROVENANCE_VALUES = [
  'physician_confirmed',
  'physician_modified',
  'qc_accepted',
] as const
export type OverlayProvenance = (typeof OVERLAY_PROVENANCE_VALUES)[number]

/** Coarse foundation projection of the fine physician class. */
export const OVERLAY_COARSE_RELEVANCE: Readonly<Record<OverlayRelevance, 'included' | 'excluded'>> =
  Object.freeze({
    include_core: 'included',
    include_adjacent: 'included',
    exclude: 'excluded',
  })

/**
 * The two known append-only note corrections, by their checksum-bound lineage.
 *
 * These PMIDs and digests are already public inside this repository
 * (`docs/ip-literature/gold-import-field-lineage-v1.md`, `gold-import-note-disposition.ts`).
 * The overlay never carries the note text; it carries this lineage. A consistency test binds
 * these values to the protected module's exports so they cannot drift silently.
 */
export const OVERLAY_NOTE_CORRECTION_RULE_VERSION =
  'amended-two-row-physician-rationale-exception/1.0.0' as const
export const OVERLAY_NOTE_CORRECTION_AUTHORIZATION_SHA256 =
  'b95fc9785ee355b810981c051db62307e868110e06ffb1a83c09c8eff52bf89a' as const
export const OVERLAY_NOTE_CORRECTIONS = Object.freeze([
  Object.freeze({
    pmid: '36879724',
    expectedHeadRevision: 2,
    rationaleSha256: '7d8f4603076b3adc3e6aef85e22b362b1a000964a5b44cc566b3d1200b51e013',
  }),
  Object.freeze({
    pmid: '39281191',
    expectedHeadRevision: 2,
    rationaleSha256: 'a7ac86081d020100990168edec59c85672b22a0fe966fe75f70bcc9248c1afc7',
  }),
] as const)

/** Every non-corrected persisted head must be exactly a first-revision completed head. */
export const OVERLAY_ORDINARY_HEAD_REVISION = 1 as const

/**
 * The exact persisted-head lineage of the development cohort, verified against the protected
 * local database: exactly nine persisted heads — seven ordinary heads at revision 1 plus the
 * two checksum-bound corrections at revision 2 — and 621 pending items with no persisted
 * review row. A tenth head, a missing head, or an ordinary head above revision 1 means the
 * local persisted state moved and the overlay's lineage assumptions must be re-reviewed.
 */
export const OVERLAY_EXPECTED_PERSISTED_HEAD_COUNT = 9 as const
export const OVERLAY_EXPECTED_ORDINARY_HEAD_COUNT = 7 as const

/** The fixed sentence written to `curation_reason` and event `reason` for every overlay record. */
export const OVERLAY_CURATION_REASON =
  'Physician-reviewed relevance imported from the checksum-bound gold-set-v1 development artifact.' as const

/** Destination protection is identical to the ingest operator and reuses its env contract. */
export {
  APPROVED_PROJECT_NAME,
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  DESTINATION_ENV_NAMES,
  PROHIBITED_ENDOREELS_REF,
} from '../literature-production-ingest/constants'

export const OVERLAY_ARTIFACT_SHA256_ENV_NAME =
  'LITERATURE_REVIEWED_OVERLAY_EXPECTED_ARTIFACT_SHA256' as const
export const OVERLAY_PROJECTION_SHA256_ENV_NAME =
  'LITERATURE_REVIEWED_OVERLAY_EXPECTED_PROJECTION_SHA256' as const
export const OVERLAY_OWNER_AUTHORIZATION_ENV_NAME =
  'LITERATURE_REVIEWED_OVERLAY_OWNER_AUTHORIZATION' as const
export const OVERLAY_STATE_DIR_ENV_NAME = 'LITERATURE_REVIEWED_OVERLAY_STATE_DIR' as const

/** The exact owner-authorization sentence. Anything else, including near misses, is refused. */
export const OVERLAY_OWNER_AUTHORIZATION_SENTENCE =
  'I authorize the exact physician-reviewed overlay of the 630-record development cohort onto IP_Literature production.' as const

export const OVERLAY_DEFAULT_STATE_DIRECTORY = 'local-data/literature-reviewed-overlay' as const

/**
 * The fixed bibliographic corpus the overlay binds to. Every reviewed PMID must already exist
 * in it, the overlay may create no article, and the total must be identical before and after.
 */
export const OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT = 132_350 as const

/**
 * The causal request modes. A batch request is prepared in exactly one of them, decided by the
 * registered operation's status at checkpoint-creation time and durably recorded before the
 * request is sent: `fresh` — the operation was not completed, so this request freshly applies
 * its records; `replay` — the operation was already completed before this run began, so this
 * request may only re-observe. The destination's later status never rewrites a recorded mode.
 */
export const OVERLAY_REQUEST_MODES = ['fresh', 'replay'] as const
export type OverlayRequestMode = (typeof OVERLAY_REQUEST_MODES)[number]

/** Bounded transactions: one RPC call per batch, transactional per call. */
export const OVERLAY_DEFAULT_RECORD_BATCH_LIMIT = 90
export const OVERLAY_MAX_RECORD_BATCH_LIMIT = 250
export const OVERLAY_MIN_RECORD_BATCH_LIMIT = 1

/** The only mutating surface the transport may reach. */
export const OVERLAY_APPLY_RPC = 'apply_literature_reviewed_overlay_batch_v1' as const
/**
 * The only read surface the transport may reach: the bounded, body-based observation RPC.
 * There is deliberately no generic table read, so no PMID can appear in a request URL.
 */
export const OVERLAY_OBSERVE_RPC = 'observe_literature_reviewed_overlay_v1' as const
