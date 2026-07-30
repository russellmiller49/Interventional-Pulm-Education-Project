import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { ExternalReviewRemediationDecisionArtifact } from '@/features/preference-cards/excel/external-review-remediation-import.server'

import type { CatalogRecord } from './catalog-utils'

const DEFAULT_IMPLEMENTATION_FILE =
  'data/ip-preference-cards/reviewed/external-review-completed-implementation.json'
const DEFAULT_DECISION_ARTIFACT_FILE =
  'data/ip-preference-cards/reviewed/external-review-remediation-decisions.json'

export interface CompletedReviewRole extends CatalogRecord {
  role_code: string
  category: string
  role_name: string
  description: string
  selection_guidance: string
  requires_current_ifu: boolean
}

export interface CompletedReviewProductRoleMutation {
  reviewKey: string
  productId: string
  expectRoleCode: string
  setRoleCode: string
  expectRoleFit: string | null
  setRoleFit: string | null
}

export interface CompletedReviewProductRoleAddition {
  reviewKey: string
  expectAbsent: true
  value: CatalogRecord & {
    product_id: string
    role_code: string
    role_fit: string | null
  }
}

export interface CompletedReviewSlotOptionRemoval {
  reviewKey: string
  slotId: string
  productId: string
  expectRoleCode: string
}

export interface CompletedReviewExpectedAbsentSlotOption {
  reviewKey: string
  slotId: string
  productId: string
}

export interface CompletedReviewSlotOptionUpsert {
  reviewKey: string
  expectAbsent: true
  value: CatalogRecord & {
    slot_id: string
    product_id: string
    role_code: string
    visible_by_default: false
    selectable: true
    review_status: 'reviewed'
    slotting_scope: 'standard'
  }
}

export interface CompletedReviewCompatibilityAddition {
  reviewKey: string
  expectAbsent: true
  value: CatalogRecord & {
    rule_id: string
    source_product_or_role: string
    target_product_or_role: string
    source_id: string
    resolved_source_type: 'product'
    resolved_source_id: string
    resolved_target_type: 'product'
    resolved_target_id: string
  }
}

export interface ExternalReviewCompletedImplementationFile {
  formatVersion: 1
  implementationId: string
  reviewId: string
  sourceWorkbook: string
  sourceWorkbookSha256: string
  proposalCorrectionsSha256: string
  notes: string
  rolesToAdd: CompletedReviewRole[]
  productRoleMutations: CompletedReviewProductRoleMutation[]
  productRoleAdditions: CompletedReviewProductRoleAddition[]
  slotOptionRemovals: CompletedReviewSlotOptionRemoval[]
  expectedAbsentSlotOptions: CompletedReviewExpectedAbsentSlotOption[]
  slotOptionUpserts: CompletedReviewSlotOptionUpsert[]
  compatibilityAdditions: CompletedReviewCompatibilityAddition[]
}

export interface ExternalReviewCompletedImplementationReport {
  applied: boolean
  implementation_id: string | null
  review_id: string | null
  source_workbook_sha256: string | null
  proposal_corrections_sha256: string | null
  adds: {
    roles: number
    product_roles: number
    slot_product_options: number
    compatibility_rules: number
  }
  removes: {
    slot_product_options: number
  }
  updates: {
    product_roles: number
  }
  verified_absent_slot_product_options: number
  decision_evidence: {
    referenced_review_keys: number
    normalized_decisions: number
    errors: number
    warnings: number
  }
  details: {
    added_roles: string[]
    added_product_roles: string[]
    updated_product_roles: string[]
    removed_slot_product_options: string[]
    verified_absent_slot_product_options: string[]
    added_slot_product_options: string[]
    added_compatibility_rules: string[]
  }
  errors: string[]
}

