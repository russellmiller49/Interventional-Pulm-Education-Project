import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CatalogRecord } from './catalog-utils'

const DEFAULT_REVIEW_FILE = 'data/ip-preference-cards/reviewed/external-review-corrections.json'

export interface ExternalReviewRole extends CatalogRecord {
  role_code: string
  category: string
  role_name: string
  description: string
  selection_guidance: string
  requires_current_ifu: boolean
}

export interface ProductRoleSplit {
  expectRoleCode: string
  groups: {
    setRoleCode: string
    productIds: string[]
  }[]
}

export interface ProductRoleReclassification {
  productId: string
  expectRoleCode: string
  setRoleCode: string
}

export interface SlotRoleTransition {
  slotId: string
  expectRoleCode: string
  setRoleCode: string
  expectOptionProductIds: string[]
  retainOptionProductIds: string[]
}

export interface ProductSlotOptionRemoval {
  productId: string
  expectRoleCode: string
  expectSlotIds: string[]
}

export interface ReviewedSlotOptionUpsert {
  expectAbsent: true
  value: CatalogRecord & {
    slot_id: string
    product_id: string
    role_code: string
    visible_by_default: false
    selectable: true
    review_status: 'reviewed'
    slotting_scope: 'installed_base'
  }
}

export interface CompatibilityAddition {
  expectAbsent: true
  value: CatalogRecord & {
    rule_id: string
    source_product_or_role: string
    target_product_or_role: string
    source_id: string
    resolved_source_type: 'product' | 'role'
    resolved_source_id: string
    resolved_target_type: 'product' | 'role'
    resolved_target_id: string
  }
}

export interface ProductGovernanceEntry {
  productId: string
  catalogLifecycleContext: 'legacy_active_installed_base'
  slottingScope: 'installed_base'
  preferredNewPurchase: false
  installedBaseExactSlotIds: string[]
  lifecycleNote: string
}

export interface ExternalReviewCorrectionsFile {
  formatVersion: 1
  reviewId: string
  notes: string
  rolesToAdd: ExternalReviewRole[]
  deprecatedRoleAliases: {
    roleCode: string
    replacementRoleCodes: string[]
    note: string
  }[]
  productRoleSplits: ProductRoleSplit[]
  productRoleReclassifications: ProductRoleReclassification[]
  slotRoleTransitions: SlotRoleTransition[]
  productSlotOptionRemovals: ProductSlotOptionRemoval[]
  slotOptionUpserts: ReviewedSlotOptionUpsert[]
  compatibilityAdditions: CompatibilityAddition[]
  productGovernance: ProductGovernanceEntry[]
}

export interface ExternalReviewRemediationReport {
  applied: boolean
  review_id: string | null
  adds: {
    roles: number
    slot_product_options: number
    compatibility_rules: number
  }
  removes: {
    slot_product_options: number
  }
  updates: {
    product_roles: number
    procedure_slots: number
    slot_product_options: number
  }
  product_governance_entries: number
  deprecated_role_aliases_preserved: number
  details: {
    added_roles: string[]
    added_slot_product_options: string[]
    added_compatibility_rules: string[]
    removed_slot_product_options: string[]
    updated_product_roles: string[]
    updated_procedure_slots: string[]
    updated_slot_product_options: string[]
  }
  errors: string[]
}

interface PlannedProductRoleChange {
  productId: string
  expectRoleCode: string
  setRoleCode: string
}

