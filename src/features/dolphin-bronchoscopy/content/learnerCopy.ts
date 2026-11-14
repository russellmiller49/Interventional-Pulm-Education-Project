import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

/**
 * The learner-copy gate every dolphin registry runs at import.
 *
 * The shared item schema bans software-internal and examination vocabulary inside items; this
 * module applies the same gate to every authored sentence, and adds the words that talk about the
 * course instead of the animal. Digits are allowed in teaching copy and refused where a caller says
 * so: titles and step titles carry no counters.
 */
export interface DolphinCopyOptions {
  readonly allowDigits?: boolean
}

/** Words about the course itself. They go in the sources panel or nowhere, never in a lesson. */
export const COURSE_TALK: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'model boundary', pattern: /\bmodel boundar(y|ies)\b/i },
  { name: 'authored', pattern: /\bauthored\b/i },
  { name: 'synthetic', pattern: /\bsynthetic\b/i },
  { name: 'not reviewed', pattern: /\bnot reviewed\b/i },
  { name: 'draft', pattern: /\bdraft\b/i },
  { name: 'declared', pattern: /\bdeclar(e|es|ed|ing|ation|ations)\b/i },
  { name: 'teaching profile', pattern: /\bteaching profile\b/i },
  {
    name: 'this course does not',
    pattern:
      /\bth(is|e) (course|module|section|lesson|app) (does not|doesn[’']t|cannot|can[’']t|gives no|will not|never)\b/i,
  },
]

export function dolphinLearnerCopyErrors(
  where: string,
  value: string,
  options: DolphinCopyOptions = {},
): readonly string[] {
  const errors: string[] = []
  const text = value.trim()
  if (text.length === 0) return [`${where} is empty.`]
  const flagged = flaggedLearnerCopyTerms(text)
  if (flagged.length > 0) {
    errors.push(`${where} uses vocabulary the learner copy gate refuses: ${flagged.join(', ')}.`)
  }
  for (const term of COURSE_TALK) {
    if (term.pattern.test(text)) errors.push(`${where} talks about the course ("${term.name}").`)
  }
  // Dimension labels (3D) are words, not counters.
  if (options.allowDigits === false && /\d(?!D\b)/.test(text)) {
    errors.push(`${where} carries a digit; titles carry no counters.`)
  }
  return errors
}
