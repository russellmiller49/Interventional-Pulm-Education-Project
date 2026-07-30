import { getUseDetail, searchProductFamiliesForRole } from '../server/catalog'

/**
 * Robotic bronchoscopy equipment. Everything here is confirmed from the FDA UDI database
 * alone — no manufacturer brochure was supplied for Monarch or Galaxy — so these tests pin
 * both the reviewed product semantics and the limited specifications that may be claimed.
 */

function roleItems(roleCode: string) {
  return (getUseDetail(roleCode)?.manufacturerGroups ?? []).flatMap((group) =>
    group.items.map((item) => ({ ...item, manufacturer: group.manufacturerDisplay })),
  )
}

function platformItems() {
  return roleItems('ROBOTIC_BRONCH_PLATFORM')
}

const semanticRoles = [
  'ROBOTIC_BRONCH_PLATFORM',
  'ROBOTIC_BRONCHOSCOPE',
  'ROBOTIC_PROCEDURE_KIT',
  'ROBOTIC_BIOPSY_NEEDLE',
  'NAV_ACCESSORY_SENSOR',
  'NAV_PLATFORM_ACCESSORY',
  'BIOPSY_FORCEPS_FLEX',
  'CYTOLOGY_BRUSH',
] as const

function rolesForCatalogNumber(catalogNumber: string) {
  return semanticRoles.filter((roleCode) =>
    roleItems(roleCode).some((item) => item.catalogNumber === catalogNumber),
  )
}

describe('robotic bronchoscopy platforms', () => {
  it('lists Monarch, Galaxy and Ion together under the capital-platform role', () => {
    // A physician comparing robotic platforms should see all three in one place.
    const items = platformItems()
    const names = items.map((item) => item.productName)
    expect(names).toEqual(
      expect.arrayContaining([
        'Monarch Platform, Bronchoscopy 4.1',
        'Galaxy System',
        'Ion Endoluminal System',
      ]),
    )
  })

  it('gives every Monarch and Galaxy line a self-describing name', () => {
    // familyKey splits on product_kind, so a bare "Monarch" would render as several
    // identical-looking rows in the explorer.
    const families = searchProductFamiliesForRole({
      roleCode: 'ROBOTIC_BRONCH_PLATFORM',
      limit: 40,
    }).filter(
      (family) =>
        family.manufacturerDisplay.startsWith('Auris Health') ||
        family.manufacturerDisplay === 'Noah Medical',
    )
    expect(families.length).toBeGreaterThan(0)
    const names = families.map((family) => family.familyName)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name).toMatch(/^(Monarch|Galaxy) /)
  })

  it('claims no dimensions for devices with no manufacturer catalog', () => {
    for (const item of platformItems()) {
      if (!/^(Monarch|Galaxy)/.test(item.productName)) continue
      // Identity and distribution status only — nothing measured.
      expect(item.sizeDisplay).toBeNull()
      expect(item.minWorkingChannelMm).toBeNull()
      expect(item.deliverySystemOdMm).toBeNull()
    }
  })

  it('excludes Auris ureteroscopy, software releases, and refurbished configurations', () => {
    const numbers = platformItems().map((item) => item.catalogNumber ?? '')
    // MUR-* is ureteroscopy — a different specialty on the same GUDID labeler.
    expect(numbers.some((value) => value.startsWith('MUR-'))).toBe(false)
    // "Version 2.1.2" and friends are tower software releases, not devices.
    expect(numbers.some((value) => /^Version/i.test(value))).toBe(false)
    // Refurbished and regional variants are procurement options, not card lines.
    expect(numbers.some((value) => /-RFB$|^MON000005R$|^GALRB/.test(value))).toBe(false)
  })

  it('keeps platforms, bronchoscopes, procedure kits, sensors, and tools in exact roles', () => {
    const expected = [
      ['MON-000008', 'ROBOTIC_BRONCH_PLATFORM'],
      ['MON-000007', 'NAV_PLATFORM_ACCESSORY'],
      ['MBR-000011', 'ROBOTIC_BRONCHOSCOPE'],
      ['MBR-000012', 'ROBOTIC_BIOPSY_NEEDLE'],
      ['MBR-000014', 'BIOPSY_FORCEPS_FLEX'],
      ['MBR-000015', 'CYTOLOGY_BRUSH'],
      ['MBR-000016', 'NAV_ACCESSORY_SENSOR'],
      ['MBR-000017', 'ROBOTIC_PROCEDURE_KIT'],
    ] as const

    for (const [catalogNumber, roleCode] of expected) {
      expect(rolesForCatalogNumber(catalogNumber)).toEqual([roleCode])
    }

    expect(roleItems('GUIDING_DEVICE')).toEqual([])
    expect(roleItems('TBNA_NEEDLE')).toEqual([])
  })
})
