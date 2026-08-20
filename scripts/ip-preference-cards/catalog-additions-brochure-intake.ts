import { stableId } from './catalog-utils'
import type { AdditionRecord } from './catalog-addition-records'
import reviewedBrochureIntake from '../../data/ip-preference-cards/reviewed/brochure-intake-additions-2026-08-19.json'

export interface BrochureSourceDefinition {
  sourceId: string
  title: string
  filename: string
  sourceType: string
  publisher: string
  revisionDate: string | null
  officialUrl?: string | null
  usePolicy: string
  notes: string | null
}

export interface BrochureEvidenceDefinition {
  sourceId: string
  sourceLocation: string
  claimType?: string
  notes?: string | null
}

export interface BrochureProductDefinition {
  /** Logical data rows in the frozen intake CSV; the observed header is excluded. */
  inputRows: number[]
  /** Pinned review value; recomputed and checked before emission. */
  productId?: string
  manufacturerId: string
  manufacturer: string
  catalogNumber: string
  productName: string
  brandFamily: string | null
  primaryCategory: string
  subcategory: string
  productKind: string | null
  description: string
  evidence: BrochureEvidenceDefinition[]
  roleCode: string | null
  roleFit?: string
  roleNotes?: string | null
  alternateIds?: string | null
  distributor?: string | null
  reuseStatus?: string | null
  sterileStatus?: string | null
  implantable?: boolean | null
  material?: string | null
  coverage?: string | null
  laserType?: string | null
  placementMethod?: string | null
  sizeDisplay?: string | null
  diameterMm?: number | null
  lengthMm?: number | null
  frenchSize?: number | null
  gauge?: number | null
  workingLengthCm?: number | null
  minWorkingChannelMm?: number | null
  deliverySystemOdMm?: number | null
  packageUom?: string | null
  adultPeds?: string | null
  compatibilityText?: string | null
  notes?: string | null
  specJson?: Record<string, unknown> | null
  globalPartNumber?: string | null
  referencePartNumber?: string | null
  strongestDuplicateCandidates?: string
  duplicateRejection?: string
}

interface ExistingProductIdentity {
  product_id: string
  manufacturer_id: string | null
  catalog_number: string | null
}

export interface BrochureAdditionsResult {
  manufacturers: AdditionRecord[]
  sources: AdditionRecord[]
  products: AdditionRecord[]
  productRoles: AdditionRecord[]
  productSources: AdditionRecord[]
  warnings: string[]
}

/**
 * New source rows and reviewed product definitions are intentionally data-only. The generated
 * reconciliation package records how every intake row reached one of these definitions.
 */
interface ReviewedBrochureIntake {
  format_version: '1.0'
  reviewed_on: string
  source_csv_sha256: string
  notes: string
  manufacturers: AdditionRecord[]
  sources: BrochureSourceDefinition[]
  products: BrochureProductDefinition[]
}

export const BROCHURE_INTAKE_REVIEW = reviewedBrochureIntake as unknown as ReviewedBrochureIntake

export const BROCHURE_SOURCE_DEFINITIONS = BROCHURE_INTAKE_REVIEW.sources

export const BROCHURE_PRODUCT_DEFINITIONS = BROCHURE_INTAKE_REVIEW.products

export const BROCHURE_MANUFACTURER_DEFINITIONS = BROCHURE_INTAKE_REVIEW.manufacturers