function emptyReport(reviewId: string | null): ExternalReviewRemediationReport {
  return {
    applied: false,
    review_id: reviewId,
    adds: {
      roles: 0,
      slot_product_options: 0,
      compatibility_rules: 0,
    },
    removes: {
      slot_product_options: 0,
    },
    updates: {
      product_roles: 0,
      procedure_slots: 0,
      slot_product_options: 0,
    },
    product_governance_entries: 0,
    deprecated_role_aliases_preserved: 0,
    details: {
      added_roles: [],
      added_slot_product_options: [],
      added_compatibility_rules: [],
      removed_slot_product_options: [],
      updated_product_roles: [],
      updated_procedure_slots: [],
      updated_slot_product_options: [],
    },
    errors: [],
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(record: CatalogRecord, field: string): string | null {
  const value = record[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function pairKey(left: string, right: string): string {
  return `${left}\u0000${right}`
}

function displayPair(left: string, right: string): string {
  return `${left} × ${right}`
}

function cloneRecords(records: CatalogRecord[]): CatalogRecord[] {
  return records.map((record) => ({ ...record }))
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort(compareText)
}

function compareExactSet(
  actualValues: string[],
  expectedValues: string[],
  label: string,
  errors: string[],
): void {
  const actualDuplicates = duplicateValues(actualValues)
  if (actualDuplicates.length > 0) {
    errors.push(`${label} contains duplicate actual values: ${actualDuplicates.join(', ')}.`)
  }
  const expectedDuplicates = duplicateValues(expectedValues)
  if (expectedDuplicates.length > 0) {
    errors.push(`${label} contains duplicate expected values: ${expectedDuplicates.join(', ')}.`)
  }

  const actual = [...new Set(actualValues)].sort(compareText)
  const expected = [...new Set(expectedValues)].sort(compareText)
  if (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  ) {
    return
  }

  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  const missing = expected.filter((value) => !actualSet.has(value))
  const unexpected = actual.filter((value) => !expectedSet.has(value))
  errors.push(
    `${label} does not match the governed pre-remediation set; missing [${missing.join(', ')}], unexpected [${unexpected.join(', ')}].`,
  )
}

function buildUniqueIndex(
  records: CatalogRecord[],
  field: string,
  label: string,
  errors: string[],
): Map<string, CatalogRecord> {
  const result = new Map<string, CatalogRecord>()
  for (const record of records) {
    const value = asString(record, field)
    if (!value) {
      errors.push(`${label} contains a row without ${field}.`)
      continue
    }
    if (result.has(value)) {
      errors.push(`${label} contains duplicate ${field} ${value}.`)
      continue
    }
    result.set(value, record)
  }
  return result
}

function buildUniquePairIndex(
  records: CatalogRecord[],
  leftField: string,
  rightField: string,
  label: string,
  errors: string[],
): Map<string, CatalogRecord> {
  const result = new Map<string, CatalogRecord>()
  for (const record of records) {
    const left = asString(record, leftField)
    const right = asString(record, rightField)
    if (!left || !right) {
      errors.push(`${label} contains a row without ${leftField} or ${rightField}.`)
      continue
    }
    const key = pairKey(left, right)
    if (result.has(key)) {
      errors.push(`${label} contains duplicate pair ${displayPair(left, right)}.`)
      continue
    }
    result.set(key, record)
  }
  return result
}

function requiredSheet(
  normalized: Record<string, CatalogRecord[]>,
  name: string,
  errors: string[],
): CatalogRecord[] {
  const value = normalized[name]
  if (!Array.isArray(value)) {
    errors.push(`Catalog input is missing required ${name} records.`)
    return []
  }
  return value
}

function plannedRoleCode(
  record: CatalogRecord,
  changesByPair: Map<string, PlannedProductRoleChange>,
): string | null {
  const productId = asString(record, 'product_id')
  const roleCode = asString(record, 'role_code')
  if (!productId || !roleCode) return null
  return changesByPair.get(pairKey(productId, roleCode))?.setRoleCode ?? roleCode
}

function finalSlotRole(
  slotId: string,
  slotsById: Map<string, CatalogRecord>,
  transitionBySlotId: Map<string, SlotRoleTransition>,
): string | null {
  return (
    transitionBySlotId.get(slotId)?.setRoleCode ??
    asString(slotsById.get(slotId) ?? {}, 'role_code')
  )
}

function validateCorrectionsShape(
  corrections: ExternalReviewCorrectionsFile,
  errors: string[],
): void {
  if (!isObject(corrections)) {
    errors.push('External-review corrections must be a JSON object.')
    return
  }
  if (corrections.formatVersion !== 1) {
    errors.push(
      `Unsupported external-review corrections format ${String(corrections.formatVersion)}; expected 1.`,
    )
  }
  const requiredArrays: (keyof ExternalReviewCorrectionsFile)[] = [
    'rolesToAdd',
    'deprecatedRoleAliases',
    'productRoleSplits',
    'productRoleReclassifications',
    'slotRoleTransitions',
    'productSlotOptionRemovals',
    'slotOptionUpserts',
    'compatibilityAdditions',
    'productGovernance',
  ]
  for (const field of requiredArrays) {
    if (!Array.isArray(corrections[field])) {
      errors.push(`External-review corrections field ${field} must be an array.`)
    }
  }
}

export async function readExternalReviewCorrections(
  filePath = DEFAULT_REVIEW_FILE,
): Promise<ExternalReviewCorrectionsFile | null> {
  try {
    const parsed = JSON.parse(
      await readFile(path.resolve(process.cwd(), filePath), 'utf8'),
    ) as unknown
    if (!isObject(parsed) || parsed.formatVersion !== 1) {
      throw new Error('External-review corrections must be an object with formatVersion 1.')
    }
    return parsed as unknown as ExternalReviewCorrectionsFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/**
 * Applies the reviewed corrections transactionally.
 *
 * Validation runs against the complete governed pre-remediation cohorts. The caller's
 * arrays are replaced only after every guard and post-application integrity check passes.
 * Product rows and Product_Sources are never changed, preserving catalog identifiers and
 * source provenance.
 */
export function applyExternalReviewRemediation(
  normalized: Record<string, CatalogRecord[]>,
  corrections: ExternalReviewCorrectionsFile | null,
): ExternalReviewRemediationReport {
  const report = emptyReport(corrections?.reviewId ?? null)
  if (!corrections) return report

  const errors: string[] = []
  validateCorrectionsShape(corrections, errors)
  if (errors.length > 0) {
    report.errors = [...new Set(errors)].sort(compareText)
    return report
  }

  const products = requiredSheet(normalized, 'Products', errors)
  const productRoles = requiredSheet(normalized, 'Product_Roles', errors)
  const slots = requiredSheet(normalized, 'Procedure_Slots', errors)
  const slotOptions = requiredSheet(normalized, 'Slot_Product_Options', errors)
  const roles = requiredSheet(normalized, 'Roles', errors)
  const compatibility = requiredSheet(normalized, 'Compatibility', errors)
  const sources = requiredSheet(normalized, 'Sources', errors)

  const productById = buildUniqueIndex(products, 'product_id', 'Products', errors)
  const roleByCode = buildUniqueIndex(roles, 'role_code', 'Roles', errors)
  const slotById = buildUniqueIndex(slots, 'slot_id', 'Procedure_Slots', errors)
  const sourceById = buildUniqueIndex(sources, 'source_id', 'Sources', errors)
  buildUniquePairIndex(productRoles, 'product_id', 'role_code', 'Product_Roles', errors)
  buildUniquePairIndex(slotOptions, 'slot_id', 'product_id', 'Slot_Product_Options', errors)
  const compatibilityById = buildUniqueIndex(compatibility, 'rule_id', 'Compatibility', errors)

  const addedRoleCodes = corrections.rolesToAdd.map((role) => role.role_code)
  const duplicateAddedRoles = duplicateValues(addedRoleCodes)
  if (duplicateAddedRoles.length > 0) {
    errors.push(`rolesToAdd contains duplicate role codes: ${duplicateAddedRoles.join(', ')}.`)
  }
  for (const role of corrections.rolesToAdd) {
    if (!role.role_code || !role.role_name) {
      errors.push('Each rolesToAdd row must contain role_code and role_name.')
      continue
    }
    if (roleByCode.has(role.role_code)) {
      errors.push(`Role addition ${role.role_code} already exists; expected it to be absent.`)
    }
  }
  const finalRoleCodes = new Set([...roleByCode.keys(), ...addedRoleCodes])

  const plannedChanges: PlannedProductRoleChange[] = []
  const changesByPair = new Map<string, PlannedProductRoleChange>()
  for (const split of corrections.productRoleSplits) {
    const expectedProductIds = split.groups.flatMap((group) => group.productIds)
    const actualProductIds = productRoles
      .filter((record) => asString(record, 'role_code') === split.expectRoleCode)
      .map((record) => asString(record, 'product_id'))
      .filter((value): value is string => value !== null)
    compareExactSet(
      actualProductIds,
      expectedProductIds,
      `Product_Roles cohort ${split.expectRoleCode}`,
      errors,
    )

    for (const group of split.groups) {
      if (!finalRoleCodes.has(group.setRoleCode)) {
        errors.push(
          `Product-role split ${split.expectRoleCode} targets unknown role ${group.setRoleCode}.`,
        )
      }
      for (const productId of group.productIds) {
        if (!productById.has(productId)) {
          errors.push(
            `Product-role split ${split.expectRoleCode} references unknown product ${productId}.`,
          )
        }
        const change = {
          productId,
          expectRoleCode: split.expectRoleCode,
          setRoleCode: group.setRoleCode,
        }
        const key = pairKey(productId, split.expectRoleCode)
        if (changesByPair.has(key)) {
          errors.push(
            `Product-role correction repeats ${displayPair(productId, split.expectRoleCode)}.`,
          )
          continue
        }
        changesByPair.set(key, change)
        plannedChanges.push(change)
      }
    }
  }

  for (const change of corrections.productRoleReclassifications) {
    if (!productById.has(change.productId)) {
      errors.push(`Product-role correction references unknown product ${change.productId}.`)
    }
    if (!finalRoleCodes.has(change.setRoleCode)) {
      errors.push(
        `Product-role correction for ${change.productId} targets unknown role ${change.setRoleCode}.`,
      )
    }
    const matchingRows = productRoles.filter(
      (record) =>
        asString(record, 'product_id') === change.productId &&
        asString(record, 'role_code') === change.expectRoleCode,
    )
    if (matchingRows.length !== 1) {
      errors.push(
        `Product-role correction ${displayPair(change.productId, change.expectRoleCode)} matched ${matchingRows.length} rows; expected exactly 1.`,
      )
    }
    const key = pairKey(change.productId, change.expectRoleCode)
    if (changesByPair.has(key)) {
      errors.push(
        `Product-role correction repeats ${displayPair(change.productId, change.expectRoleCode)}.`,
      )
      continue
    }
    const planned = { ...change }
    changesByPair.set(key, planned)
    plannedChanges.push(planned)
  }

  const transitionBySlotId = new Map<string, SlotRoleTransition>()
  for (const transition of corrections.slotRoleTransitions) {
    if (transitionBySlotId.has(transition.slotId)) {
      errors.push(`Slot-role transition repeats slot ${transition.slotId}.`)
      continue
    }
    transitionBySlotId.set(transition.slotId, transition)
    const slot = slotById.get(transition.slotId)
    if (!slot) {
      errors.push(`Slot-role transition references unknown slot ${transition.slotId}.`)
      continue
    }
    const actualRoleCode = asString(slot, 'role_code')
    if (actualRoleCode !== transition.expectRoleCode) {
      errors.push(
        `Slot ${transition.slotId} expected role ${transition.expectRoleCode} but found ${String(actualRoleCode)}.`,
      )
    }
    if (!finalRoleCodes.has(transition.setRoleCode)) {
      errors.push(`Slot ${transition.slotId} targets unknown role ${transition.setRoleCode}.`)
    }
    const optionsForSlot = slotOptions.filter(
      (option) => asString(option, 'slot_id') === transition.slotId,
    )
    compareExactSet(
      optionsForSlot
        .map((option) => asString(option, 'product_id'))
        .filter((value): value is string => value !== null),
      transition.expectOptionProductIds,
      `Slot_Product_Options cohort ${transition.slotId}`,
      errors,
    )
    const expectedIds = new Set(transition.expectOptionProductIds)
    for (const retainedProductId of transition.retainOptionProductIds) {
      if (!expectedIds.has(retainedProductId)) {
        errors.push(
          `Slot ${transition.slotId} retains ${retainedProductId}, which is absent from its expected option cohort.`,
        )
      }
    }
    for (const option of optionsForSlot) {
      const optionRoleCode = asString(option, 'role_code')
      if (optionRoleCode !== transition.expectRoleCode) {
        errors.push(
          `Option ${displayPair(transition.slotId, String(option.product_id))} expected role ${transition.expectRoleCode} but found ${String(optionRoleCode)}.`,
        )
      }
    }
  }

  const removalPairs = new Set<string>()
  for (const removal of corrections.productSlotOptionRemovals) {
    if (!productById.has(removal.productId)) {
      errors.push(`Slot-option removal references unknown product ${removal.productId}.`)
    }
    const matchingOptions = slotOptions.filter(
      (option) =>
        asString(option, 'product_id') === removal.productId &&
        asString(option, 'role_code') === removal.expectRoleCode,
    )
    compareExactSet(
      matchingOptions
        .map((option) => asString(option, 'slot_id'))
        .filter((value): value is string => value !== null),
      removal.expectSlotIds,
      `Slot_Product_Options for ${displayPair(removal.productId, removal.expectRoleCode)}`,
      errors,
    )
    for (const slotId of removal.expectSlotIds) {
      const key = pairKey(slotId, removal.productId)
      if (removalPairs.has(key)) {
        errors.push(`Slot-option removal repeats ${displayPair(slotId, removal.productId)}.`)
      }
      removalPairs.add(key)
    }
  }

  const finalRolesByProduct = new Map<string, Set<string>>()
  for (const productRole of productRoles) {
    const productId = asString(productRole, 'product_id')
    const roleCode = plannedRoleCode(productRole, changesByPair)
    if (!productId || !roleCode) continue
    const values = finalRolesByProduct.get(productId) ?? new Set<string>()
    values.add(roleCode)
    finalRolesByProduct.set(productId, values)
  }

  for (const transition of corrections.slotRoleTransitions) {
    for (const productId of transition.retainOptionProductIds) {
      if (!finalRolesByProduct.get(productId)?.has(transition.setRoleCode)) {
        errors.push(
          `Retained option ${displayPair(transition.slotId, productId)} has no planned Product_Roles pair for ${transition.setRoleCode}.`,
        )
      }
    }
  }

  const governanceByProductId = new Map<string, ProductGovernanceEntry>()
  for (const governance of corrections.productGovernance) {
    if (governanceByProductId.has(governance.productId)) {
      errors.push(`Product governance repeats product ${governance.productId}.`)
      continue
    }
    governanceByProductId.set(governance.productId, governance)
    if (!productById.has(governance.productId)) {
      errors.push(`Product governance references unknown product ${governance.productId}.`)
    }
    if (
      governance.catalogLifecycleContext !== 'legacy_active_installed_base' ||
      governance.slottingScope !== 'installed_base' ||
      governance.preferredNewPurchase !== false
    ) {
      errors.push(
        `Product governance for ${governance.productId} must be legacy_active_installed_base, installed_base, and not preferred for new purchase.`,
      )
    }
    if (!governance.lifecycleNote.trim()) {
      errors.push(`Product governance for ${governance.productId} requires a lifecycle note.`)
    }
    const duplicateSlotIds = duplicateValues(governance.installedBaseExactSlotIds)
    if (duplicateSlotIds.length > 0) {
      errors.push(
        `Product governance for ${governance.productId} repeats slots: ${duplicateSlotIds.join(', ')}.`,
      )
    }
    for (const slotId of governance.installedBaseExactSlotIds) {
      if (!slotById.has(slotId)) {
        errors.push(
          `Product governance for ${governance.productId} references unknown slot ${slotId}.`,
        )
      }
    }
  }

  const upsertPairs = new Set<string>()
  for (const upsert of corrections.slotOptionUpserts) {
    const value = upsert.value
    const slotId = value.slot_id
    const productId = value.product_id
    const key = pairKey(slotId, productId)
    if (upsert.expectAbsent !== true) {
      errors.push(`Slot-option upsert ${displayPair(slotId, productId)} must expect absence.`)
    }
    if (upsertPairs.has(key)) {
      errors.push(`Slot-option upsert repeats ${displayPair(slotId, productId)}.`)
    }
    upsertPairs.add(key)
    if (
      slotOptions.some(
        (option) =>
          asString(option, 'slot_id') === slotId && asString(option, 'product_id') === productId,
      )
    ) {
      errors.push(
        `Slot-option upsert ${displayPair(slotId, productId)} already exists; expected it to be absent.`,
      )
    }
    const product = productById.get(productId)
    if (!product) {
      errors.push(`Slot-option upsert references unknown product ${productId}.`)
    }
    if (!slotById.has(slotId)) {
      errors.push(`Slot-option upsert references unknown slot ${slotId}.`)
    }
    const expectedRoleCode = finalSlotRole(slotId, slotById, transitionBySlotId)
    if (value.role_code !== expectedRoleCode) {
      errors.push(
        `Slot-option upsert ${displayPair(slotId, productId)} uses role ${value.role_code}; final slot role is ${String(expectedRoleCode)}.`,
      )
    }
    if (!finalRolesByProduct.get(productId)?.has(value.role_code)) {
      errors.push(
        `Slot-option upsert ${displayPair(slotId, productId)} has no Product_Roles pair for ${value.role_code}.`,
      )
    }
    if (
      value.visible_by_default !== false ||
      value.selectable !== true ||
      value.review_status !== 'reviewed' ||
      value.slotting_scope !== 'installed_base' ||
      Object.prototype.hasOwnProperty.call(value, 'preferred')
    ) {
      errors.push(
        `Installed-base option ${displayPair(slotId, productId)} must be reviewed, hidden by default, selectable, installed-base scoped, and must not carry a preferred flag.`,
      )
    }
    if (product && value.product_visibility !== product.visibility_state) {
      errors.push(
        `Installed-base option ${displayPair(slotId, productId)} records product_visibility=${String(value.product_visibility)} but the product has ${String(product.visibility_state)}.`,
      )
    }
    const governance = governanceByProductId.get(productId)
    if (!governance?.installedBaseExactSlotIds.includes(slotId)) {
      errors.push(
        `Installed-base option ${displayPair(slotId, productId)} is absent from productGovernance.`,
      )
    }
  }

  for (const governance of corrections.productGovernance) {
    const governedPairs = governance.installedBaseExactSlotIds.map((slotId) =>
      pairKey(slotId, governance.productId),
    )
    for (const key of governedPairs) {
      if (!upsertPairs.has(key)) {
        const [slotId, productId] = key.split('\u0000')
        errors.push(
          `Product governance pair ${displayPair(slotId, productId)} has no reviewed slot-option upsert.`,
        )
      }
    }
  }

  const compatibilityIds = corrections.compatibilityAdditions.map(
    (addition) => addition.value.rule_id,
  )
  const duplicateCompatibilityIds = duplicateValues(compatibilityIds)
  if (duplicateCompatibilityIds.length > 0) {
    errors.push(
      `compatibilityAdditions contains duplicate rule IDs: ${duplicateCompatibilityIds.join(', ')}.`,
    )
  }
  for (const addition of corrections.compatibilityAdditions) {
    const value = addition.value
    if (addition.expectAbsent !== true) {
      errors.push(`Compatibility addition ${value.rule_id} must expect absence.`)
    }
    if (compatibilityById.has(value.rule_id)) {
      errors.push(
        `Compatibility addition ${value.rule_id} already exists; expected it to be absent.`,
      )
    }
    if (
      value.resolved_source_type !== 'product' ||
      value.resolved_source_id !== value.source_product_or_role ||
      !productById.has(value.resolved_source_id)
    ) {
      errors.push(
        `Compatibility addition ${value.rule_id} must resolve its source to an existing product.`,
      )
    }
    if (
      value.resolved_target_type !== 'role' ||
      value.resolved_target_id !== value.target_product_or_role ||
      !finalRoleCodes.has(value.resolved_target_id)
    ) {
      errors.push(
        `Compatibility addition ${value.rule_id} must resolve its target to an existing role.`,
      )
    }
    if (!sourceById.has(value.source_id)) {
      errors.push(
        `Compatibility addition ${value.rule_id} references unknown source ${value.source_id}.`,
      )
    }
  }

  for (const alias of corrections.deprecatedRoleAliases) {
    if (!roleByCode.has(alias.roleCode)) {
      errors.push(`Deprecated role alias references unknown role ${alias.roleCode}.`)
    }
    if (!alias.note.trim()) {
      errors.push(`Deprecated role alias ${alias.roleCode} requires a trace note.`)
    }
    for (const replacementRoleCode of alias.replacementRoleCodes) {
      if (!finalRoleCodes.has(replacementRoleCode)) {
        errors.push(
          `Deprecated role alias ${alias.roleCode} references unknown replacement ${replacementRoleCode}.`,
        )
      }
    }
  }

  if (errors.length > 0) {
    report.errors = [...new Set(errors)].sort(compareText)
    return report
  }

  const working: Record<string, CatalogRecord[]> = {
    ...normalized,
    Roles: cloneRecords(roles),
    Product_Roles: cloneRecords(productRoles),
    Procedure_Slots: cloneRecords(slots),
    Slot_Product_Options: cloneRecords(slotOptions),
    Compatibility: cloneRecords(compatibility),
  }

  working.Roles.push(...corrections.rolesToAdd.map((role) => ({ ...role })))

  for (const record of working.Product_Roles) {
    const productId = asString(record, 'product_id')
    const roleCode = asString(record, 'role_code')
    if (!productId || !roleCode) continue
    const change = changesByPair.get(pairKey(productId, roleCode))
    if (change) record.role_code = change.setRoleCode
  }

  for (const record of working.Procedure_Slots) {
    const slotId = asString(record, 'slot_id')
    if (!slotId) continue
    const transition = transitionBySlotId.get(slotId)
    if (transition) record.role_code = transition.setRoleCode
  }

  const removedOptionDetails: string[] = []
  const updatedOptionDetails: string[] = []
  working.Slot_Product_Options = working.Slot_Product_Options.filter((option) => {
    const slotId = asString(option, 'slot_id')
    const productId = asString(option, 'product_id')
    if (!slotId || !productId) return true

    const transition = transitionBySlotId.get(slotId)
    if (transition) {
      if (!transition.retainOptionProductIds.includes(productId)) {
        removedOptionDetails.push(displayPair(slotId, productId))
        return false
      }
      option.role_code = transition.setRoleCode
      if (typeof option.reason === 'string') {
        option.reason = option.reason.replaceAll(transition.expectRoleCode, transition.setRoleCode)
      }
      updatedOptionDetails.push(
        `${displayPair(slotId, productId)}: ${transition.expectRoleCode} -> ${transition.setRoleCode}`,
      )
      return true
    }

    if (removalPairs.has(pairKey(slotId, productId))) {
      removedOptionDetails.push(displayPair(slotId, productId))
      return false
    }
    return true
  })

  working.Slot_Product_Options.push(
    ...corrections.slotOptionUpserts.map((upsert) => ({ ...upsert.value })),
  )
  working.Compatibility.push(
    ...corrections.compatibilityAdditions.map((addition) => ({ ...addition.value })),
  )

  const postErrors: string[] = []
  const finalRoleByCode = buildUniqueIndex(working.Roles, 'role_code', 'Roles', postErrors)
  const finalProductRolePairs = buildUniquePairIndex(
    working.Product_Roles,
    'product_id',
    'role_code',
    'Product_Roles',
    postErrors,
  )
  const finalSlotById = buildUniqueIndex(
    working.Procedure_Slots,
    'slot_id',
    'Procedure_Slots',
    postErrors,
  )
  buildUniquePairIndex(
    working.Slot_Product_Options,
    'slot_id',
    'product_id',
    'Slot_Product_Options',
    postErrors,
  )
  buildUniqueIndex(working.Compatibility, 'rule_id', 'Compatibility', postErrors)

  for (const alias of corrections.deprecatedRoleAliases) {
    if (!finalRoleByCode.has(alias.roleCode)) {
      postErrors.push(`Deprecated source role ${alias.roleCode} was not preserved.`)
    }
    if (working.Product_Roles.some((record) => asString(record, 'role_code') === alias.roleCode)) {
      postErrors.push(`Deprecated source role ${alias.roleCode} still has product assignments.`)
    }
    if (
      working.Procedure_Slots.some((record) => asString(record, 'role_code') === alias.roleCode)
    ) {
      postErrors.push(`Deprecated source role ${alias.roleCode} still has exact slots.`)
    }
  }

  const changedOrAddedOptionPairs = new Set([
    ...updatedOptionDetails.map((detail) => {
      const pair = detail.split(': ')[0]
      const [slotId, productId] = pair.split(' × ')
      return pairKey(slotId, productId)
    }),
    ...upsertPairs,
  ])
  for (const option of working.Slot_Product_Options) {
    const slotId = asString(option, 'slot_id')
    const productId = asString(option, 'product_id')
    const roleCode = asString(option, 'role_code')
    if (!slotId || !productId || !roleCode) continue
    if (!changedOrAddedOptionPairs.has(pairKey(slotId, productId))) continue
    const slotRoleCode = asString(finalSlotById.get(slotId) ?? {}, 'role_code')
    if (roleCode !== slotRoleCode) {
      postErrors.push(
        `Remediated option ${displayPair(slotId, productId)} uses role ${roleCode}; slot role is ${String(slotRoleCode)}.`,
      )
    }
    if (!finalProductRolePairs.has(pairKey(productId, roleCode))) {
      postErrors.push(
        `Remediated option ${displayPair(slotId, productId)} has no Product_Roles pair for ${roleCode}.`,
      )
    }
  }

  if (postErrors.length > 0) {
    report.errors = [...new Set(postErrors)].sort(compareText)
    return report
  }

  normalized.Roles = working.Roles
  normalized.Product_Roles = working.Product_Roles
  normalized.Procedure_Slots = working.Procedure_Slots
  normalized.Slot_Product_Options = working.Slot_Product_Options
  normalized.Compatibility = working.Compatibility

  report.applied = true
  report.adds = {
    roles: corrections.rolesToAdd.length,
    slot_product_options: corrections.slotOptionUpserts.length,
    compatibility_rules: corrections.compatibilityAdditions.length,
  }
  report.removes = {
    slot_product_options: removedOptionDetails.length,
  }
  report.updates = {
    product_roles: plannedChanges.length,
    procedure_slots: corrections.slotRoleTransitions.length,
    slot_product_options: updatedOptionDetails.length,
  }
  report.product_governance_entries = corrections.productGovernance.length
  report.deprecated_role_aliases_preserved = corrections.deprecatedRoleAliases.length
  report.details = {
    added_roles: [...addedRoleCodes],
    added_slot_product_options: corrections.slotOptionUpserts.map((upsert) =>
      displayPair(upsert.value.slot_id, upsert.value.product_id),
    ),
    added_compatibility_rules: [...compatibilityIds],
    removed_slot_product_options: removedOptionDetails,
    updated_product_roles: plannedChanges.map(
      (change) => `${change.productId}: ${change.expectRoleCode} -> ${change.setRoleCode}`,
    ),
    updated_procedure_slots: corrections.slotRoleTransitions.map(
      (transition) =>
        `${transition.slotId}: ${transition.expectRoleCode} -> ${transition.setRoleCode}`,
    ),
    updated_slot_product_options: updatedOptionDetails,
  }

  return report
}
