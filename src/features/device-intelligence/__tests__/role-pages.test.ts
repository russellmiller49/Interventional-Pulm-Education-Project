import {
  ROLE_CODE_ALIASES,
  canonicalRoleCode,
  isDeprecatedRoleCode,
} from '@/features/preference-cards/domain/role-taxonomy'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'
import { getAtlasUseDetail } from '@/features/device-intelligence/server/atlas.server'
import { getRoleSlotUsage } from '@/features/device-intelligence/server/procedures.server'

describe('D1 clinical-role pages', () => {
  it('canonicalizes every permanent role alias to a role the atlas can serve', () => {
    for (const [legacy, canonical] of Object.entries(ROLE_CODE_ALIASES)) {
      expect(isDeprecatedRoleCode(legacy)).toBe(true)
      expect(canonicalRoleCode(legacy)).toBe(canonical)
      // The page redirects a deprecated code to the canonical URL; the canonical code must
      // then resolve. (A canonical role may legitimately hold zero atlas-cohort products —
      // the page renders the honest empty state — but the role itself must exist.)
      const use = getAtlasUseDetail(canonical)
      expect({ legacy, canonical, resolves: use !== null }).toEqual({
        legacy,
        canonical,
        resolves: true,
      })
      expect(use!.detail.role.role_code).toBe(canonical)
    }
  })

  it('resolves a legacy code through the same canonicalization the page redirect uses', () => {
    const viaAlias = getAtlasUseDetail('PLEUROSCOPE')
    const direct = getAtlasUseDetail('THORACOSCOPE_SEMIRIGID')
    expect(viaAlias).not.toBeNull()
    expect(viaAlias!.detail.role.role_code).toBe(direct!.detail.role.role_code)
  })

  it('returns null for an unknown role so the route can 404 safely', () => {
    expect(getAtlasUseDetail('NOT_A_ROLE')).toBeNull()
    expect(getRoleSlotUsage('NOT_A_ROLE')).toEqual([])
  })

  it('reports authored-option status per procedure slot without inventing selectability', () => {
    const usage = getRoleSlotUsage('GENERIC_SUCTION')
    expect(usage.length).toBeGreaterThan(0)
    for (const slot of usage) {
      // GENERIC_SUCTION is proposals-only in every procedure (audit): proposals surface as
      // counts, never as authored options.
      expect(slot.optionStatus).toBe('proposals_only')
      expect(slot.proposalCount).toBeGreaterThan(0)
      expect(slot.procedureStatus).toMatch(/^Draft/)
    }
  })

  it('lists the linear EBUS scope role with its selectable authored status', () => {
    const usage = getRoleSlotUsage('EBUS_SCOPE')
    const ebusSlot = usage.find((slot) => slot.procedureCode === 'EBUS_TBNA')
    expect(ebusSlot).toBeDefined()
    expect(ebusSlot!.optionStatus).toBe('selectable_authored')
    expect(ebusSlot!.requiredness).toBe('required')
  })

  it('F-22: the availability fact derives correctly for the owner-named worst case', () => {
    // LASER_CONSOLE lists real, named, verified-source consoles; the hoisted availability
    // line must say plainly that none is selectable anywhere in this release.
    const usage = getRoleSlotUsage('LASER_CONSOLE')
    expect(usage.length).toBeGreaterThan(0)
    expect(usage.every((slot) => slot.optionStatus !== 'selectable_authored')).toBe(true)
    // And the positive branch: EBUS_SCOPE has at least one procedure with a selectable option.
    expect(
      getRoleSlotUsage('EBUS_SCOPE').some((slot) => slot.optionStatus === 'selectable_authored'),
    ).toBe(true)
  })

  it('F-24: the footer framing "as nearly every role in this atlas is" stays true', () => {
    // The role-page IFU statement was demoted from a per-role amber banner to ambient footer
    // copy BECAUSE the flag is near-universal; this pins that justification.
    const roles = [...getCatalogStore().roleByCode.values()]
    const flagged = roles.filter((role) => role.requires_current_ifu === true).length
    expect(roles.length).toBeGreaterThan(0)
    expect(flagged / roles.length).toBeGreaterThan(0.9)
  })
})
