import {
  ROLE_CATEGORY_OVERRIDES,
  ROLE_CODE_ALIASES,
  canonicalRoleCategory,
  canonicalRoleCode,
} from '@/features/preference-cards/domain/role-taxonomy'

import type { CatalogRecord } from './catalog-utils'

/**
 * Taxonomy v2: canonicalize role codes and browse headings across the whole import.
 *
 * The reviewed vocabulary lives in `domain/role-taxonomy.ts` so the browse page, the
 * validators, and this applicator all read the same decision. This step rewrites the
 * generated relational data to match it, and fails the import on anything the vocabulary does
 * not cover — a free-text heading can never reappear by accident.
 *
 * Deliberately *not* rewritten: `Hospital_Formulary` and `Product_Verification_Backlog`. Both
 * are byte-protected staging evidence that mirrors the source workbook rather than live
 * catalog data, and neither is read by the catalog store. Renaming a role inside them would
 * rewrite the evidence a later reviewer checks the migration against.
 */

/** Every sheet and column that carries a role code in live catalog data. */
const ROLE_CODE_COLUMNS: { sheet: string; columns: string[] }[] = [
  { sheet: 'Roles', columns: ['role_code'] },
  { sheet: 'Product_Roles', columns: ['role_code'] },
  { sheet: 'Procedure_Slots', columns: ['role_code'] },
  { sheet: 'Slot_Product_Options', columns: ['role_code'] },
  {
    sheet: 'Compatibility',
    columns: [
      'source_product_or_role',
      'target_product_or_role',
      'resolved_source_id',
      'resolved_target_id',
    ],
  },
]

export interface RoleTaxonomyReport {
  applied: boolean
  role_codes_renamed: number
  role_code_references_rewritten: number
  categories_rewritten: number
  details: {
    renamed_roles: string[]
    rewritten_categories: string[]
  }
  errors: string[]
}

function emptyReport(): RoleTaxonomyReport {
  return {
    applied: false,
    role_codes_renamed: 0,
    role_code_references_rewritten: 0,
    categories_rewritten: 0,
    details: { renamed_roles: [], rewritten_categories: [] },
    errors: [],
  }
}

export function applyRoleTaxonomy(normalized: Record<string, CatalogRecord[]>): RoleTaxonomyReport {
  const report = emptyReport()
  const errors = report.errors

  const roles = normalized.Roles ?? []
  const existingRoleCodes = new Set<string>()
  for (const role of roles) {
    if (typeof role.role_code === 'string') existingRoleCodes.add(role.role_code)
  }

  // A rename that lands on a code the catalog already uses would silently merge two roles.
  for (const [oldCode, newCode] of Object.entries(ROLE_CODE_ALIASES)) {
    if (!existingRoleCodes.has(oldCode)) continue
    if (existingRoleCodes.has(newCode)) {
      errors.push(
        `Role rename ${oldCode} → ${newCode} would collide with an existing role; two distinct roles cannot merge silently.`,
      )
    }
    report.details.renamed_roles.push(`${oldCode} → ${newCode}`)
  }
  report.role_codes_renamed = report.details.renamed_roles.length

  // Headings first, while the sheet still carries its historical values.
  for (const role of roles) {
    const roleCode = typeof role.role_code === 'string' ? role.role_code : '(unnamed role)'
    const current = typeof role.category === 'string' ? role.category : null
    const canonical = canonicalRoleCategory(current)
    if (!canonical) {
      errors.push(
        `Role ${roleCode} carries category ${current === null ? '(empty)' : `"${current}"`}, which is outside the closed role-category vocabulary. Add it to LEGACY_ROLE_CATEGORY_MAP or fix the source.`,
      )
      continue
    }
    const renamedCode = canonicalRoleCode(roleCode)
    const target = ROLE_CATEGORY_OVERRIDES[renamedCode] ?? canonical
    if (current !== target) {
      report.details.rewritten_categories.push(`${roleCode}: ${String(current)} → ${target}`)
      role.category = target
    }
  }
  report.categories_rewritten = report.details.rewritten_categories.length

  if (errors.length > 0) return report

  let rewritten = 0
  for (const { sheet, columns } of ROLE_CODE_COLUMNS) {
    for (const record of normalized[sheet] ?? []) {
      for (const column of columns) {
        const value = record[column]
        if (typeof value !== 'string') continue
        const canonical = canonicalRoleCode(value)
        if (canonical === value) continue
        record[column] = canonical
        rewritten += 1
      }
    }
  }
  report.role_code_references_rewritten = rewritten
  report.applied = true
  return report
}

/**
 * Final guard, run after every overlay has had its turn. Overlays add roles of their own
 * (the reviewed remediation `rolesToAdd`, the procedure additions), and those never pass
 * through the canonicalization above — so the closed vocabulary is asserted once at the end,
 * over whatever the pipeline actually produced.
 */
export function assertCanonicalRoleTaxonomy(normalized: Record<string, CatalogRecord[]>): string[] {
  const errors: string[] = []
  const deprecated = new Set(Object.keys(ROLE_CODE_ALIASES))

  for (const role of normalized.Roles ?? []) {
    const roleCode = typeof role.role_code === 'string' ? role.role_code : '(unnamed role)'
    if (deprecated.has(roleCode)) {
      errors.push(`Role ${roleCode} is a deprecated alias and must not exist as a role row.`)
    }
    const category = typeof role.category === 'string' ? role.category : null
    if (category === null || canonicalRoleCategory(category) !== category) {
      errors.push(
        `Role ${roleCode} carries category ${category === null ? '(empty)' : `"${category}"`}, which is not one of the reviewed browse headings.`,
      )
    }
  }

  for (const { sheet, columns } of ROLE_CODE_COLUMNS) {
    if (sheet === 'Roles') continue
    for (const record of normalized[sheet] ?? []) {
      for (const column of columns) {
        const value = record[column]
        if (typeof value === 'string' && deprecated.has(value)) {
          errors.push(`${sheet}.${column} still references the deprecated role code ${value}.`)
        }
      }
    }
  }

  return [...new Set(errors)]
}
