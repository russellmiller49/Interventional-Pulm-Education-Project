import path from 'node:path'

export const D2D_REPO_ROOT = path.resolve(__dirname, '../../..')
export const D2D_SNAPSHOT_DATE = '2026-08-24'

export const D2D_PATHS = {
  catalog: 'data/ip-preference-cards/generated/catalog-products.json',
  governedSources: 'data/ip-preference-cards/generated/sources.json',
  productSources: 'data/ip-preference-cards/generated/product-sources.json',
  sourceCompletenessManifest:
    'docs/ip-preference-cards/source-completeness/2026-08-20/source-manifest.json',
  pilotCohort: 'data/ip-device-intelligence/reviewed/d2d-pilot-cohort.json',
  evidenceSources: 'data/ip-device-intelligence/reviewed/d2d-evidence-sources.json',
  profileEvidence: 'data/ip-device-intelligence/reviewed/product-profile-evidence.json',
  descriptionReviews: 'data/ip-device-intelligence/reviewed/product-description-reviews.json',
  regulatoryReviews: 'data/ip-device-intelligence/reviewed/product-regulatory-matches.json',
  acquisitionManifest: `data/ip-device-intelligence/research/d2d/${D2D_SNAPSHOT_DATE}/acquisition-manifest.json`,
  evidenceProposals: `data/ip-device-intelligence/research/d2d/${D2D_SNAPSHOT_DATE}/evidence-proposals.json`,
  profileDrafts: `data/ip-device-intelligence/research/d2d/${D2D_SNAPSHOT_DATE}/product-profile-drafts.json`,
  profileOverlay: 'data/ip-device-intelligence/generated/product-profile-overlay.json',
  regulatoryOverlay: 'data/ip-device-intelligence/generated/product-regulatory-overlay.json',
  reviewDirectory: 'docs/ip-device-intelligence/d2d-review',
  localCacheRoot: `local-data/ip-device-intelligence/d2d/${D2D_SNAPSHOT_DATE}`,
} as const

export function d2dAbsolutePath(relativePath: string, repoRoot = D2D_REPO_ROOT): string {
  return path.join(repoRoot, relativePath)
}
