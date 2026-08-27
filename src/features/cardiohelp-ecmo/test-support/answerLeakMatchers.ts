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
 * Nine of the forms place pInt directly. The tenth protects the relationship that gives the
 * placement away without naming a position at all: ΔP is pInt minus pArt, and that difference is
 * read across the membrane — so a sentence tying both channels to a transmembrane gradient has
 * said where pInt is taken, whatever else it does or does not say. Nothing on the precommit page
 * says it today; the matcher exists so nothing can start.
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
  /*
   * Four concepts, all four required, order-free, within the one unit being scanned: `pInt`,
   * `pArt`, a gradient or difference word, and membrane vocabulary. Written as anchored lookaheads
   * because the relationship is what leaks, not any arrangement of it — "ΔP trend = pInt − pArt
   * across the membrane oxygenator", "Transmembrane gradient compares pInt with pArt" and "pInt and
   * pArt define the pressure drop across the membrane" are the same disclosure three ways, and none
   * of the nine positional matchers above catches any of them.
   *
   * Scanning is per unit and `disclosureUnits()` already splits every text node and prose container
   * into sentences, so a whole-unit conjunction *is* a same-sentence conjunction — and `[\s\S]*`
   * rather than `[^.!?]*` so a decimal inside a sentence cannot silently truncate the search.
   *
   * The gradient concepts are enumerated rather than reduced to a bare `gradient`. A bare word
   * would swallow `transmembrane gradient` and `pressure gradient` as sub-cases, and then removing
   * either one would leave the matcher passing its own contract while no longer detecting the form
   * it was added for. Requiring the gradient concept at all is what keeps the matcher off copy that
   * merely mentions the two channels near the membrane without relating them.
   */
  {
    name: 'ΔP relationship … pInt … pArt … membrane',
    pattern:
      /^(?=[\s\S]*\bpInt\b)(?=[\s\S]*\bpArt\b)(?=[\s\S]*(?:[Δ\u2206]\s*p|\bdelta[\s-]*p\b|transmembrane(?:\s+pressure)?\s+gradient|pressure\s+(?:drop|gradient)|\bdifference\b))(?=[\s\S]*(?:transmembrane|membrane|oxygenator))/i,
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
