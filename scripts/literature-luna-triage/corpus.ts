import { createHash } from 'node:crypto'

import { OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT } from '../literature-reviewed-overlay/constants'
import { validateSourceEnvelope } from '../literature-production-ingest/mapping'
import {
  buildSourceSql,
  streamGuardedReadOnlyQuery,
  type SourceCommandRunner,
  type SourceEnvironment,
  type SourceStreamRunner,
} from '../literature-production-ingest/source'
import type { SourceEnvelope } from '../literature-production-ingest/types'

/**
 * Read-only bibliographic-corpus authority for the Luna triage lane.
 *
 * The lane authors no SQL. It replays the exact committed full-corpus read —
 * `buildSourceSql('full')` — through `streamGuardedReadOnlyQuery`, which pins the Docker
 * context, container identity, read-only repeatable-read attestation, and frame grammar
 * before a single row is yielded. On top of that boundary this module asserts corpus
 * authority: exactly 132,350 distinct records in strict C-collation PMID order, with a
 * running identity digest so any membership drift between reads stops the lane.
 */

export class CorpusAuthorityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CorpusAuthorityError'
  }
}

/** The projection the lane keeps per record: bibliography only, never review state. */
export interface CorpusRecord {
  readonly pmid: string
  readonly title: string
  readonly abstract: string | null
  readonly journalTitle: string | null
  readonly journalAbbreviation: string | null
  readonly publicationYear: number | null
  readonly publicationTypes: readonly string[]
  readonly meshTerms: readonly string[]
  readonly keywords: readonly string[]
  readonly languages: readonly string[]
}

export interface CorpusDependencies {
  /** Test injection: raw envelope payloads replacing the live guarded boundary. */
  readonly envelopes?: AsyncIterable<unknown> | Iterable<unknown>
  readonly environment?: Readonly<SourceEnvironment>
  readonly commandRunner?: SourceCommandRunner
  readonly streamRunner?: SourceStreamRunner
}

/** The one SQL text the lane ever executes. Exposed so boundary tests can pin it byte-exactly. */
export function corpusReadSql(): string {
  return buildSourceSql('full')
}

function projectEnvelope(envelope: SourceEnvelope): CorpusRecord {
  const article = envelope.article
  return {
    pmid: article.pmid,
    title: article.title,
    abstract: article.abstract,
    journalTitle: article.journal_title,
    journalAbbreviation: article.journal_abbreviation,
    publicationYear: article.publication_year,
    publicationTypes: article.publication_types,
    meshTerms: article.mesh_terms,
    keywords: article.author_keywords,
    languages: article.languages,
  }
}

async function* envelopeStream(dependencies: CorpusDependencies): AsyncGenerator<unknown> {
  if (dependencies.envelopes) {
    yield* dependencies.envelopes
    return
  }
  yield* streamGuardedReadOnlyQuery({
    sql: corpusReadSql(),
    environment: dependencies.environment,
    commandRunner: dependencies.commandRunner,
    streamRunner: dependencies.streamRunner,
  })
}

export interface CorpusStreamResult {
  /** Total records yielded. */
  readonly count: number
  /** SHA-256 over the newline-joined ordered PMID sequence: the corpus identity. */
  readonly identitySha256: string
}

/**
 * Stream the full corpus through the guarded boundary, validating every envelope, asserting
 * strict ascending distinct PMID order, and invoking `visit` per projected record. Returns the
 * count and identity digest; callers must pass the result to `assertCorpusAuthority`.
 */
export async function streamCorpus(
  visit: (record: CorpusRecord) => void | Promise<void>,
  dependencies: CorpusDependencies = {},
): Promise<CorpusStreamResult> {
  const identityHash = createHash('sha256')
  let previousPmid: string | null = null
  let count = 0
  for await (const payload of envelopeStream(dependencies)) {
    const envelope = payload as SourceEnvelope
    validateSourceEnvelope(envelope)
    const record = projectEnvelope(envelope)
    if (previousPmid !== null && !(previousPmid < record.pmid)) {
      throw new CorpusAuthorityError(
        'The corpus stream broke strict ascending PMID order; a duplicate or reordered ' +
          'record means the source is not the fixed corpus.',
      )
    }
    previousPmid = record.pmid
    identityHash.update(record.pmid)
    identityHash.update('\n')
    count += 1
    await visit(record)
  }
  return { count, identitySha256: identityHash.digest('hex') }
}

