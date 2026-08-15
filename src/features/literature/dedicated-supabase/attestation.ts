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
 *   Locally verifiable, and it can *block*, but it cannot authorize a production application.
 *
 *   **Layer 2 — observation-content validation.** Shape and internal consistency of catalog
 *   evidence. Useful, and it catches real drift, but it is **never** proof of origin. A Layer 2
 *   result is audit evidence only and can never authorize an application.
 *
 *   **Layer 3 — provider-bound target attestation.** Authoritative target facts, obtained from an
 *   authenticated, project-scoped, read-only Supabase adapter where the project ref comes from the
 *   adapter's own context rather than an editable body field.
 *
 * Layer 3 is **not implemented in this PR**, and the second independent review established that a
 * structurally typed TypeScript object can never be made unforgeable while the real adapter is
 * absent: any exported evaluator that maps ordinary content to an `attested` verdict can be fed a
 * hand-built object (directly, through a cast, or through deserialized JSON) and its output can be
 * piped into downstream helpers. The correction is therefore **removal, not hardening**:
 *
 *   - there is no exported type whose value represents a satisfied attestation;
 *   - there is no exported function that accepts attestation-shaped input;
 *   - there is no exported function whose return can carry an attested status, a
 *     ready-to-apply or applied-correct verdict, a proceed action, or an authoritative-true flag;
 *   - every production path terminates in `provider_attestation_required` /
 *     `stop_read_only_reconciliation` until a separate, independently reviewed PR implements the
 *     provider-bound adapter — which will introduce the *first* success-capable path.
 *
 * What the future Layer-3 adapter must bind is recorded as inert data in
 * `LITERATURE_LAYER3_REQUIRED_BINDINGS`, so the interface design survives without any dormant
 * success code.
 */

import { LITERATURE_APPROVED_PRODUCTION_PROJECT_REF } from '../server/dedicated-project-contract'

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
 * What the future provider-bound adapter must bind before the first success-capable verdict can
 * exist. This is documentation-as-data: nothing consumes it as an input, no exported function
 * compares anything against it, and holding a value shaped like it grants nothing.
 */
export const LITERATURE_LAYER3_REQUIRED_BINDINGS = {
  captureMechanism: LITERATURE_PROVIDER_CAPTURE_MECHANISM,
  projectRefSource: 'adapter context only — never an operator-editable body field',
  approvedProjectRef: LITERATURE_APPROVED_PRODUCTION_PROJECT_REF,
  migrationHistorySource: 'provider list_migrations, never a manually fabricated SQL result',
  boundFacts: [
    'project ref from the adapter context',
    'project URL as reported by the provider',
    'identity (SHA-256) of the exact read-only query plan that produced the evidence',
    'owner-approved repository commit',
    'foundation migration path and SHA-256',
    'capture timestamp within the freshness window',
    'canonical checksum of the captured evidence content',
    'capture completeness',
  ],
  maxAgeMs: LITERATURE_ATTESTATION_MAX_AGE_MS,
} as const

export type LiteratureAttestationFailureReason =
  | 'provider_attestation_required'
  | 'provider_adapter_not_implemented'

/**
 * The only verdict this module can produce while Layer 3 is absent. There is deliberately no
 * `attested` member: the union itself cannot represent success, so no cast, forged object,
 * deserialized fixture, or `as any` call can smuggle one through a caller's type checks.
 */
export interface LiteratureAttestationVerdict {
  status: 'blocked'
  reason: LiteratureAttestationFailureReason
  detail: string
}

/**
 * Demand a provider-bound attestation. Takes **no input** — there is nothing an operator, a file,
 * an environment variable, or a test fixture could pass that would change the answer — and always
 * returns the blocked verdict, because the provider adapter does not exist in this repository.
 */
export function requireLiteratureProviderAttestation(): LiteratureAttestationVerdict {
  const capture = captureLiteratureProviderAttestation()
  return {
    status: 'blocked',
    reason: 'provider_attestation_required',
    detail:
      'No provider-bound target attestation exists. Repository and content checks are ' +
      'non-authoritative and cannot establish which database produced the evidence. ' +
      capture.detail,
  }
}

export interface LiteratureProviderCaptureResult {
  status: 'unavailable'
  reason: 'provider_adapter_not_implemented'
  detail: string
}

/**
 * The single seam through which a real attestation may ever enter this repository.
 *
 * It is intentionally unimplemented, and its result union has no success member. Implementing it
 * requires an authenticated, project-scoped, read-only Supabase connector, which cannot be added
 * safely in a preparation-only PR. Until a future, separately reviewed change implements it, every
 * production-authorizing path is blocked.
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
