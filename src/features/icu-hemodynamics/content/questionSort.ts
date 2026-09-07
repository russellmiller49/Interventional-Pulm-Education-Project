import { hemodynamicsLearnerCopyErrors } from './controlPanel'
import { hemodynamicsSourceById } from './sources'

/**
 * The question sort: the orientation section's Act step.
 *
 * Seven questions a clinician asks at the bedside of a patient in shock, each attributed to one of
 * three origins — the catheter measures it, it is calculated from what the catheter measures, or
 * the catheter cannot answer it on its own. Committed as a set, graded row by row in words. A
 * learner who has understood the section separates the three; one who has learned "the catheter
 * tells you everything about the circulation" puts the last two rows in the first bin.
 *
 * The registry validates at import: every origin must be the answer to something, no row may
 * carry a number, and every cited source must be registered.
 */
export const questionSortOriginIds = ['measured', 'calculated', 'beyond'] as const

export type QuestionSortOriginId = (typeof questionSortOriginIds)[number]

export interface QuestionSortOrigin {
  readonly id: QuestionSortOriginId
  readonly label: string
  readonly definition: string
}

export interface QuestionSortRow {
  readonly id: string
  /** The question, as it would be asked on a round. */
  readonly question: string
  readonly origin: QuestionSortOriginId
  readonly rationale: string
}

export interface QuestionSort {
  readonly prompt: string
  readonly origins: readonly QuestionSortOrigin[]
  readonly rows: readonly QuestionSortRow[]
  readonly sourceIds: readonly string[]
}

export const HEMODYNAMICS_QUESTION_SORT: QuestionSort = {
  prompt:
    'Seven questions from the bedside of a patient in shock. For each one, say where its answer comes from: the catheter measures it, it is calculated from what the catheter measures, or the catheter cannot answer it on its own.',
  origins: [
    {
      id: 'measured',
      label: 'The catheter measures it',
      definition:
        'A pressure read where the tip sits, a flow taken from a temperature curve, or a blood sample drawn from the tip.',
    },
    {
      id: 'calculated',
      label: 'It is calculated from what the catheter measures',
      definition:
        'An equation over measured values. It inherits every doubt about the numbers that went into it.',
    },
    {
      id: 'beyond',
      label: 'The catheter cannot answer it on its own',
      definition:
        'A question about cause, or about how the patient would respond to a change, which a set of readings can support but not settle.',
    },
  ],
  rows: [
    {
      id: 'pa-pressure',
      question: 'What is the pressure in the pulmonary artery?',
      origin: 'measured',
      rationale: 'The tip sits in the artery and reports the pressure around it directly.',
    },
    {
      id: 'wedge-pressure',
      question: 'What is the pressure beyond a stopped branch of the pulmonary artery — the wedge?',
      origin: 'measured',
      rationale:
        'With the balloon up the tip reads the pressure in the occluded branch. It is a measured pressure, used as a stand-in for the left atrium.',
    },
    {
      id: 'cardiac-output',
      question: 'How much blood is the heart pumping each minute?',
      origin: 'measured',
      rationale:
        'A cold injection upstream and a temperature curve at the tip measure flow. The curve, not the number, is what the catheter produces.',
    },
    {
      id: 'vascular-resistance',
      question: 'How much resistance is the left heart pumping against?',
      origin: 'calculated',
      rationale:
        'Resistance is a pressure difference divided by a flow. Both are measured; the resistance is worked out from them.',
    },
    {
      id: 'oxygen-delivery',
      question: 'How much oxygen is reaching the tissues each minute?',
      origin: 'calculated',
      rationale:
        'Flow multiplied by the oxygen content of arterial blood. The flow and the sample are measured; the delivery is arithmetic.',
    },
    {
      id: 'fluid-responsiveness',
      question: 'Will this patient improve if given more fluid?',
      origin: 'beyond',
      rationale:
        'That is a prediction about a change. A filling pressure on its own does not make it; a reversible challenge and a measured response can.',
    },
    {
      id: 'cause',
      question: 'Why is the pressure low?',
      origin: 'beyond',
      rationale:
        'A pattern of pressures and flow supports a mechanism. The bedside examination, the history and the echo decide it.',
    },
  ],
  sourceIds: ['pac-review-2014', 'esicm-shock-2025', 'pac-derived-part-2-2021'],
}

export function validateQuestionSort(
  sort: QuestionSort = HEMODYNAMICS_QUESTION_SORT,
): readonly string[] {
  const errors: string[] = []
  const originIds = new Set(sort.origins.map((origin) => origin.id))
  for (const originId of questionSortOriginIds) {
    if (!originIds.has(originId)) errors.push(`Origin ${originId} is missing.`)
    if (!sort.rows.some((row) => row.origin === originId)) {
      errors.push(`Origin ${originId} is the answer to no row; it is a decoy.`)
    }
  }
  const rowIds = new Set<string>()
  for (const row of sort.rows) {
    if (rowIds.has(row.id)) errors.push(`Row ${row.id} is declared twice.`)
    rowIds.add(row.id)
    if (!originIds.has(row.origin)) errors.push(`Row ${row.id} names an unknown origin.`)
    errors.push(
      ...hemodynamicsLearnerCopyErrors(`Row ${row.id} question`, row.question),
      ...hemodynamicsLearnerCopyErrors(`Row ${row.id} rationale`, row.rationale),
    )
  }
  if (sort.rows.length < 5) errors.push('The sort needs at least five rows.')
  errors.push(...hemodynamicsLearnerCopyErrors('The sort prompt', sort.prompt))
  for (const origin of sort.origins) {
    errors.push(
      ...hemodynamicsLearnerCopyErrors(`Origin ${origin.id} label`, origin.label),
      ...hemodynamicsLearnerCopyErrors(`Origin ${origin.id} definition`, origin.definition),
    )
  }
  for (const sourceId of sort.sourceIds) {
    if (!hemodynamicsSourceById.has(sourceId)) {
      errors.push(`The sort cites an unregistered source ${sourceId}.`)
    }
  }
  return errors
}

const questionSortErrors = validateQuestionSort()
if (questionSortErrors.length > 0) {
  throw new Error(`The question sort is invalid:\n${questionSortErrors.join('\n')}`)
}
