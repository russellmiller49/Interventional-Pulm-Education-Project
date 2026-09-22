import { imagingMicroCaseById, type ImagingMicroCase } from './microCases'
import { imagingLearnerCopyErrors } from './learnerCopy'
import { imagingStageLessons } from './stageLessons'

/**
 * Optional practice cases offered at the step they are most useful, beyond the section pairing.
 *
 * Report PR4 (fellow walkthrough, PDF p.46): the eccentric radial EBUS practice case was the most
 * effective piece of the course for the reader, and it would have fitted straight after Section 1's
 * radial EBUS items rather than only after Section 9, which pairs it. The case is not moved, re-paired
 * or rewritten; this offers it, as a link and nothing more, on the Section 1 step that asks about a
 * concentric radial EBUS view. Following the link is optional and unlocks nothing.
 */
export interface RelatedPracticeCase {
  /** The stage step the case is offered on. */
  readonly stepId: string
  readonly caseId: string
  /** Why it is offered here, in the learner's terms. */
  readonly reason: string
}

export const RELATED_PRACTICE_CASES: readonly RelatedPracticeCase[] = [
  {
    stepId: 'imaging-questions:transfer',
    caseId: 'two-dimensional-practice-1',
    reason: 'a short practice case on reading an eccentric radial EBUS view, paired with Section 9',
  },
]

export function relatedPracticeCase(
  stepId: string,
): { readonly link: RelatedPracticeCase; readonly microCase: ImagingMicroCase } | null {
  const link = RELATED_PRACTICE_CASES.find((candidate) => candidate.stepId === stepId)
  if (!link) return null
  const microCase = imagingMicroCaseById.get(link.caseId)
  return microCase ? { link, microCase } : null
}

export function validateImagingRelatedCases(): readonly string[] {
  const errors: string[] = []
  const stepIds = new Set(imagingStageLessons().flatMap((lesson) => lesson.steps.map((s) => s.id)))
  for (const link of RELATED_PRACTICE_CASES) {
    const where = `Related case on ${link.stepId}`
    if (!stepIds.has(link.stepId)) errors.push(`${where} names an unknown step.`)
    if (!imagingMicroCaseById.has(link.caseId)) errors.push(`${where} names an unknown case.`)
    errors.push(...imagingLearnerCopyErrors(`${where} reason`, link.reason))
  }
  return errors
}

const relatedCaseErrors = validateImagingRelatedCases()
if (relatedCaseErrors.length > 0) {
  throw new Error(`The related practice cases are invalid:\n${relatedCaseErrors.join('\n')}`)
}