function normalizeIdentityPart(value: string | null): string {
  return (value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function productIdFor(definition: BrochureProductDefinition): string {
  return stableId('PRD', `${definition.manufacturer}|${definition.catalogNumber}`)
}

export function buildBrochureIntakeAdditions(options: {
  existingProducts: ExistingProductIdentity[]
}): BrochureAdditionsResult {
  const warnings: string[] = []
  const products: AdditionRecord[] = []
  const productRoles: AdditionRecord[] = []
  const productSources: AdditionRecord[] = []
  const emittedIds = new Set<string>()
  const emittedIdentities = new Set<string>()
  const existingByIdentity = new Map<string, ExistingProductIdentity>()

  for (const product of options.existingProducts) {
    const catalogNumber = normalizeIdentityPart(product.catalog_number)
    if (!catalogNumber || !product.manufacturer_id) continue
    existingByIdentity.set(`${product.manufacturer_id}\u0000${catalogNumber}`, product)
  }

  for (const definition of BROCHURE_PRODUCT_DEFINITIONS) {
    if (definition.evidence.length === 0) {
      throw new Error(`Brochure addition ${definition.catalogNumber} has no source evidence.`)
    }
    const productId = productIdFor(definition)
    if (definition.productId && definition.productId !== productId) {
      throw new Error(
        `Brochure addition ${definition.catalogNumber} pins ${definition.productId}, but its deterministic ID is ${productId}.`,
      )
    }
    const identity = `${definition.manufacturerId}\u0000${normalizeIdentityPart(definition.catalogNumber)}`
    if (emittedIds.has(productId) || emittedIdentities.has(identity)) {
      throw new Error(
        `Duplicate brochure-addition identity ${definition.manufacturer} ${definition.catalogNumber}.`,
      )
    }
    emittedIds.add(productId)
    emittedIdentities.add(identity)

    const existing = existingByIdentity.get(identity)
    if (existing && existing.product_id !== productId) {
      throw new Error(
        `Brochure addition ${definition.manufacturer} ${definition.catalogNumber} collides with existing product ${existing.product_id}.`,
      )
    }
    // A generated catalog committed by an earlier run legitimately contains this deterministic
    // row. Treat that self-ID as the expected idempotent case, while the differing-ID branch above
    // still rejects a true manufacturer/catalog collision.

    const primaryEvidence = definition.evidence[0]
    products.push({
      product_id: productId,
      manufacturer_id: definition.manufacturerId,
      manufacturer: definition.manufacturer,
      distributor: definition.distributor ?? null,
      brand_family: definition.brandFamily,
      product_name: definition.productName,
      catalog_number: definition.catalogNumber,
      alternate_ids: definition.alternateIds ?? null,
      gtin: null,
      primary_category: definition.primaryCategory,
      subcategory: definition.subcategory,
      product_kind: definition.productKind,
      reuse_status: definition.reuseStatus ?? null,
      sterile_status: definition.sterileStatus ?? null,
      implantable: definition.implantable ?? null,
      material: definition.material ?? null,
      coverage: definition.coverage ?? null,
      laser_type: definition.laserType ?? null,
      placement_method: definition.placementMethod ?? null,
      size_display: definition.sizeDisplay ?? null,
      diameter_mm: definition.diameterMm ?? null,
      length_mm: definition.lengthMm ?? null,
      french_size: definition.frenchSize ?? null,
      gauge: definition.gauge ?? null,
      working_length_cm: definition.workingLengthCm ?? null,
      min_working_channel_mm: definition.minWorkingChannelMm ?? null,
      delivery_system_od_mm: definition.deliverySystemOdMm ?? null,
      package_uom: definition.packageUom ?? null,
      adult_peds: definition.adultPeds ?? null,
      description: definition.description,
      compatibility_text: definition.compatibilityText ?? null,
      verification_status:
        'Verified - authoritative manufacturer document; current U.S. status unverified',
      live_dropdown_status: 'Hidden - current U.S. status unverified',
      primary_source_id: primaryEvidence.sourceId,
      primary_source_location: primaryEvidence.sourceLocation,
      source_as_of: null,
      availability_note:
        'Current U.S. distribution and local orderability were not researched in this intake; confirm with the manufacturer and local supply chain.',
      notes: definition.notes ?? null,
      spec_json: definition.specJson ?? null,
      global_part_number: definition.globalPartNumber ?? null,
      reference_part_number: definition.referencePartNumber ?? null,
      gtin_raw: null,
      spec_json_raw: null,
      visibility_state: 'hidden',
      verification_grade: 'verified_source',
    })

    if (definition.roleCode) {
      productRoles.push({
        product_id: productId,
        role_code: definition.roleCode,
        role_fit: definition.roleFit ?? 'Primary',
        notes: definition.roleNotes ?? null,
      })
    }
    for (const evidence of definition.evidence) {
      productSources.push({
        product_id: productId,
        source_id: evidence.sourceId,
        source_location: evidence.sourceLocation,
        claim_type: evidence.claimType ?? 'Product identity and catalog/model number',
        verification_status: 'Verified against the supplied authoritative manufacturer document',
        notes: evidence.notes ?? null,
      })
    }
  }

  const sources = BROCHURE_SOURCE_DEFINITIONS.map(
    (source): AdditionRecord => ({
      source_id: source.sourceId,
      title: source.title,
      filename: source.filename,
      source_type: source.sourceType,
      publisher: source.publisher,
      revision_date: source.revisionDate,
      as_of_date: null,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        source.usePolicy ||
        'Use for product identity and the exact printed catalog/model number. Confirm current U.S. status, orderability, and the full IFU separately.',
      notes: source.notes,
    }),
  )

  return {
    manufacturers: BROCHURE_MANUFACTURER_DEFINITIONS,
    sources,
    products,
    productRoles,
    productSources,
    warnings,
  }
}
