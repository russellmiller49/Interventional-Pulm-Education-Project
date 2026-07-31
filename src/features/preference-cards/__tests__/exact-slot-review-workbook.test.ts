import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { TextDecoder as NodeTextDecoder } from 'node:util'

import JSZip from 'jszip'

import {
  getSlotOptionReviewRows,
  type SlotOptionReviewRow,
} from '@/features/preference-cards/data/slot-option-proposals.server'
import {
  EXACT_SLOT_REVIEW_COLUMNS,
  EXACT_SLOT_REVIEW_DECISIONS,
  EXACT_SLOT_REVIEW_IDENTIFIER_HEADERS,
  EXACT_SLOT_REVIEW_SHEETS,
  EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION,
  exactSlotProposalKey,
  type ExactSlotReviewWorkbookMetadata,
} from '@/features/preference-cards/excel/exact-slot-review-contract'
import {
  createExactSlotReviewNormalizedExport,
  serializeExactSlotReviewCsv,
  serializeExactSlotReviewJson,
} from '@/features/preference-cards/excel/exact-slot-review-serialization'
import {
  buildExactSlotReviewWorkbookBytes,
  createExactSlotReviewWorkbook,
  createExactSlotReviewWorkbookRows,
  importExactSlotReviewWorkbook,
  selectExactSlotReviewRows,
} from '@/features/preference-cards/excel/exact-slot-review-workbook.server'
import {
  parseOoxmlWorkbookBytes,
  type ParsedOoxmlWorksheet,
} from '@/features/preference-cards/excel/ooxml-reader.server'

Object.defineProperty(globalThis, 'TextDecoder', {
  configurable: true,
  value: NodeTextDecoder,
})

const PROPOSAL_HASH = 'a'.repeat(64)
const OTHER_PROPOSAL_HASH = 'b'.repeat(64)
const EXPORTED_AT = '2026-07-29T12:00:00.000Z'
const IMPORTED_AT = '2026-07-29T13:00:00.000Z'
const ZIP_ENTRY_DATE = new Date(1980, 0, 1, 0, 0, 0)
const REVIEW_WORKSHEET_PATH = 'xl/worksheets/sheet2.xml'
const REVIEW_RELATIONSHIPS_PATH = 'xl/worksheets/_rels/sheet2.xml.rels'
const REVIEW_SUMMARY_WORKSHEET_PATH = 'xl/worksheets/sheet3.xml'
const LOOKUPS_WORKSHEET_PATH = 'xl/worksheets/sheet5.xml'
const MAX_UNCOMPRESSED_WORKBOOK_BYTES = 80 * 1024 * 1024

function fixtureProposal(
  index: number,
  overrides: Partial<SlotOptionReviewRow> = {},
): SlotOptionReviewRow {
  const productId = `PRD-TEST-${String(index).padStart(3, '0')}`
  const roleCode = index === 2 ? 'ROLE_B' : 'ROLE_A'
  const procedureCode = index === 2 ? 'PROC_B' : 'PROC_A'
  const slotId = `SLOT-TEST-${String(index).padStart(3, '0')}`
  return {
    slot_id: slotId,
    procedure_code: procedureCode,
    slot_display_order: index,
    slot_label: `Fixture slot ${index}`,
    requiredness: index === 2 ? 'optional' : 'required',
    role_code: roleCode,
    product_id: productId,
    manufacturer_id: `MFR-TEST-${String(index).padStart(3, '0')}`,
    manufacturer: index === 2 ? 'Fixture Medical B' : 'Fixture Medical A',
    product_name: `Fixture product ${index}`,
    catalog_number: index === 1 ? '000123' : `CAT-${index}`,
    role_fit: 'Compatible',
    product_verification_grade: 'verified_source',
    product_visibility_state: 'prototype_visible',
    current_distribution_status: 'in_distribution',
    proposal_origin: 'product_role_join',
    proposal_status: 'unreviewed',
    selectable: false,
    visible_by_default: false,
    reason_code: 'missing_authored_slot_product_option',
    reason: `Fixture proposal reason ${index}`,
    source_identifiers: {
      procedure_slot_id: slotId,
      product_role_key: `${productId}:${roleCode}`,
      primary_source_id: `SRC${String(index).padStart(3, '0')}`,
      primary_source_location: `fixture-source-${index}.pdf, page ${index}`,
    },
    procedureName: procedureCode === 'PROC_A' ? 'Procedure A' : 'Procedure B',
    roleName: roleCode === 'ROLE_A' ? 'Role A' : 'Role B',
    distributionEvidence: 'in_distribution',
    ...overrides,
  }
}

