import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertKnownArguments,
  hasFlag,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'
import { prepareGoldEnrichmentV3 } from './gold-enrichment-v3'
import {
  auditGoldEnrichmentV3Readiness,
  buildGoldEnrichmentV3Review,
  mergeGoldEnrichmentV3,
  validateGoldEnrichmentV3Results,
} from './gold-enrichment-v3-results'

const HELP = `
Deterministic file-only gold-set-v1 enrichment V3 workflow.

Commands:
  npm run literature:prepare-gold-enrichment-v3 -- [options]
  npm run literature:validate-gold-enrichment-v3-results -- [options]
  npm run literature:merge-gold-enrichment-v3 -- [options]
  npm run literature:build-gold-enrichment-v3-review -- [options]
  npm run literature:audit-gold-enrichment-v3-readiness -- [options]

Preparation options:
  --source <csv>                       Canonical PR #70 development source.
  --source-receipt <json>              Canonical PR #70 source receipt.
  --full-text-registry <csv>           Checksum-bound 56-row V2 full-text audit/registry input.
  --no-abstract-receipt <json>         No-abstract full-text reconciliation receipt.
  --limited-abstract-receipt <json>    Limited-abstract V2 reconciliation receipt.
  --full-text-root <dir>               Explicit binary root; repeat for each root.
  --qa-findings <csv>                  External-QA findings (coordinator-only binding).
  --qa-review-1 <xlsx>                 External-QA workbook 1 (checksum binding only).
  --qa-review-2 <xlsx>                 External-QA workbook 2 (checksum binding only).
  --taxonomy-audit <json>              Taxonomy-v2 audit.
  --upgrade-plan <json>                Taxonomy-v2 candidate-only upgrade plan.
  --output-dir <dir>                   Fresh ignored local-data output directory.

Validation options:
  --run-dir <dir> --results-dir <dir> --output-dir <dir>

Merge options:
  --run-dir <dir> --results-dir <dir> --source <csv> --prior-enrichment <csv>
  --qa-findings <csv> --upgrade-plan <json> --output-dir <dir>

Review options:
  --run-dir <dir> --merge-dir <dir> --output-dir <dir>

Readiness options:
  --merge-dir <dir> --review-dir <dir> --output-dir <dir>
  [--required-review <csv>] [--qc-review <csv>] [--protocol-authorization <json>]

Safety:
  Every command is file-only and read-only with respect to databases. There is no network,
  model/API, worker/Ultra, import, commit, or database mutation option. Held-out/test/all split
  arguments and input paths are rejected.
`.trim()

const FORBIDDEN_OPTIONS = new Set([
  'all',
  'apply',
  'commit',
  'database',
  'dispatch',
  'held-out',
  'heldout',
  'import',
  'include-held-out',
  'include-test',
  'model',
  'network',
  'openai',
  'split',
  'test',
  'ultra',
  'worker',
  'write-database',
])

function rejectForbiddenOptions(arguments_: ParsedCliArguments) {
  const forbidden = [...arguments_.flags, ...arguments_.values.keys()].filter((key) =>
    FORBIDDEN_OPTIONS.has(key.toLocaleLowerCase('en-US')),
  )
  if (forbidden.length > 0) {
    throw new Error(
      `Forbidden held-out/mutation/model option(s): ${forbidden.map((key) => `--${key}`).join(', ')}.`,
    )
  }
}

