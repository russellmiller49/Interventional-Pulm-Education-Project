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

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

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

/** A flag's value, or a refusal describing why the argument list is not usable. */
type FlagResult = { value: string | undefined } | { error: string }

/**
 * Read one flag's value.
 *
 * Two things it deliberately refuses rather than guesses at:
 *
 *   - `--flag=value`. Only the space-separated form is read, so accepting the joined form silently
 *     would mean `--receipt=evidence.json` runs to completion, prints a normal report and a normal
 *     exit code, and writes no file. The only signal would be the *absence* of a line, which is
 *     exactly the kind of thing nobody notices until the evidence is needed.
 *   - A value that is itself a flag. `--receipt --json` would otherwise take `--json` as the
 *     receipt path and write the receipt to a file called `--json`.
 */
function flagValue(name: string): FlagResult {
  const joined = process.argv.find((argument) => argument.startsWith(`${name}=`))
  if (joined !== undefined) {
    return {
      error: `${name}=<value> is not supported. Use the space-separated form: ${name} <value>.`,
    }
  }
  const index = process.argv.indexOf(name)
  if (index < 0) return { value: undefined }
  const next = process.argv[index + 1]
  if (next === undefined || next.startsWith('--')) {
    return { error: `${name} requires a value; the next argument was ${next ?? '(nothing)'}.` }
  }
  return { value: next }
}

/**
 * Read an operator-supplied evidence file, and check its shape.
 *
 * An absent file is `skipped`, not `failed`: the operator chose not to supply it, and the checks
 * that need it report `indeterminate` rather than inventing a default. An unreadable file is
 * `failed`.
 *
 * The shape check is the part that was missing. Casting parsed JSON to `T` and handing it to a
 * check meant that a file which merely *parsed* — the provider's `list_migrations` response saved
 * as it came back, `{"migrations": [...]}` rather than a bare array — reached `entries.map(...)`
 * on a plain object and threw. The run then aborted with an empty report, no verdict, and no
 * receipt, over a file that was one unwrapping away from correct. A shape mismatch is now a
 * `failed` observation, so the check reports `indeterminate` and every other check still runs.
 */
