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
 *
 * Prompt 04 (OD4-05, 2026-09-22) revised three cases. Their questions changed, so they are new
 * cases under new ids in the same slots; the earlier items stay in the bank and their addresses
 * redirect (`LEGACY_INTEGRATED_CASE_ADDRESSES`).
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
    id: 'case-4-v2',
    presentationTitle: 'Collision check after robot docking',
    pairedSectionId: 'cbct-acquisition',
  },
  {
    // The slot's title used to be "Needle tip beyond the lesion", which states the finding the
    // image-based version asks the learner to read off the planes.
    id: 'case-5-v2',
    presentationTitle: 'Needle and lesion on linked thin planes',
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
    id: 'case-8-v2',
    presentationTitle: 'KAP components on the dose report',
    pairedSectionId: 'dose-reporting',
  },
]

/**
 * Old case addresses whose slot a revised case now occupies (owner decision OD4-05, 2026-09-22:
 * "old integrated-case addresses redirect if their slot is replaced"). A case is keyed by its
 * question id, so a revised question is a new case id; the old question stays in the bank under its
 * own id. `?case=case-4` and the others keep working by redirecting to the case in their slot.
 *
 * Nothing stored is rewritten. A device that opened `case-4` keeps that entry exactly as written;
 * it records that the earlier case was opened, which says nothing about the revised one.
 */
export const LEGACY_INTEGRATED_CASE_ADDRESSES: Readonly<Record<string, string>> = {
  'case-4': 'case-4-v2',
  'case-5': 'case-5-v2',
  'case-8': 'case-8-v2',
}

/** The case an address opens now: a current id opens itself, a replaced one its successor. */
export function resolveIntegratedCaseAddress(caseId: string): string | null {
  const current = Object.hasOwn(LEGACY_INTEGRATED_CASE_ADDRESSES, caseId)
    ? LEGACY_INTEGRATED_CASE_ADDRESSES[caseId]
    : caseId
  return CASE_DEFINITIONS.some((definition) => definition.id === current) ? current : null
}

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
  for (const [legacy, current] of Object.entries(LEGACY_INTEGRATED_CASE_ADDRESSES)) {
    const where = `Legacy case address ${legacy}`
    if (ids.has(legacy)) errors.push(`${where} is still a current case, so it cannot redirect.`)
    if (!ids.has(current)) errors.push(`${where} redirects to ${current}, which is not a case.`)
    // The replaced item stays in the bank under its own id, so old records keep their meaning.
    if (!QUESTION_BY_ID[legacy]) errors.push(`${where} no longer has its item in the bank.`)
  }
  return errors
}

const caseErrors = validateImagingCases()
if (caseErrors.length > 0) {
  throw new Error(`The integrated imaging cases are invalid:\n${caseErrors.join('\n')}`)
}
