/**
 * Provenance layering for the dedicated Literature rollout.
 *
 * The independent review's blocking finding was that a JSON observation captured from *any*
 * database could be relabelled with the approved project ref and accepted. A checksum does not fix
 * that: hashing proves bytes did not change after hashing, never which database produced them.
 *
 * So the design is split into three layers with different authority:
 *
 *   **Layer 1 — repository validation.** Branch, `HEAD == origin/main == ownerApprovedCommit`,
 *   migration path/bytes/SHA-256, exactly one selected migration, the application mechanism enum.
 *   Fully authoritative, because the repository is right here and every fact is locally verifiable.
 *
 *   **Layer 2 — observation-content validation.** Shape and internal consistency of catalog
 *   evidence. Useful, and it catches real drift, but it is **never** proof of origin. A Layer 2
 *   result is audit evidence only and can never authorize an application.
 *
 *   **Layer 3 — provider-bound target attestation.** Authoritative target facts, obtained from an
 *   authenticated, project-scoped, read-only Supabase adapter where the project ref comes from the
 *   adapter's own context rather than an editable body field.
 *
 * Layer 3 is **not implemented in this PR**, because doing so honestly would require an
 * OAuth/PAT/secret workflow that is out of scope and would be unsafe to add unreviewed. Rather than
 * simulate provenance, `captureLiteratureProviderAttestation()` is a seam that always reports
 * unavailable, and every production-authorizing path therefore fails closed with
 * `provider_attestation_required`. A safe, honestly blocked gate beats false provenance.
 *
 * There is deliberately no function anywhere in this repository that turns a file into a
 * `LiteratureProviderAttestation`.
 */

import {
  LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  LITERATURE_CANONICAL_PRODUCTION_ORIGIN,
} from '../server/dedicated-project-contract'

/**
 * The approved future *read-only capture* channel: a project-scoped, read-only Supabase connector
 * whose project selection is fixed by the adapter context, with no account-wide project listing and
 * no mutating tool available during capture.
 */
export const LITERATURE_PROVIDER_CAPTURE_MECHANISM = 'supabase_project_scoped_read_only_mcp_v1'

/**
 * The approved future *write* mechanism. Exactly one `apply_migration` tool call, against exactly
 * this project, carrying exactly the immutable foundation SQL.
 */
export const LITERATURE_APPROVED_APPLY_MECHANISM = 'supabase_connector_apply_migration_v1'

/** Attestations older than this are refused. Target state is only meaningful while it is fresh. */
export const LITERATURE_ATTESTATION_MAX_AGE_MS = 10 * 60 * 1000

/**
 * Authoritative target evidence. Every field must originate from the provider adapter's own
 * context. In particular `providerProjectRef` must be the ref the adapter is scoped to — never a
 * value read from an operator-supplied document body.
 */
export interface LiteratureProviderAttestation {
  mechanism: typeof LITERATURE_PROVIDER_CAPTURE_MECHANISM
  /** Project ref taken from the adapter context, not from an observation body. */
  providerProjectRef: string
  /** Project URL or identity as returned by the provider. */
  providerProjectUrl: string
  /** Identity of the exact read-only query bundle that produced the evidence. */
  queryBundleSha256: string
  /** The owner-approved repository commit this capture is bound to. */
  repositoryCommit: string
  migrationPath: string
  migrationSha256: string
  /** ISO-8601 capture time, from the capture process. */
  capturedAt: string
  /** Canonical checksum of the captured evidence content. */
  contentSha256: string
  /** Whether every catalog section was captured. Anything but `complete` fails closed. */
  completeness: 'complete' | 'partial'
}

export type LiteratureAttestationFailureReason =
  | 'provider_attestation_required'
  | 'provider_adapter_not_implemented'
  | 'wrong_capture_mechanism'
  | 'wrong_project_ref'
  | 'wrong_project_url'
  | 'wrong_query_bundle'
  | 'wrong_repository_commit'
  | 'wrong_migration_path'
  | 'wrong_migration_checksum'
  | 'stale_attestation'
  | 'invalid_capture_timestamp'
  | 'incomplete_capture'
  | 'content_checksum_mismatch'

export interface LiteratureAttestationExpectation {
  projectRef: string
  queryBundleSha256: string
  ownerApprovedCommit: string
  migrationPath: string
  migrationSha256: string
  /** Canonical checksum recomputed locally from the evidence content. */
  observedContentSha256: string
  /** Evaluation time, injected so the check is deterministic in tests. */
  nowMs: number
}

export type LiteratureAttestationVerdict =
  | { status: 'attested'; attestation: LiteratureProviderAttestation }
  | { status: 'rejected'; reason: LiteratureAttestationFailureReason; detail: string }

/**
 * Evaluate a provider attestation against what the repository expects.
 *
 * Fail-closed throughout: a missing attestation is a rejection, and every binding must match
 * exactly. Nothing here can be satisfied by an operator-authored file, because nothing here
 * constructs an attestation — it only judges one an adapter produced.
 */
