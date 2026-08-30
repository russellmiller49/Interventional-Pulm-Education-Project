import 'server-only'

import profileOverlayJson from '../../../../data/ip-device-intelligence/generated/product-profile-overlay.json'
import regulatoryOverlayJson from '../../../../data/ip-device-intelligence/generated/product-regulatory-overlay.json'

import type { D2dSourceProjection, D2dSourceReference } from '../domain/evidence-source-schema'
import {
  profileOverlayArtifactSchema,
  type ProfileOverlayArtifact,
  type ProfileOverlayRow,
} from '../domain/profile-overlay-schema'
import {
  regulatoryOverlayArtifactSchema,
  type RegulatoryOverlayArtifact,
  type RegulatoryOverlayRow,
} from '../domain/regulatory-overlay-schema'

/** A recursively read-only serializable value. Runtime views are also frozen below. */
type DeepReadonly<Value> = Value extends (...arguments_: never[]) => unknown
  ? Value
  : Value extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value

/**
 * The only source metadata exposed with a selected product. Artifact hashes and the full source
 * registry stay private to this server module; repeated references are collapsed into one source
 * with every distinct locator retained in first-reference order.
 */
export interface D2dRuntimeSource {
  readonly source_id: string
  readonly governed_source_id: string | null
  readonly source_kind: D2dSourceProjection['source_kind']
  readonly title: string
  readonly organization: string
  readonly official_url: string | null
  readonly snapshot_date: string
  readonly locators: readonly string[]
}

export type ReviewedProductProfile = DeepReadonly<
  Omit<ProfileOverlayRow, 'review_id'> & { sources: D2dRuntimeSource[] }
>

export type ReviewedProductRegulatoryEvidence = DeepReadonly<
  Omit<RegulatoryOverlayRow, 'review_id'> & { sources: D2dRuntimeSource[] }
>

export interface D2dProductEvidence {
  readonly profile: ReviewedProductProfile | null
  readonly regulatoryEvidence: ReviewedProductRegulatoryEvidence | null
}

/**
 * Parse at module initialization, once. A malformed committed overlay therefore fails the build or
 * server import loudly instead of producing a partial runtime view.
 */
const profileArtifact: ProfileOverlayArtifact =
  profileOverlayArtifactSchema.parse(profileOverlayJson)
const regulatoryArtifact: RegulatoryOverlayArtifact =
  regulatoryOverlayArtifactSchema.parse(regulatoryOverlayJson)

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as DeepReadonly<Value>
}

function sourceIndexOf(
  sources: readonly D2dSourceProjection[],
): ReadonlyMap<string, D2dSourceProjection> {
  return new Map(sources.map((source) => [source.source_id, source]))
}

function projectReferencedSources(
  references: readonly D2dSourceReference[],
  sourceById: ReadonlyMap<string, D2dSourceProjection>,
): D2dRuntimeSource[] {
  const locatorsBySourceId = new Map<string, string[]>()
  for (const reference of references) {
    const locators = locatorsBySourceId.get(reference.source_id)
    if (!locators) {
      locatorsBySourceId.set(reference.source_id, [reference.locator])
    } else if (!locators.includes(reference.locator)) {
      locators.push(reference.locator)
    }
  }

  return [...locatorsBySourceId].map(([sourceId, locators]) => {
    const source = sourceById.get(sourceId)
    // The strict artifact schemas already reject unknown references. Retain a defensive failure
    // here so this projection can never silently drop a citation if that contract changes.
    if (!source) throw new Error(`D2D overlay references unknown compact source ${sourceId}`)
    return {
      source_id: source.source_id,
      governed_source_id: source.governed_source_id,
      source_kind: source.source_kind,
      title: publicSourceTitle(source),
      organization: source.organization,
      official_url: publicOfficialUrl(source),
      snapshot_date: source.snapshot_date,
      locators,
    }
  })
}

/**
 * The reviewed regulatory artifact retains deterministic acquisition coordinates so it can be
 * reproduced. Those coordinates are governed internals, not citation copy. Keep the public source
 * recognizable while removing the query ID from the title.
 */
function publicSourceTitle(source: D2dSourceProjection): string {
  if (!/\bD2D-Q-[A-Z0-9-]+\b/.test(source.title)) return source.title
  if (source.source_kind === 'fda_premarket') return 'openFDA device 510(k) record'
  if (source.source_kind === 'gudid') return 'openFDA device UDI record'
  return source.title.replace(/\s+query\s+D2D-Q-[A-Z0-9-]+\s*$/i, '').trim()
}

/**
 * Preserve an official URL when supplied, but never send an acquisition query to the page. The
 * path remains the exact official openFDA dataset endpoint carried by the reviewed overlay.
 */
function publicOfficialUrl(source: D2dSourceProjection): string | null {
  if (!source.official_url || !/\bD2D-Q-[A-Z0-9-]+\b/.test(source.title)) {
    return source.official_url
  }
  const url = new URL(source.official_url)
  url.search = ''
  url.hash = ''
  return url.toString()
}

function profileReferences(row: ProfileOverlayRow): D2dSourceReference[] {
  const claims = [
    ...row.summary_claims,
    row.physical_device_type,
    row.intended_function,
    row.exact_configuration_summary,
    ...row.key_specifications,
  ].filter((claim): claim is NonNullable<typeof claim> => claim !== null)
  return claims.flatMap((claim) => claim.source_refs)
}

