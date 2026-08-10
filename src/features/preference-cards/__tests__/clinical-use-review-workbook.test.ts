import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { TextDecoder as NodeTextDecoder } from 'node:util'

import JSZip from 'jszip'

import {
  getClinicalUseReviewArtifactManifest,
  type ClinicalUseReviewData,
} from '@/features/preference-cards/data/clinical-use-review.server'
import {
  CLINICAL_USE_CATALOG_PRODUCT_COLUMNS,
  CLINICAL_USE_CURRENT_SLOT_COLUMNS,
  CLINICAL_USE_PRODUCT_ROLE_COLUMNS,
  CLINICAL_USE_PRODUCT_ROLE_DECISIONS,
  CLINICAL_USE_REVIEW_SHEETS,
  CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
  CLINICAL_USE_SLOT_DECISIONS,
  type ClinicalUseCatalogProductWorkbookRow,
  type ClinicalUseCurrentSlotWorkbookRow,
  type ClinicalUseProductRoleWorkbookRow,
  type ClinicalUseReviewColumn,
  type ClinicalUseReviewWorkbookMetadata,
} from '@/features/preference-cards/excel/clinical-use-review-contract'
import {
  createClinicalUseReviewNormalizedExport,
  serializeClinicalUseReviewJson,
} from '@/features/preference-cards/excel/clinical-use-review-serialization'
import {
  buildClinicalUseReviewWorkbookBytes,
  createClinicalUseReviewWorkbook,
  importClinicalUseReviewWorkbook,
} from '@/features/preference-cards/excel/clinical-use-review-workbook.server'
import { parseOoxmlWorkbookBytes } from '@/features/preference-cards/excel/ooxml-reader.server'

Object.defineProperty(globalThis, 'TextDecoder', {
  configurable: true,
  value: NodeTextDecoder,
})

const MANIFEST_HASH = 'a'.repeat(64)
const OTHER_MANIFEST_HASH = 'b'.repeat(64)
const EXPORTED_AT = '2026-07-29T12:00:00.000Z'
const IMPORTED_AT = '2026-07-29T13:00:00.000Z'
const ZIP_ENTRY_DATE = new Date(1980, 0, 1, 0, 0, 0)
const PRODUCT_ROLE_SHEET_PATH = 'xl/worksheets/sheet3.xml'
const CURRENT_SLOT_SHEET_PATH = 'xl/worksheets/sheet4.xml'

function evidenceFields(index: number) {
  return {
    manufacturer: `Fixture Medical ${index}`,
    productName: `Fixture product ${index}`,
    catalogNumber: index === 1 ? '000123' : `CAT-${index}`,
    deviceIdentifier: `0000000000000${index}`,
    verificationGrade: 'verified_source',
    verificationStatus: 'verified',
    distributionStatus: 'in_distribution',
    visibilityState: 'prototype_visible',
    evidenceSignal: 'strong_match',
    sourceId: `SRC-${index}`,
    sourceLocation: `fixture-${index}.pdf, page ${index}`,
    evidencePageUrl: `https://example.test/en/admin/preference-cards/catalog-qa/PRD-TEST-${index}`,
  }
}

function catalogProduct(index: number): ClinicalUseCatalogProductWorkbookRow {
  return {
    productId: `PRD-TEST-${index}`,
    manufacturerId: `MFR-TEST-${index}`,
    ...evidenceFields(index),
    brandFamily: `Fixture family ${index}`,
    primaryCategory: 'Bronchoscopy',
    subcategory: 'Fixture devices',
    productKind: 'device',
    sizeDisplay: `${index} mm`,
    description: `Fixture product description ${index}`,
    currentRoleCodes: index === 1 ? 'ROLE_A; ROLE_B' : 'ROLE_B',
    currentRoleNames: index === 1 ? 'Role A; Role B' : 'Role B',
    currentRoleCount: index === 1 ? 2 : 1,
    canonicalSlotCount: 1,
  }
}

function reviewerFields() {
  return {
    decision: '',
    rationale: '',
    evidenceNeeded: '',
    reviewerName: '',
    reviewerConfidence: '',
    reviewDate: '',
    followUpNotes: '',
    readyForSecondReview: '',
    secondReviewer: '',
    secondReviewComments: '',
  }
}

