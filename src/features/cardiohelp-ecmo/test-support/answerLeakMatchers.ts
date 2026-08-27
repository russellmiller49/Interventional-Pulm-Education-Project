/**
 * The semantic equivalents of the flow-path section's keyed answer.
 *
 * `circuit-flow-path` asks "where in the blood path does the circuit report pInt?". The leak is any
 * content that locates pInt after the pump and before the membrane — not one exact sentence, which
 * is why the scan matches a set of forms rather than a string. Two surfaces produced those forms in
 * practice: the teaching pane ("pInt between pump and membrane", "pre-membrane pressure") and the
 * diagnostic map's SVG description ("Pump outflow passes pInt, a pre-oxygenator access point"), so
 * the set carries both vocabularies and the forms deliberately overlap.
 *
 * Names and patterns only. The registry does not say what any matcher must detect, because the two
 * questions worth asking are independent and keeping them in one file let one answer cover for the
 * other. `foundation-answer-leak.test.tsx` asks whether the rendered activity leaks;
 * `foundation-answer-leak-matchers.test.ts` states, from outside this file, which forms must remain
 * individually detected and supplies its own fixtures for each. Before the split there was no
 * second question: deleting any one of eight matchers left the composed suite fully green, because
 * the remaining broader matchers caught the same fixtures through a `.some(…)`. Overlap is wanted;
 * overlap that hides a deletion is not.
 */
export interface AnswerLeakMatcher {
  /** Stable identity. The contract suite asserts on this set, so renaming one is a deliberate act. */
  readonly name: string
  readonly pattern: RegExp
}

export const ANSWER_LEAK_MATCHERS: readonly AnswerLeakMatcher[] = [
  { name: 'between … pump … membrane', pattern: /\bbetween\b.*\bpump\b.*\bmembrane\b/i },
  {
    name: 'after … pump … before … membrane',
    pattern: /\bafter\b.*\bpump\b.*\bbefore\b.*\bmembrane\b/i,
  },
  { name: 'pInt … after the pump', pattern: /\bpInt\b.*after the pump|after the pump.*\bpInt\b/i },
  { name: 'pre-membrane … pInt', pattern: /pre-?membrane.*\bpInt\b|\bpInt\b.*pre-?membrane/i },
  { name: 'pInt … pump outlet … membrane', pattern: /\bpInt\b.*pump outlet.*\bmembrane\b/i },
  {
    name: 'pInt … pre-oxygenator',
    pattern: /\bpInt\b.*pre-?oxygenator|pre-?oxygenator.*\bpInt\b/i,
  },
  { name: 'pump outflow … pInt', pattern: /pump outflow.*\bpInt\b|\bpInt\b.*pump outflow/i },
  { name: 'pInt … access point', pattern: /\bpInt\b.*access point|access point.*\bpInt\b/i },
  {
    name: 'pInt before the membrane/oxygenator',
    pattern:
      /\bpInt\b[^.!?]*before the (?:membrane|oxygenator)|passes \bpInt\b[^.!?]*(?:membrane|oxygenator)/i,
  },
]

/** Lookup by name. Returns `undefined` for a matcher that is no longer declared. */
export function answerLeakMatcher(name: string): AnswerLeakMatcher | undefined {
  return ANSWER_LEAK_MATCHERS.find((matcher) => matcher.name === name)
}

/** Whether any declared matcher fires on one scanned unit. Used by the composed scan. */
export function answerLeakMatch(unit: string): AnswerLeakMatcher | undefined {
  return ANSWER_LEAK_MATCHERS.find((matcher) => matcher.pattern.test(unit))
}
