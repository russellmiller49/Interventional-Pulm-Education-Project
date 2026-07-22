/**
 * One editorial release state for the complete Baxter CRRT module.
 *
 * Clinical/device review metadata remains useful provenance, but it never
 * decides whether private-development content can run. Only this explicit,
 * code-owned state controls public visibility.
 */
export type BaxterCrrtReleaseStage =
  | 'private-development'
  | 'sme-review'
  | 'unlisted-preview'
  | 'published'

/**
 * The completed v1 is available by direct link while remaining excluded from
 * navigation, search, and the sitemap. Moving to `published` remains a
 * separate editorial decision after review feedback has been incorporated.
 */
export const baxterCrrtReleaseStage: BaxterCrrtReleaseStage = 'unlisted-preview'

export type BaxterCrrtPublicationStatus = 'draft' | 'published'

export function publicationStatusForBaxterCrrtStage(
  stage: BaxterCrrtReleaseStage,
): BaxterCrrtPublicationStatus {
  return stage === 'published' ? 'published' : 'draft'
}

export const baxterCrrtPublicationStatus: BaxterCrrtPublicationStatus =
  publicationStatusForBaxterCrrtStage(baxterCrrtReleaseStage)

export const baxterCrrtIsPublic = (stage: BaxterCrrtReleaseStage): boolean => stage === 'published'
export const baxterCrrtIsDirectLinkPublic = (stage: BaxterCrrtReleaseStage): boolean =>
  stage === 'unlisted-preview' || stage === 'published'
export const baxterCrrtIsSmeReview = (stage: BaxterCrrtReleaseStage): boolean =>
  stage === 'sme-review'

export const baxterCrrtReleaseLabel: Readonly<Record<BaxterCrrtReleaseStage, string>> =
  Object.freeze({
    'private-development': 'Private development',
    'sme-review': 'Protected SME review',
    'unlisted-preview': 'Unlisted public preview',
    published: 'Published',
  })
