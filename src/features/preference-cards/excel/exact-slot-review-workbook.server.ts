import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import JSZip from 'jszip'

import {
  catalogVerificationSignals,
  getCatalogVerificationRows,
  type CatalogVerificationQueueRow,
} from '@/features/preference-cards/data/catalog-verification.server'
import {
  filterSlotOptionReviewRows,
  getSlotOptionReviewRows,
  type SlotOptionReviewRow,
} from '@/features/preference-cards/data/slot-option-proposals.server'
import {
  EXACT_SLOT_REVIEW_COLUMNS,
  EXACT_SLOT_REVIEW_CONFIDENCES,
  EXACT_SLOT_REVIEW_DECISIONS,
  EXACT_SLOT_REVIEW_EDITABLE_COLUMNS,
  EXACT_SLOT_REVIEW_EXPORT_FORMAT_VERSION,
  EXACT_SLOT_REVIEW_IDENTIFIER_HEADERS,
  EXACT_SLOT_REVIEW_REFERENCE_COLUMNS,
  EXACT_SLOT_REVIEW_SHEETS,
  EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION,
  EXACT_SLOT_REVIEW_YES_NO,
  exactSlotProposalKey,
  normalizeExactSlotConfidence,
  normalizeExactSlotDecision,
  nullableTrimmed,
  type ExactSlotReviewDecision,
  type ExactSlotReviewImportPreview,
  type ExactSlotReviewImportRowPreview,
  type ExactSlotReviewIssue,
  type ExactSlotReviewWorkbookExportRequest,
  type ExactSlotReviewWorkbookMetadata,
  type ExactSlotReviewWorkbookRow,
} from '@/features/preference-cards/excel/exact-slot-review-contract'
import {
  parseOoxmlWorkbookBytes,
  type ParsedOoxmlCell,
  type ParsedOoxmlWorksheet,
} from '@/features/preference-cards/excel/ooxml-reader.server'

const execFileAsync = promisify(execFile)
const PROPOSAL_ARTIFACT_PATH = path.join(
  process.cwd(),
  'data/ip-preference-cards/generated/slot-product-option-proposals.json',
)
export const EXACT_SLOT_REVIEW_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const REVIEW_SHEET_NAME = 'Exact Slot Review'
const LOOKUPS_SHEET_NAME = 'Lookups'
const REFERENCE_COLUMN_COUNT = EXACT_SLOT_REVIEW_REFERENCE_COLUMNS.length
const REVIEW_COLUMN_COUNT = EXACT_SLOT_REVIEW_COLUMNS.length
const REVIEW_LAST_COLUMN = columnName(REVIEW_COLUMN_COUNT)
const DECISION_COLUMN = columnName(REFERENCE_COLUMN_COUNT + 1)
const CONFIDENCE_COLUMN = columnName(REFERENCE_COLUMN_COUNT + 5)
const REVIEW_DATE_COLUMN = columnName(REFERENCE_COLUMN_COUNT + 6)
const SECOND_REVIEW_COLUMN = columnName(REFERENCE_COLUMN_COUNT + 8)
const ZIP_ENTRY_DATE = new Date(1980, 0, 1, 0, 0, 0)
const MAX_REVIEW_IMPORT_ROWS = 500
const MAX_PROPOSAL_KEY_CHARACTERS = 512
const MAX_PREVIEW_VALUE_CHARACTERS = 256
const MAX_ROW_ISSUE_DETAILS = 8
const MAX_ROW_PROTECTED_DIFFERENCE_DETAILS = 4
const MAX_REVIEWER_NAME_CHARACTERS = 200
const MAX_REVIEW_TEXT_CHARACTERS = 4_000

export interface ExactSlotReviewWorkbookBuildResult {
  bytes: Uint8Array
  filename: string
  metadata: ExactSlotReviewWorkbookMetadata
  proposalKeys: string[]
}

export interface ExactSlotReviewRuntimeContext {
  proposalArtifactSha256: string
  sourceBranch: string
  sourceCommit: string
}

