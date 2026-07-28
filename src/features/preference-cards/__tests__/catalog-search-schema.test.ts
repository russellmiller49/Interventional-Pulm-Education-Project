import {
  DEFAULT_CATALOG_PAGE_SIZE,
  catalogPageSearchParamsToUrl,
  catalogSearchInputFromUrl,
  catalogSearchSchema,
  serializeCatalogSearchQuery,
} from '../schemas/catalog-search'

function parseUrl(search: string) {
  return catalogSearchSchema.safeParse(catalogSearchInputFromUrl(new URLSearchParams(search)))
}

describe('catalog search schema', () => {
  it('applies defaults for an empty query string', () => {
    const parsed = parseUrl('')
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toMatchObject({
      q: '',
      manufacturers: [],
      tier: 'all',
      sort: 'relevance',
      page: 1,
      pageSize: DEFAULT_CATALOG_PAGE_SIZE,
    })
  })

  it('reads repeated and comma-joined manufacturer params', () => {
    const parsed = parseUrl('manufacturer=MFR-A&manufacturer=MFR-B,MFR-C')
    expect(parsed.success && parsed.data.manufacturers).toEqual(['MFR-A', 'MFR-B', 'MFR-C'])
  })

  it('coerces numeric filters', () => {
    const parsed = parseUrl('diameterMin=12&diameterMax=18.5&channelMax=2')
    expect(parsed.success && parsed.data).toMatchObject({
      diameterMin: 12,
      diameterMax: 18.5,
      channelMax: 2,
    })
  })

  it('rejects an inverted diameter range', () => {
    expect(parseUrl('diameterMin=20&diameterMax=5').success).toBe(false)
  })

  it('rejects an inverted length range', () => {
    expect(parseUrl('lengthMin=200&lengthMax=10').success).toBe(false)
  })

  it('rejects an out-of-range page size', () => {
    expect(parseUrl('pageSize=5000').success).toBe(false)
  })

  it('falls back to defaults for junk enum values', () => {
    expect(parseUrl('tier=bogus').success).toBe(false)
    expect(parseUrl('sort=sideways').success).toBe(false)
  })

  it('round-trips a fully-populated query through the serializer', () => {
    const original = catalogSearchSchema.parse({
      q: 'silicone stent',
      manufacturers: ['MFR-A', 'MFR-B'],
      category: 'Airway stent',
      subcategory: 'Straight silicone',
      role: 'AIRWAY_STENT',
      procedure: 'THERAPEUTIC_BRONCH',
      tier: 'unverified',
      diameterMin: 10,
      diameterMax: 20,
      lengthMin: 30,
      lengthMax: 80,
      channelMax: 2.8,
      sort: 'diameter',
      page: 3,
      pageSize: 50,
    })
    const reparsed = parseUrl(serializeCatalogSearchQuery(original))
    expect(reparsed.success && reparsed.data).toEqual(original)
  })

  it('omits defaults from the serialized query string', () => {
    const serialized = serializeCatalogSearchQuery(catalogSearchSchema.parse({ q: 'stent' }))
    expect(serialized).toBe('q=stent')
  })

  it('converts Next.js searchParams objects to URLSearchParams', () => {
    const params = catalogPageSearchParamsToUrl({
      q: 'stent',
      manufacturer: ['MFR-A', 'MFR-B'],
      empty: undefined,
    })
    expect(params.get('q')).toBe('stent')
    expect(params.getAll('manufacturer')).toEqual(['MFR-A', 'MFR-B'])
    expect(params.has('empty')).toBe(false)
  })
})
