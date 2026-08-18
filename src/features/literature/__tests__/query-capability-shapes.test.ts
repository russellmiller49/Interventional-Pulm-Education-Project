/** @jest-environment node */

/**
 * Capability values built from the shapes the real schema actually produces.
 *
 * Two defects motivated this file, and they share a cause: the existing tests constructed query
 * objects by hand behind `as unknown as` casts, so they certified behaviour for shapes the parser
 * cannot emit.
 *
 *   1. `searchIsUnfiltered` compared `query.yearFrom === null`. `literatureSearchSchema`
 *      preprocesses an absent year to `undefined`, so the comparison was false for every parsed
 *      query and the guard never returned true — `capabilityFromArticleCount` was unreachable from
 *      the search path. The hand-built fixture passed `yearFrom: null`, a shape the schema cannot
 *      produce, so the suite reported the intended behaviour as working.
 *   2. `loadLiteratureReviewQueue` dropped a failed association read and returned success.
 *
 * So every query here comes from `literatureSearchSchema.parse` / `literatureReviewQueueSchema.parse`
 * — the same path a request takes — and the Supabase client is stubbed at the module boundary so
 * the assertions are about capability values rather than about mocks.
 */

const clientForOperation = jest.fn()
jest.mock('../server/database-client', () => ({
  literatureClientForOperation: (...args: unknown[]) =>
    (clientForOperation as unknown as (...a: unknown[]) => unknown)(...args),
}))

import {
  literatureReviewQueueSchema,
  literatureSearchInputFromUrl,
  literatureSearchSchema,
} from '@/features/literature/schemas/search'
import { loadLiteratureReviewQueue, searchLiterature } from '../server/queries'
import { capabilityCarriesCounts } from '../server/runtime-capability'

const PROJECT_REF = 'itcttmkxdxvwmwcmzmey'

function parsedSearch(queryString: string) {
  return literatureSearchSchema.parse(
    literatureSearchInputFromUrl(new URLSearchParams(queryString)),
  )
}

/**
 * A client stub whose query builder is itself thenable.
 *
 * `loadAssociations` awaits the builder directly after `.order(...)`, while the review queue awaits
 * `.range(...)`. Terminating only one of those left the association read resolving to the builder
 * object, whose `error` is `undefined` — so the failure case under test never fired and the test
 * passed for the wrong reason. Every chain method returns the same thenable builder.
 */
function stubClient(options: {
  rpcRows?: unknown[]
  tableRows?: unknown[]
  tableError?: { code: string } | null
  count?: number
}) {
  const result = {
    data: options.tableRows ?? [],
    error: options.tableError ?? null,
    count: options.count ?? (options.tableRows ?? []).length,
  }

  const builder: Record<string, unknown> = {
    // Awaiting the builder at any point in the chain yields the result.
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  }
  for (const method of [
    'select',
    'in',
    'eq',
    'is',
    'not',
    'order',
    'textSearch',
    'limit',
    'range',
    'maybeSingle',
  ]) {
    builder[method] = jest.fn(() => builder)
  }

  return {
    rpc: jest.fn(async () => ({ data: options.rpcRows ?? [], error: null })),
    from: jest.fn(() => builder),
  }
}

beforeEach(() => {
  clientForOperation.mockReset()
})

