import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  type CatalogRecord,
  type ImportedSheetName,
  type ImportWarning,
  EXPECTED_COUNTS,
  IMPORTED_SHEETS,
  catalogValueAsString,
  collectBrokenReferences,
  findDuplicateValues,
  getStringSet,
  isSubstantialCountDifference,
  loadOoxmlWorkbook,
  normalizeGtin,
  normalizeReleaseState,
  normalizeRequiredness,
  normalizeSelectionMode,
  normalizeSlotOptionVisibility,
  normalizeVerificationGrade,
  normalizeVisibility,
  readTabularSheet,
  sha256File,
  stableSortRecords,
  withoutSourceRow,
} from './catalog-utils'
import { formatJson } from './format-json'
import {
  mergeCatalogAdditions,
  readCatalogAdditions,
  type AdditionsMergeReport,
} from './apply-catalog-additions'
import {
  applyProductOverrides,
  readProductOverrides,
  type OverridesReport,
} from './apply-product-overrides'
import {
  applyExternalReviewRemediation,
  readExternalReviewCorrections,
  type ExternalReviewRemediationReport,
} from './apply-external-review-remediation'
import {
  applyExternalReviewCompletedImplementation,
  readExternalReviewCompletedImplementation,
  readExternalReviewRemediationDecisionArtifact,
  type ExternalReviewCompletedImplementationReport,
} from './apply-external-review-completed-implementation'
import {
  generateSlotOptionProposals,
  type SlotOptionProposalSummary,
} from './derive-slot-option-proposals'

const DEFAULT_WORKBOOK =
  'Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx'
const DEFAULT_OUTPUT_DIRECTORY = 'data/ip-preference-cards/generated'

const OUTPUT_FILES: Record<ImportedSheetName, string> = {
  Products: 'catalog-products.json',
  Product_Roles: 'product-roles.json',
  Procedures: 'procedures.json',
  Procedure_Slots: 'procedure-slots.json',
  Slot_Product_Options: 'slot-product-options.json',
  Roles: 'roles.json',
  Compatibility: 'compatibility-raw.json',
  Manufacturers: 'manufacturers.json',
  Sources: 'sources.json',
  Product_Sources: 'product-sources.json',
  Hospital_Formulary: 'hospital-formulary-staging.json',
  Modifier_Catalog: 'modifier-catalog.json',
  Product_Verification_Backlog: 'verification-backlog.json',
}

const ID_COLUMNS: Partial<Record<ImportedSheetName, string>> = {
  Products: 'product_id',
  Product_Roles: 'product_id',
  Procedures: 'procedure_code',
  Procedure_Slots: 'slot_id',
  Slot_Product_Options: 'slot_id',
  Roles: 'role_code',
  Compatibility: 'rule_id',
  Manufacturers: 'manufacturer_id',
  Sources: 'source_id',
  Product_Sources: 'product_id',
  Hospital_Formulary: 'formulary_id',
  Modifier_Catalog: 'modifier_code',
  Product_Verification_Backlog: 'product_id',
}

const UNIQUE_KEYS: Partial<Record<ImportedSheetName, string[]>> = {
  Products: ['product_id'],
  Product_Roles: ['product_id', 'role_code'],
  Procedures: ['procedure_code'],
  Procedure_Slots: ['slot_id'],
  Slot_Product_Options: ['slot_id', 'product_id'],
  Roles: ['role_code'],
  Compatibility: ['rule_id'],
  Manufacturers: ['manufacturer_id'],
  Sources: ['source_id'],
  Product_Sources: ['product_id', 'source_id'],
  Hospital_Formulary: ['formulary_id'],
  Modifier_Catalog: ['modifier_code'],
  Product_Verification_Backlog: ['product_id'],
}

