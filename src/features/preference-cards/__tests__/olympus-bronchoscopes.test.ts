import {
  getProductDetail,
  getUseDetail,
  searchProductFamiliesForRole,
  searchProductsForRole,
} from '../server/catalog'

/**
 * Olympus bronchoscopes.
 *
 * Installed-base lifecycle is intentionally independent of GUDID distribution evidence. A
 * preference card records what is in the room, not merely what is newly orderable, and strong
 * package rows can disagree. Olympus also files these under opaque SKUs, so the join to GUDID
 * runs on the version/model string; if that breaks, the product-level signal disappears.
 */

const installedBase180Scopes = [
  {
    productId: 'PRD-88E003F12B',
    role: 'FLEX_SCOPE_THERAPEUTIC',
    catalogNumber: 'BF-1T180',
    distributionStatus: 'not_in_distribution',
  },
  {
    productId: 'PRD-815B93A920',
    role: 'FLEX_SCOPE_THERAPEUTIC',
    catalogNumber: 'BF-1TQ180',
    distributionStatus: 'conflicting',
  },
  {
    productId: 'PRD-57DAB5ECAE',
    role: 'FLEX_SCOPE_DIAGNOSTIC',
    catalogNumber: 'BF-P180',
    distributionStatus: 'not_in_distribution',
  },
  {
    productId: 'PRD-7240BD99DA',
    role: 'FLEX_SCOPE_DIAGNOSTIC',
    catalogNumber: 'BF-Q180',
    distributionStatus: 'conflicting',
  },
  {
    productId: 'PRD-FB075DFB2D',
    role: 'FLEX_SCOPE_DIAGNOSTIC',
    catalogNumber: 'BF-Q180-AC',
    distributionStatus: 'not_in_distribution',
  },
  {
    productId: 'PRD-F586C51621',
    role: 'EBUS_SCOPE',
    catalogNumber: 'BF-UC180F',
    distributionStatus: 'conflicting',
  },
] as const

function olympusItems(role: string) {
  return (getUseDetail(role)?.manufacturerGroups ?? [])
    .filter((group) => group.manufacturerDisplay === 'Olympus')
    .flatMap((group) => group.items)
}

function byNumber(role: string, catalogNumber: string) {
  return olympusItems(role).find((item) => item.catalogNumber === catalogNumber)
}

