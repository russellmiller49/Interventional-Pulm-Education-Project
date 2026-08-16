/**
 * Propose a canary manifest for owner authorization.
 *
 * The engine refuses any canary operation whose manifest does not hash to the value pinned in
 * `LITERATURE_CANARY_MANIFEST_SHA256`, and it provides no way to produce that manifest, because it
 * never reads a cohort relation. This command closes that gap, and closes it in the one shape that
 * keeps the authorization meaningful:
 *
 *   1. read the 630-record development split, bibliography-only, through the *fixed source
 *      boundary* — the same guards, context, container, image, project, port, read-only
 *      transaction, and attestation the ingestion engine uses;
 *   2. run the engine's own deterministic selector over those candidates;
 *   3. write the manifest — PMIDs and all — to one fixed gitignored path, created exclusively,
 *      owner-readable only;
 *   4. print aggregate characteristics and the SHA-256, and **never the PMIDs**;
 *   5. stop.
 *
 * It does not import anything, does not write to any remote database, and does not call the result
 * authorized. Authorization is the owner exporting the printed SHA-256, later, deliberately.
 *
 * ## What this command got wrong, and what changed
 *
 * It read the most sensitive relation in the package — the review cohort — through a bare
 * `docker exec <container-name> psql`, running **none** of the fixed-source guards the corpus read
 * runs. A `docker` executable earlier on `PATH` produced 630 synthetic records and a perfectly
 * well-formed, checksummed manifest proposal. It also forwarded `LITERATURE_VERIFY_ADMIN_COOKIE`
 * to that child, accepted a credential-shaped string as a "seed" and then printed and persisted
 * it, accepted an arbitrary `--out` path, and wrote mode-0644 through truncating,
 * symlink-following semantics.
 *
 * Each of those is now closed by construction rather than by care: the read goes through
 * `streamGuardedReadOnlyQuery`, the child receives a five-name allowlisted environment, the seed
 * must match a narrow non-secret identifier grammar, and the output path is not an input at all.
 *
 * ## Why the PMIDs are never printed
 *
 * A terminal scrollback, a CI log, and a pasted status update are all places the selected PMIDs
 * would outlive the operator's intent. The selection is drawn from a review cohort, so the list is
 * more sensitive than the records themselves: it says which articles a reviewer will see. The file
 * on disk is the single copy, under `local-data/`, which `.gitignore` excludes.
 *
 *   npm run literature:production-canary-manifest -- --seed <seed>
 */

import { createHash } from 'node:crypto'
import { lstat, mkdir, open, realpath } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

import { buildCandidateSql, collectCandidates, summarizeCandidates } from './canary-candidates'
import type { CandidateAggregates } from './canary-candidates'
import { assertNoCredentialArguments } from './config'
import { CANARY_MANIFEST_CHECKSUM_ENV_NAME } from './constants'
import { createCanaryManifest } from './manifest'
import {
  streamGuardedReadOnlyQuery,
  type SourceCommandRunner,
  type SourceEnvironment,
  type SourceStreamRunner,
} from './source'
import type { CanaryManifest } from './types'

/**
 * The only path this command writes.
 *
 * Not a default — the only value. An `--out` flag meant the command that produces the cohort file
 * would put it wherever an argument said, including outside the gitignored directory that is the
 * entire reason the file is safe to create. Tests inject a destination through `main`'s
 * non-exported dependency parameter instead, so the production CLI has no path input at all.
 */
export const CANARY_MANIFEST_PROPOSAL_DIRECTORY = 'local-data/literature-production-ingest'
export const CANARY_MANIFEST_PROPOSAL_FILENAME = 'canary-manifest-proposal.json'

/**
 * What a selector seed may be.
 *
 * The seed is an *identifier*: it is written into the manifest, hashed into the checksum, printed
 * to the terminal, and read back by an owner comparing two proposals. It is not a secret and there
 * is no reason for one to arrive here — but nothing rejected one, so `sb_secret_…` was accepted,
 * echoed to stdout, and persisted into a JSON file.
 *
 * A narrow grammar is the fix, not a denylist of credential shapes: lowercase letters, digits,
 * hyphen, underscore, and period, bounded. Every credential format the repository knows about
 * fails it — `sb_secret_…` and `sb_publishable_…` (underscore-prefixed but uppercase-free is not
 * enough: they exceed nothing, so they are rejected explicitly below too), JWTs (dots are allowed
 * but uppercase and the length bound are not), bearer text (space), URLs (`:` and `/`), and
 * anything with a control character or a path separator.
 */
