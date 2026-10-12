import { bronchMicroCasesInPathwayOrder, type BronchMicroCase } from './microCases'

/**
 * Mixed practice sets (rewrite plan, practice and assessment). Every practice case, the sections'
 * own and the vignettes, dealt into fixed sets of ten that mix sections and topics. The sets are
 * the same on every visit: nothing is saved, so nothing can be drawn at random and kept.
 *
 * The sections' own cases are dealt one from each section in turn, and the vignettes one from
 * each topic in turn. The two streams then alternate, so a set is half of each, draws on many
 * sections and topics, and never puts two cases from one of them side by side.
 */
export const PRACTICE_SET_SIZE = 10

function groupOf(microCase: BronchMicroCase): string {
  return microCase.vignetteTopic ? `topic:${microCase.vignetteTopic}` : microCase.sectionId
}

function deal(cases: readonly BronchMicroCase[]): readonly BronchMicroCase[] {
  const queues = new Map<string, BronchMicroCase[]>()
  for (const microCase of cases) {
    const group = groupOf(microCase)
    queues.set(group, [...(queues.get(group) ?? []), microCase])
  }
  // The largest groups lead each round, so the small ones are spread out and not used up at once.
  const order = [...queues.keys()].sort(
    (left, right) => queues.get(right)!.length - queues.get(left)!.length,
  )
  const dealt: BronchMicroCase[] = []
  let round = 0
  while (dealt.length < cases.length) {
    // Each round starts one group later, so no group always opens a set.
    for (let offset = 0; offset < order.length; offset += 1) {
      const next = queues.get(order[(offset + round) % order.length])!.shift()
      if (next) dealt.push(next)
    }
    round += 1
  }
  return dealt
}

/** A section's own case, then a vignette, and so on: each set is half of each. */
function alternate(
  first: readonly BronchMicroCase[],
  second: readonly BronchMicroCase[],
): readonly BronchMicroCase[] {
  return Array.from({ length: Math.max(first.length, second.length) }, (_, index) => [
    ...(first[index] ? [first[index]] : []),
    ...(second[index] ? [second[index]] : []),
  ]).flat()
}

const EVERY_CASE = bronchMicroCasesInPathwayOrder()
const DEALT = alternate(
  deal(EVERY_CASE.filter((entry) => entry.vignetteTopic === undefined)),
  deal(EVERY_CASE.filter((entry) => entry.vignetteTopic !== undefined)),
)

/** The sets, in order. The last one holds what is left over. */
export const PRACTICE_SETS: readonly (readonly BronchMicroCase[])[] = Array.from(
  { length: Math.ceil(DEALT.length / PRACTICE_SET_SIZE) },
  (_, index) => DEALT.slice(index * PRACTICE_SET_SIZE, (index + 1) * PRACTICE_SET_SIZE),
)

/** A set by its number, counting from 1. */
export function practiceSet(number: number): readonly BronchMicroCase[] | null {
  return PRACTICE_SETS[number - 1] ?? null
}

/** The set a case is dealt into, counting from 1. */
export function practiceSetOf(caseId: string): number | null {
  const index = PRACTICE_SETS.findIndex((cases) => cases.some((entry) => entry.id === caseId))
  return index < 0 ? null : index + 1
}

/** What is wrong with the sets. Empty when they are sound. */
export function practiceSetErrors(): readonly string[] {
  const errors: string[] = []
  const all = bronchMicroCasesInPathwayOrder()
  const dealtIds = PRACTICE_SETS.flat().map((entry) => entry.id)
  if (dealtIds.length !== all.length || new Set(dealtIds).size !== all.length)
    errors.push('The practice sets do not hold every case exactly once.')
  PRACTICE_SETS.forEach((cases, index) => {
    const where = `practice set ${index + 1}`
    const full = index < PRACTICE_SETS.length - 1
    if (full && cases.length !== PRACTICE_SET_SIZE)
      errors.push(`${where} holds ${cases.length} cases; ${PRACTICE_SET_SIZE} each.`)
    cases.forEach((entry, position) => {
      if (position > 0 && groupOf(cases[position - 1]) === groupOf(entry))
        errors.push(`${where} puts two cases from one section or topic side by side.`)
    })
    if (full && new Set(cases.map(groupOf)).size < 6)
      errors.push(`${where} draws on fewer than six sections and topics.`)
  })
  return errors
}
