import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  BROCHURE_REVIEW_ARTIFACTS,
  EXPECTED_BROCHURE_CSV_HEADER,
  FROZEN_BROCHURE_INTAKE,
  generateBrochureIntakeReview,
  parseReconciliationCsv,
  serializeCsv,
  type FrozenBrochureIntakeExpectations,
} from './generate-brochure-intake-review'
import { BROCHURE_DISPOSITIONS, parseCsvRecords, sha256Bytes } from './brochure-intake'
import { stableId } from './catalog-utils'

const RECONCILIATION_HEADER = [
  'input_row_number',
  'extracted_identifier',
  'extracted_product_name',
  'extracted_manufacturer',
  'source_filename',
  'matched_source_page',
  'disposition',
  'canonical_product_id',
  'canonical_catalog_number',
  'match_basis',
  'evidence_strength',
  'reason_code',
  'owner_review_note',
] as const

const repositoryRoot = process.cwd()
const committedReviewDirectory = path.join(
  repositoryRoot,
  'docs/ip-preference-cards/brochure-intake/2026-08-19',
)

let fixtureRoot: string | undefined

afterEach(async () => {
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true })
  fixtureRoot = undefined
})

function fixtureExpectations(csvContents: string): FrozenBrochureIntakeExpectations {
  return {
    reviewDate: '2026-08-19',
    csvSha256: sha256Bytes(csvContents),
    header: EXPECTED_BROCHURE_CSV_HEADER,
    dataRows: 2,
    rowsWithExactIdentifier: 1,
    rowsWithNotStatedIdentifier: 1,
    uniqueManufacturers: 1,
    uniqueSourceFilenames: 2,
    brochureFiles: 3,
    brochureFileExtensions: { '.html': 1, '.md': 1, '.pdf': 1 },
    dispositionCounts: {
      existing_exact: 0,
      existing_alias_or_format_variant: 0,
      existing_family_or_package_variant: 1,
      new_product_added: 1,
      relevant_but_insufficient_identity: 0,
      relevant_family_level_only: 0,
      duplicate_source_row: 0,
      irrelevant_to_current_scope: 0,
      source_document_missing: 0,
      source_evidence_conflicted: 0,
      needs_owner_review: 0,
    },
    canonicalProductsAdded: 1,
    exactRepeatedIdentifierGroups: 0,
    exactRepeatedIdentifierRows: 0,
    exactRepeatedIdentifierExcessRows: 0,
    normalizedRepeatedIdentifierGroups: 0,
    normalizedRepeatedIdentifierRows: 0,
    normalizedRepeatedIdentifierExcessRows: 0,
    byteIdenticalSourceGroups: 0,
    byteIdenticalSourceFiles: 0,
    byteIdenticalSourceRedundantCopies: 0,
    totalPdfPages: 2,
    canonicalSourceSupportOccurrences: 1,
    canonicalSourceSupportUniqueProducts: 1,
  }
}

