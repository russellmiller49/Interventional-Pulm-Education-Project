import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { TextDecoder as NodeTextDecoder } from 'node:util'

import JSZip from 'jszip'

import type { ClinicalUseReviewData } from '@/features/preference-cards/data/clinical-use-review.server'
import {
  CLINICAL_USE_CURRENT_SLOT_COLUMNS,
  CLINICAL_USE_PRODUCT_ROLE_COLUMNS,
  CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
  clinicalUseProductRoleKey,
  clinicalUseSlotProductKey,
  type ClinicalUseCatalogProductWorkbookRow,
  type ClinicalUseCurrentSlotWorkbookRow,
  type ClinicalUseProductRoleWorkbookRow,
  type ClinicalUseReviewColumn,
  type ClinicalUseReviewWorkbookMetadata,
} from '@/features/preference-cards/excel/clinical-use-review-contract'
import {
  buildClinicalUseReviewWorkbookBytes,
  importClinicalUseReviewWorkbook,
} from '@/features/preference-cards/excel/clinical-use-review-workbook.server'

Object.defineProperty(globalThis, 'TextDecoder', {
  configurable: true,
  value: NodeTextDecoder,
})

const CURRENT_MANIFEST_HASH = 'a'.repeat(64)
const STALE_MANIFEST_HASH = 'b'.repeat(64)
const EXPORTED_AT = '2026-07-29T12:00:00.000Z'
const IMPORTED_AT = '2026-07-30T12:00:00.000Z'
const PRODUCT_ID = '000123'
const CURRENT_ROLE = 'ROLE_CURRENT'
const SECOND_ROLE = 'ROLE_SECOND'
const ALTERNATIVE_ROLE = 'ROLE_ALTERNATIVE'
const CURRENT_SLOT = '000456'
const ALTERNATIVE_SLOT = '000789'
const PRODUCT_ROLE_WORKSHEET_PATH = 'xl/worksheets/sheet3.xml'
const CURRENT_SLOT_WORKSHEET_PATH = 'xl/worksheets/sheet4.xml'
const ZIP_ENTRY_DATE = new Date(1980, 0, 1, 0, 0, 0)
const CANONICAL_ARTIFACT_PATHS = [
  'data/ip-preference-cards/generated/catalog-products.json',
  'data/ip-preference-cards/generated/product-roles.json',
  'data/ip-preference-cards/generated/slot-product-options.json',
] as const

