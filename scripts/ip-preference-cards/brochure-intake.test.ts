import {
  NOT_STATED_IDENTIFIER,
  parseBrochureCsv,
  parseCsvRecords,
  sha256Bytes,
  splitSourceFilenames,
  summarizeBrochureInput,
  validateReconciliationRows,
  type BrochureReconciliationRow,
} from './brochure-intake'

describe('brochure intake parser', () => {
  test('parses quoted commas, CRLF, escaped quotes, and no terminal newline', () => {
    expect(
      parseCsvRecords('001,"Forceps, 2 mm","ACME ""Medical""",a.pdf\r\n002,B,B,b.pdf'),
    ).toEqual([
      ['001', 'Forceps, 2 mm', 'ACME "Medical"', 'a.pdf'],
      ['002', 'B', 'B', 'b.pdf'],
    ])
  })

  test('detects the observed header without losing the first product row', () => {
    const parsed = parseBrochureCsv(
      'Product ID,Product Name,Manufacturer,Source File\r\n' +
        'Not stated in source,FOX 980,A.R.C. Laser,deep-research-report-lasers.md',
    )

    expect(parsed.detectedHeader).toBe(true)
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.rows).toEqual([
      {
        inputRowNumber: 1,
        sourceLineNumber: 2,
        extractedIdentifier: NOT_STATED_IDENTIFIER,
        extractedProductName: 'FOX 980',
        extractedManufacturer: 'A.R.C. Laser',
        sourceValue: 'deep-research-report-lasers.md',
        sourceFilenames: ['deep-research-report-lasers.md'],
      },
    ])
  })

  test('preserves leading-zero and decimal-looking identifiers as strings', () => {
    const parsed = parseBrochureCsv(
      '02841S,Scope,A,a.pdf\r\n00123,Needle,A,a.pdf\r\n8379.462,Electrode,A,a.pdf',
    )
    expect(parsed.rows.map((row) => row.extractedIdentifier)).toEqual([
      '02841S',
      '00123',
      '8379.462',
    ])
  })

  test('splits multiple source files without splitting HTML entities', () => {
    expect(
      splitSourceFilenames(
        'AccessGUDID - (&quot;Monarch Bronchoscope&quot;)2.pdf; other-source.pdf',
      ),
    ).toEqual(['AccessGUDID - ("Monarch Bronchoscope")2.pdf', 'other-source.pdf'])
  })
})

describe('brochure intake accounting', () => {
  const parsed = parseBrochureCsv(
    '001,Alpha,ACME,a.pdf; b.pdf\n' +
      '001,Alpha Alias,ACME,b.pdf\n' +
      'Not stated in source,Family,ACME,c.pdf\n' +
      '001,Alpha,ACME,a.pdf; b.pdf',
  )

  test('reports unresolved sources, exact duplicate rows, and repeated identifiers', () => {
    expect(summarizeBrochureInput(parsed.rows, ['a.pdf', 'b.pdf'])).toEqual({
      total_rows: 4,
      rows_with_exact_identifier: 3,
      rows_with_not_stated_identifier: 1,
      unique_manufacturers: 1,
      unique_source_filenames: 3,
      unresolved_source_filenames: ['c.pdf'],
      exact_duplicate_rows: [{ first_input_row_number: 1, duplicate_input_row_numbers: [4] }],
      repeated_identifiers: [{ identifier: '001', input_row_numbers: [1, 2, 4] }],
    })
  })

  test('requires one unchanged controlled-disposition row per input row', () => {
    const reconciliation = parsed.rows.map(
      (row): BrochureReconciliationRow => ({
        input_row_number: row.inputRowNumber,
        extracted_identifier: row.extractedIdentifier,
        extracted_product_name: row.extractedProductName,
        extracted_manufacturer: row.extractedManufacturer,
        source_filename: row.sourceValue,
        matched_source_page: '',
        disposition: 'needs_owner_review',
        canonical_product_id: '',
        canonical_catalog_number: '',
        match_basis: 'fixture',
        evidence_strength: 'fixture',
        reason_code: 'fixture',
        owner_review_note: '',
      }),
    )

    expect(() => validateReconciliationRows(parsed.rows, reconciliation)).not.toThrow()
    expect(() => validateReconciliationRows(parsed.rows, reconciliation.slice(1))).toThrow(
      'Reconciliation is missing 1 input row(s): 1.',
    )
    expect(() =>
      validateReconciliationRows(parsed.rows, [...reconciliation, reconciliation[0]]),
    ).toThrow('more than once')
  })

  test('hashes manifest bytes deterministically', () => {
    expect(sha256Bytes('brochure')).toBe(
      'c318132fa32974d9b455378c9cf9292e8c9aca332917142fd3d392e39917d4bc',
    )
  })
})
