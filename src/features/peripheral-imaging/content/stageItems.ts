import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import { QUESTION_BY_ID } from '../data/questions'
import type { Question } from '../types'
import {
  imagingActivityId,
  imagingLesson,
  peripheralImagingSectionIds,
  type ImagingSectionId,
} from './pathway'

/**
 * The draft's item bank, re-expressed as the shared clinical learning items the stage renders.
 *
 * Every lesson carries two items: the first is its prediction, committed before the suite unlocks;
 * the second is the retrieval item the draft already paired to it, replayed as the transfer.
 * The same question used twice gets two ids — one per section — so the first-attempt keys and the
 * choice rotation differ per use, and a correct answer in an earlier section cannot silently
 * complete a later one. Everything goes through the shared schema at import, so a banned term or
 * an unkeyed choice is a build failure, not a learner surprise. Every item is `draft` until the
 * owner's review.
 */
type Plausibility = ClinicalLearningItem['choices'][number]['plausibility']

/**
 * Where a distractor is a real hazard or a defensible-but-incomplete reading, say so: the verdict
 * card names an unsafe choice as unsafe, and frames an incomplete one differently from a wrong
 * mechanism. Everything not listed is `incorrect-mechanism`. For the owner's review.
 */
const PLAUSIBILITY_OVERRIDES: Readonly<Record<string, Readonly<Record<string, Plausibility>>>> = {
  'case-1': { a: 'unsafe', b: 'unsafe' },
  'case-4': { a: 'unsafe' },
  'case-6': { a: 'unsafe', c: 'unsafe' },
  'case-7': { b: 'unsafe', c: 'unsafe' },
  'safety-1': { a: 'unsafe', b: 'unsafe' },
  'workflow-1': { c: 'unsafe' },
  'signal-1': { a: 'reasonable-but-incomplete' },
  'geometry-1': { c: 'reasonable-but-incomplete' },
  'tool-1': { b: 'reasonable-but-incomplete' },
  'dose-1': { a: 'reasonable-but-incomplete' },
  'choose-1': { c: 'reasonable-but-incomplete' },

  // Practice cases.
  'signal-practice-1': { c: 'reasonable-but-incomplete' },
  'signal-practice-2': { a: 'reasonable-but-incomplete' },
  'field-practice-1': { c: 'unsafe' },
  'field-practice-2': { a: 'reasonable-but-incomplete', b: 'reasonable-but-incomplete' },
  'two-dimensional-practice-1': { a: 'unsafe', c: 'reasonable-but-incomplete' },
  'dts-acquisition-practice-1': { a: 'reasonable-but-incomplete' },
  'dts-interpretation-practice-1': { b: 'unsafe' },
  'cbct-acquisition-practice-1': { c: 'reasonable-but-incomplete' },
  'fixed-suite-practice-1': { a: 'unsafe', b: 'reasonable-but-incomplete' },
  'mobile-suite-practice-1': { b: 'reasonable-but-incomplete' },
  'tool-confirmation-practice-1': { b: 'reasonable-but-incomplete' },
  'changing-anatomy-practice-1': { c: 'unsafe' },
  'staff-protection-practice-1': { a: 'reasonable-but-incomplete' },
  'dose-reporting-practice-1': { c: 'unsafe' },
}

/** Stems that ask for the next move, as opposed to a reading of what the image shows. */
const MANAGEMENT_DECISION_IDS: ReadonlySet<string> = new Set([
  'anatomy-1',
  'workflow-1',
  'acquisition-1',
  'fixed-1',
  'change-1',
  'safety-1',
  'case-1',
  'case-4',
  'case-6',
  'case-7',
  'capstone-transfer-1',

  // Practice cases that ask for the next move.
  'signal-practice-2',
  'field-practice-1',
  'field-practice-2',
  'two-dimensional-practice-1',
  'dts-acquisition-practice-1',
  'dts-acquisition-practice-2',
  'cbct-acquisition-practice-1',
  'fixed-suite-practice-1',
  'mobile-suite-practice-1',
  'changing-anatomy-practice-1',
  'staff-protection-practice-1',
  'dose-reporting-practice-1',
])

export function imagingItemType(question: Question): ClinicalLearningItem['itemType'] {
  return MANAGEMENT_DECISION_IDS.has(question.id)
    ? 'management-decision'
    : 'mechanism-interpretation'
}

export interface ItemConversion {
  readonly id: string
  readonly activityId: string
  readonly phase: 'predict' | 'transfer'
  readonly transferVariantId?: string
}

