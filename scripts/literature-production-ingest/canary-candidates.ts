/**
 * Bibliography-only candidate extraction for the canary manifest proposal.
 *
 * The engine will not accept a canary manifest that is not pinned to an owner-approved SHA-256, and
 * it deliberately provides no way to build one — it never reads a cohort relation. This module is
 * the one place that does, and it is written so that what it reads is auditable line by line.
 *
 * ## What it reads, and what it must never read
 *
 * It reads exactly two things: the PMIDs of the **630-record development split**, and the
 * bibliography columns of those articles. That is it.
 *
 * It must never read, and contains no SQL that could read:
 *
 *   - the 270-record **test / held-out** split, in any form — not to count it, not to exclude by
 *     anti-join against it, not to infer its size by subtraction;
 *   - relevance labels, metadata-sufficiency labels, reviewer confidence, or notes;
 *   - taxonomy decisions, technology/disease tags, or clinical purposes;
 *   - review state, review history, revisions, or V2 content;
 *   - `dataset_split` as an emitted **value** — it appears once, as a literal in a WHERE clause,
 *     and never in a SELECT list.
 *
 * The last point is the subtle one. Emitting the split alongside each PMID would make every output
 * row a membership disclosure even though the filter is "correct". The projection carries the five
 * bibliography-only selector fields and nothing else, so a candidate file leaks no more than the
 * fact that these PMIDs are in the development collection — which is the whole purpose of the file
 * and is what the owner is authorizing.
 *
 * ## Why the count is asserted
 *
 * `createCanaryManifest` requires exactly 630 candidates. Asserting it here as well, against the
 * same constant, turns a silently-partial read — a `max-rows` ceiling, a half-applied migration, a
 * batch that was never frozen — into a refusal rather than into a manifest built from whatever
 * happened to come back.
 */

import {
  EXPECTED_DEVELOPMENT_CANDIDATE_COUNT,
  SOURCE_DATABASE,
  SOURCE_DATABASE_USER,
  SOURCE_INTERNAL_PORT,
} from './constants'
import { SOURCE_COMPLETE_PREFIX, SOURCE_IDENTITY_PREFIX, SOURCE_RECORD_PREFIX } from './source'
import type { CanaryCandidate } from './types'

/** The development split. The only cohort value this module may name. */
export const DEVELOPMENT_SPLIT = 'development' as const

/**
 * Cohort columns that may never appear in a SELECT list here. Asserted against the generated SQL by
 * `canary-candidates.test.ts`, so a future edit that adds one fails a test rather than quietly
 * widening what an operator's candidate file discloses.
 */
export const FORBIDDEN_COHORT_COLUMNS: readonly string[] = [
  'dataset_split',
  'relevance_label',
  'metadata_sufficiency',
  'reviewer_confidence',
  'notes',
  'topic_ids',
  'technology_tags',
  'clinical_purposes',
  'disease_tags',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'used_supplemental_metadata',
  'review_seconds',
  'reviewer_email',
  'is_blinded',
  'payload',
  'review_payload',
  'automated_signals',
]

/** The five bibliography-only selector fields, and nothing else. */
const CANDIDATE_PROJECTION = [
  ['pmid', 'article.pmid'],
  ['abstractPresent', '(article.abstract is not null and length(trim(article.abstract)) > 0)'],
  ['publicationYear', 'article.publication_year'],
  ['journal', 'coalesce(article.journal_id, article.journal_title)'],
  ['publicationTypes', "coalesce(article.publication_types, '{}'::text[])"],
] as const

/**
 * The read-only candidate query.
 *
 * Structurally identical to the ingestion source read: an explicit read-only repeatable-read
 * transaction that attests `transaction_read_only` in its own output, and a terminal `rollback`.
 * The only difference is the projection and the development-split join.
 */
export function buildCandidateSql(): string {
  const projection = CANDIDATE_PROJECTION.map(
    ([key, expression]) => `'${key}', ${expression}`,
  ).join(',\n      ')

  return `begin transaction isolation level repeatable read read only;
set local statement_timeout = '0';
select '${SOURCE_IDENTITY_PREFIX}' || jsonb_build_object(
  'database', current_database(),
  'user', current_user,
  'port', current_setting('port'),
  'readOnly', current_setting('transaction_read_only')::boolean,
  'isolation', current_setting('transaction_isolation')
)::text;
select '${SOURCE_RECORD_PREFIX}' || jsonb_build_object(
      ${projection}
)::text
from public.literature_articles as article
where article.pmid in (
  -- The development split only. The test/held-out split is never selected, counted, or
  -- anti-joined against; this subquery is the single place a cohort relation is named.
  select item.pmid
  from public.literature_gold_set_items as item
  where item.dataset_split = '${DEVELOPMENT_SPLIT}'
)
order by article.pmid collate "C" asc;
select '${SOURCE_COMPLETE_PREFIX}' || jsonb_build_object(
  'readOnly', current_setting('transaction_read_only')::boolean,
  'database', current_database(),
  'user', current_user,
  'port', current_setting('port')
)::text;
rollback;`
}

export interface CandidateIdentity {
  database: string
  user: string
  port: string
  readOnly: boolean
}

