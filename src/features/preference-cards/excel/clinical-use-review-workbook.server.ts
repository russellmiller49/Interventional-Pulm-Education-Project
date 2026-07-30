import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import JSZip from 'jszip'

import slotProductOptionProposalsJson from '../../../../data/ip-preference-cards/generated/slot-product-option-proposals.json'

import {
  getClinicalUseReviewArtifactManifest,
  getClinicalUseReviewData,
  type ClinicalUseReviewArtifactManifest,
  type ClinicalUseReviewData,
} from '@/features/preference-cards/data/clinical-use-review.server'
import {
  CLINICAL_USE_CATALOG_PRODUCT_COLUMNS,
  CLINICAL_USE_CATALOG_PRODUCT_IDENTIFIER_HEADERS,
  CLINICAL_USE_CURRENT_SLOT_COLUMNS,
  CLINICAL_USE_CURRENT_SLOT_EDITABLE_COLUMNS,
  CLINICAL_USE_CURRENT_SLOT_IDENTIFIER_HEADERS,
  CLINICAL_USE_CURRENT_SLOT_REFERENCE_COLUMNS,
  CLINICAL_USE_PRODUCT_ROLE_COLUMNS,
  CLINICAL_USE_PRODUCT_ROLE_DECISIONS,
  CLINICAL_USE_PRODUCT_ROLE_EDITABLE_COLUMNS,
  CLINICAL_USE_PRODUCT_ROLE_IDENTIFIER_HEADERS,
  CLINICAL_USE_PRODUCT_ROLE_REFERENCE_COLUMNS,
  CLINICAL_USE_REVIEW_CONFIDENCES,
  CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION,
  CLINICAL_USE_REVIEW_SHEETS,
  CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
  CLINICAL_USE_REVIEW_YES_NO,
  CLINICAL_USE_SLOT_DECISIONS,
  normalizeClinicalUseProductRoleDecision,
  normalizeClinicalUseReviewConfidence,
  normalizeClinicalUseSlotDecision,
  nullableClinicalUseReviewText,
  type ClinicalUseCatalogProductWorkbookRow,
  type ClinicalUseCurrentSlotWorkbookRow,
  type ClinicalUseProductRoleDecision,
  type ClinicalUseProductRoleWorkbookRow,
  type ClinicalUseReviewColumn,
  type ClinicalUseReviewDecision,
  type ClinicalUseReviewImportPreview,
  type ClinicalUseReviewImportRowPreview,
  type ClinicalUseReviewIssue,
  type ClinicalUseReviewWorkbookExportRequest,
  type ClinicalUseReviewWorkbookMetadata,
  type ClinicalUseSlotDecision,
} from '@/features/preference-cards/excel/clinical-use-review-contract'
import {
  parseOoxmlWorkbookBytes,
  type ParsedOoxmlCell,
  type ParsedOoxmlWorksheet,
} from '@/features/preference-cards/excel/ooxml-reader.server'

const execFileAsync = promisify(execFile)

export const CLINICAL_USE_REVIEW_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const CATALOG_PRODUCTS_SHEET = 'Catalog Products'
const PRODUCT_ROLE_SHEET = 'Product Role Review'
const CURRENT_SLOT_SHEET = 'Current Slot Review'
const LOOKUPS_SHEET = 'Lookups'
const ZIP_ENTRY_DATE = new Date(1980, 0, 1, 0, 0, 0)
const MAX_CATALOG_PRODUCT_ROWS = 2_000
const MAX_PRODUCT_ROLE_ROWS = 2_500
const MAX_CURRENT_SLOT_ROWS = 3_000
const MAX_REVIEW_KEY_CHARACTERS = 512
const MAX_PREVIEW_VALUE_CHARACTERS = 256
const MAX_ROW_ISSUE_DETAILS = 8
const MAX_ROW_PROTECTED_DIFFERENCE_DETAILS = 4
const MAX_REVIEWER_NAME_CHARACTERS = 200
const MAX_REVIEW_TEXT_CHARACTERS = 4_000
const METADATA_KEY_COLUMN = 12
const METADATA_VALUE_COLUMN = 13
const UNREVIEWED_PROPOSAL_COUNT = (
  slotProductOptionProposalsJson as {
    summary: { generated_unreviewed_proposals: number }
  }
).summary.generated_unreviewed_proposals

type WorkbookReviewSheetName = typeof PRODUCT_ROLE_SHEET | typeof CURRENT_SLOT_SHEET
type ReviewWorkbookRow = ClinicalUseProductRoleWorkbookRow | ClinicalUseCurrentSlotWorkbookRow

export interface ClinicalUseReviewRuntimeContext {
  manifest: ClinicalUseReviewArtifactManifest
  clinicalUseManifestSha256: string
  sourceBranch: string
  sourceCommit: string
}

export interface ClinicalUseReviewWorkbookBuildResult {
  bytes: Uint8Array
  filename: string
  metadata: ClinicalUseReviewWorkbookMetadata
  counts: ClinicalUseReviewData['counts']
  reviewKeys: string[]
}

export interface ClinicalUseReviewImportOptions {
  applicationBaseUrl: string
  fileName: string
  importedAt: string
  locale: string
  currentClinicalUseManifestSha256: string
  currentData?: ClinicalUseReviewData
}

interface ReviewSheetDefinition<Row extends ReviewWorkbookRow> {
  sheetName: WorkbookReviewSheetName
  columns: readonly ClinicalUseReviewColumn<Row>[]
  referenceColumns: readonly ClinicalUseReviewColumn<Row>[]
  editableColumns: readonly ClinicalUseReviewColumn<Row>[]
  identifierHeaders: ReadonlySet<string>
  decisionKey: keyof Row
  suggestionKey: keyof Row
  decisionDefinedName: 'ProductRoleDecisionOptions' | 'SlotDecisionOptions'
  suggestionDefinedName: 'RoleCodeOptions' | 'SlotIdOptions'
  tableId: number
  tableName: string
  tablePath: string
  worksheetPath: string
  worksheetRelationshipPath: string
}

const PRODUCT_ROLE_DEFINITION: ReviewSheetDefinition<ClinicalUseProductRoleWorkbookRow> = {
  sheetName: PRODUCT_ROLE_SHEET,
  columns: CLINICAL_USE_PRODUCT_ROLE_COLUMNS,
  referenceColumns: CLINICAL_USE_PRODUCT_ROLE_REFERENCE_COLUMNS,
  editableColumns: CLINICAL_USE_PRODUCT_ROLE_EDITABLE_COLUMNS,
  identifierHeaders: CLINICAL_USE_PRODUCT_ROLE_IDENTIFIER_HEADERS,
  decisionKey: 'decision',
  suggestionKey: 'suggestedRoleCode',
  decisionDefinedName: 'ProductRoleDecisionOptions',
  suggestionDefinedName: 'RoleCodeOptions',
  tableId: 2,
  tableName: 'ProductRoleReviewTable',
  tablePath: 'xl/tables/table2.xml',
  worksheetPath: 'xl/worksheets/sheet3.xml',
  worksheetRelationshipPath: 'xl/worksheets/_rels/sheet3.xml.rels',
}

const CURRENT_SLOT_DEFINITION: ReviewSheetDefinition<ClinicalUseCurrentSlotWorkbookRow> = {
  sheetName: CURRENT_SLOT_SHEET,
  columns: CLINICAL_USE_CURRENT_SLOT_COLUMNS,
  referenceColumns: CLINICAL_USE_CURRENT_SLOT_REFERENCE_COLUMNS,
  editableColumns: CLINICAL_USE_CURRENT_SLOT_EDITABLE_COLUMNS,
  identifierHeaders: CLINICAL_USE_CURRENT_SLOT_IDENTIFIER_HEADERS,
  decisionKey: 'decision',
  suggestionKey: 'suggestedSlotId',
  decisionDefinedName: 'SlotDecisionOptions',
  suggestionDefinedName: 'SlotIdOptions',
  tableId: 3,
  tableName: 'CurrentSlotReviewTable',
  tablePath: 'xl/tables/table3.xml',
  worksheetPath: 'xl/worksheets/sheet4.xml',
  worksheetRelationshipPath: 'xl/worksheets/_rels/sheet4.xml.rels',
}

function xmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function xmlAttribute(value: unknown): string {
  return xmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
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

function columnIndex<Row>(
  columns: readonly ClinicalUseReviewColumn<Row>[],
  key: keyof Row,
): number {
  const index = columns.findIndex((column) => column.key === key)
  if (index < 0) throw new Error(`Workbook column "${String(key)}" is not defined.`)
  return index + 1
}

function textCell(reference: string, value: string, style: number): string {
  if (!value) return `<c r="${reference}" s="${style}"/>`
  const preserve = /^\s|\s$|\r|\n/.test(value) ? ' xml:space="preserve"' : ''
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t${preserve}>${xmlText(value)}</t></is></c>`
}

function numericCell(reference: string, value: number, style: number): string {
  return `<c r="${reference}" s="${style}" t="n"><v>${Number.isFinite(value) ? value : 0}</v></c>`
}

function valueCell(reference: string, value: string | number, style: number): string {
  return typeof value === 'number'
    ? numericCell(reference, value, style)
    : textCell(reference, value, style)
}

function formulaCell(reference: string, formula: string, cachedValue: number, style = 10): string {
  return `<c r="${reference}" s="${style}"><f>${xmlText(formula)}</f><v>${cachedValue}</v></c>`
}

function rowXml(rowNumber: number, cells: string[], height?: number): string {
  const customHeight = height ? ` ht="${height}" customHeight="1"` : ''
  return `<row r="${rowNumber}"${customHeight}>${cells.join('')}</row>`
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function normalizedBaseUrl(rawBaseUrl: string): string {
  const parsed = new URL(rawBaseUrl)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Application base URL must be an HTTP(S) origin without credentials.')
  }
  return parsed.origin
}

function safeLocale(locale: string): string {
  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ? locale : 'en'
}

function addZipText(zip: JSZip, archivePath: string, content: string) {
  zip.file(archivePath, content, {
    date: ZIP_ENTRY_DATE,
    createFolders: false,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

function escapedFormulaString(value: string): string {
  return value.replace(/"/g, '""')
}

function worksheetCell(
  worksheet: ParsedOoxmlWorksheet,
  rowNumber: number,
  columnNumber: number,
): ParsedOoxmlCell {
  return (
    worksheet.rows.get(rowNumber)?.get(columnNumber) ?? {
      value: '',
      type: '',
      style: null,
      hasFormula: false,
    }
  )
}

function requiredWorksheet(
  sheets: Map<string, ParsedOoxmlWorksheet>,
  sheetName: string,
): ParsedOoxmlWorksheet {
  const worksheet = sheets.get(sheetName)
  if (!worksheet) throw new Error(`Required workbook sheet "${sheetName}" is missing.`)
  return worksheet
}

function contentTypesXml(): string {
  const worksheetOverrides = CLINICAL_USE_REVIEW_SHEETS.map(
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('')
  const tableOverrides = [1, 2, 3]
    .map(
      (index) =>
        `<Override PartName="/xl/tables/table${index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheetOverrides}
  ${tableOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>
</Types>`
}

function packageRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>
</Relationships>`
}

function workbookXml(data: ClinicalUseReviewData): string {
  const sheets = CLINICAL_USE_REVIEW_SHEETS.map(
    (name, index) =>
      `<sheet name="${xmlAttribute(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="0"/>
  <workbookPr date1904="0"/>
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>${sheets}</sheets>
  <definedNames>
    <definedName name="ProductRoleDecisionOptions">'${LOOKUPS_SHEET}'!$A$2:$A$${CLINICAL_USE_PRODUCT_ROLE_DECISIONS.length + 1}</definedName>
    <definedName name="SlotDecisionOptions">'${LOOKUPS_SHEET}'!$B$2:$B$${CLINICAL_USE_SLOT_DECISIONS.length + 1}</definedName>
    <definedName name="ConfidenceOptions">'${LOOKUPS_SHEET}'!$C$2:$C$${CLINICAL_USE_REVIEW_CONFIDENCES.length + 1}</definedName>
    <definedName name="YesNoOptions">'${LOOKUPS_SHEET}'!$D$2:$D$${CLINICAL_USE_REVIEW_YES_NO.length + 1}</definedName>
    <definedName name="RoleCodeOptions">'${LOOKUPS_SHEET}'!$E$2:$E$${data.roleOptions.length + 1}</definedName>
    <definedName name="SlotIdOptions">'${LOOKUPS_SHEET}'!$G$2:$G$${data.slotOptions.length + 1}</definedName>
  </definedNames>
  <calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`
}

function workbookRelationshipsXml(): string {
  const worksheetRelationships = CLINICAL_USE_REVIEW_SHEETS.map(
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRelationships}
  <Relationship Id="rId${CLINICAL_USE_REVIEW_SHEETS.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function stylesXml(): string {
  const decisionColors = [
    ['E2F0D9', '375623'],
    ['FCE4D6', '843C0C'],
    ['DDEBF7', '1F4E78'],
    ['E4DFEC', '5F497A'],
    ['FFF2CC', '7F6000'],
    ['F4CCCC', '7F1D1D'],
    ['E7E6E6', '3F3F3F'],
  ]
  const differentialFormats = decisionColors
    .map(
      ([fill, text]) =>
        `<dxf><font><color rgb="FF${text}"/><b/></font><fill><patternFill patternType="solid"><fgColor rgb="FF${fill}"/><bgColor indexed="64"/></patternFill></fill></dxf>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF1F2937"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="18"/><color rgb="FF17365D"/><name val="Aptos Display"/><family val="2"/><scheme val="major"/></font>
    <font><b/><sz val="11"/><color rgb="FF17365D"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFB8C4CE"/></left><right style="thin"><color rgb="FFB8C4CE"/></right><top style="thin"><color rgb="FFB8C4CE"/></top><bottom style="thin"><color rgb="FFB8C4CE"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="0"/></xf>
    <xf numFmtId="14" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="0"/></xf>
    <xf numFmtId="49" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="right" vertical="top"/><protection locked="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="${decisionColors.length}">${differentialFormats}</dxfs>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`
}

function corePropertiesXml(exportedAt: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>IP Full Catalog Clinical-use Review</dc:title>
  <dc:subject>Clinician recommendations for current product-role and exact-slot mappings</dc:subject>
  <dc:creator>Interventional Pulmonology Education</dc:creator>
  <cp:lastModifiedBy>Interventional Pulmonology Education</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${xmlText(exportedAt)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${xmlText(exportedAt)}</dcterms:modified>
</cp:coreProperties>`
}

function extendedPropertiesXml(): string {
  const titles = CLINICAL_USE_REVIEW_SHEETS.map(
    (name) => `<vt:lpstr>${xmlText(name)}</vt:lpstr>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel Compatible</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${CLINICAL_USE_REVIEW_SHEETS.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${CLINICAL_USE_REVIEW_SHEETS.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>
  <Company>Interventional Pulmonology Education</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`
}

function customPropertiesXml(metadata: ClinicalUseReviewWorkbookMetadata): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  ${Object.entries(metadata)
    .map(
      ([name, value], index) =>
        `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${index + 2}" name="${xmlAttribute(name)}"><vt:lpwstr>${xmlText(value)}</vt:lpwstr></property>`,
    )
    .join('')}
</Properties>`
}

function instructionsWorksheetXml(metadata: ClinicalUseReviewWorkbookMetadata): string {
  const instructionRows: Array<[string, string]> = [
    [
      'Purpose',
      'Review the clinical use represented by every current product-to-role mapping and every current canonical exact-slot assignment in the catalog.',
    ],
    [
      'Recommendation boundary',
      'Every entry is a review recommendation only. Completing, exporting, or importing this workbook does not approve or apply catalog changes.',
    ],
    [
      'Catalog Products',
      'This protected reference sheet lists the complete current catalog. Use its filters and evidence links to find product context; decisions are entered on the two review sheets.',
    ],
    [
      'Product Role Review',
      'Review the broad Product_Roles classification. Enter a Suggested Role Code when choosing Replace with different role or Add another role.',
    ],
    [
      'Current Slot Review',
      'Review current canonical Slot_Product_Options. Enter a Suggested Slot ID when choosing Move to another exact slot.',
    ],
    [
      'Exact-slot proposals',
      `This workbook reviews current mappings. The separate Exact-slot clinician review workbook remains the decision surface for the ${UNREVIEWED_PROPOSAL_COUNT} unreviewed proposal rows.`,
    ],
    [
      'Editable columns',
      'Only yellow reviewer columns are editable. Blue reference columns are protected from accidental changes. Protection is a usability aid, not a security boundary.',
    ],
    [
      'Rationale',
      'Every nonblank decision requires a clinical rationale. Use Evidence Needed and Follow-up Notes to describe any IFU, dimensional, platform, package, kit, or configuration evidence still required.',
    ],
    [
      'Patient information prohibited',
      'Do not enter patient names, identifiers, dates of birth, medical record numbers, encounter details, or any other patient information in this workbook or its filename.',
    ],
    [
      'Save and return',
      'Save the completed file as a macro-free .xlsx workbook. Return it through the Full Catalog Clinical-use Review import page, inspect the validation preview, and download the normalized review artifact.',
    ],
    ['Workbook format version', metadata.format_version],
    ['Export timestamp', metadata.exported_at],
    ['Clinical-use manifest SHA-256', metadata.clinical_use_manifest_sha256],
    ['Catalog product count', metadata.catalog_product_count],
    ['Product-role mapping count', metadata.product_role_count],
    ['Current slot assignment count', metadata.current_slot_count],
  ]
  const rows = [
    rowXml(1, [textCell('A1', 'IP Full Catalog Clinical-use Review', 1)], 30),
    rowXml(
      2,
      [
        textCell(
          'A2',
          'Review recommendations only — this workbook does not approve or apply catalog changes.',
          2,
        ),
      ],
      30,
    ),
    ...instructionRows.map(([label, body], index) =>
      rowXml(
        index + 4,
        [textCell(`A${index + 4}`, label, 3), textCell(`B${index + 4}`, body, 4)],
        Math.max(24, Math.min(72, 18 + Math.ceil(body.length / 75) * 15)),
      ),
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:B${instructionRows.length + 3}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="105" customWidth="1"/></cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/></mergeCells>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1" paperSize="1"/>
</worksheet>`
}

function worksheetProtectionXml(): string {
  return '<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" insertHyperlinks="1" deleteColumns="1" deleteRows="1" selectLockedCells="0" selectUnlockedCells="0" sort="0" autoFilter="0"/>'
}

function identifierIgnoredErrorsXml<Row>(
  columns: readonly ClinicalUseReviewColumn<Row>[],
  identifierHeaders: ReadonlySet<string>,
  lastRow: number,
): string {
  const ranges = columns
    .map((column, index) =>
      identifierHeaders.has(column.header)
        ? `${columnName(index + 1)}2:${columnName(index + 1)}${lastRow}`
        : null,
    )
    .filter((value): value is string => Boolean(value))
  return ranges.length > 0
    ? `<ignoredErrors><ignoredError sqref="${ranges.join(' ')}" numberStoredAsText="1"/></ignoredErrors>`
    : ''
}

function dataTableXml<Row>(
  columns: readonly ClinicalUseReviewColumn<Row>[],
  rowCount: number,
  tableId: number,
  tableName: string,
): string {
  const lastColumn = columnName(columns.length)
  const lastRow = Math.max(1, rowCount + 1)
  const tableColumns = columns
    .map(
      (column, index) => `<tableColumn id="${index + 1}" name="${xmlAttribute(column.header)}"/>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${tableId}" name="${tableName}" displayName="${tableName}" ref="A1:${lastColumn}${lastRow}" totalsRowShown="0">
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
  <tableColumns count="${columns.length}">${tableColumns}</tableColumns>
  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`
}

function sheetRelationshipsXml<Row extends { evidencePageUrl: string }>(
  rows: Row[],
  tableTarget: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="${tableTarget}"/>
  ${rows
    .map(
      (row, index) =>
        `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlAttribute(row.evidencePageUrl)}" TargetMode="External"/>`,
    )
    .join('')}
</Relationships>`
}

function catalogProductsWorksheetXml(rows: ClinicalUseCatalogProductWorkbookRow[]): {
  worksheet: string
  relationships: string
} {
  const columns = CLINICAL_USE_CATALOG_PRODUCT_COLUMNS
  const lastColumn = columnName(columns.length)
  const lastRow = Math.max(2, rows.length + 1)
  const evidenceColumn = columnIndex(columns, 'evidencePageUrl')
  const columnXml = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
    )
    .join('')
  const headerRow = rowXml(
    1,
    columns.map((column, index) => textCell(`${columnName(index + 1)}1`, column.header, 5)),
    36,
  )
  const dataRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 2
    return rowXml(
      rowNumber,
      columns.map((column, columnOffset) => {
        const reference = `${columnName(columnOffset + 1)}${rowNumber}`
        const value = row[column.key]
        const style = column.key === 'evidencePageUrl' ? 9 : typeof value === 'number' ? 14 : 6
        return valueCell(reference, value, style)
      }),
      42,
    )
  })
  const hyperlinks =
    rows.length > 0
      ? `<hyperlinks>${rows
          .map(
            (_, index) =>
              `<hyperlink ref="${columnName(evidenceColumn)}${index + 2}" r:id="rId${index + 2}" display="Open evidence page"/>`,
          )
          .join('')}</hyperlinks>`
      : ''
  return {
    worksheet: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="C2" sqref="C2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnXml}</cols>
  <sheetData>${headerRow}${dataRows.join('')}</sheetData>
  ${worksheetProtectionXml()}
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
  ${hyperlinks}
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="4" fitToHeight="0" paperSize="1"/>
  ${identifierIgnoredErrorsXml(columns, CLINICAL_USE_CATALOG_PRODUCT_IDENTIFIER_HEADERS, lastRow)}
  <tableParts count="1"><tablePart r:id="rId1"/></tableParts>
</worksheet>`,
    relationships: sheetRelationshipsXml(rows, '../tables/table1.xml'),
  }
}

function reviewWorksheetXml<Row extends ReviewWorkbookRow>(
  rows: Row[],
  definition: ReviewSheetDefinition<Row>,
): { worksheet: string; relationships: string } {
  const { columns } = definition
  const lastColumn = columnName(columns.length)
  const lastRow = Math.max(2, rows.length + 1)
  const decisionColumnIndex = columnIndex(columns, definition.decisionKey)
  const suggestionColumnIndex = columnIndex(columns, definition.suggestionKey)
  const confidenceColumnIndex = columnIndex(columns, 'reviewerConfidence')
  const reviewDateColumnIndex = columnIndex(columns, 'reviewDate')
  const secondReviewColumnIndex = columnIndex(columns, 'readyForSecondReview')
  const evidenceColumnIndex = columnIndex(columns, 'evidencePageUrl')
  const columnXml = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
    )
    .join('')
  const headerRow = rowXml(
    1,
    columns.map((column, index) => textCell(`${columnName(index + 1)}1`, column.header, 5)),
    36,
  )
  const dataRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 2
    return rowXml(
      rowNumber,
      columns.map((column, columnOffset) => {
        const reference = `${columnName(columnOffset + 1)}${rowNumber}`
        const value = row[column.key] as string | number
        const style =
          column.key === 'evidencePageUrl'
            ? 9
            : column.key === 'reviewDate'
              ? 8
              : column.editable
                ? 7
                : typeof value === 'number'
                  ? 14
                  : 6
        return valueCell(reference, value, style)
      }),
      45,
    )
  })
  const decisions =
    definition.sheetName === PRODUCT_ROLE_SHEET
      ? CLINICAL_USE_PRODUCT_ROLE_DECISIONS
      : CLINICAL_USE_SLOT_DECISIONS
  const conditionalFormatting = decisions
    .map(
      (decision, index) =>
        `<cfRule type="expression" dxfId="${index}" priority="${index + 1}" stopIfTrue="1"><formula>$${columnName(
          decisionColumnIndex,
        )}2="${xmlText(decision.label)}"</formula></cfRule>`,
    )
    .join('')
  const hyperlinks =
    rows.length > 0
      ? `<hyperlinks>${rows
          .map(
            (_, index) =>
              `<hyperlink ref="${columnName(evidenceColumnIndex)}${index + 2}" r:id="rId${index + 2}" display="Open evidence page"/>`,
          )
          .join('')}</hyperlinks>`
      : ''
  const suggestionLabel = definition.sheetName === PRODUCT_ROLE_SHEET ? 'role code' : 'slot ID'
  return {
    worksheet: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="${columnName(
    decisionColumnIndex,
  )}2" sqref="${columnName(decisionColumnIndex)}2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnXml}</cols>
  <sheetData>${headerRow}${dataRows.join('')}</sheetData>
  ${worksheetProtectionXml()}
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
  <conditionalFormatting sqref="${columnName(decisionColumnIndex)}2:${columnName(
    decisionColumnIndex,
  )}${lastRow}">${conditionalFormatting}</conditionalFormatting>
  <dataValidations count="5">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1" errorStyle="stop" errorTitle="Invalid decision" error="Choose a decision from the dropdown list." promptTitle="Clinician recommendation" prompt="Choose one allowed recommendation. A rationale is required." sqref="${columnName(
      decisionColumnIndex,
    )}2:${columnName(decisionColumnIndex)}${lastRow}"><formula1>${definition.decisionDefinedName}</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid suggested ${xmlAttribute(
      suggestionLabel,
    )}" error="Choose a ${xmlAttribute(
      suggestionLabel,
    )} from the dropdown list." sqref="${columnName(suggestionColumnIndex)}2:${columnName(
      suggestionColumnIndex,
    )}${lastRow}"><formula1>${definition.suggestionDefinedName}</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid confidence" error="Choose High, Moderate, or Low." sqref="${columnName(
      confidenceColumnIndex,
    )}2:${columnName(confidenceColumnIndex)}${lastRow}"><formula1>ConfidenceOptions</formula1></dataValidation>
    <dataValidation type="date" operator="between" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid review date" error="Enter an Excel date from 2000 through 2100." sqref="${columnName(
      reviewDateColumnIndex,
    )}2:${columnName(reviewDateColumnIndex)}${lastRow}"><formula1>DATE(2000,1,1)</formula1><formula2>DATE(2100,12,31)</formula2></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid second-review state" error="Choose Yes or No." sqref="${columnName(
      secondReviewColumnIndex,
    )}2:${columnName(secondReviewColumnIndex)}${lastRow}"><formula1>YesNoOptions</formula1></dataValidation>
  </dataValidations>
  ${hyperlinks}
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="4" fitToHeight="0" paperSize="1"/>
  ${identifierIgnoredErrorsXml(columns, definition.identifierHeaders, lastRow)}
  <tableParts count="1"><tablePart r:id="rId1"/></tableParts>
