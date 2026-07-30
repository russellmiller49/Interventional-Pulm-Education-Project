import JSZip from 'jszip'

import {
  EXTERNAL_REVIEW_REMEDIATION_PRODUCT_COLUMNS,
  EXTERNAL_REVIEW_REMEDIATION_REVIEWER_DECISIONS,
  EXTERNAL_REVIEW_REMEDIATION_SHEETS,
  EXTERNAL_REVIEW_REMEDIATION_SLOT_COLUMNS,
  EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION,
  type ExternalReviewRemediationColumn,
  type ExternalReviewRemediationProductRow,
  type ExternalReviewRemediationSlotRow,
  type ExternalReviewRemediationWorkbookMetadata,
} from '@/features/preference-cards/excel/external-review-remediation-contract'
import { getExternalReviewRemediationReviewData } from '@/features/preference-cards/excel/external-review-remediation-data.server'

export const EXTERNAL_REVIEW_REMEDIATION_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const ZIP_ENTRY_DATE = new Date(1980, 0, 1, 0, 0, 0)

type ReviewRow = ExternalReviewRemediationProductRow | ExternalReviewRemediationSlotRow
type ReviewColumn =
  | ExternalReviewRemediationColumn<ExternalReviewRemediationProductRow>
  | ExternalReviewRemediationColumn<ExternalReviewRemediationSlotRow>

export interface ExternalReviewRemediationWorkbookBuildResult {
  bytes: Uint8Array
  filename: string
  metadata: ExternalReviewRemediationWorkbookMetadata
  productRows: ExternalReviewRemediationProductRow[]
  slotRows: ExternalReviewRemediationSlotRow[]
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
  const preserve = /^\s|\s$|\r|\n/.test(value) ? ' xml:space="preserve"' : ''
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t${preserve}>${xmlText(
    value,
  )}</t></is></c>`
}

function rowXml(rowNumber: number, cells: string[], height?: number): string {
  const customHeight = height ? ` ht="${height}" customHeight="1"` : ''
  return `<row r="${rowNumber}"${customHeight}>${cells.join('')}</row>`
}

function contentTypesXml(): string {
  const worksheetOverrides = EXTERNAL_REVIEW_REMEDIATION_SHEETS.map(
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
  const sheets = EXTERNAL_REVIEW_REMEDIATION_SHEETS.map(
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
    <definedName name="ReviewerDecisionOptions">'Lookups'!$A$2:$A$${EXTERNAL_REVIEW_REMEDIATION_REVIEWER_DECISIONS.length + 1}</definedName>
  </definedNames>
  <calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`
}

function workbookRelationshipsXml(): string {
  const worksheetRelationships = EXTERNAL_REVIEW_REMEDIATION_SHEETS.map(
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRelationships}
  <Relationship Id="rId${EXTERNAL_REVIEW_REMEDIATION_SHEETS.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF1F2937"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="18"/><color rgb="FF17365D"/><name val="Aptos Display"/><family val="2"/><scheme val="major"/></font>
    <font><b/><sz val="11"/><color rgb="FF17365D"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
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
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="0"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`
}

function corePropertiesXml(exportedAt: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>IP External-review Focused Remediation</dc:title>
  <dc:subject>Clinician recommendations for lifecycle, role, and exact-slot remediation</dc:subject>
  <dc:creator>Interventional Pulmonology Education</dc:creator>
  <cp:lastModifiedBy>Interventional Pulmonology Education</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${xmlText(exportedAt)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${xmlText(exportedAt)}</dcterms:modified>
</cp:coreProperties>`
}