interface ImportReport {
  format_version: 1
  catalog_additions?: AdditionsMergeReport
  product_overrides?: OverridesReport
  external_review_remediation?: ExternalReviewRemediationReport
  external_review_completed_implementation?: ExternalReviewCompletedImplementationReport
  slot_option_proposals?: SlotOptionProposalSummary
  source_file: string
  workbook_sha256: string
  header_row: 4
  data_start_row: 5
  counts: Record<string, number>
  count_warnings: ImportWarning[]
  duplicate_ids: Record<string, { value: string; rows: number[] }[]>
  foreign_key_errors: {
    sheet: string
    column: string
    target: string
    rows: { row: number; value: string }[]
  }[]
  vocabulary_warnings: ImportWarning[]
  gtin: {
    non_null: number
    padded_from_13_digits: number
    valid_14_digits: number
    invalid: { product_id: string | null; row: number; raw: string }[]
  }
  compatibility_resolution: {
    source: { product: number; role: number; unresolved: number }
    target: { product: number; role: number; unresolved: number }
  }
  visibility_conflicts: {
    slot_id: string | null
    product_id: string | null
    slot_visible_by_default: boolean
    product_visibility: 'prototype_visible' | 'hidden'
  }[]
  malformed_spec_json: { product_id: string | null; row: number; value: string }[]
  warnings: ImportWarning[]
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function findDuplicateCompositeValues(
  records: CatalogRecord[],
  keys: string[],
): { value: string; rows: number[] }[] {
  if (keys.length === 1) return findDuplicateValues(records, keys[0])

  const rowsByValue = new Map<string, number[]>()
  for (const record of records) {
    const parts = keys.map((key) => catalogValueAsString(record, key))
    if (parts.some((part) => !part)) continue
    const value = parts.join(' + ')
    rowsByValue.set(value, [...(rowsByValue.get(value) ?? []), Number(record._source_row)])
  }
  return [...rowsByValue.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([value, rows]) => ({ value, rows }))
}

function addVocabularyWarning(
  warnings: ImportWarning[],
  sheet: string,
  row: number,
  field: string,
  value: unknown,
) {
  warnings.push({
    sheet,
    row,
    code: 'unmapped_vocabulary',
    value: value === null || value === undefined ? '' : String(value),
    message: `${field} contains an unmapped value and was normalized fail-closed.`,
  })
}

function normalizeProducts(records: CatalogRecord[], report: ImportReport): CatalogRecord[] {
  return records.map((record) => {
    const row = Number(record._source_row)
    const visibilityState = normalizeVisibility(record.live_dropdown_status)
    if (
      record.live_dropdown_status !== null &&
      record.live_dropdown_status !== 'Prototype visible - reverify before production' &&
      !String(record.live_dropdown_status).startsWith('Hidden')
    ) {
      addVocabularyWarning(
        report.vocabulary_warnings,
        'Products',
        row,
        'live_dropdown_status',
        record.live_dropdown_status,
      )
    }

    const gtin = normalizeGtin(record.gtin)
    if (gtin.raw) {
      report.gtin.non_null += 1
      if (/^\d{13}$/.test(gtin.raw)) report.gtin.padded_from_13_digits += 1
      if (/^\d{14}$/.test(gtin.normalized ?? '')) report.gtin.valid_14_digits += 1
      if (gtin.warning) {
        report.gtin.invalid.push({
          product_id: catalogValueAsString(record, 'product_id'),
          row,
          raw: gtin.raw,
        })
      }
    }

    const specJsonRaw = catalogValueAsString(record, 'spec_json')
    let specJson: unknown = null
    if (specJsonRaw) {
      try {
        specJson = JSON.parse(specJsonRaw) as unknown
      } catch {
        report.malformed_spec_json.push({
          product_id: catalogValueAsString(record, 'product_id'),
          row,
          value: specJsonRaw,
        })
      }
    }

    return {
      ...withoutSourceRow(record),
      gtin_raw: gtin.raw,
      gtin: gtin.normalized,
      spec_json_raw: specJsonRaw,
      spec_json: specJson,
      visibility_state: visibilityState,
      verification_grade: normalizeVerificationGrade(record.verification_status),
    }
  })
}

function normalizeProcedureSlots(records: CatalogRecord[], report: ImportReport): CatalogRecord[] {
  return records.map((record) => {
    const row = Number(record._source_row)
    const selectionMode = normalizeSelectionMode(record.selection_mode)
    const requiredness = normalizeRequiredness(record.requiredness)
    if (selectionMode === 'unknown') {
      addVocabularyWarning(
        report.vocabulary_warnings,
        'Procedure_Slots',
        row,
        'selection_mode',
        record.selection_mode,
      )
    }
    if (requiredness === 'unknown') {
      addVocabularyWarning(
        report.vocabulary_warnings,
        'Procedure_Slots',
        row,
        'requiredness',
        record.requiredness,
      )
    }

    return {
      ...withoutSourceRow(record),
      selection_mode_raw: record.selection_mode,
      selection_mode: selectionMode,
      requiredness_raw: record.requiredness,
      requiredness,
    }
  })
}

function normalizeCompatibility(
  records: CatalogRecord[],
  productIds: Set<string>,
  roleCodes: Set<string>,
  report: ImportReport,
): CatalogRecord[] {
  return records.map((record) => {
    const source = catalogValueAsString(record, 'source_product_or_role')
    const target = catalogValueAsString(record, 'target_product_or_role')

    const sourceType = source
      ? productIds.has(source)
        ? 'product'
        : roleCodes.has(source)
          ? 'role'
          : null
      : null
    const targetType = target
      ? productIds.has(target)
        ? 'product'
        : roleCodes.has(target)
          ? 'role'
          : null
      : null

    if (sourceType === 'product') report.compatibility_resolution.source.product += 1
    else if (sourceType === 'role') report.compatibility_resolution.source.role += 1
    else report.compatibility_resolution.source.unresolved += 1

    if (targetType === 'product') report.compatibility_resolution.target.product += 1
    else if (targetType === 'role') report.compatibility_resolution.target.role += 1
    else report.compatibility_resolution.target.unresolved += 1

    return {
      ...withoutSourceRow(record),
      resolved_source_type: sourceType,
      resolved_source_id: sourceType ? source : null,
      resolved_target_type: targetType,
      resolved_target_id: targetType ? target : null,
      verification_grade: normalizeVerificationGrade(record.verification_status),
    }
  })
}

function normalizeModifiers(records: CatalogRecord[], report: ImportReport): CatalogRecord[] {
  return records.map((record) => {
    const releaseState = normalizeReleaseState(record.release)
    if (releaseState === 'unknown') {
      addVocabularyWarning(
        report.vocabulary_warnings,
        'Modifier_Catalog',
        Number(record._source_row),
        'release',
        record.release,
      )
    }
    return {
      ...withoutSourceRow(record),
      release_raw: record.release,
      release_state: releaseState,
    }
  })
}

function normalizeGeneric(records: CatalogRecord[]): CatalogRecord[] {
  return records.map(withoutSourceRow)
}

function strictForeignKeyChecks(
  raw: Record<ImportedSheetName, CatalogRecord[]>,
  report: ImportReport,
) {
  const productIds = getStringSet(raw.Products, 'product_id')
  const roleCodes = getStringSet(raw.Roles, 'role_code')
  const procedureCodes = getStringSet(raw.Procedures, 'procedure_code')
  const slotIds = getStringSet(raw.Procedure_Slots, 'slot_id')
  const manufacturerIds = getStringSet(raw.Manufacturers, 'manufacturer_id')
  const sourceIds = getStringSet(raw.Sources, 'source_id')

  const checks: {
    sheet: ImportedSheetName
    column: string
    targets: Set<string>
    target: string
  }[] = [
    {
      sheet: 'Product_Roles',
      column: 'product_id',
      targets: productIds,
      target: 'Products.product_id',
    },
    {
      sheet: 'Product_Roles',
      column: 'role_code',
      targets: roleCodes,
      target: 'Roles.role_code',
    },
    {
      sheet: 'Procedure_Slots',
      column: 'procedure_code',
      targets: procedureCodes,
      target: 'Procedures.procedure_code',
    },
    {
      sheet: 'Procedure_Slots',
      column: 'role_code',
      targets: roleCodes,
      target: 'Roles.role_code',
    },
    {
      sheet: 'Slot_Product_Options',
      column: 'slot_id',
      targets: slotIds,
      target: 'Procedure_Slots.slot_id',
    },
    {
      sheet: 'Slot_Product_Options',
      column: 'product_id',
      targets: productIds,
      target: 'Products.product_id',
    },
    {
      sheet: 'Products',
      column: 'manufacturer_id',
      targets: manufacturerIds,
      target: 'Manufacturers.manufacturer_id',
    },
    {
      sheet: 'Products',
      column: 'primary_source_id',
      targets: sourceIds,
      target: 'Sources.source_id',
    },
    {
      sheet: 'Product_Sources',
      column: 'product_id',
      targets: productIds,
      target: 'Products.product_id',
    },
    {
      sheet: 'Product_Sources',
      column: 'source_id',
      targets: sourceIds,
      target: 'Sources.source_id',
    },
  ]

  for (const check of checks) {
    const rows = collectBrokenReferences(raw[check.sheet], check.column, check.targets)
    if (rows.length > 0) {
      report.foreign_key_errors.push({
        sheet: check.sheet,
        column: check.column,
        target: check.target,
        rows,
      })
    }
  }
}

async function writeJson(outputDirectory: string, filename: string, value: unknown) {
  await writeFile(path.join(outputDirectory, filename), await formatJson(value))
}

export interface ImportCatalogOptions {
  workbookPath?: string
  outputDirectory?: string
  /**
   * Materialize the normalized upstream catalog without the governed remediation overlay.
   * This is used by the overlay's old-state guard tests; production imports must use the
   * default so a missing or stale corrections artifact fails closed.
   */
  applyExternalReview?: boolean
  /**
   * Apply the normalized completed-review decisions after the proposal overlay.
   * Tests may disable this while retaining the proposal overlay as their guarded baseline.
   */
  applyCompletedExternalReview?: boolean
}

export async function importCatalog(options?: ImportCatalogOptions) {
  const workbookPath = path.resolve(
    process.cwd(),
    options?.workbookPath ?? process.env.IP_CARDS_WORKBOOK ?? DEFAULT_WORKBOOK,
  )
  const outputDirectory = path.resolve(
    process.cwd(),
    options?.outputDirectory ?? process.env.IP_CARDS_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIRECTORY,
  )

  const workbook = await loadOoxmlWorkbook(workbookPath)

  const report: ImportReport = {
    format_version: 1,
    source_file: path.relative(process.cwd(), workbookPath),
    workbook_sha256: await sha256File(workbookPath),
    header_row: 4,
    data_start_row: 5,
    counts: {},
    count_warnings: [],
    duplicate_ids: {},
    foreign_key_errors: [],
    vocabulary_warnings: [],
    gtin: {
      non_null: 0,
      padded_from_13_digits: 0,
      valid_14_digits: 0,
      invalid: [],
    },
    compatibility_resolution: {
      source: { product: 0, role: 0, unresolved: 0 },
      target: { product: 0, role: 0, unresolved: 0 },
    },
    visibility_conflicts: [],
    malformed_spec_json: [],
    warnings: [],
  }

  const raw = {} as Record<ImportedSheetName, CatalogRecord[]>
  for (const sheetName of IMPORTED_SHEETS) {
    const result = readTabularSheet(workbook, sheetName)
    raw[sheetName] = result.records
    report.warnings.push(...result.warnings)
    report.counts[sheetName] = result.records.length

    const expected = EXPECTED_COUNTS[sheetName]
    if (expected !== undefined && isSubstantialCountDifference(result.records.length, expected)) {
      report.count_warnings.push({
        sheet: sheetName,
        code: 'substantial_count_difference',
        message: `Expected approximately ${expected} rows but found ${result.records.length}.`,
      })
    }

    const uniqueKeys = UNIQUE_KEYS[sheetName]
    if (uniqueKeys) {
      const duplicates = findDuplicateCompositeValues(result.records, uniqueKeys)
      if (duplicates.length > 0) report.duplicate_ids[sheetName] = duplicates
    }
  }

  strictForeignKeyChecks(raw, report)

  const productIds = getStringSet(raw.Products, 'product_id')
  const roleCodes = getStringSet(raw.Roles, 'role_code')
  const modifierCodes = getStringSet(raw.Modifier_Catalog, 'modifier_code')
  const modifierRoleCollisions = [...modifierCodes].filter((code) => roleCodes.has(code))
  if (modifierRoleCollisions.length > 0) {
    report.warnings.push({
      sheet: 'Modifier_Catalog',
      code: 'modifier_role_code_collision',
      message: `Modifier codes collide with role codes: ${modifierRoleCollisions.join(', ')}`,
    })
  }

  const products = normalizeProducts(raw.Products, report)
  const productById = new Map(
    products.map((product) => [catalogValueAsString(product, 'product_id'), product]),
  )

  const slotProductOptions = raw.Slot_Product_Options.map((record) => {
    const product = productById.get(catalogValueAsString(record, 'product_id'))
    const normalizedVisibility = normalizeSlotOptionVisibility(
      product?.visibility_state,
      asBoolean(record.visible_by_default),
      record.selectable === null || record.selectable === undefined
        ? asBoolean(record.visible_by_default)
        : asBoolean(record.selectable),
    )
    if (normalizedVisibility.authoredVisibilityConflict) {
      report.visibility_conflicts.push({
        slot_id: catalogValueAsString(record, 'slot_id'),
        product_id: catalogValueAsString(record, 'product_id'),
        slot_visible_by_default: asBoolean(record.visible_by_default),
        product_visibility: normalizedVisibility.productVisibility,
      })
    }
    return {
      ...withoutSourceRow(record),
      product_visibility: normalizedVisibility.productVisibility,
      visible_by_default: normalizedVisibility.visibleByDefault,
      selectable: normalizedVisibility.selectable,
    }
  })

  const normalized: Record<ImportedSheetName, CatalogRecord[]> = {
    ...Object.fromEntries(IMPORTED_SHEETS.map((sheetName) => [sheetName, []])),
    Products: products,
    Product_Roles: normalizeGeneric(raw.Product_Roles),
    Procedures: normalizeGeneric(raw.Procedures),
    Procedure_Slots: normalizeProcedureSlots(raw.Procedure_Slots, report),
    Slot_Product_Options: slotProductOptions,
    Roles: normalizeGeneric(raw.Roles),
    Compatibility: normalizeCompatibility(raw.Compatibility, productIds, roleCodes, report),
    Manufacturers: normalizeGeneric(raw.Manufacturers),
    Sources: normalizeGeneric(raw.Sources),
    Product_Sources: normalizeGeneric(raw.Product_Sources),
    Hospital_Formulary: normalizeGeneric(raw.Hospital_Formulary),
    Modifier_Catalog: normalizeModifiers(raw.Modifier_Catalog, report),
    Product_Verification_Backlog: normalizeGeneric(raw.Product_Verification_Backlog),
  } as Record<ImportedSheetName, CatalogRecord[]>

  // Corrections to workbook rows (see apply-product-overrides.ts). Applied before the
  // additions merge so an override can never silently target an added product.
  const overrides = await readProductOverrides()
  const overridesReport = applyProductOverrides(normalized.Products, overrides)
  report.product_overrides = overridesReport

  // Curated additions the workbook does not carry (see apply-catalog-additions.ts).
  const additions = await readCatalogAdditions()
  const additionsReport = mergeCatalogAdditions(
    normalized as unknown as Record<string, CatalogRecord[]>,
    additions,
  )
  report.catalog_additions = additionsReport

  // Versioned, externally reviewed semantic corrections are applied after source-preserving
  // overrides and additions, and before generated JSON or nonselectable proposals are written.
  // The applicator validates exact pre-remediation cohorts and mutates transactionally.
  let externalReviewRemediationReport: ExternalReviewRemediationReport | undefined
  let externalReviewCompletedImplementationReport:
    | ExternalReviewCompletedImplementationReport
    | undefined
  if (options?.applyExternalReview !== false) {
    const externalReviewCorrections = await readExternalReviewCorrections()
    externalReviewRemediationReport = applyExternalReviewRemediation(
      normalized as unknown as Record<string, CatalogRecord[]>,
      externalReviewCorrections,
    )
    if (!externalReviewCorrections) {
      externalReviewRemediationReport.errors.push(
        'The governed external-review corrections file is missing.',
      )
    }
    report.external_review_remediation = externalReviewRemediationReport

    if (options?.applyCompletedExternalReview !== false) {
      const [completedImplementation, completedDecisionArtifact] = await Promise.all([
        readExternalReviewCompletedImplementation(),
        readExternalReviewRemediationDecisionArtifact(),
      ])
      externalReviewCompletedImplementationReport = applyExternalReviewCompletedImplementation(
        normalized as unknown as Record<string, CatalogRecord[]>,
        completedImplementation,
        completedDecisionArtifact,
      )
      if (!completedImplementation) {
        externalReviewCompletedImplementationReport.errors.push(
          'The governed completed external-review implementation file is missing.',
        )
      }
      if (!completedDecisionArtifact) {
        externalReviewCompletedImplementationReport.errors.push(
          'The normalized completed external-review decision artifact is missing.',
        )
      }
      report.external_review_completed_implementation = externalReviewCompletedImplementationReport
    }
  }

  await mkdir(outputDirectory, { recursive: true })
  for (const sheetName of IMPORTED_SHEETS) {
    const idColumn = ID_COLUMNS[sheetName]
    const records = idColumn
      ? stableSortRecords(normalized[sheetName], idColumn)
      : normalized[sheetName]
    await writeJson(outputDirectory, OUTPUT_FILES[sheetName], records)
  }
  const proposalArtifact = await generateSlotOptionProposals({
    generatedDirectory: outputDirectory,
  })
  report.slot_option_proposals = proposalArtifact.summary
  await writeJson(outputDirectory, 'import-report.json', report)

  const hardFailures = [
    ...Object.entries(report.duplicate_ids).flatMap(([sheet, duplicates]) =>
      duplicates.map((duplicate) => `${sheet}: duplicate ${duplicate.value}`),
    ),
    ...report.foreign_key_errors.map(
      (error) => `${error.sheet}.${error.column}: ${error.rows.length} broken references`,
    ),
    ...(modifierRoleCollisions.length > 0
      ? [`Modifier/role code collisions: ${modifierRoleCollisions.join(', ')}`]
      : []),
    ...additionsReport.errors.map((error) => `catalog additions: ${error}`),
    ...overridesReport.errors.map((error) => `product overrides: ${error}`),
    ...(externalReviewRemediationReport?.errors ?? []).map(
      (error) => `external review remediation: ${error}`,
    ),
    ...(externalReviewCompletedImplementationReport?.errors ?? []).map(
      (error) => `completed external review implementation: ${error}`,
    ),
  ]

  if (hardFailures.length > 0) {
    throw new Error(`Catalog import failed strict validation:\n${hardFailures.join('\n')}`)
  }

  return { normalized, report, outputDirectory }
}

if (process.argv[1] && /import-catalog\.(?:ts|js)$/.test(process.argv[1])) {
  importCatalog()
    .then(({ report, outputDirectory }) => {
      console.log(`IP preference-card catalog imported to ${outputDirectory}`)
      console.log(JSON.stringify(report.counts, null, 2))
      console.log(
        `GTINs: ${report.gtin.valid_14_digits}/${report.gtin.non_null} normalize to 14 digits; ${report.gtin.invalid.length} require review.`,
      )
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