</worksheet>`,
    relationships: sheetRelationshipsXml(rows, `../tables/table${definition.tableId}.xml`),
  }
}

function reviewSummaryWorksheetXml(data: ClinicalUseReviewData): string {
  const productRoleLastRow = Math.max(2, data.productRoles.length + 1)
  const currentSlotLastRow = Math.max(2, data.currentSlots.length + 1)
  const productRoleColumns = {
    key: columnName(columnIndex(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'reviewKey')),
    role: columnName(columnIndex(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'roleCode')),
    decision: columnName(columnIndex(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'decision')),
    confidence: columnName(columnIndex(CLINICAL_USE_PRODUCT_ROLE_COLUMNS, 'reviewerConfidence')),
  }
  const currentSlotColumns = {
    key: columnName(columnIndex(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'reviewKey')),
    procedure: columnName(columnIndex(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'procedureCode')),
    requiredness: columnName(columnIndex(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'requiredness')),
    decision: columnName(columnIndex(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'decision')),
    confidence: columnName(columnIndex(CLINICAL_USE_CURRENT_SLOT_COLUMNS, 'reviewerConfidence')),
  }
  const boundedRange = (sheet: string, column: string, lastRow: number): string =>
    `'${sheet}'!$${column}$2:$${column}$${lastRow}`
  const roleRanges = {
    key: boundedRange(PRODUCT_ROLE_SHEET, productRoleColumns.key, productRoleLastRow),
    role: boundedRange(PRODUCT_ROLE_SHEET, productRoleColumns.role, productRoleLastRow),
    decision: boundedRange(PRODUCT_ROLE_SHEET, productRoleColumns.decision, productRoleLastRow),
    confidence: boundedRange(PRODUCT_ROLE_SHEET, productRoleColumns.confidence, productRoleLastRow),
  }
  const slotRanges = {
    key: boundedRange(CURRENT_SLOT_SHEET, currentSlotColumns.key, currentSlotLastRow),
    procedure: boundedRange(CURRENT_SLOT_SHEET, currentSlotColumns.procedure, currentSlotLastRow),
    requiredness: boundedRange(
      CURRENT_SLOT_SHEET,
      currentSlotColumns.requiredness,
      currentSlotLastRow,
    ),
    decision: boundedRange(CURRENT_SLOT_SHEET, currentSlotColumns.decision, currentSlotLastRow),
    confidence: boundedRange(CURRENT_SLOT_SHEET, currentSlotColumns.confidence, currentSlotLastRow),
  }
  const metricRows: Array<[string, string, string, number]> = [
    [
      'Catalog',
      'Catalog products',
      `COUNTA('${CATALOG_PRODUCTS_SHEET}'!$A$2:$A$${Math.max(2, data.catalogProducts.length + 1)})`,
      data.catalogProducts.length,
    ],
    ['Product roles', 'Total mappings', `COUNTA(${roleRanges.key})`, data.productRoles.length],
    [
      'Product roles',
      'Reviewed',
      `COUNTIFS(${roleRanges.key},"<>",${roleRanges.decision},"<>")`,
      0,
    ],
    [
      'Product roles',
      'Unreviewed',
      `COUNTIFS(${roleRanges.key},"<>",${roleRanges.decision},"")`,
      data.productRoles.length,
    ],
    ...CLINICAL_USE_PRODUCT_ROLE_DECISIONS.map((decision): [string, string, string, number] => [
      'Product roles',
      decision.label,
      `COUNTIF(${roleRanges.decision},"${escapedFormulaString(decision.label)}")`,
      0,
    ]),
    ...CLINICAL_USE_REVIEW_CONFIDENCES.map((confidence): [string, string, string, number] => [
      'Product roles',
      `${confidence.label} confidence`,
      `COUNTIF(${roleRanges.confidence},"${confidence.label}")`,
      0,
    ]),
    ['Current slots', 'Total assignments', `COUNTA(${slotRanges.key})`, data.currentSlots.length],
    [
      'Current slots',
      'Reviewed',
      `COUNTIFS(${slotRanges.key},"<>",${slotRanges.decision},"<>")`,
      0,
    ],
    [
      'Current slots',
      'Unreviewed',
      `COUNTIFS(${slotRanges.key},"<>",${slotRanges.decision},"")`,
      data.currentSlots.length,
    ],
    ...CLINICAL_USE_SLOT_DECISIONS.map((decision): [string, string, string, number] => [
      'Current slots',
      decision.label,
      `COUNTIF(${slotRanges.decision},"${escapedFormulaString(decision.label)}")`,
      0,
    ]),
    ...CLINICAL_USE_REVIEW_CONFIDENCES.map((confidence): [string, string, string, number] => [
      'Current slots',
      `${confidence.label} confidence`,
      `COUNTIF(${slotRanges.confidence},"${confidence.label}")`,
      0,
    ]),
    [
      'Current slots',
      'Required-slot assignments reviewed',
      `COUNTIFS(${slotRanges.requiredness},"required",${slotRanges.decision},"<>")`,
      0,
    ],
  ]
  const metricStartRow = 5
  const metricXmlRows = metricRows.map(([section, label, formula, cached], index) => {
    const rowNumber = metricStartRow + index
    return rowXml(rowNumber, [
      textCell(`A${rowNumber}`, section, 13),
      textCell(`B${rowNumber}`, label, 3),
      formulaCell(`C${rowNumber}`, formula, cached),
    ])
  })

  const roleSectionRow = metricStartRow + metricRows.length + 2
  const roleHeaderRow = roleSectionRow + 1
  const roleRows = data.roleOptions.map((role, index) => {
    const rowNumber = roleHeaderRow + index + 1
    return rowXml(
      rowNumber,
      [
        textCell(`A${rowNumber}`, role.roleCode, 13),
        textCell(`B${rowNumber}`, role.roleName, 4),
        formulaCell(
          `C${rowNumber}`,
          `COUNTIF(${roleRanges.role},A${rowNumber})`,
          data.productRoles.filter((row) => row.roleCode === role.roleCode).length,
        ),
        ...CLINICAL_USE_PRODUCT_ROLE_DECISIONS.map((decision, decisionIndex) =>
          formulaCell(
            `${columnName(decisionIndex + 4)}${rowNumber}`,
            `COUNTIFS(${roleRanges.role},A${rowNumber},${roleRanges.decision},"${escapedFormulaString(
              decision.label,
            )}")`,
            0,
          ),
        ),
      ],
      30,
    )
  })

  const procedures = [
    ...new Map(
      data.currentSlots.map((row) => [row.procedureCode, row.procedureName] as const),
    ).entries(),
  ].sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]))
  const procedureSectionRow = roleHeaderRow + data.roleOptions.length + 3
  const procedureHeaderRow = procedureSectionRow + 1
  const procedureRows = procedures.map(([procedureCode, procedureName], index) => {
    const rowNumber = procedureHeaderRow + index + 1
    return rowXml(
      rowNumber,
      [
        textCell(`A${rowNumber}`, procedureCode, 13),
        textCell(`B${rowNumber}`, procedureName, 4),
        formulaCell(
          `C${rowNumber}`,
          `COUNTIF(${slotRanges.procedure},A${rowNumber})`,
          data.currentSlots.filter((row) => row.procedureCode === procedureCode).length,
        ),
        ...CLINICAL_USE_SLOT_DECISIONS.map((decision, decisionIndex) =>
          formulaCell(
            `${columnName(decisionIndex + 4)}${rowNumber}`,
            `COUNTIFS(${slotRanges.procedure},A${rowNumber},${slotRanges.decision},"${escapedFormulaString(
              decision.label,
            )}")`,
            0,
          ),
        ),
      ],
      30,
    )
  })
  const lastRow = procedureHeaderRow + procedures.length
  const breakdownHeader = (rowNumber: number, firstLabel: string) => [
    textCell(`A${rowNumber}`, firstLabel, 11),
    textCell(`B${rowNumber}`, firstLabel === 'Role Code' ? 'Role Name' : 'Procedure', 11),
    textCell(`C${rowNumber}`, 'Total', 11),
    ...Array.from({ length: 7 }, (_, index) =>
      textCell(
        `${columnName(index + 4)}${rowNumber}`,
        firstLabel === 'Role Code'
          ? CLINICAL_USE_PRODUCT_ROLE_DECISIONS[index].label
          : CLINICAL_USE_SLOT_DECISIONS[index].label,
        11,
      ),
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:J${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="44" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="10" width="25" customWidth="1"/></cols>
  <sheetData>
    ${rowXml(1, [textCell('A1', 'Clinical-use Review Summary', 1)], 30)}
    ${rowXml(2, [textCell('A2', 'Dynamic formulas recalculate when review decisions or confidence values change in Excel or LibreOffice.', 4)], 30)}
    ${rowXml(4, [textCell('A4', 'Review area', 11), textCell('B4', 'Metric', 11), textCell('C4', 'Count', 11)], 24)}
    ${metricXmlRows.join('')}
    ${rowXml(roleSectionRow, [textCell(`A${roleSectionRow}`, 'Product-role counts by role and decision', 2)], 26)}
    ${rowXml(roleHeaderRow, breakdownHeader(roleHeaderRow, 'Role Code'), 54)}
    ${roleRows.join('')}
    ${rowXml(procedureSectionRow, [textCell(`A${procedureSectionRow}`, 'Current exact-slot counts by procedure and decision', 2)], 26)}
    ${rowXml(procedureHeaderRow, breakdownHeader(procedureHeaderRow, 'Procedure Code'), 54)}
    ${procedureRows.join('')}
  </sheetData>
  <mergeCells count="4"><mergeCell ref="A1:J1"/><mergeCell ref="A2:J2"/><mergeCell ref="A${roleSectionRow}:J${roleSectionRow}"/><mergeCell ref="A${procedureSectionRow}:J${procedureSectionRow}"/></mergeCells>
  <pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="1"/>
</worksheet>`
}

function decisionDefinitionsWorksheetXml(): string {
  const productRoleSectionRow = 3
  const productRoleHeaderRow = 4
  const productRoleRows = CLINICAL_USE_PRODUCT_ROLE_DECISIONS.map((decision, index) => {
    const rowNumber = productRoleHeaderRow + index + 1
    return rowXml(
      rowNumber,
      [
        textCell(`A${rowNumber}`, decision.label, 12),
        textCell(`B${rowNumber}`, decision.value, 13),
        textCell(`C${rowNumber}`, decision.definition, 4),
      ],
      Math.max(45, Math.min(90, 30 + Math.ceil(decision.definition.length / 90) * 15)),
    )
  })
  const slotSectionRow = productRoleHeaderRow + CLINICAL_USE_PRODUCT_ROLE_DECISIONS.length + 3
  const slotHeaderRow = slotSectionRow + 1
  const slotRows = CLINICAL_USE_SLOT_DECISIONS.map((decision, index) => {
    const rowNumber = slotHeaderRow + index + 1
    return rowXml(
      rowNumber,
      [
        textCell(`A${rowNumber}`, decision.label, 12),
        textCell(`B${rowNumber}`, decision.value, 13),
        textCell(`C${rowNumber}`, decision.definition, 4),
      ],
      Math.max(45, Math.min(90, 30 + Math.ceil(decision.definition.length / 90) * 15)),
    )
  })
  const lastRow = slotHeaderRow + CLINICAL_USE_SLOT_DECISIONS.length
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:C${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="3" width="105" customWidth="1"/></cols>
  <sheetData>
    ${rowXml(1, [textCell('A1', 'Decision Definitions', 1)], 30)}
    ${rowXml(2, [textCell('A2', 'These are recommendations for later governance; no decision in this workbook changes canonical data.', 4)], 30)}
    ${rowXml(productRoleSectionRow, [textCell(`A${productRoleSectionRow}`, 'Product Role Review decisions', 2)], 26)}
    ${rowXml(productRoleHeaderRow, [textCell(`A${productRoleHeaderRow}`, 'Decision', 11), textCell(`B${productRoleHeaderRow}`, 'Normalized value', 11), textCell(`C${productRoleHeaderRow}`, 'Definition', 11)], 26)}
    ${productRoleRows.join('')}
    ${rowXml(slotSectionRow, [textCell(`A${slotSectionRow}`, 'Current Slot Review decisions', 2)], 26)}
    ${rowXml(slotHeaderRow, [textCell(`A${slotHeaderRow}`, 'Decision', 11), textCell(`B${slotHeaderRow}`, 'Normalized value', 11), textCell(`C${slotHeaderRow}`, 'Definition', 11)], 26)}
    ${slotRows.join('')}
  </sheetData>
  <mergeCells count="4"><mergeCell ref="A1:C1"/><mergeCell ref="A2:C2"/><mergeCell ref="A${productRoleSectionRow}:C${productRoleSectionRow}"/><mergeCell ref="A${slotSectionRow}:C${slotSectionRow}"/></mergeCells>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1" paperSize="1"/>
</worksheet>`
}

function lookupsWorksheetXml(
  metadata: ClinicalUseReviewWorkbookMetadata,
  data: ClinicalUseReviewData,
): string {
  const metadataEntries = Object.entries(metadata)
  const rowCount = Math.max(
    CLINICAL_USE_PRODUCT_ROLE_DECISIONS.length,
    CLINICAL_USE_SLOT_DECISIONS.length,
    CLINICAL_USE_REVIEW_CONFIDENCES.length,
    CLINICAL_USE_REVIEW_YES_NO.length,
    data.roleOptions.length,
    data.slotOptions.length,
    metadataEntries.length,
  )
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const rowNumber = index + 2
    const role = data.roleOptions[index]
    const slot = data.slotOptions[index]
    const metadataEntry = metadataEntries[index]
    return rowXml(rowNumber, [
      textCell(`A${rowNumber}`, CLINICAL_USE_PRODUCT_ROLE_DECISIONS[index]?.label ?? '', 13),
      textCell(`B${rowNumber}`, CLINICAL_USE_SLOT_DECISIONS[index]?.label ?? '', 13),
      textCell(`C${rowNumber}`, CLINICAL_USE_REVIEW_CONFIDENCES[index]?.label ?? '', 13),
      textCell(`D${rowNumber}`, CLINICAL_USE_REVIEW_YES_NO[index] ?? '', 13),
      textCell(`E${rowNumber}`, role?.roleCode ?? '', 13),
      textCell(`F${rowNumber}`, role?.roleName ?? '', 13),
      textCell(`G${rowNumber}`, slot?.slotId ?? '', 13),
      textCell(`H${rowNumber}`, slot?.procedureCode ?? '', 13),
      textCell(`I${rowNumber}`, slot?.procedureName ?? '', 13),
      textCell(`J${rowNumber}`, slot?.slotLabel ?? '', 13),
      textCell(`K${rowNumber}`, slot?.roleCode ?? '', 13),
      textCell(`L${rowNumber}`, metadataEntry?.[0] ?? '', 13),
      textCell(`M${rowNumber}`, metadataEntry?.[1] ?? '', 13),
    ])
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:M${rowCount + 1}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="2" width="38" customWidth="1"/><col min="3" max="4" width="24" customWidth="1"/><col min="5" max="5" width="30" customWidth="1"/><col min="6" max="6" width="38" customWidth="1"/><col min="7" max="8" width="24" customWidth="1"/><col min="9" max="10" width="38" customWidth="1"/><col min="11" max="11" width="30" customWidth="1"/><col min="12" max="12" width="36" customWidth="1"/><col min="13" max="13" width="72" customWidth="1"/></cols>
  <sheetData>
    ${rowXml(
      1,
      [
        textCell('A1', 'Product Role Decisions', 11),
        textCell('B1', 'Current Slot Decisions', 11),
        textCell('C1', 'Confidence Values', 11),
        textCell('D1', 'Yes / No Values', 11),
        textCell('E1', 'Role Code', 11),
        textCell('F1', 'Role Name', 11),
        textCell('G1', 'Slot ID', 11),
        textCell('H1', 'Procedure Code', 11),
        textCell('I1', 'Procedure', 11),
        textCell('J1', 'Slot Label', 11),
        textCell('K1', 'Slot Role Code', 11),
        textCell('L1', 'Metadata Field', 11),
        textCell('M1', 'Metadata Value', 11),
      ],
      34,
    )}
    ${rows.join('')}
  </sheetData>
  ${worksheetProtectionXml()}
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="2" fitToHeight="0" paperSize="1"/>
</worksheet>`
}

function assertWorkbookBuildInput(
  data: ClinicalUseReviewData,
  metadata: ClinicalUseReviewWorkbookMetadata,
) {
  if (metadata.format_version !== CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION) {
    throw new Error('Unsupported clinical-use review workbook format version.')
  }
  const expectedCounts = {
    catalog_product_count: data.catalogProducts.length,
    product_role_count: data.productRoles.length,
    current_slot_count: data.currentSlots.length,
  }
  for (const [field, count] of Object.entries(expectedCounts)) {
    if (Number(metadata[field as keyof typeof expectedCounts]) !== count) {
      throw new Error(`Workbook metadata ${field} does not match the exported rows.`)
    }
  }
  const hashes = [
    metadata.clinical_use_manifest_sha256,
    metadata.catalog_products_sha256,
    metadata.product_roles_sha256,
    metadata.roles_sha256,
    metadata.procedures_sha256,
    metadata.procedure_slots_sha256,
    metadata.slot_product_options_sha256,
  ]
  if (hashes.some((hash) => !/^[a-f0-9]{64}$/i.test(hash))) {
    throw new Error('Workbook provenance contains an invalid SHA-256 value.')
  }
}

export async function buildClinicalUseReviewWorkbookBytes(
  data: ClinicalUseReviewData,
  metadata: ClinicalUseReviewWorkbookMetadata,
): Promise<Uint8Array> {
  assertWorkbookBuildInput(data, metadata)
  const catalogSheet = catalogProductsWorksheetXml(data.catalogProducts)
  const productRoleSheet = reviewWorksheetXml(data.productRoles, PRODUCT_ROLE_DEFINITION)
  const currentSlotSheet = reviewWorksheetXml(data.currentSlots, CURRENT_SLOT_DEFINITION)
  const zip = new JSZip()
  addZipText(zip, '[Content_Types].xml', contentTypesXml())
  addZipText(zip, '_rels/.rels', packageRelationshipsXml())
  addZipText(zip, 'docProps/core.xml', corePropertiesXml(metadata.exported_at))
  addZipText(zip, 'docProps/app.xml', extendedPropertiesXml())
  addZipText(zip, 'docProps/custom.xml', customPropertiesXml(metadata))
  addZipText(zip, 'xl/workbook.xml', workbookXml(data))
  addZipText(zip, 'xl/_rels/workbook.xml.rels', workbookRelationshipsXml())
  addZipText(zip, 'xl/styles.xml', stylesXml())
  addZipText(zip, 'xl/worksheets/sheet1.xml', instructionsWorksheetXml(metadata))
  addZipText(zip, 'xl/worksheets/sheet2.xml', catalogSheet.worksheet)
  addZipText(zip, 'xl/worksheets/_rels/sheet2.xml.rels', catalogSheet.relationships)
  addZipText(zip, PRODUCT_ROLE_DEFINITION.worksheetPath, productRoleSheet.worksheet)
  addZipText(zip, PRODUCT_ROLE_DEFINITION.worksheetRelationshipPath, productRoleSheet.relationships)
  addZipText(zip, CURRENT_SLOT_DEFINITION.worksheetPath, currentSlotSheet.worksheet)
  addZipText(zip, CURRENT_SLOT_DEFINITION.worksheetRelationshipPath, currentSlotSheet.relationships)
  addZipText(zip, 'xl/worksheets/sheet5.xml', reviewSummaryWorksheetXml(data))
  addZipText(zip, 'xl/worksheets/sheet6.xml', decisionDefinitionsWorksheetXml())
  addZipText(zip, 'xl/worksheets/sheet7.xml', lookupsWorksheetXml(metadata, data))
  addZipText(
    zip,
    'xl/tables/table1.xml',
    dataTableXml(
      CLINICAL_USE_CATALOG_PRODUCT_COLUMNS,
      data.catalogProducts.length,
      1,
      'CatalogProductsTable',
    ),
  )
  addZipText(
    zip,
    PRODUCT_ROLE_DEFINITION.tablePath,
    dataTableXml(
      PRODUCT_ROLE_DEFINITION.columns,
      data.productRoles.length,
      PRODUCT_ROLE_DEFINITION.tableId,
      PRODUCT_ROLE_DEFINITION.tableName,
    ),
  )
  addZipText(
    zip,
    CURRENT_SLOT_DEFINITION.tablePath,
    dataTableXml(
      CURRENT_SLOT_DEFINITION.columns,
      data.currentSlots.length,
      CURRENT_SLOT_DEFINITION.tableId,
      CURRENT_SLOT_DEFINITION.tableName,
    ),
  )

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
    mimeType: CLINICAL_USE_REVIEW_XLSX_MIME,
  })
}

export async function getClinicalUseReviewRuntimeContext(): Promise<ClinicalUseReviewRuntimeContext> {
  const manifest = await getClinicalUseReviewArtifactManifest()
  const environmentBranch =
    process.env.VERCEL_GIT_COMMIT_REF?.trim() || process.env.GITHUB_REF_NAME?.trim()
  const environmentCommit =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.GITHUB_SHA?.trim()

  let sourceBranch = environmentBranch || ''
  let sourceCommit = environmentCommit || ''
  if (!sourceBranch || !sourceCommit) {
    try {
      const [branchResult, commitResult] = await Promise.all([
        execFileAsync('git', ['branch', '--show-current'], { cwd: process.cwd() }),
        execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd() }),
      ])
      sourceBranch ||= branchResult.stdout.trim()
      sourceCommit ||= commitResult.stdout.trim()
    } catch {
      sourceBranch ||= 'unavailable'
      sourceCommit ||= 'unavailable'
    }
  }
  return {
    manifest,
    clinicalUseManifestSha256: manifest.clinicalUseManifestSha256,
    sourceBranch: sourceBranch.slice(0, 200),
    sourceCommit: sourceCommit.slice(0, 64),
  }
}

export async function createClinicalUseReviewWorkbook(
  request: ClinicalUseReviewWorkbookExportRequest,
  applicationBaseUrl: string,
  exportedAt = new Date().toISOString(),
  runtimeContext?: ClinicalUseReviewRuntimeContext,
): Promise<ClinicalUseReviewWorkbookBuildResult> {
  const context = runtimeContext ?? (await getClinicalUseReviewRuntimeContext())
  const baseUrl = normalizedBaseUrl(applicationBaseUrl)
  const locale = safeLocale(request.locale)
  const data = getClinicalUseReviewData({
    applicationBaseUrl: baseUrl,
    locale,
    clinicalUseManifestHash: context.manifest.clinicalUseManifestSha256,
  })
  const metadata: ClinicalUseReviewWorkbookMetadata = {
    format_version: CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
    exported_at: exportedAt,
    clinical_use_manifest_sha256: context.manifest.clinicalUseManifestSha256,
    catalog_products_sha256: context.manifest.catalogProductsSha256,
    product_roles_sha256: context.manifest.productRolesSha256,
    roles_sha256: context.manifest.rolesSha256,
    procedures_sha256: context.manifest.proceduresSha256,
    procedure_slots_sha256: context.manifest.procedureSlotsSha256,
    slot_product_options_sha256: context.manifest.slotProductOptionsSha256,
    catalog_product_count: String(data.counts.catalogProducts),
    product_role_count: String(data.counts.productRoles),
    current_slot_count: String(data.counts.currentSlots),
    application_base_url: baseUrl,
    source_branch: context.sourceBranch,
    source_commit: context.sourceCommit,
    locale,
  }
  const bytes = await buildClinicalUseReviewWorkbookBytes(data, metadata)
  return {
    bytes,
    filename: `IP_Full_Catalog_Clinical_Use_Review_${exportedAt.slice(0, 10)}.xlsx`,
    metadata,
    counts: { ...data.counts },
    reviewKeys: [
      ...data.productRoles.map((row) => row.reviewKey),
      ...data.currentSlots.map((row) => row.reviewKey),
    ],
  }
}

function readWorkbookMetadata(worksheet: ParsedOoxmlWorksheet): ClinicalUseReviewWorkbookMetadata {
  const metadata = new Map<string, string>()
  for (let rowNumber = 2; rowNumber <= worksheet.maxRow; rowNumber += 1) {
    const keyCell = worksheetCell(worksheet, rowNumber, METADATA_KEY_COLUMN)
    const valueCell = worksheetCell(worksheet, rowNumber, METADATA_VALUE_COLUMN)
    if (keyCell.hasFormula || valueCell.hasFormula) {
      throw new Error('Workbook provenance metadata must not contain formulas.')
    }
    const key = keyCell.value.trim()
    if (!key) continue
    if (metadata.has(key)) throw new Error(`Workbook metadata field "${key}" is duplicated.`)
    metadata.set(key, valueCell.value.trim())
  }
  const requiredKeys = [
    'format_version',
    'exported_at',
    'clinical_use_manifest_sha256',
    'catalog_products_sha256',
    'product_roles_sha256',
    'roles_sha256',
    'procedures_sha256',
    'procedure_slots_sha256',
    'slot_product_options_sha256',
    'catalog_product_count',
    'product_role_count',
    'current_slot_count',
    'application_base_url',
    'source_branch',
    'source_commit',
    'locale',
  ] as const
  for (const key of requiredKeys) {
    if (!metadata.has(key)) throw new Error(`Required workbook metadata "${key}" is missing.`)
  }
  if (metadata.get('format_version') !== CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION) {
    throw new Error(
      `Workbook format version must be ${CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION}.`,
    )
  }
  const hashKeys = [
    'clinical_use_manifest_sha256',
    'catalog_products_sha256',
    'product_roles_sha256',
    'roles_sha256',
    'procedures_sha256',
    'procedure_slots_sha256',
    'slot_product_options_sha256',
  ] as const
  for (const key of hashKeys) {
    if (!/^[a-f0-9]{64}$/i.test(metadata.get(key) ?? '')) {
      throw new Error(`Workbook metadata "${key}" must be a valid SHA-256 value.`)
    }
  }
  const countKeys = ['catalog_product_count', 'product_role_count', 'current_slot_count'] as const
  for (const key of countKeys) {
    if (!/^\d{1,5}$/.test(metadata.get(key) ?? '')) {
      throw new Error(`Workbook metadata "${key}" is invalid.`)
    }
  }
  const exportedAt = metadata.get('exported_at') ?? ''
  if (!Number.isFinite(Date.parse(exportedAt))) {
    throw new Error('Workbook export timestamp is invalid.')
  }
  return {
    format_version: CLINICAL_USE_REVIEW_WORKBOOK_FORMAT_VERSION,
    exported_at: exportedAt,
    clinical_use_manifest_sha256: (
      metadata.get('clinical_use_manifest_sha256') ?? ''
    ).toLocaleLowerCase(),
    catalog_products_sha256: (metadata.get('catalog_products_sha256') ?? '').toLocaleLowerCase(),
    product_roles_sha256: (metadata.get('product_roles_sha256') ?? '').toLocaleLowerCase(),
    roles_sha256: (metadata.get('roles_sha256') ?? '').toLocaleLowerCase(),
    procedures_sha256: (metadata.get('procedures_sha256') ?? '').toLocaleLowerCase(),
    procedure_slots_sha256: (metadata.get('procedure_slots_sha256') ?? '').toLocaleLowerCase(),
    slot_product_options_sha256: (
      metadata.get('slot_product_options_sha256') ?? ''
    ).toLocaleLowerCase(),
    catalog_product_count: metadata.get('catalog_product_count') ?? '',
    product_role_count: metadata.get('product_role_count') ?? '',
    current_slot_count: metadata.get('current_slot_count') ?? '',
    application_base_url: normalizedBaseUrl(metadata.get('application_base_url') ?? ''),
    source_branch: (metadata.get('source_branch') ?? '').slice(0, 200),
    source_commit: (metadata.get('source_commit') ?? '').slice(0, 64),
    locale: safeLocale(metadata.get('locale') ?? 'en'),
  }
}

function validateHeaders<Row>(
  worksheet: ParsedOoxmlWorksheet,
  sheetName: string,
  columns: readonly ClinicalUseReviewColumn<Row>[],
) {
  const expectedHeaders = columns.map((column) => column.header)
  const lastColumn = columnName(expectedHeaders.length)
  if (worksheet.maxColumn > expectedHeaders.length) {
    throw new Error(`${sheetName} contains unsupported cells beyond column ${lastColumn}.`)
  }
  const actualHeaders = Array.from(
    { length: Math.max(worksheet.maxColumn, expectedHeaders.length) },
    (_, index) => worksheetCell(worksheet, 1, index + 1).value.trim(),
  )
  const duplicateHeaders = actualHeaders.filter(
    (header, index) => header && actualHeaders.indexOf(header) !== index,
  )
  if (duplicateHeaders.length > 0) {
    throw new Error(
      `${sheetName} contains duplicate headers: ${[...new Set(duplicateHeaders)].join(', ')}.`,
    )
  }
  expectedHeaders.forEach((header, index) => {
    if (actualHeaders[index] !== header) {
      throw new Error(
        `${sheetName} column ${columnName(index + 1)} must be "${header}", not "${
          actualHeaders[index] || '(blank)'
        }".`,
      )
    }
  })
}

