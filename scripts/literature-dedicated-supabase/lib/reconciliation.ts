/**
 * Post-application reconciliation for the dedicated Literature foundation rollout.
 *
 * The failure mode this exists for is a *lost acknowledgement*: the migration statement is sent,
 * the connection drops, and the operator never learns whether it committed. The wrong reflex is to
 * retry — a second application either fails noisily or, worse, half-succeeds against a schema that
 * is already partly there. The right move is to observe the target read-only and classify.
 *
 * This module is pure. It takes an observation and returns a classification plus the single next
 * action. It never applies, retries, compensates, or edits migration history, and there is no code
 * path here that can.
 */

import {
  LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_VERSIONS,
  LITERATURE_FOUNDATION_MIGRATION,
} from '../../../src/features/literature/dedicated-supabase/foundation-manifest'

export type LiteratureRolloutClassification =
  /** Nothing was applied. The target is still the empty project the preflight described. */
  | 'not_applied'
  /** Applied correctly: exact history, complete inventory, zero rows. */
  | 'applied_correct'
  /** History and inventory are complete, but something about the objects drifted. */
  | 'applied_drifted'
  /** Objects exist but the set is incomplete — a partial or interrupted application. */
  | 'partial_incident'
  /** The observation itself is inconclusive; nothing may be concluded from it. */
  | 'ambiguous'

export type LiteratureRolloutNextAction =
  /** Safe to proceed to the next authorized step. */
  | 'proceed'
  /** Re-run the read-only preflight; a fresh authorization may then apply the migration. */
  | 'reauthorize_from_preflight'
  /** Stop. A human must reconcile read-only before anything else happens. */
  | 'stop_read_only_reconciliation'

export interface LiteratureRolloutObservation {
  /** Whether the read-only observation completed. False means the target could not be inspected. */
  observationComplete: boolean
  /** Migration versions recorded on the target, or null when history could not be read. */
  recordedMigrationVersions: readonly string[] | null
  /** Literature tables actually present, or null when the catalog could not be read. */
  presentTables: readonly string[] | null
  /** Literature functions actually present, or null when the catalog could not be read. */
  presentFunctions: readonly string[] | null
  /** Expected tables, from the catalog expectations. */
  expectedTables: readonly string[]
  /** Expected functions, from the catalog expectations. */
  expectedFunctions: readonly string[]
  /** Objects present that the foundation migration does not create. */
  unexpectedLiteratureObjects: readonly string[]
  /** Row count across all Literature tables, or null when it could not be read. */
  totalRowCount: number | null
  /** True when every RLS/grant/policy/trigger check in the postflight passed. */
  securityChecksPassed: boolean | null
}

export interface LiteratureRolloutVerdict {
  classification: LiteratureRolloutClassification
  nextAction: LiteratureRolloutNextAction
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

function sortedMissing(expected: readonly string[], present: readonly string[]): string[] {
  const seen = new Set(present)
  return expected.filter((name) => !seen.has(name)).sort()
}

/**
 * Classify a read-only observation of the target after an application attempt.
 *
 * The ordering matters. Incomplete observation is ambiguous before anything else is considered,
 * because a partial read must never be reported as a clean result. A present-but-incomplete object
 * set is an incident rather than a drift, because it is the signature of an interrupted apply.
 */
export function classifyLiteratureRollout(
  observation: LiteratureRolloutObservation,
): LiteratureRolloutVerdict {
  const findings: string[] = []
  const constants = {
    automaticRetryPermitted: false,
    automaticReapplicationPermitted: false,
    automaticCompensationPermitted: false,
    migrationHistoryEditPermitted: false,
  } as const

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
    return {
      classification: 'ambiguous',
      nextAction: 'stop_read_only_reconciliation',
      ...constants,
      findings,
    }
  }

  const history = [...observation.recordedMigrationVersions].sort()
  const expectedHistory = [...LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_VERSIONS].sort()
  const historyMatches =
    history.length === expectedHistory.length &&
    history.every((version, index) => version === expectedHistory[index])

  const missingTables = sortedMissing(observation.expectedTables, observation.presentTables)
  const missingFunctions = sortedMissing(
    observation.expectedFunctions,
    observation.presentFunctions,
  )
  const anyObjectPresent =
    observation.presentTables.length > 0 || observation.presentFunctions.length > 0
  const allObjectsPresent = missingTables.length === 0 && missingFunctions.length === 0

  // Nothing recorded and nothing present: the attempt did not land. This is the one state from
  // which a fresh authorization may legitimately apply the migration.
  if (history.length === 0 && !anyObjectPresent) {
    findings.push(
      `No migration history and no Literature objects are present. ` +
        `${LITERATURE_FOUNDATION_MIGRATION.version} was not applied.`,
    )
    return {
      classification: 'not_applied',
      nextAction: 'reauthorize_from_preflight',
      ...constants,
      findings,
    }
  }

  // Objects without history, or history without objects, or a half-built schema. Each of these is
  // an incident: the target is in a state no single successful transaction produces.
  if (!allObjectsPresent || history.length !== expectedHistory.length) {
    if (missingTables.length > 0) findings.push(`Missing tables: ${missingTables.join(', ')}.`)
    if (missingFunctions.length > 0) {
      findings.push(`Missing functions: ${missingFunctions.join(', ')}.`)
    }
    if (!historyMatches) {
      findings.push(
        `Recorded migration history [${history.join(', ')}] does not match the expected ` +
          `[${expectedHistory.join(', ')}].`,
      )
    }
    findings.push(
      'Partial or inconsistent state. Do not reapply and do not repair migration history; ' +
        'reconcile read-only with the owner.',
    )
    return {
      classification: 'partial_incident',
      nextAction: 'stop_read_only_reconciliation',
      ...constants,
      findings,
    }
  }

  if (!historyMatches) {
    findings.push(
      `Recorded migration history [${history.join(', ')}] does not match the expected ` +
        `[${expectedHistory.join(', ')}].`,
    )
    return {
      classification: 'applied_drifted',
      nextAction: 'stop_read_only_reconciliation',
      ...constants,
      findings,
    }
  }

  if (observation.unexpectedLiteratureObjects.length > 0) {
    findings.push(
      `Unexpected Literature objects present: ` +
        `${[...observation.unexpectedLiteratureObjects].sort().join(', ')}.`,
    )
  }
  if (observation.securityChecksPassed === false) {
    findings.push('One or more RLS, grant, policy, or trigger checks failed.')
  }
  if (observation.securityChecksPassed === null) {
    findings.push('Security checks could not be evaluated.')
  }
  if (observation.totalRowCount === null) {
    findings.push('Literature row counts could not be evaluated.')
  } else if (observation.totalRowCount !== 0) {
    findings.push(
      `Literature tables hold ${observation.totalRowCount} rows. A foundation-only rollout ` +
        'imports no data.',
    )
  }

  if (findings.length > 0) {
    return {
      classification: 'applied_drifted',
      nextAction: 'stop_read_only_reconciliation',
      ...constants,
      findings,
    }
  }

  findings.push(
    `${LITERATURE_FOUNDATION_MIGRATION.version} is applied, the object inventory is exact, ` +
      'security checks passed, and the corpus is empty.',
  )
  return {
    classification: 'applied_correct',
    nextAction: 'proceed',
    ...constants,
    findings,
  }
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
      'The acknowledgement was lost. Run the read-only postflight and classify the observed ' +
      'state. Do not resend the migration, do not run migration repair, and do not compensate.',
  }
}
