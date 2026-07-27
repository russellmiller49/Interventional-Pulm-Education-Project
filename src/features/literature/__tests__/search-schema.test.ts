import {
  literatureAdminArticleUpdateSchema,
  literatureBulkReviewSchema,
  literatureSearchInputFromUrl,
  literatureSearchSchema,
} from '@/features/literature/schemas/search'
import { serializeLiteratureSearchQuery } from '@/features/literature/search/url'

describe('literature search contracts', () => {
  it('parses bounded shareable URL parameters', () => {
    const params = new URLSearchParams(
      'q=robotic+bronchoscopy&topic=peripheral-navigation&journal=chest&yearFrom=2020&landmark=1&sort=newest&page=2',
    )
    const query = literatureSearchSchema.parse(literatureSearchInputFromUrl(params))

    expect(query).toMatchObject({
      q: 'robotic bronchoscopy',
      topicIds: ['peripheral-navigation'],
      journalIds: ['chest'],
      yearFrom: 2020,
      landmarkOnly: true,
      sort: 'newest',
      page: 2,
      pageSize: 20,
    })
    expect(serializeLiteratureSearchQuery(query)).toBe(
      'q=robotic+bronchoscopy&topic=peripheral-navigation&journal=chest&yearFrom=2020&landmark=1&sort=newest&page=2',
    )
  })

  it('rejects invalid ranges, excessive page sizes, and overlong queries', () => {
    expect(() =>
      literatureSearchSchema.parse({
        ...literatureSearchInputFromUrl(new URLSearchParams()),
        yearFrom: 2025,
        yearTo: 2020,
      }),
    ).toThrow(/yearFrom/u)

    expect(() =>
      literatureSearchSchema.parse({
        ...literatureSearchInputFromUrl(new URLSearchParams()),
        pageSize: 51,
      }),
    ).toThrow()

    expect(() =>
      literatureSearchSchema.parse({
        ...literatureSearchInputFromUrl(new URLSearchParams()),
        q: 'x'.repeat(301),
      }),
    ).toThrow()
  })

  it('requires a reason for exclusion and at least one actual change', () => {
    expect(() =>
      literatureAdminArticleUpdateSchema.parse({
        relevanceState: 'excluded',
      }),
    ).toThrow(/exclusion reason/u)
    expect(() => literatureAdminArticleUpdateSchema.parse({})).toThrow(/At least one/u)
  })

  it('rejects duplicate topic decisions and bulk PMIDs', () => {
    expect(() =>
      literatureAdminArticleUpdateSchema.parse({
        topicDecisions: [
          { topicId: 'ebus-mediastinal-staging', state: 'confirmed' },
          { topicId: 'ebus-mediastinal-staging', state: 'rejected' },
        ],
      }),
    ).toThrow(/unique topic IDs/u)

    expect(() =>
      literatureBulkReviewSchema.parse({
        pmids: ['12345678', '12345678'],
        update: { isLandmark: true },
      }),
    ).toThrow(/must be unique/u)
  })
})