function rowHasAnyValue<Row>(
  worksheet: ParsedOoxmlWorksheet,
  rowNumber: number,
  columns: readonly ClinicalUseReviewColumn<Row>[],
): boolean {
  return columns.some((_, index) => worksheetCell(worksheet, rowNumber, index + 1).value.trim())
}

function worksheetDataRowCount<Row>(
  worksheet: ParsedOoxmlWorksheet,
  columns: readonly ClinicalUseReviewColumn<Row>[],
): number {
  let count = 0
  for (let rowNumber = 2; rowNumber <= worksheet.maxRow; rowNumber += 1) {
    if (rowHasAnyValue(worksheet, rowNumber, columns)) count += 1
  }
  return count
}

function importRowValues<Row>(
  worksheet: ParsedOoxmlWorksheet,
  rowNumber: number,
  columns: readonly ClinicalUseReviewColumn<Row>[],
): Record<keyof Row, ParsedOoxmlCell> {
  return Object.fromEntries(
    columns.map((column, index) => [column.key, worksheetCell(worksheet, rowNumber, index + 1)]),
  ) as Record<keyof Row, ParsedOoxmlCell>
}

function normalizeExcelReviewDate(cell: ParsedOoxmlCell): string | null | undefined {
  const value = cell.value.trim()
  if (!value) return null
  if ((cell.type === 'n' || cell.type === '') && /^\d+(?:\.\d+)?$/.test(value)) {
    const serial = Number(value)
    if (serial < 36_526 || serial >= 73_416) return undefined
    const milliseconds = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000
    return new Date(milliseconds).toISOString().slice(0, 10)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined
}

function yesNoValue(value: string): boolean | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed === 'Yes') return true
  if (trimmed === 'No') return false
  return undefined
}

