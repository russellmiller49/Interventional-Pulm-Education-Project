import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ANSWER_LEAK_MATCHERS, answerLeakMatcher } from '../test-support/answerLeakMatchers'

/**
 * That every semantic form of the keyed answer is still individually detected.
 *
 * The composed scan in `foundation-answer-leak.test.tsx` cannot establish this and never could.
 * Its detector fires if *any* matcher matches, and the forms overlap on purpose, so a matcher that
 * has been deleted is indistinguishable from one that is merely redundant on today's copy. An
 * independent review reproduced exactly that: deleting the `pInt` + `pre-oxygenator` matcher left
 * the composed suite fully green at 13/13, and a sweep of the other eight showed the same for all
 * but one — eight of nine matchers could be removed without a single failing assertion.
 *
 * The fix is not to remove the overlap. The composed scan is worth having precisely because it
 * catches wording nobody enumerated, and a narrower set would catch less. What was missing is this:
 * a contract that names the forms and checks each one on its own.
 *
 * Deliberately stated from outside the registry. The required names and the fixtures live here, not
 * beside the patterns, so deleting a matcher cannot delete the requirement that it exist: the set
 * assertion fails on the name, and that matcher's own case fails on the lookup. Each case carries
 * both directions — sentences the matcher must catch, and sentences about the same circuit
 * components that it must leave alone, so the contract cannot be satisfied by widening a pattern
 * until it matches everything.
 *
 * The final targeted review found one form unprotected. Nine matchers place pInt somewhere; none
 * held the relationship that discloses the placement without naming a position — ΔP is pInt minus
 * pArt, read across the membrane. All three of the review's probes returned no match against the
 * nine, and the tenth matcher is the contract that they now must. The learner-facing page was not
 * leaking any of them; this is a regression contract, not a repair.
 */

interface MatcherContract {
  readonly name: string
  /** Real committed copy, or the wording a regression would most plausibly reintroduce. */
  readonly detects: readonly string[]
  /** Same components, the keyed answer not disclosed. This matcher must not fire on any of them. */
  readonly leaves: readonly string[]
}

/** The stable name of the relationship matcher, so its own contract can be named in a failure. */
const DELTA_P_MATCHER = 'ΔP relationship … pInt … pArt … membrane'

/** The three probes the final review supplied verbatim. Every one must match. */
const DELTA_P_REVIEW_PROBES: readonly string[] = [
  'ΔP trend = pInt − pArt across the membrane oxygenator',
  'Transmembrane gradient compares pInt with pArt',
  'pInt and pArt define the pressure drop across the membrane',
]

