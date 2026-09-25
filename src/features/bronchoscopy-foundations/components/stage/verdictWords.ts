import type { Plausibility } from '../../content/types'

/**
 * The words an activity uses, once the learner has checked a response, to say how it went (fellow
 * walkthrough A43, the part this module owns).
 *
 * The questions' verdict card is the shared `AnswerVerdict` with `outcome="stated"`, which leads
 * with "Correct." / "Partly correct." / "Not correct." / "Not correct, and unsafe.". The sets, the
 * ledger, the report and the scenario said "Held." / "Did not hold." instead, so one course spoke
 * two vocabularies and a learner had to work out that they meant the same thing. They now use the
 * card's words, mapped from the same plausibility. The labels are qualitative only: nothing here
 * counts, totals or grades, and a set is still read row by row.
 */
export const OUTCOME_WORDS: Readonly<Record<Plausibility, string>> = {
  best: 'Correct.',
  'reasonable-but-incomplete': 'Partly correct.',
  'incorrect-mechanism': 'Not correct.',
  unsafe: 'Not correct, and unsafe.',
}

/** A row in a set that is simply placed where the course places it, or not. */
export const MATCHED_WORDS = OUTCOME_WORDS.best
export const UNMATCHED_WORDS = OUTCOME_WORDS['incorrect-mechanism']

/**
 * A label read as the end of a sentence: "What am I looking at?" keeps its question mark rather than
 * gaining a full stop after it, and "Carina" becomes "Carina.".
 */
export function asSentence(text: string): string {
  const trimmed = text.trim()
  return /[.?!…]$/.test(trimmed) ? trimmed : `${trimmed}.`
}
