import 'server-only'

import compatibilityRawJson from '../../../../data/ip-preference-cards/generated/compatibility-raw.json'

import { typedCompatibilityRules } from '@/features/preference-cards/seed/operational'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'
import { normalizeIdentifier } from '@/features/preference-cards/server/catalog-store'
import type { TypedCompatibilityRule } from '@/features/preference-cards/domain/types'
import { getAtlasCatalogStore } from './atlas-store.server'

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
 *
 * Public-cohort safety (Codex C-03): before any raw statement text reaches a public atlas
 * surface, the row's texts are checked against the catalog's own EXACT normalized
 * identifiers (product id, catalog number, GTIN, part numbers, alternate ids — the same
 * `searchableIds` the search layer already uses; nothing fuzzy). A row that deterministically
 * references a product outside the D2B cohort is returned as a `WithheldCompatibilityStatement`
 * carrying only non-identifying provenance, and the page renders a generic locale-backed
 * explanation instead of the statement.
 */

export interface RawCompatibilityStatement {
  ruleId: string
  withheld: false
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

/**
 * A raw statement withheld from the public atlas because it references a product outside
 * the D2B cohort — candidate-grade, unknown-grade, or explicitly owner-excluded. D2B widens
 * the cohort, so a statement naming a formerly hidden verified-source product is now
 * displayable; the wall itself is unchanged and still fails closed on ambiguity.
 * Deliberately fail-closed in shape: no participant text, no resolved ids —
 * only provenance fields that cannot identify the hidden product.
 */
export interface WithheldCompatibilityStatement {
  ruleId: string
  withheld: true
  withheldReason: 'non_cohort_reference'
  verificationGrade: string | null
  verificationStatus: string | null
  sourceId: string | null
}

export type AtlasCompatibilityStatement = RawCompatibilityStatement | WithheldCompatibilityStatement

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
    withheld: false,
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

/**
 * Every EXACT normalized identifier in the full catalog, mapped to the product ids that
 * carry it: the permanent product id plus the same `searchableIds` set the search layer
 * derives (catalog number, GTINs, part numbers, alternate ids — `normalizeIdentifier`ed).
 * Built once; used only for deterministic exact lookups, never fuzzy matching.
 */
let cachedIdentifierIndex: Map<string, string[]> | null = null

function getIdentifierIndex(): Map<string, string[]> {
  if (!cachedIdentifierIndex) {
    const index = new Map<string, string[]>()
    for (const product of getCatalogStore().products) {
      const keys = new Set([normalizeIdentifier(product.product_id), ...product.searchableIds])
      for (const key of keys) {
        if (!key) continue
        const ids = index.get(key)
        if (ids) ids.push(product.product_id)
        else index.set(key, [product.product_id])
      }
    }
    cachedIdentifierIndex = index
  }
  return cachedIdentifierIndex
}

/**
 * Tokens shorter than this (after normalization) are not scanned inside free text: a
 * three-character identifier like catalog number "332" is indistinguishable from an ordinary
 * number in prose, so matching it would not be the deterministic recognition C-03 requires.
 * Whole-field participant checks below carry no such floor — there the field IS the
 * identifier.
 */
const FREE_TEXT_MIN_IDENTIFIER_LENGTH = 4

function nonCohortIdsFor(normalized: string): boolean {
  if (!normalized) return false
  const productIds = getIdentifierIndex().get(normalized)
  if (!productIds) return false
  const atlas = getAtlasCatalogStore()
  // Fail closed on ambiguity: an identifier shared with even one non-cohort product is
  // treated as a non-cohort reference.
  return productIds.some((id) => !atlas.productById.has(id))
}

/**
 * True when the text deterministically references a product outside the D2B cohort by one of
 * its exact identifiers — as the whole (normalized) string, or as any whitespace/punctuation
 * delimited token (hyphens kept, since identifiers carry them; normalization strips them on
 * both sides of the comparison). Exact lookups only; no similarity of any kind.
 */
export function textReferencesNonCohortIdentity(text: string | null): boolean {
  if (!text) return false
  if (nonCohortIdsFor(normalizeIdentifier(text))) return true
  for (const token of text.split(/[^A-Za-z0-9-]+/)) {
    const normalized = normalizeIdentifier(token)
    if (normalized.length < FREE_TEXT_MIN_IDENTIFIER_LENGTH) continue
    if (nonCohortIdsFor(normalized)) return true
  }
  return false
}

/**
 * The C-03 wall: a row is withheld from public atlas surfaces when a resolved participant is
 * a non-cohort product (the original guard), or when any of its texts — the unresolved or
 * textual participant fields and the quoted rule text — deterministically names a non-cohort
 * product by exact identifier. `selfId` is the cohort product whose page is asking, which is
 * never its own leak.
 */
function toPublicStatement(row: RawRow, selfId?: string): AtlasCompatibilityStatement {
  const atlas = getAtlasCatalogStore()
  const resolvedNonCohort = (type: string | null, id: string | null) =>
    type === 'product' && id !== null && id !== selfId && !atlas.productById.has(id)
  const textLeaks =
    textReferencesNonCohortIdentity(row.source_product_or_role) ||
    textReferencesNonCohortIdentity(row.target_product_or_role) ||
    textReferencesNonCohortIdentity(row.rule_text)
  if (
    resolvedNonCohort(row.resolved_source_type, row.resolved_source_id) ||
    resolvedNonCohort(row.resolved_target_type, row.resolved_target_id) ||
    textLeaks
  ) {
    return {
      ruleId: row.rule_id,
      withheld: true,
      withheldReason: 'non_cohort_reference',
      verificationGrade: row.verification_grade,
      verificationStatus: row.verification_status,
      sourceId: row.source_id,
    }
  }
  return toStatement(row)
}

/**
 * Raw statements whose resolved source or target is this product — for the ATLAS device page.
 * Every row passes the C-03 wall above: a row whose counterpart resolves outside the D2B
 * cohort, or whose texts exactly name a non-cohort product (e.g. a hidden scope's catalog
 * number quoted verbatim in an otherwise-resolved statement), is returned withheld rather
 * than printing a hidden/candidate product's identity on a public-cohort surface.
 */
export function getRawStatementsForProduct(productId: string): AtlasCompatibilityStatement[] {
  return rawRows
    .filter(
      (row) =>
        (row.resolved_source_type === 'product' && row.resolved_source_id === productId) ||
        (row.resolved_target_type === 'product' && row.resolved_target_id === productId),
    )
    .map((row) => toPublicStatement(row, productId))
}

/**
 * Raw statements touching a role set, using the Phase D0 audit's own matching rule:
 * a resolved source/target id counts when it is one of the roles OR one of the products
 * mapped to those roles through the governed product–role table. Nothing is fuzzy-matched;
 * unresolved textual rows never match anything here. Matched rows still pass the C-03 wall,
 * so the workspace never prints a non-cohort identity either.
 */
export function getRawStatementsForRoles(roleCodes: string[]): AtlasCompatibilityStatement[] {
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
    .map((row) => toPublicStatement(row))
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