describe('an unfiltered search speaks for the corpus', () => {
  it('reports a measured empty corpus for a query with no filters at all', async () => {
    clientForOperation.mockReturnValue({
      client: stubClient({ rpcRows: [] }),
      capability: null,
      projectRef: PROJECT_REF,
    })
    // Straight from the URL parser — `yearFrom`/`yearTo` are `undefined` here, not `null`.
    const query = parsedSearch('')
    expect(query.yearFrom).toBeUndefined()
    expect(query.yearTo).toBeUndefined()

    const result = await searchLiterature(query)
    expect(result.error).toBeNull()
    expect(result.capability.state).toBe('foundation_ready_empty')
  })

  it('reports a measured population for an unfiltered search with rows', async () => {
    clientForOperation.mockReturnValue({
      client: stubClient({ rpcRows: [{ pmid: '1', title: 'x', total_count: 25 }] }),
      capability: null,
      projectRef: PROJECT_REF,
    })
    const result = await searchLiterature(parsedSearch(''))
    expect(result.capability.state).toBe('foundation_ready_populated')
  })

  it.each([
    ['a keyword', 'q=bronchoscopy'],
    ['a year floor', 'yearFrom=2020'],
    ['a year ceiling', 'yearTo=2024'],
    ['landmark only', 'landmark=1'],
  ])('reports a filtered read for %s', async (_label, queryString) => {
    clientForOperation.mockReturnValue({
      client: stubClient({ rpcRows: [] }),
      capability: null,
      projectRef: PROJECT_REF,
    })
    const result = await searchLiterature(parsedSearch(queryString))
    // Zero rows here means the filter matched nothing, which is not a claim about the corpus.
    expect(result.capability.state).toBe('foundation_ready_filtered')
  })

  it('treats admin preview as a widening, not a filter', async () => {
    clientForOperation.mockReturnValue({
      client: stubClient({ rpcRows: [] }),
      capability: null,
      projectRef: PROJECT_REF,
    })
    const result = await searchLiterature(parsedSearch('adminPreview=1'))
    expect(result.capability.state).toBe('foundation_ready_empty')
  })
})

describe('the review queue does not hide a failed association read', () => {
  it('keeps a physician-reviewed exclusion available through All Literature', async () => {
    const reviewedExclusion = {
      pmid: '87654321',
      title: 'Synthetic reviewed exclusion',
      authors: [],
      relevance_state: 'excluded',
      visibility_state: 'draft',
      reviewed_relevance: 'exclude',
    }
    clientForOperation.mockImplementation((operation: string) => ({
      client:
        operation === 'review_queue_read'
          ? stubClient({ tableRows: [reviewedExclusion], count: 1 })
          : stubClient({ tableRows: [] }),
      capability: null,
      projectRef: PROJECT_REF,
    }))

    const result = await loadLiteratureReviewQueue(literatureReviewQueueSchema.parse({}))

    expect(result.error).toBeNull()
    expect(result.data?.total).toBe(1)
    expect(result.data?.items[0]).toMatchObject({
      pmid: '87654321',
      relevanceState: 'excluded',
      visibilityState: 'draft',
    })
  })

  it('reports the failure rather than an article with no provenance', async () => {
    /*
     * The concrete regression: `literature_articles` readable, the two association tables denied.
     * Before the fix this returned success, and the page rendered every article with "No source
     * provenance" and no topics under a banner saying the project answered.
     */
    const article = { pmid: '12345678', title: 'An article', authors: [] }
    clientForOperation.mockImplementation((operation: string) => ({
      client:
        operation === 'review_queue_read'
          ? stubClient({ tableRows: [article], count: 1 })
          : stubClient({ tableRows: [], tableError: { code: '42501' } }),
      capability: null,
      projectRef: PROJECT_REF,
    }))

    const result = await loadLiteratureReviewQueue(literatureReviewQueueSchema.parse({}))
    expect(result.data).toBeNull()
    // 42501 is a refusal, not a missing object, so it classifies as an outage rather than as a
    // missing foundation — and either way it carries no counts, which is the load-bearing part.
    expect(result.capability.state).toBe('temporarily_unavailable')
    expect(result.capability.reason).toBe('permission_denied')
    expect(capabilityCarriesCounts(result.capability.state)).toBe(false)
  })

  it('still succeeds when the associations are simply empty', async () => {
    // An article with no provenance rows is a legitimate state; only a *failed* read is not.
    const article = { pmid: '12345678', title: 'An article', authors: [] }
    clientForOperation.mockImplementation((operation: string) => ({
      client:
        operation === 'review_queue_read'
          ? stubClient({ tableRows: [article], count: 1 })
          : stubClient({ tableRows: [], tableError: null }),
      capability: null,
      projectRef: PROJECT_REF,
    }))

    const result = await loadLiteratureReviewQueue(literatureReviewQueueSchema.parse({}))
    expect(result.error).toBeNull()
    expect(result.data?.items).toHaveLength(1)
    expect(result.data?.items[0].sources).toEqual([])
  })
})