export interface ExactSlotReviewImportOptions {
  applicationBaseUrl: string
  fileName: string
  importedAt: string
  locale: string
  currentProposalArtifactSha256: string
  currentRows?: SlotOptionReviewRow[]
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

function textCell(reference: string, value: string, style: number): string {
  if (!value) return `<c r="${reference}" s="${style}"/>`
  const preserve = /^\s|\s$|\r|\n/.test(value) ? ' xml:space="preserve"' : ''
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t${preserve}>${xmlText(value)}</t></is></c>`
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

function evidenceSignals(row: CatalogVerificationQueueRow | undefined): string {
  if (!row) return 'catalog_context_unavailable'
  return catalogVerificationSignals
    .filter((signal) => {
      switch (signal) {
        case 'strong_match':
          return row.identityEvidence === 'strong_candidate'
        case 'weak_only':
          return row.identityEvidence === 'weak_candidate_only'
        case 'no_gudid_match':
          return row.identityEvidence === 'unmatched'
        case 'distribution_alert':
          return ['not_in_distribution', 'conflicting'].includes(row.distributionEvidence)
        case 'gtin_backfill':
          return row.hasGtinBackfillProposal
        case 'gtin_conflict':
          return row.hasGtinMismatchProposal || row.uniqueStrongGtinCount > 1
        case 'release_candidate':
          return row.hasReleaseCandidateProposal
        case 'backlog_drift':
          return (
            row.backlogDriftFields.length > 0 ||
            ['different_current_strong', 'no_current_strong'].includes(row.backlogGudidAlignment)
          )
        case 'not_in_backlog':
          return row.backlog === null
        case 'manufacturer_source_missing':
          return row.manufacturerEvidenceCount === 0
      }
    })
    .join('; ')
}

function deviceIdentifiers(row: CatalogVerificationQueueRow | undefined): string {
  if (!row) return ''
  return [...new Set([row.gtin, ...row.candidatePrimaryDis].filter(Boolean))].join(' | ')
}

export function createExactSlotReviewWorkbookRows(
  proposals: SlotOptionReviewRow[],
  metadata: ExactSlotReviewWorkbookMetadata,
): ExactSlotReviewWorkbookRow[] {
  const catalogByProduct = new Map(getCatalogVerificationRows().map((row) => [row.productId, row]))
  const baseUrl = normalizedBaseUrl(metadata.application_base_url)
  const locale = safeLocale(metadata.locale)

  return proposals.map((proposal) => {
    const catalog = catalogByProduct.get(proposal.product_id)
    return {
      proposalKey: exactSlotProposalKey(proposal.slot_id, proposal.product_id),
      procedureCode: proposal.procedure_code,
      procedure: proposal.procedureName,
      slotId: proposal.slot_id,
      slotLabel: proposal.slot_label,
      requiredness: proposal.requiredness,
      roleCode: proposal.role_code,
      productId: proposal.product_id,
      manufacturer: proposal.manufacturer ?? '',
      productName: proposal.product_name,
      catalogNumber: proposal.catalog_number ?? '',
      deviceIdentifier: deviceIdentifiers(catalog),
      roleFit: proposal.role_fit ?? '',
      verificationGrade: proposal.product_verification_grade ?? '',
      verificationStatus: catalog?.verificationStatus ?? '',
      distributionStatus: proposal.distributionEvidence,
      visibilityState: proposal.product_visibility_state ?? '',
      evidenceSignal: evidenceSignals(catalog),
      proposalReason: proposal.reason,
      sourceId: proposal.source_identifiers.primary_source_id ?? '',
      sourceLocation: proposal.source_identifiers.primary_source_location ?? '',
      evidencePageUrl: `${baseUrl}/${locale}/admin/preference-cards/catalog-qa/${encodeURIComponent(
        proposal.product_id,
      )}`,
      proposalArtifactHash: metadata.proposal_artifact_sha256,
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
  })
}

export function selectExactSlotReviewRows(
  request: ExactSlotReviewWorkbookExportRequest,
  allRows = getSlotOptionReviewRows(),
): SlotOptionReviewRow[] {
  switch (request.scope) {
    case 'filtered':
      return filterSlotOptionReviewRows(allRows, request.filters ?? {})
    case 'required':
      return allRows.filter((row) => row.requiredness.trim().toLocaleLowerCase() === 'required')
    case 'unreviewed': {
      const reviewed = new Set(request.reviewedProposalKeys ?? [])
      return allRows.filter(
        (row) => !reviewed.has(exactSlotProposalKey(row.slot_id, row.product_id)),
      )
    }
    case 'product':
      return request.productId ? allRows.filter((row) => row.product_id === request.productId) : []
    case 'all':
      return allRows
  }
}

export async function getExactSlotReviewRuntimeContext(): Promise<ExactSlotReviewRuntimeContext> {
  const proposalArtifactSha256 = sha256Bytes(await readFile(PROPOSAL_ARTIFACT_PATH))
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
    proposalArtifactSha256,
    sourceBranch: sourceBranch.slice(0, 200),
    sourceCommit: sourceCommit.slice(0, 64),
  }
}

function contentTypesXml(): string {
  const worksheetOverrides = EXACT_SLOT_REVIEW_SHEETS.map(
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheetOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>
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

function workbookXml(): string {
  const sheets = EXACT_SLOT_REVIEW_SHEETS.map(
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
    <definedName name="DecisionOptions">'Lookups'!$A$2:$A$${EXACT_SLOT_REVIEW_DECISIONS.length + 1}</definedName>
    <definedName name="ConfidenceOptions">'Lookups'!$B$2:$B$${EXACT_SLOT_REVIEW_CONFIDENCES.length + 1}</definedName>
    <definedName name="YesNoOptions">'Lookups'!$C$2:$C$${EXACT_SLOT_REVIEW_YES_NO.length + 1}</definedName>
  </definedNames>
  <calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`
}

function workbookRelationshipsXml(): string {
  const worksheetRelationships = EXACT_SLOT_REVIEW_SHEETS.map(
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRelationships}
  <Relationship Id="rId${EXACT_SLOT_REVIEW_SHEETS.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function stylesXml(): string {
  const decisionDifferentialFormats = [
    ['E2F0D9', '375623'],
    ['FCE4D6', '843C0C'],
    ['FFF2CC', '7F6000'],
    ['DDEBF7', '1F4E78'],
    ['E4DFEC', '5F497A'],
    ['E7E6E6', '3F3F3F'],
  ]
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
  <cellXfs count="14">
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
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="${decisionDifferentialFormats.length ? 6 : 0}">${decisionDifferentialFormats}</dxfs>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`
}

function corePropertiesXml(exportedAt: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>IP Exact-slot Clinician Review</dc:title>
  <dc:subject>Clinician recommendations for exact-slot catalog proposals</dc:subject>
  <dc:creator>Interventional Pulmonology Education</dc:creator>
  <cp:lastModifiedBy>Interventional Pulmonology Education</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${xmlText(exportedAt)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${xmlText(exportedAt)}</dcterms:modified>
</cp:coreProperties>`
}

function extendedPropertiesXml(): string {
  const titles = EXACT_SLOT_REVIEW_SHEETS.map(
    (name) => `<vt:lpstr>${xmlText(name)}</vt:lpstr>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel Compatible</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${EXACT_SLOT_REVIEW_SHEETS.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${EXACT_SLOT_REVIEW_SHEETS.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>
  <Company>Interventional Pulmonology Education</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`
}

function customPropertiesXml(metadata: ExactSlotReviewWorkbookMetadata): string {
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

function instructionsWorksheetXml(
  metadata: ExactSlotReviewWorkbookMetadata,
  proposalCount: number,
): string {
  const instructionRows: Array<[string, string]> = [
    [
      'Purpose',
      'Review whether each listed product appears clinically appropriate for the exact procedure slot shown. Use the website evidence page for source context.',
    ],
    [
      'Recommendation boundary',
      'A decision in this workbook is a review recommendation, not catalog approval. Exporting, editing, or importing this workbook does not change canonical catalog data.',
    ],
    [
      'Editable columns',
      'Enter information only in the yellow columns on the Exact Slot Review sheet: Decision, Rationale, Evidence Needed, Reviewer Name, Reviewer Confidence, Review Date, Follow-up Notes, Ready for Second Review, Second Reviewer, and Second-review Comments.',
    ],
    [
      'Protected columns',
      'Blue reference columns are protected to reduce accidental edits. Protection is a usability aid, not a security boundary. Current proposal data remains authoritative during import.',
    ],
    [
      'Required rationale',
      'Every nonblank Decision requires a Rationale. Choose Decision, Reviewer Confidence, and Ready for Second Review from their dropdown lists.',
    ],
    [
      'Patient information',
      'Do not enter patient names, identifiers, dates of birth, medical record numbers, or any other patient information anywhere in this workbook.',
    ],
    [
      'Save and return',
      'Save the completed file as an .xlsx workbook without macros. Return it through the Exact-slot workbook import page, review the validation preview, then download the normalized JSON or CSV review artifact.',
    ],
    [
      'Stale workbooks',
      'If the proposal artifact has changed, import remains preview-only until you explicitly acknowledge the stale-workbook warning. Rows are matched by Proposal Key, never by row position.',
    ],
    ['Workbook format version', metadata.format_version],
    ['Export timestamp (UTC)', metadata.exported_at],
    ['Proposal artifact SHA-256', metadata.proposal_artifact_sha256],
    ['Proposal count', String(proposalCount)],
  ]
  const rows = [
    rowXml(1, [textCell('A1', 'IP Exact-slot Clinician Review', 1)], 30),
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
  <cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="105" customWidth="1"/></cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/></mergeCells>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1" paperSize="1"/>
</worksheet>`
}

function reviewWorksheetXml(rows: ExactSlotReviewWorkbookRow[]): {
  worksheet: string
  relationships: string
} {
  const lastRow = Math.max(2, rows.length + 1)
  const columns = EXACT_SLOT_REVIEW_COLUMNS.map(
    (column, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
  ).join('')
  const headerRow = rowXml(
    1,
    EXACT_SLOT_REVIEW_COLUMNS.map((column, index) =>
      textCell(`${columnName(index + 1)}1`, column.header, 5),
    ),
    36,
  )
  const dataRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 2
    return rowXml(
      rowNumber,
      EXACT_SLOT_REVIEW_COLUMNS.map((column, columnIndex) => {
        const reference = `${columnName(columnIndex + 1)}${rowNumber}`
        const style =
          column.key === 'evidencePageUrl'
            ? 9
            : column.key === 'reviewDate'
              ? 8
              : column.editable
                ? 7
                : 6
        return textCell(reference, row[column.key], style)
      }),
      45,
    )
  })
  const conditionalFormatting = EXACT_SLOT_REVIEW_DECISIONS.map(
    (decision, index) =>
      `<cfRule type="expression" dxfId="${index}" priority="${index + 1}" stopIfTrue="1"><formula>$${DECISION_COLUMN}2="${xmlText(
        decision.label,
      )}"</formula></cfRule>`,
  ).join('')
  const hyperlinks = rows.length
    ? `<hyperlinks>${rows
        .map(
          (_, index) =>
            `<hyperlink ref="V${index + 2}" r:id="rId${index + 2}" display="Open evidence page"/>`,
        )
        .join('')}</hyperlinks>`
    : ''
  return {
    worksheet: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${REVIEW_LAST_COLUMN}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane xSplit="4" ySplit="1" topLeftCell="E2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="${DECISION_COLUMN}2" sqref="${DECISION_COLUMN}2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columns}</cols>
  <sheetData>${headerRow}${dataRows.join('')}</sheetData>
  <sheetProtection sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" insertHyperlinks="1" deleteColumns="1" deleteRows="1" selectLockedCells="0" selectUnlockedCells="0" sort="0" autoFilter="0"/>
  <conditionalFormatting sqref="${DECISION_COLUMN}2:${DECISION_COLUMN}${lastRow}">${conditionalFormatting}</conditionalFormatting>
  <dataValidations count="4">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1" errorStyle="stop" errorTitle="Invalid decision" error="Choose a decision from the dropdown list." promptTitle="Clinician recommendation" prompt="Choose one allowed recommendation. A rationale is required." sqref="${DECISION_COLUMN}2:${DECISION_COLUMN}${lastRow}"><formula1>DecisionOptions</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid confidence" error="Choose High, Moderate, or Low." sqref="${CONFIDENCE_COLUMN}2:${CONFIDENCE_COLUMN}${lastRow}"><formula1>ConfidenceOptions</formula1></dataValidation>
    <dataValidation type="date" operator="between" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid review date" error="Enter an Excel date from 2000 through 2100." sqref="${REVIEW_DATE_COLUMN}2:${REVIEW_DATE_COLUMN}${lastRow}"><formula1>DATE(2000,1,1)</formula1><formula2>DATE(2100,12,31)</formula2></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Invalid second-review state" error="Choose Yes or No." sqref="${SECOND_REVIEW_COLUMN}2:${SECOND_REVIEW_COLUMN}${lastRow}"><formula1>YesNoOptions</formula1></dataValidation>
  </dataValidations>
  ${hyperlinks}
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="4" fitToHeight="0" paperSize="1"/>
  <ignoredErrors><ignoredError sqref="A2:W${lastRow}" numberStoredAsText="1"/></ignoredErrors>
  <tableParts count="1"><tablePart r:id="rId1"/></tableParts>
</worksheet>`,
    relationships: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
  ${rows
    .map(
      (row, index) =>
        `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlAttribute(row.evidencePageUrl)}" TargetMode="External"/>`,
    )
    .join('')}