export const SEED_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/u

/**
 * Shapes that match the grammar but are still obviously credentials.
 *
 * Belt and braces on top of the grammar, because a Supabase key is lowercase, uses only underscores
 * and alphanumerics, and would otherwise be a syntactically valid identifier.
 */
const CREDENTIAL_SEED_PREFIXES = ['sb_secret_', 'sb_publishable_', 'sbp_', 'service_role']
const CREDENTIAL_SEED_WORDS = ['secret', 'password', 'token', 'apikey', 'api_key', 'bearer', 'auth']

export class SeedRejectedError extends Error {
  constructor(reason: string) {
    // The rejected value is never included. Echoing it is precisely the disclosure this guards.
    super(
      `The selector seed was rejected: ${reason} The seed is a non-secret identifier written into ` +
        'the manifest and printed here, so it must be a short lowercase identifier — letters, ' +
        'digits, hyphen, underscore, and period, 3-64 characters. The rejected value is ' +
        'deliberately not echoed.',
    )
    this.name = 'SeedRejectedError'
  }
}

export function assertAcceptableSeed(seed: string): void {
  if (!SEED_PATTERN.test(seed)) {
    throw new SeedRejectedError('it is not a bounded lowercase identifier.')
  }
  const lowered = seed.toLowerCase()
  if (CREDENTIAL_SEED_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
    throw new SeedRejectedError('it has the shape of an API key.')
  }
  if (CREDENTIAL_SEED_WORDS.some((word) => lowered.includes(word))) {
    throw new SeedRejectedError('it contains credential vocabulary.')
  }
}

function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  if (index < 0) return undefined
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`--${name} requires a value.`)
  }
  return value
}

export interface ProposalDependencies {
  /** The repository root the fixed output path is resolved against. */
  repositoryRoot?: string
  environment?: Readonly<SourceEnvironment>
  commandRunner?: SourceCommandRunner
  streamRunner?: SourceStreamRunner
  write?: (line: string) => void
}

/**
 * Read the development cohort through the fixed source boundary.
 *
 * Nothing about processes, guards, or framing lives here any more: `streamGuardedReadOnlyQuery`
 * asserts the Docker context and endpoint, the container id, image id, name, running state,
 * published port mapping, and Supabase project label *before* any psql process exists; sends the
 * SQL on stdin; requires the read-only repeatable-read attestation on both the opening and closing
 * frames; refuses any unframed line; and fails closed on a non-zero exit.
 */
export async function readCandidates(dependencies: ProposalDependencies = {}) {
  const payloads: unknown[] = []
  for await (const payload of streamGuardedReadOnlyQuery({
    sql: buildCandidateSql(),
    environment: dependencies.environment,
    commandRunner: dependencies.commandRunner,
    streamRunner: dependencies.streamRunner,
  })) {
    payloads.push(payload)
  }
  return collectCandidates(payloads)
}

/**
 * Resolve, validate, and exclusively create the one output file.
 *
 * Every step here exists because of a specific way the previous `writeFile(path, …, 'utf8')` could
 * put the cohort somewhere it should not be, or let something else read it:
 *
 *   - the parent must be exactly the canonical gitignored directory, so a traversal or an absolute
 *     path outside the repository cannot be reached;
 *   - the parent and the destination must not be symlinks, so neither can redirect the write;
 *   - the directory is created 0700 and the file 0600, so the cohort is owner-readable only;
 *   - `wx` means a second run fails loudly rather than silently replacing a proposal an owner may
 *     already have reviewed and pinned.
 */