describe('Olympus bronchoscopes', () => {
  it('carries the scopes a bronchoscopy suite actually stocks', () => {
    const diagnostic = olympusItems('FLEX_SCOPE_DIAGNOSTIC').map((item) => item.catalogNumber)
    const therapeutic = olympusItems('FLEX_SCOPE_THERAPEUTIC').map((item) => item.catalogNumber)
    expect(diagnostic).toEqual(
      expect.arrayContaining(['BF-H1100', 'BF-H190', 'BF-Q190', 'BF-P190', 'BF-XP190', 'BF-Q180']),
    )
    expect(therapeutic).toEqual(
      expect.arrayContaining(['BF-1TH1100', 'BF-1TH190', 'BF-XT190', 'BF-1TQ180']),
    )
    expect(olympusItems('EBUS_SCOPE').map((item) => item.catalogNumber)).toEqual(
      expect.arrayContaining(['BF-UC190F', 'BF-UC180F']),
    )
  })

  it('preserves unambiguous not-in-distribution evidence at product level', () => {
    for (const [role, number] of [
      ['FLEX_SCOPE_DIAGNOSTIC', 'BF-P180'],
      ['FLEX_SCOPE_DIAGNOSTIC', 'BF-Q180-AC'],
      ['FLEX_SCOPE_DIAGNOSTIC', 'BF-PE2'],
      ['FLEX_SCOPE_THERAPEUTIC', 'BF-1T180'],
      ['FLEX_SCOPE_THERAPEUTIC', 'BF-XT160'],
    ] as const) {
      const item = byNumber(role, number)
      expect(item).toBeDefined()
      expect({ number, status: item!.distributionStatus }).toEqual({
        number,
        status: 'not_in_distribution',
      })
    }
  })

  it('keeps conflicting strong package rows unresolved', () => {
    for (const { role, catalogNumber } of installedBase180Scopes.filter(
      (scope) => scope.distributionStatus === 'conflicting',
    )) {
      expect(byNumber(role, catalogNumber)?.distributionStatus).toBe('conflicting')
    }
  })

  it('keeps all six reviewed 180-series scopes searchable in their role as installed base', () => {
    for (const scope of installedBase180Scopes) {
      const item = byNumber(scope.role, scope.catalogNumber)
      expect(item).toMatchObject({
        productId: scope.productId,
        distributionStatus: scope.distributionStatus,
        catalogLifecycleContext: 'legacy_active_installed_base',
        slottingScope: 'installed_base',
        preferredNewPurchase: false,
      })

      const roleResult = searchProductsForRole({
        roleCode: scope.role,
        q: scope.catalogNumber,
      }).find((candidate) => candidate.productId === scope.productId)
      expect(roleResult).toMatchObject({
        catalogLifecycleContext: 'legacy_active_installed_base',
        slottingScope: 'installed_base',
        preferredNewPurchase: false,
      })

      expect(getProductDetail(scope.productId)?.product).toMatchObject({
        catalogLifecycleContext: 'legacy_active_installed_base',
        slottingScope: 'installed_base',
        preferredNewPurchase: false,
      })
    }
  })

  it('does not badge scopes that are still in distribution', () => {
    for (const [role, number] of [
      ['FLEX_SCOPE_DIAGNOSTIC', 'BF-Q180'],
      ['FLEX_SCOPE_DIAGNOSTIC', 'BF-Q190'],
      ['FLEX_SCOPE_THERAPEUTIC', 'BF-1TQ180'],
    ] as const) {
      expect(byNumber(role, number)?.distributionStatus).not.toBe('not_in_distribution')
    }
  })

  it('gives the two workbook scopes the dimensions a card needs', () => {
    // Both arrived filed under a bare "Bronchoscopy platform" with no dimensions at all.
    expect(byNumber('FLEX_SCOPE_DIAGNOSTIC', 'BF-H190')).toMatchObject({
      diameterMm: 5.5,
      minWorkingChannelMm: 2,
    })
    expect(byNumber('FLEX_SCOPE_THERAPEUTIC', 'BF-1TH190')).toMatchObject({
      diameterMm: 6.2,
      minWorkingChannelMm: 2.8,
    })
  })

  it('groups each EVIS generation into one product line', () => {
    // familyKey splits on product_kind, so a scope filed as "Reusable instrument" among
    // "Reusable endoscope" siblings would break its series into two identical-looking rows.
    for (const role of ['FLEX_SCOPE_DIAGNOSTIC', 'FLEX_SCOPE_THERAPEUTIC'] as const) {
      const names = searchProductFamiliesForRole({ roleCode: role, limit: 40 })
        .filter((family) => family.manufacturerDisplay === 'Olympus')
        .map((family) => family.familyName)
      expect(new Set(names).size).toBe(names.length)
    }
    const exeraIii = searchProductFamiliesForRole({
      roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
      limit: 40,
    }).find(
      (family) =>
        family.manufacturerDisplay === 'Olympus' && family.familyName === 'EVIS EXERA III',
    )
    expect(exeraIii?.variants.map((variant) => variant.catalogNumber).sort()).toEqual([
      'BF-H190',
      'BF-MP190F',
      'BF-P190',
      'BF-Q190',
      'BF-XP190',
    ])
  })

  it('claims no dimensions for the scope with no manufacturer document', () => {
    // BF-PE2 has an FDA record but no published spec sheet was available.
    const pe2 = byNumber('FLEX_SCOPE_DIAGNOSTIC', 'BF-PE2')
    expect(pe2).toBeDefined()
    expect(pe2!.diameterMm).toBeNull()
    expect(pe2!.minWorkingChannelMm).toBeNull()
  })

  it('keeps channel sizes consistent with the Olympus compatibility chart', () => {
    // Every one of these was cross-checked against the published chart.
    const expected: Record<string, number> = {
      'BF-XP190': 1.2,
      'BF-MP190F': 1.7,
      'BF-P190': 2.0,
      'BF-Q190': 2.0,
      'BF-H190': 2.0,
      'BF-1TH190': 2.8,
      'BF-XT190': 3.2,
      'BF-H1100': 2.2,
      'BF-1TH1100': 3.0,
    }
    const all = [
      ...olympusItems('FLEX_SCOPE_DIAGNOSTIC'),
      ...olympusItems('FLEX_SCOPE_THERAPEUTIC'),
    ]
    for (const [number, channel] of Object.entries(expected)) {
      const item = all.find((candidate) => candidate.catalogNumber === number)
      expect({ number, channel: item?.minWorkingChannelMm }).toEqual({ number, channel })
    }
  })
})
