import 'server-only'

import compatibilityRawJson from '../../../../data/ip-preference-cards/generated/compatibility-raw.json'

import { typedCompatibilityRules } from '@/features/preference-cards/seed/operational'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'
import type { TypedCompatibilityRule } from '@/features/preference-cards/domain/types'

/**
 * Compatibility evidence for display. Two independent kinds, never merged:
 *
 * - **Typed rules** (`seed/operational.ts`, pinned by release bundles): rendered on atlas
 *   pages as *conditions* — operator, attributes, severity, message — never as evaluations,
 *   because no card is being resolved there. Evaluation stays in
 *   `domain/evaluate-compatibility.ts`, called only through the existing resolver.
 * - **Raw statements** (`compatibility-raw.json`, 187 rows): quoted verbatim with their
 *   per-row verification grade. Rows whose resolved ids are null are unresolved textual
 *   statements — the audit found they reference catalog numbers and marketing names — and
 *   are badged as such, never machine-matched.
 */

export interface RawCompatibilityStatement {
  ruleId: string
  sourceText: string
  targetText: string
  relationship: string | null
  ruleText: string | null
  verificationGrade: string | null
  verificationStatus: string | null
  sourceId: string | null
  resolvedSourceId: string | null
  resolvedTargetId: string | null
  /** True when neither side resolved to a catalog id — quoted, badged, never matched. */
  unresolved: boolean
}

interface RawRow {
  rule_id: string
  source_product_or_role: string | null
  relationship: string | null
  target_product_or_role: string | null
  rule_text: string | null
  verification_status: string | null
  source_id: string | null
  resolved_source_type: string | null
  resolved_source_id: string | null
  resolved_target_type: string | null
  resolved_target_id: string | null
  verification_grade: string | null
}

const rawRows = compatibilityRawJson as unknown as RawRow[]

function toStatement(row: RawRow): RawCompatibilityStatement {
  return {
    ruleId: row.rule_id,
    sourceText: row.source_product_or_role ?? '',
    targetText: row.target_product_or_role ?? '',
    relationship: row.relationship,
    ruleText: row.rule_text,
    verificationGrade: row.verification_grade,
    verificationStatus: row.verification_status,
    sourceId: row.source_id,
    resolvedSourceId: row.resolved_source_id,
    resolvedTargetId: row.resolved_target_id,
    unresolved: row.resolved_source_id === null && row.resolved_target_id === null,
  }
}

/** Raw statements whose resolved source or target is this product. */
export function getRawStatementsForProduct(productId: string): RawCompatibilityStatement[] {
  return rawRows
    .filter(
      (row) =>
        (row.resolved_source_type === 'product' && row.resolved_source_id === productId) ||
        (row.resolved_target_type === 'product' && row.resolved_target_id === productId),
    )
    .map(toStatement)
}

/**
 * Raw statements touching a role set, using the Phase D0 audit's own matching rule:
 * a resolved source/target id counts when it is one of the roles OR one of the products
 * mapped to those roles through the governed product–role table. Nothing is fuzzy-matched;
 * unresolved textual rows never match anything here.
 */
export function getRawStatementsForRoles(roleCodes: string[]): RawCompatibilityStatement[] {
  const roles = new Set(roleCodes)
  const store = getCatalogStore()
  const productIds = new Set<string>()
  for (const roleCode of roles) {
    for (const productId of store.productIdsByRole.get(roleCode) ?? []) {
      productIds.add(productId)
    }
  }
  const idMatches = (type: string | null, id: string | null) =>
    id !== null &&
    ((type === 'role' && roles.has(id)) || (type === 'product' && productIds.has(id)))
  return rawRows
    .filter(
      (row) =>
        idMatches(row.resolved_source_type, row.resolved_source_id) ||
        idMatches(row.resolved_target_type, row.resolved_target_id),
    )
    .map(toStatement)
}

export interface TypedRuleCondition {
  id: string
  sourceRoleCode: string
  targetRoleCode: string | null
  sourceAttribute: string
  targetAttribute: string | null
  operator: TypedCompatibilityRule['operator']
  unit: string | null
  severity: TypedCompatibilityRule['severity']
  message: string
  missingValueMessage: string
  modifierCodes: string[]
  evidenceSourceId: string | null
}

/**
 * The pinned typed rules touching a role set, as display conditions. The rule set comes from
 * the same seed constant the release bundles hash — there is exactly one rule list.
 */
export function getTypedRuleConditionsForRoles(roleCodes: string[]): TypedRuleCondition[] {
  const roles = new Set(roleCodes)
  return typedCompatibilityRules
    .filter(
      (rule) =>
        rule.active &&
        (roles.has(rule.sourceRoleCode) ||
          (rule.targetRoleCode !== null && roles.has(rule.targetRoleCode))),
    )
    .map((rule) => ({
      id: rule.id,
      sourceRoleCode: rule.sourceRoleCode,
      targetRoleCode: rule.targetRoleCode,
      sourceAttribute: rule.sourceAttribute,
      targetAttribute: rule.targetAttribute,
      operator: rule.operator,
      unit: rule.unit,
      severity: rule.severity,
      message: rule.message,
      missingValueMessage: rule.missingValueMessage,
      modifierCodes: [...rule.modifierCodes],
      evidenceSourceId: rule.evidenceSourceId,
    }))
}
