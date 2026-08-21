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
  origin: Exclude<DiscoveryOrigin, 'old_corpus'>
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

export interface SourceCompletenessReview {
  format_version: '1.0'
  reviewed_on: string
  baseline: Record<string, string | number | boolean>
  corpus_audit: Record<string, string | number | boolean | string[]>
  manufacturers: Record<string, unknown>[]
  sources: SourceCompletenessSourceDefinition[]
  evidence_manifest: EvidenceManifestEntry[]
  product_groups: SourceCompletenessProductGroup[]
  existing_matches: ExistingSourceCompletenessMatch[]
  non_addition_candidates: NonAdditionCandidate[]
}

export const SOURCE_COMPLETENESS_REVIEW =
  reviewedSourceCompleteness as unknown as SourceCompletenessReview

function inherited<T>(variant: T | undefined, group: T | undefined): T | undefined {
  return variant === undefined ? group : variant
}

/** Expand compact reviewed groups without inventing any product-level values. */
export function expandSourceCompletenessProducts(
  review: SourceCompletenessReview = SOURCE_COMPLETENESS_REVIEW,
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
