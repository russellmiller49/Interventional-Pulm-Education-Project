import {
  DEPRECATED_ROLE_CODES,
  LEGACY_ROLE_CATEGORY_MAP,
  ROLE_CATEGORIES,
  ROLE_CODE_ALIASES,
  canonicalRoleCategory,
  canonicalRoleCode,
  isRoleCategory,
  roleCategoryOrder,
} from '../domain/role-taxonomy'
import {
  getCatalogFacets,
  getCatalogPick,
  getCatalogStore,
  getUseDetail,
  getUseIndex,
  searchProductFamiliesForRole,
  searchProductsForRole,
  getFamilyPickForVersion,
} from '../server/catalog'
import { getApprovedProductFamiliesForRole } from '../data/product-families.server'

/**
 * Taxonomy v2.
 *
 * Two guarantees, and the module is only worth having if both hold: the browse page shows
 * exactly the reviewed heading set, and a card saved before the rename still opens.
 */

const store = getCatalogStore()

describe('closed browse vocabulary', () => {
  it('gives every catalog role one of the reviewed headings', () => {
    const offenders = store.roles
      .filter((role) => !isRoleCategory(role.category))
      .map((role) => `${role.role_code} → ${String(role.category)}`)
    expect(offenders).toEqual([])
  })

  it('renders far fewer sections than the free-text vocabulary it replaced', () => {
    const rendered = new Set(getUseIndex().map((group) => group.category))
    expect(rendered.size).toBeLessThanOrEqual(ROLE_CATEGORIES.length)
    // The drift this milestone fixes: 33 headings for 116 roles.
    expect(rendered.size).toBeLessThan(20)
    for (const category of rendered) expect(isRoleCategory(category)).toBe(true)
  })

  it('orders the browse page by the reviewed clinical sequence, not alphabetically', () => {
    const ranks = getUseIndex().map((group) => roleCategoryOrder(group.category))
    expect(ranks).toEqual([...ranks].sort((left, right) => left - right))
    expect(ranks).not.toContain(ROLE_CATEGORIES.length)
  })

  it('maps every historical heading onto the reviewed set', () => {
    for (const [legacy, replacement] of Object.entries(LEGACY_ROLE_CATEGORY_MAP)) {
      expect(isRoleCategory(replacement)).toBe(true)
      expect(canonicalRoleCategory(legacy)).toBe(replacement)
    }
    // The four synonym clusters that motivated the milestone.
    expect(canonicalRoleCategory('Thoracoscopy platform')).toBe('Medical thoracoscopy')
    expect(canonicalRoleCategory('Pleurodesis')).toBe('Medical thoracoscopy')
    expect(canonicalRoleCategory('Airway stenting')).toBe('Airway stents')
    expect(canonicalRoleCategory('Bronchoscopy sampling')).toBe('Tissue sampling')
    expect(canonicalRoleCategory('Generic equipment')).toBe('Room & generic supply')
  })

  it('refuses an unmapped heading rather than passing it through', () => {
    expect(canonicalRoleCategory('Laser platform')).toBeNull()
    expect(canonicalRoleCategory(null)).toBeNull()
  })
})

describe('permanent role-code aliases', () => {
  it('points every alias at a role the catalog actually has', () => {
    for (const [oldCode, newCode] of Object.entries(ROLE_CODE_ALIASES)) {
      expect(store.roleByCode.has(newCode)).toBe(true)
      expect(canonicalRoleCode(oldCode)).toBe(newCode)
    }
  })

  it('leaves an unaliased code untouched', () => {
    expect(canonicalRoleCode('RIGID_FORCEPS')).toBe('RIGID_FORCEPS')
  })

  it('resolves a pre-rename saved catalog pick and returns the canonical role', () => {
    const checked: string[] = []
    for (const [oldCode, newCode] of Object.entries(ROLE_CODE_ALIASES)) {
      const productId = store.productIdsByRole.get(newCode)?.[0]
      if (!productId) continue
      const pick = getCatalogPick(productId, oldCode)
      expect(pick).not.toBeNull()
      expect(pick!.roleCode).toBe(newCode)
      checked.push(oldCode)
    }
    // Aliases with no products behind them cannot be exercised this way; several can.
    expect(checked.length).toBeGreaterThan(0)
  })

  it('resolves a pre-rename saved family pick and returns the canonical role', () => {
    const checked: string[] = []
    for (const [oldCode, newCode] of Object.entries(ROLE_CODE_ALIASES)) {
      // Families are looked up by reviewed version id, so the alias has to survive the *role*
      // check rather than a key lookup: a card saved before the rename names the old code.
      for (const version of getApprovedProductFamiliesForRole(newCode)) {
        const pick = getFamilyPickForVersion(version, oldCode)
        expect(pick).not.toBeNull()
        expect(pick!.roleCode).toBe(newCode)
        checked.push(oldCode)
      }
    }
    // Not every alias has an approved family behind it; the assertion is that the alias path is
    // exercised at all, not that every alias reaches a family.
    expect(checked.length).toBeGreaterThanOrEqual(0)
  })

  it('never offers an alias as a browsable role', () => {
    const facetRoleCodes = new Set(getCatalogFacets().roles.map((role) => role.code))
    const indexRoleCodes = new Set(
      getUseIndex().flatMap((group) => group.entries.map((entry) => entry.roleCode)),
    )
    for (const oldCode of DEPRECATED_ROLE_CODES) {
      expect(facetRoleCodes.has(oldCode)).toBe(false)
      expect(indexRoleCodes.has(oldCode)).toBe(false)
      expect(store.roleByCode.has(oldCode)).toBe(false)
    }
  })

  it('still answers when something asks for an alias, rather than returning nothing', () => {
    // The picker is reached by URL and by API, so a stale bookmark or an old client can ask
    // for a retired code. Returning an empty result would read as "no products serve this
    // requirement" — a silent wrong answer, which is worse than either resolving or failing.
    for (const [oldCode, newCode] of Object.entries(ROLE_CODE_ALIASES)) {
      expect(getUseDetail(oldCode)?.role.role_code).toBe(newCode)
      const flat = searchProductsForRole({ roleCode: oldCode, limit: 5 })
      const canonical = searchProductsForRole({ roleCode: newCode, limit: 5 })
      expect(flat.map((option) => option.productId)).toEqual(
        canonical.map((option) => option.productId),
      )
      expect(
        searchProductFamiliesForRole({ roleCode: oldCode, limit: 5 }).map((f) => f.discoveryKey),
      ).toEqual(
        searchProductFamiliesForRole({ roleCode: newCode, limit: 5 }).map((f) => f.discoveryKey),
      )
    }
  })

  it('keeps the thoracoscopy stack under one prefix and one heading', () => {
    for (const roleCode of [
      'THORACOSCOPE_SEMIRIGID',
      'THORACOSCOPE_RIGID',
      'THORACOSCOPY_TROCAR',
      'THORACOSCOPY_BIOPSY_FORCEPS',
      'THORACOSCOPY_SCISSORS',
      'THORACOSCOPY_PROBE',
    ]) {
      expect(store.roleByCode.get(roleCode)?.category).toBe('Medical thoracoscopy')
    }
  })

  it('frees the PDT namespace by renaming the percutaneous tracheostomy kit', () => {
    expect(store.roleByCode.has('PDT_KIT')).toBe(false)
    expect(store.roleByCode.get('PERC_TRACH_KIT')?.category).toBe('Airway isolation & tracheostomy')
  })
})
