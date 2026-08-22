import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { format, resolveConfig } from 'prettier'

import { stableId } from './catalog-utils'
import { formatJson } from './format-json'
import {
  expandNovatechMatrixRefs,
  expandSourceCompletenessProducts,
  SOURCE_COMPLETENESS_REVIEW,
  sourceCompletenessCount,
  type ExpandedSourceCompletenessProduct,
  type NonAdditionCandidate,
} from './source-completeness-intake'
import {
  normalizeScannedIdentifier,
  scanOldCorpus,
  type CorpusScan,
  type ScannerCandidate,
} from './source-completeness-corpus-scan'
import {
  assignCorpusDispositions,
  candidateKey,
  type DispositionAssignment,
  type DispositionIdentitySets,
} from './source-completeness-dispositions'

const OUTPUT_DIRECTORY = 'docs/ip-preference-cards/source-completeness/2026-08-20'
const PRIOR_MANIFEST = 'docs/ip-preference-cards/brochure-intake/2026-08-19/source-manifest.json'
const CATALOG_PATH = 'data/ip-preference-cards/generated/catalog-products.json'

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

function sha256(contents: string | Buffer): string {
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
  if (product.origin === 'old_corpus') {
    if (product.groupId.startsWith('novatech_gss_matrix')) {
      return 'Corpus-wide layout-aware extraction found this exact reference in the Novatech stent ordering matrix (pages 12-15) outside the original CSV; dimensions are inherited from the reviewed matrix headers and the full matrix was expanded deterministically.'
    }
    if (product.groupId === 'cook_thal_quick_trays_correction') {
      return 'Corpus-wide layout-aware extraction found this exact order/reference tray row in the one-product-per-page Cook Thal-Quick capture outside the original CSV and baseline catalog.'
    }
    if (product.groupId === 'cook_blue_rhino_g2_multi_correction') {
      return 'Corpus-wide layout-aware extraction reconstructed this hyphen-wrapped order/reference row in the one-product-per-page Blue Rhino capture; absent from the original CSV and baseline catalog.'
    }
    if (product.groupId === 'cook_pleural_drainage_accessories_correction') {
      return 'Corpus-wide layout-aware extraction found this exact order/reference accessory row in the Cook chest-drainage ordering brochure outside the original CSV and baseline catalog.'
    }
    if (product.groupId === 'storz_rigid_optical_forceps_correction') {
      return 'The explicit ordering-label scanner correction surfaced this exact "Item no:" identifier in the KARL STORZ rigid-bronchoscopy e-catalog capture; the rendered product card shows an exact in-scope optical forceps absent from the original CSV and baseline catalog.'
    }
    return 'A deterministic page-by-page table extraction found the exact R-series row outside the original CSV; rendered manufacturer tables and exact FDA evidence support this in-scope identity.'
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
    } else if (product.catalogNumber === 'MCB-1000-4') {
      highRiskNote =
        'The FDA MCB-1000 base model is retained only on the exact probe product; the kit does not reuse that alias.'
    } else if (product.catalogNumber === 'MCB-1000-Kit') {
      highRiskNote =
        'The owner-supplied kit code is a distinct configuration and does not claim the FDA MCB-1000 probe alias.'
    } else if (product.catalogNumber === 'CC-1000-4') {
      highRiskNote =
        'The FDA CC-1000 cartridge base model is retained only on the exact four-cartridge package.'
    } else if (product.groupId.startsWith('novatech_gss_matrix')) {
      highRiskNote =
        'Novatech matrix reference; the seven already-canonical GSS references are excluded from expansion, so no baseline Novatech identifier is duplicated.'
    } else if (product.alternateIds) {
      highRiskNote = `The paired order/reference identifiers (${product.catalogNumber} / ${product.alternateIds}) identify one exact product; the reference number is carried as an alternate identifier, not a second product.`
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

interface AssignedCandidate {
  candidate: ScannerCandidate
  assignment: DispositionAssignment
}

interface CorpusLedger {
  scan: CorpusScan
  assigned: AssignedCandidate[]
  csvIdentifiers: Set<string>
  finalCatalogIds: Map<string, string>
  dispositionCounts: Map<string, number>
  basisCounts: Map<string, number>
  highRiskDocuments: string[]
}

/**
 * Run the corpus scanner and assign every candidate a controlled disposition. The scanner output
 * is the authoritative candidate source: the reviewed configuration may only disposition
 * candidates the scanner produced, and any unhandled candidate fails the build.
 */
/**
 * The frozen corpus root is machine-local operational state, not governed review data: the
 * reviewed package pins the corpus by manifest and hash and only names the environment
 * variable that carries the root (the same variable the brochure-intake generator uses), so
 * no machine-specific absolute path is ever committed.
 */
function resolveCorpusRoot(): string {
  const envName = String(SOURCE_COMPLETENESS_REVIEW.corpus_audit.source_directory_env ?? '')
  if (!/^[A-Z][A-Z0-9_]*$/.test(envName)) {
    throw new Error(
      'corpus_audit.source_directory_env must name the corpus-root environment variable.',
    )
  }
  const value = process.env[envName]
  if (!value) {
    throw new Error(
      `${envName} is required and must contain preference_card_products.csv and brochures/.`,
    )
  }
  return path.resolve(value)
}

function buildCorpusLedger(products: ExpandedSourceCompletenessProduct[]): CorpusLedger {
  const audit = SOURCE_COMPLETENESS_REVIEW.corpus_audit
  const sourceDirectory = resolveCorpusRoot()

  const csvPath = path.join(sourceDirectory, 'preference_card_products.csv')
  const csvBytes = readFileSync(csvPath)
  const expectedCsvHash = String(audit.original_csv_sha256)
  if (sha256(csvBytes) !== expectedCsvHash) {
    throw new Error(`Original CSV hash changed; expected ${expectedCsvHash}.`)
  }
  const csvIdentifiers = new Set<string>()
  for (const line of csvBytes.toString('utf8').split('\n').slice(1)) {
    const identifier = line.split(',')[0]
    if (!identifier) continue
    const normalized = normalizeScannedIdentifier(identifier)
    if (normalized.length >= 4) csvIdentifiers.add(normalized)
  }
  const csvMinimum =
    SOURCE_COMPLETENESS_REVIEW.corpus_scan_review.original_csv_identifier_count_minimum
  if (csvIdentifiers.size < csvMinimum) {
    throw new Error(
      `Original CSV yielded ${csvIdentifiers.size} identifiers; expected at least ${csvMinimum}.`,
    )
  }

  const sourceFilenamesById = new Map<string, string[]>()
  for (const source of SOURCE_COMPLETENESS_REVIEW.sources) {
    if (source.filename) sourceFilenamesById.set(source.sourceId, [source.filename])
  }
  sourceFilenamesById.set(
    SOURCE_COMPLETENESS_REVIEW.novatech_stent_matrix.evidenceSourceId,
    SOURCE_COMPLETENESS_REVIEW.novatech_stent_matrix.evidenceDocuments,
  )
  const generatedSources = JSON.parse(
    readFileSync('data/ip-preference-cards/generated/sources.json', 'utf8'),
  ) as { source_id: string; filename?: string | null }[]
  for (const source of generatedSources) {
    if (source.filename && !sourceFilenamesById.has(source.source_id)) {
      sourceFilenamesById.set(source.source_id, [source.filename])
    }
  }

  const additionExact = new Map<string, string>()
  const additionAlias = new Map<string, string>()
  const additionEvidenceDocuments = new Map<string, Set<string>>()
  for (const product of products) {
    const productId = stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`)
    additionExact.set(normalizeScannedIdentifier(product.catalogNumber), productId)
    for (const alias of String(product.alternateIds ?? '').split(/[;,]/)) {
      const normalized = normalizeScannedIdentifier(alias.replace(/^PRIMARY DI\s*/i, ''))
      if (normalized.length >= 4) additionAlias.set(normalized, productId)
    }
    const documents = new Set<string>()
    for (const evidence of product.evidence) {
      for (const filename of sourceFilenamesById.get(evidence.sourceId) ?? []) {
        documents.add(filename)
      }
    }
    additionEvidenceDocuments.set(productId, documents)
  }

  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as {
    product_id: string
    catalog_number?: string | null
    alternate_ids?: string | null
    gtin?: string | null
  }[]
  const additionIds = new Set(additionExact.values())
  const baselineExact = new Map<string, string>()
  const baselineAlias = new Map<string, string>()
  const finalCatalogIds = new Map<string, string>()
  for (const product of catalog) {
    const exact = normalizeScannedIdentifier(product.catalog_number ?? '')
    if (exact.length >= 3) finalCatalogIds.set(exact, product.product_id)
    if (additionIds.has(product.product_id)) continue
    if (exact.length >= 3) baselineExact.set(exact, product.product_id)
    for (const alias of String(product.alternate_ids ?? '').split(/[;,]/)) {
      const normalized = normalizeScannedIdentifier(alias.replace(/^PRIMARY DI\s*/i, ''))
      if (normalized.length >= 4) baselineAlias.set(normalized, product.product_id)
    }
    const gtin = normalizeScannedIdentifier(product.gtin ?? '')
    if (gtin) baselineAlias.set(gtin, product.product_id)
  }
  for (const [identifier, productId] of additionExact) finalCatalogIds.set(identifier, productId)

  const scan = scanOldCorpus(sourceDirectory, PRIOR_MANIFEST)
  if (scan.pdfsScanned !== 115 || scan.pagesScanned !== 2609) {
    throw new Error(
      `Corpus scan covered ${scan.pdfsScanned} PDFs / ${scan.pagesScanned} pages; the frozen corpus is 115 PDFs / 2,609 pages.`,
    )
  }

  const identities: DispositionIdentitySets = {
    additionExact,
    additionAlias,
    additionEvidenceDocuments,
    baselineExact,
    baselineAlias,
    csvIdentifiers,
  }
  const candidates = scan.documents.flatMap((document) => document.candidates)
  const { assignments, unhandled } = assignCorpusDispositions(candidates, {
    overrides: SOURCE_COMPLETENESS_REVIEW.corpus_scan_review.candidate_overrides,
    documentRules: SOURCE_COMPLETENESS_REVIEW.corpus_scan_review.document_rules,
    identities,
  })
  if (unhandled.length > 0) {
    throw new Error(
      `UNHANDLED_SCANNER_CANDIDATES=${unhandled.length}: ${unhandled
        .slice(0, 5)
        .map((candidate) => `${candidate.sourceFilename}/${candidate.normalizedIdentifier}`)
        .join(', ')}${unhandled.length > 5 ? ', ...' : ''}`,
    )
  }

  const assigned: AssignedCandidate[] = candidates.map((candidate) => {
    const assignment = assignments.get(candidate)
    if (!assignment) {
      throw new Error(`Candidate ${candidate.normalizedIdentifier} has no disposition.`)
    }
    return { candidate, assignment }
  })

  // Scanner-to-review connectivity: every accepted old-corpus product must be backed by a
  // scanner candidate in its reviewed evidence document, on the evidence page it claims.
  const candidatePages = new Map<string, Set<number>>()
  for (const candidate of candidates) {
    candidatePages.set(
      candidateKey(candidate.sourceFilename, candidate.normalizedIdentifier),
      new Set(candidate.pages),
    )
  }
  const acceptedIds = new Set(
    assigned
      .filter(({ assignment }) => assignment.disposition === 'new_exact_product_candidate')
      .map(({ assignment }) => assignment.canonicalProductId),
  )
  for (const product of products) {
    if (product.origin !== 'old_corpus') continue
    const productId = stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`)
    if (!acceptedIds.has(productId)) {
      throw new Error(
        `Accepted old-corpus product ${product.catalogNumber} has no backing scanner candidate in its reviewed evidence document.`,
      )
    }
    for (const evidence of product.evidence) {
      const pageMatch = evidence.sourceLocation.match(/PDF page (\d+)/)
      if (!pageMatch) continue
      const page = Number(pageMatch[1])
      const files = sourceFilenamesById.get(evidence.sourceId) ?? []
      const supported = files.some((filename) =>
        candidatePages
          .get(candidateKey(filename, normalizeScannedIdentifier(product.catalogNumber)))
          ?.has(page),
      )
      if (!supported) {
        throw new Error(
          `Evidence locator for ${product.catalogNumber} claims PDF page ${page}, but the scanner did not see that identifier on that page of the evidence document.`,
        )
      }
    }
  }

  // The reviewed Novatech matrix must equal the scanner's stent-table reference set exactly.
  const matrix = SOURCE_COMPLETENESS_REVIEW.novatech_stent_matrix
  const matrixRefs = new Set(expandNovatechMatrixRefs(matrix).map((entry) => entry.ref))
  for (const filename of matrix.evidenceDocuments) {
    const document = scan.documents.find((entry) => entry.sourceFilename === filename)
    if (!document) throw new Error(`Novatech evidence document ${filename} was not scanned.`)
    const scannedRefs = new Set(
      document.candidates
        .filter(
          (candidate) =>
            candidate.pages.some((page) => page >= 12 && page <= 15) &&
            /^(0[0-9]{5}S[0-9]+|01(BD|TD|TF|Y|OKI|ST|DST)[0-9V]+)$/.test(candidate.rawIdentifier),
        )
        .map((candidate) => candidate.rawIdentifier),
    )
    if (scannedRefs.size !== matrixRefs.size) {
      throw new Error(
        `Scanner found ${scannedRefs.size} stent references in ${filename}; the reviewed matrix expands to ${matrixRefs.size}.`,
      )
    }
    for (const ref of scannedRefs) {
      if (!matrixRefs.has(ref)) {
        throw new Error(
          `Scanner reference ${ref} in ${filename} is absent from the reviewed matrix.`,
        )
      }
    }
  }

  const dispositionCounts = new Map<string, number>()
  const basisCounts = new Map<string, number>()
  for (const { assignment } of assigned) {
    dispositionCounts.set(
      assignment.disposition,
      (dispositionCounts.get(assignment.disposition) ?? 0) + 1,
    )
    basisCounts.set(assignment.basis, (basisCounts.get(assignment.basis) ?? 0) + 1)
  }

  const highRiskDocuments = scan.documents
    .filter(
      (document) =>
        document.candidates.length >= 100 ||
        document.matrixPages.length >= 2 ||
        document.orderingHeadingPages.length >= 10 ||
        (document.pageCount > 0 && document.candidates.length / document.pageCount >= 3),
    )
    .map((document) => document.sourceFilename)
    .sort()

  return {
    scan,
    assigned,
    csvIdentifiers,
    finalCatalogIds,
    dispositionCounts,
    basisCounts,
    highRiskDocuments,
  }
}

function sortedCounts(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
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

function readme(
  rows: DiscoveryRow[],
  products: ExpandedSourceCompletenessProduct[],
  ledger: CorpusLedger,
): string {
  const counts = SOURCE_COMPLETENESS_REVIEW.count_contract
  const owner = rows.filter((row) => row.origin === 'owner_pdf')
  const web = rows.filter((row) => row.origin === 'official_web_follow_up')
  const oldCorpus = rows.filter(
    (row) => row.origin === 'old_corpus' && row.disposition === 'new_exact_product_candidate',
  )
  const irrelevant = rows.filter((row) => row.disposition === 'irrelevant_to_current_scope')
  const ownerReview = rows.filter((row) => row.owner_review_required === 'yes')
  const totalCandidates = ledger.assigned.length
  const disposition = (name: string): number => ledger.dispositionCounts.get(name) ?? 0
  return `# Source Completeness + Owner-Supplied Product Intake V2

This is the deterministic review package for the bounded source-first follow-up after PR #118. It does not rewrite the PR #118 package, source workbook, raw source corpus, historical release, or published release pointer.

## Corpus-scan ledger

Every page of all 115 frozen old-corpus PDFs (2,609 pages) is scanned by a layout-aware extractor (\`source-completeness-corpus-scan.ts\`) with no minimum identifier count per page, no contiguous-page requirement, and no page-leading requirement; it reconstructs hyphen-wrapped cells, joins split references, and records matrix header/row context. The scanner output — not a static reviewed list — is the authoritative candidate source for this package: this generator invokes the scanner, joins its candidates against the original CSV, the pre-review catalog, and the reviewed dispositions, and fails closed if any candidate is left without exactly one controlled disposition.

| Ledger measure | Count |
| --- | ---: |
| Scanner candidates (unique identifier per document) | ${totalCandidates} |
| Dispositions assigned | ${totalCandidates} |
| Unhandled candidates | 0 |
| Represented in the original CSV | ${disposition('previously_accounted_csv')} |
| Exact identifiers of pre-review canonical products | ${disposition('existing_exact')} |
| Alias/format variants of canonical products | ${disposition('existing_alias_or_format_variant')} |
| Accepted new exact product rows | ${disposition('new_exact_product_candidate')} |
| Duplicate source occurrences (paired references, duplicate captures) | ${disposition('duplicate_source_occurrence')} |
| Held in owner review | ${disposition('needs_owner_review')} |
| Insufficient identity (fragments, truncations) | ${disposition('relevant_but_insufficient_identity')} |
| Family-level only | ${disposition('relevant_family_level_only')} |
| Source-evidence conflicts | ${disposition('source_evidence_conflicted')} |
| Out of current scope | ${disposition('irrelevant_to_current_scope')} |
| Not product identifiers (citations, patents, billing codes, revision codes) | ${disposition('not_a_product_identifier')} |
| Objective high-risk documents (density/matrix/ordering criteria) | ${ledger.highRiskDocuments.length} |

## Outcome

| Measure | Count |
| --- | ---: |
| Old-corpus exact products added by this review | ${oldCorpus.length} |
| Owner-supplied PDF candidates | ${owner.length} |
| Official-web-only candidates | ${web.length} |
| New exact products added (all origins) | ${products.length} |
| Irrelevant product rows in the product-level ledger | ${irrelevant.length} |
| Product rows needing owner review | ${ownerReview.length} |

The prior 125 supported source documents were checked against the frozen PR #118 manifest: 115 PDFs, 7 HTML files, and 3 Markdown files comprising 2,609 PDF pages. All 125 still match; no supported source was added, removed, or hash-changed.

## Corrected cohorts

- **Cook Thal-Quick**: the one-product-per-page capture pairs one order number with one reference part number per page. All 20 rows (10 trays, 10 sets) were reconciled; the four tray configurations absent from both the original CSV and the baseline catalog (G06885/C-TQTSY-1000, G05464/C-TQTSY-1200, G07090/C-TQTSY-1400, G04220/C-TQTSY-2400) were added with the reference part number as an alternate identifier. The Cook omnibus chest-drainage brochure (SRC076) was reconciled row-by-row; it added the two vinyl connecting tubes (G02327, G02791) and the Cook Chest Drain Valve (G36370), while its pericardiocentesis rows are held in owner review.
- **Novatech DUMON/GSS stents**: the straight-stent diameter-by-length matrix (pages 12-13) and the Y/OKI/ST/DST special-shape tables (pages 14-15) carry 148 exact references. All 148 were reconciled from scanner output; a compact reviewed matrix expands them deterministically, seven were already canonical, and the remaining 141 were added with header-inherited dimensions. The Spanish-edition catalog carries the identical reference set and is accounted as duplicate occurrences.
- **Blue Rhino G2-Multi**: all 21 one-product-per-page ordering rows were reconciled, reconstructing the hyphen-wrapped reference part numbers; the 15 sets/trays absent from both the original CSV and the baseline catalog were added, and the six existing rows received their in-row reference pairings.
- **KARL STORZ rigid-bronchoscopy explicit item numbers**: an explicit ordering label ("Item no:", "Catalog number", "Ref. no:") now routes the token it labels through a context-aware path before the generic unit/ordinal suffix filter, so digit-leading identifiers ending in unit-like letters (10350F, 10318D, 10350ST) survive. All 94 explicit \`Item no:\` values in the US e-catalog rigid-bronchoscopy capture are now scanner candidates; the 16 previously missed values reconcile as 14 exact baseline catalog numbers, one CSV-represented identifier (10318L), and one exact new in-scope product (10350F, Optical Forceps, large jaws, blunt — rendered capture page 49).

## Owner packet by manufacturer

| Reviewed identity | Candidates | Added | Existing | Owner review |
| --- | ---: | ---: | ---: | ---: |
${ownerBreakdown(rows).join('\n')}

## Reconciliation model

Every scanner candidate in \`old-corpus-candidate-dispositions.csv\` and every product row in \`source-product-discovery.csv\` has exactly one controlled disposition. \`missing-from-original-csv.csv\` deliberately includes accepted, unresolved, and excluded exact candidates so absence from the old CSV is not confused with permission to import. \`new-product-additions.csv\` is the accepted ${counts.new_exact_products}-product subset.

Duplicate checks covered exact and normalized manufacturer/catalog identity, punctuation and spacing, alternate IDs, GTINs, deterministic IDs, package variants, order/reference pairings, and distributor/legal-manufacturer relationships.

## Governance

- All ${counts.new_exact_products} new products are \`verified_source\`, \`visibility_state=hidden\`, and make no local-orderability claim.
- ${counts.product_roles} products receive an existing, evidence-supported role; six remain intentionally roleless.
- No canonical slot option is authored or promoted. Potential relationships remain in the unreviewed proposal workflow.
- Exactly one taxonomy row is produced for every verified-source product.
- The owner PDF and all remote source captures remain external; only hashes, locations, URLs, and reviewed facts are committed.

## Files

- \`source-manifest.json\`: unchanged prior corpus plus every newly used owner/manufacturer/FDA evidence artifact and hash.
- \`old-corpus-candidate-extraction.csv\`: the complete ${totalCandidates}-candidate scanner output with detection metadata.
- \`old-corpus-candidate-dispositions.csv\`: one controlled disposition per scanner candidate, with basis, rule, and rationale.
- \`old-corpus-page-coverage.csv\`: per-page candidate coverage for all 2,609 corpus pages.
- \`old-corpus-document-summary.csv\`: per-document accounting for all 115 PDFs.
- \`scanner-summary.json\`: scan totals, per-rule and per-disposition counts, and the derived high-risk document list.
- \`old-corpus-table-page-coverage.csv\`: rendered-inspection contract for the reconciled ordering/matrix sections.
- \`source-product-discovery.csv\`: complete ${counts.discovery_rows}-row product-level controlled-disposition ledger.
- \`missing-from-original-csv.csv\`: exact candidates absent from the original CSV, with final disposition.
- \`owner-supplied-products.csv\`: all 40 owner-packet targets.
- \`new-product-additions.csv\`: the ${counts.new_exact_products} accepted exact products.
- \`existing-product-matches.csv\`: four Cook alias/exact matches.
- \`unresolved-relevant-products.csv\`: held exact candidates and controlled conflicts.
- \`irrelevant-products.csv\`: constrained exclusions.
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
  const ledger = buildCorpusLedger(products)

  const productRows = products.map(discoveryForProduct)
  const existingRows = discoveryForExisting(productRows.length)
  const nonAdditionStart = productRows.length + existingRows.length
  const nonAdditionRows = SOURCE_COMPLETENESS_REVIEW.non_addition_candidates.map(
    (candidate, offset) => discoveryForNonAddition(candidate, nonAdditionStart + offset),
  )
  const discovery = [...productRows, ...existingRows, ...nonAdditionRows]
  const expectedDiscoveryRows = sourceCompletenessCount('discovery_rows')
  if (discovery.length !== expectedDiscoveryRows)
    throw new Error(`Expected ${expectedDiscoveryRows} discovery rows; found ${discovery.length}.`)

  const expectedCandidates = sourceCompletenessCount('corpus_scan_candidates')
  if (ledger.assigned.length !== expectedCandidates) {
    throw new Error(
      `Corpus scan produced ${ledger.assigned.length} candidates; the reviewed contract pins ${expectedCandidates}.`,
    )
  }
  const expectedHighRisk = sourceCompletenessCount('corpus_scan_high_risk_documents')
  if (ledger.highRiskDocuments.length !== expectedHighRisk) {
    throw new Error(
      `Derived ${ledger.highRiskDocuments.length} high-risk documents; the reviewed contract pins ${expectedHighRisk}.`,
    )
  }

  const productByCatalogNumber = new Map(
    products.map((product) => [product.catalogNumber, product] as const),
  )

  const newEvidence = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.map((source) => {
    if (
      source.supportedCatalogNumbers.length === 0 ||
      new Set(source.supportedCatalogNumbers).size !== source.supportedCatalogNumbers.length
    ) {
      throw new Error(
        `Evidence ${source.evidenceId} must enumerate a nonempty, duplicate-free product list.`,
      )
    }
    const supportedProducts = source.supportedCatalogNumbers.map((catalogNumber) => {
      const product = productByCatalogNumber.get(catalogNumber)
      if (!product) {
        throw new Error(
          `Evidence ${source.evidenceId} references unknown catalog number ${catalogNumber}.`,
        )
      }
      if (!product.evidence.some((evidence) => evidence.sourceId === source.sourceId)) {
        throw new Error(
          `Evidence ${source.evidenceId} does not have a reviewed ${source.sourceId} relationship to ${catalogNumber}.`,
        )
      }
      return product
    })
    return {
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
      canonical_additions_supported: supportedProducts.map((product) => ({
        product_id: stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`),
        catalog_number: product.catalogNumber,
      })),
      evidence_id: source.evidenceId,
      evidence_scope: source.scope,
      identifier_matched: source.identifierMatched,
      retrieved_on: source.retrievedOn,
    }
  })
  const newPdfEvidence = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.filter((source) =>
    source.sourceType.includes('PDF'),
  )
  const newHtmlEvidence = SOURCE_COMPLETENESS_REVIEW.evidence_manifest.filter(
    (source) => !source.sourceType.includes('PDF'),
  )
  const newPdfPages = newPdfEvidence.reduce((total, source) => total + (source.pageCount ?? 0), 0)
  if (newPdfEvidence.length !== sourceCompletenessCount('new_pdf_evidence_files')) {
    throw new Error(`New PDF evidence count does not match the reviewed count contract.`)
  }
  if (newPdfPages !== sourceCompletenessCount('new_pdf_evidence_pages')) {
    throw new Error(`New PDF evidence page total does not match the reviewed count contract.`)
  }
  const bindings = SOURCE_COMPLETENESS_REVIEW.corpus_scan_review.old_corpus_governed_source_bindings
  const priorSources = prior.sources.map((source) => {
    const record = source as {
      relative_path?: string | null
      governed_source_ids?: string[]
      canonical_additions_supported?: { product_id: string; catalog_number: string }[]
    }
    const sourceIds = new Set(record.governed_source_ids ?? [])
    for (const binding of bindings) {
      if ((record.relative_path ?? '').includes(binding.relativePathIncludes)) {
        sourceIds.add(binding.sourceId)
      }
    }
    const addedSupport = products
      .filter(
        (product) =>
          product.origin === 'old_corpus' &&
          product.evidence.some((evidence) => sourceIds.has(evidence.sourceId)),
      )
      .map((product) => ({
        product_id: stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`),
        catalog_number: product.catalogNumber,
      }))
    const base = {
      provenance_origin: 'old_corpus',
      ...source,
      governed_source_ids: [...sourceIds].sort(),
    }
    if (addedSupport.length === 0) return base
    const supportById = new Map(
      [...(record.canonical_additions_supported ?? []), ...addedSupport].map((item) => [
        item.product_id,
        item,
      ]),
    )
    return {
      ...base,
      canonical_additions_supported: [...supportById.values()].sort((left, right) =>
        left.catalog_number.localeCompare(right.catalog_number),
      ),
    }
  })
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
    sources: [...priorSources, ...newEvidence],
  }
  if (sourceManifest.total_pdf_pages !== sourceCompletenessCount('aggregate_pdf_pages')) {
    throw new Error(`Aggregate PDF page total does not match the reviewed count contract.`)
  }

  const discoveryColumns = Object.keys(discovery[0]) as (keyof DiscoveryRow)[]
  const exactMissing = discovery.filter(
    (row) =>
      row.source_scope === 'exact_product' &&
      (row.original_csv_status === 'absent' || row.original_csv_status === 'absent_new_source'),
  )
  const ownerRows = discovery.filter((row) => row.origin === 'owner_pdf')
  const unresolved = discovery.filter(
    (row) => row.owner_review_required === 'yes' || row.taxonomy_class === 'other_needs_review',
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
    const key = `${row.origin}|${row.legal_manufacturer}`
    manufacturerGroups.set(key, [...(manufacturerGroups.get(key) ?? []), row])
  }
  const manufacturerSummary = [...manufacturerGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => {
      const [origin, manufacturer] = key.split('|')
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

  // ---- corpus-scan artifacts, derived entirely from scanner output + reviewed dispositions.
  const extractionRows = ledger.assigned.map(({ candidate }) => ({
    source_filename: candidate.sourceFilename,
    source_sha256: candidate.sourceSha256,
    manufacturer: candidate.manufacturer ?? '',
    document_page_count: candidate.documentPageCount,
    first_page: candidate.firstPage,
    pages: candidate.pages.join(';'),
    occurrence_count: candidate.occurrenceCount,
    raw_identifier: candidate.rawIdentifier,
    normalized_identifier: candidate.normalizedIdentifier,
    detection_rule: candidate.detectionRule,
    confidence: candidate.confidence,
    column: candidate.column,
    column_header: candidate.columnHeader ?? '',
    row_label: candidate.rowLabel ?? '',
    paired_identifier: candidate.pairedIdentifier ?? '',
    heading_context: candidate.headingContext,
    line_context: candidate.lineContext,
  }))

  const dispositionRows = ledger.assigned.map(({ candidate, assignment }) => ({
    source_filename: candidate.sourceFilename,
    normalized_identifier: candidate.normalizedIdentifier,
    raw_identifier: candidate.rawIdentifier,
    first_page: candidate.firstPage,
    detection_rule: candidate.detectionRule,
    original_csv_match: ledger.csvIdentifiers.has(candidate.normalizedIdentifier),
    final_catalog_product_id: ledger.finalCatalogIds.get(candidate.normalizedIdentifier) ?? '',
    disposition: assignment.disposition,
    disposition_basis: assignment.basis,
    rule_id: assignment.ruleId ?? '',
    canonical_product_id: assignment.canonicalProductId ?? '',
    owner_review_required: assignment.ownerReviewRequired,
    rationale: assignment.rationale,
    evidence_locator: `${candidate.sourceFilename} p.${candidate.pages.join(';')}`,
  }))

  const pageCoverageRows = ledger.scan.documents.flatMap((document) =>
    Array.from({ length: document.pageCount }, (_, index) => {
      const page = index + 1
      return {
        source_filename: document.sourceFilename,
        page,
        candidate_identifiers: document.pageCandidateCounts.get(page) ?? 0,
        has_candidates: document.pageCandidateCounts.has(page),
      }
    }),
  )

  const assignmentsByDocument = new Map<string, AssignedCandidate[]>()
  for (const entry of ledger.assigned) {
    const key = entry.candidate.sourceFilename
    assignmentsByDocument.set(key, [...(assignmentsByDocument.get(key) ?? []), entry])
  }
  const renderedFilenames = new Set(
    (SOURCE_COMPLETENESS_REVIEW.corpus_audit.table_page_coverage as { filename: string }[]).map(
      (row) => row.filename,
    ),
  )
  const documentSummaryRows = ledger.scan.documents.map((document) => {
    const entries = assignmentsByDocument.get(document.sourceFilename) ?? []
    const count = (name: string): number =>
      entries.filter(({ assignment }) => assignment.disposition === name).length
    return {
      source_filename: document.sourceFilename,
      sha256: document.sourceSha256,
      manufacturer: document.manufacturer ?? '',
      page_count: document.pageCount,
      pages_with_candidates: document.pagesWithCandidates.length,
      candidate_count: document.candidates.length,
      ordering_heading_pages: document.orderingHeadingPages.length,
      matrix_pages: document.matrixPages.length,
      high_risk: ledger.highRiskDocuments.includes(document.sourceFilename),
      review_method: renderedFilenames.has(document.sourceFilename)
        ? 'corpus_text_extraction+rendered_manual_inspection'
        : 'corpus_text_extraction',
      accepted_new_products: count('new_exact_product_candidate'),
      existing_exact: count('existing_exact'),
      existing_alias_or_format_variant: count('existing_alias_or_format_variant'),
      previously_accounted_csv: count('previously_accounted_csv'),
      duplicate_source_occurrence: count('duplicate_source_occurrence'),
      needs_owner_review: count('needs_owner_review'),
      relevant_but_insufficient_identity: count('relevant_but_insufficient_identity'),
      relevant_family_level_only: count('relevant_family_level_only'),
      source_evidence_conflicted: count('source_evidence_conflicted'),
      irrelevant_to_current_scope: count('irrelevant_to_current_scope'),
      not_a_product_identifier: count('not_a_product_identifier'),
    }
  })

  const scannerSummary = {
    format_version: '1.0',
    reviewed_on: SOURCE_COMPLETENESS_REVIEW.corpus_scan_review.reviewed_on,
    extraction_tool: SOURCE_COMPLETENESS_REVIEW.corpus_scan_review.extraction_tool,
    scanner_module: 'scripts/ip-preference-cards/source-completeness-corpus-scan.ts',
    pdfs_scanned: ledger.scan.pdfsScanned,
    pages_scanned: ledger.scan.pagesScanned,
    pages_with_candidates: pageCoverageRows.filter((row) => row.has_candidates).length,
    scanner_candidates: ledger.assigned.length,
    dispositions_assigned: ledger.assigned.length,
    unhandled_scanner_candidates: 0,
    candidate_overrides: SOURCE_COMPLETENESS_REVIEW.corpus_scan_review.candidate_overrides.length,
    document_rules: SOURCE_COMPLETENESS_REVIEW.corpus_scan_review.document_rules.length,
    detection_rule_counts: sortedCounts(
      ledger.assigned.reduce((map, { candidate }) => {
        map.set(candidate.detectionRule, (map.get(candidate.detectionRule) ?? 0) + 1)
        return map
      }, new Map<string, number>()),
    ),
    disposition_counts: sortedCounts(ledger.dispositionCounts),
    disposition_basis_counts: sortedCounts(ledger.basisCounts),
    high_risk_documents: ledger.highRiskDocuments,
  }

  const files = new Map<string, string>()
  files.set('README.md', await formatMarkdown(readme(discovery, products, ledger)))
  files.set('source-manifest.json', await formatJson(sourceManifest))
  files.set('scanner-summary.json', await formatJson(scannerSummary))
  files.set('source-product-discovery.csv', toCsv(discovery, discoveryColumns))
  files.set(
    'old-corpus-candidate-extraction.csv',
    toCsv(
      extractionRows,
      Object.keys(extractionRows[0]) as (keyof (typeof extractionRows)[number])[],
    ),
  )
  files.set(
    'old-corpus-candidate-dispositions.csv',
    toCsv(
      dispositionRows,
      Object.keys(dispositionRows[0]) as (keyof (typeof dispositionRows)[number])[],
    ),
  )
  files.set(
    'old-corpus-page-coverage.csv',
    toCsv(
      pageCoverageRows,
      Object.keys(pageCoverageRows[0]) as (keyof (typeof pageCoverageRows)[number])[],
    ),
  )
  files.set(
    'old-corpus-document-summary.csv',
    toCsv(
      documentSummaryRows,
      Object.keys(documentSummaryRows[0]) as (keyof (typeof documentSummaryRows)[number])[],
    ),
  )
  const coverage = SOURCE_COMPLETENESS_REVIEW.corpus_audit.table_page_coverage
  if (!Array.isArray(coverage) || coverage.length === 0) {
    throw new Error('Missing reviewed old-corpus table-page coverage contract.')
  }
  files.set(
    'old-corpus-table-page-coverage.csv',
    toCsv(
      coverage as Record<string, unknown>[],
      Object.keys(coverage[0] as Record<string, unknown>),
    ),
  )
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