async function readEvidence<T>(
  path: string | undefined,
  label: string,
  hasExpectedShape: (value: unknown) => boolean,
  expectedShape: string,
): Promise<Observation<T>> {
  if (!path) {
    return skipped(`no ${label} file was supplied`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(resolve(ROOT, path), 'utf8')) as unknown
  } catch (error) {
    return failed(
      'evidence_unreadable',
      `The ${label} file could not be read or parsed: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!hasExpectedShape(parsed)) {
    return failed(
      'evidence_wrong_shape',
      `The ${label} file parsed but is not the expected shape (${expectedShape}). It is reported ` +
        'as unusable rather than being read as an empty or partial answer.',
    )
  }
  return observed(parsed as T)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMigrationHistory(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((entry) => isObject(entry) && typeof entry.version === 'string')
  )
}

function isCatalogAttestation(value: unknown): boolean {
  if (!isObject(value)) return false
  return ['tables', 'functions', 'indexes', 'triggers', 'policies', 'rlsEnabledTables'].every(
    (key) => Array.isArray(value[key]),
  )
}

function isCorpusExpectation(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.sourceRecordCount === 'number' &&
    typeof value.sourceDistinctPmidCount === 'number' &&
    Array.isArray(value.sourceFiles)
  )
}

/**
 * Extract the corpus snapshot from a `--baseline` file.
 *
 * The baseline an operator supplies is the receipt a previous run wrote — that is what the runbook
 * tells them to keep, and there is nothing else for them to supply. Reading it as a bare snapshot
 * meant `baseline.totalArticles` was `undefined`, `25 - undefined` was `NaN`, and the idempotency
 * check reported a confident "not idempotent: the corpus moved from undefined to 25". A wrong
 * answer dressed as a finding.
 *
 * Both forms are accepted now: a receipt envelope (`{ snapshot: {...} }`) and a bare snapshot,
 * for a baseline captured by hand.
 */
function extractSnapshot(value: unknown): unknown {
  if (isObject(value) && isObject(value.snapshot)) return value.snapshot
  return value
}

function isCorpusSnapshot(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.totalArticles === 'number' &&
    typeof value.batchCount === 'number' &&
    typeof value.insertedTotal === 'number'
  )
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

  // Every flag is read up front, so a malformed argument list stops the run before a single
  // request goes out rather than half way through one.
  const flags = {
    scenario: flagValue('--scenario'),
    pmid: flagValue('--pmid'),
    keyword: flagValue('--keyword'),
    migrationHistory: flagValue('--migration-history'),
    catalog: flagValue('--catalog'),
    corpus: flagValue('--corpus'),
    baseline: flagValue('--baseline'),
    receipt: flagValue('--receipt'),
  }
  const flagError = Object.values(flags).find(
    (result): result is { error: string } => 'error' in result,
  )
  if (flagError) {
    writeError(`${flagError.error}\n`)
    return
  }
  const value = (result: FlagResult) => ('error' in result ? undefined : result.value)

  const scenarioId = value(flags.scenario)
  const scenario = scenarioId ? scenarioById(scenarioId) : null
  if (!scenario) {
    writeError(
      `Unknown or missing --scenario. Expected one of: ` +
        `${SCENARIOS.map((entry) => entry.id).join(', ')}.\n`,
    )
    return
  }

  // A PMID is `\d{1,12}`, the same rule the application's own route applies. Validating it here
  // is not pedantry: `--pmid` is echoed into the report and the receipt, so an arbitrary token
  // parked in it would be written out verbatim — which is precisely what the credential guard
  // exists to prevent, and which that guard cannot catch for a credential shape it has never seen.
  const detailPmid = value(flags.pmid) ?? null
  if (detailPmid !== null && !/^\d{1,12}$/u.test(detailPmid)) {
    writeError(
      '--pmid must be a PubMed identifier (1 to 12 digits). It is echoed into the report and the ' +
        'receipt, so anything else is refused rather than written out.\n',
    )
    return
  }
  const keyword = value(flags.keyword) ?? DEFAULT_KEYWORD

  const environment = process.env as LiteratureVerificationEnvironment
  const configuration = resolveVerificationConfiguration(environment)
  if (configuration.status === 'refused') {
    writeError(`Refused (${configuration.reason}): ${configuration.message}\n`)
    return
  }

  const transport = createReadOnlyTransport({
    origin: configuration.database.url,
    credential: configuration.database.credential,
  })
  // Only ever built from a key that is structurally unprivileged. Without one, the exposure probes
  // are skipped and their checks report no verdict — see `createAnonymousTransport`.
  const anonymous = createAnonymousTransport(configuration.database.url, configuration.anonymousKey)

  const [database, application] = await Promise.all([
    collectDatabaseObservations({
      transport,
      anonymousTransport: anonymous.transport,
      anonymousProbeRefusal: anonymous.detail,
      detailPmid,
      keyword,
    }),
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
        value(flags.migrationHistory),
        'migration history',
        isMigrationHistory,
        'a JSON array of { version, name? } entries, as list_migrations returns them',
      ),
      readEvidence<CatalogAttestation>(
        value(flags.catalog),
        'catalog attestation',
        isCatalogAttestation,
        'an object with tables, functions, indexes, triggers, policies and rlsEnabledTables arrays',
      ),
      readEvidence<CorpusExpectation>(
        value(flags.corpus),
        'corpus expectation',
        isCorpusExpectation,
        'an object with sourceRecordCount, sourceDistinctPmidCount and sourceFiles',
      ),
      readEvidence<CorpusSnapshot>(
        value(flags.baseline),
        'baseline snapshot',
        (parsed) => isCorpusSnapshot(extractSnapshot(parsed)),
        'a receipt written by a prior run, or a bare corpus snapshot',
      ).then((observation) =>
        observation.status === 'observed'
          ? observed(extractSnapshot(observation.value) as CorpusSnapshot)
          : observation,
      ),
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

  const currentSnapshot = currentSnapshotFrom(database)
  const envelope = {
    schemaVersion: 'literature-production-verification/1.1.0' as const,
    scenario: run.scenario,
    verdict: run.verdict,
    target: describeTarget(configuration.database),
    bindingStatus: configuration.bindingStatus,
    checks: run.checks,
    summary: run.summary,
    stopReason: run.stopReason,
    // The receipt carries the snapshot so it can be handed straight back as the next run's
    // `--baseline`. Without it, the file the runbook tells an operator to keep was not something
    // `--baseline` could read, and feeding it back produced an idempotency "failure" made of
    // `undefined` and `NaN`.
    snapshot: currentSnapshot.status === 'observed' ? currentSnapshot.value : null,
    capturedAt: new Date().toISOString(),
    notAuthorization: RECEIPT_NOT_AUTHORIZATION,
  }

  writeOut(process.argv.includes('--json') ? renderReceipt(envelope) : renderScenarioRun(run))

  const receiptPath = value(flags.receipt)
  if (receiptPath) {
    const resolvedReceiptPath = resolve(ROOT, receiptPath)
    // Never silently replace evidence. Re-using a receipt path out of habit would destroy the
    // very run-1 receipt a later `--baseline` depends on, with no prompt and no backup.
    if (await pathExists(resolvedReceiptPath)) {
      writeError(
        `\n${receiptPath} already exists. Receipts are evidence and are never overwritten; ` +
          'choose a new path.\n',
      )
      process.exitCode = 1
      return
    }
    // Create the parent directory rather than aborting on it.
    //
    // Every `--receipt` invocation in the operator documents writes under `evidence/`, which is not
    // in the repository, so following the runbook verbatim failed at the last step of a run that
    // had already done all its work — the worst possible moment, and on conference morning the
    // likeliest one. `recursive: true` is a no-op when the directory already exists.
    await mkdir(dirname(resolvedReceiptPath), { recursive: true })
    await writeFile(resolvedReceiptPath, renderReceipt(envelope), 'utf8')
    writeOut(`\nReceipt written to ${receiptPath} (redacted).\n`)
  }

  process.exitCode = exitCodeForVerdict(run.verdict)
}

/** Whether a path already exists, for the receipt overwrite guard. */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
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
    // The one trace a `--force` replay leaves: the batch row is reset in place, so its start time
    // moves while the batch count does not.
    latestBatchStartedAt: batches.reduce<string | null>(
      (latest, batch) => (latest === null || batch.started_at > latest ? batch.started_at : latest),
      null,
    ),
  })
}

// Not top-level `await`: the `tsx` loader emits CJS here, which does not support it, and the
// sibling CLIs in `scripts/literature-dedicated-supabase/` end the same way.
main().catch((error: unknown) => {
  writeError(`Verification aborted: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
