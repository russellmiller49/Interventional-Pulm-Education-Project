import { getUseDetail, searchProductFamiliesForRole } from '../server/catalog'

/**
 * Robotic bronchoscopy platforms. Everything here is confirmed from the FDA UDI database
 * alone — no manufacturer brochure was supplied for Monarch or Galaxy — so these tests pin
 * what may be claimed as much as what is present.
 */

function guidingDeviceItems() {
  return (getUseDetail('GUIDING_DEVICE')?.manufacturerGroups ?? []).flatMap((group) =>
    group.items.map((item) => ({ ...item, manufacturer: group.manufacturerDisplay })),
  )
}

describe('robotic bronchoscopy platforms', () => {
  it('lists Monarch, Galaxy and Ion together under one role', () => {
    // A physician comparing robotic platforms should see all three in one place.
    const items = guidingDeviceItems()
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
    const families = searchProductFamiliesForRole({ roleCode: 'GUIDING_DEVICE', limit: 40 }).filter(
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
    for (const item of guidingDeviceItems()) {
      if (!/^(Monarch|Galaxy)/.test(item.productName)) continue
      // Identity and distribution status only — nothing measured.
      expect(item.sizeDisplay).toBeNull()
      expect(item.minWorkingChannelMm).toBeNull()
      expect(item.deliverySystemOdMm).toBeNull()
    }
  })

  it('excludes Auris ureteroscopy, software releases, and refurbished configurations', () => {
    const numbers = guidingDeviceItems().map((item) => item.catalogNumber ?? '')
    // MUR-* is ureteroscopy — a different specialty on the same GUDID labeler.
    expect(numbers.some((value) => value.startsWith('MUR-'))).toBe(false)
    // "Version 2.1.2" and friends are tower software releases, not devices.
    expect(numbers.some((value) => /^Version/i.test(value))).toBe(false)
    // Refurbished and regional variants are procurement options, not card lines.
    expect(numbers.some((value) => /-RFB$|^MON000005R$|^GALRB/.test(value))).toBe(false)
  })

  it('routes Monarch sampling tools to their own roles, not the platform role', () => {
    const roleOf = (catalogNumber: string) =>
      ['TBNA_NEEDLE', 'BIOPSY_FORCEPS_FLEX', 'CYTOLOGY_BRUSH', 'GUIDING_DEVICE'].find((role) =>
        (getUseDetail(role)?.manufacturerGroups ?? [])
          .flatMap((group) => group.items)
          .some((item) => item.catalogNumber === catalogNumber),
      )
    expect(roleOf('MBR-000012')).toBe('TBNA_NEEDLE')
    expect(roleOf('MBR-000014')).toBe('BIOPSY_FORCEPS_FLEX')
    expect(roleOf('MBR-000015')).toBe('CYTOLOGY_BRUSH')
    expect(roleOf('MBR-000011')).toBe('GUIDING_DEVICE')
  })
})
