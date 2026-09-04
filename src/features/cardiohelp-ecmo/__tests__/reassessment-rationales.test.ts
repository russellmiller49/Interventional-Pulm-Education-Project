import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { clinicalPracticeScenarios } from '../content/clinicalCases'
import {
  clinicalPracticeSupportByScenarioId,
  resolveScenarioReassessment,
} from '../content/practiceSupport'
import { cardiohelpScenarios } from '../content/scenarios'
import type { ReassessmentQuestion } from '../engine/types'

/**
 * The reassessment rationales: what each option's after-the-reveal explanation may and may not be.
 *
 * Every reassessment option in a Practice case carries a rationale that the debrief renders beside
 * the option the learner recorded and the one the model expected. Because it is shown only after
 * the reveal it may name the diagnosis and the mechanism, but it is still learner copy, so it may
 * not grade ("the right answer"), may not invent a threshold (no digits the label did not already
 * carry), and may not teach an air-event resumption order. And because a learner who opens the
 * debrief of one case can carry what they noticed into the next, the modeled option's rationale
 * may not be systematically the longest of its set — the same length cue the option labels are
 * held to, applied one layer down.
 *
 * The fallback sets that `resolveScenarioReassessment` builds for scenarios without an authored
 * reassessment carry generic rationales and are held to the same copy rules.
 */

const DOMAINS = ['device', 'circuit', 'patient'] as const

interface RationaleSet {
  readonly key: string
  readonly question: ReassessmentQuestion
}

const authoredSets: readonly RationaleSet[] = Object.entries(
  clinicalPracticeSupportByScenarioId,
).flatMap(([scenarioId, support]) =>
  DOMAINS.map((domain) => ({
    key: `${scenarioId}-${domain}`,
    question: support.reassessment[domain],
  })),
)

const fallbackScenarios = cardiohelpScenarios.filter((scenario) => !scenario.reassessment)

const fallbackSets: readonly RationaleSet[] = fallbackScenarios.flatMap((scenario) => {
  const reassessment = resolveScenarioReassessment(scenario)
  return DOMAINS.map((domain) => ({
    key: `${scenario.id}-${domain}`,
    question: reassessment[domain],
  }))
})

/** Grading vocabulary, matched as a substring of the lower-cased rationale. */
const BANNED_TERMS: readonly string[] = [
  'score',
  'points',
  'grade',
  'pass',
  'fail',
  'correct',
  'incorrect',
  'wrong',
  'mastery',
  'exam',
  'test',
  'quiz',
  'assessment',
  'percent',
  '%',
  'competency',
]

/**
 * Phrasings that teach an air-event resumption order or overclaim what was verified. The first
 * group is the set this increment retired from the case copy; the second mirrors the module-wide
 * resumption contract so a rationale cannot reintroduce what it bans.
 */
const RESUMPTION_PATTERNS: readonly RegExp[] = [
  /reopened in order/i,
  /resume support in order/i,
  /ordered unclamping/i,
  /bounded, ordered sequence/i,
  /re-establish (VA )?support in the correct order/i,
  /verif(y|ied) backup/i,
  /\blast step\b/i,
  /deliberate last step/i,
  /one bounded sequence for consistency/i,
  /resume in order/i,
  /ordered resumption/i,
  /verified (manufacturer|protocol|resumption)/i,
  /on the verified/i,
  /bring the circuit back and reset/i,
  /unclamp in order/i,
  /reset(?:ting)? (?:is|comes|falls) (?:the )?last\b/i,
  /open (?:the )?drainage(?: limb)?,? then (?:the )?return/i,
]

const MAX_RATIONALE_LENGTH = 220

function rationaleOf(set: RationaleSet, optionId: string): string {
  const option = set.question.options.find((item) => item.id === optionId)
  if (!option) throw new Error(`${set.key}: option ${optionId} is not in the set`)
  if (!option.rationale) throw new Error(`${set.key}: option ${optionId} has no rationale`)
  return option.rationale
}

function sentenceCount(text: string): number {
  return text.split(/[.!?](?:\s|$)/).filter((part) => part.trim().length > 0).length
}

function digitsIn(text: string): ReadonlySet<string> {
  return new Set(text.match(/[0-9]/g) ?? [])
}

function bestRationaleIsUniquelyLongest(set: RationaleSet): boolean {
  const best = rationaleOf(set, set.question.correctOptionId)
  return set.question.options.every(
    (option) =>
      option.id === set.question.correctOptionId ||
      rationaleOf(set, option.id).length < best.length,
  )
}

/** "Always pick the option with the longest rationale"; a tie that includes the best counts as a hit. */
function longestRationaleStrategyHits(set: RationaleSet): boolean {
  const longest = Math.max(
    ...set.question.options.map((option) => rationaleOf(set, option.id).length),
  )
  return rationaleOf(set, set.question.correctOptionId).length === longest
}