function productRole(index: number, roleCode: string): ClinicalUseProductRoleWorkbookRow {
  const productId = `PRD-TEST-${index}`
  return {
    reviewKey: `product_role:${productId}:${roleCode}`,
    productId,
    ...evidenceFields(index),
    primaryCategory: 'Bronchoscopy',
    subcategory: 'Fixture devices',
    roleCode,
    roleName: roleCode === 'ROLE_A' ? 'Role A' : 'Role B',
    roleCategory: 'Fixture',
    roleDescription: `Definition for ${roleCode}`,
    roleSelectionGuidance: `Select ${roleCode} when appropriate.`,
    roleFit: 'Primary',
    roleNotes: '',
    canonicalSlotCount: 1,
    procedureCodes: 'PROC_A',
    procedureNames: 'Procedure A',
    clinicalUseManifestHash: MANIFEST_HASH,
    suggestedRoleCode: '',
    ...reviewerFields(),
  }
}

function currentSlot(
  index: number,
  slotId: string,
  roleCode: string,
): ClinicalUseCurrentSlotWorkbookRow {
  const productId = `PRD-TEST-${index}`
  return {
    reviewKey: `slot_product:${slotId}:${productId}`,
    slotId,
    procedureCode: slotId === 'SLOT-A' ? 'PROC_A' : 'PROC_B',
    procedureName: slotId === 'SLOT-A' ? 'Procedure A' : 'Procedure B',
    slotLabel: slotId === 'SLOT-A' ? 'Fixture slot A' : 'Fixture slot B',
    requiredness: 'required',
    section: 'Equipment',
    genericRequirement: 'Fixture clinical requirement',
    roleCode,
    roleName: roleCode === 'ROLE_A' ? 'Role A' : 'Role B',
    productId,
    ...evidenceFields(index),
    roleFit: 'Primary',
    eligibilityStatus: 'eligible',
    optionReason: 'authored',
    visibleByDefault: 'Yes',
    selectable: 'Yes',
    clinicalUseManifestHash: MANIFEST_HASH,
    suggestedSlotId: '',
    ...reviewerFields(),
  }
}

function fixtureData(): ClinicalUseReviewData {
  return {
    catalogProducts: [catalogProduct(1), catalogProduct(2)],
    productRoles: [productRole(1, 'ROLE_A'), productRole(1, 'ROLE_B'), productRole(2, 'ROLE_B')],
    currentSlots: [currentSlot(1, 'SLOT-A', 'ROLE_A'), currentSlot(2, 'SLOT-B', 'ROLE_B')],
    counts: { catalogProducts: 2, productRoles: 3, currentSlots: 2 },
    roleOptions: [
      { roleCode: 'ROLE_A', roleName: 'Role A' },
      { roleCode: 'ROLE_B', roleName: 'Role B' },
      { roleCode: 'ROLE_C', roleName: 'Role C' },
    ],
    slotOptions: [
      {
        slotId: 'SLOT-A',
        slotLabel: 'Fixture slot A',
        procedureCode: 'PROC_A',
        procedureName: 'Procedure A',
        roleCode: 'ROLE_A',
      },
      {
        slotId: 'SLOT-B',
        slotLabel: 'Fixture slot B',
        procedureCode: 'PROC_B',
        procedureName: 'Procedure B',
        roleCode: 'ROLE_B',
      },
      {
        slotId: 'SLOT-C',
        slotLabel: 'Fixture slot C',
        procedureCode: 'PROC_B',
        procedureName: 'Procedure B',
        roleCode: 'ROLE_C',
      },
    ],
  }
}

function fixtureMetadata(data = fixtureData()): ClinicalUseReviewWorkbookMetadata {
  return {
    format_version: CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
    exported_at: EXPORTED_AT,
    clinical_use_manifest_sha256: MANIFEST_HASH,
    catalog_products_sha256: '1'.repeat(64),
    product_roles_sha256: '2'.repeat(64),
    roles_sha256: '3'.repeat(64),
    procedures_sha256: '4'.repeat(64),
    procedure_slots_sha256: '5'.repeat(64),
    slot_product_options_sha256: '6'.repeat(64),
    catalog_product_count: String(data.counts.catalogProducts),
    product_role_count: String(data.counts.productRoles),
    current_slot_count: String(data.counts.currentSlots),
    application_base_url: 'https://example.test',
    source_branch: 'codex/preference-cards/clinical-use-review-test',
    source_commit: 'c'.repeat(40),
    locale: 'en',
  }
}