async function buildFixture() {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), 'brochure-intake-review-'))
  const intakeRoot = path.join(fixtureRoot, 'intake')
  const brochureDirectory = path.join(intakeRoot, 'brochures')
  const outputDirectory = path.join(fixtureRoot, 'output')
  const reconciliationPath = path.join(fixtureRoot, 'committed-row-reconciliation.csv')
  const reviewedAdditionsPath = path.join(fixtureRoot, 'reviewed-additions.json')
  const generatedSourcesPath = path.join(fixtureRoot, 'generated-sources.json')
  await mkdir(brochureDirectory, { recursive: true })

  const csvContents =
    'Product ID,Product Name,Manufacturer,Source File\n' +
    'A-001,Exact Scope,ACME,a.pdf\n' +
    'Not stated in source,Scope Family,ACME,b.md\n'
  await writeFile(path.join(intakeRoot, 'preference_card_products.csv'), csvContents)
  await writeFile(path.join(brochureDirectory, 'a.pdf'), 'fixture-pdf')
  await writeFile(path.join(brochureDirectory, 'b.md'), '# Fixture')
  await writeFile(path.join(brochureDirectory, 'unreferenced.html'), '<p>Fixture</p>')

  const productId = stableId('PRD', 'ACME|A-001')
  const reconciliationRows = [
    {
      input_row_number: 1,
      extracted_identifier: 'A-001',
      extracted_product_name: 'Exact Scope',
      extracted_manufacturer: 'ACME',
      source_filename: 'a.pdf',
      matched_source_page: 'PDF page index 1; printed p. 1',
      disposition: 'new_product_added',
      canonical_product_id: productId,
      canonical_catalog_number: 'A-001',
      match_basis: 'exact manufacturer brochure identity',
      evidence_strength: 'high',
      reason_code: 'new_product_added',
      owner_review_note: '',
    },
    {
      input_row_number: 2,
      extracted_identifier: 'Not stated in source',
      extracted_product_name: 'Scope Family',
      extracted_manufacturer: 'ACME',
      source_filename: 'b.md',
      matched_source_page: 'Family section',
      disposition: 'existing_family_or_package_variant',
      canonical_product_id: '',
      canonical_catalog_number: '',
      match_basis: 'family',
      evidence_strength: 'moderate',
      reason_code: 'existing_family_or_package_variant',
      owner_review_note: 'No exact orderable identifier.',
    },
  ]
  await writeFile(reconciliationPath, serializeCsv(RECONCILIATION_HEADER, reconciliationRows))
  await writeFile(
    reviewedAdditionsPath,
    `${JSON.stringify(
      {
        format_version: '1.0',
        reviewed_on: '2026-08-19',
        source_csv_sha256: sha256Bytes(csvContents),
        notes: 'Fixture reviewed additions.',
        manufacturers: [],
        sources: [
          {
            sourceId: 'SRC100',
            title: 'ACME scope brochure',
            filename: 'a.pdf',
            sourceType: 'Manufacturer brochure',
            publisher: 'ACME',
            revisionDate: null,
            officialUrl: 'https://example.com/acme-scope',
            usePolicy: 'Fixture identity evidence.',
            notes: null,
          },
        ],
        products: [
          {
            inputRows: [1],
            productId,
            manufacturerId: 'MFR-ACME',
            manufacturer: 'ACME',
            catalogNumber: 'A-001',
            productName: 'Exact Scope',
            brandFamily: 'Scope',
            primaryCategory: 'Bronchoscopy platform',
            subcategory: 'Flexible video bronchoscope',
            productKind: null,
            description: 'Fixture exact scope.',
            roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
            roleFit: 'Primary',
            strongestDuplicateCandidates: 'No current ACME A-001 catalog identity.',
            duplicateRejection: 'No manufacturer-aware catalog-number collision was found.',
            evidence: [
              {
                sourceId: 'SRC100',
                sourceLocation: 'PDF page index 1; printed p. 1',
              },
            ],
          },
        ],
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(generatedSourcesPath, '[]\n')

  return {
    intakeRoot,
    outputDirectory,
    reconciliationPath,
    reviewedAdditionsPath,
    generatedSourcesPath,
    csvContents,
    productId,
  }
}

describe('brochure review package generator', () => {
  test('pins the corrected frozen CSV/header, file, addition, and disposition counts', () => {
    expect(FROZEN_BROCHURE_INTAKE).toEqual({
      reviewDate: '2026-08-19',
      csvSha256: '9ddcd7c85f32b116e4f19536937deeaf115b4406ff1c1c90f539416c445fda61',
      header: ['Product ID', 'Product Name', 'Manufacturer', 'Source File'],
      dataRows: 2060,
      rowsWithExactIdentifier: 1997,
      rowsWithNotStatedIdentifier: 63,
      uniqueManufacturers: 55,
      uniqueSourceFilenames: 121,
      brochureFiles: 125,
      brochureFileExtensions: { '.html': 7, '.md': 3, '.pdf': 115 },
      dispositionCounts: {
        existing_exact: 803,
        existing_alias_or_format_variant: 64,
        existing_family_or_package_variant: 35,
        new_product_added: 397,
        relevant_but_insufficient_identity: 9,
        relevant_family_level_only: 13,
        duplicate_source_row: 57,
        irrelevant_to_current_scope: 615,
        source_document_missing: 0,
        source_evidence_conflicted: 51,
        needs_owner_review: 16,
      },
      canonicalProductsAdded: 397,
      exactRepeatedIdentifierGroups: 21,
      exactRepeatedIdentifierRows: 43,
      exactRepeatedIdentifierExcessRows: 22,
      normalizedRepeatedIdentifierGroups: 30,
      normalizedRepeatedIdentifierRows: 61,
      normalizedRepeatedIdentifierExcessRows: 31,
      byteIdenticalSourceGroups: 4,
      byteIdenticalSourceFiles: 8,
      byteIdenticalSourceRedundantCopies: 4,
      totalPdfPages: 2609,
      canonicalSourceSupportOccurrences: 398,
      canonicalSourceSupportUniqueProducts: 397,
    })
    expect(
      Object.values(FROZEN_BROCHURE_INTAKE.dispositionCounts).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(2060)
  })

  test('writes every artifact with hashes, page counts, exact batch membership, and portable paths', async () => {
    const fixture = await buildFixture()
    const options = {
      intakeRoot: fixture.intakeRoot,
      repositoryRoot: repositoryRoot,
      outputDirectory: fixture.outputDirectory,
      reconciliationPath: fixture.reconciliationPath,
      reviewedAdditionsPath: fixture.reviewedAdditionsPath,
      generatedSourcesPath: fixture.generatedSourcesPath,
      expectations: fixtureExpectations(fixture.csvContents),
      pdfPageCounter: async (filename: string) => {
        expect(path.basename(filename)).toBe('a.pdf')
        return 2
      },
      jsonFormatter: async (value: unknown) => `${JSON.stringify(value, null, 2)}\n`,
    }
    const result = await generateBrochureIntakeReview(options)

    expect((await readdir(fixture.outputDirectory)).sort()).toEqual(
      [...BROCHURE_REVIEW_ARTIFACTS].sort(),
    )
    expect(result.inputSummary).toMatchObject({
      total_rows: 2,
      detected_header: true,
      observed_header: EXPECTED_BROCHURE_CSV_HEADER,
      canonical_products_added: 1,
      repeated_identifier_summary: { groups: 0, rows: 0, excess_rows: 0 },
      normalized_repeated_identifier_summary: { groups: 0, rows: 0, excess_rows: 0 },
      byte_identical_source_summary: { groups: 0, files: 0, redundant_copies: 0 },
    })
    expect(result.sourceManifest.sources).toHaveLength(3)
    expect(
      result.sourceManifest.sources.find((source) => source.source_filename === 'a.pdf'),
    ).toEqual(
      expect.objectContaining({
        relative_path: 'brochures/a.pdf',
        sha256: sha256Bytes('fixture-pdf'),
        page_count: 2,
        governed_source_ids: ['SRC100'],
        matched_csv_row_count: 1,
        canonical_additions_supported: [{ product_id: fixture.productId, catalog_number: 'A-001' }],
      }),
    )
    expect(
      result.sourceManifest.sources.find(
        (source) => source.source_filename === 'unreferenced.html',
      ),
    ).toEqual(
      expect.objectContaining({
        page_count: null,
        matched_csv_row_count: 0,
        manufacturer: 'Not stated / unreferenced source',
      }),
    )

    const additions = parseCsvRecords(
      await readFile(path.join(fixture.outputDirectory, 'new-product-additions.csv'), 'utf8'),
    )
    expect(additions[0].slice(0, 6)).toEqual([
      'review_batch_id',
      'review_batch_manufacturer',
      'review_batch_product_count',
      'input_row_numbers',
      'product_id',
      'manufacturer_id',
    ])
    expect(additions[1].slice(0, 5)).toEqual(['B01-acme', 'ACME', '1', '1', fixture.productId])

    const allContents = (
      await Promise.all(
        BROCHURE_REVIEW_ARTIFACTS.map((filename) =>
          readFile(path.join(fixture.outputDirectory, filename), 'utf8'),
        ),
      )
    ).join('\n')
    expect(allContents).not.toContain(fixtureRoot)
    expect(allContents).not.toMatch(/file:\/\/|\/Users\/|\/tmp\//)

    await expect(generateBrochureIntakeReview({ ...options, checkOnly: true })).resolves.toEqual(
      expect.objectContaining({ reconciliationRows: expect.any(Array) }),
    )
    await writeFile(path.join(fixture.outputDirectory, 'input-summary.json'), '{}\n')
    await expect(generateBrochureIntakeReview({ ...options, checkOnly: true })).rejects.toThrow(
      'input-summary.json',
    )
  })

  test('committed review package accounts for all rows, files, batches, and controlled dispositions', async () => {
    const [summary, manifest, reconciliationContents, additionsContents, artifactNames] =
      await Promise.all([
        readFile(path.join(committedReviewDirectory, 'input-summary.json'), 'utf8').then(
          JSON.parse,
        ),
        readFile(path.join(committedReviewDirectory, 'source-manifest.json'), 'utf8').then(
          JSON.parse,
        ),
        readFile(path.join(committedReviewDirectory, 'row-reconciliation.csv'), 'utf8'),
        readFile(path.join(committedReviewDirectory, 'new-product-additions.csv'), 'utf8'),
        readdir(committedReviewDirectory),
      ])
    const reconciliation = parseReconciliationCsv(reconciliationContents)
    const dispositionCounts = Object.fromEntries(
      BROCHURE_DISPOSITIONS.map((disposition) => [
        disposition,
        reconciliation.filter((row) => row.disposition === disposition).length,
      ]),
    )

    expect(artifactNames.sort()).toEqual([...BROCHURE_REVIEW_ARTIFACTS].sort())
    expect(summary).toMatchObject({
      total_rows: 2060,
      detected_header: true,
      observed_header: EXPECTED_BROCHURE_CSV_HEADER,
      rows_with_exact_identifier: 1997,
      rows_with_not_stated_identifier: 63,
      unique_manufacturers: 55,
      unique_source_filenames: 121,
      brochure_file_count: 125,
      canonical_products_added: 397,
      disposition_counts: FROZEN_BROCHURE_INTAKE.dispositionCounts,
    })
    expect(reconciliation).toHaveLength(2060)
    expect(dispositionCounts).toEqual(FROZEN_BROCHURE_INTAKE.dispositionCounts)
    expect(manifest.sources).toHaveLength(125)
    expect(manifest).toMatchObject({
      total_pdf_pages: 2609,
      canonical_addition_support_occurrences: 398,
      canonical_addition_support_unique_products: 397,
    })
    expect(summary).toMatchObject({
      repeated_identifier_summary: { groups: 21, rows: 43, excess_rows: 22 },
      normalized_repeated_identifier_summary: { groups: 30, rows: 61, excess_rows: 31 },
      byte_identical_source_summary: { groups: 4, files: 8, redundant_copies: 4 },
    })
    expect(
      manifest.sources.filter((source: { page_count: number | null }) => source.page_count),
    ).toHaveLength(115)
    for (const source of manifest.sources as { sha256: string; relative_path: string }[]) {
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(source.relative_path).toMatch(/^brochures\/[^/].+/)
    }

    const additionRecords = parseCsvRecords(additionsContents)
    const additionHeader = additionRecords[0]
    const additionRows = additionRecords.slice(1)
    const batchIndex = additionHeader.indexOf('review_batch_id')
    const batchCountIndex = additionHeader.indexOf('review_batch_product_count')
    const productIdIndex = additionHeader.indexOf('product_id')
    const inputRowsIndex = additionHeader.indexOf('input_row_numbers')
    expect(additionRows).toHaveLength(397)
    expect(new Set(additionRows.map((row) => row[productIdIndex])).size).toBe(397)
    expect(additionRows.every((row) => row[batchIndex] && row[inputRowsIndex])).toBe(true)
    const membersByBatch = new Map<string, string[][]>()
    for (const row of additionRows) {
      membersByBatch.set(row[batchIndex], [...(membersByBatch.get(row[batchIndex]) ?? []), row])
    }
    expect(membersByBatch.size).toBe(13)
    for (const members of membersByBatch.values()) {
      expect(new Set(members.map((row) => Number(row[batchCountIndex])))).toEqual(
        new Set([members.length]),
      )
    }

    const allCommittedContents = (
      await Promise.all(
        BROCHURE_REVIEW_ARTIFACTS.map((filename) =>
          readFile(path.join(committedReviewDirectory, filename), 'utf8'),
        ),
      )
    ).join('\n')
    expect(allCommittedContents).not.toMatch(/file:\/\/|\/Users\/|\/home\//)
  })
})
