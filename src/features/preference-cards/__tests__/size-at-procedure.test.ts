import {
  allowsSizeAtProcedure,
  familyKeyFromPickId,
  familyPickId,
  isFamilyPickId,
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

  it('keeps family pick ids distinct from product and set ids', () => {
    expect(familyPickId('MFR-A|dumon td|implant')).toBe('family:MFR-A|dumon td|implant')
    expect(familyPickId('MFR-A|dumon td|implant', 'AIRWAY_STENT_SILICONE_STRAIGHT')).toBe(
      'family-role:AIRWAY_STENT_SILICONE_STRAIGHT:MFR-A|dumon td|implant',
    )
    expect(isFamilyPickId('family:x')).toBe(true)
    expect(isFamilyPickId('family-role:ROLE_A:x')).toBe(true)
    expect(isFamilyPickId('catalog:PRD-X')).toBe(false)
    expect(isFamilyPickId('set:s1')).toBe(false)
    expect(familyKeyFromPickId('family:x')).toBe('x')
    expect(familyKeyFromPickId('family-role:ROLE_A:x')).toBe('x')
    expect(familyKeyFromPickId('catalog:PRD-X')).toBeNull()
  })
})