function emptyReport(
  implementation: ExternalReviewCompletedImplementationFile | null,
): ExternalReviewCompletedImplementationReport {
  return {
    applied: false,
    implementation_id: implementation?.implementationId ?? null,
    review_id: implementation?.reviewId ?? null,
    source_workbook_sha256: implementation?.sourceWorkbookSha256 ?? null,
    proposal_corrections_sha256: implementation?.proposalCorrectionsSha256 ?? null,
    adds: {
      roles: 0,
      product_roles: 0,
      slot_product_options: 0,
      compatibility_rules: 0,
    },
    removes: {
      slot_product_options: 0,
    },
    updates: {
      product_roles: 0,
    },
    verified_absent_slot_product_options: 0,
    decision_evidence: {
      referenced_review_keys: 0,
      normalized_decisions: 0,
      errors: 0,
      warnings: 0,
    },
    details: {
      added_roles: [],
      added_product_roles: [],
      updated_product_roles: [],
      removed_slot_product_options: [],
      verified_absent_slot_product_options: [],
      added_slot_product_options: [],
      added_compatibility_rules: [],
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

function asNullableString(record: CatalogRecord, field: string): string | null {
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

function validateImplementationShape(
  implementation: ExternalReviewCompletedImplementationFile,
  errors: string[],
): void {
  if (!isObject(implementation)) {
    errors.push('Completed external-review implementation must be a JSON object.')
    return
  }
  if (implementation.formatVersion !== 1) {
    errors.push(
      `Unsupported completed external-review implementation format ${String(implementation.formatVersion)}; expected 1.`,
    )
  }
  if (!implementation.implementationId?.trim()) {
    errors.push('Completed external-review implementation requires implementationId.')
  }
  if (!implementation.reviewId?.trim()) {
    errors.push('Completed external-review implementation requires reviewId.')
  }
  if (!/^[a-f0-9]{64}$/.test(implementation.sourceWorkbookSha256 ?? '')) {
    errors.push('Completed external-review sourceWorkbookSha256 must be lowercase SHA-256.')
  }
  if (!/^[a-f0-9]{64}$/.test(implementation.proposalCorrectionsSha256 ?? '')) {
    errors.push('Completed external-review proposalCorrectionsSha256 must be lowercase SHA-256.')
  }
  const requiredArrays: (keyof ExternalReviewCompletedImplementationFile)[] = [
    'rolesToAdd',
    'productRoleMutations',
    'productRoleAdditions',
    'slotOptionRemovals',
    'expectedAbsentSlotOptions',
    'slotOptionUpserts',
    'compatibilityAdditions',
  ]
  for (const field of requiredArrays) {
    if (!Array.isArray(implementation[field])) {
      errors.push(`Completed external-review field ${field} must be an array.`)
    }
  }
}

export async function readExternalReviewCompletedImplementation(
  filePath = DEFAULT_IMPLEMENTATION_FILE,
): Promise<ExternalReviewCompletedImplementationFile | null> {
  try {
    const parsed = JSON.parse(
      await readFile(path.resolve(process.cwd(), filePath), 'utf8'),
    ) as unknown
    if (!isObject(parsed) || parsed.formatVersion !== 1) {
      throw new Error(
        'Completed external-review implementation must be an object with formatVersion 1.',
      )
    }
    return parsed as unknown as ExternalReviewCompletedImplementationFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function readExternalReviewRemediationDecisionArtifact(
  filePath = DEFAULT_DECISION_ARTIFACT_FILE,
): Promise<ExternalReviewRemediationDecisionArtifact | null> {
  try {
    const parsed = JSON.parse(
      await readFile(path.resolve(process.cwd(), filePath), 'utf8'),
    ) as unknown
    if (!isObject(parsed) || parsed.formatVersion !== 1) {
      throw new Error('External-review decision artifact must be an object with formatVersion 1.')
    }
    return parsed as unknown as ExternalReviewRemediationDecisionArtifact
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/**
 * Applies the compiled decisions from the completed review workbook transactionally.
 *
 * This layer expects the proposal-level external-review remediation to have already
 * succeeded. It never changes Products, Manufacturers, Sources, or Product_Sources.
 */
export function applyExternalReviewCompletedImplementation(
  normalized: Record<string, CatalogRecord[]>,
  implementation: ExternalReviewCompletedImplementationFile | null,
  decisionArtifact: ExternalReviewRemediationDecisionArtifact | null,
): ExternalReviewCompletedImplementationReport {
  const report = emptyReport(implementation)
  if (!implementation) return report

  const errors: string[] = []
  validateImplementationShape(implementation, errors)
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
  const productRoleByPair = buildUniquePairIndex(
    productRoles,
    'product_id',
    'role_code',
    'Product_Roles',
    errors,
  )
  const optionByPair = buildUniquePairIndex(
    slotOptions,
    'slot_id',
    'product_id',
    'Slot_Product_Options',
    errors,
  )
  const compatibilityById = buildUniqueIndex(compatibility, 'rule_id', 'Compatibility', errors)

  const addedRoleCodes = implementation.rolesToAdd.map((role) => role.role_code)
  const duplicateAddedRoles = duplicateValues(addedRoleCodes)
  if (duplicateAddedRoles.length > 0) {
    errors.push(`rolesToAdd contains duplicate role codes: ${duplicateAddedRoles.join(', ')}.`)
  }
  for (const role of implementation.rolesToAdd) {
    if (!role.role_code?.trim() || !role.role_name?.trim()) {
      errors.push('Every completed-review role addition requires role_code and role_name.')
      continue
    }
    if (roleByCode.has(role.role_code)) {
      errors.push(`Role addition ${role.role_code} already exists; expected it to be absent.`)
    }
  }
  const finalRoleCodes = new Set([...roleByCode.keys(), ...addedRoleCodes])

  const mutationPairs = implementation.productRoleMutations.map((mutation) =>
    pairKey(mutation.productId, mutation.expectRoleCode),
  )
  const duplicateMutationPairs = duplicateValues(mutationPairs)
  if (duplicateMutationPairs.length > 0) {
    errors.push('productRoleMutations contains duplicate expected product-role pairs.')
  }
  const mutationByExpectedPair = new Map(
    implementation.productRoleMutations.map((mutation) => [
      pairKey(mutation.productId, mutation.expectRoleCode),
      mutation,
    ]),
  )
  const finalMutatedPairs = new Set<string>()
  for (const mutation of implementation.productRoleMutations) {
    if (!mutation.reviewKey?.trim()) {
      errors.push(`Product-role mutation for ${mutation.productId} requires reviewKey.`)
    }
    if (!productById.has(mutation.productId)) {
      errors.push(`Product-role mutation references unknown product ${mutation.productId}.`)
    }
    if (!finalRoleCodes.has(mutation.setRoleCode)) {
      errors.push(
        `Product-role mutation for ${mutation.productId} targets unknown role ${mutation.setRoleCode}.`,
      )
    }
    const record = productRoleByPair.get(pairKey(mutation.productId, mutation.expectRoleCode))
    if (!record) {
      errors.push(
        `Product-role mutation expected ${displayPair(mutation.productId, mutation.expectRoleCode)} but found no row.`,
      )
      continue
    }
    const actualRoleFit = asNullableString(record, 'role_fit')
    if (actualRoleFit !== mutation.expectRoleFit) {
      errors.push(
        `Product-role mutation ${displayPair(mutation.productId, mutation.expectRoleCode)} expected role_fit ${String(mutation.expectRoleFit)} but found ${String(actualRoleFit)}.`,
      )
    }
    const finalPair = pairKey(mutation.productId, mutation.setRoleCode)
    if (finalMutatedPairs.has(finalPair)) {
      errors.push(
        `Product-role mutations converge on duplicate pair ${displayPair(mutation.productId, mutation.setRoleCode)}.`,
      )
    }
    finalMutatedPairs.add(finalPair)
    const existingFinal = productRoleByPair.get(finalPair)
    if (existingFinal && pairKey(mutation.productId, mutation.expectRoleCode) !== finalPair) {
      errors.push(
        `Product-role mutation target ${displayPair(mutation.productId, mutation.setRoleCode)} already exists.`,
      )
    }
  }

  const additionPairs = implementation.productRoleAdditions.map((addition) =>
    pairKey(addition.value.product_id, addition.value.role_code),
  )
  const duplicateAdditionPairs = duplicateValues(additionPairs)
  if (duplicateAdditionPairs.length > 0) {
    errors.push('productRoleAdditions contains duplicate product-role pairs.')
  }
  for (const addition of implementation.productRoleAdditions) {
    const value = addition.value
    if (!addition.reviewKey?.trim()) {
      errors.push(
        `Product-role addition ${displayPair(value.product_id, value.role_code)} requires reviewKey.`,
      )
    }
    if (addition.expectAbsent !== true) {
      errors.push(
        `Product-role addition ${displayPair(value.product_id, value.role_code)} must expect absence.`,
      )
    }
    if (!productById.has(value.product_id)) {
      errors.push(`Product-role addition references unknown product ${value.product_id}.`)
    }
    if (!finalRoleCodes.has(value.role_code)) {
      errors.push(`Product-role addition targets unknown role ${value.role_code}.`)
    }
    if (productRoleByPair.has(pairKey(value.product_id, value.role_code))) {
      errors.push(
        `Product-role addition ${displayPair(value.product_id, value.role_code)} already exists; expected it to be absent.`,
      )
    }
    if (finalMutatedPairs.has(pairKey(value.product_id, value.role_code))) {
      errors.push(
        `Product-role addition ${displayPair(value.product_id, value.role_code)} collides with a mutation target.`,
      )
    }
  }

  const removalPairs = implementation.slotOptionRemovals.map((removal) =>
    pairKey(removal.slotId, removal.productId),
  )
  const duplicateRemovalPairs = duplicateValues(removalPairs)
  if (duplicateRemovalPairs.length > 0) {
    errors.push('slotOptionRemovals contains duplicate slot-product pairs.')
  }
  const removalPairSet = new Set(removalPairs)
  for (const removal of implementation.slotOptionRemovals) {
    if (!removal.reviewKey?.trim()) {
      errors.push(
        `Slot-option removal ${displayPair(removal.slotId, removal.productId)} requires reviewKey.`,
      )
    }
    if (!slotById.has(removal.slotId)) {
      errors.push(`Slot-option removal references unknown slot ${removal.slotId}.`)
    }
    if (!productById.has(removal.productId)) {
      errors.push(`Slot-option removal references unknown product ${removal.productId}.`)
    }
    const option = optionByPair.get(pairKey(removal.slotId, removal.productId))
    if (!option) {
      errors.push(
        `Slot-option removal expected ${displayPair(removal.slotId, removal.productId)} but found no row.`,
      )
      continue
    }
    const actualRoleCode = asString(option, 'role_code')
    if (actualRoleCode !== removal.expectRoleCode) {
      errors.push(
        `Slot-option removal ${displayPair(removal.slotId, removal.productId)} expected role ${removal.expectRoleCode} but found ${String(actualRoleCode)}.`,
      )
    }
  }

  const expectedAbsentPairs = implementation.expectedAbsentSlotOptions.map((item) =>
    pairKey(item.slotId, item.productId),
  )
  const duplicateExpectedAbsentPairs = duplicateValues(expectedAbsentPairs)
  if (duplicateExpectedAbsentPairs.length > 0) {
    errors.push('expectedAbsentSlotOptions contains duplicate slot-product pairs.')
  }
  for (const item of implementation.expectedAbsentSlotOptions) {
    if (!item.reviewKey?.trim()) {
      errors.push(
        `Expected-absent slot option ${displayPair(item.slotId, item.productId)} requires reviewKey.`,
      )
    }
    if (!slotById.has(item.slotId)) {
      errors.push(`Expected-absent slot option references unknown slot ${item.slotId}.`)
    }
    if (!productById.has(item.productId)) {
      errors.push(`Expected-absent slot option references unknown product ${item.productId}.`)
    }
    if (optionByPair.has(pairKey(item.slotId, item.productId))) {
      errors.push(
        `Expected-absent slot option ${displayPair(item.slotId, item.productId)} is present.`,
      )
    }
  }

  const finalProductRolePairs = new Set(productRoleByPair.keys())
  for (const mutation of implementation.productRoleMutations) {
    finalProductRolePairs.delete(pairKey(mutation.productId, mutation.expectRoleCode))
    finalProductRolePairs.add(pairKey(mutation.productId, mutation.setRoleCode))
  }
  for (const addition of implementation.productRoleAdditions) {
    finalProductRolePairs.add(pairKey(addition.value.product_id, addition.value.role_code))
  }

  const upsertPairs = implementation.slotOptionUpserts.map((upsert) =>
    pairKey(upsert.value.slot_id, upsert.value.product_id),
  )
  const duplicateUpsertPairs = duplicateValues(upsertPairs)
  if (duplicateUpsertPairs.length > 0) {
    errors.push('slotOptionUpserts contains duplicate slot-product pairs.')
  }
  for (const upsert of implementation.slotOptionUpserts) {
    const value = upsert.value
    if (!upsert.reviewKey?.trim()) {
      errors.push(
        `Slot-option upsert ${displayPair(value.slot_id, value.product_id)} requires reviewKey.`,
      )
    }
    if (upsert.expectAbsent !== true) {
      errors.push(
        `Slot-option upsert ${displayPair(value.slot_id, value.product_id)} must expect absence.`,
      )
    }
    if (optionByPair.has(pairKey(value.slot_id, value.product_id))) {
      errors.push(
        `Slot-option upsert ${displayPair(value.slot_id, value.product_id)} already exists; expected it to be absent.`,
      )
    }
    if (removalPairSet.has(pairKey(value.slot_id, value.product_id))) {
      errors.push(
        `Slot-option upsert ${displayPair(value.slot_id, value.product_id)} is also scheduled for removal.`,
      )
    }
    const slot = slotById.get(value.slot_id)
    if (!slot) {
      errors.push(`Slot-option upsert references unknown slot ${value.slot_id}.`)
    } else if (asString(slot, 'role_code') !== value.role_code) {
      errors.push(
        `Slot-option upsert ${displayPair(value.slot_id, value.product_id)} uses role ${value.role_code}; slot role is ${String(slot.role_code)}.`,
      )
    }
    const product = productById.get(value.product_id)
    if (!product) {
      errors.push(`Slot-option upsert references unknown product ${value.product_id}.`)
    } else if (asString(product, 'visibility_state') !== value.product_visibility) {
      errors.push(
        `Slot-option upsert ${displayPair(value.slot_id, value.product_id)} declares product visibility ${String(value.product_visibility)} but Products has ${String(product.visibility_state)}.`,
      )
    }
    if (!finalProductRolePairs.has(pairKey(value.product_id, value.role_code))) {
      errors.push(
        `Slot-option upsert ${displayPair(value.slot_id, value.product_id)} has no final Product_Roles pair for ${value.role_code}.`,
      )
    }
    if (
      value.visible_by_default !== false ||
      value.selectable !== true ||
      value.review_status !== 'reviewed' ||
      value.slotting_scope !== 'standard'
    ) {
      errors.push(
        `Slot-option upsert ${displayPair(value.slot_id, value.product_id)} must be reviewed, selectable, non-default, and standard scope.`,
      )
    }
  }

  const compatibilityIds = implementation.compatibilityAdditions.map(
    (addition) => addition.value.rule_id,
  )
  const duplicateCompatibilityIds = duplicateValues(compatibilityIds)
  if (duplicateCompatibilityIds.length > 0) {
    errors.push(
      `compatibilityAdditions contains duplicate rule IDs: ${duplicateCompatibilityIds.join(', ')}.`,
    )
  }
  for (const addition of implementation.compatibilityAdditions) {
    const value = addition.value
    if (!addition.reviewKey?.trim()) {
      errors.push(`Compatibility addition ${value.rule_id} requires reviewKey.`)
    }
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
      value.resolved_target_type !== 'product' ||
      value.resolved_target_id !== value.target_product_or_role ||
      !productById.has(value.resolved_target_id)
    ) {
      errors.push(
        `Compatibility addition ${value.rule_id} must resolve its target to an existing product.`,
      )
    }
    if (!sourceById.has(value.source_id)) {
      errors.push(
        `Compatibility addition ${value.rule_id} references unknown source ${value.source_id}.`,
      )
    }
  }

  const referencedReviewKeys = new Set([
    ...implementation.productRoleMutations.map((item) => item.reviewKey),
    ...implementation.productRoleAdditions.map((item) => item.reviewKey),
    ...implementation.slotOptionRemovals.map((item) => item.reviewKey),
    ...implementation.expectedAbsentSlotOptions.map((item) => item.reviewKey),
    ...implementation.slotOptionUpserts.map((item) => item.reviewKey),
    ...implementation.compatibilityAdditions.map((item) => item.reviewKey),
  ])

  if (!decisionArtifact) {
    errors.push('The normalized completed external-review decision artifact is missing.')
  } else {
    if (decisionArtifact.formatVersion !== 1) {
      errors.push(
        `Unsupported external-review decision artifact format ${String(decisionArtifact.formatVersion)}; expected 1.`,
      )
    }
    if (!decisionArtifact.readyToApply) {
      errors.push(
        'The normalized completed external-review decision artifact is not ready to apply.',
      )
    }
    if (decisionArtifact.reviewId !== implementation.reviewId) {
      errors.push(
        `Decision artifact review ${decisionArtifact.reviewId} does not match implementation review ${implementation.reviewId}.`,
      )
    }
    if (decisionArtifact.normalizedCorrectionsSha256 !== implementation.proposalCorrectionsSha256) {
      errors.push(
        'Decision artifact corrections SHA-256 does not match the proposal implementation guard.',
      )
    }
    if (decisionArtifact.sourceWorkbook.fileName !== implementation.sourceWorkbook) {
      errors.push(
        `Decision artifact workbook ${decisionArtifact.sourceWorkbook.fileName} does not match implementation source ${implementation.sourceWorkbook}.`,
      )
    }
    if (decisionArtifact.sourceWorkbook.sha256 !== implementation.sourceWorkbookSha256) {
      errors.push(
        'Decision artifact workbook SHA-256 does not match the completed implementation guard.',
      )
    }
    if (
      decisionArtifact.summary.productReviewRows !== 63 ||
      decisionArtifact.summary.exactSlotReviewRows !== 34 ||
      decisionArtifact.summary.normalizedDecisions !== 97 ||
      decisionArtifact.summary.validDecisions !== 97 ||
      decisionArtifact.summary.invalidDecisions !== 0 ||
      decisionArtifact.summary.errors !== 0
    ) {
      errors.push(
        'Decision artifact must contain exactly 63 valid product decisions and 34 valid exact-slot decisions with no errors.',
      )
    }

    const decisionsByKey = new Map<string, (typeof decisionArtifact.decisions)[number]>()
    for (const decision of decisionArtifact.decisions) {
      if (decisionsByKey.has(decision.reviewKey)) {
        errors.push(`Decision artifact repeats review key ${decision.reviewKey}.`)
      }
      decisionsByKey.set(decision.reviewKey, decision)
      if (!decision.valid || !decision.reviewerDecision) {
        errors.push(`Decision artifact review key ${decision.reviewKey} is not valid.`)
      }
    }

    const implementationRequiredKeys = new Set(
      decisionArtifact.decisions
        .filter((decision) => decision.reviewerDecision !== 'approve_as_proposed')
        .map((decision) => decision.reviewKey),
    )
    const missingImplementations = [...implementationRequiredKeys].filter(
      (reviewKey) => !referencedReviewKeys.has(reviewKey),
    )
    const unexpectedImplementations = [...referencedReviewKeys].filter(
      (reviewKey) => !implementationRequiredKeys.has(reviewKey),
    )
    if (missingImplementations.length > 0) {
      errors.push(
        `Completed implementation does not cover review decisions: ${missingImplementations.sort(compareText).join(', ')}.`,
      )
    }
    if (unexpectedImplementations.length > 0) {
      errors.push(
        `Completed implementation references decisions that require no delta: ${unexpectedImplementations.sort(compareText).join(', ')}.`,
      )
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
    Slot_Product_Options: cloneRecords(slotOptions),
    Compatibility: cloneRecords(compatibility),
  }

  working.Roles.push(...implementation.rolesToAdd.map((role) => ({ ...role })))

  for (const record of working.Product_Roles) {
    const productId = asString(record, 'product_id')
    const roleCode = asString(record, 'role_code')
    if (!productId || !roleCode) continue
    const mutation = mutationByExpectedPair.get(pairKey(productId, roleCode))
    if (!mutation) continue
    record.role_code = mutation.setRoleCode
    record.role_fit = mutation.setRoleFit
  }
  working.Product_Roles.push(
    ...implementation.productRoleAdditions.map((addition) => ({
      ...addition.value,
    })),
  )

  working.Slot_Product_Options = working.Slot_Product_Options.filter((option) => {
    const slotId = asString(option, 'slot_id')
    const productId = asString(option, 'product_id')
    if (!slotId || !productId) return true
    return !removalPairSet.has(pairKey(slotId, productId))
  })
  working.Slot_Product_Options.push(
    ...implementation.slotOptionUpserts.map((upsert) => ({ ...upsert.value })),
  )
  working.Compatibility.push(
    ...implementation.compatibilityAdditions.map((addition) => ({
      ...addition.value,
    })),
  )

  const postErrors: string[] = []
  const postRoles = buildUniqueIndex(working.Roles, 'role_code', 'Roles', postErrors)
  const postProductRoles = buildUniquePairIndex(
    working.Product_Roles,
    'product_id',
    'role_code',
    'Product_Roles',
    postErrors,
  )
  const postOptions = buildUniquePairIndex(
    working.Slot_Product_Options,
    'slot_id',
    'product_id',
    'Slot_Product_Options',
    postErrors,
  )
  buildUniqueIndex(working.Compatibility, 'rule_id', 'Compatibility', postErrors)

  for (const roleCode of addedRoleCodes) {
    if (!postRoles.has(roleCode)) {
      postErrors.push(`Completed-review role ${roleCode} was not added.`)
    }
  }
  for (const mutation of implementation.productRoleMutations) {
    const finalPair = pairKey(mutation.productId, mutation.setRoleCode)
    const record = postProductRoles.get(finalPair)
    if (!record || asNullableString(record, 'role_fit') !== mutation.setRoleFit) {
      postErrors.push(
        `Completed-review product-role mutation did not produce ${displayPair(mutation.productId, mutation.setRoleCode)} with role_fit ${String(mutation.setRoleFit)}.`,
      )
    }
    if (
      mutation.expectRoleCode !== mutation.setRoleCode &&
      postProductRoles.has(pairKey(mutation.productId, mutation.expectRoleCode))
    ) {
      postErrors.push(
        `Completed-review product-role mutation left obsolete pair ${displayPair(mutation.productId, mutation.expectRoleCode)}.`,
      )
    }
  }
  for (const addition of implementation.productRoleAdditions) {
    if (!postProductRoles.has(pairKey(addition.value.product_id, addition.value.role_code))) {
      postErrors.push(
        `Completed-review product-role addition did not produce ${displayPair(addition.value.product_id, addition.value.role_code)}.`,
      )
    }
  }
  for (const removal of implementation.slotOptionRemovals) {
    if (postOptions.has(pairKey(removal.slotId, removal.productId))) {
      postErrors.push(
        `Completed-review slot-option removal left ${displayPair(removal.slotId, removal.productId)}.`,
      )
    }
  }
  for (const upsert of implementation.slotOptionUpserts) {
    if (postOptions.get(pairKey(upsert.value.slot_id, upsert.value.product_id)) === undefined) {
      postErrors.push(
        `Completed-review slot-option upsert did not produce ${displayPair(upsert.value.slot_id, upsert.value.product_id)}.`,
      )
    }
  }

  if (postErrors.length > 0) {
    report.errors = [...new Set(postErrors)].sort(compareText)
    return report
  }

  normalized.Roles = working.Roles
  normalized.Product_Roles = working.Product_Roles
  normalized.Slot_Product_Options = working.Slot_Product_Options
  normalized.Compatibility = working.Compatibility

  report.applied = true
  report.adds = {
    roles: implementation.rolesToAdd.length,
    product_roles: implementation.productRoleAdditions.length,
    slot_product_options: implementation.slotOptionUpserts.length,
    compatibility_rules: implementation.compatibilityAdditions.length,
  }
  report.removes = {
    slot_product_options: implementation.slotOptionRemovals.length,
  }
  report.updates = {
    product_roles: implementation.productRoleMutations.length,
  }
  report.verified_absent_slot_product_options = implementation.expectedAbsentSlotOptions.length
  report.decision_evidence = {
    referenced_review_keys: referencedReviewKeys.size,
    normalized_decisions: decisionArtifact?.summary.normalizedDecisions ?? 0,
    errors: decisionArtifact?.summary.errors ?? 0,
    warnings: decisionArtifact?.summary.warnings ?? 0,
  }
  report.details = {
    added_roles: addedRoleCodes,
    added_product_roles: implementation.productRoleAdditions.map((addition) =>
      displayPair(addition.value.product_id, addition.value.role_code),
    ),
    updated_product_roles: implementation.productRoleMutations.map(
      (mutation) =>
        `${mutation.productId}: ${mutation.expectRoleCode}/${String(mutation.expectRoleFit)} -> ${mutation.setRoleCode}/${String(mutation.setRoleFit)}`,
    ),
    removed_slot_product_options: implementation.slotOptionRemovals.map((removal) =>
      displayPair(removal.slotId, removal.productId),
    ),
    verified_absent_slot_product_options: implementation.expectedAbsentSlotOptions.map((item) =>
      displayPair(item.slotId, item.productId),
    ),
    added_slot_product_options: implementation.slotOptionUpserts.map((upsert) =>
      displayPair(upsert.value.slot_id, upsert.value.product_id),
    ),
    added_compatibility_rules: compatibilityIds,
  }

  return report
}