const CONTRACTS: readonly MatcherContract[] = [
  {
    name: 'between … pump … membrane',
    detects: [
      'pVen is reported on the drainage limb, pInt between pump and membrane, pArt after the membrane on the return limb.',
    ],
    leaves: ['The pump and the membrane are the two components this lesson asks you to find.'],
  },
  {
    name: 'after … pump … before … membrane',
    detects: ['This pressure is taken after the pump and before the membrane oxygenator.'],
    leaves: ['Sweep gas is set before the membrane is assessed, after the pump has settled.'],
  },
  {
    name: 'pInt … after the pump',
    detects: ['pInt is measured after the pump on the post-pump limb.'],
    leaves: ['Flow settles after the pump reaches its commanded speed.'],
  },
  {
    name: 'pre-membrane … pInt',
    detects: ['Reported here: pre-membrane pressure (pInt).'],
    leaves: ['Pre-membrane and post-membrane pressures are compared across the oxygenator.'],
  },
  {
    name: 'pInt … pump outlet … membrane',
    detects: ['pInt sits at the pump outlet, upstream of the membrane oxygenator.'],
    leaves: ['The pump outlet feeds the membrane oxygenator through the post-pump tubing.'],
  },
  {
    name: 'pInt … pre-oxygenator',
    detects: ['The pre-oxygenator access point is where pInt is taken.'],
    leaves: ['Pre-oxygenator saturation is read from the access point on this limb.'],
  },
  {
    name: 'pump outflow … pInt',
    detects: ['Pump outflow carries pInt toward the oxygenator.'],
    // The withheld description's own sentence: same clause, no channel named.
    leaves: ['Pump outflow passes a pre-oxygenator access point and the membrane oxygenator.'],
  },
  {
    name: 'pInt … access point',
    detects: ['pInt is read at the access point on the post-pump limb.'],
    leaves: ['The access point is drawn on the path this lesson asks you to trace.'],
  },
  {
    name: 'pInt before the membrane/oxygenator',
    detects: [
      'Pump outflow passes pInt, a pre-oxygenator access point, and the membrane oxygenator.',
    ],
    leaves: ['Blood is warmed before the membrane and sampled after the oxygenator.'],
  },
  {
    name: DELTA_P_MATCHER,
    detects: [
      ...DELTA_P_REVIEW_PROBES,
      // Channel order reversed, and the gradient phrase moved behind the pair.
      'pArt subtracted from pInt is the transmembrane pressure gradient.',
      // Spelled-out delta, hyphenated, with the membrane word carried only by "transmembrane".
      'The delta-P the console trends is the difference between pArt and pInt across the oxygenator.',
    ],
    leaves: [
      // Both channels and the membrane, no relationship between them.
      'pInt and pArt are displayed beside the membrane diagram.',
      'pInt and pArt changed while the oxygenator continued to run.',
      // A gradient, but not tied to the channel pair.
      'ΔP is displayed on the console.',
      // A gradient across the membrane, but only one of the two channels.
      'The membrane pressure drop is reviewed after pInt is recorded.',
    ],
  },
]

describe('every required semantic matcher is individually represented', () => {
  it('the registry declares exactly the required forms, in order', () => {
    expect(ANSWER_LEAK_MATCHERS.map((matcher) => matcher.name)).toEqual(
      CONTRACTS.map((contract) => contract.name),
    )
  })

  it.each(CONTRACTS)('$name catches every form it is responsible for', ({ name, detects }) => {
    const matcher = answerLeakMatcher(name)
    expect(matcher).toBeDefined()
    expect(detects.length).toBeGreaterThan(0)
    for (const form of detects) {
      expect(`${form} => ${matcher!.pattern.test(form)}`).toBe(`${form} => true`)
    }
  })

  it.each(CONTRACTS)('$name is not so wide that it fires on safe copy', ({ name, leaves }) => {
    const matcher = answerLeakMatcher(name)
    expect(matcher).toBeDefined()
    expect(leaves.length).toBeGreaterThan(0)
    for (const form of leaves) {
      expect(`${form} => ${matcher!.pattern.test(form)}`).toBe(`${form} => false`)
    }
  })

  /*
   * A regex with the global flag carries `lastIndex` between `.test()` calls, so the same pattern
   * applied to a list of scanned units would start mid-string and silently miss a leak on every
   * other unit. Cheap to state, invisible if it ever regressed.
   */
  it('no matcher is stateful across calls', () => {
    for (const { pattern } of ANSWER_LEAK_MATCHERS) {
      expect(pattern.global).toBe(false)
      expect(pattern.sticky).toBe(false)
    }
  })
})

/**
 * The transmembrane-gradient form, named on its own so a deletion or a narrowing says which
 * disclosure stopped being detected rather than only that a list changed length.
 *
 * ΔP is pInt minus pArt and the subtraction is read across the membrane, so a sentence that ties
 * both channels to that gradient has located pInt without ever using a positional word. None of the
 * nine placement matchers catches any of the review's three probes — verified before this matcher
 * existed, and the reason it does.
 */
