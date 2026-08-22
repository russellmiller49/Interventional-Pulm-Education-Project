import { expandNovatechMatrixRefs, SOURCE_COMPLETENESS_REVIEW } from './source-completeness-intake'
import {
  extractIdentifierTokens,
  scanDocumentText,
  scanPageText,
  type DocumentMeta,
} from './source-completeness-corpus-scan'

const META: DocumentMeta = {
  sourceFilename: 'fixture.pdf',
  relativePath: 'brochures/fixture.pdf',
  sourceSha256: '0'.repeat(64),
  manufacturer: 'Fixture Mfr',
  expectedPageCount: null,
}

function identifiers(pageText: string): string[] {
  return scanDocumentText(pageText, META).candidates.map((candidate) => candidate.rawIdentifier)
}

describe('layout-aware corpus scanner', () => {
  test('captures inline identifiers that do not lead their line', () => {
    const page = 'The optional adapter (order number G07467) connects the sampling port.'
    expect(identifiers(page)).toEqual(['G07467'])
  })

  test('captures a single identifier on an otherwise empty page and a one-row table', () => {
    expect(identifiers('   BF-P190   ')).toEqual(['BF-P190'])
    const oneRowTable = ['Catalog number   OD mm   Length cm', 'TRD1-06030   6.0   30'].join('\n')
    expect(identifiers(oneRowTable)).toEqual(['TRD1-06030'])
  })

  test('captures a two-row single-page table without any multi-page requirement', () => {
    const page = [
      'Ordering information',
      'CY49021   Cytology Brush   2.0   120',
      'CY49031   Cytology Brush   2.0   180',
    ].join('\n')
    expect(identifiers(page).sort()).toEqual(['CY49021', 'CY49031'])
  })

  test('captures a Shiley-style continuation page that does not repeat its heading', () => {
    const continuation = ['7CN75R   8.0   11.4  77', '8CN85R   8.5   12.2  79'].join('\n')
    expect(identifiers(continuation).sort()).toEqual(['7CN75R', '8CN85R'])
  })

  test('scans one exact product per page across a multi-page capture', () => {
    const pages = [
      'Order Number   Reference Part Number\nG06885   C-TQTSY-1000   N/A   10   20',
      'Order Number   Reference Part Number\nG05464   C-TQTSY-1200   N/A   12   22',
    ].join('\f')
    const scan = scanDocumentText(pages, META)
    expect(scan.pageCount).toBe(2)
    const byId = new Map(scan.candidates.map((candidate) => [candidate.rawIdentifier, candidate]))
    expect(byId.get('G06885')?.pages).toEqual([1])
    expect(byId.get('G05464')?.pages).toEqual([2])
  })

  test('pairs order and reference identifiers on a multi-column Thal-Quick-style row', () => {
    const page = [
      '        Order                        Reference Part',
      '        Number                       Number',
      '',
      '    G04220                        C-TQTSY-2400                24         41',
    ].join('\n')
    const occurrences = scanPageText(page, 1)
    const order = occurrences.find((occurrence) => occurrence.raw === 'G04220')
    const reference = occurrences.find((occurrence) => occurrence.raw === 'C-TQTSY-2400')
    expect(order?.pairedIdentifier).toBe('C-TQTSY-2400')
    expect(reference?.pairedIdentifier).toBe('G04220')
    expect(order?.onPairingPage).toBe(true)
  })

  test('reconstructs a Blue-Rhino-style hyphen-wrapped reference across visual lines', () => {
    const page = [
      '        Order            Reference Part',
      '        Number           Number',
      '',
      '                         C-PTISY-100-HC-G-',
      '        G57716                                    7.5, 8.5, 9.0',
      '                         NA-FLEX7.5',
    ].join('\n')
    const scanned = identifiers(page)
    expect(scanned).toContain('C-PTISY-100-HC-G-NA-FLEX7.5')
    expect(scanned).toContain('G57716')
    expect(scanned).not.toContain('C-PTISY-100-HC-G')
    expect(scanned).not.toContain('NA-FLEX7.5')
    const wrapped = scanDocumentText(page, META).candidates.find(
      (candidate) => candidate.rawIdentifier === 'C-PTISY-100-HC-G-NA-FLEX7.5',
    )
    expect(wrapped?.detectionRule).toBe('wrapped_cell_join')
    expect(wrapped?.pairedIdentifier).toBe('G57716')
  })

  test('inherits matrix dimensions from column headers and row labels', () => {
    const page = [
      '     Length (mm)',
      '            20         30         40',
      '  11    01TD1120   01TD1130   01TD1140',
      '  12    01TD1220   01TD1230   01TD1240',
    ].join('\n')
    const candidates = scanDocumentText(page, META).candidates
    const cell = candidates.find((candidate) => candidate.rawIdentifier === '01TD1130')
    expect(cell?.detectionRule).toBe('matrix_cell')
    expect(cell?.columnHeader).toBe('30')
    expect(cell?.rowLabel).toBe('11')
    const secondRow = candidates.find((candidate) => candidate.rawIdentifier === '01TD1240')
    expect(secondRow?.columnHeader).toBe('40')
    expect(secondRow?.rowLabel).toBe('12')
  })

  test('joins split numeric+suffix references only inside ordering context', () => {
    const orderingPage = ['Item no          Description', '26031 AA   Optical forceps'].join('\n')
    expect(identifiers(orderingPage)).toContain('26031 AA')
    const prosePage = 'In 26031 AA the committee published new guidance.'
    expect(identifiers(prosePage)).toEqual([])
  })

  test('drops bare numerics, dates, units, and standard labels outside ordering context', () => {
    const page = [
      'Published 8/3/26 with 50000 participants and a 10.5 mm probe.',
      'Certified to ISO 13485 in 2026.',
    ].join('\n')
    expect(identifiers(page)).toEqual([])
    // Alpha-bearing citation tokens stay in the ledger and take a reviewed
    // not_a_product_identifier disposition rather than being silently dropped.
    expect(identifiers('doi: 10.1016/s0272-5231')).toEqual(['10.1016/s0272-5231'])
  })

  test('extractIdentifierTokens keeps identifier-shaped tokens and reports columns', () => {
    const tokens = extractIdentifierTokens('  G57703   C-PTISY-100-HC-G-NA   7.5, 8.5, 9.0')
    expect(tokens.map((token) => token.raw)).toEqual(['G57703', 'C-PTISY-100-HC-G-NA'])
    expect(tokens[0].column).toBe(2)
  })
})

