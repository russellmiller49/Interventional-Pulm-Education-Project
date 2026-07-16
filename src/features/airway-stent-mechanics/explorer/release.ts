import { getEvidenceReference } from '../content/evidenceRegistry'
import { stentExplorerStations } from './stations'

export type StentExplorerReleaseStatus = 'draft' | 'reviewed'
export type StentExplorerPublicationStatus = 'draft' | 'published'

/**
 * Publication is an editorial decision distinct from clinical-review completion.
 * The site owner approved public release of this educational explorer on 2026-07-13.
 */
export const stentExplorerPublicationStatus: StentExplorerPublicationStatus = 'published'

/**
 * Manual gates represent reviews that cannot be inferred from content objects.
 * Keep them false until the named review is documented in the release checklist.
 */
export const stentExplorerManualReviewGates = Object.freeze({
  assetRightsApproved: true,
  clinicalClaimsApproved: false,
  sourceMappingApproved: false,
  visualReviewApproved: false,
})

const everyStationReviewed = stentExplorerStations.every(
  (station) => String(station.clinicalReviewStatus) === 'reviewed',
)
const referencedEvidence = new Set(stentExplorerStations.flatMap((station) => station.evidenceRefs))
const everyReferenceReviewed = [...referencedEvidence].every(
  (referenceId) => getEvidenceReference(referenceId).clinicalReviewStatus === 'reviewed',
)
const everyManualGateApproved = Object.values(stentExplorerManualReviewGates).every(Boolean)

/** Single publication source used by both route gating and learner-facing status copy. */
export const stentExplorerReleaseStatus: StentExplorerReleaseStatus =
  everyStationReviewed && everyReferenceReviewed && everyManualGateApproved ? 'reviewed' : 'draft'

export const stentExplorerReleaseBadge =
  stentExplorerPublicationStatus === 'published' && stentExplorerReleaseStatus === 'reviewed'
    ? 'Clinically reviewed'
    : stentExplorerPublicationStatus === 'published'
      ? 'Live educational module'
      : 'Draft · clinical review required'
