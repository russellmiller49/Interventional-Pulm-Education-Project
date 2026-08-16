/** @jest-environment node */

import { ARTICLE_SELECT_COLUMNS } from './constants'
import { mapSourceEnvelope, validateSourceEnvelope } from './mapping'
import { fixtureEnvelope } from './test-fixtures'
import type { SourceArticleRow, SourceEnvelope } from './types'

const BATCH_ID = '10000000-0000-4000-8000-000000000001'
const OTHER_BATCH_ID = '10000000-0000-4000-8000-000000000002'
const DESTINATION_STATE_KEYS = [
  'relevance_state',
  'visibility_state',
  'manual_override',
  'is_landmark',
  'curation_reason',
  'classifier_version',
  'classifier_payload',
] as const

describe('bibliographic source mapping', () => {
  it('copies every approved bibliographic field exactly and forces safe destination state', () => {
    const envelope = fixtureEnvelope('10001')
    const prepared = mapSourceEnvelope(envelope, BATCH_ID, 'full')

    for (const column of ARTICLE_SELECT_COLUMNS) {
      expect(prepared.article[column]).toEqual(envelope.article[column])
    }
    expect(Object.keys(prepared.article).sort()).toEqual(
      [...ARTICLE_SELECT_COLUMNS, ...DESTINATION_STATE_KEYS].sort(),
    )
    expect(prepared.article).toMatchObject({
      relevance_state: 'unreviewed',
      visibility_state: 'draft',
      manual_override: false,
      is_landmark: false,
      curation_reason: null,
      classifier_version: null,
      classifier_payload: null,
    })
    expect(prepared.article).not.toHaveProperty('search_vector')
    expect(prepared.article).not.toHaveProperty('created_at')
    expect(prepared.article).not.toHaveProperty('updated_at')
    expect(prepared.provenance).toEqual({
      pmid: '10001',
      batch_id: BATCH_ID,
      source_kind: 'unmapped',
      source_id: 'fixed-local-bibliographic-corpus',
      query_id: 'production-full',
      source_filename: 'supabase_db_ip-literature-local/postgres/public.literature_articles',
    })
  })

  it('accepts schema-supported partial metadata without inventing values', () => {
    const envelope = fixtureEnvelope(
      '10002',
      {
        doi: null,
        pmcid: null,
        abstract: null,
        abstract_display_policy: 'hidden',
        journal_id: null,
        journal_title: null,
        journal_abbreviation: null,
        nlm_journal_id: null,
        issn_values: [],
        publication_date_raw: null,
        publication_year: null,
        publication_month: null,
        publication_day: null,
        publication_date_precision: 'unknown',
        publication_types: [],
        mesh_terms: [],
        author_keywords: [],
        languages: [],
        authors: [],
        collective_authors: [],
        affiliations: [],
        volume: null,
        issue: null,
        pages: null,
        article_number: null,
        place_of_publication: null,
        citation_source: null,
        conflict_of_interest: null,
        pubmed_status: null,
        pubmed_last_revised_at: null,
        pubmed_created_at: null,
        raw_nbib_tags: {},
      },
      null,
    )

    const prepared = mapSourceEnvelope(envelope, BATCH_ID, 'canary')

    expect(prepared.article.abstract).toBeNull()
    expect(prepared.article.publication_year).toBeNull()
    expect(prepared.article.authors).toEqual([])
    expect(prepared.journal).toBeNull()
    expect(prepared.provenance.query_id).toBe('production-canary')
  })

  it('rejects source state, search fields, and every other unapproved projection field', () => {
    for (const forbiddenField of [
      'relevance_state',
      'visibility_state',
      'manual_override',
      'classifier_payload',
      'search_vector',
      'created_at',
      'unexpected_membership',
    ]) {
      const envelope = fixtureEnvelope('10003') as SourceEnvelope & {
        article: Record<string, unknown>
      }
      envelope.article[forbiddenField] = forbiddenField === 'manual_override' ? true : 'forbidden'
      expect(() => validateSourceEnvelope(envelope as SourceEnvelope)).toThrow(
        /forbidden article field|unapproved article field/u,
      )
    }
  })

  it('requires the explicit projection and a matching journal foreign key', () => {
    const missing = fixtureEnvelope('10004') as SourceEnvelope & {
      article: Record<string, unknown>
    }
    delete (missing.article as Partial<SourceArticleRow>).mesh_terms
    expect(() => validateSourceEnvelope(missing as SourceEnvelope)).toThrow(
      'omitted required article field mesh_terms',
    )

    expect(() => validateSourceEnvelope(fixtureEnvelope('10005', {}, null))).toThrow(
      'no matching journal row',
    )
    expect(() =>
      validateSourceEnvelope(
        fixtureEnvelope(
          '10006',
          {},
          {
            ...fixtureEnvelope('10006').journal!,
            id: 'journal-b',
          },
        ),
      ),
    ).toThrow('identifiers disagree')
  })

  it('deep-copies mutable JSON values and keeps replay checksums independent of batch IDs', () => {
    const envelope = fixtureEnvelope('10007')
    const first = mapSourceEnvelope(envelope, BATCH_ID, 'full')
    const replay = mapSourceEnvelope(envelope, OTHER_BATCH_ID, 'full')

    expect(first.canonicalChecksumInput).toBe(replay.canonicalChecksumInput)
    expect(first.article.authors).not.toBe(envelope.article.authors)
    expect(first.article.raw_nbib_tags).not.toBe(envelope.article.raw_nbib_tags)
    expect(first.article.issn_values).not.toBe(envelope.article.issn_values)
    expect(first.journal).not.toBe(envelope.journal)
  })

  it('rejects a non-UUID destination import batch identifier', () => {
    expect(() => mapSourceEnvelope(fixtureEnvelope('10008'), 'not-a-uuid', 'full')).toThrow(
      'must be a UUID',
    )
  })
})
