/**
 * Read-only postflight and lost-acknowledgement reconciliation.
 *
 * Run after an application attempt — including, and especially, after one whose acknowledgement
 * was lost. It validates the postflight evidence, summarizes what the *content* shows, and stops.
 *
 *   npx tsx scripts/literature-dedicated-supabase/postflight.ts --evidence <path.json>
 *
 * While the provider-bound Layer-3 adapter is unimplemented, the classification is always
 * `provider_attestation_required` and the next action is always `stop_read_only_reconciliation`.
 * The command cannot print `applied_correct` or `proceed` for any input, because those members no
 * longer exist in the verdict types, and it always exits nonzero. The content assessment it prints
 * is explicitly non-authoritative: it describes a document, not a proven database.
 *
 * There is no flag, argument, or code path here that applies, retries, reapplies, compensates, or
 * edits migration history.
 *
 * The nonzero exit status is set at main entry — before any argument-dependent branch — and
 * re-asserted at finalization, so no invocation, early return, or thrown error can leave this
 * preparation-only command exiting 0. (The third review found exactly that hole in the sibling
 * preflight's `--print-query-plans` path; both CLIs now guarantee the status the same way.)
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { requireLiteratureProviderAttestation } from '../../src/features/literature/dedicated-supabase/attestation'
import {
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import { LiteratureEvidenceError, parseLiteraturePostflightEvidence } from './lib/evidence-schema'
import {
  compareLiteratureCatalog,
  evaluateManagedPrerequisiteState,
  summarizeCatalogPresence,
  type LiteratureCatalogExpectationArtifact,
  type LiteratureCatalogSnapshot,
} from './lib/foundation-catalog'
import { classifyLiteratureRollout } from './lib/reconciliation'
import { LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256 } from './lib/target-observation'

const ROOT = process.cwd()
const ARTIFACT_PATH =
  'src/features/literature/dedicated-supabase/foundation-catalog-expectations.json'

function flagValue(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

/** See the module header: the exit status is guaranteed at entry and at finalization. */
function blockExitStatus() {
  process.exitCode = 1
}

async function main() {
  blockExitStatus()

  process.stdout.write('Dedicated Literature foundation rollout — read-only postflight\n')

  const evidencePath = flagValue('--evidence')
  let evidence: Awaited<ReturnType<typeof parseLiteraturePostflightEvidence>> | null = null
  let evidenceError: string | null = null

  if (evidencePath) {
    try {
      evidence = parseLiteraturePostflightEvidence(
        await readFile(resolve(ROOT, evidencePath), 'utf8'),
      )
    } catch (error) {
      evidenceError =
        error instanceof LiteratureEvidenceError
          ? `${error.code}: ${error.message}`
          : `unreadable evidence document: ${String(error)}`
    }
  }

  // L-1: the evidence must have been produced by exactly the postflight complete plan, and the
  // ordered plan requires the existence probe to have licensed the row count and history dump.
  let planViolations: string[] = []
  if (evidence) {
    planViolations = []
    if (evidence.queryPlanSha256 !== LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256) {
      planViolations.push(
        'the evidence does not bind the postflight query-plan identity; a preflight or foreign ' +
          'capture cannot be substituted',
      )
    }
    if (!evidence.existenceProbe.migrationHistoryTableExists) {
      planViolations.push(
        'the existence probe reports no migration-history table, so the migrationVersions dump ' +
          'could not have run validly',
      )
    }
    const provenTables = new Set(evidence.existenceProbe.presentLiteratureTables)
    const unproven = LITERATURE_FOUNDATION_TABLES.filter((table) => !provenTables.has(table))
    if (unproven.length > 0) {
      planViolations.push(
        `the existence probe did not prove these tables present, so the row count could not ` +
          `have run validly: ${unproven.join(', ')}`,
      )
    }
  }

  let comparison: { matches: boolean; failures: string[] } | null = null
  let presence: ReturnType<typeof summarizeCatalogPresence> | null = null
  let prerequisitesPassed: boolean | null = null

  if (evidence && planViolations.length === 0) {
    const artifact = JSON.parse(
      await readFile(resolve(ROOT, ARTIFACT_PATH), 'utf8'),
    ) as LiteratureCatalogExpectationArtifact
    const snapshot = evidence.catalog as unknown as LiteratureCatalogSnapshot
    comparison = compareLiteratureCatalog(snapshot, artifact)
    presence = summarizeCatalogPresence(snapshot)
    prerequisitesPassed = evaluateManagedPrerequisiteState(snapshot, 'post_application').every(
      (entry) => entry.passed,
    )
  }

  // Layer 3 is decisive: without the provider-bound adapter, no content can read as success, and
  // nothing here can consume an attestation-shaped input.
  const attestation = requireLiteratureProviderAttestation()
  process.stdout.write(`\n  layer3: ${attestation.reason}\n`)

  const verdict = classifyLiteratureRollout({
    observationComplete: Boolean(evidence) && !evidenceError && planViolations.length === 0,
    recordedMigrationVersions: evidence ? evidence.migrationVersions : null,
    presentTables: presence ? presence.presentTables : null,
    presentFunctions: presence ? presence.presentFunctions : null,
    expectedTables: [...LITERATURE_FOUNDATION_TABLES],
    expectedFunctions: [...LITERATURE_FOUNDATION_FUNCTION_NAMES],
    unexpectedLiteratureObjects: presence ? presence.unexpectedLiteratureObjects : [],
    totalRowCount: evidence && planViolations.length === 0 ? evidence.totalRowCount : null,
    securityChecksPassed:
      comparison === null || prerequisitesPassed === null
        ? null
        : comparison.matches && prerequisitesPassed,
  })

  if (evidenceError) process.stdout.write(`\n  evidence: ${evidenceError}\n`)
  for (const violation of planViolations) {
    process.stdout.write(`  planViolation: ${violation}\n`)
  }
  process.stdout.write(`\n  classification: ${verdict.classification}\n`)
  process.stdout.write(`  nextAction: ${verdict.nextAction}\n`)
  process.stdout.write(`  contentAssessment: ${verdict.contentAssessment}\n`)
  process.stdout.write(`  automaticRetryPermitted: ${verdict.automaticRetryPermitted}\n`)
  process.stdout.write(
    `  automaticReapplicationPermitted: ${verdict.automaticReapplicationPermitted}\n`,
  )
  process.stdout.write(
    `  automaticCompensationPermitted: ${verdict.automaticCompensationPermitted}\n`,
  )
  process.stdout.write(
    `  migrationHistoryEditPermitted: ${verdict.migrationHistoryEditPermitted}\n`,
  )

  for (const finding of verdict.findings) process.stdout.write(`  - ${finding}\n`)
  if (comparison && !comparison.matches) {
    process.stdout.write('\n  catalog differences:\n')
    for (const failure of comparison.failures) process.stdout.write(`    - ${failure}\n`)
  }

  // The classification is provider_attestation_required by construction, so the exit status is
  // unconditionally nonzero: no automation can chain a success path off this command.
  blockExitStatus()
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  })
  .finally(blockExitStatus)