describe('explicit ordering-label identifier context', () => {
  const PREVIOUSLY_MISSED_STORZ_ITEM_NUMBERS = [
    '10318D',
    '10318F',
    '10318G',
    '10318L',
    '10318S',
    '10338S',
    '10350F',
    '10350L',
    '10350ST',
    '10352H',
    '10352L',
    '10370H',
    '10370L',
    '10372H',
    '10380D',
    '10383D',
  ]

  test('an explicit "Item no:" label precedes the generic unit-suffix rejection', () => {
    expect(extractIdentifierTokens('Item no: 10350F').map((token) => token.raw)).toEqual(['10350F'])
  })

  test('every previously missed explicit STORZ item number is extracted', () => {
    for (const itemNumber of PREVIOUSLY_MISSED_STORZ_ITEM_NUMBERS) {
      expect(extractIdentifierTokens(`         Item no: ${itemNumber}`).map((t) => t.raw)).toEqual([
        itemNumber,
      ])
    }
  })

  test('labeled identifiers surface as scanner candidates through the fixture document', () => {
    // The fixture META is not a KARL STORZ document, so extraction cannot depend on the
    // corpus filename or manufacturer.
    const page = PREVIOUSLY_MISSED_STORZ_ITEM_NUMBERS.map(
      (itemNumber) => `Item no: ${itemNumber}`,
    ).join('\n\n')
    expect(identifiers(page).sort()).toEqual([...PREVIOUSLY_MISSED_STORZ_ITEM_NUMBERS].sort())
  })

  test('supports the conservative label vocabulary independent of manufacturer', () => {
    const labeled = [
      'Item no: 20735F',
      'Item number: 20735G',
      'Catalog no: 20735L',
      'Catalog number: 20735S',
      'Order no: 20735H',
      'Order number: 20735D',
      'Reference no: 20736F',
      'Reference number: 20736G',
      'Ref. no: 20736L',
      'Ref. no. 20736S',
    ]
    for (const line of labeled) {
      const expected = line.split(/[\s:.]+/).at(-1)
      expect(extractIdentifierTokens(line).map((token) => token.raw)).toEqual([expected])
    }
  })

  test('rescues only the token the label immediately precedes', () => {
    const tokens = extractIdentifierTokens('Item no: 10350F supplied with 1250F handle')
    expect(tokens.map((token) => token.raw)).toEqual(['10350F'])
  })

  test('unlabeled measurements, units, and ordinals stay rejected', () => {
    expect(identifiers('The set includes 10 Fr and 5 mm dilators plus a 12 L reservoir.')).toEqual(
      [],
    )
    expect(extractIdentifierTokens('Dilate to 10.5mm over 120s at 40psi')).toEqual([])
    expect(extractIdentifierTokens('a 1064nm laser and 2900ml canister')).toEqual([])
    expect(extractIdentifierTokens('ranked 1250th overall')).toEqual([])
  })

  test('dates, citations, and revision codes stay rejected even when a label precedes them', () => {
    expect(extractIdentifierTokens('Item no: 8/3/26')).toEqual([])
    expect(extractIdentifierTokens('Order no: 2026')).toEqual([])
    expect(identifiers('Revision REV2 of ISO 13485 published 12/1/25.')).toEqual([])
  })

  test('prose mentioning a label elsewhere on the line gains no identifier context', () => {
    // The label must immediately precede the token; a label earlier in the sentence does not
    // rescue a later measurement.
    expect(extractIdentifierTokens('Order number pending; ships in a 400L crate')).toEqual([])
  })
})