function required(arguments_: ParsedCliArguments, key: string): string {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

function absolute(workspaceRoot: string, value: string): string {
  return path.resolve(workspaceRoot, value)
}

async function prepare(arguments_: ParsedCliArguments, workspaceRoot: string) {
  assertKnownArguments(arguments_, [
    'full-text-registry',
    'full-text-root',
    'help',
    'limited-abstract-receipt',
    'no-abstract-receipt',
    'output-dir',
    'qa-findings',
    'qa-review-1',
    'qa-review-2',
    'source',
    'source-receipt',
    'taxonomy-audit',
    'upgrade-plan',
  ])
  const fullTextRoots = arguments_.values.get('full-text-root') ?? []
  if (fullTextRoots.length === 0) throw new Error('--full-text-root is required at least once.')
  const result = await prepareGoldEnrichmentV3({
    sourcePath: absolute(workspaceRoot, required(arguments_, 'source')),
    sourceReceiptPath: absolute(workspaceRoot, required(arguments_, 'source-receipt')),
    fullTextAuditPath: absolute(workspaceRoot, required(arguments_, 'full-text-registry')),
    noAbstractReceiptPath: absolute(workspaceRoot, required(arguments_, 'no-abstract-receipt')),
    limitedAbstractReceiptPath: absolute(
      workspaceRoot,
      required(arguments_, 'limited-abstract-receipt'),
    ),
    fullTextRoots: fullTextRoots.map((value) => absolute(workspaceRoot, value)),
    qaFindingsPath: absolute(workspaceRoot, required(arguments_, 'qa-findings')),
    qaReview1Path: absolute(workspaceRoot, required(arguments_, 'qa-review-1')),
    qaReview2Path: absolute(workspaceRoot, required(arguments_, 'qa-review-2')),
    taxonomyAuditPath: absolute(workspaceRoot, required(arguments_, 'taxonomy-audit')),
    upgradePlanPath: absolute(workspaceRoot, required(arguments_, 'upgrade-plan')),
    outputDirectory: absolute(workspaceRoot, required(arguments_, 'output-dir')),
    workspaceRoot,
  })
  const familyRows = Object.fromEntries(
    ['included_metadata_only', 'included_full_text', 'excluded_metadata_sufficiency'].map(
      (family) => [
        family,
        result.packets
          .filter((packet) => packet.receipt.packetFamily === family)
          .reduce((sum, packet) => sum + packet.receipt.rowCount, 0),
      ],
    ),
  )
  console.log(
    `Prepared ${result.packets.length} deterministic packets in ${result.outputDirectory}`,
  )
  console.log(`Packet rows: ${JSON.stringify(familyRows)}`)
  console.log(`Run definition SHA-256: ${result.runDefinition.sha256}`)
  console.log(`Full-text registry SHA-256: ${result.fullTextRegistry.sha256}`)
  console.log(`Canonical manifest SHA-256: ${result.canonicalManifest.sha256}`)
}

async function validate(arguments_: ParsedCliArguments, workspaceRoot: string) {
  assertKnownArguments(arguments_, ['help', 'output-dir', 'results-dir', 'run-dir'])
  const result = await validateGoldEnrichmentV3Results({
    runDirectory: absolute(workspaceRoot, required(arguments_, 'run-dir')),
    resultsDirectory: absolute(workspaceRoot, required(arguments_, 'results-dir')),
    outputDirectory: absolute(workspaceRoot, required(arguments_, 'output-dir')),
    workspaceRoot,
  })
  console.log(
    `Validated ${result.report.packetCoverage.validPackets}/${result.report.packetCoverage.expectedPackets} packets and ${result.report.packetCoverage.validRows}/${result.report.packetCoverage.expectedRows} rows.`,
  )
  if (!result.report.valid) process.exitCode = 1
}

async function merge(arguments_: ParsedCliArguments, workspaceRoot: string) {
  assertKnownArguments(arguments_, [
    'help',
    'output-dir',
    'prior-enrichment',
    'qa-findings',
    'results-dir',
    'run-dir',
    'source',
    'upgrade-plan',
  ])
  const result = await mergeGoldEnrichmentV3({
    runDirectory: absolute(workspaceRoot, required(arguments_, 'run-dir')),
    resultsDirectory: absolute(workspaceRoot, required(arguments_, 'results-dir')),
    sourcePath: absolute(workspaceRoot, required(arguments_, 'source')),
    priorEnrichmentPath: absolute(workspaceRoot, required(arguments_, 'prior-enrichment')),
    qaFindingsPath: absolute(workspaceRoot, required(arguments_, 'qa-findings')),
    upgradePlanPath: absolute(workspaceRoot, required(arguments_, 'upgrade-plan')),
    outputDirectory: absolute(workspaceRoot, required(arguments_, 'output-dir')),
    workspaceRoot,
  })
  console.log(`Merged ${result.rows.length} rows: ${result.mergedArtifact.sha256}`)
  console.log(`Receipt: ${result.receiptArtifact.sha256}`)
}

async function review(arguments_: ParsedCliArguments, workspaceRoot: string) {
  assertKnownArguments(arguments_, ['help', 'merge-dir', 'output-dir', 'run-dir'])
  const result = await buildGoldEnrichmentV3Review({
    runDirectory: absolute(workspaceRoot, required(arguments_, 'run-dir')),
    mergeDirectory: absolute(workspaceRoot, required(arguments_, 'merge-dir')),
    outputDirectory: absolute(workspaceRoot, required(arguments_, 'output-dir')),
    workspaceRoot,
  })
  console.log(`Review workbook: ${result.workbookArtifact.sha256}`)
  console.log(
    `Cohorts: required=${result.cohorts.required_review.length}, qc=${result.cohorts.qc_sample_50.length}, protocol=${result.cohorts.protocol_acceptance_candidates.length}`,
  )
}

async function readiness(arguments_: ParsedCliArguments, workspaceRoot: string) {
  assertKnownArguments(arguments_, [
    'help',
    'merge-dir',
    'output-dir',
    'protocol-authorization',
    'qc-review',
    'required-review',
    'review-dir',
  ])
  const optionalPath = (key: string) => {
    const value = stringArgument(arguments_, key)
    return value ? absolute(workspaceRoot, value) : undefined
  }
  const result = await auditGoldEnrichmentV3Readiness({
    mergeDirectory: absolute(workspaceRoot, required(arguments_, 'merge-dir')),
    reviewDirectory: absolute(workspaceRoot, required(arguments_, 'review-dir')),
    outputDirectory: absolute(workspaceRoot, required(arguments_, 'output-dir')),
    requiredReviewPath: optionalPath('required-review'),
    qcReviewPath: optionalPath('qc-review'),
    protocolAuthorizationPath: optionalPath('protocol-authorization'),
    workspaceRoot,
  })
  console.log(`Readiness audit: ${result.artifact.sha256}`)
  console.log(`Import readiness: ${String(result.report.importReadiness)}`)
}

export async function runGoldEnrichmentV3Cli(argv: string[], workspaceRoot = process.cwd()) {
  const [command, ...rest] = argv
  if (!command || command === '--help' || command === 'help') {
    console.log(HELP)
    return
  }
  const arguments_ = parseCliArguments(rest)
  rejectForbiddenOptions(arguments_)
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }
  switch (command) {
    case 'prepare':
      return prepare(arguments_, workspaceRoot)
    case 'validate':
      return validate(arguments_, workspaceRoot)
    case 'merge':
      return merge(arguments_, workspaceRoot)
    case 'review':
      return review(arguments_, workspaceRoot)
    case 'readiness':
      return readiness(arguments_, workspaceRoot)
    default:
      throw new Error(`Unknown V3 workflow command: ${command}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runGoldEnrichmentV3Cli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
