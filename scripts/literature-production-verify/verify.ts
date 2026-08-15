/**
 * Read-only production verification for the dedicated Literature Supabase project.
 *
 * Every request this command issues is a `GET`. It never writes a row, never applies a migration,
 * never touches Railway, and never deploys anything. Credentials come from the environment only —
 * a credential passed as an argument stops the run before any environment is read.
 *
 *   npx tsx scripts/literature-production-verify/verify.ts --scenario foundation-empty
 *   npx tsx scripts/literature-production-verify/verify.ts --scenario canary \
 *     --migration-history evidence/list-migrations.json \
 *     --catalog evidence/catalog.json \
 *     --baseline evidence/canary-run-1.json \
 *     --receipt evidence/canary-run-2.json
 *
 * Required environment (never arguments):
 *
 *   LITERATURE_SUPABASE_URL                   https://itcttmkxdxvwmwcmzmey.supabase.co/
 *   LITERATURE_SUPABASE_SECRET_KEY            sb_secret_… (privileged, read-only use here)
 *   LITERATURE_SUPABASE_EXPECTED_PROJECT_REF  itcttmkxdxvwmwcmzmey
 *
 * Optional environment:
 *
 *   LITERATURE_VERIFY_APP_BASE_URL    the deployed application, for application-layer checks
 *   LITERATURE_VERIFY_ADMIN_COOKIE    a site-admin session cookie, for authenticated probes
 *   LITERATURE_VERIFY_ANON_KEY        a publishable key, to prove an anonymous caller is refused
 *
 * Exit status is 0 only for `verified`. `indeterminate` exits nonzero: a run that could not
 * observe what it needed has proven nothing, and a shell `&&` chain must not read it as success.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  collectApplicationObservations,
  collectDatabaseObservations,
  createAnonymousTransport,
} from './lib/collect'
import {
  describeTarget,
  resolveVerificationConfiguration,
  type LiteratureVerificationEnvironment,
} from './lib/configuration'
import { LITERATURE_CANONICAL_PRODUCTION_URL_EXACT } from './lib/identity'
import { failed, observed, skipped, type Observation } from './lib/observation'
import { createReadOnlyTransport } from './lib/read-only-transport'
import { assertNoCredentialInArgument } from './lib/redaction'
import {
  RECEIPT_NOT_AUTHORIZATION,
  exitCodeForVerdict,
  renderReceipt,
  renderScenarioRun,
  writeError,
  writeOut,
} from './lib/report'
import { SCENARIOS, runScenario, scenarioById } from './lib/scenarios'
import type {
  CatalogAttestation,
  CorpusExpectation,
  CorpusSnapshot,
  MigrationHistoryEntry,
} from './lib/checks'

const ROOT = process.cwd()
const DEFAULT_KEYWORD = 'bronchoscopy'

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

/**
 * Read an operator-supplied evidence file.
 *
 * An absent file is `skipped`, not `failed`: the operator chose not to supply it, and the checks
 * that need it report `indeterminate` rather than inventing a default. An unreadable or malformed
 * file is `failed`, because that is a different problem and hiding it would be worse.
 */
