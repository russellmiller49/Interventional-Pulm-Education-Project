import { choiceOrderOffset, orderChoices } from '../content/choiceOrder'
import { ecmoFoundationLearningItems } from '../content/foundationLearningItems'
import { ecmoLearnPredictions } from '../content/learnPredictionItems'
import { clinicalPracticeSupportByScenarioId } from '../content/practiceSupport'

/**
 * Anti-cueing: the best choice must be findable only by reasoning.
 *
 * Two cues were recorded against the authored item sets. The best choice was written first in every
 * one of the eighty-two sets, and it was the uniquely longest option in most of them. A learner
 * who notices either can outscore a learner who reads. The first cue is removed at render time by
 * `orderChoices` — a deterministic cyclic rotation keyed on the item id — and the second is an
 * authoring property of the labels themselves. Both are asserted here the way a learner would
 * exploit them: by simulating the "always pick the first option" and "always pick the longest
 * option" strategies over each family and requiring that neither does materially better than
 * chance. A third assertion, that the best choice is uniquely longest in no more than three sets in
 * ten, catches the length cue before it is dense enough for a learner to notice.
 *
 * The thresholds are per family rather than per item deliberately. A single item may have a long
 * best answer for a good reason — an ordering that has to be stated in full — and that is not a
 * cue on its own; the cue is the pattern across the set a learner works through.
 */

interface ChoiceSet {
  readonly key: string
  readonly choices: readonly { readonly id: string; readonly label: string }[]
  readonly bestId: string
}

interface Family {
  readonly name: string
  readonly sets: readonly ChoiceSet[]
}

const learnFamily: Family = {
  name: 'Learn predictions',
  sets: Object.values(ecmoLearnPredictions).map(({ item }) => ({
    key: item.id,
    choices: item.choices,
    bestId: item.correctChoiceIds[0],
  })),
}

const foundationFamily: Family = {
  name: 'foundation predict/transfer items',
  sets: Object.values(ecmoFoundationLearningItems).flatMap(({ prediction, transfer }) =>
    [prediction, transfer].map((item) => ({
      key: item.id,
      choices: item.choices,
      bestId: item.correctChoiceIds[0],
    })),
  ),
}

const practiceFamily: Family = {
  name: 'Practice reassessment sets',
  sets: Object.entries(clinicalPracticeSupportByScenarioId).flatMap(([scenarioId, support]) =>
    (['device', 'circuit', 'patient'] as const).map((domain) => {
      const question = support.reassessment[domain]
      return {
        key: `${scenarioId}-${domain}`,
        choices: question.options,
        bestId: question.correctOptionId,
      }
    }),
  ),
}

const families: readonly Family[] = [learnFamily, foundationFamily, practiceFamily]

/** The share of a family a strategy would answer best, given a per-set predicate. */
function share(sets: readonly ChoiceSet[], hit: (set: ChoiceSet) => boolean): number {
  return sets.filter(hit).length / sets.length
}

/** Mean of 1/n over the family: what guessing at random would achieve. */
function chance(sets: readonly ChoiceSet[]): number {
  return sets.reduce((total, set) => total + 1 / set.choices.length, 0) / sets.length
}

function bestIsUniquelyLongest(set: ChoiceSet): boolean {
  const best = set.choices.find((choice) => choice.id === set.bestId)
  if (!best) throw new Error(`${set.key}: best choice ${set.bestId} is not in the set`)
  return set.choices.every(
    (choice) => choice.id === set.bestId || choice.label.length < best.label.length,
  )
}

/**
 * "Always pick the longest option", as displayed. A tie that includes the best choice counts as a
 * hit — a learner who picks among the longest still lands on it — so the estimate is conservative.
 */
function longestStrategyHits(set: ChoiceSet): boolean {
  const displayed = orderChoices(set.key, set.choices)
  const longest = Math.max(...displayed.map((choice) => choice.label.length))
  return displayed.some((choice) => choice.id === set.bestId && choice.label.length === longest)
}

function firstStrategyHits(set: ChoiceSet): boolean {
  return orderChoices(set.key, set.choices)[0].id === set.bestId
}

