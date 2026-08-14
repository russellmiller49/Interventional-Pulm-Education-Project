/**
 * Post-application reconciliation for the dedicated Literature foundation rollout.
 *
 * The failure mode this exists for is a *lost acknowledgement*: the migration statement is sent,
 * the connection drops, and the operator never learns whether it committed. The wrong reflex is to
 * retry — a second application either fails noisily or, worse, half-succeeds against a schema that
 * is already partly there. The right move is to observe the target read-only and classify.
 *
 * Three review rounds shaped this module, each narrowing what it is allowed to say.
 *
 * **M-3** — the classifier could once print `applied_correct` / `proceed` for a target it had no
 * proof of. The first correction made an attestation verdict a mandatory input — and the second
 * review then demonstrated that any function *accepting* an attestation-shaped input can be fed a
 * forged plain object (a bare attested-status literal, an `as any` cast, a deserialized fixture)
 * and made to emit success. The final correction is structural: this module no longer accepts any
 * attestation input, and its verdict unions no longer contain `applied_correct` or `proceed` at
 * all. What remains is a **non-authoritative content assessment** — every name carries the
 * `_nonauthoritative` suffix — wrapped in a final classification that is always
 * `provider_attestation_required` with next action `stop_read_only_reconciliation`, because the
 * provider-bound Layer-3 adapter does not exist in this repository. The future adapter PR,
 * separately reviewed, will be the first change permitted to reintroduce a success verdict.
 *
 * **H-5** — the recorded migration *version* is not asserted against the historical filename
 * version. The managed apply mechanism assigns the version, so content assessment binds "exactly
 * one recorded migration" plus checksums, never a specific version string.
 *
 * This module is pure. It never applies, retries, compensates, or edits migration history, and
 * there is no code path here that can.
 */

import { LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_COUNT } from '../../../src/features/literature/dedicated-supabase/foundation-manifest'

/**
 * The only final classification this repository can produce while Layer 3 is absent. There is
 * deliberately no `applied_correct` member — the type cannot express production success.
 */
export type LiteratureRolloutClassification = 'provider_attestation_required'

/**
 * The only reachable next action. There is deliberately no `proceed` member. Even a target whose
 * *content* looks untouched must stop here: without provider-bound identity, "untouched" is a
 * statement about a document, not about the production database.
 */
export type LiteratureRolloutNextAction = 'stop_read_only_reconciliation'

/**
 * What the observed *content* looks like. Every member is explicitly non-authoritative: these
 * describe a document, not a proven database, and none of them unlocks any action.
 */
export type LiteratureContentAssessment =
  /** The observation did not complete; nothing may be concluded even about the content. */
  | 'content_observation_incomplete_nonauthoritative'
  /** No history and no Literature objects appear in the evidence. */
  | 'content_absent_nonauthoritative'
  /** The content shows a state no single successful transaction produces. */
  | 'content_partial_incident_nonauthoritative'
  /** History and inventory are complete, but something about the objects drifted. */
  | 'content_drifted_nonauthoritative'
  /** The catalog content matches the expected foundation state exactly. Still not permission. */
  | 'catalog_matches_expected_nonauthoritative'

export interface LiteratureRolloutObservation {
  /** Whether the read-only observation completed. False means the target could not be inspected. */
  observationComplete: boolean
  /** Migration versions recorded in the evidence, or null when history could not be read. */
  recordedMigrationVersions: readonly string[] | null
  /** Literature tables present in the evidence, or null when the catalog could not be read. */
  presentTables: readonly string[] | null
  /** Literature functions present in the evidence, or null when the catalog could not be read. */
  presentFunctions: readonly string[] | null
  /** Expected tables, from the catalog expectations. */
  expectedTables: readonly string[]
  /** Expected functions, from the catalog expectations. */
  expectedFunctions: readonly string[]
  /** Objects present that the foundation migration does not create. */
  unexpectedLiteratureObjects: readonly string[]
  /** Row count across all Literature tables, or null when it could not be read. */
  totalRowCount: number | null
  /** True when every catalog/RLS/grant/policy/trigger check in the postflight passed. */
  securityChecksPassed: boolean | null
}

export interface LiteratureRolloutVerdict {
  /** Always `provider_attestation_required` while Layer 3 is absent. */
  classification: LiteratureRolloutClassification
  /** Always `stop_read_only_reconciliation` while Layer 3 is absent. */
  nextAction: LiteratureRolloutNextAction
  /** Non-authoritative description of what the evidence content shows. */
  contentAssessment: LiteratureContentAssessment
  /** Always false. Retrying after an ambiguous acknowledgement is never permitted. */
  automaticRetryPermitted: false
  /** Always false. This module never authorizes reapplication. */
  automaticReapplicationPermitted: false
  /** Always false. This module never authorizes compensation. */
  automaticCompensationPermitted: false
  /** Always false. Migration history is never edited to resolve an ambiguity. */
  migrationHistoryEditPermitted: false
  findings: readonly string[]
}

const NEVER_PERMITTED = {
  automaticRetryPermitted: false,
  automaticReapplicationPermitted: false,
  automaticCompensationPermitted: false,
  migrationHistoryEditPermitted: false,
} as const

const ALWAYS_BLOCKED = {
  classification: 'provider_attestation_required',
  nextAction: 'stop_read_only_reconciliation',
} as const satisfies Pick<LiteratureRolloutVerdict, 'classification' | 'nextAction'>

function sortedMissing(expected: readonly string[], present: readonly string[]): string[] {
  const seen = new Set(present)
  return expected.filter((name) => !seen.has(name)).sort()
}