function issue(
  severity: ClinicalUseReviewIssue['severity'],
  code: ClinicalUseReviewIssue['code'],
  message: string,
  sheetName: WorkbookReviewSheetName,
  rowNumber: number,
  reviewKey: string | null,
  field: string | null,
): ClinicalUseReviewIssue {
  return { severity, code, message, sheetName, rowNumber, reviewKey, field }
}

function boundedPreviewValue(value: string): string {
  if (value.length <= MAX_PREVIEW_VALUE_CHARACTERS) return value
  const suffix = `… [truncated from ${value.length} characters]`
  return `${value.slice(0, MAX_PREVIEW_VALUE_CHARACTERS - suffix.length)}${suffix}`
}

function previewReviewKey(value: string | null): string | null {
  return value ? boundedPreviewValue(value) : null
}

function validateCatalogProductSheet(worksheet: ParsedOoxmlWorksheet, expectedCount: number) {
  const actualCount = worksheetDataRowCount(worksheet, CLINICAL_USE_CATALOG_PRODUCT_COLUMNS)
  if (actualCount > MAX_CATALOG_PRODUCT_ROWS) {
    throw new Error(
      `${CATALOG_PRODUCTS_SHEET} contains ${actualCount} rows; at most ${MAX_CATALOG_PRODUCT_ROWS} are accepted.`,
    )
  }
  if (actualCount !== expectedCount) {
    throw new Error(
      `Workbook metadata declares ${expectedCount} catalog products, but ${CATALOG_PRODUCTS_SHEET} contains ${actualCount} rows.`,
    )
  }
  for (let rowNumber = 2; rowNumber <= worksheet.maxRow; rowNumber += 1) {
    if (!rowHasAnyValue(worksheet, rowNumber, CLINICAL_USE_CATALOG_PRODUCT_COLUMNS)) continue
    for (const [index, column] of CLINICAL_USE_CATALOG_PRODUCT_COLUMNS.entries()) {
      const cell = worksheetCell(worksheet, rowNumber, index + 1)
      if (cell.hasFormula) {
        throw new Error(`${CATALOG_PRODUCTS_SHEET} reference rows must not contain formulas.`)
      }
      if (
        CLINICAL_USE_CATALOG_PRODUCT_IDENTIFIER_HEADERS.has(column.header) &&
        cell.value.trim() &&
        !['inlineStr', 's', 'str'].includes(cell.type)
      ) {
        throw new Error(`${CATALOG_PRODUCTS_SHEET} identifier "${column.header}" must remain text.`)
      }
    }
  }
}

