import { ANSWER_LEAK_MATCHERS, answerLeakMatcher } from '../test-support/answerLeakMatchers'

/**
 * That every semantic form of the keyed answer is still individually detected.
 *
 * The composed scan in `foundation-answer-leak.test.tsx` cannot establish this and never could.
 * Its detector fires if *any* matcher matches, and the forms overlap on purpose, so a matcher that
 * has been deleted is indistinguishable from one that is merely redundant on today's copy. The
 * final independent review reproduced exactly that: deleting the `pInt` + `pre-oxygenator` matcher
 * left the composed suite fully green at 13/13, and a sweep of the other eight showed the same for
 * all but one — eight of nine matchers could be removed without a single failing assertion.
 *
 * The fix is not to remove the overlap. The composed scan is worth having precisely because it
 * catches wording nobody enumerated, and a narrower set would catch less. What was missing is this:
 * a contract that names the forms and checks each one on its own.
 *
 * Deliberately stated from outside the registry. The required names and the fixtures live here, not
 * beside the patterns, so deleting a matcher cannot delete the requirement that it exist: the set
 * assertion fails on the name, and that matcher's own case fails on the lookup. Each case carries
 * both directions — a sentence the matcher must catch, and a sentence about the same components
 * that it must leave alone, so the contract cannot be satisfied by widening a pattern until it
 * matches everything.
 */

interface MatcherContract {
  readonly name: string
  /** Real committed copy, or the wording a regression would most plausibly reintroduce. */
  readonly detects: string
  /** Same components, pInt not placed among them. This matcher must not fire. */
  readonly leaves: string
}

const CONTRACTS: readonly MatcherContract[] = [
  {
    name: 'between … pump … membrane',
    detects:
      'pVen is reported on the drainage limb, pInt between pump and membrane, pArt after the membrane on the return limb.',
    leaves: 'The pump and the membrane are the two components this lesson asks you to find.',
  },
  {
    name: 'after … pump … before … membrane',
    detects: 'This pressure is taken after the pump and before the membrane oxygenator.',
    leaves: 'Sweep gas is set before the membrane is assessed, after the pump has settled.',
  },
  {
    name: 'pInt … after the pump',
    detects: 'pInt is measured after the pump on the post-pump limb.',
    leaves: 'Flow settles after the pump reaches its commanded speed.',
  },
  {
    name: 'pre-membrane … pInt',
    detects: 'Reported here: pre-membrane pressure (pInt).',
    leaves: 'Pre-membrane and post-membrane pressures are compared across the oxygenator.',
  },
  {
    name: 'pInt … pump outlet … membrane',
    detects: 'pInt sits at the pump outlet, upstream of the membrane oxygenator.',
    leaves: 'The pump outlet feeds the membrane oxygenator through the post-pump tubing.',
  },
  {
    name: 'pInt … pre-oxygenator',
    detects: 'The pre-oxygenator access point is where pInt is taken.',
    leaves: 'Pre-oxygenator saturation is read from the access point on this limb.',
  },
  {
    name: 'pump outflow … pInt',
    detects: 'Pump outflow carries pInt toward the oxygenator.',
    // The withheld description's own sentence: same clause, no channel named.
    leaves: 'Pump outflow passes a pre-oxygenator access point and the membrane oxygenator.',
  },
  {
    name: 'pInt … access point',
    detects: 'pInt is read at the access point on the post-pump limb.',
    leaves: 'The access point is drawn on the path this lesson asks you to trace.',
  },
  {
    name: 'pInt before the membrane/oxygenator',
    detects:
      'Pump outflow passes pInt, a pre-oxygenator access point, and the membrane oxygenator.',
    leaves: 'Blood is warmed before the membrane and sampled after the oxygenator.',
  },
]

describe('every required semantic matcher is individually represented', () => {
  it('the registry declares exactly the required forms, in order', () => {
    expect(ANSWER_LEAK_MATCHERS.map((matcher) => matcher.name)).toEqual(
      CONTRACTS.map((contract) => contract.name),
    )
  })

  it.each(CONTRACTS)('$name catches its own form', ({ name, detects }) => {
    const matcher = answerLeakMatcher(name)
    expect(matcher).toBeDefined()
    expect(matcher!.pattern.test(detects)).toBe(true)
  })

  it.each(CONTRACTS)('$name is not so wide that it fires on safe copy', ({ name, leaves }) => {
    const matcher = answerLeakMatcher(name)
    expect(matcher).toBeDefined()
    expect(matcher!.pattern.test(leaves)).toBe(false)
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
