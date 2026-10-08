import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { registerFindings, type RegisterExemption, type RegisterSurface } from './reviewRegister'

/**
 * The learner-copy gate every Bronchoscopy Foundations registry runs at import.
 *
 * Three checks on every authored sentence, so a problem throws before any test runs rather than
 * reaching a learner:
 * 1. The shared vocabulary gate (`flaggedLearnerCopyTerms`): software-internal words and the
 *    examination and correctness vocabulary a formative course may not use (score, pass, test,
 *    quiz, assessment, percent, correct, wrong, route, …). A section may exempt a term on a
 *    specific block with a stated reason — concentration notation is the one expected use.
 * 2. The transcript review register (`registerFindings`): phrases the adopted treatments refuse.
 * 3. Digits, where a caller refuses them: titles and short titles carry no counters or codes.
 *
 * The shared gate also refuses a handful of words this course needs in their clinical sense
 * (`CLINICAL_VOCABULARY`). Those pass here, for every section; the shared gate itself is unchanged.
 */

/**
 * Words the shared gate reads as examination or software vocabulary and bronchoscopy uses
 * clinically, each with the use that is meant. The scoring vocabulary proper (score, points, exam,
 * quiz, mastery, certified) stays refused.
 */
export const CLINICAL_VOCABULARY: Readonly<Record<string, string>> = {
  '%': 'Concentrations, saturations and returns, stated as the guideline states them.',
  percent: 'Percent obstruction and percent return.',
  test: 'A laboratory or device test: a leak test, a coagulation test.',
  grade: 'A bleeding grade, or the grade of a recommendation.',
  graded: 'Bleeding graded on a scale.',
  route: 'The nasal and the oral route.',
  pass: 'Passing the scope or an instrument.',
  passed: 'An instrument passed through the channel.',
  fail: 'A device check that can fail.',
  failed: 'A failed pre-use check.',
}

/** The reason recorded when an item uses clinical vocabulary the shared schema would flag. */
export function clinicalVocabularyReason(text: string): string | null {
  const used = flaggedLearnerCopyTerms(text).filter((term) => term in CLINICAL_VOCABULARY)
  return used.length > 0
    ? `Clinical vocabulary: ${used.map((term) => `${term} (${CLINICAL_VOCABULARY[term]})`).join(' ')}`
    : null
}

export interface CopyExemption {
  readonly term: string
  readonly reason: string
}

export interface BronchCopyOptions {
  readonly allowDigits?: boolean
  readonly surface?: RegisterSurface
  readonly registerExemptions?: readonly RegisterExemption[]
  readonly copyExemptions?: readonly CopyExemption[]
}

export function bronchLearnerCopyErrors(
  where: string,
  value: string,
  options: BronchCopyOptions = {},
): readonly string[] {
  const errors: string[] = []
  const text = value.trim()
  if (text.length === 0) return [`${where} is empty.`]
  const exempt = new Set((options.copyExemptions ?? []).map((exemption) => exemption.term))
  const flagged = flaggedLearnerCopyTerms(text).filter(
    (term) => !exempt.has(term) && !(term in CLINICAL_VOCABULARY),
  )
  if (flagged.length > 0) {
    errors.push(`${where} uses vocabulary the learner copy gate refuses: ${flagged.join(', ')}.`)
  }
  errors.push(
    ...registerFindings(where, text, options.surface ?? 'instruction', options.registerExemptions),
  )
  if (options.allowDigits === false && /\d/.test(text)) {
    errors.push(
      `${where} carries a digit; titles name the situation, never a counter or a segment code.`,
    )
  }
  return errors
}

/**
 * Absolutes mark an option as the one to eliminate before its content is read (assessment-design,
 * "Anti-cueing mechanics"). Refused in option labels.
 */
const ABSOLUTE = /\b(always|never|necessarily|guarantee[sd]?|every time|under any circumstances)\b/i

export function optionAbsoluteErrors(where: string, label: string): readonly string[] {
  return ABSOLUTE.test(label)
    ? [`${where} carries an absolute ("${label.match(ABSOLUTE)?.[0]}") that cues it.`]
    : []
}
