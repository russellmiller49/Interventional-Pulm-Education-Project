/**
 * Propose a canary manifest for owner authorization.
 *
 * The engine refuses any canary operation whose manifest does not hash to the value pinned in
 * `LITERATURE_CANARY_MANIFEST_SHA256`, and it provides no way to produce that manifest, because it
 * never reads a cohort relation. This command closes that gap, and closes it in the one shape that
 * keeps the authorization meaningful:
 *
 *   1. read the 630-record development split, bibliography-only, in a read-only transaction;
 *   2. run the engine's own deterministic selector over those candidates;
 *   3. write the manifest — PMIDs and all — to a **gitignored local path**;
 *   4. print aggregate characteristics and the SHA-256, and **never the PMIDs**;
 *   5. stop.
 *
 * It does not import anything, does not write to any remote database, and does not call the result
 * authorized. Authorization is the owner exporting the printed SHA-256, later, deliberately.
 *
 * ## Why the PMIDs are never printed
 *
 * A terminal scrollback, a CI log, and a pasted status update are all places the selected PMIDs
 * would outlive the operator's intent. The selection is drawn from a review cohort, so the list is
 * more sensitive than the records themselves: it says which articles a reviewer will see. The file
 * on disk is the single copy, under `local-data/`, which `.gitignore` excludes.
 *
 *   npm run literature:production-canary-manifest -- --seed <seed>
 *   npm run literature:production-canary-manifest -- --seed <seed> --out <path>
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  buildCandidateSql,
  parseCandidateOutput,
  summarizeCandidates,
  type CandidateAggregates,
} from './canary-candidates'
import {
  CANARY_MANIFEST_CHECKSUM_ENV_NAME,
  SOURCE_CONTAINER,
  SOURCE_DATABASE,
  SOURCE_DATABASE_USER,
} from './constants'
import { createCanaryManifest } from './manifest'
import { sanitizeSourceEnvironment } from './source'
import type { CanaryCandidate, CanaryManifest } from './types'

const DEFAULT_OUTPUT = 'local-data/literature-production-ingest/canary-manifest-proposal.json'

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function write(line: string): void {
  process.stdout.write(`${line}\n`)
}

/**
 * Run the candidate query through `docker exec … psql`.
 *
 * The SQL arrives on stdin rather than in `argv`, so it never appears in a process listing, and the
 * environment is sanitized by the ingestion package's own helper so no unrelated credential is
 * inherited by the child.
 */
async function readCandidates(): Promise<CanaryCandidate[]> {
  const sql = buildCandidateSql()
  const child = spawn(
    'docker',
    [
      'exec',
      '-i',
      SOURCE_CONTAINER,
      'psql',
      '--no-align',
      '--tuples-only',
      '--quiet',
      '--username',
      SOURCE_DATABASE_USER,
      '--dbname',
      SOURCE_DATABASE,
    ],
    {
      env: sanitizeSourceEnvironment(process.env) as NodeJS.ProcessEnv,
      stdio: ['pipe', 'pipe', 'pipe'] as const,
    },
  )

  let stdout = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
  })
  // stderr is drained without being retained: psql diagnostics can echo query text, and the query
  // text names the cohort table.
  child.stderr.resume()

  child.stdin.end(sql)

  const code = await new Promise<number>((resolveCode, rejectCode) => {
    child.on('error', rejectCode)
    child.on('close', (value) => resolveCode(value ?? 1))
  })
  if (code !== 0) {
    throw new Error(
      `The local source read exited ${code}. Is the local Literature stack running? ` +
        'Start it from the primary checkout with `npm run literature:local:start`.',
    )
  }

  return parseCandidateOutput(stdout).candidates
}

function reportAggregates(label: string, aggregates: CandidateAggregates): void {
  write(`\n${label}`)
  write(`  records                     ${aggregates.count}`)
  write(`  with abstract               ${aggregates.abstractPresent}`)
  write(`  without abstract            ${aggregates.abstractAbsent}`)
  write(
    `  publication years           ${
      aggregates.earliestYear === null
        ? 'none recorded'
        : `${aggregates.earliestYear}–${aggregates.latestYear}`
    }${aggregates.yearsUnknown > 0 ? ` (${aggregates.yearsUnknown} unknown)` : ''}`,
  )
  write(`  distinct journals           ${aggregates.distinctJournals}`)
  write(`  distinct publication types  ${aggregates.distinctPublicationTypes}`)
}

async function main(): Promise<void> {
  const seed = flag('seed')
  if (!seed) {
    process.stderr.write(
      'A selector seed is required: --seed <value>. The seed is part of the manifest and of its ' +
        'checksum, so the same seed and the same cohort always produce the same 25 records.\n',
    )
    process.exitCode = 1
    return
  }

  const outputPath = resolve(process.cwd(), flag('out') ?? DEFAULT_OUTPUT)

  write('Canary manifest proposal — development cohort, bibliography-only')
  write('This command reads the local source read-only. It writes nothing to any remote database.')

  const candidates = await readCandidates()
  reportAggregates('Development cohort (input)', summarizeCandidates(candidates))

  const manifest: CanaryManifest = createCanaryManifest(candidates, seed)
  const selected = candidates.filter((candidate) => manifest.pmids.includes(candidate.pmid))
  reportAggregates('Proposed canary selection (25)', summarizeCandidates(selected))

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, serialized, 'utf8')

  // The checksum the engine will compare against. Recomputed from the file bytes rather than
  // reported from memory, so what is printed is what an operator can reproduce with shasum.
  const fileChecksum = createHash('sha256').update(serialized).digest('hex')

  write('\nManifest')
  write(`  written to                  ${outputPath}`)
  write(`  selector version            ${manifest.selectorVersion}`)
  write(`  seed                        ${manifest.selectorSeed}`)
  write(`  source authority            ${manifest.sourceAuthority}`)
  write(`  manifest checksum           ${manifest.manifestChecksum}`)
  write(`  file sha256                 ${fileChecksum}`)

  write('\nThe selected PMIDs are in that file and are deliberately not printed here.')
  write('This proposal is NOT authorized. To authorize it, an owner reviews the file and exports:')
  write(`\n  ${CANARY_MANIFEST_CHECKSUM_ENV_NAME}=${manifest.manifestChecksum}\n`)
  write('Nothing is imported by this command.')
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
