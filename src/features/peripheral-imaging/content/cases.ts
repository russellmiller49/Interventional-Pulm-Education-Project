import type { ClinicalLearningItem } from '@/features/learning-module/activity'

import { QUESTION_BY_ID } from '../data/questions'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { isImagingSectionId, PERIPHERAL_IMAGING_MODULE_ID, type ImagingSectionId } from './pathway'
import { toClinicalLearningItem } from './stageItems'

/**
 * The eight integrated cases: suite situations that draw on several sections, on the page the
 * course's old Assess address still opens.
 *
 * They began as the draft's capstone — decided once, in one sitting, after every section, against
 * a seven-of-eight and every-safety-decision standard. The owner's self-paced decision (PI-01,
 * 2026-09-14) retired that standard, the all-sections lock and the first-decision record. The
 * cases, their items, their stable ids and the item bank's safety flag stay: each case is open at
 * any time, can show its explanation before an answer, and links to the section whose mechanism
 * it applies. Presentation titles name the situation, never the answer.
 */

/** Stable item identity. The name predates the conversion and is kept so item ids do not move. */
export const CAPSTONE_ACTIVITY_ID = `${PERIPHERAL_IMAGING_MODULE_ID}:assess:capstone`

export interface ImagingCase {
  readonly id: string
  readonly presentationTitle: string
  readonly item: ClinicalLearningItem
  /** The item bank marks this situation as a safety decision; the case says so above its choices. */
  readonly critical: boolean
  readonly pairedSectionId: ImagingSectionId
}

const CASE_DEFINITIONS: readonly {
  readonly id: string
  readonly presentationTitle: string
  readonly pairedSectionId: ImagingSectionId
}[] = [
  {
    id: 'case-1',
    presentationTitle: 'Lesion not visualized near the pleura',
    pairedSectionId: 'two-dimensional',
  },
  { id: 'case-2', presentationTitle: 'Needle too small on the monitor', pairedSectionId: 'field' },
  {
    id: 'case-3',
    presentationTitle: 'Evidence for prior-aided DTS',
    pairedSectionId: 'dts-interpretation',
  },
  {
    id: 'case-4',
    presentationTitle: 'Collision check after robot docking',
    pairedSectionId: 'cbct-acquisition',
  },
  {
    id: 'case-5',
    presentationTitle: 'Needle tip beyond the lesion',
    pairedSectionId: 'tool-confirmation',
  },
  {
    id: 'case-6',
    presentationTitle: 'Breath hold not tolerated',
    pairedSectionId: 'changing-anatomy',
  },
  {
    id: 'case-7',
    presentationTitle: 'Staff position during a CBCT spin',
    pairedSectionId: 'staff-protection',
  },
  {
    id: 'case-8',
    presentationTitle: 'KAP components on the dose report',
    pairedSectionId: 'dose-reporting',
  },
]

/** Stable item id for a case, `capstone:<case id>`, unchanged by the conversion. */
export function capstoneItemId(caseId: string): string {
  return `capstone:${caseId}`
}

export const imagingCases: readonly ImagingCase[] = CASE_DEFINITIONS.map((definition) => {
  const question = QUESTION_BY_ID[definition.id]
  if (!question) throw new Error(`Unknown case ${definition.id}`)
  return {
    id: definition.id,
    presentationTitle: definition.presentationTitle,
    item: toClinicalLearningItem(question, {
      id: capstoneItemId(definition.id),
      activityId: CAPSTONE_ACTIVITY_ID,
      phase: 'predict',
    }),
    critical: question.critical === true,
    pairedSectionId: definition.pairedSectionId,
  }
})

export const imagingCaseById: ReadonlyMap<string, ImagingCase> = new Map(
  imagingCases.map((imagingCase) => [imagingCase.id, imagingCase] as const),
)

export function imagingCasesPairedTo(sectionId: ImagingSectionId): readonly ImagingCase[] {
  return imagingCases.filter((imagingCase) => imagingCase.pairedSectionId === sectionId)
}

export function validateImagingCases(): readonly string[] {
  const errors: string[] = []
  if (imagingCases.length !== 8) errors.push('The integrated case set must hold eight cases.')
  const ids = new Set<string>()
  for (const imagingCase of imagingCases) {
    const where = `Case ${imagingCase.id}`
    if (ids.has(imagingCase.id)) errors.push(`${where} is declared twice.`)
    ids.add(imagingCase.id)
    errors.push(
      ...imagingLearnerCopyErrors(`${where} title`, imagingCase.presentationTitle, {
        allowDigits: false,
      }),
    )
    if (!isImagingSectionId(imagingCase.pairedSectionId))
      errors.push(`${where} pairs to an unknown section.`)
    const keyedLabel =
      imagingCase.item.choices.find((choice) => choice.id === imagingCase.item.correctChoiceIds[0])
        ?.label ?? ''
    const firstWords = keyedLabel.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
    if (firstWords && imagingCase.presentationTitle.toLowerCase().includes(firstWords)) {
      errors.push(`${where} title repeats its keyed answer.`)
    }
  }
  return errors
}

const caseErrors = validateImagingCases()
if (caseErrors.length > 0) {
  throw new Error(`The integrated imaging cases are invalid:\n${caseErrors.join('\n')}`)
}