export async function createProposalFile(
  repositoryRoot: string,
  serialized: string,
): Promise<string> {
  /*
   * The root is canonicalized first, so the comparison below is about *this* path and not about
   * the platform. On macOS the temporary and system roots are themselves symlinks
   * (`/var` → `/private/var`), so comparing a resolved path against its own `realpath` without
   * canonicalizing the root rejects every legitimate location.
   */
  const root = await realpath(resolve(repositoryRoot))
  const directory = resolve(root, CANARY_MANIFEST_PROPOSAL_DIRECTORY)
  const destination = resolve(directory, CANARY_MANIFEST_PROPOSAL_FILENAME)

  const inside = relative(root, destination)
  if (inside.startsWith('..') || inside.split(sep)[0] === '') {
    throw new Error('The canary manifest proposal path resolved outside the repository.')
  }
  if (dirname(destination) !== directory) {
    throw new Error('The canary manifest proposal path is not the fixed proposal location.')
  }

  await mkdir(directory, { recursive: true, mode: 0o700 })

  // A symlinked parent redirects everything created inside it, and `mkdir -p` happily accepts one.
  const directoryStat = await lstat(directory)
  if (directoryStat.isSymbolicLink()) {
    throw new Error(
      'The canary manifest proposal directory is a symbolic link and will not be used.',
    )
  }
  const canonicalDirectory = await realpath(directory)
  if (canonicalDirectory !== directory) {
    throw new Error(
      'The canary manifest proposal directory does not canonicalize to itself, so what is written ' +
        'there would not be where it appears to be.',
    )
  }

  let handle
  try {
    // `wx` is O_CREAT|O_EXCL: it never follows an existing symlink and never truncates.
    handle = await open(destination, 'wx', 0o600)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      throw new Error(
        `A canary manifest proposal already exists at ${CANARY_MANIFEST_PROPOSAL_DIRECTORY}/` +
          `${CANARY_MANIFEST_PROPOSAL_FILENAME}. It is not overwritten, because an owner may ` +
          'already have reviewed and pinned its checksum. Move or delete that file deliberately, ' +
          'then run this command again.',
      )
    }
    throw error
  }
  try {
    await handle.writeFile(serialized, 'utf8')
  } finally {
    await handle.close()
  }
  return destination
}

function reportAggregates(
  write: (line: string) => void,
  label: string,
  aggregates: CandidateAggregates,
): void {
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

export async function proposeCanaryManifest(
  argv: readonly string[],
  dependencies: ProposalDependencies = {},
): Promise<void> {
  assertNoCredentialArguments([...argv])
  const write = dependencies.write ?? ((line: string) => process.stdout.write(`${line}\n`))

  /*
   * Rejected, not ignored.
   *
   * Silently discarding `--out` would write the cohort file somewhere the operator did not expect
   * while their command line said otherwise, which is a worse failure than the one being removed.
   */
  for (const rejected of ['out', 'output', 'path', 'dir', 'destination']) {
    if (argv.includes(`--${rejected}`)) {
      throw new Error(
        `--${rejected} is not accepted. The canary manifest proposal is written only to ` +
          `${CANARY_MANIFEST_PROPOSAL_DIRECTORY}/${CANARY_MANIFEST_PROPOSAL_FILENAME}, which is ` +
          'gitignored and created owner-readable only. The selected PMIDs must not be written ' +
          'anywhere else.',
      )
    }
  }

  const seed = flag(argv, 'seed')
  if (!seed) {
    throw new Error(
      'A selector seed is required: --seed <value>. The seed is part of the manifest and of its ' +
        'checksum, so the same seed and the same cohort always produce the same 25 records.',
    )
  }
  assertAcceptableSeed(seed)

  write('Canary manifest proposal — development cohort, bibliography-only')
  write('This command reads the local source read-only. It writes nothing to any remote database.')

  const candidates = await readCandidates(dependencies)
  reportAggregates(write, 'Development cohort (input)', summarizeCandidates(candidates))

  const manifest: CanaryManifest = createCanaryManifest(candidates, seed)
  const selected = candidates.filter((candidate) => manifest.pmids.includes(candidate.pmid))
  reportAggregates(write, 'Proposed canary selection (25)', summarizeCandidates(selected))

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  const outputPath = await createProposalFile(
    dependencies.repositoryRoot ?? process.cwd(),
    serialized,
  )

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

if (process.argv[1]?.endsWith('propose-canary-manifest.ts')) {
  proposeCanaryManifest(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