interface ProcessedReviewSheet {
  rowPreviews: ClinicalUseReviewImportRowPreview[]
  allIssues: ClinicalUseReviewIssue[]
  workbookKeys: Set<string>
  currentKeys: Set<string>
  duplicateRawKeys: string[]
  protectedFieldDifferenceCount: number
}

function sharedDecisionFields(
  cells: Record<string, ParsedOoxmlCell>,
  confidence: ReturnType<typeof normalizeClinicalUseReviewConfidence>,
  reviewDate: ReturnType<typeof normalizeExcelReviewDate>,
  readyForSecondReview: ReturnType<typeof yesNoValue>,
) {
  return {
    rationale: cells.rationale.value.trim(),
    evidenceNeeded: nullableClinicalUseReviewText(cells.evidenceNeeded.value),
    reviewerName: nullableClinicalUseReviewText(cells.reviewerName.value),
    reviewerConfidence: confidence ?? null,
    reviewDate: reviewDate ?? null,
    followUpNotes: nullableClinicalUseReviewText(cells.followUpNotes.value),
    readyForSecondReview: readyForSecondReview ?? null,
    secondReviewer: nullableClinicalUseReviewText(cells.secondReviewer.value),
    secondReviewComments: nullableClinicalUseReviewText(cells.secondReviewComments.value),
  }
}

