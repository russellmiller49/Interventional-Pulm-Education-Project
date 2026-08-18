/** @jest-environment node */

const clientForOperation = jest.fn()

jest.mock('./database-client', () => ({
  literatureClientForOperation: (...args: unknown[]) =>
    (clientForOperation as unknown as (...parameters: unknown[]) => unknown)(...args),
}))

import { literatureCuratedCollectionSchema } from '@/features/literature/schemas/search'
import {
  getLiteratureReviewedMetadata,
  loadLiteratureCuratedCollection,
  loadLiteratureCuratedStats,
} from './queries'
import { capabilityCarriesCounts } from './runtime-capability'

const PROJECT_REF = 'itcttmkxdxvwmwcmzmey'
const RAW_SOURCE_SENTINEL =
  'owner-authorized-development-cohort-630/gold-set-v1/gold_standard@sha256:RAW_SOURCE_SENTINEL'
const RAW_OPERATION_SENTINEL = '00000000-0000-4000-8000-RAW_OPERATION_SENTINEL'

interface StubResult {
  data: unknown
  error: { code: string } | null
  count: number | null
}

interface TracedBuilder {
  then: (
    resolve: (value: StubResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>
  select: jest.Mock
  not: jest.Mock
  eq: jest.Mock
  in: jest.Mock
  textSearch: jest.Mock
  order: jest.Mock
  range: jest.Mock
  maybeSingle: jest.Mock
}

function tracedBuilder(overrides: Partial<StubResult> = {}) {
  const result: StubResult = {
    data: [],
    error: null,
    count: 0,
    ...overrides,
  }
  const builder = {} as TracedBuilder
  for (const method of [
    'select',
    'not',
    'eq',
    'in',
    'textSearch',
    'order',
    'range',
    'maybeSingle',
  ] as const) {
    builder[method] = jest.fn(() => builder)
  }
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return builder
}

function installBuilders(builders: TracedBuilder[]) {
  const remaining = [...builders]
  const from = jest.fn(() => {
    const next = remaining.shift()
    if (!next) throw new Error('No traced Literature query builder remains.')
    return next
  })
  clientForOperation.mockReturnValue({
    client: { from },
    capability: null,
    projectRef: PROJECT_REF,
  })
  return from
}

function curatedQuery(
  overrides: Partial<ReturnType<typeof literatureCuratedCollectionSchema.parse>> = {},
) {
  return literatureCuratedCollectionSchema.parse(overrides)
}

function reviewedRow(overrides: Record<string, unknown> = {}) {
  return {
    pmid: '12345678',
    doi: '10.1000/synthetic',
    title: 'Synthetic reviewed article',
    abstract: 'A synthetic abstract used only by Jest.',
    authors: [{ fullName: 'Example Author', abbreviatedName: 'Author E' }],
    journal_title: 'Synthetic Journal',
    journal_abbreviation: 'Synth J',
    publication_year: 2026,
    volume: '1',
    issue: '2',
    pages: '3-4',
    publication_types: ['Journal Article'],
    is_retracted: false,
    is_correction: false,
    is_conference_abstract: false,
    visibility_state: 'draft',
    reviewed_relevance: 'include_core',
    reviewed_enrichment_provenance: 'physician_confirmed',
    reviewed_source_identity: RAW_SOURCE_SENTINEL,
    reviewed_at: '2026-08-16T12:00:00.000Z',
    reviewed_operation_id: RAW_OPERATION_SENTINEL,
    ...overrides,
  }
}

beforeEach(() => {
  clientForOperation.mockReset()
})

describe('Curated Literature statistics', () => {
  it('keeps corpus, reviewed, Curated, Core, Adjacent, and exclusion counts distinct', async () => {
    const builders = [132_350, 630, 283, 75, 272, 132_350].map((count) => tracedBuilder({ count }))
    installBuilders(builders)

    const result = await loadLiteratureCuratedStats()

    expect(clientForOperation).toHaveBeenCalledWith('reviewed_overlay_read')
    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      fullCorpus: 132_350,
      physicianReviewed: 630,
      curated: 358,
      core: 283,
      adjacent: 75,
      reviewedExclusions: 272,
      draftArticles: 132_350,
    })

    for (const builder of builders.slice(1, 5)) {
      expect(builder.not.mock.calls.map(([column]) => column)).toEqual([
        'reviewed_relevance',
        'reviewed_enrichment_provenance',
        'reviewed_source_identity',
        'reviewed_at',
        'reviewed_operation_id',
      ])
    }
    expect(builders[2].eq).toHaveBeenCalledWith('reviewed_relevance', 'include_core')
    expect(builders[3].eq).toHaveBeenCalledWith('reviewed_relevance', 'include_adjacent')
    expect(builders[4].eq).toHaveBeenCalledWith('reviewed_relevance', 'exclude')
  })

  it('treats an absent count as unavailable rather than zero', async () => {
    installBuilders([
      tracedBuilder({ count: null }),
      ...[0, 0, 0, 0, 0].map((count) => tracedBuilder({ count })),
    ])

    const result = await loadLiteratureCuratedStats()

    expect(result.data).toBeNull()
    expect(result.capability.state).toBe('temporarily_unavailable')
    expect(capabilityCarriesCounts(result.capability.state)).toBe(false)
  })
})

