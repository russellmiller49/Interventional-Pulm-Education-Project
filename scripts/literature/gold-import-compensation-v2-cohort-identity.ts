import { createHash } from 'node:crypto'

import type { ImportPlanV2 } from '../../src/features/literature/gold-set/import-compensation-v2'

import { canonicalJson } from './gold-import-compensation-migration-operations'

const AMENDED_NOTE_PMIDS = new Set(['36879724', '39281191'])

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function protectedV2ProductionCohortRowsFromImportPlan(plan: ImportPlanV2) {
  return plan.actions.map((action) => {
    const review = action.action === 'import_noop' ? action.candidateReview : action.review
    return {
      action: action.action,
      actionIdentitySha256: sha256(action.actionId),
      automatedSignalsRevealedAtAfter: action.preImportItemState.automatedSignalsRevealedAt,
      automatedSignalsRevealedAtBefore: action.preImportItemState.automatedSignalsRevealedAt,
      categorizationFromFullText: review.categorizationFromFullText,
      clinicalPurposeCount: review.clinicalPurposes.length,
      diseaseStatus: review.diseaseTagStatus,
      diseaseTagCount: review.diseaseTags.length,
      fullTextUsed: review.fullTextUsed,
      importedReviewPersisted: action.action !== 'import_noop',
      isBlinded: review.isBlinded,
      noteDisposition: AMENDED_NOTE_PMIDS.has(action.pmid)
        ? ('amended_authorized_rationale' as const)
        : ('finalized_v3' as const),
      noteSha256: sha256(review.notes),
      publicationStatus: review.publicationStatus,
      relevanceLabel: review.relevanceLabel,
      requiredNoteSha256: sha256(review.notes),
      studyDesign: review.studyDesign,
      supplementalMetadataRevealedAtAfter: action.preImportItemState.supplementalMetadataRevealedAt,
      supplementalMetadataRevealedAtBefore:
        action.preImportItemState.supplementalMetadataRevealedAt,
      technologyStatus: review.technologyTagStatus,
      technologyTagCount: review.technologyTags.length,
      topicCount: review.topicIds.length,
      usedSupplementalMetadataAfter: review.usedSupplementalMetadata,
      usedSupplementalMetadataBefore:
        action.action === 'import_initial'
          ? null
          : action.preImportItemState.supplementalMetadataRevealedAt !== null,
    }
  })
}

export function protectedV2ProductionCohortRowsSha256FromImportPlan(plan: ImportPlanV2): string {
  const rows = protectedV2ProductionCohortRowsFromImportPlan(plan).sort((left, right) =>
    left.actionIdentitySha256.localeCompare(right.actionIdentitySha256, 'en'),
  )
  return sha256(canonicalJson(rows))
}