export function toClinicalLearningItem(
  question: Question,
  conversion: ItemConversion,
): ClinicalLearningItem {
  const overrides = PLAUSIBILITY_OVERRIDES[question.id] ?? {}
  return clinicalLearningItemSchema.parse({
    id: conversion.id,
    activityId: conversion.activityId,
    phase: conversion.phase,
    itemType: conversion.phase === 'transfer' ? 'transfer-case' : imagingItemType(question),
    contextRequirement: 'context-independent',
    ...(conversion.phase === 'transfer' ? { transferVariantId: conversion.transferVariantId } : {}),
    stem: question.stem,
    choices: question.choices.map((choice) => ({
      id: choice.id,
      label: choice.text,
      rationale: choice.rationale,
      plausibility:
        choice.id === question.correct ? 'best' : (overrides[choice.id] ?? 'incorrect-mechanism'),
    })),
    correctChoiceIds: [question.correct],
    explanation: question.takeaway,
    evidenceIds: question.sources,
    reviewStatus: 'draft',
  })
}

export interface ImagingSectionItems {
  readonly prediction: ClinicalLearningItem
  readonly transfer: ClinicalLearningItem
}

export function imagingItemId(sectionId: ImagingSectionId, questionId: string): string {
  return `${sectionId}:${questionId}`
}

function question(id: string): Question {
  const found = QUESTION_BY_ID[id]
  if (!found) throw new Error(`Unknown question ${id}`)
  return found
}

function buildSectionItems(sectionId: ImagingSectionId): ImagingSectionItems {
  const lesson = imagingLesson(sectionId)
  const [predictionId, transferId] = lesson.checkIds
  const activityId = imagingActivityId(sectionId)
  return {
    prediction: toClinicalLearningItem(question(predictionId), {
      id: imagingItemId(sectionId, predictionId),
      activityId,
      phase: 'predict',
    }),
    transfer: toClinicalLearningItem(question(transferId), {
      id: imagingItemId(sectionId, transferId),
      activityId,
      phase: 'transfer',
      transferVariantId: `${transferId}-in-${sectionId}`,
    }),
  }
}

export const imagingStageItems: Readonly<Record<ImagingSectionId, ImagingSectionItems>> =
  Object.fromEntries(
    peripheralImagingSectionIds.map((sectionId) => [sectionId, buildSectionItems(sectionId)]),
  ) as Record<ImagingSectionId, ImagingSectionItems>

export function imagingSectionItems(sectionId: ImagingSectionId): ImagingSectionItems {
  return imagingStageItems[sectionId]
}

/** The question id behind a stage item id, for the first-attempt record. */
export function questionIdOf(itemId: string): string {
  return itemId.slice(itemId.indexOf(':') + 1)
}

export function validateImagingStageItems(): readonly string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const predictedEarlier = new Set<string>()
  peripheralImagingSectionIds.forEach((sectionId, index) => {
    const items = imagingSectionItems(sectionId)
    const where = `Section ${sectionId}`
    for (const item of [items.prediction, items.transfer]) {
      if (ids.has(item.id)) errors.push(`${where} reuses the item id ${item.id}.`)
      ids.add(item.id)
      if (item.activityId !== imagingActivityId(sectionId)) {
        errors.push(`${where} item ${item.id} belongs to another activity.`)
      }
      if (item.correctChoiceIds.length !== 1)
        errors.push(`${where} item ${item.id} keys more than one choice.`)
    }
    if (items.prediction.phase !== 'predict')
      errors.push(`${where} prediction is not a predict item.`)
    if (items.transfer.phase !== 'transfer')
      errors.push(`${where} transfer is not a transfer item.`)
    const transferQuestion = questionIdOf(items.transfer.id)
    const first = index === 0
    const last = index === peripheralImagingSectionIds.length - 1
    if (!first && !last && !predictedEarlier.has(transferQuestion)) {
      errors.push(
        `${where} carries a transfer (${transferQuestion}) that no earlier section predicted.`,
      )
    }
    if (questionIdOf(items.prediction.id) === transferQuestion) {
      errors.push(`${where} predicts and transfers the same question.`)
    }
    predictedEarlier.add(questionIdOf(items.prediction.id))
  })
  return errors
}

const itemErrors = validateImagingStageItems()
if (itemErrors.length > 0) {
  throw new Error(`The imaging stage items are invalid:\n${itemErrors.join('\n')}`)
}
