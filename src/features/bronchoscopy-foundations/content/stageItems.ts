import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import type { AirwayLabel } from '../components/scope/types'
import type { ClaimClass, SourceRef } from '../data/sources'
import { CAPSTONE_CASES } from './capstone'
import type { LocalPolicyId } from './localPolicies'
import type { MediaRef } from './media'
import { bronchActivityId, BRONCH_SECTION_IDS, type BronchSectionId } from './pathway'
import { BRONCH_SECTIONS } from './sections'
import type { AuthoredItem, AuthoredTransferItem } from './types'

/**
 * The authored items, re-expressed as the shared clinical learning items the stage renders.
 *
 * An authored item keeps its id (unique across the course by the section validator), its stem,
 * choices, rationales, plausibilities and explanation; the shared schema adds the activity, the
 * phase and the review status (`draft` everywhere until the owner's review). What the shared item
 * cannot carry — the patient situation, a still, the policies the answer depends on, the map pins a
 * choice corresponds to — rides beside it in `BronchStageItem`. Everything goes through the schema
 * at import, so a banned term or an unkeyed choice is a build failure, not a learner surprise.
 */
export interface BronchStageItem {
  readonly item: ClinicalLearningItem
  readonly situation?: string
  readonly media?: MediaRef
  readonly localPolicyIds: readonly LocalPolicyId[]
  readonly sourceRefs: readonly SourceRef[]
  readonly claimClass: ClaimClass
  readonly objectiveIds: readonly string[]
  /** Set when the answer is an airway: choice id → the map pin, or null for an off-tree choice. */
  readonly choiceAirways: Readonly<Record<string, AirwayLabel | null>> | null
  readonly transferVariant?: string
  readonly retrievesFrom?: BronchSectionId
}

/** A placeholder evidence id for a design-class item the schema still requires a source for. */
export const DESIGN_EVIDENCE_ID = 'course-design'

export interface ItemConversion {
  readonly activityId: string
  readonly phase: 'predict' | 'transfer'
}

export function toClinicalLearningItem(
  authored: AuthoredItem,
  conversion: ItemConversion,
): ClinicalLearningItem {
  const best = authored.choices.filter((choice) => choice.plausibility === 'best')
  const evidenceIds = [...new Set(authored.sourceRefs.map((ref) => ref.sourceId))]
  const override = (authored.copyExemptions ?? [])
    .map((exemption) => `${exemption.term}: ${exemption.reason}`)
    .join('; ')
  return clinicalLearningItemSchema.parse({
    id: authored.id,
    activityId: conversion.activityId,
    phase: conversion.phase,
    itemType: conversion.phase === 'transfer' ? 'transfer-case' : authored.itemType,
    contextRequirement: 'context-independent',
    ...(conversion.phase === 'transfer' ? { transferVariantId: `${authored.id}-variant` } : {}),
    stem: authored.stem,
    choices: authored.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      rationale: choice.rationale,
      plausibility: choice.plausibility,
    })),
    correctChoiceIds: best.map((choice) => choice.id),
    explanation: authored.explanation,
    evidenceIds: evidenceIds.length > 0 ? evidenceIds : [DESIGN_EVIDENCE_ID],
    reviewStatus: 'draft',
    ...(override ? { learnerCopyOverrideReason: override.slice(0, 500) } : {}),
  })
}

function stageItem(
  authored: AuthoredItem | AuthoredTransferItem,
  conversion: ItemConversion,
): BronchStageItem {
  const transfer = 'transferVariant' in authored ? authored : null
  return {
    item: toClinicalLearningItem(authored, conversion),
    situation: authored.situation,
    media: authored.media,
    localPolicyIds: authored.localPolicyIds ?? [],
    sourceRefs: authored.sourceRefs,
    claimClass: authored.claimClass,
    objectiveIds: authored.objectiveIds,
    choiceAirways: authored.choiceAirways ?? null,
    ...(transfer
      ? { transferVariant: transfer.transferVariant, retrievesFrom: transfer.retrievesFrom }
      : {}),
  }
}

export interface BronchSectionItems {
  readonly prediction: BronchStageItem
  readonly transfer: BronchStageItem
  readonly practice: readonly BronchStageItem[]
}

const sectionItems = new Map<BronchSectionId, BronchSectionItems>(
  BRONCH_SECTIONS.map((section) => {
    const activityId = bronchActivityId(section.id)
    return [
      section.id,
      {
        prediction: stageItem(section.prediction, { activityId, phase: 'predict' }),
        transfer: stageItem(section.transfer, { activityId, phase: 'transfer' }),
        practice: section.practice.map((entry) =>
          stageItem(entry.item, { activityId, phase: 'predict' }),
        ),
      },
    ] as const
  }),
)

export function bronchSectionItems(sectionId: BronchSectionId): BronchSectionItems {
  const items = sectionItems.get(sectionId)
  if (!items) throw new Error(`No items for section ${sectionId}`)
  return items
}

export const CAPSTONE_ACTIVITY_ID = 'bronchoscopy-foundations:assess:capstone'

export const capstoneStageItems: readonly BronchStageItem[] = CAPSTONE_CASES.map((entry) =>
  stageItem(entry.item, { activityId: CAPSTONE_ACTIVITY_ID, phase: 'predict' }),
)

/** Every item the course can record a first decision on, by item id. */
export const BRONCH_ITEM_BY_ID: ReadonlyMap<string, ClinicalLearningItem> = new Map(
  [
    ...BRONCH_SECTION_IDS.flatMap((sectionId) => {
      const items = bronchSectionItems(sectionId)
      return [items.prediction, items.transfer, ...items.practice]
    }),
    ...capstoneStageItems,
  ].map((entry) => [entry.item.id, entry.item] as const),
)

export function bronchItem(itemId: string): ClinicalLearningItem | undefined {
  return BRONCH_ITEM_BY_ID.get(itemId)
}

/** First-attempt keys: the surface, a colon, the item id. */
export function sectionAttemptKey(sectionId: BronchSectionId, itemId: string): string {
  return `${sectionId}:${itemId}`
}

export function practiceAttemptKey(itemId: string): string {
  return `practice:${itemId}`
}

export function capstoneAttemptKey(itemId: string): string {
  return `capstone:${itemId}`
}

export function validateBronchStageItems(): readonly string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const sectionId of BRONCH_SECTION_IDS) {
    const items = bronchSectionItems(sectionId)
    for (const entry of [items.prediction, items.transfer, ...items.practice]) {
      if (seen.has(entry.item.id)) errors.push(`Item ${entry.item.id} is registered twice.`)
      seen.add(entry.item.id)
      if (entry.item.correctChoiceIds.length !== 1)
        errors.push(`Item ${entry.item.id} keys ${entry.item.correctChoiceIds.length} choices.`)
    }
    if (items.prediction.item.phase !== 'predict')
      errors.push(`${sectionId} prediction is not a predict item.`)
    if (items.transfer.item.phase !== 'transfer')
      errors.push(`${sectionId} transfer is not a transfer item.`)
  }
  for (const entry of capstoneStageItems) {
    if (seen.has(entry.item.id)) errors.push(`Capstone item ${entry.item.id} is registered twice.`)
    seen.add(entry.item.id)
  }
  return errors
}

const itemErrors = validateBronchStageItems()
if (itemErrors.length > 0) {
  throw new Error(`The Bronchoscopy Foundations items are invalid:\n${itemErrors.join('\n')}`)
}
