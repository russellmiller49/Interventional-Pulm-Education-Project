import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import { dolphinActivityId, type DolphinSectionId } from './pathway'
import type { AuthoredItem, AuthoredTransferItem } from './types'

/**
 * Authored items → the shared clinical item contract.
 *
 * Every item parses `clinicalLearningItemSchema` (exactly one best choice, the copy gate, an
 * evidence id) at import. Review status stays `draft` here and never reaches the learner.
 */
export function dolphinItemId(scope: string, itemId: string): string {
  return `${scope}:${itemId}`
}

export function toDolphinClinicalItem(
  scope: DolphinSectionId,
  item: AuthoredItem | AuthoredTransferItem,
  phase: 'predict' | 'transfer',
): ClinicalLearningItem {
  const id = dolphinItemId(scope, item.id)
  const best = item.choices.filter((choice) => choice.plausibility === 'best').map((c) => c.id)
  return clinicalLearningItemSchema.parse({
    id,
    activityId: dolphinActivityId(scope),
    phase,
    itemType: phase === 'transfer' ? 'transfer-case' : item.itemType,
    contextRequirement: item.situation ? 'patient' : 'context-independent',
    ...(item.situation ? { clinicalContextId: `${id}:situation` } : {}),
    ...(item.media ? { visualAssetIds: [item.media.frameId] } : {}),
    ...(phase === 'transfer' ? { transferVariantId: `${id}:variant` } : {}),
    stem: item.stem,
    choices: item.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      rationale: choice.rationale,
      plausibility: choice.plausibility,
    })),
    correctChoiceIds: best,
    explanation: item.explanation,
    evidenceIds: [...item.sourceIds],
    reviewStatus: 'draft',
  })
}
