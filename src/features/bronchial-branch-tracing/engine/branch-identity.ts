import type { CtCheckpoint } from '../content/ct-types'

/**
 * Learner-facing identities for one division. The stored data keeps its own labels ("A · RMSB"
 * in an exercise's answer points, the source `label` and `code` on each option); nothing here
 * rewrites them, and no new anatomical name or a/b/c suffix is invented. Where the source repeats
 * a name — RB3a → RB3a / RB3a, LB6 → LB6 / LB6, RB4 → RB4 / RB4a — the neutral role (Parent,
 * Daughter A, Daughter B) carries the identity and the source's own direction label tells the
 * daughters apart.
 */
export const letterFor = (index: number) => String.fromCharCode(65 + index)

export interface ParentIdentity {
  role: 'Parent'
  code: string
  name: string
  slice: number
  sourceEdgeId: number
  /** "Parent · Trachea" */
  display: string
}
export interface DaughterIdentity {
  index: number
  letter: string
  /** "Daughter A" */
  role: string
  code: string
  name: string
  /** The source export's own direction label for this daughter, e.g. "More cranial". */
  direction: string
  slice: number
  sourceEdgeId: number
  /** This daughter's source code is also the parent's or a sibling's. */
  repeatedName: boolean
  /** "Daughter A · LB6 · more caudal" when the name repeats, otherwise "Daughter A · LB6". */
  display: string
  /** The stored answer-point form, "A · LB6"; kept for data continuity, never rewritten. */
  storedLabel: string
}
export interface DivisionIdentities {
  parent: ParentIdentity
  daughters: DaughterIdentity[]
  anyRepeatedName: boolean
  /** A daughter carries a subsegmental a/b/c letter, which this source assigns provisionally. */
  provisionalSuffix: boolean
}

const SUBSEGMENT_SUFFIX = /\d[a-c]$/

export function divisionIdentities(checkpoint: CtCheckpoint): DivisionIdentities | null {
  const decision = checkpoint.decision
  if (!decision) return null
  const parentCode = decision.parent.airway.code
  const codes = decision.options.map((option) => option.airway.code)
  const daughters = decision.options.map((option, index): DaughterIdentity => {
    const letter = letterFor(index)
    const code = option.airway.code
    const repeatedName = code === parentCode || codes.filter((other) => other === code).length > 1
    return {
      index,
      letter,
      role: `Daughter ${letter}`,
      code,
      name: option.airway.name,
      direction: option.direction,
      slice: option.slice,
      sourceEdgeId: option.sourceEdgeId,
      repeatedName,
      display: repeatedName
        ? `Daughter ${letter} · ${code} · ${option.direction.toLowerCase()}`
        : `Daughter ${letter} · ${code}`,
      storedLabel: `${letter} · ${code}`,
    }
  })
  return {
    parent: {
      role: 'Parent',
      code: parentCode,
      name: decision.parent.airway.name,
      slice: decision.parent.slice,
      sourceEdgeId: decision.parent.sourceEdgeId,
      display: `Parent · ${parentCode}`,
    },
    daughters,
    anyRepeatedName: daughters.some((d) => d.repeatedName),
    provisionalSuffix: daughters.some((d) => SUBSEGMENT_SUFFIX.test(d.code)),
  }
}

/** The learner-facing form of a stored answer-point label, by slot. */
export function displayAnswerLabel(checkpoint: CtCheckpoint, index: number, stored: string) {
  return divisionIdentities(checkpoint)?.daughters[index]?.display ?? stored
}

/** Sentence-level statement of what this source calls each daughter, marked as the source's. */
export function sourceNamingNote(identities: DivisionIdentities): string {
  const names = identities.daughters
    .map((d) => `${d.role} is labelled ${d.code} in this source (${d.direction.toLowerCase()})`)
    .join('; ')
  const suffix = identities.provisionalSuffix
    ? ' The a/b letters follow this source’s labelling and are pending nomenclature review: they are shown so you can follow each lumen, not asked.'
    : ''
  return `${names}.${suffix}`
}