function assertReadOnlyIdentity(value: unknown, label: string): void {
  const row = value as Record<string, unknown> | null
  if (
    row === null ||
    typeof row !== 'object' ||
    Array.isArray(row) ||
    row.database !== SOURCE_DATABASE ||
    row.user !== SOURCE_DATABASE_USER ||
    row.port !== SOURCE_INTERNAL_PORT ||
    row.readOnly !== true
  ) {
    throw new Error(`${label} did not attest a read-only transaction on the expected source.`)
  }
}

function assertPmid(value: unknown): string {
  // The value is never echoed on failure: an error message carrying a rejected PMID would be a
  // disclosure from the very cohort this module exists to handle carefully.
  if (typeof value !== 'string' || !/^[0-9]{1,12}$/u.test(value)) {
    throw new Error('A development candidate PMID was not a 1-12 digit numeric string.')
  }
  return value
}

function normalizeCandidate(value: unknown): CanaryCandidate {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A development candidate row was not an object.')
  }
  const row = value as Record<string, unknown>

  // Reject any cohort field that reached the projection, rather than silently dropping it. A
  // present-but-ignored label means the SQL widened and nobody noticed.
  for (const forbidden of FORBIDDEN_COHORT_COLUMNS) {
    if (forbidden in row) {
      throw new Error(
        `A development candidate row carried the cohort field "${forbidden}". The candidate ` +
          'projection must remain bibliography-only.',
      )
    }
  }

  const publicationTypes = Array.isArray(row.publicationTypes)
    ? row.publicationTypes.filter((entry): entry is string => typeof entry === 'string')
    : []

  return {
    pmid: assertPmid(row.pmid),
    abstractPresent: row.abstractPresent === true,
    publicationYear:
      typeof row.publicationYear === 'number' && Number.isInteger(row.publicationYear)
        ? row.publicationYear
        : null,
    journal: typeof row.journal === 'string' && row.journal.length > 0 ? row.journal : null,
    publicationTypes,
  }
}

export interface ParsedCandidateOutput {
  candidates: CanaryCandidate[]
}

/**
 * Parse the prefixed lines the query emits.
 *
 * Both the opening identity row and the closing completion row must attest a read-only transaction
 * on the expected database, user, and port. A stream that ends without the completion row is a
 * truncated read and is refused — the failure mode that would otherwise produce a manifest built
 * from a partial cohort.
 */
export function parseCandidateOutput(stdout: string): ParsedCandidateOutput {
  let identitySeen = false
  let completeSeen = false
  const candidates: CanaryCandidate[] = []

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith(SOURCE_IDENTITY_PREFIX)) {
      assertReadOnlyIdentity(
        JSON.parse(line.slice(SOURCE_IDENTITY_PREFIX.length)) as unknown,
        'Candidate source identity',
      )
      identitySeen = true
      continue
    }
    if (line.startsWith(SOURCE_COMPLETE_PREFIX)) {
      assertReadOnlyIdentity(
        JSON.parse(line.slice(SOURCE_COMPLETE_PREFIX.length)) as unknown,
        'Candidate source completion',
      )
      completeSeen = true
      continue
    }
    if (line.startsWith(SOURCE_RECORD_PREFIX)) {
      candidates.push(
        normalizeCandidate(JSON.parse(line.slice(SOURCE_RECORD_PREFIX.length)) as unknown),
      )
    }
  }

  if (!identitySeen) throw new Error('Candidate read produced no source identity attestation.')
  if (!completeSeen) throw new Error('Candidate read did not complete; the result may be partial.')

  const unique = new Set(candidates.map((candidate) => candidate.pmid))
  if (unique.size !== candidates.length) {
    throw new Error('The development candidate set contained duplicate PMIDs.')
  }
  if (candidates.length !== EXPECTED_DEVELOPMENT_CANDIDATE_COUNT) {
    throw new Error(
      `The development candidate set held ${candidates.length} records; exactly ` +
        `${EXPECTED_DEVELOPMENT_CANDIDATE_COUNT} are expected. Refusing to build a manifest from ` +
        'a partial cohort.',
    )
  }

  return { candidates }
}

export interface CandidateAggregates {
  count: number
  abstractPresent: number
  abstractAbsent: number
  earliestYear: number | null
  latestYear: number | null
  yearsUnknown: number
  distinctJournals: number
  distinctPublicationTypes: number
}

/**
 * Aggregate characteristics of a candidate or selection set.
 *
 * Deliberately returns only counts and a year range. Everything here is safe to print; the PMIDs
 * are not, and no function in this module returns them in a printable form.
 */
export function summarizeCandidates(candidates: readonly CanaryCandidate[]): CandidateAggregates {
  const years = candidates
    .map((candidate) => candidate.publicationYear)
    .filter((year): year is number => typeof year === 'number')
  const journals = new Set(
    candidates
      .map((candidate) => candidate.journal)
      .filter((journal): journal is string => typeof journal === 'string'),
  )
  const publicationTypes = new Set(candidates.flatMap((candidate) => candidate.publicationTypes))

  return {
    count: candidates.length,
    abstractPresent: candidates.filter((candidate) => candidate.abstractPresent).length,
    abstractAbsent: candidates.filter((candidate) => !candidate.abstractPresent).length,
    earliestYear: years.length > 0 ? Math.min(...years) : null,
    latestYear: years.length > 0 ? Math.max(...years) : null,
    yearsUnknown: candidates.length - years.length,
    distinctJournals: journals.size,
    distinctPublicationTypes: publicationTypes.size,
  }
}
