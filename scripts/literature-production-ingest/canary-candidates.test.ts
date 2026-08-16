/** @jest-environment node */

/**
 * The canary-candidate boundary, which is the only place in this package that names a cohort table.
 *
 * Three properties matter more than the rest, and all three are asserted against the generated SQL
 * rather than against a comment:
 *
 *   1. the cohort is scoped to one exactly-identified batch, so no other batch's development rows
 *      can join it — the defect this module was corrected for;
 *   2. the held-out split is never named, in any form — not selected, not counted, not anti-joined;
 *   3. no cohort field ever reaches the projection, so a candidate file discloses only that these
 *      PMIDs are in the development collection, which is exactly what the owner authorizes.
 */

import {
  DEVELOPMENT_SPLIT,
  FORBIDDEN_COHORT_COLUMNS,
  buildCandidateSql,
  collectCandidates,
  summarizeCandidates,
} from './canary-candidates'
import {
  AUTHORITATIVE_DEVELOPMENT_BATCH_KIND,
  AUTHORITATIVE_DEVELOPMENT_BATCH_NAME,
  DEFAULT_CANARY_SIZE,
  EXPECTED_DEVELOPMENT_CANDIDATE_COUNT,
} from './constants'
import { createCanaryManifest } from './manifest'
import { SOURCE_ATTESTATION_SQL, SOURCE_RECORD_PREFIX } from './source'
import type { CanaryCandidate } from './types'

/**
 * The query with its comments removed.
 *
 * The prose in the SQL explains why there is no anti-join and no size arithmetic; it must not be
 * what makes an assertion about those things pass or fail. Every structural claim below is made
 * against the text Postgres would actually execute.
 */
function executable(sql: string): string {
  return sql.replaceAll(/--[^\n]*/gu, '')
}

/*
 * Record payloads, not stdout lines.
 *
 * Framing, attestation, and truncation are now enforced once by `streamGuardedReadOnlyQuery` for
 * every read that crosses the source boundary, and are covered by `source.test.ts`. What is left
 * for this module — and therefore for these tests — is the cohort projection itself.
 */
function candidatePayload(candidate: Partial<CanaryCandidate> & { pmid: string }): unknown {
  return {
    pmid: candidate.pmid,
    abstractPresent: candidate.abstractPresent ?? true,
    publicationYear: candidate.publicationYear ?? 2020,
    journal: candidate.journal ?? 'chest',
    publicationTypes: candidate.publicationTypes ?? ['Journal Article'],
  }
}

function candidates(count: number): unknown[] {
  return Array.from({ length: count }, (_, index) =>
    candidatePayload({
      pmid: String(30_000_000 + index),
      abstractPresent: index % 4 !== 0,
      publicationYear: 2000 + (index % 25),
      journal: `journal-${index % 17}`,
      publicationTypes: index % 3 === 0 ? ['Journal Article', 'Review'] : ['Journal Article'],
    }),
  )
}

/**
 * The batch identity the shipped query actually binds, read back out of the query text.
 *
 * Restating `name = 'gold-set-v1'` in an assertion proves only that the test knows the constant.
 * Extracting the equality literals the query itself carries — and refusing anything but exactly one
 * of each — means the admission fixtures below are evaluated against the query that ships, so
 * "pilot-v1 cannot contribute" is a property of the code rather than of the fixture. No database is
 * involved.
 */
function boundBatchIdentity(sql: string): { name: string; kind: string } {
  const names = [...executable(sql).matchAll(/batch\.name\s*=\s*'([^']*)'/gu)]
  const kinds = [...executable(sql).matchAll(/batch\.kind\s*=\s*'([^']*)'/gu)]
  expect(names).toHaveLength(1)
  expect(kinds).toHaveLength(1)
  return { name: names[0][1], kind: kinds[0][1] }
}

/**
 * Batches the local source does or could hold.
 *
 * `pilot-v1` is the real one that caused the failure: 100 rows, every one of them `development`.
 * The others are the ways a future batch could reintroduce the same defect — a second gold-standard
 * batch, a differently-kinded batch under a similar name, and a name that merely starts with the
 * authoritative one.
 */
const BATCH_FIXTURES = [
  { name: 'pilot-v1', kind: 'pilot', developmentRows: 100, admitted: false },
  { name: 'gold-set-v1', kind: 'gold_standard', developmentRows: 630, admitted: true },
  { name: 'gold-set-v2', kind: 'gold_standard', developmentRows: 400, admitted: false },
  { name: 'gold-set-v1-restore', kind: 'gold_standard', developmentRows: 630, admitted: false },
  { name: 'landmark-v1', kind: 'landmark_regression', developmentRows: 40, admitted: false },
] as const

