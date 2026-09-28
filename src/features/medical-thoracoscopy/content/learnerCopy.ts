import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'
import { PROMOTIONAL_WORDING } from '@/lib/sponsorship/policy'

/**
 * The learner-copy gate every Medical Thoracoscopy registry runs as it loads, so a problem throws
 * before any test runs rather than reaching a learner. Three checks on every authored string:
 *
 * 1. The shared vocabulary gate: software-internal words and the examination and correctness words
 *    a self-paced course does not use (score, pass, test, quiz, correct, wrong, route, percent, …).
 * 2. The sponsorship policy: no praise and no claim of superiority, since the course is sponsored.
 * 3. Digits, where a caller refuses them.
 *
 * A string may be exempted from one term only by naming the term and saying why.
 */
export interface CopyExemption {
  readonly term: string
  readonly reason: string
}

export interface ThoracoscopyCopyOptions {
  readonly allowDigits?: boolean
  readonly exemptions?: readonly CopyExemption[]
}

export function thoracoscopyCopyErrors(
  where: string,
  value: string,
  options: ThoracoscopyCopyOptions = {},
): readonly string[] {
  const text = value.trim()
  if (text.length === 0) return [`${where} is empty.`]
  const errors: string[] = []
  const exempt = new Set((options.exemptions ?? []).map((exemption) => exemption.term))
  const flagged = flaggedLearnerCopyTerms(text).filter((term) => !exempt.has(term))
  if (flagged.length > 0) {
    errors.push(`${where} uses vocabulary the learner-copy gate refuses: ${flagged.join(', ')}.`)
  }
  const promotional = text.match(PROMOTIONAL_WORDING)
  if (promotional && !exempt.has(promotional[0].toLowerCase())) {
    errors.push(
      `${where} uses promotional wording the sponsorship policy refuses: ${promotional[0]}.`,
    )
  }
  if (options.allowDigits === false && /\d/.test(text)) {
    errors.push(`${where} carries a digit.`)
  }
  return errors
}

/** Throws with every error found, for registries that check themselves as they load. */
export function assertThoracoscopyCopy(
  entries: readonly {
    readonly where: string
    readonly text: string
    readonly options?: ThoracoscopyCopyOptions
  }[],
): void {
  const errors = entries.flatMap((entry) =>
    thoracoscopyCopyErrors(entry.where, entry.text, entry.options),
  )
  if (errors.length > 0) throw new Error(`Medical Thoracoscopy learner copy:\n${errors.join('\n')}`)
}
