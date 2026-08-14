/**
 * Read-only postflight and lost-acknowledgement reconciliation.
 *
 * Run after an application attempt — including, and especially, after one whose acknowledgement was
 * lost. It classifies the observed target as not-applied, applied-correct, applied-drifted,
 * partial-incident, or ambiguous, and states the single next action.
 *
 *   npx tsx scripts/literature-dedicated-supabase/postflight.ts --observation <path.json>
 *
 * There is no flag, argument, or code path here that applies, retries, reapplies, compensates, or
 * edits migration history. The only output is a classification.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_FOUNDATION_FUNCTIONS,
  LITERATURE_FOUNDATION_TABLES,
} from '../../src/features/literature/dedicated-supabase/catalog-expectations'
import { LITERATURE_DEDICATED_TARGET } from '../../src/features/literature/dedicated-supabase/foundation-manifest'
import { compareLiteratureCatalog, summarizeCatalogPresence } from './lib/foundation-catalog'
import { classifyLiteratureRollout } from './lib/reconciliation'
import { parseTargetObservation } from './lib/target-observation'

const ROOT = process.cwd()

function flagValue(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const observationPath = flagValue('--observation')
  process.stdout.write('Dedicated Literature foundation rollout — read-only postflight\n')

  if (!observationPath) {
    // A missing observation is itself ambiguous: nothing may be concluded, and the correct next
    // step is read-only reconciliation rather than any corrective action.
    const verdict = classifyLiteratureRollout({
      observationComplete: false,
      recordedMigrationVersions: null,
      presentTables: null,
      presentFunctions: null,
      expectedTables: [...LITERATURE_FOUNDATION_TABLES],
      expectedFunctions: LITERATURE_FOUNDATION_FUNCTIONS.map((entry) => entry.name),
      unexpectedLiteratureObjects: [],
      totalRowCount: null,
      securityChecksPassed: null,
    })
    process.stdout.write(
      `\n  classification: ${verdict.classification}\n  nextAction: ${verdict.nextAction}\n`,
    )
    for (const finding of verdict.findings) process.stdout.write(`  - ${finding}\n`)
    process.exitCode = 1
    return
  }

  const observation = parseTargetObservation(await readFile(resolve(ROOT, observationPath), 'utf8'))

  const targetIsApproved = observation.projectRef === LITERATURE_DEDICATED_TARGET.projectRef
  const comparison = compareLiteratureCatalog(observation.catalog)
  const presence = summarizeCatalogPresence(observation.catalog)

  const verdict = classifyLiteratureRollout({
    observationComplete: true,
    recordedMigrationVersions: observation.migrationVersions,
    presentTables: presence.presentTables,
    presentFunctions: presence.presentFunctions,
    expectedTables: [...LITERATURE_FOUNDATION_TABLES],
    expectedFunctions: [...new Set(LITERATURE_FOUNDATION_FUNCTIONS.map((entry) => entry.name))],
    unexpectedLiteratureObjects: presence.unexpectedLiteratureObjects,
    totalRowCount: observation.totalRowCount ?? null,
    securityChecksPassed: comparison.matches,
  })

  process.stdout.write(`\n  observed project: ${observation.projectRef}\n`)
  if (!targetIsApproved) {
    process.stdout.write(
      `  WARNING: that is not the approved dedicated project ` +
        `(${LITERATURE_DEDICATED_TARGET.projectRef}).\n`,
    )
  }
  process.stdout.write(`  classification: ${verdict.classification}\n`)
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
  if (!comparison.matches) {
    process.stdout.write('\n  catalog differences:\n')
    for (const failure of comparison.failures) process.stdout.write(`    - ${failure}\n`)
  }

  if (verdict.classification !== 'applied_correct' || !targetIsApproved) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
