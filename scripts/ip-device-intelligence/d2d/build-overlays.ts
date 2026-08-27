import {
  profileOverlayArtifactSchema,
  type ProfileOverlayArtifact,
  type ProfileOverlayRow,
} from '../../../src/features/device-intelligence/domain/profile-overlay-schema'
import {
  regulatoryOverlayArtifactSchema,
  type RegulatoryOverlayArtifact,
  type RegulatoryOverlayRow,
} from '../../../src/features/device-intelligence/domain/regulatory-overlay-schema'

import { canonicalJson, readJsonWithBytes, sha256, writeOrCheckFile } from './io'
import { D2D_PATHS, D2D_REPO_ROOT, d2dAbsolutePath } from './paths'
import {
  descriptionReviewArtifactSchema,
  evidenceSourceArtifactSchema,
  pilotCohortArtifactSchema,
  regulatoryReviewArtifactSchema,
} from './schemas'

function profileSourceIds(row: ProfileOverlayRow): Set<string> {
  const claims = [
    ...row.summary_claims,
    row.physical_device_type,
    row.intended_function,
    row.exact_configuration_summary,
    ...row.key_specifications,
  ].filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))
  return new Set(
    claims.flatMap((claim) => claim.source_refs.map((reference) => reference.source_id)),
  )
}

function regulatorySourceIds(row: RegulatoryOverlayRow): Set<string> {
  return new Set(
    [
      ...row.udi_identities,
      ...row.classifications,
      ...row.pathways,
      ...row.registration_listing_evidence,
      ...row.commercial_distribution_evidence,
    ].flatMap((record) => record.source_refs.map((reference) => reference.source_id)),
  )
}

function compactSources(
  ids: Set<string>,
  evidenceSources: ReturnType<typeof evidenceSourceArtifactSchema.parse>,
) {
  const byId = new Map(evidenceSources.sources.map((source) => [source.source_id, source]))
  return [...ids].sort().map((sourceId) => {
    const source = byId.get(sourceId)
    if (!source) throw new Error(`Reviewed runtime row references unknown source ${sourceId}.`)
    return {
      source_id: source.source_id,
      governed_source_id: source.governed_source_id,
      source_kind: source.source_kind,
      title: source.title,
      organization: source.organization,
      official_url: source.official_url,
      snapshot_date: source.snapshot_date,
      content_sha256: source.content_sha256,
    }
  })
}

export function buildD2DOverlays(repoRoot = D2D_REPO_ROOT): {
  profile: ProfileOverlayArtifact
  regulatory: RegulatoryOverlayArtifact
} {
  const cohortInput = readJsonWithBytes<unknown>(d2dAbsolutePath(D2D_PATHS.pilotCohort, repoRoot))
  const evidenceSourceInput = readJsonWithBytes<unknown>(
    d2dAbsolutePath(D2D_PATHS.evidenceSources, repoRoot),
  )
  const descriptionInput = readJsonWithBytes<unknown>(
    d2dAbsolutePath(D2D_PATHS.descriptionReviews, repoRoot),
  )
  const regulatoryInput = readJsonWithBytes<unknown>(
    d2dAbsolutePath(D2D_PATHS.regulatoryReviews, repoRoot),
  )
  const cohort = pilotCohortArtifactSchema.parse(cohortInput.value)
  const evidenceSources = evidenceSourceArtifactSchema.parse(evidenceSourceInput.value)
  const descriptionReviews = descriptionReviewArtifactSchema.parse(descriptionInput.value)
  const regulatoryReviews = regulatoryReviewArtifactSchema.parse(regulatoryInput.value)
  const pilotIds = new Set(cohort.products.map((product) => product.product_id))

  const profileRows = descriptionReviews.rows
    .filter(
      (review) => review.decision === 'approved' || review.decision === 'insufficient_evidence',
    )
    .map((review) => review.final_profile!)
    .sort((left, right) => left.product_id.localeCompare(right.product_id))
  const regulatoryRows = regulatoryReviews.rows
    .filter((review) => review.decision === 'approved' || review.decision === 'unresolved')
    .map((review) => review.final_regulatory_record!)
    .sort((left, right) => left.product_id.localeCompare(right.product_id))

  for (const row of [...profileRows, ...regulatoryRows]) {
    if (!pilotIds.has(row.product_id)) {
      throw new Error(`Reviewed D2D row ${row.product_id} is outside the frozen pilot.`)
    }
  }

  const profileReferencedSources = new Set(profileRows.flatMap((row) => [...profileSourceIds(row)]))
  const regulatoryReferencedSources = new Set(
    regulatoryRows.flatMap((row) => [...regulatorySourceIds(row)]),
  )

  const profile = profileOverlayArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'device_intelligence_product_profile_overlay',
    method_version: 'd2d-product-profile-overlay-v1',
    row_scope: 'reviewed_d2d_pilot_only',
    source_artifacts: {
      evidence_sources: {
        path: D2D_PATHS.evidenceSources,
        sha256: sha256(evidenceSourceInput.bytes),
      },
      description_reviews: {
        path: D2D_PATHS.descriptionReviews,
        sha256: sha256(descriptionInput.bytes),
      },
    },
    counts: {
      pilot_products: 10,
      rows: profileRows.length,
      reviewed: profileRows.filter((row) => row.runtime_state === 'reviewed').length,
      insufficient_evidence: profileRows.filter(
        (row) => row.runtime_state === 'insufficient_evidence',
      ).length,
    },
    sources: compactSources(profileReferencedSources, evidenceSources),
    rows: profileRows,
  })

  const regulatory = regulatoryOverlayArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'device_intelligence_product_regulatory_overlay',
    method_version: 'd2d-product-regulatory-overlay-v1',
    row_scope: 'reviewed_d2d_pilot_only',
    source_artifacts: {
      evidence_sources: {
        path: D2D_PATHS.evidenceSources,
        sha256: sha256(evidenceSourceInput.bytes),
      },
      regulatory_reviews: {
        path: D2D_PATHS.regulatoryReviews,
        sha256: sha256(regulatoryInput.bytes),
      },
    },
    counts: {
      pilot_products: 10,
      rows: regulatoryRows.length,
      reviewed: regulatoryRows.filter((row) => row.research_state === 'reviewed').length,
      unresolved: regulatoryRows.filter((row) => row.research_state === 'unresolved').length,
    },
    sources: compactSources(regulatoryReferencedSources, evidenceSources),
    rows: regulatoryRows,
  })

  return { profile, regulatory }
}

export function generateD2DOverlayFiles(repoRoot = D2D_REPO_ROOT): Record<string, string> {
  const overlays = buildD2DOverlays(repoRoot)
  return {
    [D2D_PATHS.profileOverlay]: canonicalJson(overlays.profile),
    [D2D_PATHS.regulatoryOverlay]: canonicalJson(overlays.regulatory),
  }
}

function main(argv: string[]): void {
  const check = argv.includes('--check')
  const files = generateD2DOverlayFiles()
  for (const [relativePath, contents] of Object.entries(files)) {
    writeOrCheckFile({
      absolutePath: d2dAbsolutePath(relativePath),
      relativePath,
      contents,
      check,
    })
  }
  process.stdout.write(
    `${check ? 'Checked' : 'Wrote'} ${Object.keys(files).length} reviewed-only D2D overlays.\n`,
  )
}

if (require.main === module) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  }
}