function extendedPropertiesXml(): string {
  const titles = EXTERNAL_REVIEW_REMEDIATION_SHEETS.map(
    (name) => `<vt:lpstr>${xmlText(name)}</vt:lpstr>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel Compatible</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${EXTERNAL_REVIEW_REMEDIATION_SHEETS.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${EXTERNAL_REVIEW_REMEDIATION_SHEETS.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>
  <Company>Interventional Pulmonology Education</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`
}

function customPropertiesXml(metadata: ExternalReviewRemediationWorkbookMetadata): string {
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

function instructionsWorksheetXml(metadata: ExternalReviewRemediationWorkbookMetadata): string {
  const instructions: Array<[string, string]> = [
    [
      'Purpose',
      'Review the bounded external-review recommendations for lifecycle context, product-role semantics, and exact-slot policy. This workbook intentionally excludes broad taxonomy and missing-product enrichment.',
    ],
    [
      'Recommendation boundary',
      'This workbook is recommendation-only. Downloading, editing, or returning it never applies catalog, role, lifecycle, visibility, or exact-slot changes.',
    ],
    [
      'Editable cells',
      'Only the yellow Reviewer Decision and Rationale cells are editable. Every reviewer cell is blank at export. Use the decision dropdown and explain any approval, modification, deferral, or rejection.',
    ],
    [
      'Protected reference cells',
      'Blue cells preserve current/proposed state and stable identifiers as text. Worksheet protection is a usability aid, not a security boundary.',
    ],
    [
      'Clinical boundary',
      'Do not infer patient-specific suitability or universal device preference. Confirm current IFU, platform compatibility, local availability, service support, and institutional policy.',
    ],
    [
      'Patient information',
      'Do not enter patient names, identifiers, dates of birth, medical record numbers, or any other patient information.',
    ],
    [
      'Olympus 180 policy',
      'Installed-base lifecycle remains independent of GUDID distribution evidence. The listed legacy models remain searchable installed-base alternatives and are not preferred new-purchase recommendations.',
    ],
    [
      'ViziShot invariant',
      'A hidden product cannot be visible by default. ViziShot remains nonselectable and in the verification workflow until separately promoted with sufficient evidence.',
    ],
    ['Workbook format version', metadata.format_version],
    ['Review ID', metadata.review_id],
    ['Export timestamp (UTC)', metadata.exported_at],
    ['Normalized corrections SHA-256', metadata.normalized_corrections_sha256],
    ['Product-role review rows', metadata.product_review_count],
    ['Exact-slot review rows', metadata.exact_slot_review_count],
  ]
  const rows = [
    rowXml(1, [textCell('A1', 'IP External-review Focused Remediation', 1)], 30),
    rowXml(
      2,
      [
        textCell(
          'A2',
          'Clinician recommendation workbook — no decision is preapproved or applied.',
          2,
        ),
      ],
      30,
    ),
    ...instructions.map(([label, value], index) =>
      rowXml(
        index + 4,
        [textCell(`A${index + 4}`, label, 4), textCell(`B${index + 4}`, value, 4)],
        Math.max(24, Math.min(72, 18 + Math.ceil(value.length / 80) * 15)),
      ),
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:B${instructions.length + 3}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="31" customWidth="1"/><col min="2" max="2" width="110" customWidth="1"/></cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/></mergeCells>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1" paperSize="1"/>
</worksheet>`
}

function reviewWorksheetXml(columns: readonly ReviewColumn[], rows: readonly ReviewRow[]): string {
  const columnCount = columns.length
  const lastColumn = columnName(columnCount)
  const lastRow = rows.length + 1
  const reviewerDecisionIndex = columns.findIndex((column) => column.key === 'reviewerDecision') + 1
  const reviewerDecisionColumn = columnName(reviewerDecisionIndex)
  const columnDefinitions = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
    )
    .join('')
  const headerRow = rowXml(
    1,
    columns.map((column, index) => textCell(`${columnName(index + 1)}1`, column.header, 3)),
    42,
  )
  const dataRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 2
    const values = row as unknown as Record<string, string>
    return rowXml(
      rowNumber,
      columns.map((column, columnIndex) => {
        const style = column.editable ? 6 : column.identifier ? 5 : 4
        return textCell(
          `${columnName(columnIndex + 1)}${rowNumber}`,
          values[String(column.key)] ?? '',
          style,
        )
      }),
      54,
    )
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane xSplit="6" ySplit="1" topLeftCell="G2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="${reviewerDecisionColumn}2" sqref="${reviewerDecisionColumn}2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnDefinitions}</cols>
  <sheetData>${headerRow}${dataRows.join('')}</sheetData>
  <sheetProtection sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" insertHyperlinks="1" deleteColumns="1" deleteRows="1" selectLockedCells="0" selectUnlockedCells="0" sort="0" autoFilter="0"/>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1" errorStyle="stop" errorTitle="Invalid reviewer decision" error="Choose a reviewer decision from the dropdown list." promptTitle="Clinician decision" prompt="This is a recommendation only and is never applied automatically." sqref="${reviewerDecisionColumn}2:${reviewerDecisionColumn}${lastRow}"><formula1>ReviewerDecisionOptions</formula1></dataValidation>
  </dataValidations>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="4" fitToHeight="0" paperSize="1"/>
  <ignoredErrors><ignoredError sqref="A2:${lastColumn}${lastRow}" numberStoredAsText="1"/></ignoredErrors>
</worksheet>`
}

function lookupsWorksheetXml(metadata: ExternalReviewRemediationWorkbookMetadata): string {
  const metadataEntries = Object.entries(metadata)
  const rowCount = Math.max(
    EXTERNAL_REVIEW_REMEDIATION_REVIEWER_DECISIONS.length,
    metadataEntries.length,
  )
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const rowNumber = index + 2
    const metadataEntry = metadataEntries[index]
    return rowXml(rowNumber, [
      textCell(`A${rowNumber}`, EXTERNAL_REVIEW_REMEDIATION_REVIEWER_DECISIONS[index] ?? '', 5),
      textCell(`B${rowNumber}`, metadataEntry?.[0] ?? '', 5),
      textCell(`C${rowNumber}`, metadataEntry?.[1] ?? '', 5),
    ])
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:C${rowCount + 1}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="3" width="78" customWidth="1"/></cols>
  <sheetData>
    ${rowXml(
      1,
      [
        textCell('A1', 'Reviewer Decision Values', 3),
        textCell('B1', 'Metadata Field', 3),
        textCell('C1', 'Metadata Value', 3),
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

export async function buildExternalReviewRemediationWorkbookBytes(
  productRows: ExternalReviewRemediationProductRow[],
  slotRows: ExternalReviewRemediationSlotRow[],
  metadata: ExternalReviewRemediationWorkbookMetadata,
): Promise<Uint8Array> {
  if (metadata.format_version !== EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION) {
    throw new Error('Unsupported external-review remediation workbook format version.')
  }
  if (
    Number(metadata.product_review_count) !== productRows.length ||
    Number(metadata.exact_slot_review_count) !== slotRows.length
  ) {
    throw new Error('Workbook metadata row counts do not match the exported remediation rows.')
  }

  const zip = new JSZip()
  addZipText(zip, '[Content_Types].xml', contentTypesXml())
  addZipText(zip, '_rels/.rels', packageRelationshipsXml())
  addZipText(zip, 'docProps/core.xml', corePropertiesXml(metadata.exported_at))
  addZipText(zip, 'docProps/app.xml', extendedPropertiesXml())
  addZipText(zip, 'docProps/custom.xml', customPropertiesXml(metadata))
  addZipText(zip, 'xl/workbook.xml', workbookXml())
  addZipText(zip, 'xl/_rels/workbook.xml.rels', workbookRelationshipsXml())
  addZipText(zip, 'xl/styles.xml', stylesXml())
  addZipText(zip, 'xl/worksheets/sheet1.xml', instructionsWorksheetXml(metadata))
  addZipText(
    zip,
    'xl/worksheets/sheet2.xml',
    reviewWorksheetXml(EXTERNAL_REVIEW_REMEDIATION_PRODUCT_COLUMNS, productRows),
  )
  addZipText(
    zip,
    'xl/worksheets/sheet3.xml',
    reviewWorksheetXml(EXTERNAL_REVIEW_REMEDIATION_SLOT_COLUMNS, slotRows),
  )
  addZipText(zip, 'xl/worksheets/sheet4.xml', lookupsWorksheetXml(metadata))

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
    mimeType: EXTERNAL_REVIEW_REMEDIATION_XLSX_MIME,
  })
}

export async function createExternalReviewRemediationWorkbook(
  applicationBaseUrl: string,
  locale: string,
  exportedAt = new Date().toISOString(),
): Promise<ExternalReviewRemediationWorkbookBuildResult> {
  const reviewData = getExternalReviewRemediationReviewData(applicationBaseUrl, locale)
  const normalizedOrigin = new URL(applicationBaseUrl).origin
  const activeLocale = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ? locale : 'en'
  const metadata: ExternalReviewRemediationWorkbookMetadata = {
    format_version: EXTERNAL_REVIEW_REMEDIATION_WORKBOOK_FORMAT_VERSION,
    review_id: reviewData.reviewId,
    exported_at: exportedAt,
    normalized_corrections_sha256: reviewData.normalizedCorrectionsSha256,
    product_review_count: String(reviewData.productRows.length),
    exact_slot_review_count: String(reviewData.slotRows.length),
    application_base_url: normalizedOrigin,
    locale: activeLocale,
  }
  const bytes = await buildExternalReviewRemediationWorkbookBytes(
    reviewData.productRows,
    reviewData.slotRows,
    metadata,
  )
  return {
    bytes,
    filename: `IP_External_Review_Focused_Remediation_${exportedAt.slice(0, 10)}.xlsx`,
    metadata,
    productRows: reviewData.productRows,
    slotRows: reviewData.slotRows,
  }
}