</Relationships>`,
  }
}

function reviewTableXml(rowCount: number): string {
  const lastRow = Math.max(1, rowCount + 1)
  const columns = EXACT_SLOT_REVIEW_COLUMNS.map(
    (column, index) => `<tableColumn id="${index + 1}" name="${xmlAttribute(column.header)}"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="ExactSlotReviewTable" displayName="ExactSlotReviewTable" ref="A1:${REVIEW_LAST_COLUMN}${lastRow}" totalsRowShown="0">
  <autoFilter ref="A1:${REVIEW_LAST_COLUMN}${lastRow}"/>
  <tableColumns count="${REVIEW_COLUMN_COUNT}">${columns}</tableColumns>
  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`
}

function reviewSummaryWorksheetXml(rows: ExactSlotReviewWorkbookRow[]): string {
  const dataLastRow = Math.max(2, rows.length + 1)
  const ranges = {
    proposal: `'${REVIEW_SHEET_NAME}'!$A$2:$A$${dataLastRow}`,
    procedureCode: `'${REVIEW_SHEET_NAME}'!$B$2:$B$${dataLastRow}`,
    requiredness: `'${REVIEW_SHEET_NAME}'!$F$2:$F$${dataLastRow}`,
    manufacturer: `'${REVIEW_SHEET_NAME}'!$I$2:$I$${dataLastRow}`,
    decision: `'${REVIEW_SHEET_NAME}'!$${DECISION_COLUMN}$2:$${DECISION_COLUMN}$${dataLastRow}`,
    confidence: `'${REVIEW_SHEET_NAME}'!$${CONFIDENCE_COLUMN}$2:$${CONFIDENCE_COLUMN}$${dataLastRow}`,
  }
  const metricRows: Array<[string, string, number]> = [
    ['Total proposals', `COUNTA(${ranges.proposal})`, rows.length],
    ['Reviewed', `COUNTIFS(${ranges.proposal},"<>",${ranges.decision},"<>")`, 0],
    ['Unreviewed', `COUNTIFS(${ranges.proposal},"<>",${ranges.decision},"")`, rows.length],
    ...EXACT_SLOT_REVIEW_DECISIONS.map((decision): [string, string, number] => [
      decision.label,
      `COUNTIF(${ranges.decision},"${decision.label}")`,
      0,
    ]),
    ...EXACT_SLOT_REVIEW_CONFIDENCES.map((confidence): [string, string, number] => [
      `${confidence.label} confidence`,
      `COUNTIF(${ranges.confidence},"${confidence.label}")`,
      0,
    ]),
    [
      'Required-slot proposals reviewed',
      `COUNTIFS(${ranges.requiredness},"required",${ranges.decision},"<>")`,
      0,
    ],
    [
      'Procedures represented',
      `SUMPRODUCT((${ranges.procedureCode}<>"")/COUNTIF(${ranges.procedureCode},${ranges.procedureCode}&""))`,
      new Set(rows.map((row) => row.procedureCode)).size,
    ],
    [
      'Manufacturers represented',
      `SUMPRODUCT((${ranges.manufacturer}<>"")/COUNTIF(${ranges.manufacturer},${ranges.manufacturer}&""))`,
      new Set(rows.map((row) => row.manufacturer).filter(Boolean)).size,
    ],
  ]
  const procedureEntries = [
    ...new Map(rows.map((row) => [row.procedureCode, row.procedure])).entries(),
  ].sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]))
  const metricXmlRows = metricRows.map(([label, formula, cached], index) => {
    const rowNumber = index + 5
    return rowXml(rowNumber, [
      textCell(`A${rowNumber}`, label, 3),
      formulaCell(`B${rowNumber}`, formula, cached),
    ])
  })
  const procedureHeaderRow = metricRows.length + 7
  const procedureHeaderCells = [
    textCell(`A${procedureHeaderRow}`, 'Procedure Code', 11),
    textCell(`B${procedureHeaderRow}`, 'Procedure', 11),
    textCell(`C${procedureHeaderRow}`, 'Total', 11),
    ...EXACT_SLOT_REVIEW_DECISIONS.map((decision, index) =>
      textCell(`${columnName(index + 4)}${procedureHeaderRow}`, decision.label, 11),
    ),
  ]
  const procedureXmlRows = procedureEntries.map(([code, name], index) => {
    const rowNumber = procedureHeaderRow + index + 1
    return rowXml(
      rowNumber,
      [
        textCell(`A${rowNumber}`, code, 13),
        textCell(`B${rowNumber}`, name, 4),
        formulaCell(
          `C${rowNumber}`,
          `COUNTIF(${ranges.procedureCode},A${rowNumber})`,
          rows.filter((row) => row.procedureCode === code).length,
        ),
        ...EXACT_SLOT_REVIEW_DECISIONS.map((decision, decisionIndex) =>
          formulaCell(
            `${columnName(decisionIndex + 4)}${rowNumber}`,
            `COUNTIFS(${ranges.procedureCode},A${rowNumber},${ranges.decision},"${decision.label}")`,
            0,
          ),
        ),
      ],
      30,
    )
  })
  const lastRow = procedureHeaderRow + procedureEntries.length
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:I${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="36" customWidth="1"/><col min="2" max="2" width="42" customWidth="1"/><col min="3" max="9" width="24" customWidth="1"/></cols>
  <sheetData>
    ${rowXml(1, [textCell('A1', 'Review Summary', 1)], 30)}
    ${rowXml(2, [textCell('A2', 'Dynamic formulas recalculate when decisions or confidence values change in Excel or LibreOffice.', 4)], 30)}
    ${rowXml(4, [textCell('A4', 'Metric', 11), textCell('B4', 'Count', 11)], 24)}
    ${metricXmlRows.join('')}
    ${rowXml(procedureHeaderRow - 1, [textCell(`A${procedureHeaderRow - 1}`, 'Counts by procedure and decision', 2)], 26)}
    ${rowXml(procedureHeaderRow, procedureHeaderCells, 54)}
    ${procedureXmlRows.join('')}
  </sheetData>
  <mergeCells count="3"><mergeCell ref="A1:I1"/><mergeCell ref="A2:I2"/><mergeCell ref="A${procedureHeaderRow - 1}:I${procedureHeaderRow - 1}"/></mergeCells>
  <pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="1"/>
</worksheet>`
}

