import 'server-only'
import overlayJson from '../../../../data/ip-device-intelligence/generated/physician-review-overlay.json'
import {
  physicianReviewOverlaySchema,
  type PhysicianProductReview,
} from '../domain/physician-review-schema'
import type { ReviewedProductProfile, D2dRuntimeSource } from './d2d-evidence.server'
import type { CatalogProductRecord } from '@/features/preference-cards/server/catalog-store'
import type { ProfileClaim, ProfileSpecification } from '../domain/product-profile'
import { safetyEvidenceRowSchema, type SafetyEvidenceRow } from '../domain/safety-notice-schema'
import { toStatusRecommendationGate, type ProductStatusView } from '../domain/product-status'

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

const artifact = freeze(physicianReviewOverlaySchema.parse(overlayJson))
const byId = new Map(artifact.products.map((row) => [row.product_id, row]))

export function getPhysicianProductReview(productId: string): PhysicianProductReview | null {
  return byId.get(productId) ?? null
}

export function getPhysicianProcedureReview(code: string) {
  return artifact.procedures.find((row) => row.code === code) ?? null
}

export const PHYSICIAN_REVIEW_DATE = artifact.reviewed_on

/** Corrections belong to the device reference view. IDs, eligibility and release inputs do not change. */
export function applyPhysicianCatalogCorrections(
  products: CatalogProductRecord[],
): CatalogProductRecord[] {
  return products.map((product) => {
    const review = byId.get(product.product_id)
    if (!review?.catalog_corrections.length) return product
    const corrected = { ...product }
    for (const correction of review.catalog_corrections) {
      if (product[correction.field] !== correction.before) {
        throw new Error(
          `Physician correction precondition changed: ${product.product_id}.${correction.field}`,
        )
      }
      Object.assign(corrected, { [correction.field]: correction.after })
    }
    return corrected
  })
}

function buildProfile(review: PhysicianProductReview): ReviewedProductProfile {
  const sources = new Map<string, D2dRuntimeSource>()
  const references = (citations: PhysicianProductReview['notes'][number]['citations']) =>
    citations.map((citation) => {
      const previous = sources.get(citation.url)
      const id =
        previous?.source_id ?? `D2D-SRC-PHYSICIAN-${review.product_id.slice(4)}-${sources.size + 1}`
      sources.set(citation.url, {
        source_id: id,
        governed_source_id: null,
        source_kind: citation.url.includes('accessgudid')
          ? 'gudid'
          : citation.url.includes('accessdata.fda.gov')
            ? citation.url.includes('/cfres/')
              ? 'fda_safety_notice'
              : 'fda_premarket'
            : citation.url.includes('.pdf')
              ? 'manufacturer_labeling'
              : 'manufacturer_product_page',
        title: citation.title,
        organization: new URL(citation.url).hostname,
        official_url: citation.url,
        snapshot_date: artifact.reviewed_on,
        locators: [...new Set([...(previous?.locators ?? []), citation.locator])],
      })
      return { source_id: id, locator: citation.locator }
    })
  const configurationDependent = review.udi_records.some(
    (record) => record.scope === 'configuration_requires_label',
  )
  const claim = (value: NonNullable<PhysicianProductReview['summary']>): ProfileClaim => ({
    text: value.text,
    evidence_scope: configurationDependent ? 'configuration' : 'exact',
    source_refs: references(value.citations),
  })
  const summary = review.summary ? [claim(review.summary)] : []
  const configuration = review.configuration ? claim(review.configuration) : null
  const specs: ProfileSpecification[] = review.specifications.map((spec) => ({
    key: spec.key,
    label: spec.label,
    value: spec.value,
    unit: spec.unit,
    evidence_scope: configurationDependent ? 'configuration' : spec.evidence_scope,
    source_refs: references(spec.citations),
  }))
  const hasClaims = Boolean(summary.length || configuration || specs.length)
  return freeze({
    product_id: review.product_id,
    content_locale: 'en',
    runtime_state: hasClaims ? 'reviewed' : 'insufficient_evidence',
    description_scope: hasClaims
      ? configurationDependent
        ? 'configuration_variant'
        : 'exact_product'
      : 'insufficient_evidence',
    summary_claims: summary,
    physical_device_type: null,
    intended_function: null,
    exact_configuration_summary: configuration,
    key_specifications: specs,
    confidence: hasClaims ? 'moderate' : 'unresolved',
    as_of_date: artifact.reviewed_on,
    sources: [...sources.values()],
  })
}

const profiles = new Map(
  artifact.products.map((review) => [review.product_id, buildProfile(review)]),
)
export function getPhysicianReviewedProfile(productId: string): ReviewedProductProfile | null {
  return profiles.get(productId) ?? null
}

/** Keep dated source coverage intact. A narrow adjudication is not a new comprehensive search. */
export function applyPhysicianSafetyReview(
  productId: string,
  previous: SafetyEvidenceRow | null,
): SafetyEvidenceRow | null {
  const review = byId.get(productId)
  if (!review || (!review.excluded_recalls.length && !review.additional_notices.length))
    return previous
  const excluded = new Set(review.excluded_recalls.map((notice) => notice.recall_number))
  const notices = new Map(
    (previous?.notices ?? [])
      .filter((notice) => !excluded.has(notice.recall_number))
      .map((notice) => [notice.recall_number, notice]),
  )
  for (const notice of review.additional_notices) notices.set(notice.recall_number, notice)
  return freeze(
    safetyEvidenceRowSchema.parse({
      product_id: productId,
      search_status: previous?.search_status ?? 'not_searched',
      source_checks: previous?.source_checks ?? [],
      notices: [...notices.values()].sort((a, b) => a.recall_number.localeCompare(b.recall_number)),
    }),
  )
}

export function applyPhysicianStatusReview(
  productId: string,
  previous: ProductStatusView,
  safety: SafetyEvidenceRow | null,
): ProductStatusView {
  const review = byId.get(productId)
  if (!review || (!review.excluded_recalls.length && !review.additional_notices.length))
    return previous
  const notices = safety?.notices ?? []
  const active = notices.some((notice) => notice.recorded_state === 'active')
  const scopedNotices = active
    ? notices.filter((notice) => notice.recorded_state === 'active')
    : notices
  const scopes = new Set(scopedNotices.map((notice) => notice.scope))
  const scope =
    active && !review.additional_notices.some((notice) => notice.recorded_state === 'active')
      ? previous.safetyActionScope
      : notices.length
        ? scopes.size === 1
          ? scopedNotices[0].scope
          : 'unknown'
        : null
  const safetyDisplay = active
    ? 'active_safety_notice'
    : notices.length
      ? 'historical_safety_notice'
      : 'safety_status_unverified'
  return freeze({
    ...previous,
    safetyDisplay,
    safetyActionScope: scope,
    safetyReferenceCodes: notices.map((notice) => notice.recall_number),
    // The original market snapshot date is retained; this narrow safety review cannot refresh it.
    statusRecommendationGate: active
      ? 'blocked_active_safety_action'
      : review.unresolved_checks.length
        ? 'review_required'
        : toStatusRecommendationGate(previous.marketStatus, safetyDisplay),
  })
}