describe('reviewed Novatech matrix expansion', () => {
  const matrix = SOURCE_COMPLETENESS_REVIEW.novatech_stent_matrix
  const refs = expandNovatechMatrixRefs(matrix)
  const refSet = new Set(refs.map((entry) => entry.ref))

  test('expands to the complete 148-reference stent-table set', () => {
    expect(refs).toHaveLength(148)
    expect(refSet.size).toBe(148)
  })

  test('contains representative beginning, middle, and end rows from each section', () => {
    const representatives = [
      // straight TD: first cell, mid-matrix cell, largest-diameter cell
      '01TD1120',
      '01TD1550',
      '01TD1850',
      // straight TF: first, header-inherited long lengths, last diameter row
      '01TF1230',
      '01TF15110',
      '01TF20110',
      // straight BD: first, middle, last
      '01BD1020',
      '01BD1150',
      '01BD1280',
      // DUMON BB: first, middle, last
      '025301S20',
      '026501S30',
      '026701S50',
      // Y: first, middle variant, last
      '01Y121010',
      '01Y151212V2',
      '01Y181414',
      // OKI, ST first/last, DST first/last
      '01OKI130910',
      '01ST121012',
      '01ST181618',
      '01DST141214',
      '01DST181618',
    ]
    for (const ref of representatives) expect(refSet.has(ref)).toBe(true)
  })

  test('assigns header-inherited dimensions and pages to every straight cell', () => {
    const byRef = new Map(refs.map((entry) => [entry.ref, entry]))
    expect(byRef.get('01TD1120')).toMatchObject({ sizeDisplay: '11 OD x 20 L', page: 12 })
    expect(byRef.get('01TF18100')).toMatchObject({ sizeDisplay: '18 OD x 100 L', page: 13 })
    expect(byRef.get('01BD1270')).toMatchObject({ page: 13 })
  })

  test('excludes exactly the seven already-canonical references from new products', () => {
    const canonical = Object.keys(matrix.alreadyCanonicalRefs)
    expect(canonical).toHaveLength(7)
    for (const ref of canonical) expect(refSet.has(ref)).toBe(true)
    expect(matrix.expectedNewProducts).toBe(148 - 7)
  })
})
