/**
 * Read-only postflight and lost-acknowledgement reconciliation.
 *
 * Run after an application attempt — including, and especially, after one whose acknowledgement was
 * lost. It classifies the observed target and states the single next action.
 *
 *   npx tsx scripts/literature-dedicated-supabase/postflight.ts \
 *     --owner-approved-commit <sha> --evidence <path.json>
 *
 * Target identity is a **mandatory** input and is checked first. Without a provider-bound
 * attestation the only reachable classification is `provider_attestation_required`; the command
 * never prints `applied_correct` / `proceed` for a target it cannot prove, and the classification
 * and exit status always agree.
 *
 * There is no flag, argument, or code path here that applies, retries, reapplies, compensates, or
 * edits migration history.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  captureLiteratureProviderAttestation,
  evaluateLiteratureProviderAttestation,
} from '../../src/features/literature/dedicated-supabase/attestation'
import {
  LITERATURE_FOUNDATION_FUNCTION_NAMES,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import {
  LITERATURE_DEDICATED_TARGET,
  LITERATURE_FOUNDATION_MIGRATION,
} from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import { LiteratureEvidenceError, parseLiteratureEvidence } from './lib/evidence-schema'
import {
  canonicalJson,
  compareLiteratureCatalog,
  sha256,
  summarizeCatalogPresence,
  type LiteratureCatalogExpectationArtifact,
  type LiteratureCatalogSnapshot,
} from './lib/foundation-catalog'
import { classifyLiteratureRollout } from './lib/reconciliation'
import { LITERATURE_QUERY_BUNDLE_SHA256 } from './lib/target-observation'

const ROOT = process.cwd()
const ARTIFACT_PATH =
  'src/features/literature/dedicated-supabase/foundation-catalog-expectations.json'

function flagValue(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  process.stdout.write('Dedicated Literature foundation rollout — read-only postflight\n')

  const evidencePath = flagValue('--evidence')
  let evidence: Awaited<ReturnType<typeof parseLiteratureEvidence>> | null = null
  let evidenceError: string | null = null

  if (evidencePath) {
    try {
      evidence = parseLiteratureEvidence(await readFile(resolve(ROOT, evidencePath), 'utf8'))
    } catch (error) {
      evidenceError =
        error instanceof LiteratureEvidenceError
          ? `${error.code}: ${error.message}`
          : `unreadable evidence document: ${String(error)}`
    }
  }

  // Layer 3 first. An unproven target is decided before any catalog reasoning happens, so a
  // perfect-looking catalog from an unknown database can never read as success.
  const capture = captureLiteratureProviderAttestation()
  const attestation = evaluateLiteratureProviderAttestation(
    capture.status === 'captured' ? capture.attestation : null,
    {
      projectRef: LITERATURE_DEDICATED_TARGET.projectRef,
      queryBundleSha256: LITERATURE_QUERY_BUNDLE_SHA256,
      ownerApprovedCommit: flagValue('--owner-approved-commit') ?? '',
      migrationPath: LITERATURE_FOUNDATION_MIGRATION.path,
      migrationSha256: LITERATURE_FOUNDATION_MIGRATION.sha256,
      observedContentSha256: evidence ? sha256(canonicalJson(evidence)) : '',
      nowMs: Date.now(),
    },
  )

  let comparison: { matches: boolean; failures: string[] } | null = null
  let presence: ReturnType<typeof summarizeCatalogPresence> | null = null

  if (evidence) {
    const artifact = JSON.parse(
      await readFile(resolve(ROOT, ARTIFACT_PATH), 'utf8'),
    ) as LiteratureCatalogExpectationArtifact
    const snapshot = evidence.catalog as unknown as LiteratureCatalogSnapshot
    comparison = compareLiteratureCatalog(snapshot, artifact)
    presence = summarizeCatalogPresence(snapshot)
  }

  const verdict = classifyLiteratureRollout({
    targetAttestation: attestation,
    observationComplete: Boolean(evidence) && !evidenceError,
    recordedMigrationVersions: evidence ? evidence.migrationVersions : null,
    presentTables: presence ? presence.presentTables : null,
    presentFunctions: presence ? presence.presentFunctions : null,
    expectedTables: [...LITERATURE_FOUNDATION_TABLES],
    expectedFunctions: [...LITERATURE_FOUNDATION_FUNCTION_NAMES],
    unexpectedLiteratureObjects: presence ? presence.unexpectedLiteratureObjects : [],
    totalRowCount: evidence ? evidence.totalRowCount : null,
    securityChecksPassed: comparison ? comparison.matches : null,
  })

  if (evidenceError) process.stdout.write(`\n  evidence: ${evidenceError}\n`)
  process.stdout.write(`\n  classification: ${verdict.classification}\n`)
  process.stdout.write(`  nextAction: ${verdict.nextAction}\n`)
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

  // Classification and exit status agree: only a fully attested, fully correct result exits 0.
  if (verdict.classification !== 'applied_correct') {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