function workbookMetadata(
  proposalCount: number,
  overrides: Partial<ExactSlotReviewWorkbookMetadata> = {},
): ExactSlotReviewWorkbookMetadata {
  return {
    format_version: EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION,
    exported_at: EXPORTED_AT,
    proposal_artifact_sha256: PROPOSAL_HASH,
    proposal_count: String(proposalCount),
    application_base_url: 'https://example.test',
    source_branch: 'codex/preference-cards/exact-slot-review-test',
    source_commit: 'c'.repeat(40),
    locale: 'en',
    ...overrides,
  }
}

async function fixtureWorkbook(proposals: SlotOptionReviewRow[]) {
  const metadata = workbookMetadata(proposals.length)
  const rows = createExactSlotReviewWorkbookRows(proposals, metadata)
  const bytes = await buildExactSlotReviewWorkbookBytes(rows, metadata)
  return { bytes, metadata, rows }
}

function xmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineStringCell(reference: string, value: string, style = 7): string {
  const preserve = /^\s|\s$|\r|\n/.test(value) ? ' xml:space="preserve"' : ''
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t${preserve}>${xmlText(value)}</t></is></c>`
}

function numericCell(reference: string, value: string, style = 8): string {
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

async function mutateWorkbook(
  bytes: Uint8Array,
  mutate: (zip: JSZip) => Promise<void> | void,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes)
  await mutate(zip)
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
  })
}

function forgeFirstCentralDirectoryUncompressedSize(
  bytes: Uint8Array,
  uncompressedSize: number,
): Uint8Array {
  const forged = bytes.slice()
  const view = new DataView(forged.buffer, forged.byteOffset, forged.byteLength)
  let endOfCentralDirectory = -1
  const minimumOffset = Math.max(0, forged.byteLength - 22 - 65_535)
  for (let offset = forged.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === forged.byteLength
    ) {
      endOfCentralDirectory = offset
      break
    }
  }
  if (endOfCentralDirectory < 0) {
    throw new Error('Test helper could not find the ZIP end-of-central-directory record.')
  }

  const firstEntry = view.getUint32(endOfCentralDirectory + 16, true)
  if (view.getUint32(firstEntry, true) !== 0x02014b50) {
    throw new Error('Test helper could not find the first ZIP central-directory entry.')
  }
  view.setUint32(firstEntry + 24, uncompressedSize, true)
  return forged
}

async function rewriteXmlEntry(
  bytes: Uint8Array,
  archivePath: string,
  transform: (xml: string) => string,
): Promise<Uint8Array> {
  return mutateWorkbook(bytes, async (zip) => {
    const entry = zip.file(archivePath)
    if (!entry) throw new Error(`Test helper could not find ${archivePath}.`)
    const xml = await entry.async('string')
    zip.file(archivePath, transform(xml), {
      date: ZIP_ENTRY_DATE,
      createFolders: false,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
  })
}

async function patchReviewCells(
  bytes: Uint8Array,
  replacements: Record<string, string>,
): Promise<Uint8Array> {
  return rewriteXmlEntry(bytes, REVIEW_WORKSHEET_PATH, (xml) =>
    Object.entries(replacements).reduce(
      (updated, [reference, replacement]) => replaceCell(updated, reference, replacement),
      xml,
    ),
  )
}

function cellByHeader(worksheet: ParsedOoxmlWorksheet, rowNumber: number, header: string) {
  const columnIndex = EXACT_SLOT_REVIEW_COLUMNS.findIndex((column) => column.header === header) + 1
  if (columnIndex < 1) throw new Error(`Unknown test header ${header}.`)
  const cell = worksheet.rows.get(rowNumber)?.get(columnIndex)
  if (!cell) throw new Error(`Cell for ${header} row ${rowNumber} is missing.`)
  return cell
}

function excelSerial(date: string): string {
  const milliseconds = Date.parse(`${date}T00:00:00.000Z`) - Date.UTC(1899, 11, 30)
  return String(Math.floor(milliseconds / 86_400_000))
}

function importOptions(
  currentRows: SlotOptionReviewRow[],
  currentProposalArtifactSha256 = PROPOSAL_HASH,
) {
  return {
    applicationBaseUrl: 'https://example.test',
    fileName: 'fixture-review.xlsx',
    importedAt: IMPORTED_AT,
    locale: 'en',
    currentProposalArtifactSha256,
    currentRows,
  }
}

describe('exact-slot clinician review workbook export', () => {
  it('builds the required five-sheet, protected, validated, macro-free workbook with text identifiers', async () => {
    const proposal = fixtureProposal(1)
    const { bytes } = await fixtureWorkbook([proposal])
    const parsed = await parseOoxmlWorkbookBytes(bytes)
    const reviewWorksheet = parsed.sheets.get('Exact Slot Review')
    expect(parsed.sheetNames).toEqual(EXACT_SLOT_REVIEW_SHEETS)
    expect(reviewWorksheet).toBeDefined()
    expect(reviewWorksheet?.maxRow).toBe(2)

    for (const [index, column] of EXACT_SLOT_REVIEW_COLUMNS.entries()) {
      if (!EXACT_SLOT_REVIEW_IDENTIFIER_HEADERS.has(column.header)) continue
      const cell = reviewWorksheet?.rows.get(2)?.get(index + 1)
      if (cell?.value) {
        expect(cell.type).toBe('inlineStr')
      }
    }
    expect(cellByHeader(reviewWorksheet!, 2, 'Catalog Number')).toMatchObject({
      type: 'inlineStr',
      value: '000123',
    })

    const zip = await JSZip.loadAsync(bytes)
    const reviewXml = await zip.file(REVIEW_WORKSHEET_PATH)!.async('string')
    const stylesXml = await zip.file('xl/styles.xml')!.async('string')
    expect(reviewXml).toContain('<sheetProtection ')
    expect(reviewXml).toContain('<dataValidations count="4">')
    expect(reviewXml).toContain('<formula1>DecisionOptions</formula1>')
    expect(reviewXml).toContain('<formula1>ConfidenceOptions</formula1>')
    expect(reviewXml).toContain('<formula1>YesNoOptions</formula1>')
    expect(reviewXml).toContain('type="date"')
    const worksheetChildOrder = [
      reviewXml.indexOf('<pageMargins '),
      reviewXml.indexOf('<pageSetup '),
      reviewXml.indexOf('<ignoredErrors>'),
      reviewXml.indexOf('<tableParts '),
    ]
    expect(worksheetChildOrder).not.toContain(-1)
    expect(worksheetChildOrder).toEqual(
      [...worksheetChildOrder].sort((left, right) => left - right),
    )
    expect(stylesXml).toContain('<protection locked="0"/>')
    expect(
      parsed.archiveEntryNames.some((name) => /vbaProject|externalLinks|\.bin$/i.test(name)),
    ).toBe(false)
  })

  it('selects controlled fixture scopes and exports the complete remediated proposal artifact', async () => {
    const fixtureRows = [
      fixtureProposal(1, { product_id: 'PRD-SHARED' }),
      fixtureProposal(2),
      fixtureProposal(3, { product_id: 'PRD-SHARED' }),
    ]
    expect(selectExactSlotReviewRows({ scope: 'all', locale: 'en' }, fixtureRows)).toHaveLength(3)
    expect(
      selectExactSlotReviewRows({ scope: 'required', locale: 'en' }, fixtureRows),
    ).toHaveLength(2)
    expect(
      selectExactSlotReviewRows(
        {
          scope: 'filtered',
          locale: 'en',
          filters: { procedure: 'PROC_A', requiredness: 'required' },
        },
        fixtureRows,
      ),
    ).toHaveLength(2)
    expect(
      selectExactSlotReviewRows(
        {
          scope: 'unreviewed',
          locale: 'en',
          reviewedProposalKeys: [
            exactSlotProposalKey(fixtureRows[0].slot_id, fixtureRows[0].product_id),
          ],
        },
        fixtureRows,
      ),
    ).toHaveLength(2)
    expect(
      selectExactSlotReviewRows(
        { scope: 'product', locale: 'en', productId: 'PRD-SHARED' },
        fixtureRows,
      ),
    ).toHaveLength(2)

    const realRows = getSlotOptionReviewRows()
    expect(realRows).toHaveLength(813)
    const workbook = await createExactSlotReviewWorkbook(
      { scope: 'all', locale: 'en' },
      'https://example.test',
      EXPORTED_AT,
      {
        proposalArtifactSha256: PROPOSAL_HASH,
        sourceBranch: 'codex/test',
        sourceCommit: 'd'.repeat(40),
      },
    )
    // Taxonomy v2 added 57 procedure slots across two new procedures and five existing ones,
    // so the derived non-selectable proposal set grew from 429 to 798.
    expect(workbook.proposalKeys).toHaveLength(813)
    const parsed = await parseOoxmlWorkbookBytes(workbook.bytes)
    expect(parsed.sheets.get('Exact Slot Review')?.maxRow).toBe(814)

    const preview = await importExactSlotReviewWorkbook(workbook.bytes, importOptions(realRows))
    expect(preview.summary).toMatchObject({
      matchedProposalKeys: 813,
      missingCurrentProposals: 0,
      rowsWithoutDecision: 813,
      validCompletedDecisions: 0,
    })
    expect(preview.canExportNormalized).toBe(true)
  })

  it('is byte-deterministic and records the exact workbook and proposal hashes', async () => {
    const proposals = [fixtureProposal(1), fixtureProposal(2)]
    const metadata = workbookMetadata(proposals.length)
    const rows = createExactSlotReviewWorkbookRows(proposals, metadata)
    const first = await buildExactSlotReviewWorkbookBytes(rows, metadata)
    const second = await buildExactSlotReviewWorkbookBytes(rows, metadata)
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)

    const expectedWorkbookHash = createHash('sha256').update(first).digest('hex')
    const preview = await importExactSlotReviewWorkbook(first, importOptions(proposals))
    expect(preview.workbookSha256).toBe(expectedWorkbookHash)
    expect(preview.workbookMetadata.proposal_artifact_sha256).toBe(PROPOSAL_HASH)
    expect(rows.every((row) => row.proposalArtifactHash === PROPOSAL_HASH)).toBe(true)
  })

  it('keeps the zero-row summary unreviewed formula constrained to exported proposals', async () => {
    const { bytes } = await fixtureWorkbook([])
    const zip = await JSZip.loadAsync(bytes)
    const summaryXml = await zip.file(REVIEW_SUMMARY_WORKSHEET_PATH)!.async('string')
    const unreviewedCell = summaryXml.match(/<c r="B7"[^>]*>([\s\S]*?)<\/c>/)?.[1]

    expect(unreviewedCell).toContain(
      `<f>COUNTIFS('Exact Slot Review'!$A$2:$A$2,"&lt;&gt;",'Exact Slot Review'!$X$2:$X$2,"")</f>`,
    )
    expect(unreviewedCell).toContain('<v>0</v>')
    expect(unreviewedCell).not.toContain('COUNTBLANK')
  })

  it('rejects a missing required sheet and a macro-bearing archive', async () => {
    const { bytes } = await fixtureWorkbook([fixtureProposal(1)])
    const missingSheet = await rewriteXmlEntry(bytes, 'xl/workbook.xml', (xml) =>
      xml.replace(/<sheet name="Decision Definitions"[^>]*\/>/, ''),
    )
    await expect(
      importExactSlotReviewWorkbook(missingSheet, importOptions([fixtureProposal(1)])),
    ).rejects.toThrow('Required workbook sheet "Decision Definitions" is missing.')

    const withMacro = await mutateWorkbook(bytes, (zip) => {
      zip.file('xl/vbaProject.bin', new Uint8Array([1, 2, 3]), { date: ZIP_ENTRY_DATE })
    })
    await expect(parseOoxmlWorkbookBytes(withMacro)).rejects.toThrow(
      'Macro-enabled or externally linked workbooks are not accepted.',
    )
  })
})

describe('exact-slot OOXML safety preflight', () => {
  it('rejects a raw parent-path ZIP entry before JSZip can sanitize its name', async () => {
    const { bytes } = await fixtureWorkbook([fixtureProposal(1)])
    const unsafe = await mutateWorkbook(bytes, (zip) => {
      zip.file('../unsafe.xml', 'unsafe', {
        createFolders: false,
        date: ZIP_ENTRY_DATE,
      })
    })

    await expect(parseOoxmlWorkbookBytes(unsafe)).rejects.toThrow(
      'The workbook archive contains an unsafe entry path.',
    )
  })

  it('rejects a forged central-directory expansion above 80 MB before inflation', async () => {
    const { bytes } = await fixtureWorkbook([fixtureProposal(1)])
    const forged = forgeFirstCentralDirectoryUncompressedSize(
      bytes,
      MAX_UNCOMPRESSED_WORKBOOK_BYTES + 1,
    )

    await expect(parseOoxmlWorkbookBytes(forged)).rejects.toThrow(
      'Workbook expands beyond the accepted size limit.',
    )
  })
})

describe('exact-slot clinician review workbook import', () => {
  it('round-trips a completed decision, Excel date, leading-zero identifier, and string JSON without canonical mutation', async () => {
    const proposals = [fixtureProposal(1)]
    const proposalsBefore = JSON.stringify(proposals)
    const canonicalPath = path.join(
      process.cwd(),
      'data/ip-preference-cards/generated/slot-product-option-proposals.json',
    )
    const canonicalBefore = await readFile(canonicalPath)
    const { bytes } = await fixtureWorkbook(proposals)
    const rationale = '{"selection":"001","basis":"reviewed"}'
    const patched = await patchReviewCells(bytes, {
      X2: inlineStringCell('X2', EXACT_SLOT_REVIEW_DECISIONS[0].label),
      Y2: inlineStringCell('Y2', rationale),
      Z2: inlineStringCell('Z2', 'Current manufacturer IFU'),
      AA2: inlineStringCell('AA2', 'Dr Reviewer'),
      AB2: inlineStringCell('AB2', 'Moderate'),
      AC2: numericCell('AC2', excelSerial('2026-07-29')),
      AD2: inlineStringCell('AD2', '=HYPERLINK("https://example.invalid")'),
      AE2: inlineStringCell('AE2', 'Yes'),
      AF2: inlineStringCell('AF2', 'Second Reviewer'),
      AG2: inlineStringCell('AG2', 'Second review requested'),
    })

    const preview = await importExactSlotReviewWorkbook(patched, importOptions(proposals))
    expect(preview.canExportNormalized).toBe(true)
    expect(preview.summary.validCompletedDecisions).toBe(1)
    expect(preview.decisions).toEqual([
      expect.objectContaining({
        proposalKey: exactSlotProposalKey(proposals[0].slot_id, proposals[0].product_id),
        productId: proposals[0].product_id,
        decision: 'candidate_for_canonical_option',
        rationale,
        reviewerConfidence: 'moderate',
        reviewDate: '2026-07-29',
        readyForSecondReview: true,
        followUpNotes: '=HYPERLINK("https://example.invalid")',
      }),
    ])

    const normalized = createExactSlotReviewNormalizedExport(preview, false)
    const json = serializeExactSlotReviewJson(normalized)
    const parsedJson = JSON.parse(json) as {
      decisions: Array<{ productId: unknown; rationale: unknown }>
    }
    expect(typeof parsedJson.decisions[0].productId).toBe('string')
    expect(parsedJson.decisions[0].rationale).toBe(rationale)
    expect(typeof parsedJson.decisions[0].rationale).toBe('string')
    expect(json.endsWith('\n')).toBe(true)
    expect(serializeExactSlotReviewCsv(normalized)).toContain(
      `'=HYPERLINK(""https://example.invalid"")`,
    )

    const parsedWorkbook = await parseOoxmlWorkbookBytes(patched)
    expect(
      cellByHeader(parsedWorkbook.sheets.get('Exact Slot Review')!, 2, 'Catalog Number'),
    ).toEqual(expect.objectContaining({ type: 'inlineStr', value: '000123' }))
    expect(JSON.stringify(proposals)).toBe(proposalsBefore)
    expect(await readFile(canonicalPath)).toEqual(canonicalBefore)
  })

  it('blocks invalid decisions and decisions without a rationale', async () => {
    const proposals = [fixtureProposal(1), fixtureProposal(2)]
    const { bytes } = await fixtureWorkbook(proposals)
    const patched = await patchReviewCells(bytes, {
      X2: inlineStringCell('X2', 'Definitely approve'),
      Y2: inlineStringCell('Y2', 'Invalid choice fixture'),
      X3: inlineStringCell('X3', EXACT_SLOT_REVIEW_DECISIONS[1].label),
    })
    const preview = await importExactSlotReviewWorkbook(patched, importOptions(proposals))
    expect(preview.canExportNormalized).toBe(false)
    expect(preview.summary).toMatchObject({
      invalidDecisionValues: 1,
      missingRationales: 1,
      validCompletedDecisions: 0,
    })
    expect(preview.rows[0].issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'invalid_decision' })]),
    )
    expect(preview.rows[1].issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing_rationale' })]),
    )
  })

  it('blocks duplicate and unknown proposal keys', async () => {
    const proposals = [fixtureProposal(1), fixtureProposal(2)]
    const firstKey = exactSlotProposalKey(proposals[0].slot_id, proposals[0].product_id)
    const { bytes } = await fixtureWorkbook(proposals)
    const duplicate = await patchReviewCells(bytes, {
      A3: inlineStringCell('A3', firstKey, 6),
    })
    const duplicatePreview = await importExactSlotReviewWorkbook(
      duplicate,
      importOptions(proposals),
    )
    expect(duplicatePreview.canExportNormalized).toBe(false)
    expect(duplicatePreview.duplicateProposalKeys).toEqual([firstKey])
    expect(duplicatePreview.summary.duplicateRows).toBe(2)

    const unknown = await patchReviewCells(bytes, {
      A2: inlineStringCell('A2', 'SLOT-UNKNOWN:PRD-UNKNOWN', 6),
    })
    const unknownPreview = await importExactSlotReviewWorkbook(unknown, importOptions(proposals))
    expect(unknownPreview.canExportNormalized).toBe(false)
    expect(unknownPreview.unknownWorkbookProposalKeys).toEqual(['SLOT-UNKNOWN:PRD-UNKNOWN'])
    expect(unknownPreview.summary.unknownProposalKeys).toBe(1)
    expect(unknownPreview.rows[0].status).toBe('unknown')
  })

  it('bounds repeated malformed proposal keys in the import preview', async () => {
    const proposals = Array.from({ length: 20 }, (_, index) => fixtureProposal(index + 1))
    const { bytes } = await fixtureWorkbook(proposals)
    const repeatedMalformedKey = 'K'.repeat(32_767)
    const patched = await patchReviewCells(
      bytes,
      Object.fromEntries(
        proposals.map((_, index) => [
          `A${index + 2}`,
          inlineStringCell(`A${index + 2}`, repeatedMalformedKey, 6),
        ]),
      ),
    )

    const preview = await importExactSlotReviewWorkbook(patched, importOptions(proposals))
    expect(preview.canExportNormalized).toBe(false)
    expect(preview.summary).toMatchObject({
      duplicateRows: proposals.length,
      unknownProposalKeys: 1,
    })
    expect(preview.rows).toHaveLength(proposals.length)
    expect(preview.rows.every((row) => (row.proposalKey?.length ?? 0) <= 256)).toBe(true)
    expect(preview.unknownWorkbookProposalKeys[0]).toHaveLength(256)
    expect(preview.duplicateProposalKeys[0]).toHaveLength(256)
    expect(JSON.stringify(preview).length).toBeLessThan(75_000)
  })

  it('rejects cell text beyond Excel’s maximum before building a preview', async () => {
    const proposals = [fixtureProposal(1)]
    const { bytes } = await fixtureWorkbook(proposals)
    const oversizedSharedString = 'K'.repeat(32_768)
    const patched = await mutateWorkbook(bytes, async (zip) => {
      zip.file(
        'xl/sharedStrings.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>${oversizedSharedString}</t></si></sst>`,
        {
          date: ZIP_ENTRY_DATE,
          createFolders: false,
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        },
      )
      const worksheet = zip.file(REVIEW_WORKSHEET_PATH)
      if (!worksheet) throw new Error('Test helper could not find review worksheet.')
      const xml = await worksheet.async('string')
      zip.file(
        REVIEW_WORKSHEET_PATH,
        replaceCell(xml, 'A2', '<c r="A2" s="6" t="s"><v>0</v></c>'),
        {
          date: ZIP_ENTRY_DATE,
          createFolders: false,
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        },
      )
    })

    await expect(importExactSlotReviewWorkbook(patched, importOptions(proposals))).rejects.toThrow(
      'Workbook cell text exceeds Excel’s accepted length.',
    )
  })

  it('requires explicit acknowledgement before normalizing a stale workbook', async () => {
    const proposals = [fixtureProposal(1)]
    const { bytes } = await fixtureWorkbook(proposals)
    const preview = await importExactSlotReviewWorkbook(
      bytes,
      importOptions(proposals, OTHER_PROPOSAL_HASH),
    )
    expect(preview.staleArtifact).toBe(true)
    expect(preview.staleWarning).toMatch(/different proposal artifact/i)
    expect(preview.canExportNormalized).toBe(true)
    expect(() => createExactSlotReviewNormalizedExport(preview, false)).toThrow(
      'A stale proposal artifact must be explicitly acknowledged before export.',
    )
    expect(createExactSlotReviewNormalizedExport(preview, true).staleArtifactAcknowledged).toBe(
      true,
    )
  })

  it('warns on protected-field edits while retaining current identifiers as authoritative', async () => {
    const proposals = [fixtureProposal(1)]
    const proposalsBefore = JSON.stringify(proposals)
    const { bytes } = await fixtureWorkbook(proposals)
    const patched = await patchReviewCells(bytes, {
      J2: inlineStringCell('J2', 'Edited protected product name', 6),
      X2: inlineStringCell('X2', EXACT_SLOT_REVIEW_DECISIONS[2].label),
      Y2: inlineStringCell('Y2', 'Evidence remains incomplete.'),
    })
    const preview = await importExactSlotReviewWorkbook(patched, importOptions(proposals))
    expect(preview.canExportNormalized).toBe(true)
    expect(preview.summary).toMatchObject({
      changedProtectedRows: 1,
      protectedFieldDifferences: 1,
      staleProposalKeys: 1,
      validCompletedDecisions: 1,
    })
    expect(preview.changedProposalKeys).toEqual([
      exactSlotProposalKey(proposals[0].slot_id, proposals[0].product_id),
    ])
    expect(preview.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'protected_field_changed',
          severity: 'warning',
          field: 'Product Name',
        }),
      ]),
    )
    expect(preview.decisions[0].productId).toBe(proposals[0].product_id)
    expect(JSON.stringify(proposals)).toBe(proposalsBefore)
  })

  it('bounds protected-field detail output while retaining complete summary counts', async () => {
    const proposals = [fixtureProposal(1)]
    const { bytes } = await fixtureWorkbook(proposals)
    const repeatedLongValue = 'Z'.repeat(32_767)
    const patched = await patchReviewCells(
      bytes,
      Object.fromEntries(
        EXACT_SLOT_REVIEW_COLUMNS.slice(1, 23).map((_, index) => {
          const reference = `${String.fromCharCode(66 + index)}2`
          return [reference, inlineStringCell(reference, repeatedLongValue, 6)]
        }),
      ),
    )

    const preview = await importExactSlotReviewWorkbook(patched, importOptions(proposals))
    expect(preview.summary).toMatchObject({
      changedProtectedRows: 1,
      protectedFieldDifferences: 22,
    })
    expect(preview.rows[0].protectedFieldDifferences).toHaveLength(4)
    expect(preview.rows[0].issues).toHaveLength(9)
    expect(preview.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'preview_details_omitted',
          message: expect.stringContaining('additional protected-field differences'),
        }),
      ]),
    )
    expect(JSON.stringify(preview).length).toBeLessThan(15_000)
  })

  it('reports a changed evidence hyperlink target as a protected-field difference', async () => {
    const proposals = [fixtureProposal(1)]
    const { bytes } = await fixtureWorkbook(proposals)
    const forgedTarget = 'https://evil.example/phish'
    const patched = await rewriteXmlEntry(bytes, REVIEW_RELATIONSHIPS_PATH, (xml) => {
      const updated = xml.replace(
        /(<Relationship Id="rId2"[^>]* Target=")[^"]+("[^>]*\/>)/,
        `$1${forgedTarget}$2`,
      )
      if (updated === xml) {
        throw new Error('Test helper could not find the first evidence hyperlink relationship.')
      }
      return updated
    })

    const preview = await importExactSlotReviewWorkbook(patched, importOptions(proposals))
    expect(preview.canExportNormalized).toBe(true)
    expect(preview.summary).toMatchObject({
      changedProtectedRows: 1,
      protectedFieldDifferences: 1,
      staleProposalKeys: 1,
    })
    expect(preview.rows[0].protectedFieldDifferences).toEqual([
      expect.objectContaining({
        field: 'Evidence Page URL',
        workbookValue: expect.stringContaining(`[hyperlink: ${forgedTarget}]`),
      }),
    ])
    expect(preview.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'protected_field_changed',
          field: 'Evidence Page URL',
          severity: 'warning',
        }),
      ]),
    )
  })

  it('rejects a formula cell beyond the blank-headed review schema', async () => {
    const proposals = [fixtureProposal(1)]
    const { bytes } = await fixtureWorkbook(proposals)
    const patched = await rewriteXmlEntry(bytes, REVIEW_WORKSHEET_PATH, (xml) => {
      const updated = xml.replace(
        /(<row r="2"[^>]*>[\s\S]*?)(<\/row>)/,
        `$1${formulaStringCell('AH2', '"hidden formula"', 'hidden formula')}$2`,
      )
      if (updated === xml) {
        throw new Error('Test helper could not add the blank-headed AH2 formula cell.')
      }
      return updated
    })

    await expect(importExactSlotReviewWorkbook(patched, importOptions(proposals))).rejects.toThrow(
      'Exact Slot Review contains unsupported cells beyond column AG.',
    )
  })

  it('rejects a workbook with an extra worksheet', async () => {
    const proposals = [fixtureProposal(1)]
    const { bytes } = await fixtureWorkbook(proposals)
    const patched = await mutateWorkbook(bytes, async (zip) => {
      const workbookEntry = zip.file('xl/workbook.xml')
      const relationshipsEntry = zip.file('xl/_rels/workbook.xml.rels')
      const contentTypesEntry = zip.file('[Content_Types].xml')
      if (!workbookEntry || !relationshipsEntry || !contentTypesEntry) {
        throw new Error('Test helper could not find the workbook package entries.')
      }

      const workbookXml = (await workbookEntry.async('string')).replace(
        '</sheets>',
        '<sheet name="Unexpected" sheetId="99" r:id="rId99"/></sheets>',
      )
      const relationshipsXml = (await relationshipsEntry.async('string')).replace(
        '</Relationships>',
        '<Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet99.xml"/></Relationships>',
      )
      const contentTypesXml = (await contentTypesEntry.async('string')).replace(
        '</Types>',
        '<Override PartName="/xl/worksheets/sheet99.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      )
      const extraWorksheetXml =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>'

      zip.file('xl/workbook.xml', workbookXml, { createFolders: false, date: ZIP_ENTRY_DATE })
      zip.file('xl/_rels/workbook.xml.rels', relationshipsXml, {
        createFolders: false,
        date: ZIP_ENTRY_DATE,
      })
      zip.file('[Content_Types].xml', contentTypesXml, {
        createFolders: false,
        date: ZIP_ENTRY_DATE,
      })
      zip.file('xl/worksheets/sheet99.xml', extraWorksheetXml, {
        createFolders: false,
        date: ZIP_ENTRY_DATE,
      })
    })

    await expect(importExactSlotReviewWorkbook(patched, importOptions(proposals))).rejects.toThrow(
      `Workbook must contain exactly these sheets in order: ${EXACT_SLOT_REVIEW_SHEETS.join(', ')}.`,
    )
  })

  it('rejects invalid dates, formulas, and identifier cells converted from text to numeric', async () => {
    const proposals = [fixtureProposal(1)]
    const { bytes } = await fixtureWorkbook(proposals)
    const invalidDate = await patchReviewCells(bytes, {
      X2: inlineStringCell('X2', EXACT_SLOT_REVIEW_DECISIONS[0].label),
      Y2: inlineStringCell('Y2', 'Decision with invalid date.'),
      AC2: inlineStringCell('AC2', '2026-02-30', 8),
    })
    const datePreview = await importExactSlotReviewWorkbook(invalidDate, importOptions(proposals))
    expect(datePreview.canExportNormalized).toBe(false)
    expect(datePreview.rows[0].issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'invalid_date' })]),
    )

    const formula = await patchReviewCells(bytes, {
      X2: formulaStringCell(
        'X2',
        '"Candidate for canonical option"',
        EXACT_SLOT_REVIEW_DECISIONS[0].label,
      ),
      Y2: inlineStringCell('Y2', 'Formula result must not be trusted.'),
    })
    const formulaPreview = await importExactSlotReviewWorkbook(formula, importOptions(proposals))
    expect(formulaPreview.canExportNormalized).toBe(false)
    expect(formulaPreview.rows[0].issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'formula_not_allowed' })]),
    )

    const numericIdentifier = await patchReviewCells(bytes, {
      K2: numericCell('K2', '000123', 6),
    })
    const identifierPreview = await importExactSlotReviewWorkbook(
      numericIdentifier,
      importOptions(proposals),
    )
    expect(identifierPreview.canExportNormalized).toBe(false)
    expect(identifierPreview.rows[0].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'identifier_not_text',
          field: 'Catalog Number',
        }),
      ]),
    )
  })

  it('rejects malformed workbook metadata rather than trusting a patched artifact hash', async () => {
    const proposals = [fixtureProposal(1)]
    const { bytes } = await fixtureWorkbook(proposals)
    const patched = await rewriteXmlEntry(bytes, LOOKUPS_WORKSHEET_PATH, (xml) =>
      replaceCell(xml, 'E4', inlineStringCell('E4', 'not-a-sha256', 13)),
    )
    await expect(importExactSlotReviewWorkbook(patched, importOptions(proposals))).rejects.toThrow(
      'Workbook proposal artifact SHA-256 is invalid.',
    )
  })
})

describe('exact-slot normalized CSV serialization', () => {
  it('retains portable provenance when there are no completed decisions', () => {
    const workbookSha256 = 'c'.repeat(64)
    const csv = serializeExactSlotReviewCsv({
      formatVersion: 1,
      importedAt: IMPORTED_AT,
      workbookFileName: 'empty-review.xlsx',
      workbookSha256,
      proposalArtifactSha256: PROPOSAL_HASH,
      staleArtifactAcknowledged: false,
      decisions: [],
    })
    const [headerLine, provenanceLine, ...extraLines] = csv.trimEnd().split('\r\n')
    const headers = headerLine.split(',')
    const values = provenanceLine.split(',')
    const provenance = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    )

    expect(extraLines).toEqual([])
    expect(provenance).toMatchObject({
      format_version: '1',
      imported_at: IMPORTED_AT,
      workbook_file_name: 'empty-review.xlsx',
      workbook_sha256: workbookSha256,
      proposal_artifact_sha256: PROPOSAL_HASH,
      stale_artifact_acknowledged: 'false',
      proposal_key: '',
      decision: '',
    })
  })
})
