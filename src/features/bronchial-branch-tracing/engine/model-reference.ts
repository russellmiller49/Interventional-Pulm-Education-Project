import type { CtCheckpoint, CtNoduleTarget, CtTrace } from '../content/ct-types'

/**
 * What the supplied model already states about a division or a route, so a recorded course,
 * continuation or airway–nodule description can be held beside it.
 *
 * Everything here is read straight from the source export: checkpoint levels, the source
 * direction labels, the route's own reference continuation and the target's declared approach
 * branch. Nothing is derived into a correct answer, and none of it is a reviewed anatomical
 * claim: the module has no reviewed course label, so a recorded description is never matched
 * against one automatically.
 */

export type LevelRelation = 'cranial' | 'caudal' | 'same level'

/** Higher slice indices are more cranial in this volume (+z superior, 0.5 mm spacing). */
export const levelRelation = (from: number, to: number): LevelRelation =>
  to > from ? 'cranial' : to < from ? 'caudal' : 'same level'

export interface DaughterLevel {
  code: string
  label: string
  /** The source export's own direction label for this daughter. */
  direction: string
  slice: number
  relation: LevelRelation
  /** Whole slices between the parent point and this daughter's response plane. */
  slices: number
}
/**
 * How a response plane sits relative to the parent point, in words. In-plane divisions such as
 * RML → RB4/RB5 put both daughters on the parent's own level, where a slice count says nothing.
 */
export const levelPhrase = (d: { slices: number; relation: LevelRelation }) =>
  d.relation === 'same level' || d.slices === 0
    ? 'on the same level as the parent point'
    : `${d.slices} ${d.slices === 1 ? 'slice' : 'slices'} ${d.relation} of the parent point`

export interface DivisionLevels {
  parentCode: string
  parentSlice: number
  daughters: DaughterLevel[]
  /** Both daughters leave the parent level in the same direction. */
  sameDirection: boolean
}

export function divisionLevels(checkpoint: CtCheckpoint): DivisionLevels | null {
  const decision = checkpoint.decision
  if (!decision) return null
  const parentSlice = decision.parent.slice
  const daughters = decision.options.map((option, i) => ({
    code: option.airway.code,
    label: `${String.fromCharCode(65 + i)} · ${option.airway.code}`,
    direction: option.direction,
    slice: option.slice,
    relation: levelRelation(parentSlice, option.slice),
    slices: Math.abs(option.slice - parentSlice),
  }))
  return {
    parentCode: decision.parent.airway.code,
    parentSlice,
    daughters,
    sameDirection: new Set(daughters.map((d) => d.relation)).size === 1,
  }
}

export interface ContinuationReference {
  /** The daughter the source reference route continues through. */
  code: string
  label: string
  direction: string
  slice: number
  relation: LevelRelation
  /** Whole slices between the parent point and this daughter's response plane. */
  slices: number
  others: DaughterLevel[]
  /** More than one daughter of this division carries the same airway name. */
  sharedName: boolean
}

export function continuationReference(checkpoint: CtCheckpoint): ContinuationReference | null {
  const decision = checkpoint.decision
  const levels = divisionLevels(checkpoint)
  if (!decision || !levels) return null
  const index = decision.options.findIndex((o) => o.sourceEdgeId === checkpoint.sourceEdgeId)
  if (index < 0) return null
  const model = levels.daughters[index]
  return {
    ...model,
    others: levels.daughters.filter((_, i) => i !== index),
    sharedName:
      decision.options.filter((o) => o.airway.code === decision.options[index].airway.code).length >
      1,
  }
}

export interface RouteLevels {
  levels: { code: string; slice: number }[]
  /** Changes of cranial–caudal direction between consecutive checkpoints. */
  reversals: number
  net: LevelRelation
}

export function routeLevels(trace: CtTrace): RouteLevels {
  const levels = [
    { code: trace.anchor.airway.code, slice: trace.anchor.slice },
    ...trace.checkpoints.map((p) => ({ code: p.airway.code, slice: p.slice })),
  ]
  let reversals = 0
  let previous: LevelRelation | null = null
  for (let i = 1; i < levels.length; i++) {
    const step = levelRelation(levels[i - 1].slice, levels[i].slice)
    if (step === 'same level') continue
    if (previous && step !== previous) reversals++
    previous = step
  }
  return {
    levels,
    reversals,
    net: levelRelation(levels[0].slice, levels[levels.length - 1].slice),
  }
}

export interface ApproachReference {
  segmentCode: string
  segmentName: string
  /** The branch the source places the simulated nodule at the end of. */
  approachCode: string
  /** The airway of this route's own distal checkpoint. */
  distalCode: string
  /** The route's distal checkpoint is the declared approach branch. */
  matchesRoute: boolean
}

export function approachReference(trace: CtTrace, target: CtNoduleTarget): ApproachReference {
  const distal = trace.checkpoints[trace.checkpoints.length - 1]
  return {
    segmentCode: target.segment.code,
    segmentName: target.segment.name,
    approachCode: target.approachCode,
    distalCode: distal.airway.code,
    matchesRoute: distal.airway.code === target.approachCode,
  }
}

export interface DivisionCourse {
  parentCode: string
  parentSlice: number
  /** The model node's plane: round((node z − origin z) / 0.5), the exporter's own slice rule. */
  nodeSlice: number
  /** How the parent runs from its point to the node. */
  approach: LevelRelation
  daughters: {
    label: string
    code: string
    slice: number
    fromNode: LevelRelation
    slices: number
  }[]
  /** Parent point, node and every response plane lie within one slice of each other. */
  inPlane: boolean
  /** At least one daughter leaves the node in the direction opposite to the approach. */
  reverses: boolean
}

/**
 * The levels a division's source points already have, relative to the model node, so a cranial
 * course or a change of direction can be stated before the learner marks (BBTF-07). Read from the
 * unchanged export; no anatomical claim is added and nothing is judged.
 */
export function divisionCourse(
  checkpoint: CtCheckpoint,
  sliceOf: (z: number) => number,
  labelFor: (index: number) => string,
): DivisionCourse | null {
  const decision = checkpoint.decision
  if (!decision) return null
  const nodeSlice = sliceOf(decision.junctionLps[2])
  const parentSlice = decision.parent.slice
  const near = (a: number, b: number) => Math.abs(a - b) <= 1
  const approach = near(parentSlice, nodeSlice)
    ? 'same level'
    : levelRelation(parentSlice, nodeSlice)
  const daughters = decision.options.map((option, i) => ({
    label: labelFor(i),
    code: option.airway.code,
    slice: option.slice,
    fromNode: near(nodeSlice, option.slice)
      ? ('same level' as const)
      : levelRelation(nodeSlice, option.slice),
    slices: Math.abs(option.slice - nodeSlice),
  }))
  return {
    parentCode: decision.parent.airway.code,
    parentSlice,
    nodeSlice,
    approach,
    daughters,
    inPlane: near(parentSlice, nodeSlice) && daughters.every((d) => d.fromNode === 'same level'),
    reverses:
      approach !== 'same level' &&
      daughters.some((d) => d.fromNode !== 'same level' && d.fromNode !== approach),
  }
}