function decisionDefinitionsWorksheetXml(): string {
  const rows = EXACT_SLOT_REVIEW_DECISIONS.map((decision, index) => {
    const rowNumber = index + 3
    return rowXml(
      rowNumber,
      [
        textCell(`A${rowNumber}`, decision.label, 12),
        textCell(`B${rowNumber}`, decision.definition, 4),
      ],
      Math.max(45, Math.min(90, 30 + Math.ceil(decision.definition.length / 90) * 15)),
    )
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:B${EXACT_SLOT_REVIEW_DECISIONS.length + 2}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="2" width="105" customWidth="1"/></cols>
  <sheetData>
    ${rowXml(1, [textCell('A1', 'Decision Definitions', 1)], 30)}
    ${rowXml(2, [textCell('A2', 'Decision', 11), textCell('B2', 'Definition', 11)], 26)}
    ${rows.join('')}
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1" paperSize="1"/>
</worksheet>`
}

function lookupsWorksheetXml(metadata: ExactSlotReviewWorkbookMetadata): string {
  const metadataEntries = Object.entries(metadata)
  const rowCount = Math.max(
    EXACT_SLOT_REVIEW_DECISIONS.length,
    EXACT_SLOT_REVIEW_CONFIDENCES.length,
    EXACT_SLOT_REVIEW_YES_NO.length,
    metadataEntries.length,
  )
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const rowNumber = index + 2
    const metadataEntry = metadataEntries[index]
    return rowXml(rowNumber, [
      textCell(`A${rowNumber}`, EXACT_SLOT_REVIEW_DECISIONS[index]?.label ?? '', 13),
      textCell(`B${rowNumber}`, EXACT_SLOT_REVIEW_CONFIDENCES[index]?.label ?? '', 13),
      textCell(`C${rowNumber}`, EXACT_SLOT_REVIEW_YES_NO[index] ?? '', 13),
      textCell(`D${rowNumber}`, metadataEntry?.[0] ?? '', 13),
      textCell(`E${rowNumber}`, metadataEntry?.[1] ?? '', 13),
    ])
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:E${rowCount + 1}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="3" width="24" customWidth="1"/><col min="4" max="4" width="34" customWidth="1"/><col min="5" max="5" width="72" customWidth="1"/></cols>
  <sheetData>
    ${rowXml(
      1,
      [
        textCell('A1', 'Decision Values', 11),
        textCell('B1', 'Confidence Values', 11),
        textCell('C1', 'Yes / No Values', 11),
        textCell('D1', 'Metadata Field', 11),
        textCell('E1', 'Metadata Value', 11),
      ],
      34,
    )}
    ${rows.join('')}
  </sheetData>
  <sheetProtection sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" insertHyperlinks="1" deleteColumns="1" deleteRows="1" selectLockedCells="0" selectUnlockedCells="0"/>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1" paperSize="1"/>
</worksheet>`
}

function addZipText(zip: JSZip, archivePath: string, content: string) {
  zip.file(archivePath, content, {
    date: ZIP_ENTRY_DATE,
    createFolders: false,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export async function buildExactSlotReviewWorkbookBytes(
  rows: ExactSlotReviewWorkbookRow[],
  metadata: ExactSlotReviewWorkbookMetadata,
): Promise<Uint8Array> {
  if (metadata.format_version !== EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION) {
    throw new Error('Unsupported clinician review workbook format version.')
  }
  if (Number(metadata.proposal_count) !== rows.length) {
    throw new Error('Workbook metadata proposal count does not match the exported rows.')
  }
  const reviewSheet = reviewWorksheetXml(rows)
  const zip = new JSZip()
  addZipText(zip, '[Content_Types].xml', contentTypesXml())
  addZipText(zip, '_rels/.rels', packageRelationshipsXml())
  addZipText(zip, 'docProps/core.xml', corePropertiesXml(metadata.exported_at))
  addZipText(zip, 'docProps/app.xml', extendedPropertiesXml())
  addZipText(zip, 'docProps/custom.xml', customPropertiesXml(metadata))
  addZipText(zip, 'xl/workbook.xml', workbookXml())
  addZipText(zip, 'xl/_rels/workbook.xml.rels', workbookRelationshipsXml())
  addZipText(zip, 'xl/styles.xml', stylesXml())
  addZipText(zip, 'xl/worksheets/sheet1.xml', instructionsWorksheetXml(metadata, rows.length))
  addZipText(zip, 'xl/worksheets/sheet2.xml', reviewSheet.worksheet)
  addZipText(zip, 'xl/worksheets/_rels/sheet2.xml.rels', reviewSheet.relationships)
  addZipText(zip, 'xl/worksheets/sheet3.xml', reviewSummaryWorksheetXml(rows))
  addZipText(zip, 'xl/worksheets/sheet4.xml', decisionDefinitionsWorksheetXml())
  addZipText(zip, 'xl/worksheets/sheet5.xml', lookupsWorksheetXml(metadata))
  addZipText(zip, 'xl/tables/table1.xml', reviewTableXml(rows.length))

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
    mimeType: EXACT_SLOT_REVIEW_XLSX_MIME,
  })
}

export async function createExactSlotReviewWorkbook(
  request: ExactSlotReviewWorkbookExportRequest,
  applicationBaseUrl: string,
  exportedAt = new Date().toISOString(),
  runtimeContext?: ExactSlotReviewRuntimeContext,
): Promise<ExactSlotReviewWorkbookBuildResult> {
  const context = runtimeContext ?? (await getExactSlotReviewRuntimeContext())
  const selectedRows = selectExactSlotReviewRows(request)
  const metadata: ExactSlotReviewWorkbookMetadata = {
    format_version: EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION,
    exported_at: exportedAt,
    proposal_artifact_sha256: context.proposalArtifactSha256,
    proposal_count: String(selectedRows.length),
    application_base_url: normalizedBaseUrl(applicationBaseUrl),
    source_branch: context.sourceBranch,
    source_commit: context.sourceCommit,
    locale: safeLocale(request.locale),
  }
  const workbookRows = createExactSlotReviewWorkbookRows(selectedRows, metadata)
  const bytes = await buildExactSlotReviewWorkbookBytes(workbookRows, metadata)
  return {
    bytes,
    filename: `IP_Exact_Slot_Clinician_Review_${exportedAt.slice(0, 10)}.xlsx`,
    metadata,
    proposalKeys: workbookRows.map((row) => row.proposalKey),
  }
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

function readWorkbookMetadata(worksheet: ParsedOoxmlWorksheet): ExactSlotReviewWorkbookMetadata {
  const metadata = new Map<string, string>()
  for (let rowNumber = 2; rowNumber <= worksheet.maxRow; rowNumber += 1) {
    const keyCell = worksheetCell(worksheet, rowNumber, 4)
    const valueCell = worksheetCell(worksheet, rowNumber, 5)
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
    'proposal_artifact_sha256',
    'proposal_count',
    'application_base_url',
    'source_branch',
    'source_commit',
    'locale',
  ] as const
  for (const key of requiredKeys) {
    if (!metadata.has(key)) throw new Error(`Required workbook metadata "${key}" is missing.`)
  }
  if (metadata.get('format_version') !== EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION) {
    throw new Error(`Workbook format version must be ${EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION}.`)
  }
  const proposalArtifactSha256 = metadata.get('proposal_artifact_sha256') ?? ''
  if (!/^[a-f0-9]{64}$/i.test(proposalArtifactSha256)) {
    throw new Error('Workbook proposal artifact SHA-256 is invalid.')
  }
  const proposalCount = metadata.get('proposal_count') ?? ''
  if (!/^\d{1,5}$/.test(proposalCount)) {
    throw new Error('Workbook proposal count is invalid.')
  }
  const exportedAt = metadata.get('exported_at') ?? ''
  if (!Number.isFinite(Date.parse(exportedAt))) {
    throw new Error('Workbook export timestamp is invalid.')
  }
  const applicationBaseUrl = normalizedBaseUrl(metadata.get('application_base_url') ?? '')
  return {
    format_version: EXACT_SLOT_REVIEW_WORKBOOK_FORMAT_VERSION,
    exported_at: exportedAt,
    proposal_artifact_sha256: proposalArtifactSha256.toLocaleLowerCase(),
    proposal_count: proposalCount,
    application_base_url: applicationBaseUrl,
    source_branch: (metadata.get('source_branch') ?? '').slice(0, 200),
    source_commit: (metadata.get('source_commit') ?? '').slice(0, 64),
    locale: safeLocale(metadata.get('locale') ?? 'en'),
  }
}

function validateReviewHeaders(worksheet: ParsedOoxmlWorksheet) {
  const expectedHeaders = EXACT_SLOT_REVIEW_COLUMNS.map((column) => column.header)
  if (worksheet.maxColumn > expectedHeaders.length) {
    throw new Error(
      `Exact Slot Review contains unsupported cells beyond column ${REVIEW_LAST_COLUMN}.`,
    )
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
      `Exact Slot Review contains duplicate headers: ${[...new Set(duplicateHeaders)].join(', ')}.`,
    )
  }
  expectedHeaders.forEach((header, index) => {
    if (actualHeaders[index] !== header) {
      throw new Error(
        `Exact Slot Review column ${columnName(index + 1)} must be "${header}", not "${
          actualHeaders[index] || '(blank)'
        }".`,
      )
    }
  })
  const unexpectedHeaders = actualHeaders
    .slice(expectedHeaders.length)
    .filter((header) => header.length > 0)
  if (unexpectedHeaders.length > 0) {
    throw new Error(
      `Exact Slot Review contains unsupported headers: ${unexpectedHeaders.join(', ')}.`,
    )
  }
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
  severity: ExactSlotReviewIssue['severity'],
  code: ExactSlotReviewIssue['code'],
  message: string,
  rowNumber: number,
  proposalKey: string | null,
  field: string | null,
): ExactSlotReviewIssue {
  return { severity, code, message, rowNumber, proposalKey, field }
}

function boundedPreviewValue(value: string): string {
  if (value.length <= MAX_PREVIEW_VALUE_CHARACTERS) return value
  const suffix = `… [truncated from ${value.length} characters]`
  return `${value.slice(0, MAX_PREVIEW_VALUE_CHARACTERS - suffix.length)}${suffix}`
}

function previewProposalKey(value: string | null): string | null {
  return value ? boundedPreviewValue(value) : null
}

function rowHasAnyValue(worksheet: ParsedOoxmlWorksheet, rowNumber: number): boolean {
  return Array.from({ length: REVIEW_COLUMN_COUNT }, (_, index) =>
    worksheetCell(worksheet, rowNumber, index + 1).value.trim(),
  ).some(Boolean)
}

function importRowValues(
  worksheet: ParsedOoxmlWorksheet,
  rowNumber: number,
): Record<keyof ExactSlotReviewWorkbookRow, ParsedOoxmlCell> {
  return Object.fromEntries(
    EXACT_SLOT_REVIEW_COLUMNS.map((column, index) => [
      column.key,
      worksheetCell(worksheet, rowNumber, index + 1),
    ]),
  ) as Record<keyof ExactSlotReviewWorkbookRow, ParsedOoxmlCell>
}

function currentReferenceRows(
  currentRows: SlotOptionReviewRow[],
  metadata: ExactSlotReviewWorkbookMetadata,
  options: ExactSlotReviewImportOptions,
): Map<string, ExactSlotReviewWorkbookRow> {
  const authoritativeMetadata: ExactSlotReviewWorkbookMetadata = {
    ...metadata,
    application_base_url: normalizedBaseUrl(options.applicationBaseUrl),
    locale: safeLocale(options.locale),
    proposal_artifact_sha256: options.currentProposalArtifactSha256.toLocaleLowerCase(),
  }
  return new Map(
    createExactSlotReviewWorkbookRows(currentRows, authoritativeMetadata).map((row) => [
      row.proposalKey,
      row,
    ]),
  )
}

export async function importExactSlotReviewWorkbook(
  bytes: Uint8Array,
  options: ExactSlotReviewImportOptions,
): Promise<ExactSlotReviewImportPreview> {
  const workbook = await parseOoxmlWorkbookBytes(bytes)
  for (const requiredSheet of EXACT_SLOT_REVIEW_SHEETS) {
    requiredWorksheet(workbook.sheets, requiredSheet)
  }
  if (
    workbook.sheetNames.length !== EXACT_SLOT_REVIEW_SHEETS.length ||
    workbook.sheetNames.some((sheetName, index) => sheetName !== EXACT_SLOT_REVIEW_SHEETS[index])
  ) {
    throw new Error(
      `Workbook must contain exactly these sheets in order: ${EXACT_SLOT_REVIEW_SHEETS.join(', ')}.`,
    )
  }
  const reviewWorksheet = requiredWorksheet(workbook.sheets, REVIEW_SHEET_NAME)
  const lookupWorksheet = requiredWorksheet(workbook.sheets, LOOKUPS_SHEET_NAME)
  validateReviewHeaders(reviewWorksheet)
  const workbookMetadata = readWorkbookMetadata(lookupWorksheet)
  const currentRows = options.currentRows ?? getSlotOptionReviewRows()
  const currentByKey = currentReferenceRows(currentRows, workbookMetadata, options)
  const importedRows: Array<{
    rowNumber: number
    cells: Record<keyof ExactSlotReviewWorkbookRow, ParsedOoxmlCell>
    rawProposalKey: string | null
    proposalKey: string | null
  }> = []

  for (let rowNumber = 2; rowNumber <= reviewWorksheet.maxRow; rowNumber += 1) {
    if (!rowHasAnyValue(reviewWorksheet, rowNumber)) continue
    const cells = importRowValues(reviewWorksheet, rowNumber)
    const rawProposalKey = nullableTrimmed(cells.proposalKey.value)
    importedRows.push({
      rowNumber,
      cells,
      rawProposalKey,
      proposalKey: previewProposalKey(rawProposalKey),
    })
  }
  if (importedRows.length > MAX_REVIEW_IMPORT_ROWS) {
    throw new Error(
      `Exact Slot Review contains ${importedRows.length} rows; at most ${MAX_REVIEW_IMPORT_ROWS} review rows are accepted.`,
    )
  }
  if (Number(workbookMetadata.proposal_count) !== importedRows.length) {
    throw new Error(
      `Workbook metadata declares ${workbookMetadata.proposal_count} proposals, but the review sheet contains ${importedRows.length} rows.`,
    )
  }

  const rowNumbersByKey = new Map<string, number[]>()
  for (const imported of importedRows) {
    if (!imported.rawProposalKey) continue
    rowNumbersByKey.set(imported.rawProposalKey, [
      ...(rowNumbersByKey.get(imported.rawProposalKey) ?? []),
      imported.rowNumber,
    ])
  }
  const duplicateRawProposalKeys = [...rowNumbersByKey]
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([proposalKey]) => proposalKey)
  const duplicateProposalKeys = duplicateRawProposalKeys.map(boundedPreviewValue).sort()
  const duplicateKeySet = new Set(duplicateRawProposalKeys)
  const rowPreviews: ExactSlotReviewImportRowPreview[] = []
  const allIssues: ExactSlotReviewIssue[] = []
  let protectedFieldDifferenceCount = 0

  for (const imported of importedRows) {
    const { rowNumber, cells, proposalKey, rawProposalKey } = imported
    const issues: ExactSlotReviewIssue[] = []
    const current =
      rawProposalKey && rawProposalKey.length <= MAX_PROPOSAL_KEY_CHARACTERS
        ? currentByKey.get(rawProposalKey)
        : undefined

    EXACT_SLOT_REVIEW_COLUMNS.forEach((column) => {
      const cell = cells[column.key]
      if (cell.value.length > 32_767) {
        issues.push(
          issue(
            'error',
            column.editable ? 'incomplete_decision' : 'protected_field_changed',
            `${column.header} exceeds Excel's accepted cell length.`,
            rowNumber,
            proposalKey,
            column.header,
          ),
        )
      }
      if (cell.hasFormula) {
        issues.push(
          issue(
            'error',
            'formula_not_allowed',
            `${column.header} contains a formula. Formula results are not trusted as review input.`,
            rowNumber,
            proposalKey,
            column.header,
          ),
        )
      }
      if (
        EXACT_SLOT_REVIEW_IDENTIFIER_HEADERS.has(column.header) &&
        cell.value.trim() &&
        !['inlineStr', 's', 'str'].includes(cell.type)
      ) {
        issues.push(
          issue(
            'error',
            'identifier_not_text',
            `${column.header} must remain an Excel text value.`,
            rowNumber,
            proposalKey,
            column.header,
          ),
        )
      }
    })

    if (!rawProposalKey || !current) {
      issues.push(
        issue(
          'error',
          'unknown_proposal_key',
          rawProposalKey
            ? 'Proposal Key does not exist in the current proposal artifact.'
            : 'Proposal Key is required.',
          rowNumber,
          proposalKey,
          'Proposal Key',
        ),
      )
    }
    if (rawProposalKey && duplicateKeySet.has(rawProposalKey)) {
      issues.push(
        issue(
          'error',
          'duplicate_proposal_key',
          'Proposal Key appears more than once in the workbook.',
          rowNumber,
          proposalKey,
          'Proposal Key',
        ),
      )
    }

    const protectedFieldDifferences: ExactSlotReviewImportRowPreview['protectedFieldDifferences'] =
      []
    if (current) {
      for (const [referenceIndex, column] of EXACT_SLOT_REVIEW_REFERENCE_COLUMNS.entries()) {
        const workbookValue = cells[column.key].value
        const currentValue = current[column.key]
        const hyperlinkTarget =
          column.key === 'evidencePageUrl'
            ? reviewWorksheet.hyperlinks.get(`${columnName(referenceIndex + 1)}${rowNumber}`)
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
              `${column.header} differs from current proposal data; current data remains authoritative.`,
              rowNumber,
              proposalKey,
              column.header,
            ),
          )
        }
      }
    }

    const decision = normalizeExactSlotDecision(cells.decision.value)
    const confidence = normalizeExactSlotConfidence(cells.reviewerConfidence.value)
    const reviewDate = normalizeExcelReviewDate(cells.reviewDate)
    const readyForSecondReview = yesNoValue(cells.readyForSecondReview.value)
    const rationale = cells.rationale.value.trim()
    const editableHasValue = EXACT_SLOT_REVIEW_EDITABLE_COLUMNS.some((column) =>
      cells[column.key].value.trim(),
    )
    const reviewTextLimits: Array<[keyof ExactSlotReviewWorkbookRow, number]> = [
      ['rationale', MAX_REVIEW_TEXT_CHARACTERS],
      ['evidenceNeeded', MAX_REVIEW_TEXT_CHARACTERS],
      ['reviewerName', MAX_REVIEWER_NAME_CHARACTERS],
      ['followUpNotes', MAX_REVIEW_TEXT_CHARACTERS],
      ['secondReviewer', MAX_REVIEWER_NAME_CHARACTERS],
      ['secondReviewComments', MAX_REVIEW_TEXT_CHARACTERS],
    ]
    for (const [field, limit] of reviewTextLimits) {
      if (cells[field].value.length <= limit) continue
      const column = EXACT_SLOT_REVIEW_COLUMNS.find((candidate) => candidate.key === field)!
      issues.push(
        issue(
          'error',
          'incomplete_decision',
          `${column.header} exceeds the accepted ${limit}-character review limit.`,
          rowNumber,
          proposalKey,
          column.header,
        ),
      )
    }

    if (decision === undefined) {
      issues.push(
        issue(
          'error',
          'invalid_decision',
          'Decision must be blank or one of the allowed dropdown values.',
          rowNumber,
          proposalKey,
          'Decision',
        ),
      )
    }
    if (confidence === undefined) {
      issues.push(
        issue(
          'error',
          'invalid_confidence',
          'Reviewer Confidence must be blank, High, Moderate, or Low.',
          rowNumber,
          proposalKey,
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
          rowNumber,
          proposalKey,
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
          rowNumber,
          proposalKey,
          'Ready for Second Review',
        ),
      )
    }
    if (decision && !rationale) {
      issues.push(
        issue(
          'error',
          'missing_rationale',
          'A rationale is required for every completed decision.',
          rowNumber,
          proposalKey,
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
          rowNumber,
          proposalKey,
          'Decision',
        ),
      )
    }

    const hasBlockingIssue = issues.some((candidate) => candidate.severity === 'error')
    const normalizedDecision: ExactSlotReviewDecision | null =
      !hasBlockingIssue && decision && current
        ? {
            proposalKey: current.proposalKey,
            slotId: current.slotId,
            procedureCode: current.procedureCode,
            productId: current.productId,
            roleCode: current.roleCode,
            decision,
            rationale,
            evidenceNeeded: nullableTrimmed(cells.evidenceNeeded.value),
            reviewerName: nullableTrimmed(cells.reviewerName.value),
            reviewerConfidence: confidence ?? null,
            reviewDate: reviewDate ?? null,
            followUpNotes: nullableTrimmed(cells.followUpNotes.value),
            readyForSecondReview: readyForSecondReview ?? null,
            secondReviewer: nullableTrimmed(cells.secondReviewer.value),
            secondReviewComments: nullableTrimmed(cells.secondReviewComments.value),
          }
        : null
    const status: ExactSlotReviewImportRowPreview['status'] = hasBlockingIssue
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
          rowNumber,
          proposalKey,
          null,
        ),
      )
    }

    rowPreviews.push({
      rowNumber,
      proposalKey,
      status,
      protectedFieldDifferences: protectedFieldDifferences.slice(
        0,
        MAX_ROW_PROTECTED_DIFFERENCE_DETAILS,
      ),
      issues: boundedIssues,
      decision: normalizedDecision,
    })
  }

  const workbookProposalKeys = new Set(
    importedRows.flatMap((row) => (row.rawProposalKey ? [row.rawProposalKey] : [])),
  )
  const currentProposalKeys = new Set(currentByKey.keys())
  const unknownWorkbookProposalKeys = [...workbookProposalKeys]
    .filter((proposalKey) => !currentProposalKeys.has(proposalKey))
    .map(boundedPreviewValue)
    .sort()
  const missingCurrentProposalKeys = [...currentProposalKeys]
    .filter((proposalKey) => !workbookProposalKeys.has(proposalKey))
    .sort()
  const changedProposalKeys = rowPreviews
    .filter((row) => row.protectedFieldDifferences.length > 0 && row.proposalKey)
    .map((row) => row.proposalKey!)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort()
  const decisions = rowPreviews
    .flatMap((row) => (row.decision ? [row.decision] : []))
    .sort((left, right) => left.proposalKey.localeCompare(right.proposalKey))
  const blockerCodes = new Set(
    allIssues
      .filter((candidate) => candidate.severity === 'error')
      .map((candidate) => candidate.code),
  )
  const exportBlockers = [...blockerCodes].sort().map((code) => {
    switch (code) {
      case 'duplicate_proposal_key':
        return 'Resolve duplicate proposal keys.'
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
      case 'invalid_yes_no':
        return 'Choose Yes or No for second-review readiness.'
      case 'missing_rationale':
        return 'Add a rationale for every decision.'
      case 'unknown_proposal_key':
        return 'Remove or reconcile unknown proposal keys.'
      default:
        return 'Correct invalid workbook rows.'
    }
  })
  const staleArtifact =
    workbookMetadata.proposal_artifact_sha256 !==
    options.currentProposalArtifactSha256.toLocaleLowerCase()
  const matchedProposalKeys = [...workbookProposalKeys].filter((proposalKey) =>
    currentProposalKeys.has(proposalKey),
  ).length

  return {
    formatVersion: EXACT_SLOT_REVIEW_EXPORT_FORMAT_VERSION,
    importedAt: options.importedAt,
    workbookFileName: options.fileName,
    workbookSha256: sha256Bytes(bytes),
    workbookMetadata,
    currentProposalArtifactSha256: options.currentProposalArtifactSha256.toLocaleLowerCase(),
    staleArtifact,
    staleWarning: staleArtifact
      ? `This workbook was exported from a different proposal artifact. ${matchedProposalKeys} keys match, ${missingCurrentProposalKeys.length} current proposals are absent, ${changedProposalKeys.length} matched proposals contain protected-field differences, and ${unknownWorkbookProposalKeys.length} workbook keys are unknown. Acknowledge this warning before exporting normalized decisions.`
      : null,
    canExportNormalized: exportBlockers.length === 0,
    exportBlockers,
    summary: {
      validCompletedDecisions: decisions.length,
      incompleteDecisions: rowPreviews.filter((row) => row.status === 'incomplete').length,
      rowsWithoutDecision: rowPreviews.filter((row) => row.status === 'unreviewed').length,
      invalidDecisionValues: allIssues.filter((candidate) => candidate.code === 'invalid_decision')
        .length,
      missingRationales: allIssues.filter((candidate) => candidate.code === 'missing_rationale')
        .length,
      unknownProposalKeys: unknownWorkbookProposalKeys.length,
      staleProposalKeys: changedProposalKeys.length,
      protectedFieldDifferences: protectedFieldDifferenceCount,
      duplicateRows: new Set(
        allIssues
          .filter((candidate) => candidate.code === 'duplicate_proposal_key')
          .map((candidate) => candidate.rowNumber),
      ).size,
      unchangedProtectedRows: rowPreviews.filter(
        (row) =>
          row.proposalKey &&
          currentByKey.has(row.proposalKey) &&
          row.protectedFieldDifferences.length === 0,
      ).length,
      changedProtectedRows: rowPreviews.filter(
        (row) =>
          row.proposalKey &&
          currentByKey.has(row.proposalKey) &&
          row.protectedFieldDifferences.length > 0,
      ).length,
      missingCurrentProposals: missingCurrentProposalKeys.length,
      matchedProposalKeys,
    },
    missingCurrentProposalKeys,
    unknownWorkbookProposalKeys,
    duplicateProposalKeys,
    changedProposalKeys,
    reviewedProposalKeys: decisions.map((decision) => decision.proposalKey),
    decisions,
    rows: rowPreviews,
  }
}