function processReviewSheet<Row extends ReviewWorkbookRow>(
  worksheet: ParsedOoxmlWorksheet,
  definition: ReviewSheetDefinition<Row>,
  currentRows: Row[],
  roleCodes: ReadonlySet<string>,
  slotIds: ReadonlySet<string>,
  workbookClinicalUseManifestHash: string,
): ProcessedReviewSheet {
  const importedRows: Array<{
    rowNumber: number
    cells: Record<string, ParsedOoxmlCell>
    rawReviewKey: string | null
    reviewKey: string | null
  }> = []
  for (let rowNumber = 2; rowNumber <= worksheet.maxRow; rowNumber += 1) {
    if (!rowHasAnyValue(worksheet, rowNumber, definition.columns)) continue
    const cells = importRowValues(worksheet, rowNumber, definition.columns) as unknown as Record<
      string,
      ParsedOoxmlCell
    >
    const rawReviewKey = nullableClinicalUseReviewText(cells.reviewKey.value)
    importedRows.push({
      rowNumber,
      cells,
      rawReviewKey,
      reviewKey: previewReviewKey(rawReviewKey),
    })
  }
  const maximumRows =
    definition.sheetName === PRODUCT_ROLE_SHEET ? MAX_PRODUCT_ROLE_ROWS : MAX_CURRENT_SLOT_ROWS
  if (importedRows.length > maximumRows) {
    throw new Error(
      `${definition.sheetName} contains ${importedRows.length} rows; at most ${maximumRows} are accepted.`,
    )
  }
  const currentByKey = new Map(currentRows.map((row) => [row.reviewKey, row]))
  const rowNumbersByKey = new Map<string, number[]>()
  for (const imported of importedRows) {
    if (!imported.rawReviewKey) continue
    rowNumbersByKey.set(imported.rawReviewKey, [
      ...(rowNumbersByKey.get(imported.rawReviewKey) ?? []),
      imported.rowNumber,
    ])
  }
  const duplicateRawKeys = [...rowNumbersByKey]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([reviewKey]) => reviewKey)
  const duplicateKeySet = new Set(duplicateRawKeys)
  const rowPreviews: ClinicalUseReviewImportRowPreview[] = []
  const allIssues: ClinicalUseReviewIssue[] = []
  let protectedFieldDifferenceCount = 0

  for (const imported of importedRows) {
    const { rowNumber, cells, reviewKey, rawReviewKey } = imported
    const issues: ClinicalUseReviewIssue[] = []
    const current =
      rawReviewKey && rawReviewKey.length <= MAX_REVIEW_KEY_CHARACTERS
        ? currentByKey.get(rawReviewKey)
        : undefined

    definition.columns.forEach((column) => {
      const cell = cells[String(column.key)]
      if (cell.hasFormula) {
        issues.push(
          issue(
            'error',
            'formula_not_allowed',
            `${column.header} contains a formula. Formula results are not trusted as review input.`,
            definition.sheetName,
            rowNumber,
            reviewKey,
            column.header,
          ),
        )
      }
      if (
        definition.identifierHeaders.has(column.header) &&
        cell.value.trim() &&
        !['inlineStr', 's', 'str'].includes(cell.type)
      ) {
        issues.push(
          issue(
            'error',
            'identifier_not_text',
            `${column.header} must remain an Excel text value.`,
            definition.sheetName,
            rowNumber,
            reviewKey,
            column.header,
          ),
        )
      }
    })

    if (!rawReviewKey || !current) {
      issues.push(
        issue(
          'error',
          'unknown_review_key',
          rawReviewKey
            ? 'Review Key does not exist in the current clinical-use artifacts.'
            : 'Review Key is required.',
          definition.sheetName,
          rowNumber,
          reviewKey,
          'Review Key',
        ),
      )
    }
    if (rawReviewKey && duplicateKeySet.has(rawReviewKey)) {
      issues.push(
        issue(
          'error',
          'duplicate_review_key',
          'Review Key appears more than once in this workbook.',
          definition.sheetName,
          rowNumber,
          reviewKey,
          'Review Key',
        ),
      )
    }

    const protectedFieldDifferences: ClinicalUseReviewImportRowPreview['protectedFieldDifferences'] =
      []
    if (current) {
      for (const [referenceIndex, column] of definition.referenceColumns.entries()) {
        const workbookValue = cells[String(column.key)].value
        const currentValue =
          column.key === 'clinicalUseManifestHash'
            ? workbookClinicalUseManifestHash
            : String(current[column.key] ?? '')
        const hyperlinkTarget =
          column.key === 'evidencePageUrl'
            ? worksheet.hyperlinks.get(`${columnName(referenceIndex + 1)}${rowNumber}`)
            : undefined
        const hyperlinkChanged =
          column.key === 'evidencePageUrl' && hyperlinkTarget !== currentValue
        if (workbookValue !== currentValue || hyperlinkChanged) {
          protectedFieldDifferences.push({
            field: column.header,
            workbookValue: hyperlinkChanged
              ? boundedPreviewValue(
                  `${workbookValue} [hyperlink: ${hyperlinkTarget || '(missing)'}]`,
                )
              : boundedPreviewValue(workbookValue),
            currentValue: boundedPreviewValue(currentValue),
          })
          issues.push(
            issue(
              'warning',
              'protected_field_changed',
              `${column.header} differs from current catalog data; current data remains authoritative.`,
              definition.sheetName,
              rowNumber,
              reviewKey,
              column.header,
            ),
          )
        }
      }
    }

    const confidence = normalizeClinicalUseReviewConfidence(cells.reviewerConfidence.value)
    const reviewDate = normalizeExcelReviewDate(cells.reviewDate)
    const readyForSecondReview = yesNoValue(cells.readyForSecondReview.value)
    const rationale = cells.rationale.value.trim()
    const editableHasValue = definition.editableColumns.some((column) =>
      cells[String(column.key)].value.trim(),
    )
    const reviewTextLimits: Array<[string, number, string]> = [
      ['rationale', MAX_REVIEW_TEXT_CHARACTERS, 'Rationale'],
      ['evidenceNeeded', MAX_REVIEW_TEXT_CHARACTERS, 'Evidence Needed'],
      ['reviewerName', MAX_REVIEWER_NAME_CHARACTERS, 'Reviewer Name'],
      ['followUpNotes', MAX_REVIEW_TEXT_CHARACTERS, 'Follow-up Notes'],
      ['secondReviewer', MAX_REVIEWER_NAME_CHARACTERS, 'Second Reviewer'],
      ['secondReviewComments', MAX_REVIEW_TEXT_CHARACTERS, 'Second-review Comments'],
    ]
    for (const [field, limit, label] of reviewTextLimits) {
      if (cells[field].value.length <= limit) continue
      issues.push(
        issue(
          'error',
          'incomplete_decision',
          `${label} exceeds the accepted ${limit}-character review limit.`,
          definition.sheetName,
          rowNumber,
          reviewKey,
          label,
        ),
      )
    }
    if (confidence === undefined) {
      issues.push(
        issue(
          'error',
          'invalid_confidence',
          'Reviewer Confidence must be blank, High, Moderate, or Low.',
          definition.sheetName,
          rowNumber,
          reviewKey,
          'Reviewer Confidence',
        ),
      )
    }
    if (reviewDate === undefined) {
      issues.push(
        issue(
          'error',
          'invalid_date',
          'Review Date must be blank, an Excel date, or text in YYYY-MM-DD format.',
          definition.sheetName,
          rowNumber,
          reviewKey,
          'Review Date',
        ),
      )
    }
    if (readyForSecondReview === undefined) {
      issues.push(
        issue(
          'error',
          'invalid_yes_no',
          'Ready for Second Review must be blank, Yes, or No.',
          definition.sheetName,
          rowNumber,
          reviewKey,
          'Ready for Second Review',
        ),
      )
    }

    let normalizedDecision: ClinicalUseReviewDecision | null = null
    if (definition.sheetName === PRODUCT_ROLE_SHEET) {
      const decision = normalizeClinicalUseProductRoleDecision(cells.decision.value)
      const suggestedRoleCode = nullableClinicalUseReviewText(cells.suggestedRoleCode.value)
      if (decision === undefined) {
        issues.push(
          issue(
            'error',
            'invalid_decision',
            'Decision must be blank or one of the allowed Product Role Review values.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Decision',
          ),
        )
      }
      const requiresSuggestedRole =
        decision === 'replace_with_different_role' || decision === 'add_another_role'
      if (requiresSuggestedRole && !suggestedRoleCode) {
        issues.push(
          issue(
            'error',
            'missing_suggested_role',
            'Suggested Role Code is required for this decision.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Suggested Role Code',
          ),
        )
      }
      if (
        suggestedRoleCode &&
        (!roleCodes.has(suggestedRoleCode) ||
          (current &&
            suggestedRoleCode === (current as ClinicalUseProductRoleWorkbookRow).roleCode))
      ) {
        issues.push(
          issue(
            'error',
            'invalid_suggested_role',
            'Suggested Role Code must identify a different current role.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Suggested Role Code',
          ),
        )
      }
      if (decision && !rationale) {
        issues.push(
          issue(
            'error',
            'missing_rationale',
            'A rationale is required for every completed decision.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Rationale',
          ),
        )
      }
      if (decision === null && editableHasValue) {
        issues.push(
          issue(
            'warning',
            'incomplete_decision',
            'Reviewer fields contain values, but Decision is blank.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Decision',
          ),
        )
      }
      const hasBlockingIssue = issues.some((candidate) => candidate.severity === 'error')
      if (!hasBlockingIssue && decision && current) {
        const currentRole = current as ClinicalUseProductRoleWorkbookRow
        normalizedDecision = {
          recordType: 'product_role',
          reviewKey: currentRole.reviewKey,
          productId: currentRole.productId,
          roleCode: currentRole.roleCode,
          decision,
          suggestedRoleCode,
          ...sharedDecisionFields(cells, confidence, reviewDate, readyForSecondReview),
        } satisfies ClinicalUseProductRoleDecision
      }
    } else {
      const decision = normalizeClinicalUseSlotDecision(cells.decision.value)
      const suggestedSlotId = nullableClinicalUseReviewText(cells.suggestedSlotId.value)
      if (decision === undefined) {
        issues.push(
          issue(
            'error',
            'invalid_decision',
            'Decision must be blank or one of the allowed Current Slot Review values.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Decision',
          ),
        )
      }
      if (decision === 'move_to_another_exact_slot' && !suggestedSlotId) {
        issues.push(
          issue(
            'error',
            'missing_suggested_slot',
            'Suggested Slot ID is required when moving an exact-slot assignment.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Suggested Slot ID',
          ),
        )
      }
      if (
        suggestedSlotId &&
        (!slotIds.has(suggestedSlotId) ||
          (current && suggestedSlotId === (current as ClinicalUseCurrentSlotWorkbookRow).slotId))
      ) {
        issues.push(
          issue(
            'error',
            'invalid_suggested_slot',
            'Suggested Slot ID must identify a different current procedure slot.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Suggested Slot ID',
          ),
        )
      }
      if (decision && !rationale) {
        issues.push(
          issue(
            'error',
            'missing_rationale',
            'A rationale is required for every completed decision.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Rationale',
          ),
        )
      }
      if (decision === null && editableHasValue) {
        issues.push(
          issue(
            'warning',
            'incomplete_decision',
            'Reviewer fields contain values, but Decision is blank.',
            definition.sheetName,
            rowNumber,
            reviewKey,
            'Decision',
          ),
        )
      }
      const hasBlockingIssue = issues.some((candidate) => candidate.severity === 'error')
      if (!hasBlockingIssue && decision && current) {
        const currentSlot = current as ClinicalUseCurrentSlotWorkbookRow
        normalizedDecision = {
          recordType: 'slot_product',
          reviewKey: currentSlot.reviewKey,
          slotId: currentSlot.slotId,
          procedureCode: currentSlot.procedureCode,
          productId: currentSlot.productId,
          roleCode: currentSlot.roleCode,
          decision,
          suggestedSlotId,
          ...sharedDecisionFields(cells, confidence, reviewDate, readyForSecondReview),
        } satisfies ClinicalUseSlotDecision
      }
    }

    const hasBlockingIssue = issues.some((candidate) => candidate.severity === 'error')
    const status: ClinicalUseReviewImportRowPreview['status'] = hasBlockingIssue
      ? current
        ? 'invalid'
        : 'unknown'
      : normalizedDecision
        ? 'valid_completed'
        : editableHasValue
          ? 'incomplete'
          : 'unreviewed'
    allIssues.push(...issues)
    protectedFieldDifferenceCount += protectedFieldDifferences.length
    const omittedIssueCount = Math.max(0, issues.length - MAX_ROW_ISSUE_DETAILS)
    const omittedDifferenceCount = Math.max(
      0,
      protectedFieldDifferences.length - MAX_ROW_PROTECTED_DIFFERENCE_DETAILS,
    )
    const boundedIssues = issues.slice(0, MAX_ROW_ISSUE_DETAILS)
    if (omittedIssueCount > 0 || omittedDifferenceCount > 0) {
      boundedIssues.push(
        issue(
          'warning',
          'preview_details_omitted',
          `${omittedIssueCount} additional row issues and ${omittedDifferenceCount} additional protected-field differences were omitted from this bounded preview. Full counts remain in the summary.`,
          definition.sheetName,
          rowNumber,
          reviewKey,
          null,
        ),
      )
    }
    rowPreviews.push({
      sheetName: definition.sheetName,
      rowNumber,
      recordType: definition.sheetName === PRODUCT_ROLE_SHEET ? 'product_role' : 'slot_product',
      reviewKey,
      status,
      protectedFieldDifferences: protectedFieldDifferences.slice(
        0,
        MAX_ROW_PROTECTED_DIFFERENCE_DETAILS,
      ),
      issues: boundedIssues,
      decision: normalizedDecision,
    })
  }

  return {
    rowPreviews,
    allIssues,
    workbookKeys: new Set(
      importedRows.flatMap((row) => (row.rawReviewKey ? [row.rawReviewKey] : [])),
    ),
    currentKeys: new Set(currentByKey.keys()),
    duplicateRawKeys,
    protectedFieldDifferenceCount,
  }
}