function emptyReviewerFields() {
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

function evidenceFields() {
  return {
    manufacturer: 'Fixture Medical',
    productName: 'Fixture product with leading-zero identifiers',
    catalogNumber: '000042',
    deviceIdentifier: '00123456789012',
    verificationGrade: 'verified_source',
    verificationStatus: 'Verified against fixture manufacturer evidence',
    distributionStatus: 'in_distribution',
    visibilityState: 'prototype_visible',
    evidenceSignal: 'strong_match',
    sourceId: 'SRC001',
    sourceLocation: 'fixture.pdf, page 7',
    evidencePageUrl: `https://example.test/en/admin/preference-cards/catalog-qa/${PRODUCT_ID}`,
  }
}

function catalogProductRow(): ClinicalUseCatalogProductWorkbookRow {
  return {
    productId: PRODUCT_ID,
    manufacturerId: 'MFR-000001',
    ...evidenceFields(),
    brandFamily: 'Fixture family',
    primaryCategory: 'Fixture category',
    subcategory: 'Fixture subcategory',
    productKind: 'Fixture product',
    sizeDisplay: '7 Fr',
    description: 'Small clinical-use import fixture.',
    currentRoleCodes: `${CURRENT_ROLE}; ${SECOND_ROLE}`,
    currentRoleNames: 'Current role; Second role',
    currentRoleCount: 2,
    canonicalSlotCount: 1,
  }
}

function productRoleRow(
  roleCode: typeof CURRENT_ROLE | typeof SECOND_ROLE,
  manifestHash: string,
): ClinicalUseProductRoleWorkbookRow {
  const isCurrent = roleCode === CURRENT_ROLE
  return {
    reviewKey: clinicalUseProductRoleKey(PRODUCT_ID, roleCode),
    productId: PRODUCT_ID,
    ...evidenceFields(),
    primaryCategory: 'Fixture category',
    subcategory: 'Fixture subcategory',
    roleCode,
    roleName: isCurrent ? 'Current role' : 'Second role',
    roleCategory: 'Fixture role category',
    roleDescription: 'Fixture role description.',
    roleSelectionGuidance: 'Use only after clinician review.',
    roleFit: 'Primary',
    roleNotes: '',
    canonicalSlotCount: isCurrent ? 1 : 0,
    procedureCodes: isCurrent ? 'PROC_TEST' : '',
    procedureNames: isCurrent ? 'Fixture procedure' : '',
    clinicalUseManifestHash: manifestHash,
    suggestedRoleCode: '',
    ...emptyReviewerFields(),
  }
}

function currentSlotRow(manifestHash: string): ClinicalUseCurrentSlotWorkbookRow {
  return {
    reviewKey: clinicalUseSlotProductKey(CURRENT_SLOT, PRODUCT_ID),
    slotId: CURRENT_SLOT,
    procedureCode: 'PROC_TEST',
    procedureName: 'Fixture procedure',
    slotLabel: 'Current fixture slot',
    requiredness: 'required',
    section: 'Equipment',
    genericRequirement: 'Fixture exact-slot requirement',
    roleCode: CURRENT_ROLE,
    roleName: 'Current role',
    productId: PRODUCT_ID,
    ...evidenceFields(),
    roleFit: 'Primary',
    eligibilityStatus: 'Prototype candidate',
    optionReason: 'Fixture canonical assignment.',
    visibleByDefault: 'Yes',
    selectable: 'Yes',
    clinicalUseManifestHash: manifestHash,
    suggestedSlotId: '',
    ...emptyReviewerFields(),
  }
}

function fixtureData(manifestHash = CURRENT_MANIFEST_HASH): ClinicalUseReviewData {
  return {
    catalogProducts: [catalogProductRow()],
    productRoles: [
      productRoleRow(CURRENT_ROLE, manifestHash),
      productRoleRow(SECOND_ROLE, manifestHash),
    ],
    currentSlots: [currentSlotRow(manifestHash)],
    counts: {
      catalogProducts: 1,
      productRoles: 2,
      currentSlots: 1,
    },
    roleOptions: [
      { roleCode: CURRENT_ROLE, roleName: 'Current role' },
      { roleCode: SECOND_ROLE, roleName: 'Second role' },
      { roleCode: ALTERNATIVE_ROLE, roleName: 'Alternative role' },
    ],
    slotOptions: [
      {
        slotId: CURRENT_SLOT,
        slotLabel: 'Current fixture slot',
        procedureCode: 'PROC_TEST',
        procedureName: 'Fixture procedure',
        roleCode: CURRENT_ROLE,
      },
      {
        slotId: ALTERNATIVE_SLOT,
        slotLabel: 'Alternative fixture slot',
        procedureCode: 'PROC_TEST',
        procedureName: 'Fixture procedure',
        roleCode: ALTERNATIVE_ROLE,
      },
    ],
  }
}

function workbookMetadata(manifestHash = CURRENT_MANIFEST_HASH): ClinicalUseReviewWorkbookMetadata {
  return {
    format_version: CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
    exported_at: EXPORTED_AT,
    clinical_use_manifest_sha256: manifestHash,
    catalog_products_sha256: '1'.repeat(64),
    product_roles_sha256: '2'.repeat(64),
    roles_sha256: '3'.repeat(64),
    procedures_sha256: '4'.repeat(64),
    procedure_slots_sha256: '5'.repeat(64),
    slot_product_options_sha256: '6'.repeat(64),
    catalog_product_count: '1',
    product_role_count: '2',
    current_slot_count: '1',
    application_base_url: 'https://example.test',
    source_branch: 'codex/preference-cards/catalog-verification-workflow',
    source_commit: 'c'.repeat(40),
    locale: 'en',
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
  const columnIndex = columns.findIndex((column) => column.key === key)
  if (columnIndex < 0) throw new Error(`Unknown fixture workbook column ${String(key)}.`)
  return `${columnName(columnIndex + 1)}${rowNumber}`
}

function xmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineStringCell(reference: string, value: string, style = 7): string {
  const preserve = /^\s|\s$|\r|\n/.test(value) ? ' xml:space="preserve"' : ''
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t${preserve}>${xmlText(value)}</t></is></c>`
}

function numericCell(reference: string, value: string, style = 12): string {
  return `<c r="${reference}" s="${style}" t="n"><v>${xmlText(value)}</v></c>`
}

function formulaStringCell(reference: string, formula: string, cachedValue: string): string {
  return `<c r="${reference}" s="7" t="str"><f>${xmlText(formula)}</f><v>${xmlText(
    cachedValue,
  )}</v></c>`
}

function replaceCell(worksheetXml: string, reference: string, replacement: string): string {
  const pattern = new RegExp(
    `(?:<c r="${reference}"[^>]*?\\/>|<c r="${reference}"[^>]*>[\\s\\S]*?<\\/c>)`,
  )
  if (!pattern.test(worksheetXml)) {
    throw new Error(`Test helper could not find workbook cell ${reference}.`)
  }
  return worksheetXml.replace(pattern, replacement)
}

async function patchWorkbook(
  bytes: Uint8Array,
  patches: Array<{ archivePath: string; replacements: Record<string, string> }>,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes)
  for (const patch of patches) {
    const entry = zip.file(patch.archivePath)
    if (!entry) throw new Error(`Test helper could not find ${patch.archivePath}.`)
    const xml = await entry.async('string')
    const updated = Object.entries(patch.replacements).reduce(
      (worksheet, [reference, replacement]) => replaceCell(worksheet, reference, replacement),
      xml,
    )
    zip.file(patch.archivePath, updated, {
      date: ZIP_ENTRY_DATE,
      createFolders: false,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
  }
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  })
}

function roleCell(key: keyof ClinicalUseProductRoleWorkbookRow, rowNumber = 2): string {
  return cellReference(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, key, rowNumber)
}

function slotCell(key: keyof ClinicalUseCurrentSlotWorkbookRow, rowNumber = 2): string {
  return cellReference(CLINICAL_USE_CURRENT_SLOT_COLUMNS, key, rowNumber)
}

function textReplacement(reference: string, value: string): string {
  return inlineStringCell(reference, value)
}

function excelSerial(date: string): string {
  const milliseconds = Date.parse(`${date}T00:00:00.000Z`) - Date.UTC(1899, 11, 30)
  return String(Math.floor(milliseconds / 86_400_000))
}

async function importFixture(
  bytes: Uint8Array,
  currentData = fixtureData(),
  currentClinicalUseManifestSha256 = CURRENT_MANIFEST_HASH,
) {
  return importClinicalUseReviewWorkbook(bytes, {
    applicationBaseUrl: 'https://example.test',
    fileName: 'fixture-clinical-use-review.xlsx',
    importedAt: IMPORTED_AT,
    locale: 'en',
    currentClinicalUseManifestSha256,
    currentData,
  })
}

async function artifactHashes() {
  return Promise.all(
    CANONICAL_ARTIFACT_PATHS.map(async (filename) => ({
      filename,
      sha256: createHash('sha256')
        .update(await readFile(filename))
        .digest('hex'),
    })),
  )
}

let baseWorkbook: Uint8Array

beforeAll(async () => {
  baseWorkbook = await buildClinicalUseReviewWorkbookBytes(fixtureData(), workbookMetadata())
})

describe('clinical-use review workbook import', () => {
  it('imports completed product-role and current-slot decisions with Excel dates and text identifiers', async () => {
    const roleDecision = roleCell('decision')
    const roleSuggestion = roleCell('suggestedRoleCode')
    const roleRationale = roleCell('rationale')
    const roleConfidence = roleCell('reviewerConfidence')
    const roleDate = roleCell('reviewDate')
    const roleSecondReview = roleCell('readyForSecondReview')
    const slotDecision = slotCell('decision')
    const slotSuggestion = slotCell('suggestedSlotId')
    const slotRationale = slotCell('rationale')
    const slotConfidence = slotCell('reviewerConfidence')
    const slotDate = slotCell('reviewDate')
    const slotSecondReview = slotCell('readyForSecondReview')
    const completed = await patchWorkbook(baseWorkbook, [
      {
        archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
        replacements: {
          [roleDecision]: textReplacement(roleDecision, 'Replace with different role'),
          [roleSuggestion]: textReplacement(roleSuggestion, ALTERNATIVE_ROLE),
          [roleRationale]: textReplacement(
            roleRationale,
            'Available evidence supports the alternative broad clinical role.',
          ),
          [roleConfidence]: textReplacement(roleConfidence, 'High'),
          [roleDate]: textReplacement(roleDate, '2026-07-29'),
          [roleSecondReview]: textReplacement(roleSecondReview, 'Yes'),
        },
      },
      {
        archivePath: CURRENT_SLOT_WORKSHEET_PATH,
        replacements: {
          [slotDecision]: textReplacement(slotDecision, 'Move to another exact slot'),
          [slotSuggestion]: textReplacement(slotSuggestion, ALTERNATIVE_SLOT),
          [slotRationale]: textReplacement(
            slotRationale,
            'The catalog item belongs in the alternate exact procedure slot.',
          ),
          [slotConfidence]: textReplacement(slotConfidence, 'Moderate'),
          [slotDate]: numericCell(slotDate, excelSerial('2026-07-30')),
          [slotSecondReview]: textReplacement(slotSecondReview, 'No'),
        },
      },
    ])

    const preview = await importFixture(completed)
    expect(preview.canExportNormalized).toBe(true)
    expect(preview.summary).toMatchObject({
      validCompletedDecisions: 2,
      productRoleDecisions: 1,
      currentSlotDecisions: 1,
    })
    expect(preview.decisions).toEqual([
      expect.objectContaining({
        recordType: 'product_role',
        productId: PRODUCT_ID,
        roleCode: CURRENT_ROLE,
        decision: 'replace_with_different_role',
        suggestedRoleCode: ALTERNATIVE_ROLE,
        reviewDate: '2026-07-29',
        readyForSecondReview: true,
      }),
      expect.objectContaining({
        recordType: 'slot_product',
        productId: PRODUCT_ID,
        slotId: CURRENT_SLOT,
        decision: 'move_to_another_exact_slot',
        suggestedSlotId: ALTERNATIVE_SLOT,
        reviewDate: '2026-07-30',
        readyForSecondReview: false,
      }),
    ])
    expect(
      preview.rows
        .flatMap((row) => row.issues)
        .some((issue) => issue.code === 'identifier_not_text'),
    ).toBe(false)
  })

  it('reports invalid decisions and missing rationales as blocking errors', async () => {
    const invalidDecision = roleCell('decision')
    const invalidRationale = roleCell('rationale')
    const missingRationaleDecision = roleCell('decision', 3)
    const invalid = await patchWorkbook(baseWorkbook, [
      {
        archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
        replacements: {
          [invalidDecision]: textReplacement(invalidDecision, 'Clinically perfect'),
          [invalidRationale]: textReplacement(invalidRationale, 'Entered rationale.'),
          [missingRationaleDecision]: textReplacement(
            missingRationaleDecision,
            'Confirm current mapping',
          ),
        },
      },
    ])

    const preview = await importFixture(invalid)
    expect(preview.canExportNormalized).toBe(false)
    expect(preview.summary.invalidDecisionValues).toBe(1)
    expect(preview.summary.missingRationales).toBe(1)
    expect(preview.exportBlockers).toEqual(
      expect.arrayContaining([
        'Choose only allowed decision values.',
        'Add a rationale for every decision.',
      ]),
    )
  })

  it.each(['Replace with different role', 'Add another role'])(
    'requires a suggested role for %s',
    async (decision) => {
      const decisionCell = roleCell('decision')
      const rationaleCell = roleCell('rationale')
      const missingSuggestion = await patchWorkbook(baseWorkbook, [
        {
          archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
          replacements: {
            [decisionCell]: textReplacement(decisionCell, decision),
            [rationaleCell]: textReplacement(
              rationaleCell,
              'The current broad clinical-use classification needs revision.',
            ),
          },
        },
      ])

      const preview = await importFixture(missingSuggestion)
      expect(preview.canExportNormalized).toBe(false)
      expect(preview.summary.missingSuggestedRoles).toBe(1)
      expect(preview.rows.flatMap((row) => row.issues).map((issue) => issue.code)).toContain(
        'missing_suggested_role',
      )
    },
  )

  it('requires a suggested slot for a move decision', async () => {
    const decisionCell = slotCell('decision')
    const rationaleCell = slotCell('rationale')
    const missingSuggestion = await patchWorkbook(baseWorkbook, [
      {
        archivePath: CURRENT_SLOT_WORKSHEET_PATH,
        replacements: {
          [decisionCell]: textReplacement(decisionCell, 'Move to another exact slot'),
          [rationaleCell]: textReplacement(
            rationaleCell,
            'The current exact-slot assignment should be moved.',
          ),
        },
      },
    ])

    const preview = await importFixture(missingSuggestion)
    expect(preview.canExportNormalized).toBe(false)
    expect(preview.summary.missingSuggestedSlots).toBe(1)
    expect(preview.rows.flatMap((row) => row.issues).map((issue) => issue.code)).toContain(
      'missing_suggested_slot',
    )
  })

  it('rejects unknown suggested role and slot identifiers', async () => {
    const roleDecision = roleCell('decision')
    const roleSuggestion = roleCell('suggestedRoleCode')
    const roleRationale = roleCell('rationale')
    const slotDecision = slotCell('decision')
    const slotSuggestion = slotCell('suggestedSlotId')
    const slotRationale = slotCell('rationale')
    const invalidSuggestions = await patchWorkbook(baseWorkbook, [
      {
        archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
        replacements: {
          [roleDecision]: textReplacement(roleDecision, 'Replace with different role'),
          [roleSuggestion]: textReplacement(roleSuggestion, 'ROLE-NOT-KNOWN'),
          [roleRationale]: textReplacement(roleRationale, 'A replacement role was requested.'),
        },
      },
      {
        archivePath: CURRENT_SLOT_WORKSHEET_PATH,
        replacements: {
          [slotDecision]: textReplacement(slotDecision, 'Move to another exact slot'),
          [slotSuggestion]: textReplacement(slotSuggestion, 'SLOT-NOT-KNOWN'),
          [slotRationale]: textReplacement(slotRationale, 'A replacement slot was requested.'),
        },
      },
    ])

    const preview = await importFixture(invalidSuggestions)
    const issueCodes = preview.rows.flatMap((row) => row.issues).map((issue) => issue.code)
    expect(preview.canExportNormalized).toBe(false)
    expect(issueCodes).toContain('invalid_suggested_role')
    expect(issueCodes).toContain('invalid_suggested_slot')
  })

  it('reports duplicate and unknown review keys without mapping by row position', async () => {
    const secondReviewKey = roleCell('reviewKey', 3)
    const duplicate = await patchWorkbook(baseWorkbook, [
      {
        archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
        replacements: {
          [secondReviewKey]: textReplacement(
            secondReviewKey,
            clinicalUseProductRoleKey(PRODUCT_ID, CURRENT_ROLE),
          ),
        },
      },
    ])
    const duplicatePreview = await importFixture(duplicate)
    expect(duplicatePreview.canExportNormalized).toBe(false)
    expect(duplicatePreview.summary.duplicateRows).toBe(2)
    expect(duplicatePreview.duplicateReviewKeys).toEqual([
      clinicalUseProductRoleKey(PRODUCT_ID, CURRENT_ROLE),
    ])

    const firstReviewKey = roleCell('reviewKey')
    const unknown = await patchWorkbook(baseWorkbook, [
      {
        archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
        replacements: {
          [firstReviewKey]: textReplacement(
            firstReviewKey,
            clinicalUseProductRoleKey('UNKNOWN', CURRENT_ROLE),
          ),
        },
      },
    ])
    const unknownPreview = await importFixture(unknown)
    expect(unknownPreview.canExportNormalized).toBe(false)
    expect(unknownPreview.summary.unknownReviewKeys).toBe(1)
    expect(unknownPreview.summary.missingCurrentRows).toBe(1)
    expect(unknownPreview.unknownWorkbookReviewKeys).toEqual([
      clinicalUseProductRoleKey('UNKNOWN', CURRENT_ROLE),
    ])
  })

  it('rejects formulas even when a cached review value looks valid', async () => {
    const decisionCell = roleCell('decision')
    const rationaleCell = roleCell('rationale')
    const formulaWorkbook = await patchWorkbook(baseWorkbook, [
      {
        archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
        replacements: {
          [decisionCell]: textReplacement(decisionCell, 'Confirm current mapping'),
          [rationaleCell]: formulaStringCell(
            rationaleCell,
            '"Cached rationale"',
            'Cached rationale',
          ),
        },
      },
    ])

    const preview = await importFixture(formulaWorkbook)
    expect(preview.canExportNormalized).toBe(false)
    expect(preview.exportBlockers).toContain('Replace formulas in review rows with entered values.')
    expect(preview.rows.flatMap((row) => row.issues).map((issue) => issue.code)).toContain(
      'formula_not_allowed',
    )
  })

  it('warns on stale provenance and keeps current protected fields authoritative', async () => {
    const staleWorkbook = await buildClinicalUseReviewWorkbookBytes(
      fixtureData(STALE_MANIFEST_HASH),
      workbookMetadata(STALE_MANIFEST_HASH),
    )
    const stalePreview = await importFixture(staleWorkbook)
    expect(stalePreview.staleArtifact).toBe(true)
    expect(stalePreview.staleWarning).toMatch(/different clinical-use artifact manifest/i)
    expect(stalePreview.summary.matchedReviewKeys).toBe(3)
    expect(stalePreview.summary.staleReviewKeys).toBe(0)
    expect(stalePreview.summary.protectedFieldDifferences).toBe(0)
    expect(stalePreview.summary.changedProtectedRows).toBe(0)
    expect(stalePreview.canExportNormalized).toBe(true)

    const reviewKey = roleCell('reviewKey')
    const productId = roleCell('productId')
    const productName = roleCell('productName')
    const decision = roleCell('decision')
    const rationale = roleCell('rationale')
    const protectedEdit = await patchWorkbook(baseWorkbook, [
      {
        archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
        replacements: {
          [reviewKey]: textReplacement(
            reviewKey,
            clinicalUseProductRoleKey(PRODUCT_ID, CURRENT_ROLE),
          ),
          [productId]: textReplacement(productId, '999999'),
          [productName]: textReplacement(productName, 'Reviewer-edited product name'),
          [decision]: textReplacement(decision, 'Confirm current mapping'),
          [rationale]: textReplacement(
            rationale,
            'The stable current product and role identifiers remain authoritative.',
          ),
        },
      },
    ])
    const protectedPreview = await importFixture(protectedEdit)
    const normalizedDecision = protectedPreview.decisions.find(
      (candidate) => candidate.recordType === 'product_role',
    )
    expect(protectedPreview.canExportNormalized).toBe(true)
    expect(protectedPreview.summary.changedProtectedRows).toBe(1)
    expect(protectedPreview.changedReviewKeys).toEqual([
      clinicalUseProductRoleKey(PRODUCT_ID, CURRENT_ROLE),
    ])
    expect(normalizedDecision).toMatchObject({
      productId: PRODUCT_ID,
      roleCode: CURRENT_ROLE,
    })
    expect(
      protectedPreview.rows
        .flatMap((row) => row.protectedFieldDifferences)
        .map((difference) => difference.field),
    ).toEqual(expect.arrayContaining(['Product ID', 'Product Name']))
  })

  it('never mutates canonical catalog, product-role, or slot-option artifacts during import', async () => {
    const before = await artifactHashes()
    const decisionCell = roleCell('decision')
    const rationaleCell = roleCell('rationale')
    const completed = await patchWorkbook(baseWorkbook, [
      {
        archivePath: PRODUCT_ROLE_WORKSHEET_PATH,
        replacements: {
          [decisionCell]: textReplacement(decisionCell, 'Confirm current mapping'),
          [rationaleCell]: textReplacement(
            rationaleCell,
            'This in-memory preview must not write canonical repository artifacts.',
          ),
        },
      },
    ])

    const preview = await importFixture(completed)
    const after = await artifactHashes()
    expect(preview.summary.validCompletedDecisions).toBe(1)
    expect(after).toEqual(before)
  })
})