export function evaluateLiteratureProviderAttestation(
  attestation: LiteratureProviderAttestation | null | undefined,
  expectation: LiteratureAttestationExpectation,
): LiteratureAttestationVerdict {
  const reject = (
    reason: LiteratureAttestationFailureReason,
    detail: string,
  ): LiteratureAttestationVerdict => ({ status: 'rejected', reason, detail })

  if (!attestation) {
    return reject(
      'provider_attestation_required',
      'No provider-bound target attestation was supplied. Repository and content checks are ' +
        'non-authoritative and cannot establish which database produced the evidence.',
    )
  }
  if (attestation.mechanism !== LITERATURE_PROVIDER_CAPTURE_MECHANISM) {
    return reject(
      'wrong_capture_mechanism',
      `Capture mechanism ${String(attestation.mechanism)} is not ${LITERATURE_PROVIDER_CAPTURE_MECHANISM}.`,
    )
  }
  if (attestation.providerProjectRef !== expectation.projectRef) {
    return reject(
      'wrong_project_ref',
      `Adapter reported project ${attestation.providerProjectRef}, expected ${expectation.projectRef}.`,
    )
  }
  if (attestation.providerProjectUrl !== LITERATURE_CANONICAL_PRODUCTION_ORIGIN) {
    return reject(
      'wrong_project_url',
      `Adapter reported URL ${attestation.providerProjectUrl}, expected ${LITERATURE_CANONICAL_PRODUCTION_ORIGIN}.`,
    )
  }
  if (attestation.queryBundleSha256 !== expectation.queryBundleSha256) {
    return reject(
      'wrong_query_bundle',
      'The attested read-only query bundle is not the bundle this repository defines.',
    )
  }
  if (attestation.repositoryCommit !== expectation.ownerApprovedCommit) {
    return reject(
      'wrong_repository_commit',
      `Attestation is bound to commit ${attestation.repositoryCommit}, not the owner-approved ` +
        `${expectation.ownerApprovedCommit}.`,
    )
  }
  if (attestation.migrationPath !== expectation.migrationPath) {
    return reject('wrong_migration_path', `Attestation names ${attestation.migrationPath}.`)
  }
  if (attestation.migrationSha256 !== expectation.migrationSha256) {
    return reject('wrong_migration_checksum', 'Attestation binds a different migration checksum.')
  }
  if (attestation.completeness !== 'complete') {
    return reject('incomplete_capture', `Capture completeness is ${attestation.completeness}.`)
  }
  if (attestation.contentSha256 !== expectation.observedContentSha256) {
    return reject(
      'content_checksum_mismatch',
      'The attested content checksum does not match the evidence supplied alongside it.',
    )
  }

  const capturedMs = Date.parse(attestation.capturedAt)
  if (!Number.isFinite(capturedMs)) {
    return reject(
      'invalid_capture_timestamp',
      `capturedAt ${attestation.capturedAt} is not a date.`,
    )
  }
  const ageMs = expectation.nowMs - capturedMs
  if (ageMs < 0 || ageMs > LITERATURE_ATTESTATION_MAX_AGE_MS) {
    return reject(
      'stale_attestation',
      `Attestation age ${Math.round(ageMs / 1000)}s is outside the ` +
        `${LITERATURE_ATTESTATION_MAX_AGE_MS / 1000}s freshness window.`,
    )
  }

  return { status: 'attested', attestation }
}

export type LiteratureProviderCaptureResult =
  | { status: 'captured'; attestation: LiteratureProviderAttestation }
  | { status: 'unavailable'; reason: LiteratureAttestationFailureReason; detail: string }

/**
 * The single seam through which a real attestation may ever enter this repository.
 *
 * It is intentionally unimplemented. Implementing it requires an authenticated, project-scoped,
 * read-only Supabase connector, which cannot be added safely in a preparation-only PR. Until a
 * future, separately reviewed change implements it, every production-authorizing path is blocked.
 *
 * Do not "temporarily" satisfy this from a file, an environment variable, or a CLI flag. Doing so
 * would reintroduce exactly the blocking finding this layering exists to fix.
 */
export function captureLiteratureProviderAttestation(): LiteratureProviderCaptureResult {
  return {
    status: 'unavailable',
    reason: 'provider_adapter_not_implemented',
    detail:
      'No project-scoped read-only Supabase adapter is implemented in this repository. The future ' +
      'execution session must obtain the attestation directly through a project-scoped Supabase ' +
      `connector (${LITERATURE_PROVIDER_CAPTURE_MECHANISM}) bound to ` +
      `${LITERATURE_APPROVED_PRODUCTION_PROJECT_REF}. Copy-pasted or manually edited JSON must ` +
      'never authorize a migration.',
  }
}
