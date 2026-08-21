import reviewedSourceCompleteness from '../../data/ip-preference-cards/reviewed/source-completeness-additions-2026-08-20.json'

export const SOURCE_COMPLETENESS_DISPOSITIONS = [
  'existing_exact',
  'existing_alias_or_format_variant',
  'existing_family_or_package_variant',
  'previously_accounted_csv',
  'new_exact_product_candidate',
  'relevant_but_insufficient_identity',
  'relevant_family_level_only',
  'duplicate_source_occurrence',
  'irrelevant_to_current_scope',
  'source_evidence_conflicted',
  'needs_owner_review',
] as const

export type SourceCompletenessDisposition = (typeof SOURCE_COMPLETENESS_DISPOSITIONS)[number]

/**
 * The corpus-scan ledger extends the product-review vocabulary with one value for scanner
 * tokens that are not product identifiers at all (patent numbers, billing codes, citation
 * fragments, document revision codes). Every value remains part of one closed set.
 */
export const CORPUS_SCAN_DISPOSITIONS = [
  ...SOURCE_COMPLETENESS_DISPOSITIONS,
  'not_a_product_identifier',
] as const

export type CorpusScanDisposition = (typeof CORPUS_SCAN_DISPOSITIONS)[number]

export type DiscoveryOrigin = 'old_corpus' | 'owner_pdf' | 'official_web_follow_up'

export interface SourceCompletenessEvidence {
  sourceId: string
  sourceLocation: string
  claimType?: string
  notes?: string | null
}

export interface SourceCompletenessSourceDefinition {
  sourceId: string
  title: string
  filename: string | null
  sourceType: string
  publisher: string
  revisionDate: string | null
  asOfDate: string | null
  officialUrl: string | null
  reliabilityTier: string
  usePolicy: string
  notes: string | null
}

export interface EvidenceManifestEntry {
  evidenceId: string
  sourceId: string | null
  title: string
  filename: string | null
  url: string | null
  sourceOrganization: string
  sourceType: string
  scope: 'exact_product' | 'family_and_exact_product' | 'family_level'
  identifierMatched: string
  retrievedOn: string | null
  sha256: string
  pageCount: number | null
  supportedCatalogNumbers: string[]
}

export interface SourceCompletenessProductVariant {
  productId?: string
  catalogNumber: string
  productName: string
  alternateIds?: string | null
  gtin?: string | null
  roleCode?: string | null
  roleFit?: string
  roleNotes?: string | null
  evidence?: SourceCompletenessEvidence[]
  description?: string
  subcategory?: string
  productKind?: string | null
  reuseStatus?: string | null
  sterileStatus?: string | null
  implantable?: boolean | null
  material?: string | null
  sizeDisplay?: string | null
  diameterMm?: number | null
  lengthMm?: number | null
  gauge?: number | null
  workingLengthCm?: number | null
  minWorkingChannelMm?: number | null
  packageUom?: string | null
  compatibilityText?: string | null
  notes?: string | null
  specJson?: Record<string, unknown> | null
  globalPartNumber?: string | null
  referencePartNumber?: string | null
  taxonomyClass?: string
  taxonomySubtype?: string
  taxonomyConfidence?: string
}

export interface SourceCompletenessProductGroup {
  groupId: string
  origin: DiscoveryOrigin
  manufacturerId: string
  manufacturer: string
  distributor: string | null
  brandFamily: string | null
  primaryCategory: string
  subcategory: string
  productKind: string | null
  description: string
  roleCode: string | null
  roleFit?: string
  roleNotes?: string | null
  evidence: SourceCompletenessEvidence[]
  taxonomyClass: string
  taxonomySubtype: string
  taxonomyConfidence: string
  reuseStatus?: string | null
  sterileStatus?: string | null
  implantable?: boolean | null
  material?: string | null
  sizeDisplay?: string | null
  diameterMm?: number | null
  lengthMm?: number | null
  gauge?: number | null
  workingLengthCm?: number | null
  minWorkingChannelMm?: number | null
  packageUom?: string | null
  adultPeds?: string | null
  compatibilityText?: string | null
  specJson?: Record<string, unknown> | null
  globalPartNumber?: string | null
  referencePartNumber?: string | null
  notes?: string | null
  variants: SourceCompletenessProductVariant[]
}