/** Fixed-width so a failure message reads as a table rather than a float. */
function percent(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

describe('choiceOrderOffset', () => {
  it('is the reference 32-bit FNV-1a hash reduced modulo the count', () => {
    // Published FNV-1a test vectors; a count of 2^32 leaves the hash itself.
    expect(choiceOrderOffset('', 2 ** 32)).toBe(0x811c9dc5)
    expect(choiceOrderOffset('a', 2 ** 32)).toBe(0xe40c292c)
    expect(choiceOrderOffset('foobar', 2 ** 32)).toBe(0xbf9cf968)
    expect(choiceOrderOffset('foobar', 5)).toBe(0xbf9cf968 % 5)
  })

  it('returns 0 whenever there is nothing to rotate', () => {
    expect(choiceOrderOffset('ecmo.learn.vv-recirculation.prediction', 1)).toBe(0)
    expect(choiceOrderOffset('ecmo.learn.vv-recirculation.prediction', 0)).toBe(0)
    expect(choiceOrderOffset('ecmo.learn.vv-recirculation.prediction', -3)).toBe(0)
    expect(choiceOrderOffset('ecmo.learn.vv-recirculation.prediction', 2.5)).toBe(0)
  })

  it('is deterministic and stays inside the set', () => {
    for (const family of families) {
      for (const set of family.sets) {
        const count = set.choices.length
        const offset = choiceOrderOffset(set.key, count)
        expect(Number.isInteger(offset)).toBe(true)
        expect(offset).toBeGreaterThanOrEqual(0)
        expect(offset).toBeLessThan(count)
        expect(choiceOrderOffset(set.key, count)).toBe(offset)
      }
    }
  })

  it('depends on the id, not on the call', () => {
    // Two ids can share an offset by coincidence, so this compares the hashes themselves.
    expect(choiceOrderOffset('ecmo.foundation.why.prediction', 2 ** 32)).not.toBe(
      choiceOrderOffset('ecmo.foundation.pump.prediction', 2 ** 32),
    )
  })
})

describe('orderChoices', () => {
  const authored = [
    { id: 'a', label: 'first' },
    { id: 'b', label: 'second' },
    { id: 'c', label: 'third' },
    { id: 'd', label: 'fourth' },
    { id: 'e', label: 'fifth' },
  ] as const

  it('is a cyclic shift by the offset, and nothing else', () => {
    const offset = choiceOrderOffset('item', authored.length)
    const rotated = orderChoices('item', authored)
    expect(rotated).toEqual([...authored.slice(offset), ...authored.slice(0, offset)])
    expect(rotated).toHaveLength(authored.length)
  })

  it('keeps every authored neighbour relationship, cyclically', () => {
    for (const family of families) {
      for (const set of family.sets) {
        const displayed = orderChoices(set.key, set.choices)
        const count = set.choices.length
        for (let index = 0; index < count; index += 1) {
          const authoredIndex = set.choices.indexOf(displayed[index])
          const nextAuthored = set.choices[(authoredIndex + 1) % count]
          expect(displayed[(index + 1) % count]).toBe(nextAuthored)
        }
      }
    }
  })

  it('returns the same objects with the same ids and mutates nothing', () => {
    const snapshot = authored.map((choice) => ({ ...choice }))
    const rotated = orderChoices('item', authored)
    expect(new Set(rotated.map((choice) => choice.id))).toEqual(
      new Set(authored.map((choice) => choice.id)),
    )
    for (const choice of rotated) expect(authored).toContain(choice)
    expect(authored).toEqual(snapshot)
  })

  it('is deterministic across calls', () => {
    expect(orderChoices('item', authored)).toEqual(orderChoices('item', authored))
    for (const family of families) {
      for (const set of family.sets) {
        expect(orderChoices(set.key, set.choices).map((choice) => choice.id)).toEqual(
          orderChoices(set.key, set.choices).map((choice) => choice.id),
        )
      }
    }
  })

  it('leaves a set with nothing to rotate exactly as authored', () => {
    const single = [authored[0]]
    expect(orderChoices('item', single)).toBe(single)
    expect(orderChoices('item', [])).toEqual([])
  })
})

describe.each(families)('answer cueing across the $name', ({ name, sets }) => {
  // The family sizes are themselves a contract: a strategy score over a different population would
  // mean a different question was being asked.
  it('covers the whole authored family', () => {
    expect(sets.length).toBe(name === 'Practice reassessment sets' ? 42 : 20)
    for (const set of sets) {
      expect(set.choices.some((choice) => choice.id === set.bestId)).toBe(true)
    }
  })

  it('spreads the starting position: offsets are not all zero and take at least two values', () => {
    const offsets = sets.map((set) => choiceOrderOffset(set.key, set.choices.length))
    expect(offsets.some((offset) => offset !== 0)).toBe(true)
    expect(new Set(offsets).size).toBeGreaterThanOrEqual(2)
  })

  it('does not reward "always pick the first option" as displayed', () => {
    const score = share(sets, firstStrategyHits)
    expect(score).toBeLessThanOrEqual(chance(sets) + 0.1)
  })

  it('does not reward "always pick the longest option"', () => {
    const score = share(sets, longestStrategyHits)
    expect(score).toBeLessThanOrEqual(chance(sets) + 0.1)
  })

  it('leaves the best choice uniquely longest in no more than three sets in ten', () => {
    const offenders = sets.filter(bestIsUniquelyLongest).map((set) => set.key)
    const score = offenders.length / sets.length
    if (score > 0.3) {
      // Printed only on failure, so an author knows which labels to rework: trim the
      // rationale-sounding qualifiers out of the best label, or give a distractor equally specific
      // wrong reasoning.
      console.log(
        `${name}: best choice uniquely longest in ${offenders.length}/${sets.length} (${percent(score)}):\n  ${offenders.join('\n  ')}`,
      )
    }
    expect(score).toBeLessThanOrEqual(0.3)
  })
})