describe('the candidate query is scoped to one authoritative batch', () => {
  const sql = buildCandidateSql()

  it('joins the batch table to authenticate the source cohort', () => {
    expect(executable(sql)).toContain(
      'join public.literature_gold_set_batches as batch on batch.id = item.batch_id',
    )
    expect(executable(sql)).toContain('from public.literature_gold_set_items as item')
  })

  it('binds the exact authoritative batch name and kind', () => {
    expect(boundBatchIdentity(sql)).toEqual({
      name: AUTHORITATIVE_DEVELOPMENT_BATCH_NAME,
      kind: AUTHORITATIVE_DEVELOPMENT_BATCH_KIND,
    })
    expect(executable(sql)).toContain(`batch.name = '${AUTHORITATIVE_DEVELOPMENT_BATCH_NAME}'`)
    expect(executable(sql)).toContain(`batch.kind = '${AUTHORITATIVE_DEVELOPMENT_BATCH_KIND}'`)
  })

  it('identifies the batch by equality, never by pattern, set, or ordering', () => {
    // A prefix match would admit `gold-set-v1-restore`; a `limit`/`order by created_at` scope would
    // silently follow whichever batch was made most recently.
    const text = executable(sql)
    expect(text).not.toMatch(/batch\.(name|kind)\s*(?:like|ilike|similar|~|~\*|<>|!=|in\s*\()/iu)
    expect(text).not.toMatch(/\bbatch\.(created_at|updated_at|frozen_at|id)\s*(?:>|<|=\s*\()/iu)
    expect(text).not.toMatch(/\border\s+by\s+batch\b/iu)
    expect(text).not.toMatch(/\blimit\b/iu)
  })

  it('does not constrain the batch lifecycle state, which is not part of its identity', () => {
    // The batch may be frozen later without becoming a different development cohort. Requiring
    // `status = 'active'` would turn a routine freeze into a silent empty cohort.
    expect(executable(sql)).not.toMatch(/batch\.status/iu)
    expect(executable(sql)).not.toMatch(/'active'|'frozen'|'archived'/u)
  })

  it.each(BATCH_FIXTURES)(
    'admits $name only when it is the authoritative batch ($admitted)',
    (fixture) => {
      const bound = boundBatchIdentity(sql)
      const admitted = fixture.name === bound.name && fixture.kind === bound.kind
      expect(`${fixture.name}: ${admitted}`).toBe(`${fixture.name}: ${fixture.admitted}`)
    },
  )

  it('admits exactly the authorized cohort size, and the unscoped predicate does not', () => {
    const bound = boundBatchIdentity(sql)
    const admitted = BATCH_FIXTURES.filter(
      (fixture) => fixture.name === bound.name && fixture.kind === bound.kind,
    )
    expect(admitted).toHaveLength(1)
    expect(admitted[0].developmentRows).toBe(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT)

    // The predicate this replaced: `dataset_split = 'development'` alone, across every batch. With
    // only the pilot present that was 730, which is what the local source returned.
    const splitOnly = BATCH_FIXTURES.reduce((total, fixture) => total + fixture.developmentRows, 0)
    expect(splitOnly).not.toBe(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT)
    expect(
      BATCH_FIXTURES.filter((fixture) => ['pilot-v1', 'gold-set-v1'].includes(fixture.name)).reduce(
        (total, fixture) => total + fixture.developmentRows,
        0,
      ),
    ).toBe(730)
  })

  it('identifies the cohort without any size or split arithmetic', () => {
    // `requested_size - (requested_size * test_percent / 100)` is the arithmetic that would produce
    // 630 without ever naming the batch. Neither column is read, and nothing is counted here.
    const text = executable(sql)
    for (const column of [
      'requested_size',
      'test_percent',
      'sampling_seed',
      'sampling_report',
      'sampling_algorithm_version',
      'display_order',
    ]) {
      expect(`${column}: ${text.includes(column)}`).toBe(`${column}: false`)
    }
    expect(text).not.toMatch(/\bcount\s*\(/iu)
    expect(text).not.toMatch(/\bsum\s*\(/iu)
    expect(text).not.toMatch(/\b(?:offset|fetch\s+first)\b/iu)
    expect(text).not.toContain(String(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT))
    expect(text).not.toContain(String(DEFAULT_CANARY_SIZE))
  })
})

describe('the candidate query never reaches the held-out split', () => {
  const sql = buildCandidateSql()

  it('names the development split exactly once, in a WHERE clause', () => {
    const occurrences = [...sql.matchAll(/dataset_split/gu)]
    expect(occurrences).toHaveLength(1)
    expect(sql).toContain(`item.dataset_split = '${DEVELOPMENT_SPLIT}'`)
  })

  it("never names 'test' as a split value", () => {
    // Not as a filter, not as a union, not as an anti-join. The held-out set is not merely excluded
    // from the result — it is absent from the query text.
    expect(sql).not.toMatch(/dataset_split\s*(?:=|<>|!=|in|not\s+in)[^\n]*'test'/iu)
    expect(sql).not.toMatch(/'test'/u)
  })

  it('uses no anti-join or NOT IN, which would infer membership by subtraction', () => {
    expect(sql).not.toMatch(/\bnot\s+in\b/iu)
    expect(sql).not.toMatch(/\bnot\s+exists\b/iu)
    expect(sql).not.toMatch(/\bexcept\b/iu)
    // The outer-join-plus-IS-NULL anti-join, which spells the same subtraction without the keyword,
    // and the set operators that would express it as a difference.
    const text = executable(sql)
    expect(text).not.toMatch(/\b(?:left|right|full|anti)\b[^\n]*\bjoin\b/iu)
    // The one null test in the query is the abstract-presence flag; an anti-join would need another.
    expect([...text.matchAll(/\bis\s+(?:not\s+)?null\b/giu)]).toHaveLength(1)
    expect(text).toContain('article.abstract is not null')
    expect(text).not.toMatch(/\bminus\b/iu)
    expect(text).not.toMatch(/\bintersect\b/iu)
    // Only one comparison is made against the split, and it is equality.
    expect(text).not.toMatch(/dataset_split\s*(?:<>|!=|not\s+in|~|like)/iu)
  })

  it('reads no cohort table other than split membership and the batch identity', () => {
    // The review, revision, and event tables carry labels and reviewer identity.
    for (const table of [
      'literature_gold_set_reviews',
      'literature_gold_set_review_drafts',
      'literature_gold_set_events',
    ]) {
      expect(`${table}: ${sql.includes(table)}`).toBe(`${table}: false`)
    }
    expect(sql).toContain('literature_gold_set_items')
    // The batch table is read, and only to authenticate the cohort: it is named once, in the
    // membership subquery, and contributes no column to the result.
    expect([...executable(sql).matchAll(/literature_gold_set_batches/gu)]).toHaveLength(1)
    expect(executable(sql)).not.toMatch(/'\w+',\s*batch\./u)
  })

  it('projects no cohort field, and never the split itself', () => {
    // The projection is the part an operator's candidate file actually carries.
    const projection = sql.slice(sql.indexOf(SOURCE_RECORD_PREFIX), sql.indexOf('from public.'))
    expect(projection).not.toContain('dataset_split')
    expect(projection).not.toContain('batch.')
    for (const forbidden of FORBIDDEN_COHORT_COLUMNS) {
      expect(`${forbidden}: ${projection.includes(forbidden)}`).toBe(`${forbidden}: false`)
    }
  })

  it('is a read-only transaction that rolls back', () => {
    expect(sql).toContain('begin transaction isolation level repeatable read read only')
    expect(sql.trimEnd().endsWith('rollback;')).toBe(true)
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create)\b/iu)
  })
})

describe('collecting refuses anything that could yield a partial cohort', () => {
  it('accepts exactly the expected development count', () => {
    const parsed = collectCandidates(candidates(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT))
    expect(parsed).toHaveLength(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT)
  })

  it.each([
    ['one short', EXPECTED_DEVELOPMENT_CANDIDATE_COUNT - 1],
    ['one over', EXPECTED_DEVELOPMENT_CANDIDATE_COUNT + 1],
    ['empty', 0],
    // The exact shape the unscoped query returned: the 630 authorized rows plus the 100
    // development-only pilot rows. The count assertion is what caught it, and it still would.
    ['contaminated by the pilot batch', EXPECTED_DEVELOPMENT_CANDIDATE_COUNT + 100],
  ])('refuses a cohort that is %s', (_label, count) => {
    expect(() => collectCandidates(candidates(count))).toThrow(/exactly 630/u)
  })

  it('refuses a row that carried a cohort field', () => {
    // The projection widening is the failure this catches: the row is dropped loudly rather than
    // being silently narrowed, because a silently ignored label means nobody noticed the widening.
    const leaked = {
      pmid: '30000001',
      abstractPresent: true,
      publicationYear: 2020,
      journal: 'chest',
      publicationTypes: [],
      dataset_split: 'development',
    }
    expect(() => collectCandidates([leaked])).toThrow(/bibliography-only/u)
  })

  it('refuses duplicate PMIDs without echoing one', () => {
    const duplicated = [
      candidatePayload({ pmid: '30000001' }),
      candidatePayload({ pmid: '30000001' }),
    ]
    try {
      collectCandidates(duplicated)
      throw new Error('expected a refusal')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).toMatch(/duplicate PMIDs/u)
      expect(message).not.toContain('30000001')
    }
  })

  it('refuses a malformed PMID without echoing it', () => {
    const malformed = {
      pmid: 'not-a-pmid-SENTINEL',
      abstractPresent: true,
      publicationYear: 2020,
      journal: 'chest',
      publicationTypes: [],
    }
    try {
      collectCandidates([malformed])
      throw new Error('expected a refusal')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).not.toContain('SENTINEL')
    }
  })
})