export type ExpandedSourceCompletenessProduct = Omit<SourceCompletenessProductGroup, 'variants'> &
  SourceCompletenessProductVariant & {
    disposition: 'new_exact_product_candidate'
  }

export interface ExistingSourceCompletenessMatch {
  origin: 'owner_pdf'
  catalogNumber: string
  alternateId: string
  productName: string
  manufacturer: string
  manufacturerId: string
  productId: string
  evidence: SourceCompletenessEvidence[]
  roleCode: string
  taxonomyClass: string
  taxonomySubtype: string
  matchBasis: string
}

export interface NonAdditionCandidate {
  origin: DiscoveryOrigin
  catalogNumber: string | null
  productName: string
  manufacturer: string
  sourceId: string | null
  sourceLocation: string
  sourceScope: 'exact_product' | 'family_level'
  previousCsvStatus: 'absent' | 'represented_family_row' | 'not_applicable_new_source'
  canonicalBeforeStatus: 'absent' | 'family_present' | 'not_applicable'
  identifierConfidence: 'high' | 'moderate' | 'insufficient'
  clinicalScopeDisposition: string
  disposition: Exclude<SourceCompletenessDisposition, 'new_exact_product_candidate'>
  ownerReviewRequired: boolean
  rationale: string
}

export interface NovatechMatrixSeries {
  seriesCode: string
  productName: string
  subcategory: string
  roleCode: string
  roleNotes?: string | null
  taxonomySubtype: string
  description: string
  /** Straight-stent series build refs as 01{code}{dia}{len}; explicit series list exact refs. */
  refTemplate?: string
  cells?: Record<string, number[]>
  cellPageBreakLength?: number
  pages?: { atOrBelowBreak: number; aboveBreak: number }
  explicitRefs?: {
    ref: string
    sizeDisplay: string
    page: number
  }[]
}

export interface NovatechStentMatrix {
  groupIdPrefix: string
  origin: DiscoveryOrigin
  manufacturerId: string
  manufacturer: string
  brandFamily: string
  primaryCategory: string
  productKind: string
  material: string
  implantable: boolean
  evidenceSourceId: string
  evidenceDocuments: string[]
  alreadyCanonicalRefs: Record<string, string>
  expectedTableRefs: number
  expectedNewProducts: number
  series: NovatechMatrixSeries[]
}

export interface CorpusCandidateOverride {
  filename: string
  normalizedIdentifier: string
  disposition: CorpusScanDisposition
  rationale: string
  canonicalProductId?: string | null
  ownerReviewRequired?: boolean
}

export interface CorpusDocumentRule {
  ruleId: string
  filename: string
  pages?: string
  identifierPattern?: string
  disposition: CorpusScanDisposition
  rationale: string
  reviewMethod:
    | 'corpus_text_extraction'
    | 'rendered_manual_inspection'
    | 'exact_identity_review'
    | 'family_level_review'
  ownerReviewRequired?: boolean
}

export interface CorpusScanReview {
  extraction_tool: string
  reviewed_on: string
  original_csv_identifier_count_minimum: number
  candidate_overrides: CorpusCandidateOverride[]
  document_rules: CorpusDocumentRule[]
  old_corpus_governed_source_bindings: { relativePathIncludes: string; sourceId: string }[]
}

export interface SourceCompletenessReview {
  format_version: '1.0'
  reviewed_on: string
  baseline: Record<string, string | number | boolean>
  count_contract: Record<string, number>
  corpus_audit: Record<string, unknown>
  corpus_scan_review: CorpusScanReview
  novatech_stent_matrix: NovatechStentMatrix
  manufacturers: Record<string, unknown>[]
  sources: SourceCompletenessSourceDefinition[]
  evidence_manifest: EvidenceManifestEntry[]
  product_groups: SourceCompletenessProductGroup[]
  existing_matches: ExistingSourceCompletenessMatch[]
  non_addition_candidates: NonAdditionCandidate[]
}

