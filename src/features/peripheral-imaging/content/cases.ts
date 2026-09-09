import type { ClinicalLearningItem } from '@/features/learning-module/activity'

import { QUESTION_BY_ID } from '../data/questions'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { isImagingSectionId, PERIPHERAL_IMAGING_MODULE_ID, type ImagingSectionId } from './pathway'
import { toClinicalLearningItem } from './stageItems'

/**
 * The capstone: the draft's eight suite cases, decided once, in one sitting, on the Assess page.
 *
 * The draft's contract is kept whole: first decisions are immutable, the standard is at least
 * seven of eight held and every safety-critical decision held, and the set's debrief is shown only
 * after every case is decided. Presentation titles name the situation, never the answer. Each case
 * pairs to the section whose mechanism it examines, so a section's completion card can say where
 * its idea returns.
 */
export const CAPSTONE_MIN_HELD = 7

export const CAPSTONE_ACTIVITY_ID = `${PERIPHERAL_IMAGING_MODULE_ID}:assess:capstone`

export interface ImagingCase {
  readonly id: string
  readonly presentationTitle: string
  readonly item: ClinicalLearningItem
  /** A wrong decision here is a safety error; the standard cannot be met with one. */
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
    presentationTitle: 'Near the pleura, nothing convincing',
    pairedSectionId: 'two-dimensional',
  },
  { id: 'case-2', presentationTitle: 'Small on the monitor', pairedSectionId: 'field' },
  {
    id: 'case-3',
    presentationTitle: 'A reconstruction that resembles the reference',
    pairedSectionId: 'dts-interpretation',
  },
  {
    id: 'case-4',
    presentationTitle: 'After the robot docked',
    pairedSectionId: 'cbct-acquisition',
  },
  {
    id: 'case-5',
    presentationTitle: 'Tip beyond, window within',
    pairedSectionId: 'tool-confirmation',
  },
  {
    id: 'case-6',
    presentationTitle: 'The hold is not tolerated',
    pairedSectionId: 'changing-anatomy',
  },
  {
    id: 'case-7',
    presentationTitle: 'Where to stand for the spin',
    pairedSectionId: 'staff-protection',
  },
  {
    id: 'case-8',
    presentationTitle: 'Two numbers on the dose report',
    pairedSectionId: 'dose-reporting',
  },
]

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
  if (imagingCases.length !== 8) errors.push('The capstone must hold eight cases.')
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
  if (!imagingCases.some((imagingCase) => imagingCase.critical)) {
    errors.push('No case is safety-critical; the standard would be accuracy alone.')
  }
  return errors
}

const caseErrors = validateImagingCases()
if (caseErrors.length > 0) {
  throw new Error(`The imaging capstone cases are invalid:\n${caseErrors.join('\n')}`)
}
