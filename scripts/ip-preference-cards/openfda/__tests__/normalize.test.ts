import { manufacturerMatchesAlias, openFdaManufacturerAliasGroups } from '../manufacturer-aliases'
import {
  displayIdentifier,
  exactIdentifierComparison,
  normalizeManufacturerName,
} from '../normalize'
import { openFdaResponseSchema } from '../schemas'
import { sanitizedLivePackageResponse } from './fixtures'

describe('openFDA identifier normalization', () => {
  it('preserves leading-zero identifiers as display strings', () => {
    expect(displayIdentifier('00012345678901')).toBe('00012345678901')
    expect(exactIdentifierComparison('00012345678901')).toBe('00012345678901')
  })

  it('normalizes allowed catalog punctuation without conflating adjacent SKUs', () => {
    expect(exactIdentifierComparison('MAJ-2056')).toBe(exactIdentifierComparison('maj 2056'))
    expect(exactIdentifierComparison('M00552350')).not.toBe(exactIdentifierComparison('M00552351'))
  })

  it('normalizes ordinary legal suffixes only for company comparison', () => {
    expect(normalizeManufacturerName('Boston Scientific Corporation')).toBe(
      normalizeManufacturerName('Boston Scientific'),
    )
    expect(normalizeManufacturerName('Richard Wolf GmbH')).toBe(
      normalizeManufacturerName('Richard Wolf'),
    )
    expect(normalizeManufacturerName('Auris Health (Johnson & Johnson)')).not.toBe(
      normalizeManufacturerName('Johnson & Johnson'),
    )
  })
})

describe('checked-in manufacturer aliases', () => {
  it('is explicit, deterministic, and unique by canonical manufacturer id', () => {
    const ids = openFdaManufacturerAliasGroups.map((group) => group.canonicalManufacturerId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(
      manufacturerMatchesAlias(
        'Becton, Dickinson and Company',
        openFdaManufacturerAliasGroups.find(
          (group) => group.canonicalManufacturerId === 'MFR-E3F284CAE2',
        )!,
      ),
    ).toBe(true)
  })

  it('does not infer an acquisition as an alias', () => {
    const auris = openFdaManufacturerAliasGroups.find(
      (group) => group.canonicalManufacturerId === 'MFR-711B8B255D',
    )!
    expect(manufacturerMatchesAlias('Johnson & Johnson', auris)).toBe(false)
  })

  it('matches only the legal-name variants reviewed during live calibration', () => {
    const byId = new Map(
      openFdaManufacturerAliasGroups.map((group) => [group.canonicalManufacturerId, group]),
    )
    expect(
      manufacturerMatchesAlias('Atrium Medical Corporation', byId.get('MFR-66B998A25F')!),
    ).toBe(true)
    expect(manufacturerMatchesAlias('Auris Health, Inc.', byId.get('MFR-711B8B255D')!)).toBe(true)
    expect(manufacturerMatchesAlias('Erbe Elektromedizin GmbH', byId.get('MFR-5ED32955F4')!)).toBe(
      true,
    )
    expect(
      manufacturerMatchesAlias('OLYMPUS MEDICAL SYSTEMS CORP.', byId.get('MFR-954E57FBB9')!),
    ).toBe(true)
    expect(manufacturerMatchesAlias('COOK IRELAND LTD', byId.get('MFR-2760A3270C')!)).toBe(false)
    expect(manufacturerMatchesAlias('Gyrus ACMI, LLC', byId.get('MFR-954E57FBB9')!)).toBe(false)
  })
})

it('accepts future unknown openFDA fields without dropping them', () => {
  const parsed = openFdaResponseSchema.parse({
    meta: { future_meta: true },
    results: [
      {
        public_device_record_key: 'future-record',
        identifiers: [{ id: '00012345678901', type: 'Primary', future_identifier: 1 }],
        future_record_field: { enabled: true },
      },
    ],
    future_response_field: true,
  })
  expect(parsed.results[0].future_record_field).toEqual({ enabled: true })
  expect(parsed.results[0].identifiers?.[0].future_identifier).toBe(1)
})

it('validates the sanitized live package-record structure', () => {
  const parsed = openFdaResponseSchema.parse(sanitizedLivePackageResponse())
  expect(parsed.results[0].catalog_number).toBeUndefined()
  expect(parsed.results[0].identifiers?.map((identifier) => identifier.type)).toEqual([
    'Primary',
    'Package',
  ])
  expect(parsed.results[0].identifiers?.[1].quantity_per_package).toBe('5')
  expect(parsed.results[0].has_donation_id_number).toBe('false')
})