async function readEvidence<T>(path: string | undefined, label: string): Promise<Observation<T>> {
  if (!path) {
    return skipped(`no ${label} file was supplied`)
  }
  try {
    const body = await readFile(resolve(ROOT, path), 'utf8')
    return observed(JSON.parse(body) as T)
  } catch (error) {
    return failed(
      'evidence_unreadable',
      `The ${label} file could not be read or parsed: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function usage(): string {
  return [
    'Read-only Literature production verification.',
    '',
    '  npx tsx scripts/literature-production-verify/verify.ts --scenario <id> [options]',
    '',
    'Scenarios:',
    ...SCENARIOS.map((scenario) => `  ${scenario.id.padEnd(24)} ${scenario.title}`),
    '',
    'Options:',
    '  --scenario <id>            required',
    '  --migration-history <path> provider list_migrations output (JSON array)',
    '  --catalog <path>           connector-captured catalog attestation (JSON)',
    '  --corpus <path>            declared source expectation, for --scenario full-corpus',
    '  --baseline <path>          a receipt from a prior run, for canary idempotency',
    '  --receipt <path>           write a redacted receipt of this run',
    '  --pmid <pmid>              a known PMID for the article-detail spot check',
    '  --keyword <word>           keyword for the search check (default: bronchoscopy)',
    '  --json                     print the receipt envelope instead of the report',
    '',
    'Credentials are read from the environment only. Passing one as an argument is refused.',
    '',
  ].join('\n')
}

async function main() {
  // Nonzero until a scenario says otherwise, so an early return, a thrown error, or an unusual
  // flag combination can never leave this process exiting 0 without a verdict.
  process.exitCode = 1

  const credentialOnArgv = assertNoCredentialInArgument(process.argv.slice(2))
  if (credentialOnArgv) {
    writeError(`${credentialOnArgv.message}\n`)
    return
  }

  if (process.argv.includes('--help') || process.argv.length <= 2) {
    writeOut(usage())
    return
  }

  const scenarioId = flagValue('--scenario')
  const scenario = scenarioId ? scenarioById(scenarioId) : null
  if (!scenario) {
    writeError(
      `Unknown or missing --scenario. Expected one of: ` +
        `${SCENARIOS.map((entry) => entry.id).join(', ')}.\n`,
    )
    return
  }

  const environment = process.env as LiteratureVerificationEnvironment
  const configuration = resolveVerificationConfiguration(environment)
  if (configuration.status === 'refused') {
    writeError(`Refused (${configuration.reason}): ${configuration.message}\n`)
    return
  }

  const detailPmid = flagValue('--pmid') ?? null
  const keyword = flagValue('--keyword') ?? DEFAULT_KEYWORD

  const transport = createReadOnlyTransport({
    origin: configuration.database.url,
    credential: configuration.database.credential,
  })
  // A separate transport with no privileged credential. When the operator supplies a publishable
  // key it is used; otherwise the probe runs with no key at all, which is the stronger test.
  const anonymousTransport = createAnonymousTransport(
    configuration.database.url,
    configuration.anonymousKey,
  )

  const [database, application] = await Promise.all([
    collectDatabaseObservations({ transport, anonymousTransport, detailPmid, keyword }),
    collectApplicationObservations({
      baseUrl: configuration.applicationBaseUrl,
      adminCookie: configuration.adminCookie,
      detailPmid,
      keyword,
    }),
  ])

  const [migrationHistory, catalogAttestation, corpusExpectation, baselineSnapshot] =
    await Promise.all([
      readEvidence<readonly MigrationHistoryEntry[]>(
        flagValue('--migration-history'),
        'migration history',
      ),
      readEvidence<CatalogAttestation>(flagValue('--catalog'), 'catalog attestation'),
      readEvidence<CorpusExpectation>(flagValue('--corpus'), 'corpus expectation'),
      readEvidence<CorpusSnapshot>(flagValue('--baseline'), 'baseline snapshot'),
    ])

  const run = runScenario(scenario, {
    target: {
      projectRef: configuration.database.projectRef,
      url: configuration.database.url,
      canonicalUrl: LITERATURE_CANONICAL_PRODUCTION_URL_EXACT,
    },
    database,
    application,
    migrationHistory,
    catalogAttestation,
    corpusExpectation,
    baselineSnapshot,
    currentSnapshot: currentSnapshotFrom(database),
    detailPmid,
  })

  const envelope = {
    schemaVersion: 'literature-production-verification/1.0.0' as const,
    scenario: run.scenario,
    verdict: run.verdict,
    target: describeTarget(configuration.database),
    bindingStatus: configuration.bindingStatus,
    checks: run.checks,
    summary: run.summary,
    stopReason: run.stopReason,
    capturedAt: new Date().toISOString(),
    notAuthorization: RECEIPT_NOT_AUTHORIZATION,
  }

  writeOut(process.argv.includes('--json') ? renderReceipt(envelope) : renderScenarioRun(run))

  const receiptPath = flagValue('--receipt')
  if (receiptPath) {
    await writeFile(resolve(ROOT, receiptPath), renderReceipt(envelope), 'utf8')
    writeOut(`\nReceipt written to ${receiptPath} (redacted).\n`)
  }

  process.exitCode = exitCodeForVerdict(run.verdict)
}

/** The snapshot the idempotency check compares a baseline against. */
function currentSnapshotFrom(
  database: Awaited<ReturnType<typeof collectDatabaseObservations>>,
): Observation<CorpusSnapshot> {
  if (database.totalArticles.status !== 'observed' || database.batches.status !== 'observed') {
    return failed(
      'snapshot_incomplete',
      'The corpus total or the batch list was not observed, so no snapshot was taken. An ' +
        'incomplete snapshot would make a later idempotency comparison meaningless.',
    )
  }
  const batches = database.batches.value
  return observed({
    totalArticles: database.totalArticles.value,
    batchCount: batches.length,
    insertedTotal: batches.reduce((sum, batch) => sum + batch.inserted_count, 0),
    updatedTotal: batches.reduce((sum, batch) => sum + batch.updated_count, 0),
    duplicateTotal: batches.reduce((sum, batch) => sum + batch.duplicate_count, 0),
  })
}

// Not top-level `await`: the `tsx` loader emits CJS here, which does not support it, and the
// sibling CLIs in `scripts/literature-dedicated-supabase/` end the same way.
main().catch((error: unknown) => {
  writeError(`Verification aborted: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
