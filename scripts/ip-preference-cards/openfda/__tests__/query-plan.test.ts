import { buildOpenFdaRequestUrl } from '../client'
import { escapeOpenFdaQuotedValue, redactApiKey } from '../normalize'
import { buildOpenFdaQueryPlan, filterOpenFdaRecordsForQuery } from '../query-plan'
import { acmeAliasGroup, catalogProduct, openFdaRecord, verificationBacklog } from './fixtures'

describe('deterministic openFDA query plans', () => {
  it('orders DI, catalog, company, model, alternate, and fallback phases', () => {
    const plan = buildOpenFdaQueryPlan(
      catalogProduct({
        gtin: '00012345678901',
        global_part_number: 'GLOBAL-001',
        alternate_ids: 'ALT-001; ALT-002',
      }),
      acmeAliasGroup,
      {
        backlog: verificationBacklog({ suggested_primary_di: '00012345678902' }),
      },
    )
    expect(plan.map((query) => query.phase)).toEqual([...plan.map((query) => query.phase)].sort())
    expect(plan.map((query) => query.kind)).toEqual(
      expect.arrayContaining([
        'primary_di',
        'catalog_number',
        'catalog_number_company',
        'model_number',
        'alternate_identifier',
        'brand_fallback',
      ]),
    )
    expect(plan.every((query) => query.limit <= 100)).toBe(true)
  })

  it('escapes quotes and backslashes before URL encoding', () => {
    expect(escapeOpenFdaQuotedValue('Model "A"\\B')).toBe('Model \\"A\\"\\\\B')
    const plan = buildOpenFdaQueryPlan(
      catalogProduct({ catalog_number: 'Model "A"\\B', brand_family: null }),
      acmeAliasGroup,
    )
    expect(plan[0].search).toContain('catalog_number:"Model \\"A\\"\\\\B"')
    const url = buildOpenFdaRequestUrl({
      apiKey: 'SECRET-KEY',
      search: plan[0].search,
      limit: 100,
    })
    expect(url.searchParams.get('search')).toBe(plan[0].search)
  })

  it('redacts API keys from URLs shown in errors or logs', () => {
    const url = buildOpenFdaRequestUrl({
      apiKey: 'SECRET-KEY',
      search: 'catalog_number:"CAT-001"',
      limit: 1,
    })
    expect(redactApiKey(url.toString())).not.toContain('SECRET-KEY')
  })

  it('does not treat a workflow placeholder as a device identifier', () => {
    const plan = buildOpenFdaQueryPlan(
      catalogProduct({
        catalog_number: 'CUSTOM-SERVICE',
        global_part_number: null,
        reference_part_number: null,
        alternate_ids: null,
      }),
      acmeAliasGroup,
    )
    expect(plan.filter((query) => query.phase < 5)).toEqual([])
    expect(plan.map((query) => query.kind)).toEqual(['brand_fallback'])
  })

  it('locally removes analyzed-search false positives before classification', () => {
    const query = buildOpenFdaQueryPlan(
      catalogProduct({ catalog_number: '6522', brand_family: null }),
      acmeAliasGroup,
    ).find((candidate) => candidate.kind === 'catalog_number')!
    const records = [
      openFdaRecord({
        public_device_record_key: 'exact',
        catalog_number: '6522',
      }),
      openFdaRecord({
        public_device_record_key: 'analyzed-false-positive',
        catalog_number: 'ABC-6522-X',
      }),
    ]
    expect(
      filterOpenFdaRecordsForQuery(records, query).map((record) => record.public_device_record_key),
    ).toEqual(['exact'])
  })
})