/**
 * The corpus authority check: exactly 132,350 records, and — when a previously recorded
 * identity digest exists — byte-identical membership. Any drift stops the lane.
 */
export function assertCorpusAuthority(
  result: CorpusStreamResult,
  expectedIdentitySha256?: string | null,
): void {
  if (result.count !== OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT) {
    throw new CorpusAuthorityError(
      `Corpus count drift: observed ${result.count}, exactly ` +
        `${OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT} are required. Stopping.`,
    )
  }
  if (expectedIdentitySha256 && expectedIdentitySha256 !== result.identitySha256) {
    throw new CorpusAuthorityError(
      'Corpus identity drift: the ordered-PMID digest differs from the recorded identity. ' +
        'Stopping.',
    )
  }
}

/** Abstract presence follows the corpus convention: blank-after-trim is absent. */
export function corpusAbstractPresent(abstract: string | null): boolean {
  return typeof abstract === 'string' && abstract.trim().length > 0
}

export type YearBand =
  | 'pre-1970'
  | '1970s'
  | '1980s'
  | '1990s'
  | '2000s'
  | '2010s'
  | '2020s'
  | 'unknown'

export function yearBandOf(publicationYear: number | null): YearBand {
  if (publicationYear === null) return 'unknown'
  if (publicationYear < 1970) return 'pre-1970'
  if (publicationYear < 1980) return '1970s'
  if (publicationYear < 1990) return '1980s'
  if (publicationYear < 2000) return '1990s'
  if (publicationYear < 2010) return '2000s'
  if (publicationYear < 2020) return '2010s'
  return '2020s'
}

export interface CorpusInventory {
  readonly total: number
  readonly identitySha256: string
  readonly withAbstract: number
  readonly withoutAbstract: number
  readonly byYearBand: Readonly<Record<YearBand, number>>
  readonly byPrimaryLanguage: Readonly<Record<string, number>>
  readonly journalPresent: number
  readonly meshPresent: number
  readonly keywordsPresent: number
  readonly publicationTypeCounts: Readonly<Record<string, number>>
}

/**
 * Aggregate-only corpus inventory. No record identity ever leaves this function — only
 * counts, bands, and the membership digest.
 */
export async function collectCorpusInventory(
  dependencies: CorpusDependencies = {},
): Promise<CorpusInventory> {
  const byYearBand: Record<YearBand, number> = {
    'pre-1970': 0,
    '1970s': 0,
    '1980s': 0,
    '1990s': 0,
    '2000s': 0,
    '2010s': 0,
    '2020s': 0,
    unknown: 0,
  }
  const byPrimaryLanguage: Record<string, number> = {}
  const publicationTypeCounts: Record<string, number> = {}
  let withAbstract = 0
  let journalPresent = 0
  let meshPresent = 0
  let keywordsPresent = 0
  const result = await streamCorpus((record) => {
    if (corpusAbstractPresent(record.abstract)) withAbstract += 1
    byYearBand[yearBandOf(record.publicationYear)] += 1
    const language = record.languages[0] ?? '(none)'
    byPrimaryLanguage[language] = (byPrimaryLanguage[language] ?? 0) + 1
    if (record.journalTitle ?? record.journalAbbreviation) journalPresent += 1
    if (record.meshTerms.length > 0) meshPresent += 1
    if (record.keywords.length > 0) keywordsPresent += 1
    for (const type of record.publicationTypes) {
      publicationTypeCounts[type] = (publicationTypeCounts[type] ?? 0) + 1
    }
  }, dependencies)
  assertCorpusAuthority(result)
  return {
    total: result.count,
    identitySha256: result.identitySha256,
    withAbstract,
    withoutAbstract: result.count - withAbstract,
    byYearBand,
    byPrimaryLanguage,
    journalPresent,
    meshPresent,
    keywordsPresent,
    publicationTypeCounts,
  }
}
