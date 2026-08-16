/** @jest-environment node */

/**
 * The canary-candidate boundary, which is the only place in this package that names a cohort table.
 *
 * Two properties matter more than the rest, and both are asserted against the generated SQL rather
 * than against a comment:
 *
 *   1. the held-out split is never named, in any form — not selected, not counted, not anti-joined;
 *   2. no cohort field ever reaches the projection, so a candidate file discloses only that these
 *      PMIDs are in the development collection, which is exactly what the owner authorizes.
 */

import {
  DEVELOPMENT_SPLIT,
  FORBIDDEN_COHORT_COLUMNS,
  buildCandidateSql,
  collectCandidates,
  summarizeCandidates,
} from './canary-candidates'
import { EXPECTED_DEVELOPMENT_CANDIDATE_COUNT } from './constants'
import { SOURCE_RECORD_PREFIX } from './source'
import type { CanaryCandidate } from './types'

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
  })

  it('reads no cohort table other than the split membership itself', () => {
    // The review, revision, and event tables carry labels and reviewer identity.
    for (const table of [
      'literature_gold_set_reviews',
      'literature_gold_set_review_drafts',
      'literature_gold_set_events',
      'literature_gold_set_batches',
    ]) {
      expect(`${table}: ${sql.includes(table)}`).toBe(`${table}: false`)
    }
    expect(sql).toContain('literature_gold_set_items')
  })

  it('projects no cohort field', () => {
    // The projection is the part an operator's candidate file actually carries.
    const projection = sql.slice(sql.indexOf(SOURCE_RECORD_PREFIX), sql.indexOf('from public.'))
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
