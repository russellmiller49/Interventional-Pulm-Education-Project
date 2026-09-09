import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

/**
 * The learner-copy gate every imaging registry runs at import.
 *
 * The shared item schema bans software-internal and examination vocabulary inside items; the
 * critical-care modules extend the same gate to every authored sentence — section specs, step
 * titles, landmarks, chain-stop cards — so a banned word throws before any test runs rather than
 * reaching a learner. Digits are allowed in teaching copy (angles and millimetres are the subject
 * here) and refused where a caller says so: step titles carry no counters.
 */
export interface ImagingLearnerCopyOptions {
  readonly allowDigits?: boolean
}

export function imagingLearnerCopyErrors(
  where: string,
  value: string,
  options: ImagingLearnerCopyOptions = {},
): readonly string[] {
  const errors: string[] = []
  const text = value.trim()
  if (text.length === 0) {
    errors.push(`${where} is empty.`)
    return errors
  }
  const flagged = flaggedLearnerCopyTerms(text)
  if (flagged.length > 0) {
    errors.push(`${where} uses vocabulary the learner copy gate refuses: ${flagged.join(', ')}.`)
  }
  if (options.allowDigits === false && /\d/.test(text)) {
    errors.push(`${where} carries a digit; counters belong to the chain caption, not here.`)
  }
  return errors
}