/**
 * Classify a read-only observation of the target after an application attempt.
 *
 * The classification and next action are constants while Layer 3 is absent; what this function
 * actually computes is the non-authoritative content assessment and its findings, which exist for
 * the human reconciling with the owner. An incomplete observation is assessed before anything
 * else, because a partial read must never be reported as a clean content match; a
 * present-but-incomplete object set is an incident rather than drift, because it is the signature
 * of an interrupted apply.
 */
export function classifyLiteratureRollout(
  observation: LiteratureRolloutObservation,
): LiteratureRolloutVerdict {
  const findings: string[] = [
    'Target identity is not proven: the provider-bound Layer-3 adapter is not implemented in ' +
      'this repository. Every statement below describes evidence content only, and no content, ' +
      'however perfect, authorizes any action.',
  ]

  const conclude = (contentAssessment: LiteratureContentAssessment): LiteratureRolloutVerdict => ({
    ...ALWAYS_BLOCKED,
    contentAssessment,
    ...NEVER_PERMITTED,
    findings,
  })

  if (
    !observation.observationComplete ||
    observation.recordedMigrationVersions === null ||
    observation.presentTables === null ||
    observation.presentFunctions === null
  ) {
    findings.push(
      'The read-only observation did not complete, so no conclusion may be drawn about whether ' +
        'the migration was applied.',
    )
    return conclude('content_observation_incomplete_nonauthoritative')
  }

  const history = [...observation.recordedMigrationVersions].sort()
  const missingTables = sortedMissing(observation.expectedTables, observation.presentTables)
  const missingFunctions = sortedMissing(
    observation.expectedFunctions,
    observation.presentFunctions,
  )
  const anyObjectPresent =
    observation.presentTables.length > 0 || observation.presentFunctions.length > 0
  const allObjectsPresent = missingTables.length === 0 && missingFunctions.length === 0

  // Nothing recorded and nothing present: the evidence content says the attempt did not land.
  // Whether the *database* is in that state is exactly what Layer 3 would have to prove.
  if (history.length === 0 && !anyObjectPresent) {
    findings.push(
      'The evidence content records no migration history and no Literature objects. As content, ' +
        'that is the shape of a target where the foundation migration was not applied — but ' +
        'establishing that about the real database, and any fresh authorization, requires the ' +
        'provider-bound gate.',
    )
    return conclude('content_absent_nonauthoritative')
  }

  // Objects without history, or history without objects, or a half-built schema. Each of these is
  // an incident signature: a state no single successful transaction produces.
  if (
    !allObjectsPresent ||
    history.length !== LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_COUNT
  ) {
    if (missingTables.length > 0) findings.push(`Missing tables: ${missingTables.join(', ')}.`)
    if (missingFunctions.length > 0) {
      findings.push(`Missing functions: ${missingFunctions.join(', ')}.`)
    }
    if (history.length !== LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_COUNT) {
      findings.push(
        `The evidence records ${history.length} migration(s) ` +
          `[${history.join(', ')}]; exactly ` +
          `${LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_COUNT} is expected.`,
      )
    }
    findings.push(
      'Partial or inconsistent content. Do not reapply and do not repair migration history; ' +
        'reconcile read-only with the owner.',
    )
    return conclude('content_partial_incident_nonauthoritative')
  }

  const driftFindings: string[] = []
  if (observation.unexpectedLiteratureObjects.length > 0) {
    driftFindings.push(
      `Unexpected Literature objects present: ` +
        `${[...observation.unexpectedLiteratureObjects].sort().join(', ')}.`,
    )
  }
  if (observation.securityChecksPassed === false) {
    driftFindings.push('One or more catalog, RLS, grant, policy, or trigger checks failed.')
  }
  if (observation.securityChecksPassed === null) {
    driftFindings.push('Security checks could not be evaluated.')
  }
  if (observation.totalRowCount === null) {
    driftFindings.push('Literature row counts could not be evaluated.')
  } else if (!Number.isInteger(observation.totalRowCount) || observation.totalRowCount < 0) {
    driftFindings.push(
      `Literature row count ${observation.totalRowCount} is not a non-negative integer.`,
    )
  } else if (observation.totalRowCount !== 0) {
    driftFindings.push(
      `Literature tables hold ${observation.totalRowCount} rows. A foundation-only rollout ` +
        'imports no data.',
    )
  }

  if (driftFindings.length > 0) {
    findings.push(...driftFindings)
    return conclude('content_drifted_nonauthoritative')
  }

  findings.push(
    'The evidence content matches the expected foundation state exactly: one recorded ' +
      'migration, exact object inventory, security checks passed, empty corpus. This remains a ' +
      'statement about a document. It does not establish which database produced it, and it ' +
      'authorizes nothing.',
  )
  return conclude('catalog_matches_expected_nonauthoritative')
}

/**
 * The response to a lost acknowledgement, stated as data so a test can assert it.
 *
 * An operator who does not know whether the apply committed transitions to read-only observation.
 * There is deliberately no branch here that returns a retry.
 */
export function resolveLostAcknowledgement(): {
  nextAction: LiteratureRolloutNextAction
  automaticRetryPermitted: false
  instruction: string
} {
  return {
    nextAction: 'stop_read_only_reconciliation',
    automaticRetryPermitted: false,
    instruction:
      'The acknowledgement was lost. Observe the target read-only and classify the content, ' +
      'then reconcile with the owner. Do not resend the migration, do not run migration repair, ' +
      'and do not compensate. No classification can exceed provider_attestation_required until ' +
      'the provider-bound adapter exists.',
  }
}
