import {
  applyProductOverrides,
  type ProductOverridesFile,
} from '../../../../scripts/ip-preference-cards/apply-product-overrides'
import { getUseDetail, searchProductFamiliesForRole } from '../server/catalog'

function file(overrides: ProductOverridesFile['overrides']): ProductOverridesFile {
  return { format_version: '1.0', notes: 'test', overrides }
}

describe('applyProductOverrides', () => {
  it('patches exactly the row it matched', () => {
    const products = [
      {
        product_id: 'PRD-1',
        manufacturer: 'Olympus',
        catalog_number: 'EU-ME2',
        brand_family: 'EU-ME2',
      },
      {
        product_id: 'PRD-2',
        manufacturer: 'Olympus',
        catalog_number: 'EU-ME3',
        brand_family: 'EVIS EUS',
      },
    ]
    const report = applyProductOverrides(
      products,
      file([
        {
          match: { manufacturer: 'Olympus', catalog_number: 'EU-ME2' },
          reason: 'same platform',
          set: { brand_family: 'EVIS EUS' },
        },
      ]),
    )
    expect(report.errors).toEqual([])
    expect(report.products_changed).toBe(1)
    expect(report.fields_changed).toBe(1)
    expect(products[0].brand_family).toBe('EVIS EUS')
    expect(products[1].brand_family).toBe('EVIS EUS')
  })

  it('records the reason so the import report explains itself', () => {
    const products = [
      {
        product_id: 'PRD-1',
        manufacturer: 'Olympus',
        catalog_number: 'EU-ME2',
        brand_family: 'EU-ME2',
      },
    ]
    const report = applyProductOverrides(
      products,
      file([
        {
          match: { catalog_number: 'EU-ME2' },
          reason: 'both generations of one platform',
          set: { brand_family: 'EVIS EUS' },
        },
      ]),
    )
    expect(report.reasons).toEqual(['catalog_number=EU-ME2: both generations of one platform'])
  })

  it('fails when a match is ambiguous or missing rather than guessing', () => {
    const products = [
      { product_id: 'PRD-1', manufacturer: 'Olympus', catalog_number: 'EU-ME2' },
      { product_id: 'PRD-2', manufacturer: 'Olympus', catalog_number: 'EU-ME2' },
    ]
    const ambiguous = applyProductOverrides(
      products,
      file([{ match: { catalog_number: 'EU-ME2' }, reason: 'x', set: { brand_family: 'Y' } }]),
    )
    expect(ambiguous.errors).toHaveLength(1)
    expect(ambiguous.errors[0]).toContain('matched 2 products')

    const missing = applyProductOverrides(
      products,
      file([{ match: { catalog_number: 'NOPE' }, reason: 'x', set: { brand_family: 'Y' } }]),
    )
    expect(missing.errors[0]).toContain('matched 0 products')
    expect(missing.applied).toBe(false)
  })

  it('refuses to apply when the workbook value is no longer what the override expected', () => {
    // The guard that stops a stale override from silently rewriting a row someone already
    // corrected upstream.
    const products = [{ product_id: 'PRD-1', catalog_number: 'EU-ME2', brand_family: 'EVIS EUS' }]
    const report = applyProductOverrides(
      products,
      file([
        {
          match: { catalog_number: 'EU-ME2' },
          reason: 'x',
          expect: { brand_family: 'EU-ME2' },
          set: { brand_family: 'Something else' },
        },
      ]),
    )
    expect(report.errors[0]).toContain('needs review')
    expect(products[0].brand_family).toBe('EVIS EUS')
  })

  it('is a no-op without an overrides file', () => {
    const report = applyProductOverrides([{ product_id: 'PRD-1' }], null)
    expect(report).toMatchObject({ products_changed: 0, errors: [] })
  })
})

describe('endoscopic ultrasound processors in the generated catalog', () => {
  it('groups both Olympus generations into one EVIS EUS product line', () => {
    // EU-ME2 (legacy) and EU-ME3 (current) are two generations of one platform. The workbook
    // filed them under different brand families, which split them into two single-product
    // lines in the explorer.
    const families = searchProductFamiliesForRole({ roleCode: 'ULTRASOUND_PROCESSOR' })
    const olympus = families.filter((family) => family.manufacturerDisplay === 'Olympus')
    expect(olympus).toHaveLength(1)
    expect(olympus[0].familyName).toBe('EVIS EUS')
    expect(olympus[0].variants.map((variant) => variant.catalogNumber).sort()).toEqual([
      'EU-ME2',
      'EU-ME3',
    ])
    // Both names carry the model, so the two generations read apart on a card.
    for (const variant of olympus[0].variants) {
      expect(variant.productName).toContain(variant.catalogNumber!)
    }
  })

  it('lists the FUJIFILM processors that drive an EBUS bronchoscope', () => {
    const detail = getUseDetail('ULTRASOUND_PROCESSOR')
    const numbers = (detail?.manufacturerGroups ?? [])
      .flatMap((group) => group.items)
      .map((item) => item.catalogNumber)
    expect(numbers).toEqual(expect.arrayContaining(['SU-1', 'SU-1 PLATINUM', 'ARIETTA 750']))
    // The ARIETTA 850 is in commercial distribution but its applicable-endoscope list covers
    // only the EG-series gastroscopes, so it is deliberately not an IP ultrasound processor.
    expect(numbers).not.toContain('ARIETTA 850')
  })

  it('pairs the FUJIFILM radial mini probe with its drive unit', () => {
    const probe =
      getUseDetail('RADIAL_EBUS_PROBE')?.manufacturerGroups.flatMap((g) => g.items) ?? []
    const drive =
      getUseDetail('RADIAL_EBUS_DRIVE_UNIT')?.manufacturerGroups.flatMap((g) => g.items) ?? []
    expect(probe.map((item) => item.catalogNumber)).toContain('PB2020-M2')
    expect(drive.map((item) => item.catalogNumber)).toContain('SP-900')
  })

  it('keeps the ELUXEO light source and video processor in one product line', () => {
    const eluxeo = searchProductFamiliesForRole({ roleCode: 'VIDEO_PROCESSOR' }).find(
      (family) => family.familyName === 'ELUXEO 7000',
    )
    expect(eluxeo?.variants.map((variant) => variant.catalogNumber).sort()).toEqual([
      'BL-7000',
      'VP-7000',
    ])
  })

  it('excludes models the manufacturer catalog shows but the FDA UDI database does not', () => {
    // EB-530XT and the FB-120 fiberoptic bronchoscopes are in the pulmonology catalog but
    // have no UDI record, so the in-commercial-distribution rule keeps them out.
    const detail = getUseDetail('FLEX_SCOPE_THERAPEUTIC')
    const numbers = (detail?.manufacturerGroups ?? [])
      .flatMap((group) => group.items)
      .map((item) => item.catalogNumber)
    expect(numbers).not.toContain('EB-530XT')
    expect(numbers).not.toContain('FB-120T')
  })
})