function chance(sets: readonly RationaleSet[]): number {
  return sets.reduce((total, set) => total + 1 / set.question.options.length, 0) / sets.length
}

function expectCopyRules(set: RationaleSet): void {
  for (const option of set.question.options) {
    const rationale = rationaleOf(set, option.id)
    expect(rationale.trim()).toBe(rationale)
    expect(rationale.length).toBeGreaterThan(0)
    expect(rationale.length).toBeLessThanOrEqual(MAX_RATIONALE_LENGTH)
    expect(sentenceCount(rationale)).toBeLessThanOrEqual(2)
    expect(rationale).not.toBe(option.label)

    const lower = rationale.toLowerCase()
    for (const term of BANNED_TERMS) {
      expect(`${set.key}/${option.id}: ${lower.includes(term) ? term : 'clean'}`).toBe(
        `${set.key}/${option.id}: clean`,
      )
    }
    for (const pattern of RESUMPTION_PATTERNS) {
      const match = rationale.match(pattern)
      expect(`${set.key}/${option.id}: ${match?.[0] ?? 'clean'}`).toBe(
        `${set.key}/${option.id}: clean`,
      )
    }

    const allowed = digitsIn(option.label)
    for (const digit of digitsIn(rationale)) {
      expect(
        `${set.key}/${option.id}: digit ${digit} ${allowed.has(digit) ? 'in label' : 'invented'}`,
      ).toBe(`${set.key}/${option.id}: digit ${digit} in label`)
    }
  }
}

describe('authored reassessment rationales', () => {
  it('cover every option of every authored set', () => {
    // The population is a contract: a different count means a different question is being asked.
    expect(authoredSets).toHaveLength(42)
    for (const set of authoredSets) {
      expect(set.question.options).toHaveLength(3)
      for (const option of set.question.options) {
        expect(typeof option.rationale).toBe('string')
      }
    }
  })

  it('reach the debrief unchanged through resolveScenarioReassessment', () => {
    for (const scenario of clinicalPracticeScenarios) {
      expect(scenario.reassessment).toBeDefined()
      expect(resolveScenarioReassessment(scenario)).toBe(scenario.reassessment)
    }
  })

  it.each(authoredSets.map((set) => [set.key, set] as const))(
    '%s: one or two sentences, no grading vocabulary, no invented digit, no resumption order',
    (_key, set) => {
      expectCopyRules(set)
    },
  )

  it('gives each option in a set its own rationale', () => {
    for (const set of authoredSets) {
      const rationales = set.question.options.map((option) => rationaleOf(set, option.id))
      expect(new Set(rationales).size).toBe(rationales.length)
    }
  })

  it('leaves the modeled option uniquely longest in no more than four sets in ten', () => {
    const offenders = authoredSets.filter(bestRationaleIsUniquelyLongest).map((set) => set.key)
    const score = offenders.length / authoredSets.length
    if (score > 0.4) {
      // Printed only on failure so an author knows which sets to rework: shorten the modeled
      // option's rationale or give a distractor an equally specific account of its misconception.
      console.log(
        `modeled rationale uniquely longest in ${offenders.length}/${authoredSets.length}:\n  ${offenders.join('\n  ')}`,
      )
    }
    expect(score).toBeLessThanOrEqual(0.4)
  })

  it('does not reward "always pick the longest rationale"', () => {
    const hits = authoredSets.filter(longestRationaleStrategyHits).length / authoredSets.length
    expect(hits).toBeLessThanOrEqual(chance(authoredSets) + 0.1)
  })
})

describe('fallback reassessment rationales', () => {
  it('exist for every scenario without an authored reassessment', () => {
    expect(fallbackScenarios.length).toBeGreaterThan(0)
    expect(fallbackSets).toHaveLength(fallbackScenarios.length * DOMAINS.length)
    for (const set of fallbackSets) {
      expect(set.question.options).toHaveLength(3)
      for (const option of set.question.options) {
        expect(typeof option.rationale).toBe('string')
      }
    }
  })

  it.each(fallbackSets.map((set) => [set.key, set] as const))(
    '%s: one or two sentences, no grading vocabulary, no invented digit, no resumption order',
    (_key, set) => {
      expectCopyRules(set)
    },
  )
})

describe('the practice-support source', () => {
  it('carries no resumption-order phrasing anywhere, labels included', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/cardiohelp-ecmo/content/practiceSupport.ts'),
      'utf8',
    )
    for (const pattern of RESUMPTION_PATTERNS) {
      const match = source.match(pattern)
      expect(`practiceSupport.ts: ${match?.[0] ?? 'clean'}`).toBe('practiceSupport.ts: clean')
    }
  })
})