describe('the scoped cohort still drives a deterministic selection', () => {
  it('is unchanged in shape: the same seed and cohort yield the same exact 25', () => {
    // The selector is not touched by this correction; what changed is which 630 records reach it.
    // Asserting it here keeps the end of the chain — read, collect, select — covered by one test.
    const collected = collectCandidates(candidates(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT))
    const forward = createCanaryManifest(collected, 'aabip-monday-fixture')
    const reversed = createCanaryManifest([...collected].reverse(), 'aabip-monday-fixture')

    expect(forward.pmids).toHaveLength(DEFAULT_CANARY_SIZE)
    expect(new Set(forward.pmids).size).toBe(DEFAULT_CANARY_SIZE)
    expect(forward).toEqual(reversed)
    expect(forward.manifestChecksum).toBe(reversed.manifestChecksum)
    // Every selected record came from the scoped cohort and nowhere else.
    const cohort = new Set(collected.map((candidate) => candidate.pmid))
    expect(forward.pmids.every((pmid) => cohort.has(pmid))).toBe(true)
  })

  it('carries the unchanged cohort authority, which this correction does not restate', () => {
    const manifest = createCanaryManifest(
      collectCandidates(candidates(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT)),
      'aabip-monday-fixture',
    )
    expect(manifest.sourceAuthority).toBe('owner-authorized-development-cohort-630')
  })
})

