import {
  allowsSizeAtProcedure,
  familyKeyFromPickId,
  familyPickId,
  isFamilyPickId,
  isLegacyFamilyPickId,
  isUnqualifiedLegacyFamilyPickId,
  productFamilyVersionIdFromPickId,
} from '../domain/size-at-procedure'
import rolesJson from '../../../../data/ip-preference-cards/generated/roles.json'

describe('size chosen at time of procedure', () => {
  it('allows a stent family without a committed size', () => {
    // Stent diameter and length are chosen once the stenosis is measured.
    expect(allowsSizeAtProcedure('AIRWAY_STENT_SILICONE_STRAIGHT')).toBe(true)
    expect(allowsSizeAtProcedure('AIRWAY_STENT_SEMS_COVERED')).toBe(true)
    expect(allowsSizeAtProcedure('AIRWAY_STENT_SILICONE_Y')).toBe(true)
    expect(allowsSizeAtProcedure('AIRWAY_STENT_PATIENT_SPECIFIC')).toBe(true)
  })

  it('requires a specific product everywhere else', () => {
    for (const role of ['CHEST_TUBE_SURGICAL', 'FLEX_SCOPE_DIAGNOSTIC', 'EBUS_NEEDLE_FNA']) {
      expect(allowsSizeAtProcedure(role)).toBe(false)
    }
  })

  it('requires a size for the stent sizing device itself', () => {
    // The sizing device is an instrument, not something sized to the lesion.
    expect(allowsSizeAtProcedure('AIRWAY_STENT_SIZING_DEVICE')).toBe(false)
  })

  it('only matches roles that exist in the catalog', () => {
    const stentRoles = (rolesJson as { role_code: string }[])
      .map((role) => role.role_code)
      .filter(allowsSizeAtProcedure)
    expect(stentRoles.length).toBeGreaterThan(0)
    expect(stentRoles).not.toContain('AIRWAY_STENT_SIZING_DEVICE')
    expect(stentRoles).not.toContain('STENT_APPLICATOR')
  })

  it('addresses a family pick by reviewed family version, distinct from product and set ids', () => {
    expect(familyPickId('family-novatech-dumon-td-v1-0')).toBe(
      'family-version:family-novatech-dumon-td-v1-0',
    )
    expect(familyPickId('family-novatech-dumon-td-v1-0', 'AIRWAY_STENT_SILICONE_STRAIGHT')).toBe(
      'family-version-role:AIRWAY_STENT_SILICONE_STRAIGHT:family-novatech-dumon-td-v1-0',
    )
    expect(isFamilyPickId('family-version:x')).toBe(true)
    expect(isFamilyPickId('family-version-role:ROLE_A:x')).toBe(true)
    expect(isFamilyPickId('catalog:PRD-X')).toBe(false)
    expect(isFamilyPickId('set:s1')).toBe(false)
    expect(productFamilyVersionIdFromPickId('family-version:x')).toBe('x')
    expect(productFamilyVersionIdFromPickId('family-version-role:ROLE_A:x')).toBe('x')
    expect(productFamilyVersionIdFromPickId('family:x')).toBeNull()
  })

  /**
   * The two discovery-keyed forms are still parseable and are never produced again.
   *
   * A stored snapshot written at builder-inputs version 2 or 3 carries one, and it still has to
   * render. What it cannot do is become a reviewed family: the key is a grouping recomputed from
   * mutable labels, so reading it back as a membership would be a guess about which products a
   * physician asked the room for.
   */
  it('still recognizes the discovery-keyed forms without turning one back into a family', () => {
    expect(isFamilyPickId('family:MFR-A|dumon td|implant')).toBe(true)
    expect(isFamilyPickId('family-role:ROLE_A:MFR-A|dumon td|implant')).toBe(true)
    expect(isLegacyFamilyPickId('family:x')).toBe(true)
    expect(isLegacyFamilyPickId('family-role:ROLE_A:x')).toBe(true)
    expect(isLegacyFamilyPickId('family-version:x')).toBe(false)
    // Only the unqualified form widens a selection match, because it predates role scoping.
    expect(isUnqualifiedLegacyFamilyPickId('family:x')).toBe(true)
    expect(isUnqualifiedLegacyFamilyPickId('family-role:ROLE_A:x')).toBe(false)
    expect(familyKeyFromPickId('family:x')).toBe('x')
    expect(familyKeyFromPickId('family-role:ROLE_A:x')).toBe('x')
    expect(familyKeyFromPickId('catalog:PRD-X')).toBeNull()
    // And a discovery key never yields a family version id.
    expect(productFamilyVersionIdFromPickId('family-role:ROLE_A:x')).toBeNull()
  })
})