function regulatoryReferences(
  row: Pick<
    RegulatoryOverlayRow,
    | 'udi_identities'
    | 'classifications'
    | 'pathways'
    | 'registration_listing_evidence'
    | 'commercial_distribution_evidence'
  >,
): D2dSourceReference[] {
  return [
    ...row.udi_identities,
    ...row.classifications,
    ...row.pathways,
    ...row.registration_listing_evidence,
    ...row.commercial_distribution_evidence,
  ].flatMap((record) => record.source_refs)
}

const ACQUISITION_LOCATOR = /^D2D-Q-[A-Z0-9-]+;\s*request\s+skip\s+\d+;\s*record\s+keys\s+/i

function publicReferences(
  references: readonly D2dSourceReference[],
  publicLocator: string,
): D2dSourceReference[] {
  return references.map((reference) => ({
    ...reference,
    locator: ACQUISITION_LOCATOR.test(reference.locator) ? publicLocator : reference.locator,
  }))
}

/**
 * Replace reproducibility-only query coordinates with precise public record locators. The reviewed
 * regulatory facts themselves are copied verbatim; only their citation coordinates are projected.
 */
function publicRegulatoryRow(row: RegulatoryOverlayRow): Omit<RegulatoryOverlayRow, 'review_id'> {
  const primaryDiBySourceId = new Map<string, string>()
  for (const record of row.udi_identities) {
    for (const reference of record.source_refs) {
      primaryDiBySourceId.set(reference.source_id, record.primary_di)
    }
  }

  return {
    ...withoutReviewId(row),
    udi_identities: row.udi_identities.map((record) => ({
      ...record,
      source_refs: publicReferences(record.source_refs, `Primary DI ${record.primary_di}`),
    })),
    classifications: row.classifications.map((record) => ({
      ...record,
      source_refs: publicReferences(
        record.source_refs,
        `Product code ${record.product_code}${
          record.regulation_number ? `; regulation ${record.regulation_number}` : ''
        }`,
      ),
    })),
    pathways: row.pathways.map((record) => ({
      ...record,
      source_refs: publicReferences(
        record.source_refs,
        record.submission_number
          ? `Premarket submission ${record.submission_number}`
          : 'Premarket-exempt classification record',
      ),
    })),
    registration_listing_evidence: row.registration_listing_evidence.map((record) => ({
      ...record,
      source_refs: publicReferences(
        record.source_refs,
        record.listing_number
          ? `FDA listing ${record.listing_number}`
          : record.establishment_registration_number
            ? `Establishment registration ${record.establishment_registration_number}`
            : `Registration/listing record as of ${record.as_of_date}`,
      ),
    })),
    commercial_distribution_evidence: row.commercial_distribution_evidence.map((record) => ({
      ...record,
      source_refs: record.source_refs.map((reference) => {
        const primaryDi = primaryDiBySourceId.get(reference.source_id)
        return publicReferences(
          [reference],
          `${primaryDi ? `Primary DI ${primaryDi}; ` : ''}commercial-distribution record as of ${
            record.as_of_date
          }`,
        )[0]
      }),
    })),
  }
}

function withoutReviewId<Row extends { review_id: string }>(row: Row): Omit<Row, 'review_id'> {
  const { review_id: internalReviewId, ...publicRow } = row
  void internalReviewId
  return publicRow
}

function buildProfileIndex(
  artifact: ProfileOverlayArtifact,
): ReadonlyMap<string, ReviewedProductProfile> {
  const sourceById = sourceIndexOf(artifact.sources)
  const rows = new Map<string, ReviewedProductProfile>()
  for (const row of artifact.rows) {
    const view = deepFreeze({
      ...withoutReviewId(row),
      sources: projectReferencedSources(profileReferences(row), sourceById),
    })
    rows.set(row.product_id, view)
  }
  return rows
}

function buildRegulatoryIndex(
  artifact: RegulatoryOverlayArtifact,
): ReadonlyMap<string, ReviewedProductRegulatoryEvidence> {
  const sourceById = sourceIndexOf(artifact.sources)
  const rows = new Map<string, ReviewedProductRegulatoryEvidence>()
  for (const row of artifact.rows) {
    const publicRow = publicRegulatoryRow(row)
    const view = deepFreeze({
      ...publicRow,
      sources: projectReferencedSources(regulatoryReferences(publicRow), sourceById),
    })
    rows.set(row.product_id, view)
  }
  return rows
}

// Private, module-lifetime indexes. Callers can read only the already-frozen selected views.
const profileByProductId: ReadonlyMap<string, ReviewedProductProfile> =
  buildProfileIndex(profileArtifact)
const regulatoryByProductId: ReadonlyMap<string, ReviewedProductRegulatoryEvidence> =
  buildRegulatoryIndex(regulatoryArtifact)

const evidenceByProductId: ReadonlyMap<string, DeepReadonly<D2dProductEvidence>> = (() => {
  const rows = new Map<string, DeepReadonly<D2dProductEvidence>>()
  const productIds = new Set([...profileByProductId.keys(), ...regulatoryByProductId.keys()])
  for (const productId of productIds) {
    rows.set(
      productId,
      deepFreeze({
        profile: profileByProductId.get(productId) ?? null,
        regulatoryEvidence: regulatoryByProductId.get(productId) ?? null,
      }),
    )
  }
  return rows
})()

export function getReviewedProductProfile(productId: string): ReviewedProductProfile | null {
  return profileByProductId.get(productId) ?? null
}

export function getReviewedProductRegulatoryEvidence(
  productId: string,
): ReviewedProductRegulatoryEvidence | null {
  return regulatoryByProductId.get(productId) ?? null
}

/** Null outside the reviewed ten-product pilot; no synthetic fallback row is ever created. */
export function getD2dProductEvidence(productId: string): D2dProductEvidence | null {
  return evidenceByProductId.get(productId) ?? null
}