async function fixtureWorkbook() {
  const data = fixtureData()
  const metadata = fixtureMetadata(data)
  return {
    data,
    metadata,
    bytes: await buildClinicalUseReviewWorkbookBytes(data, metadata),
  }
}

function columnName(index: number): string {
  let value = index
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

function cellReference<Row>(
  columns: readonly ClinicalUseReviewColumn<Row>[],
  key: keyof Row,
  rowNumber: number,
): string {
  const index = columns.findIndex((column) => column.key === key)
  if (index < 0) throw new Error(`Unknown fixture workbook key ${String(key)}.`)
  return `${columnName(index + 1)}${rowNumber}`
}

function xmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineStringCell(reference: string, value: string, style = 7): string {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t>${xmlText(value)}</t></is></c>`
}

function formulaStringCell(reference: string, formula: string, value: string): string {
  return `<c r="${reference}" s="7" t="str"><f>${xmlText(formula)}</f><v>${xmlText(value)}</v></c>`
}

function replaceCell(xml: string, reference: string, replacement: string): string {
  const pattern = new RegExp(
    `(?:<c r="${reference}"[^>]*?\\/>|<c r="${reference}"[^>]*>[\\s\\S]*?<\\/c>)`,
  )
  if (!pattern.test(xml)) throw new Error(`Fixture cell ${reference} is missing.`)
  return xml.replace(pattern, replacement)
}

async function rewriteXmlEntry(
  bytes: Uint8Array,
  archivePath: string,
  transform: (xml: string) => string,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes)
  const entry = zip.file(archivePath)
  if (!entry) throw new Error(`Fixture archive entry ${archivePath} is missing.`)
  zip.file(archivePath, transform(await entry.async('string')), {
    date: ZIP_ENTRY_DATE,
    createFolders: false,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  })
}

async function patchCells(
  bytes: Uint8Array,
  archivePath: string,
  replacements: Record<string, string>,
): Promise<Uint8Array> {
  return rewriteXmlEntry(bytes, archivePath, (xml) =>
    Object.entries(replacements).reduce(
      (updated, [reference, replacement]) => replaceCell(updated, reference, replacement),
      xml,
    ),
  )
}

function importOptions(data: ClinicalUseReviewData, currentHash = MANIFEST_HASH) {
  return {
    applicationBaseUrl: 'https://example.test',
    fileName: 'fixture-clinical-use-review.xlsx',
    importedAt: IMPORTED_AT,
    locale: 'en',
    currentClinicalUseManifestSha256: currentHash,
    currentData: data,
  }
}

describe('full-catalog clinical-use review workbook export', () => {
  it('builds seven protected, validated, filtered, macro-free sheets with unique tables', async () => {
    const { bytes } = await fixtureWorkbook()
    const parsed = await parseOoxmlWorkbookBytes(bytes)
    expect(parsed.sheetNames).toEqual(CLINICAL_USE_REVIEW_SHEETS)
    expect(parsed.sheets.get('Catalog Products')?.maxRow).toBe(3)
    expect(parsed.sheets.get('Product Role Review')?.maxRow).toBe(4)
    expect(parsed.sheets.get('Current Slot Review')?.maxRow).toBe(3)

    const catalogNumberColumn =
      CLINICAL_USE_CATALOG_PRODUCT_COLUMNS.findIndex((column) => column.key === 'catalogNumber') + 1
    expect(parsed.sheets.get('Catalog Products')?.rows.get(2)?.get(catalogNumberColumn)).toEqual(
      expect.objectContaining({ type: 'inlineStr', value: '000123' }),
    )

    const zip = await JSZip.loadAsync(bytes)
    expect(zip.file('xl/tables/table1.xml')).not.toBeNull()
    expect(zip.file('xl/tables/table2.xml')).not.toBeNull()
    expect(zip.file('xl/tables/table3.xml')).not.toBeNull()
    const tableNames = await Promise.all(
      [1, 2, 3].map((index) => zip.file(`xl/tables/table${index}.xml`)!.async('string')),
    )
    expect(tableNames.join('\n')).toContain('CatalogProductsTable')
    expect(tableNames.join('\n')).toContain('ProductRoleReviewTable')
    expect(tableNames.join('\n')).toContain('CurrentSlotReviewTable')
    expect(new Set(tableNames.map((xml) => xml.match(/ id="(\d+)"/)?.[1])).size).toBe(3)

    for (const worksheetPath of [
      'xl/worksheets/sheet2.xml',
      PRODUCT_ROLE_SHEET_PATH,
      CURRENT_SLOT_SHEET_PATH,
    ]) {
      const xml = await zip.file(worksheetPath)!.async('string')
      expect(xml).toContain('<sheetProtection ')
      expect(xml).toMatch(/<autoFilter ref="A1:[A-Z]+\d+"\/>/)
      expect(xml).toContain('<tableParts count="1">')
      const order = [
        xml.indexOf('<pageMargins '),
        xml.indexOf('<pageSetup '),
        xml.indexOf('<ignoredErrors>'),
        xml.indexOf('<tableParts '),
      ]
      expect(order).not.toContain(-1)
      expect(order).toEqual([...order].sort((left, right) => left - right))
    }
    const roleXml = await zip.file(PRODUCT_ROLE_SHEET_PATH)!.async('string')
    const slotXml = await zip.file(CURRENT_SLOT_SHEET_PATH)!.async('string')
    expect(roleXml).toContain('<dataValidations count="5">')
    expect(roleXml).toContain('<formula1>ProductRoleDecisionOptions</formula1>')
    expect(roleXml).toContain('<formula1>RoleCodeOptions</formula1>')
    expect(slotXml).toContain('<formula1>SlotDecisionOptions</formula1>')
    expect(slotXml).toContain('<formula1>SlotIdOptions</formula1>')
    expect(await zip.file('xl/styles.xml')!.async('string')).toContain('<protection locked="0"/>')
    expect(
      parsed.archiveEntryNames.some((name) => /vbaProject|externalLinks|\.bin$/i.test(name)),
    ).toBe(false)
  })

  it('is byte-deterministic for fixed data and metadata', async () => {
    const data = fixtureData()
    const metadata = fixtureMetadata(data)
    const first = await buildClinicalUseReviewWorkbookBytes(data, metadata)
    const second = await buildClinicalUseReviewWorkbookBytes(data, metadata)
    expect(second).toEqual(first)
  })

  it('exports the bounded real catalog counts and exact artifact hashes', async () => {
    const canonicalPaths = [
      'data/ip-preference-cards/generated/catalog-products.json',
      'data/ip-preference-cards/generated/product-roles.json',
      'data/ip-preference-cards/generated/slot-product-options.json',
    ]
    const before = await Promise.all(canonicalPaths.map((filename) => readFile(filename)))
    const manifest = await getClinicalUseReviewArtifactManifest()
    const workbook = await createClinicalUseReviewWorkbook(
      { locale: 'en' },
      'https://example.test',
      EXPORTED_AT,
      {
        manifest,
        clinicalUseManifestSha256: manifest.clinicalUseManifestSha256,
        sourceBranch: 'codex/preference-cards/catalog-verification-workflow',
        sourceCommit: 'c'.repeat(40),
      },
    )
    expect(workbook.counts).toEqual({
      // taxonomy v2 grew the catalog 1_474 -> 1_532 and product-role rows 1_567 -> 1_622;
      // slot-product options were only rewritten in place by the role renames, so they hold.
      catalogProducts: 1_532,
      productRoles: 1_622,
      currentSlots: 2_035,
    })
    const parsed = await parseOoxmlWorkbookBytes(workbook.bytes)
    // Each sheet is its record count plus the header row.
    expect(parsed.sheets.get('Catalog Products')?.maxRow).toBe(1_533)
    expect(parsed.sheets.get('Product Role Review')?.maxRow).toBe(1_623)
    expect(parsed.sheets.get('Current Slot Review')?.maxRow).toBe(2_036)
    expect(workbook.metadata.clinical_use_manifest_sha256).toBe(manifest.clinicalUseManifestSha256)
    expect(await Promise.all(canonicalPaths.map((filename) => readFile(filename)))).toEqual(before)
  })
})

describe('full-catalog clinical-use review workbook import', () => {
  it('normalizes completed role and slot recommendations using authoritative identifiers', async () => {
    const { bytes, data } = await fixtureWorkbook()
    const roleDecision = cellReference(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'decision', 2)
    const suggestedRole = cellReference(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'suggestedRoleCode', 2)
    const roleRationale = cellReference(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'rationale', 2)
    const slotDecision = cellReference(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'decision', 2)
    const suggestedSlot = cellReference(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'suggestedSlotId', 2)
    const slotRationale = cellReference(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'rationale', 2)
    const rolePatched = await patchCells(bytes, PRODUCT_ROLE_SHEET_PATH, {
      [roleDecision]: inlineStringCell(roleDecision, CLINICAL_USE_PRODUCT_ROLE_DECISIONS[2].label),
      [suggestedRole]: inlineStringCell(suggestedRole, 'ROLE_C'),
      [roleRationale]: inlineStringCell(
        roleRationale,
        'The current clinical classification is incorrect.',
      ),
    })
    const completed = await patchCells(rolePatched, CURRENT_SLOT_SHEET_PATH, {
      [slotDecision]: inlineStringCell(slotDecision, CLINICAL_USE_SLOT_DECISIONS[2].label),
      [suggestedSlot]: inlineStringCell(suggestedSlot, 'SLOT-C'),
      [slotRationale]: inlineStringCell(
        slotRationale,
        'The product belongs in the alternate procedure slot.',
      ),
    })
    const preview = await importClinicalUseReviewWorkbook(completed, importOptions(data))
    expect(preview.canExportNormalized).toBe(true)
    expect(preview.summary).toMatchObject({
      validCompletedDecisions: 2,
      productRoleDecisions: 1,
      currentSlotDecisions: 1,
      rowsWithoutDecision: 3,
    })
    expect(preview.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordType: 'product_role',
          productId: 'PRD-TEST-1',
          roleCode: 'ROLE_A',
          decision: 'replace_with_different_role',
          suggestedRoleCode: 'ROLE_C',
        }),
        expect.objectContaining({
          recordType: 'slot_product',
          slotId: 'SLOT-A',
          productId: 'PRD-TEST-1',
          decision: 'move_to_another_exact_slot',
          suggestedSlotId: 'SLOT-C',
        }),
      ]),
    )
    const normalized = createClinicalUseReviewNormalizedExport(preview, false)
    const parsedJson = JSON.parse(serializeClinicalUseReviewJson(normalized)) as {
      decisions: Array<{ productId: unknown; suggestedRoleCode?: unknown }>
    }
    expect(typeof parsedJson.decisions[0].productId).toBe('string')
  })

  it('reports invalid decisions, missing rationale, and required role/slot suggestions', async () => {
    const { bytes, data } = await fixtureWorkbook()
    const roleDecision = cellReference(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'decision', 2)
    const slotDecision = cellReference(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'decision', 2)
    const invalidRole = await patchCells(bytes, PRODUCT_ROLE_SHEET_PATH, {
      [roleDecision]: inlineStringCell(roleDecision, CLINICAL_USE_PRODUCT_ROLE_DECISIONS[2].label),
    })
    const incomplete = await patchCells(invalidRole, CURRENT_SLOT_SHEET_PATH, {
      [slotDecision]: inlineStringCell(slotDecision, CLINICAL_USE_SLOT_DECISIONS[2].label),
    })
    const preview = await importClinicalUseReviewWorkbook(incomplete, importOptions(data))
    expect(preview.canExportNormalized).toBe(false)
    expect(preview.summary).toMatchObject({
      missingRationales: 2,
      missingSuggestedRoles: 1,
      missingSuggestedSlots: 1,
      validCompletedDecisions: 0,
    })

    const invalidValue = await patchCells(bytes, PRODUCT_ROLE_SHEET_PATH, {
      [roleDecision]: inlineStringCell(roleDecision, 'Definitely approve'),
    })
    const invalidPreview = await importClinicalUseReviewWorkbook(invalidValue, importOptions(data))
    expect(invalidPreview.summary.invalidDecisionValues).toBe(1)
  })

  it('rejects formulas and reports duplicate, unknown, and changed protected rows', async () => {
    const { bytes, data } = await fixtureWorkbook()
    const decision = cellReference(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'decision', 2)
    const formula = await patchCells(bytes, PRODUCT_ROLE_SHEET_PATH, {
      [decision]: formulaStringCell(
        decision,
        '"Confirm current mapping"',
        CLINICAL_USE_PRODUCT_ROLE_DECISIONS[0].label,
      ),
    })
    const formulaPreview = await importClinicalUseReviewWorkbook(formula, importOptions(data))
    expect(formulaPreview.exportBlockers).toContain(
      'Replace formulas in review rows with entered values.',
    )

    const firstKey = data.productRoles[0].reviewKey
    const secondKeyCell = cellReference(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'reviewKey', 3)
    const duplicate = await patchCells(bytes, PRODUCT_ROLE_SHEET_PATH, {
      [secondKeyCell]: inlineStringCell(secondKeyCell, firstKey, 6),
    })
    const duplicatePreview = await importClinicalUseReviewWorkbook(duplicate, importOptions(data))
    expect(duplicatePreview.duplicateReviewKeys).toEqual([firstKey])
    expect(duplicatePreview.summary.duplicateRows).toBe(2)

    const unknownKeyCell = cellReference(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'reviewKey', 2)
    const unknown = await patchCells(bytes, PRODUCT_ROLE_SHEET_PATH, {
      [unknownKeyCell]: inlineStringCell(
        unknownKeyCell,
        'product_role:PRD-UNKNOWN:ROLE_UNKNOWN',
        6,
      ),
    })
    const unknownPreview = await importClinicalUseReviewWorkbook(unknown, importOptions(data))
    expect(unknownPreview.summary.unknownReviewKeys).toBe(1)

    const productNameCell = cellReference(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'productName', 2)
    const changed = await patchCells(bytes, CURRENT_SLOT_SHEET_PATH, {
      [productNameCell]: inlineStringCell(productNameCell, 'Edited protected name', 6),
    })
    const changedPreview = await importClinicalUseReviewWorkbook(changed, importOptions(data))
    expect(changedPreview.canExportNormalized).toBe(true)
    expect(changedPreview.summary).toMatchObject({
      changedProtectedRows: 1,
      protectedFieldDifferences: 1,
    })
  })

  it('marks stale manifests without blocking preview and requires normalized-export acknowledgement', async () => {
    const { bytes, data } = await fixtureWorkbook()
    const preview = await importClinicalUseReviewWorkbook(
      bytes,
      importOptions(data, OTHER_MANIFEST_HASH),
    )
    expect(preview.staleArtifact).toBe(true)
    expect(preview.staleWarning).toMatch(/different clinical-use artifact manifest/i)
    expect(preview.changedReviewKeys).toEqual([])
    expect(preview.summary).toMatchObject({
      staleReviewKeys: 0,
      protectedFieldDifferences: 0,
      changedProtectedRows: 0,
    })
    expect(preview.canExportNormalized).toBe(true)
    expect(() => createClinicalUseReviewNormalizedExport(preview, false)).toThrow(
      'A stale clinical-use artifact must be explicitly acknowledged before export.',
    )
    expect(createClinicalUseReviewNormalizedExport(preview, true)).toMatchObject({
      staleArtifactAcknowledged: true,
      decisions: [],
    })
  })

  it('does not mutate canonical product-role or slot-option artifacts during import', async () => {
    const canonicalPaths = [
      path.join(process.cwd(), 'data/ip-preference-cards/generated/catalog-products.json'),
      path.join(process.cwd(), 'data/ip-preference-cards/generated/product-roles.json'),
      path.join(process.cwd(), 'data/ip-preference-cards/generated/slot-product-options.json'),
    ]
    const before = await Promise.all(canonicalPaths.map((filename) => readFile(filename)))
    const { bytes, data } = await fixtureWorkbook()
    await importClinicalUseReviewWorkbook(bytes, importOptions(data))
    expect(await Promise.all(canonicalPaths.map((filename) => readFile(filename)))).toEqual(before)
  })
})