describe('the fixed source guards are untouched by the batch scoping', () => {
  const sql = buildCandidateSql()

  it('still frames both attestations from the shared source attestation', () => {
    // The candidate read is only allowed to differ from the corpus read in its projection and its
    // membership subquery. Both attestation frames must remain the shared ones verbatim.
    const occurrences = sql.split(SOURCE_ATTESTATION_SQL).length - 1
    expect(occurrences).toBe(2)
  })
})

describe('aggregates describe the set without identifying it', () => {
  it('reports counts and a year range only', () => {
    const summary = summarizeCandidates(
      collectCandidates(candidates(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT)),
    )

    expect(summary.count).toBe(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT)
    expect(summary.abstractPresent + summary.abstractAbsent).toBe(
      EXPECTED_DEVELOPMENT_CANDIDATE_COUNT,
    )
    expect(summary.earliestYear).toBe(2000)
    expect(summary.latestYear).toBe(2024)
    expect(summary.distinctJournals).toBe(17)
    expect(summary.distinctPublicationTypes).toBe(2)

    // Nothing serializable from the summary can identify a record.
    const serialized = JSON.stringify(summary)
    expect(serialized).not.toMatch(/\b3000000\d\b/u)
    expect(
      Object.values(summary).every((value) => value === null || typeof value === 'number'),
    ).toBe(true)
  })

  it('reports an unknown-year cohort without inventing a range', () => {
    const summary = summarizeCandidates([
      {
        pmid: '1',
        abstractPresent: false,
        publicationYear: null,
        journal: null,
        publicationTypes: [],
      },
    ])
    expect(summary.earliestYear).toBeNull()
    expect(summary.latestYear).toBeNull()
    expect(summary.yearsUnknown).toBe(1)
  })
})