export const SOURCE_COMPLETENESS_REVIEW =
  reviewedSourceCompleteness as unknown as SourceCompletenessReview

export function sourceCompletenessCount(name: string): number {
  const value = SOURCE_COMPLETENESS_REVIEW.count_contract[name]
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Missing or invalid source-completeness count contract: ${name}.`)
  }
  return value
}

function inherited<T>(variant: T | undefined, group: T | undefined): T | undefined {
  return variant === undefined ? group : variant
}

/**
 * Every exact reference the reviewed Novatech matrix expands to, including references that were
 * already canonical before this review. This is the complete straight/BB/Y/OKI/ST/DST table set
 * and is compared against the scanner output of the flagged stent-table pages.
 */
export function expandNovatechMatrixRefs(
  matrix: NovatechStentMatrix,
): { ref: string; series: NovatechMatrixSeries; sizeDisplay: string; page: number }[] {
  const refs: { ref: string; series: NovatechMatrixSeries; sizeDisplay: string; page: number }[] =
    []
  for (const series of matrix.series) {
    if (series.refTemplate && series.cells) {
      const breakLength = series.cellPageBreakLength ?? Number.POSITIVE_INFINITY
      const pages = series.pages
      if (!pages) {
        throw new Error(`Matrix series ${series.seriesCode} is missing reviewed page anchors.`)
      }
      for (const [diameter, lengths] of Object.entries(series.cells)) {
        for (const length of lengths) {
          const ref = series.refTemplate.replace('{dia}', diameter).replace('{len}', String(length))
          refs.push({
            ref,
            series,
            sizeDisplay: `${diameter} OD x ${length} L`,
            page: length <= breakLength ? pages.atOrBelowBreak : pages.aboveBreak,
          })
        }
      }
      continue
    }
    for (const explicit of series.explicitRefs ?? []) {
      refs.push({
        ref: explicit.ref,
        series,
        sizeDisplay: explicit.sizeDisplay,
        page: explicit.page,
      })
    }
  }
  const unique = new Set(refs.map((entry) => entry.ref))
  if (unique.size !== refs.length) {
    throw new Error('Reviewed Novatech matrix expands to duplicate references.')
  }
  if (refs.length !== matrix.expectedTableRefs) {
    throw new Error(
      `Reviewed Novatech matrix expands to ${refs.length} references; the reviewed table contract is ${matrix.expectedTableRefs}.`,
    )
  }
  return refs.sort((left, right) => left.ref.localeCompare(right.ref))
}

/** Expand the reviewed Novatech matrix into exact new products, skipping canonical references. */
export function expandNovatechMatrixProducts(
  review: SourceCompletenessReview = SOURCE_COMPLETENESS_REVIEW,
): ExpandedSourceCompletenessProduct[] {
  const matrix = review.novatech_stent_matrix
  const refs = expandNovatechMatrixRefs(matrix)
  for (const canonicalRef of Object.keys(matrix.alreadyCanonicalRefs)) {
    if (!refs.some((entry) => entry.ref === canonicalRef)) {
      throw new Error(
        `Already-canonical Novatech reference ${canonicalRef} is not in the reviewed matrix.`,
      )
    }
  }
  const products = refs
    .filter((entry) => !(entry.ref in matrix.alreadyCanonicalRefs))
    .map((entry) => ({
      groupId: `${matrix.groupIdPrefix}_${entry.series.seriesCode.toLowerCase()}`,
      origin: matrix.origin,
      manufacturerId: matrix.manufacturerId,
      manufacturer: matrix.manufacturer,
      distributor: null,
      brandFamily: matrix.brandFamily,
      primaryCategory: matrix.primaryCategory,
      subcategory: entry.series.subcategory,
      productKind: matrix.productKind,
      description: entry.series.description,
      roleCode: entry.series.roleCode,
      roleFit: 'Primary',
      roleNotes: entry.series.roleNotes ?? null,
      evidence: [
        {
          sourceId: matrix.evidenceSourceId,
          sourceLocation: `PDF page ${entry.page}, ${entry.series.productName} table, reference ${entry.ref}`,
          claimType: 'Exact catalog reference and dimensions',
        },
      ],
      taxonomyClass: 'airway_stent',
      taxonomySubtype: entry.series.taxonomySubtype,
      taxonomyConfidence: 'high',
      reuseStatus: null,
      sterileStatus: null,
      implantable: matrix.implantable,
      material: matrix.material,
      sizeDisplay: entry.sizeDisplay,
      diameterMm: null,
      lengthMm: null,
      gauge: null,
      workingLengthCm: null,
      minWorkingChannelMm: null,
      packageUom: null,
      adultPeds: null,
      compatibilityText: null,
      specJson: null,
      globalPartNumber: null,
      referencePartNumber: null,
      notes: null,
      catalogNumber: entry.ref,
      productName: entry.series.productName,
      alternateIds: null,
      gtin: null,
      disposition: 'new_exact_product_candidate' as const,
    }))
  if (products.length !== matrix.expectedNewProducts) {
    throw new Error(
      `Novatech matrix expansion produced ${products.length} new products; the reviewed contract is ${matrix.expectedNewProducts}.`,
    )
  }
  return products
}

/** Expand compact reviewed groups without inventing any product-level values. */
export function expandSourceCompletenessProducts(
  review: SourceCompletenessReview = SOURCE_COMPLETENESS_REVIEW,
): ExpandedSourceCompletenessProduct[] {
  return [...expandGroupProducts(review), ...expandNovatechMatrixProducts(review)]
}

function expandGroupProducts(
  review: SourceCompletenessReview,
): ExpandedSourceCompletenessProduct[] {
  return review.product_groups.flatMap((group) =>
    group.variants.map((variant) => {
      const { variants, ...shared } = group
      void variants
      return {
        ...shared,
        ...variant,
        disposition: 'new_exact_product_candidate' as const,
        description: inherited(variant.description, group.description) ?? '',
        subcategory: inherited(variant.subcategory, group.subcategory) ?? '',
        productKind: inherited(variant.productKind, group.productKind) ?? null,
        roleCode: inherited(variant.roleCode, group.roleCode) ?? null,
        roleFit: inherited(variant.roleFit, group.roleFit) ?? 'Primary',
        roleNotes: inherited(variant.roleNotes, group.roleNotes) ?? null,
        evidence: [...group.evidence, ...(variant.evidence ?? [])],
        reuseStatus: inherited(variant.reuseStatus, group.reuseStatus) ?? null,
        sterileStatus: inherited(variant.sterileStatus, group.sterileStatus) ?? null,
        implantable: inherited(variant.implantable, group.implantable) ?? null,
        material: inherited(variant.material, group.material) ?? null,
        sizeDisplay: inherited(variant.sizeDisplay, group.sizeDisplay) ?? null,
        diameterMm: inherited(variant.diameterMm, group.diameterMm) ?? null,
        lengthMm: inherited(variant.lengthMm, group.lengthMm) ?? null,
        gauge: inherited(variant.gauge, group.gauge) ?? null,
        workingLengthCm: inherited(variant.workingLengthCm, group.workingLengthCm) ?? null,
        minWorkingChannelMm:
          inherited(variant.minWorkingChannelMm, group.minWorkingChannelMm) ?? null,
        packageUom: inherited(variant.packageUom, group.packageUom) ?? null,
        compatibilityText: inherited(variant.compatibilityText, group.compatibilityText) ?? null,
        specJson: inherited(variant.specJson, group.specJson) ?? null,
        globalPartNumber: inherited(variant.globalPartNumber, group.globalPartNumber) ?? null,
        referencePartNumber:
          inherited(variant.referencePartNumber, group.referencePartNumber) ?? null,
        taxonomyClass: inherited(variant.taxonomyClass, group.taxonomyClass) ?? '',
        taxonomySubtype: inherited(variant.taxonomySubtype, group.taxonomySubtype) ?? '',
        taxonomyConfidence: inherited(variant.taxonomyConfidence, group.taxonomyConfidence) ?? '',
        notes: inherited(variant.notes, group.notes) ?? null,
      }
    }),
  )
}
