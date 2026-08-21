import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { format, resolveConfig } from 'prettier'

import { stableId } from './catalog-utils'
import { formatJson } from './format-json'
import {
  expandSourceCompletenessProducts,
  SOURCE_COMPLETENESS_REVIEW,
  type ExpandedSourceCompletenessProduct,
  type NonAdditionCandidate,
} from './source-completeness-intake'

const OUTPUT_DIRECTORY = 'docs/ip-preference-cards/source-completeness/2026-08-20'
const PRIOR_MANIFEST = 'docs/ip-preference-cards/brochure-intake/2026-08-19/source-manifest.json'

interface PriorManifest {
  format_version: string
  reviewed_on: string
  source_directory: string
  source_count: number
  pdf_count: number
  html_count: number
  markdown_count: number
  total_pdf_pages: number
  sources: Record<string, unknown>[]
}

interface DiscoveryRow {
  candidate_id: string
  origin: string
  manufacturer: string
  legal_manufacturer: string
  brand_or_distributor: string
  catalog_number: string
  alternate_identifier: string
  product_name: string
  source_evidence: string
  source_scope: string
  original_csv_status: string
  canonical_status_before: string
  exact_identifier_confidence: string
  clinical_scope_disposition: string
  disposition: string
  canonical_product_id: string
  role_assignment: string
  taxonomy_class: string
  taxonomy_subtype: string
  taxonomy_confidence: string
  owner_review_required: string
  rationale: string
}

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex')
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const rendered = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  return /[",\r\n]/.test(rendered) ? `"${rendered.replace(/"/g, '""')}"` : rendered
}

function toCsv<T extends object>(rows: T[], columns: (keyof T)[]): string {
  return (
    [
      columns.map(csvCell).join(','),
      ...rows.map((row) =>
        columns.map((column) => csvCell((row as Record<keyof T, unknown>)[column])).join(','),
      ),
    ].join('\n') + '\n'
  )
}

function evidenceText(product: ExpandedSourceCompletenessProduct): string {
  return product.evidence
    .map((evidence) => `${evidence.sourceId}: ${evidence.sourceLocation}`)
    .join(' | ')
}

function productRationale(product: ExpandedSourceCompletenessProduct): string {
  if (product.catalogNumber === '30030000') {
    return 'Separate with-accessories Screeni package; no GTIN copied from base configuration 30030001.'
  }
  if (product.catalogNumber === '30030001') {
    return 'Separate without-accessories Screeni base configuration; exact primary DI corroborated in AccessGUDID.'
  }
  if (product.catalogNumber === 'CC-1000-4') {
    return 'Exact four-cartridge package is distinct from the probe and kit; shared FDA base model is retained as an alternate identifier.'
  }
  if (product.catalogNumber === 'S012-01-019') {
    return 'Exact identity is resolved and clinically in scope; physical taxonomy intentionally remains other_needs_review.'
  }
  if (product.origin === 'official_web_follow_up') {
    return 'Absent as an exact product from the old CSV and baseline catalog; current manufacturer evidence supports exact identity and bounded airway scope.'
  }
  return 'Absent from the old CSV and baseline catalog; owner source plus manufacturer/FDA evidence supports an exact in-scope identity.'
}

function discoveryForProduct(
  product: ExpandedSourceCompletenessProduct,
  index: number,
): DiscoveryRow {
  const productId = stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`)
  const taxonomyReview = product.taxonomyClass === 'other_needs_review'
  return {
    candidate_id: `SC-CAND-${String(index + 1).padStart(3, '0')}`,
    origin: product.origin,
    manufacturer: product.manufacturer,
    legal_manufacturer: product.manufacturer,
    brand_or_distributor: [product.brandFamily, product.distributor].filter(Boolean).join(' / '),
    catalog_number: product.catalogNumber,
    alternate_identifier: product.alternateIds ?? '',
    product_name: product.productName,
    source_evidence: evidenceText(product),
    source_scope: 'exact_product',
    original_csv_status: 'absent',
    canonical_status_before: 'absent',
    exact_identifier_confidence: 'high',
    clinical_scope_disposition: 'in_scope',
    disposition: 'new_exact_product_candidate',
    canonical_product_id: productId,
    role_assignment: product.roleCode ?? 'intentionally_roleless',
    taxonomy_class: product.taxonomyClass,
    taxonomy_subtype: product.taxonomySubtype,
    taxonomy_confidence: product.taxonomyConfidence,
    owner_review_required: taxonomyReview ? 'yes' : 'no',
    rationale: productRationale(product),
  }
}

function discoveryForExisting(startIndex: number): DiscoveryRow[] {
  return SOURCE_COMPLETENESS_REVIEW.existing_matches.map((match, offset) => ({
    candidate_id: `SC-CAND-${String(startIndex + offset + 1).padStart(3, '0')}`,
    origin: match.origin,
    manufacturer: match.manufacturer,
    legal_manufacturer: match.manufacturer,
    brand_or_distributor: '',
    catalog_number: match.catalogNumber,
    alternate_identifier: match.alternateId,
    product_name: match.productName,
    source_evidence: match.evidence
      .map((evidence) => `${evidence.sourceId}: ${evidence.sourceLocation}`)
      .join(' | '),
    source_scope: 'exact_product',
    original_csv_status: 'represented',
    canonical_status_before: `existing ${match.productId}`,
    exact_identifier_confidence: 'high',
    clinical_scope_disposition: 'in_scope',
    disposition: 'existing_alias_or_format_variant',
    canonical_product_id: match.productId,
    role_assignment: match.roleCode,
    taxonomy_class: match.taxonomyClass,
    taxonomy_subtype: match.taxonomySubtype,
    taxonomy_confidence: 'high',
    owner_review_required: 'no',
    rationale: match.matchBasis,
  }))
}

function discoveryForNonAddition(candidate: NonAdditionCandidate, index: number): DiscoveryRow {
  return {
    candidate_id: `SC-CAND-${String(index + 1).padStart(3, '0')}`,
    origin: candidate.origin,
    manufacturer: candidate.manufacturer,
    legal_manufacturer: candidate.manufacturer,
    brand_or_distributor: '',
    catalog_number: candidate.catalogNumber ?? '',
    alternate_identifier: '',
    product_name: candidate.productName,
    source_evidence: `${candidate.sourceId ?? 'PR118'}: ${candidate.sourceLocation}`,
    source_scope: candidate.sourceScope,
    original_csv_status:
      candidate.previousCsvStatus === 'represented_family_row'
        ? 'represented_family_row'
        : candidate.previousCsvStatus === 'not_applicable_new_source'
          ? 'absent_new_source'
          : 'absent',
    canonical_status_before: candidate.canonicalBeforeStatus,
    exact_identifier_confidence: candidate.identifierConfidence,
    clinical_scope_disposition: candidate.clinicalScopeDisposition,
    disposition: candidate.disposition,
    canonical_product_id: '',
    role_assignment: 'none',
    taxonomy_class: '',
    taxonomy_subtype: '',
    taxonomy_confidence: '',
    owner_review_required: candidate.ownerReviewRequired ? 'yes' : 'no',
    rationale: candidate.rationale,
  }
}

function duplicateAnalysis(
  products: ExpandedSourceCompletenessProduct[],
): Record<string, unknown>[] {
  const additions = products.map((product) => {
    let highRiskNote =
      'No same-manufacturer exact catalog-number, normalized identifier, GTIN, alternate-identifier, or deterministic-ID collision in the 1,929-product baseline.'
    if (product.catalogNumber === '30030000' || product.catalogNumber === '30030001') {
      highRiskNote =
        '30030000 and 30030001 are separately listed package configurations. Only 30030001 carries the corroborated primary DI; 30030000 is retained without that GTIN.'
    } else if (/^(MCB|CC)-1000/.test(product.catalogNumber)) {
      highRiskNote =
        'The FDA base model is retained as an alternate identifier; distinct owner-supplied package suffixes remain separate orderable configurations.'
    } else if (product.distributor) {
      highRiskNote = `${product.manufacturer} remains the sole legal manufacturer; ${product.distributor} is distributor/brand context and does not create a duplicate manufacturer.`
    }
    return {
      manufacturer: product.manufacturer,
      catalog_number: product.catalogNumber,
      alternate_identifiers: product.alternateIds ?? '',
      gtin: product.gtin ?? '',
      normalized_catalog_number: product.catalogNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      baseline_products_compared: 1929,
      strongest_duplicate_candidates: highRiskNote,
      final_result: 'new_unique_exact_product',
      canonical_product_id: stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`),
    }
  })
  return additions.concat(
    SOURCE_COMPLETENESS_REVIEW.existing_matches.map((match) => ({
      manufacturer: match.manufacturer,
      catalog_number: match.catalogNumber,
      alternate_identifiers: match.alternateId,
      gtin: '',
      normalized_catalog_number: match.catalogNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      baseline_products_compared: 1929,
      strongest_duplicate_candidates: match.matchBasis,
      final_result: 'existing_alias_or_format_variant',
      canonical_product_id: match.productId,
    })),
  )
}

function ownerBreakdown(rows: DiscoveryRow[]): string[] {
  const groups = [
    [
      'TSC Life / Axess Vision',
      (row: DiscoveryRow) => row.legal_manufacturer === 'Axess Vision Technology S.A.S.',
    ],
    ['Praxis', (row: DiscoveryRow) => row.legal_manufacturer === 'Praxis Medical LLC'],
    ['Maverix / Thoracent', (row: DiscoveryRow) => row.legal_manufacturer === 'Serpex Medical'],
    ['Medinotec', (row: DiscoveryRow) => row.legal_manufacturer === 'DISA Medinotec'],
    [
      'EndoTherapeutics / HugeMed',
      (row: DiscoveryRow) => row.legal_manufacturer.startsWith('Shenzhen HugeMed'),
    ],
    ['CLR Medical', (row: DiscoveryRow) => row.legal_manufacturer === 'CLR Medical'],
    ['Cook Medical', (row: DiscoveryRow) => row.legal_manufacturer === 'Cook Medical'],
  ] as const
  return groups.map(([label, predicate]) => {
    const matches = rows.filter((row) => row.origin === 'owner_pdf' && predicate(row))
    const added = matches.filter((row) => row.disposition === 'new_exact_product_candidate').length
    const existing = matches.filter((row) => row.disposition.startsWith('existing_')).length
    const review = matches.filter((row) => row.owner_review_required === 'yes').length
    return `| ${label} | ${matches.length} | ${added} | ${existing} | ${review} |`
  })
}

function readme(rows: DiscoveryRow[], products: ExpandedSourceCompletenessProduct[]): string {
  const owner = rows.filter((row) => row.origin === 'owner_pdf')
  const web = rows.filter((row) => row.origin === 'official_web_follow_up')
  const existing = rows.filter((row) => row.disposition.startsWith('existing_'))
  const irrelevant = rows.filter((row) => row.disposition === 'irrelevant_to_current_scope')
  const ownerReview = rows.filter((row) => row.owner_review_required === 'yes')
  return `# Source Completeness + Owner-Supplied Product Intake V2

This is the deterministic review package for the bounded source-first follow-up after PR #118. It does not rewrite the PR #118 package, source workbook, raw source corpus, historical release, or published release pointer.

## Outcome

| Measure | Count |
| --- | ---: |
| Products discovered in the old corpus but absent from the old CSV | 0 |
| Owner-supplied PDF candidates | ${owner.length} |
| Official-web-only candidates | ${web.length} |
| Already canonical products | ${existing.length} |
| New exact products added | ${products.length} |
| Family-level/unresolved rows | ${rows.filter((row) => row.source_scope === 'family_level' || row.disposition === 'needs_owner_review').length} |
| Irrelevant products | ${irrelevant.length} |
| Products needing owner review | ${ownerReview.length} |

The prior 125 supported source documents were rescanned source-first: 115 PDFs, 7 HTML files, and 3 Markdown files comprising 2,609 PDF pages. All 125 still match the PR #118 manifest; no supported source was added, removed, or hash-changed. Four previously unreferenced files were directly inspected, and none contains a relevant exact product table omitted from the CSV.

The newly used evidence set adds 33 hashed artifacts: 7 PDFs comprising 68 pages (including the owner packet) and 26 official HTML records/pages.

The old Medtronic brochure contains M5 family context, but it was represented by CSV input row 791; it does not establish an exact source-to-CSV omission. The current Medtronic U.S. pages establish nine new exact powered-airway products. Across the 20-row airway-blade ordering table, seven were accepted, four remain in owner review, and nine laryngeal/ENT-only rows were excluded.

## Owner packet by manufacturer

| Reviewed identity | Candidates | Added | Existing | Owner review |
| --- | ---: | ---: | ---: | ---: |
${ownerBreakdown(rows).join('\n')}

The CLR owner page supplied family/component names without order codes. Official CLR IFUs plus AccessGUDID resolved five exact separately identified products. The CLR Irrigator is added with exact identity and remains a physical-taxonomy review item because the controlled vocabulary has no precise pleural suction/irrigation instrument subtype.

## Reconciliation model

Every discovery row in \`source-product-discovery.csv\` has exactly one controlled disposition. \`missing-from-original-csv.csv\` deliberately includes accepted, unresolved, and excluded exact candidates so absence from the old CSV is not confused with permission to import. \`new-product-additions.csv\` is the accepted 44-product subset.

Duplicate checks covered exact and normalized manufacturer/catalog identity, punctuation and spacing, alternate IDs, GTINs, deterministic IDs, package variants, and distributor/legal-manufacturer relationships. The Cook order numbers and ECHO reference numbers resolve to four existing canonical products and receive only new source relationships.

## Governance

- All 44 new products are \`verified_source\`, \`visibility_state=hidden\`, and make no local-orderability claim.
- Thirty-eight products receive an existing, evidence-supported role; six remain intentionally roleless. The two Screeni mounting components stay roleless because the existing mount-accessory role is introduced by a later governed overlay, after the catalog-additions validation gate.
- No canonical slot option is authored or promoted. Potential relationships remain in the unreviewed proposal workflow.
- Exactly one taxonomy row is produced for every verified-source product. One narrow pair rule was added for \`Therapeutic bronchoscopy / Cryotherapy consumable\`; CLR Irrigator intentionally remains \`other_needs_review\`.
- The owner PDF and all remote source captures remain external; only hashes, locations, URLs, and reviewed facts are committed.

## Files

- \`source-manifest.json\`: unchanged prior corpus plus every newly used owner/manufacturer/FDA evidence artifact and hash.
- \`source-product-discovery.csv\`: complete 63-row controlled-disposition ledger.
- \`missing-from-original-csv.csv\`: exact candidates absent from the original CSV, with final disposition.
- \`owner-supplied-products.csv\`: all 40 owner-packet targets.
- \`new-product-additions.csv\`: the 44 accepted exact products.
- \`existing-product-matches.csv\`: four Cook alias/exact matches.
- \`unresolved-relevant-products.csv\`: five held candidates plus the added CLR taxonomy-review row.
- \`irrelevant-products.csv\`: nine constrained ENT exclusions.
- \`duplicate-analysis.csv\`: per-product exact/alias/package/manufacturer duplicate review.
- \`manufacturer-summary.csv\`: counts by origin and legal manufacturer.
`
}

async function formatMarkdown(contents: string): Promise<string> {
  const filepath = path.join(process.cwd(), OUTPUT_DIRECTORY, 'README.md')
  return format(contents, { ...((await resolveConfig(filepath)) ?? {}), parser: 'markdown' })
}

async function buildFiles(): Promise<Map<string, string>> {
  const priorContents = await readFile(PRIOR_MANIFEST, 'utf8')
  const expectedPriorHash = String(SOURCE_COMPLETENESS_REVIEW.corpus_audit.prior_manifest_sha256)
  if (sha256(priorContents) !== expectedPriorHash) {
    throw new Error(`PR #118 source manifest hash changed; expected ${expectedPriorHash}.`)
  }
  const prior = JSON.parse(priorContents) as PriorManifest
  if (prior.sources.length !== 125)
    throw new Error(`Expected 125 prior sources; found ${prior.sources.length}.`)

  const products = expandSourceCompletenessProducts()
  const productRows = products.map(discoveryForProduct)
  const existingRows = discoveryForExisting(productRows.length)
  const nonAdditionStart = productRows.length + existingRows.length
  const nonAdditionRows = SOURCE_COMPLETENESS_REVIEW.non_addition_candidates.map(
    (candidate, offset) => discoveryForNonAddition(candidate, nonAdditionStart + offset),
  )
  const discovery = [...productRows, ...existingRows, ...nonAdditionRows]
  if (discovery.length !== 63)
    throw new Error(`Expected 63 discovery rows; found ${discovery.length}.`)

  const newEvidence = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.map((source) => ({
    provenance_origin: source.sourceId === 'SRC089' ? 'owner_pdf' : 'official_web_follow_up',
    source_filename: source.filename,
    relative_path: null,
    sha256: source.sha256,
    page_count: source.pageCount,
    document_type: source.sourceType,
    manufacturer: source.sourceOrganization,
    publisher: source.sourceOrganization,
    official_url: source.url,
    governed_source_ids: source.sourceId ? [source.sourceId] : [],
    matched_csv_row_count: 0,
    matched_input_row_numbers: [],
    canonical_additions_supported: products
      .filter((product) =>
        product.evidence.some((evidence) => evidence.sourceId === source.sourceId),
      )
      .map((product) => ({
        product_id: stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`),
        catalog_number: product.catalogNumber,
      })),
    evidence_id: source.evidenceId,
    evidence_scope: source.scope,
    identifier_matched: source.identifierMatched,
    retrieved_on: source.retrievedOn,
  }))
  const newPdfEvidence = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.filter((source) =>
    source.sourceType.includes('PDF'),
  )
  const newHtmlEvidence = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.filter(
    (source) => !source.sourceType.includes('PDF'),
  )
  const newPdfPages = newPdfEvidence.reduce((total, source) => total + (source.pageCount ?? 0), 0)
  const sourceManifest = {
    format_version: '1.0',
    reviewed_on: SOURCE_COMPLETENESS_REVIEW.reviewed_on,
    source_directory: prior.source_directory,
    source_count: prior.sources.length + newEvidence.length,
    old_corpus_source_count: prior.sources.length,
    new_evidence_count: newEvidence.length,
    new_owner_pdf_count: 1,
    new_official_web_evidence_count: newEvidence.length - 1,
    runtime_governed_source_count: SOURCE_COMPLETENESS_REVIEW.sources.length,
    current_directory_total_files: SOURCE_COMPLETENESS_REVIEW.corpus_audit.current_total_files,
    pdf_count: prior.pdf_count + newPdfEvidence.length,
    html_count: prior.html_count + newHtmlEvidence.length,
    markdown_count: prior.markdown_count,
    total_pdf_pages: prior.total_pdf_pages + newPdfPages,
    old_corpus_pdf_count: prior.pdf_count,
    old_corpus_html_count: prior.html_count,
    old_corpus_markdown_count: prior.markdown_count,
    old_corpus_total_pdf_pages: prior.total_pdf_pages,
    new_evidence_pdf_count: newPdfEvidence.length,
    new_evidence_html_count: newHtmlEvidence.length,
    new_evidence_total_pdf_pages: newPdfPages,
    prior_manifest_sha256: expectedPriorHash,
    prior_source_hash_mismatches: 0,
    prior_sources_missing: 0,
    prior_sources_added: 0,
    sources: [
      ...prior.sources.map((source) => ({ provenance_origin: 'old_corpus', ...source })),
      ...newEvidence,
    ],
  }

  const discoveryColumns = Object.keys(discovery[0]) as (keyof DiscoveryRow)[]
  const exactMissing = discovery.filter(
    (row) =>
      row.source_scope === 'exact_product' &&
      (row.original_csv_status === 'absent' || row.original_csv_status === 'absent_new_source'),
  )
  const ownerRows = discovery.filter((row) => row.origin === 'owner_pdf')
  const unresolved = discovery.filter(
    (row) =>
      row.disposition === 'needs_owner_review' || row.taxonomy_class === 'other_needs_review',
  )
  const irrelevant = discovery.filter((row) => row.disposition === 'irrelevant_to_current_scope')

  const additionRows = productRows.map((row) => ({
    product_id: row.canonical_product_id,
    manufacturer: row.legal_manufacturer,
    catalog_number: row.catalog_number,
    alternate_identifiers: row.alternate_identifier,
    product_name: row.product_name,
    origin: row.origin,
    verification_grade: 'verified_source',
    visibility_state: 'hidden',
    role_code: row.role_assignment,
    taxonomy_class: row.taxonomy_class,
    taxonomy_subtype: row.taxonomy_subtype,
    evidence: row.source_evidence,
  }))
  const existingMatchRows = existingRows.map((row) => ({
    product_id: row.canonical_product_id,
    manufacturer: row.legal_manufacturer,
    catalog_number: row.catalog_number,
    alternate_identifier: row.alternate_identifier,
    disposition: row.disposition,
    match_basis: row.rationale,
    new_source_evidence: row.source_evidence,
  }))
  const duplicates = duplicateAnalysis(products)

  const manufacturerGroups = new Map<string, DiscoveryRow[]>()
  for (const row of discovery) {
    const key = `${row.origin}\u0000${row.legal_manufacturer}`
    manufacturerGroups.set(key, [...(manufacturerGroups.get(key) ?? []), row])
  }
  const manufacturerSummary = [...manufacturerGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => {
      const [origin, manufacturer] = key.split('\u0000')
      return {
        origin,
        legal_manufacturer: manufacturer,
        candidates: rows.length,
        new_products_added: rows.filter((row) => row.disposition === 'new_exact_product_candidate')
          .length,
        existing_matches: rows.filter((row) => row.disposition.startsWith('existing_')).length,
        needs_owner_review: rows.filter((row) => row.owner_review_required === 'yes').length,
        irrelevant: rows.filter((row) => row.disposition === 'irrelevant_to_current_scope').length,
      }
    })

  const files = new Map<string, string>()
  files.set('README.md', await formatMarkdown(readme(discovery, products)))
  files.set('source-manifest.json', await formatJson(sourceManifest))
  files.set('source-product-discovery.csv', toCsv(discovery, discoveryColumns))
  files.set('missing-from-original-csv.csv', toCsv(exactMissing, discoveryColumns))
  files.set('owner-supplied-products.csv', toCsv(ownerRows, discoveryColumns))
  files.set(
    'new-product-additions.csv',
    toCsv(additionRows, Object.keys(additionRows[0]) as (keyof (typeof additionRows)[number])[]),
  )
  files.set(
    'existing-product-matches.csv',
    toCsv(
      existingMatchRows,
      Object.keys(existingMatchRows[0]) as (keyof (typeof existingMatchRows)[number])[],
    ),
  )
  files.set('unresolved-relevant-products.csv', toCsv(unresolved, discoveryColumns))
  files.set('irrelevant-products.csv', toCsv(irrelevant, discoveryColumns))
  files.set('duplicate-analysis.csv', toCsv(duplicates, Object.keys(duplicates[0]) as string[]))
  files.set(
    'manufacturer-summary.csv',
    toCsv(
      manufacturerSummary,
      Object.keys(manufacturerSummary[0]) as (keyof (typeof manufacturerSummary)[number])[],
    ),
  )
  return files
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check')
  const files = await buildFiles()
  if (check) {
    const mismatches: string[] = []
    for (const [filename, expected] of files) {
      const filePath = path.join(OUTPUT_DIRECTORY, filename)
      let actual: string | null = null
      try {
        actual = await readFile(filePath, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      if (actual !== expected) mismatches.push(filename)
    }
    if (mismatches.length > 0) {
      throw new Error(`Source-completeness review package is stale: ${mismatches.join(', ')}`)
    }
    console.log(`Source-completeness review package is current (${files.size} files).`)
    return
  }

  await mkdir(OUTPUT_DIRECTORY, { recursive: true })
  for (const [filename, contents] of files) {
    await writeFile(path.join(OUTPUT_DIRECTORY, filename), contents, 'utf8')
  }
  console.log(`Wrote ${files.size} source-completeness review files to ${OUTPUT_DIRECTORY}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
