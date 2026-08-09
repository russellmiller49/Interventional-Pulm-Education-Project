import {
  ROLE_CODE_ALIASES,
  canonicalRoleCode,
  isDeprecatedRoleCode,
} from '@/features/preference-cards/domain/role-taxonomy'
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
})
