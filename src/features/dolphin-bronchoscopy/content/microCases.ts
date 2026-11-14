import { dolphinPhaseOf } from './pathwayResolver'
import { DOLPHIN_SECTIONS } from './sections'
import type { DolphinMicroCase } from './types'

/**
 * Practice: every section's one-decision cases, gathered once. The landing interleaves them by
 * phase so a learner meets planning, procedure and trouble decisions mixed rather than in blocks.
 */
export const DOLPHIN_MICRO_CASES: readonly DolphinMicroCase[] = DOLPHIN_SECTIONS.flatMap(
  (section) => section.practice,
)

export const dolphinMicroCaseById: ReadonlyMap<string, DolphinMicroCase> = new Map(
  DOLPHIN_MICRO_CASES.map((microCase) => [microCase.id, microCase] as const),
)

/** Round-robin across sections within each phase, phases in pathway order. */
export function interleavedMicroCases(): readonly {
  readonly phase: string
  readonly cases: readonly DolphinMicroCase[]
}[] {
  const byPhase = new Map<string, DolphinMicroCase[][]>()
  for (const section of DOLPHIN_SECTIONS) {
    if (section.practice.length === 0) continue
    const phase = dolphinPhaseOf(section.id).title
    byPhase.set(phase, [...(byPhase.get(phase) ?? []), [...section.practice]])
  }
  return [...byPhase.entries()].map(([phase, lists]) => {
    const cases: DolphinMicroCase[] = []
    for (let round = 0; lists.some((list) => list.length > round); round += 1) {
      for (const list of lists) if (list[round]) cases.push(list[round])
    }
    return { phase, cases }
  })
}

export function nextMicroCase(caseId: string): DolphinMicroCase | null {
  const order = interleavedMicroCases().flatMap((group) => group.cases)
  const index = order.findIndex((microCase) => microCase.id === caseId)
  return index >= 0 ? (order[index + 1] ?? null) : null
}