describe('Curated Literature search', () => {
  it('uses only complete reviewed core/adjacent rows and keeps raw lineage server-side', async () => {
    const builder = tracedBuilder({ data: [reviewedRow()], count: 1 })
    installBuilders([builder])

    const result = await loadLiteratureCuratedCollection(
      curatedQuery({ q: 'bronchoscopy', page: 2, pageSize: 10 }),
    )

    expect(clientForOperation).toHaveBeenCalledWith('reviewed_overlay_read')
    expect(builder.not.mock.calls.map(([column]) => column)).toEqual([
      'reviewed_relevance',
      'reviewed_enrichment_provenance',
      'reviewed_source_identity',
      'reviewed_at',
      'reviewed_operation_id',
    ])
    expect(builder.in).toHaveBeenCalledWith('reviewed_relevance', [
      'include_core',
      'include_adjacent',
    ])
    expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'bronchoscopy', {
      config: 'english',
      type: 'websearch',
    })
    expect(builder.range).toHaveBeenCalledWith(10, 19)
    expect(builder.order.mock.calls).toEqual([
      ['publication_year', { ascending: false, nullsFirst: false }],
      ['pmid', { ascending: false }],
    ])
    expect(builder.eq.mock.calls.some(([column]) => column === 'relevance_state')).toBe(false)

    expect(result.data?.items).toHaveLength(1)
    expect(result.data?.items[0].reviewed).toEqual({
      reviewedRelevance: 'include_core',
      enrichmentProvenance: 'physician_confirmed',
      sourceKind: 'owner_authorized_development_cohort',
      reviewedAt: '2026-08-16T12:00:00.000Z',
      curated: true,
    })
    expect(Object.keys(result.data!.items[0].reviewed).sort()).toEqual([
      'curated',
      'enrichmentProvenance',
      'reviewedAt',
      'reviewedRelevance',
      'sourceKind',
    ])
    const browserDto = JSON.stringify(result.data)
    expect(browserDto).not.toContain(RAW_SOURCE_SENTINEL)
    expect(browserDto).not.toContain(RAW_OPERATION_SENTINEL)
    expect(browserDto).not.toMatch(
      /reviewed_source_identity|reviewed_operation_id|checksum|digest/iu,
    )
  })

  it.each([
    ['core', 'include_core'],
    ['adjacent', 'include_adjacent'],
  ] as const)(
    'applies the %s reviewed-class filter on the server',
    async (reviewedClass, value) => {
      const builder = tracedBuilder({
        data: [
          reviewedRow({
            reviewed_relevance: value,
          }),
        ],
        count: 1,
      })
      installBuilders([builder])

      const result = await loadLiteratureCuratedCollection(curatedQuery({ reviewedClass }))

      expect(result.error).toBeNull()
      expect(builder.eq).toHaveBeenCalledWith('reviewed_relevance', value)
      expect(builder.in).not.toHaveBeenCalled()
    },
  )

  it('fails closed if a returned row is excluded, unreviewed, or incomplete', async () => {
    for (const row of [
      reviewedRow({ reviewed_relevance: 'exclude' }),
      reviewedRow({
        reviewed_relevance: null,
        reviewed_enrichment_provenance: null,
        reviewed_source_identity: null,
        reviewed_at: null,
        reviewed_operation_id: null,
      }),
      reviewedRow({ reviewed_operation_id: null }),
    ]) {
      installBuilders([tracedBuilder({ data: [row], count: 1 })])
      const result = await loadLiteratureCuratedCollection(curatedQuery())
      expect(result.data).toBeNull()
      expect(capabilityCarriesCounts(result.capability.state)).toBe(false)
    }
  })
})

describe('reviewed metadata on article detail', () => {
  it('maps a complete overlay to controlled display fields only', async () => {
    installBuilders([tracedBuilder({ data: reviewedRow(), count: null })])

    const result = await getLiteratureReviewedMetadata('12345678')

    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      reviewedRelevance: 'include_core',
      enrichmentProvenance: 'physician_confirmed',
      sourceKind: 'owner_authorized_development_cohort',
      reviewedAt: '2026-08-16T12:00:00.000Z',
      curated: true,
    })
    expect(JSON.stringify(result.data)).not.toContain(RAW_SOURCE_SENTINEL)
    expect(JSON.stringify(result.data)).not.toContain(RAW_OPERATION_SENTINEL)
  })

  it('reports an all-null overlay as Unreviewed rather than excluded', async () => {
    installBuilders([
      tracedBuilder({
        data: reviewedRow({
          reviewed_relevance: null,
          reviewed_enrichment_provenance: null,
          reviewed_source_identity: null,
          reviewed_at: null,
          reviewed_operation_id: null,
        }),
        count: null,
      }),
    ])

    const result = await getLiteratureReviewedMetadata('12345678')

    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
  })
})