export async function importClinicalUseReviewWorkbook(
  bytes: Uint8Array,
  options: ClinicalUseReviewImportOptions,
): Promise<ClinicalUseReviewImportPreview> {
  if (!/^[a-f0-9]{64}$/i.test(options.currentClinicalUseManifestSha256)) {
    throw new Error('Current clinical-use manifest hash must be a SHA-256 value.')
  }
  const workbook = await parseOoxmlWorkbookBytes(bytes)
  for (const requiredSheet of CLINICAL_USE_REVIEW_SHEETS) {
    requiredWorksheet(workbook.sheets, requiredSheet)
  }
  if (
    workbook.sheetNames.length !== CLINICAL_USE_REVIEW_SHEETS.length ||
    workbook.sheetNames.some((sheetName, index) => sheetName !== CLINICAL_USE_REVIEW_SHEETS[index])
  ) {
    throw new Error(
      `Workbook must contain exactly these sheets in order: ${CLINICAL_USE_REVIEW_SHEETS.join(
        ', ',
      )}.`,
    )
  }

  const catalogWorksheet = requiredWorksheet(workbook.sheets, CATALOG_PRODUCTS_SHEET)
  const productRoleWorksheet = requiredWorksheet(workbook.sheets, PRODUCT_ROLE_SHEET)
  const currentSlotWorksheet = requiredWorksheet(workbook.sheets, CURRENT_SLOT_SHEET)
  const lookupWorksheet = requiredWorksheet(workbook.sheets, LOOKUPS_SHEET)
  validateHeaders(catalogWorksheet, CATALOG_PRODUCTS_SHEET, CLINICAL_USE_CATALOG_PRODUCT_COLUMNS)
  validateHeaders(productRoleWorksheet, PRODUCT_ROLE_SHEET, CLINICAL_USE_PRODUCT_ROLE_COLUMNS)
  validateHeaders(currentSlotWorksheet, CURRENT_SLOT_SHEET, CLINICAL_USE_CURRENT_SLOT_COLUMNS)
  const workbookMetadata = readWorkbookMetadata(lookupWorksheet)
  validateCatalogProductSheet(catalogWorksheet, Number(workbookMetadata.catalog_product_count))
  const productRoleRowCount = worksheetDataRowCount(
    productRoleWorksheet,
    CLINICAL_USE_PRODUCT_ROLE_COLUMNS,
  )
  const currentSlotRowCount = worksheetDataRowCount(
    currentSlotWorksheet,
    CLINICAL_USE_CURRENT_SLOT_COLUMNS,
  )
  if (productRoleRowCount !== Number(workbookMetadata.product_role_count)) {
    throw new Error(
      `Workbook metadata declares ${workbookMetadata.product_role_count} product-role mappings, but ${PRODUCT_ROLE_SHEET} contains ${productRoleRowCount} rows.`,
    )
  }
  if (currentSlotRowCount !== Number(workbookMetadata.current_slot_count)) {
    throw new Error(
      `Workbook metadata declares ${workbookMetadata.current_slot_count} current slot assignments, but ${CURRENT_SLOT_SHEET} contains ${currentSlotRowCount} rows.`,
    )
  }

  const currentData =
    options.currentData ??
    getClinicalUseReviewData({
      applicationBaseUrl: normalizedBaseUrl(options.applicationBaseUrl),
      locale: safeLocale(options.locale),
      clinicalUseManifestHash: options.currentClinicalUseManifestSha256.toLocaleLowerCase(),
    })
  const roleCodes = new Set(currentData.roleOptions.map((role) => role.roleCode))
  const slotIds = new Set(currentData.slotOptions.map((slot) => slot.slotId))
  const productRoleResult = processReviewSheet(
    productRoleWorksheet,
    PRODUCT_ROLE_DEFINITION,
    currentData.productRoles,
    roleCodes,
    slotIds,
    workbookMetadata.clinical_use_manifest_sha256,
  )
  const currentSlotResult = processReviewSheet(
    currentSlotWorksheet,
    CURRENT_SLOT_DEFINITION,
    currentData.currentSlots,
    roleCodes,
    slotIds,
    workbookMetadata.clinical_use_manifest_sha256,
  )
  const results = [productRoleResult, currentSlotResult]
  const rowPreviews = results.flatMap((result) => result.rowPreviews)
  const allIssues = results.flatMap((result) => result.allIssues)
  const workbookReviewKeys = new Set(results.flatMap((result) => [...result.workbookKeys]))
  const currentReviewKeys = new Set(results.flatMap((result) => [...result.currentKeys]))
  const unknownWorkbookReviewKeys = [...workbookReviewKeys]
    .filter((reviewKey) => !currentReviewKeys.has(reviewKey))
    .map(boundedPreviewValue)
    .sort()
  const missingCurrentReviewKeys = [...currentReviewKeys]
    .filter((reviewKey) => !workbookReviewKeys.has(reviewKey))
    .sort()
  const duplicateReviewKeys = results
    .flatMap((result) => result.duplicateRawKeys)
    .map(boundedPreviewValue)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort()
  const changedReviewKeys = rowPreviews
    .filter((row) => row.protectedFieldDifferences.length > 0 && row.reviewKey)
    .map((row) => row.reviewKey!)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort()
  const decisions = rowPreviews
    .flatMap((row) => (row.decision ? [row.decision] : []))
    .sort((left, right) => left.reviewKey.localeCompare(right.reviewKey))
  const blockerCodes = new Set(
    allIssues
      .filter((candidate) => candidate.severity === 'error')
      .map((candidate) => candidate.code),
  )
  const exportBlockers = [...blockerCodes].sort().map((code) => {
    switch (code) {
      case 'duplicate_review_key':
        return 'Resolve duplicate review keys.'
      case 'formula_not_allowed':
        return 'Replace formulas in review rows with entered values.'
      case 'identifier_not_text':
        return 'Restore identifier cells as text.'
      case 'invalid_confidence':
        return 'Choose only allowed confidence values.'
      case 'invalid_date':
        return 'Correct invalid review dates.'
      case 'invalid_decision':
        return 'Choose only allowed decision values.'
      case 'invalid_suggested_role':
        return 'Choose a valid different Suggested Role Code.'
      case 'invalid_suggested_slot':
        return 'Choose a valid different Suggested Slot ID.'
      case 'invalid_yes_no':
        return 'Choose Yes or No for second-review readiness.'
      case 'missing_rationale':
        return 'Add a rationale for every decision.'
      case 'missing_suggested_role':
        return 'Add a Suggested Role Code for replace/add-role decisions.'
      case 'missing_suggested_slot':
        return 'Add a Suggested Slot ID for move decisions.'
      case 'unknown_review_key':
        return 'Remove or reconcile unknown review keys.'
      default:
        return 'Correct invalid workbook rows.'
    }
  })
  const staleArtifact =
    workbookMetadata.clinical_use_manifest_sha256 !==
    options.currentClinicalUseManifestSha256.toLocaleLowerCase()
  const matchedReviewKeys = [...workbookReviewKeys].filter((reviewKey) =>
    currentReviewKeys.has(reviewKey),
  ).length
  const protectedFieldDifferenceCount = results.reduce(
    (total, result) => total + result.protectedFieldDifferenceCount,
    0,
  )
  const detailedRows = rowPreviews.filter(
    (row) =>
      row.status !== 'unreviewed' ||
      row.issues.length > 0 ||
      row.protectedFieldDifferences.length > 0,
  )

  return {
    formatVersion: CLINICAL_USE_REVIEW_EXPORT_FORMAT_VERSION,
    importedAt: options.importedAt,
    workbookFileName: options.fileName,
    workbookSha256: sha256Bytes(bytes),
    workbookMetadata,
    currentClinicalUseManifestSha256: options.currentClinicalUseManifestSha256.toLocaleLowerCase(),
    staleArtifact,
    staleWarning: staleArtifact
      ? `This workbook was exported from a different clinical-use artifact manifest. ${matchedReviewKeys} review keys match, ${missingCurrentReviewKeys.length} current rows are absent, ${changedReviewKeys.length} matched rows contain protected-field differences, and ${unknownWorkbookReviewKeys.length} workbook keys are unknown. Acknowledge this warning before exporting normalized decisions.`
      : null,
    canExportNormalized: exportBlockers.length === 0,
    exportBlockers,
    summary: {
      validCompletedDecisions: decisions.length,
      productRoleDecisions: decisions.filter((decision) => decision.recordType === 'product_role')
        .length,
      currentSlotDecisions: decisions.filter((decision) => decision.recordType === 'slot_product')
        .length,
      incompleteDecisions: rowPreviews.filter((row) => row.status === 'incomplete').length,
      rowsWithoutDecision: rowPreviews.filter((row) => row.status === 'unreviewed').length,
      invalidDecisionValues: allIssues.filter((candidate) => candidate.code === 'invalid_decision')
        .length,
      missingRationales: allIssues.filter((candidate) => candidate.code === 'missing_rationale')
        .length,
      missingSuggestedRoles: allIssues.filter(
        (candidate) => candidate.code === 'missing_suggested_role',
      ).length,
      missingSuggestedSlots: allIssues.filter(
        (candidate) => candidate.code === 'missing_suggested_slot',
      ).length,
      unknownReviewKeys: unknownWorkbookReviewKeys.length,
      staleReviewKeys: changedReviewKeys.length,
      protectedFieldDifferences: protectedFieldDifferenceCount,
      duplicateRows: new Set(
        allIssues
          .filter((candidate) => candidate.code === 'duplicate_review_key')
          .map((candidate) => `${candidate.sheetName}:${candidate.rowNumber}`),
      ).size,
      unchangedProtectedRows: rowPreviews.filter(
        (row) =>
          row.reviewKey &&
          currentReviewKeys.has(row.reviewKey) &&
          row.protectedFieldDifferences.length === 0,
      ).length,
      changedProtectedRows: rowPreviews.filter(
        (row) =>
          row.reviewKey &&
          currentReviewKeys.has(row.reviewKey) &&
          row.protectedFieldDifferences.length > 0,
      ).length,
      missingCurrentRows: missingCurrentReviewKeys.length,
      matchedReviewKeys,
    },
    missingCurrentReviewKeys,
    unknownWorkbookReviewKeys,
    duplicateReviewKeys,
    changedReviewKeys,
    reviewedReviewKeys: decisions.map((decision) => decision.reviewKey),
    decisions,
    rows: detailedRows,
  }
}