describe(`the ${DELTA_P_MATCHER} contract`, () => {
  it('is declared under its stable name', () => {
    expect(answerLeakMatcher(DELTA_P_MATCHER)).toBeDefined()
  })

  it.each(DELTA_P_REVIEW_PROBES)('detects the review probe: %s', (probe) => {
    expect(answerLeakMatcher(DELTA_P_MATCHER)!.pattern.test(probe)).toBe(true)
  })

  it('requires all four concepts, so no three of them are enough', () => {
    const pattern = answerLeakMatcher(DELTA_P_MATCHER)!.pattern
    // pArt missing, everything else present.
    expect(pattern.test('pInt drives the pressure drop across the membrane.')).toBe(false)
    // pInt missing.
    expect(pattern.test('pArt drives the pressure drop across the membrane.')).toBe(false)
    // The gradient concept missing.
    expect(pattern.test('pInt and pArt are both drawn on the membrane oxygenator.')).toBe(false)
    // The membrane vocabulary missing.
    expect(pattern.test('pInt and pArt differ by the pressure drop reported here.')).toBe(false)
    expect(pattern.test('The difference between pInt and pArt is trended.')).toBe(false)
  })

  it('is order-free across the channel pair', () => {
    const pattern = answerLeakMatcher(DELTA_P_MATCHER)!.pattern
    expect(pattern.test('ΔP trend = pInt − pArt across the membrane oxygenator')).toBe(true)
    expect(pattern.test('ΔP trend = pArt − pInt across the membrane oxygenator')).toBe(true)
  })

  it('accepts the connectives the same claim is written with', () => {
    const pattern = answerLeakMatcher(DELTA_P_MATCHER)!.pattern
    for (const connective of ['−', '-', 'minus', 'with', 'compares', 'and']) {
      const sentence = `The transmembrane pressure gradient is pInt ${connective} pArt.`
      expect(`${connective} => ${pattern.test(sentence)}`).toBe(`${connective} => true`)
    }
  })

  it('names each gradient vocabulary the probes rely on, separably', () => {
    const pattern = answerLeakMatcher(DELTA_P_MATCHER)!.pattern
    // Each of these carries exactly one gradient concept, so removing that concept from the
    // pattern kills exactly one of these lines rather than being covered by a broader alternative.
    expect(pattern.test('ΔP across the membrane is pInt against pArt.')).toBe(true)
    expect(pattern.test('Delta P across the membrane is pInt against pArt.')).toBe(true)
    expect(pattern.test('Transmembrane gradient compares pInt with pArt')).toBe(true)
    expect(pattern.test('The transmembrane pressure gradient relates pInt to pArt.')).toBe(true)
    expect(pattern.test('pInt and pArt define the pressure drop across the membrane')).toBe(true)
    expect(pattern.test('pInt and pArt define the pressure gradient across the membrane.')).toBe(
      true,
    )
    expect(pattern.test('The membrane difference between pInt and pArt is trended.')).toBe(true)
  })
})

/**
 * That the composed scan reads this registry rather than a copy of it.
 *
 * The whole point of the split is that one file declares the forms and a different file states what
 * they must detect. If the composed suite ever re-inlined its own pattern list, both files could be
 * green while the scan ran against something this contract has never seen. A source contract is the
 * only way to say that from here: the import is a fact about the file, not about a value.
 */
describe('the composed leak scan uses this registry', () => {
  const COMPOSED_SUITE = readFileSync(join(__dirname, 'foundation-answer-leak.test.tsx'), 'utf8')

  it('imports the shared matchers', () => {
    expect(COMPOSED_SUITE).toMatch(
      /import \{[^}]*\banswerLeakMatch\b[^}]*\} from '\.\.\/test-support\/answerLeakMatchers'/,
    )
  })

  it('scans with the shared matcher rather than a local list', () => {
    expect(COMPOSED_SUITE).toMatch(/answerLeakMatch\(/)
    // No second registry: a `name`/`pattern` pair declared in the suite itself is the regression.
    expect(COMPOSED_SUITE).not.toMatch(/^\s*pattern:\s*\//m)
  })
})
