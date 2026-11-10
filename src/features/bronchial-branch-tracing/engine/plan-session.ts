import type { CtMark, CtNoduleTarget, CtTrace } from '../content/ct-types'
import type { Vec3 } from '../geometry/coordinates'
import { NATIVE_CT, sliceZ } from '../geometry/native-ct'
import { pairedPath } from '../geometry/paired-scope'
import { arrivalArc, sampleRoute } from '../geometry/route-stations'
import {
  RIMS,
  branchBearings,
  gradeArcs,
  gradeFrame,
  mappedForks,
  ostiumFrame,
  turnBearings,
  turnedRim,
  type Anatomical,
  type FrameLabels,
  type QuarterTurn,
  type Rim,
  type Sector,
} from './arc-map'

/**
 * Planning before the scope moves: the simplified method of Mortimer and Saghaie
 * (J Clin Med 2025;14:8009), worked on the CT from the lesion back.
 *
 *   lesion   find the airway that runs into the lesion;
 *   segment  follow it back and name the segmental bronchus it comes from;
 *   views    turn the CT or open a reconstruction, if that helps (not checked);
 *   frame    stand at that segment's ostium and name the four directions round its circle;
 *   arcs     at each division from there to the lesion, draw each branch as an arc where it
 *            leaves, and mark the one that goes on toward the lesion;
 *   review   the learner's map beside the model's.
 *
 * A trip asks for some or all of these parts. Every check can be shown on request; nothing blocks.
 * Pure: reads only the route geometry.
 */
export type PlanPart = 'lesion' | 'segment' | 'views' | 'frame' | 'arcs'
export const PLAN_PARTS: readonly PlanPart[] = ['lesion', 'segment', 'views', 'frame', 'arcs']
/**
 * The parts of a whole lesion planned outside the lessons. Setting up the views is offered beside
 * the ostium circle there, not as a step of its own: nothing in it is checked, and a step whose
 * only move is "go on" is a click with nothing behind it.
 */
export const ROUTE_PLAN_PARTS: readonly PlanPart[] = ['lesion', 'segment', 'frame', 'arcs']
export type PlanStage = PlanPart | 'review' | 'done'

export interface PlanSpec {
  traceId: string
  targetId: string
  parts: readonly PlanPart[]
  /** The bench demonstrates: "Show me" is the main action at each check. */
  worked?: boolean
  /**
   * The map is on the bench already, drawn from the airway model: the plan opens on its review,
   * so a lesson about the drive starts at the drive. The learner can clear it and draw their own
   * (`draw-own`). Only for a plan that asks for the circle and the arcs and nothing before them.
   */
  prefilled?: boolean
}

export interface PlanStepLog {
  asked: boolean
  misses: number
  shown: boolean
}
export interface DivisionArcs {
  /** Where each drawn branch sits, in the order drawn. */
  placed: Sector[]
  /** The drawn branch marked as going on toward the lesion. */
  leadsOn: number | null
  /** The last check of these arcs did not fit; cleared by any change. */
  checked: boolean
  ok: boolean
  shown: boolean
  misses: number
}
export interface LesionMark {
  slice: number
  pixel: [number, number]
  ok: boolean
  shown: boolean
}
export interface PlanSession {
  version: 1
  traceId: string
  targetId: string
  stage: PlanStage
  lesionMark: LesionMark | null
  /** The segmental bronchus named last, right or not. */
  segmentChoice: string | null
  views: { coronal: boolean; sagittal: boolean }
  frame: FrameLabels
  /** The last check of the frame did not fit; cleared by any change. */
  frameChecked: boolean
  /** How far the learner's circle is turned from the model scope's, once the frame is accepted. */
  frameTurn: QuarterTurn | null
  /** Index into the mapped divisions. */
  division: number
  arcs: DivisionArcs[]
  log: { lesion: PlanStepLog; segment: PlanStepLog; frame: PlanStepLog }
}

export type PlanAction =
  | { type: 'mark-lesion'; mark: CtMark }
  | { type: 'show-lesion' }
  | { type: 'choose-segment'; code: string }
  | { type: 'show-segment' }
  | { type: 'set-view'; view: 'coronal' | 'sagittal'; on: boolean }
  | { type: 'views-done' }
  | { type: 'label-rim'; rim: Rim; word: Anatomical | null }
  | { type: 'check-frame' }
  | { type: 'show-frame' }
  | { type: 'place-arc'; sector: Sector }
  | { type: 'remove-arc'; index: number }
  | { type: 'lead-on'; index: number }
  | { type: 'check-arcs' }
  | { type: 'show-arcs' }
  /** Clear a map the bench drew and draw it oneself, from the circle. */
  | { type: 'draw-own' }
  | { type: 'finish' }
  | { type: 'restart' }

// ── Where the lesion's airway is ──────────────────────────────────────────────────────────────

/** How far back from the end of the route the airway into the lesion is looked for. */
export const LESION_PATH_MM = 20
/** A mark this close to the airway's centre, on its slice, is in that airway. */
export const LESION_REACH_MM = 3
/** Where the bench shows the airway: this far back from the end of the route. */
export const LESION_SHOW_MM = 6

const pixelOf = (p: readonly number[]): [number, number] => [
  (p[0] - NATIVE_CT.origin[0]) / NATIVE_CT.spacing[0],
  (p[1] - NATIVE_CT.origin[1]) / NATIVE_CT.spacing[1],
]
/** Where the route's last `LESION_PATH_MM` crosses an axial slice, in native pixels. */
export function lesionPathCrossings(trace: CtTrace, slice: number): [number, number][] {
  const { points, arcs } = pairedPath(trace)
  const end = arrivalArc(trace)
  const z = sliceZ(slice)
  const out: [number, number][] = []
  for (let i = 1; i < points.length; i++) {
    if (arcs[i] < end - LESION_PATH_MM || arcs[i - 1] > end) continue
    const a = points[i - 1],
      b = points[i]
    if ((z - a[2]) * (z - b[2]) > 0 || a[2] === b[2]) continue
    const f = (z - a[2]) / (b[2] - a[2])
    const pixel = pixelOf([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
    if (!out.some((c) => Math.hypot(c[0] - pixel[0], c[1] - pixel[1]) < 1)) out.push(pixel)
  }
  return out
}

/** The slices the airway into the lesion crosses, first and last. */
export function lesionPathSlices(trace: CtTrace): [number, number] {
  const { points, arcs } = pairedPath(trace)
  const end = arrivalArc(trace)
  const zs = points
    .filter((_, i) => arcs[i] >= end - LESION_PATH_MM && arcs[i] <= end)
    .map((p) => p[2])
  zs.push(sampleRoute(trace, end)[2], sampleRoute(trace, end - LESION_PATH_MM)[2])
  const slice = (z: number) => Math.round((z - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2])
  return [slice(Math.min(...zs)), slice(Math.max(...zs))]
}

export interface LesionVerdict {
  /** The mark is in the airway that runs into the lesion. */
  ok: boolean
  /** The nearest point of that airway, and how far and which way it lies from the mark. */
  nearest: {
    slice: number
    pixel: [number, number]
    mm: number
    leftMm: number
    posteriorMm: number
    /** Positive: toward the head. */
    slices: number
  } | null
}

const markLps = (mark: { slice: number; pixel: readonly number[] }): Vec3 => [
  NATIVE_CT.origin[0] + mark.pixel[0] * NATIVE_CT.spacing[0],
  NATIVE_CT.origin[1] + mark.pixel[1] * NATIVE_CT.spacing[1],
  sliceZ(mark.slice),
]
const sliceOfZ = (z: number) => Math.round((z - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2])

/** The route's last `LESION_PATH_MM`: the airway that runs into the lesion. */
function lesionPath(trace: CtTrace): Vec3[] {
  const { points, arcs } = pairedPath(trace)
  const end = arrivalArc(trace)
  const inside = points.filter((_, i) => arcs[i] > end - LESION_PATH_MM && arcs[i] < end)
  return [sampleRoute(trace, end - LESION_PATH_MM), ...inside, sampleRoute(trace, end)]
}

/**
 * Whether a mark is in the airway that runs into the lesion: within `LESION_REACH_MM` of that
 * airway's centre, in three dimensions. An airway that runs along the slice is in it all the way.
 */
export function lesionVerdict(trace: CtTrace, mark: CtMark): LesionVerdict {
  if (!mark.pixel) return { ok: false, nearest: null }
  const at = markLps({ slice: mark.slice, pixel: mark.pixel })
  const path = lesionPath(trace)
  let best: { point: Vec3; mm: number } | null = null
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i]
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const length2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1e-9
    const f = Math.max(
      0,
      Math.min(
        1,
        ((at[0] - a[0]) * ab[0] + (at[1] - a[1]) * ab[1] + (at[2] - a[2]) * ab[2]) / length2,
      ),
    )
    const point: Vec3 = [a[0] + ab[0] * f, a[1] + ab[1] * f, a[2] + ab[2] * f]
    const mm = Math.hypot(point[0] - at[0], point[1] - at[1], point[2] - at[2])
    if (!best || mm < best.mm) best = { point, mm }
  }
  if (!best) return { ok: false, nearest: null }
  const slice = sliceOfZ(best.point[2])
  return {
    ok: best.mm <= LESION_REACH_MM,
    nearest: {
      slice,
      pixel: pixelOf(best.point),
      mm: best.mm,
      leftMm: best.point[0] - at[0],
      posteriorMm: best.point[1] - at[1],
      slices: slice - mark.slice,
    },
  }
}

/**
 * Where the bench marks the airway into the lesion when asked: `LESION_SHOW_MM` back from the end
 * of the route, on the slice that point lies on.
 */
export function lesionShowPoint(trace: CtTrace): { slice: number; pixel: [number, number] } {
  const point = sampleRoute(trace, arrivalArc(trace) - LESION_SHOW_MM)
  return { slice: sliceOfZ(point[2]), pixel: pixelOf(point) }
}

// ── Which segment ─────────────────────────────────────────────────────────────────────────────

export interface SegmentChoice {
  code: string
  name: string
}
/** The segmental bronchi of each lobe, by the lesion's segment code prefix. */
const LOBE_SEGMENTS: { segments: string[]; bronchi: SegmentChoice[] }[] = [
  {
    segments: ['RS1', 'RS2', 'RS3'],
    bronchi: [
      { code: 'RB1', name: 'apical' },
      { code: 'RB2', name: 'posterior' },
      { code: 'RB3', name: 'anterior' },
    ],
  },
  {
    segments: ['RS4', 'RS5'],
    bronchi: [
      { code: 'RB4', name: 'lateral' },
      { code: 'RB5', name: 'medial' },
    ],
  },
  {
    segments: ['RS6', 'RS7', 'RS8', 'RS9', 'RS10'],
    bronchi: [
      { code: 'RB6', name: 'superior' },
      { code: 'RB7', name: 'medial basal' },
      { code: 'RB8', name: 'anterior basal' },
      { code: 'RB9', name: 'lateral basal' },
      { code: 'RB10', name: 'posterior basal' },
    ],
  },
  {
    segments: ['LS1+2', 'LS3', 'LS4', 'LS5'],
    bronchi: [
      { code: 'LB1+2', name: 'apicoposterior' },
      { code: 'LB3', name: 'anterior' },
      { code: 'LB4', name: 'superior lingular' },
      { code: 'LB5', name: 'inferior lingular' },
    ],
  },
  {
    segments: ['LS6', 'LS7+8', 'LS8', 'LS9', 'LS10'],
    bronchi: [
      { code: 'LB6', name: 'superior' },
      { code: 'LB7+8', name: 'anteromedial basal' },
      { code: 'LB9', name: 'lateral basal' },
      { code: 'LB10', name: 'posterior basal' },
    ],
  },
]
/** The segmental bronchi of the lesion's lobe: the choices when naming its segment. */
export function segmentChoices(target: CtNoduleTarget): SegmentChoice[] {
  const lobe = LOBE_SEGMENTS.find((l) => l.segments.includes(target.segment.code))
  if (!lobe) throw new Error(`No lobe listed for segment ${target.segment.code}`)
  return lobe.bronchi
}

// ── The reducer ───────────────────────────────────────────────────────────────────────────────

const emptyStep = (asked: boolean): PlanStepLog => ({ asked, misses: 0, shown: false })
const emptyArcs = (): DivisionArcs => ({
  placed: [],
  leadsOn: null,
  checked: false,
  ok: false,
  shown: false,
  misses: 0,
})
const EMPTY_FRAME: FrameLabels = { top: null, right: null, bottom: null, left: null }

const nextStage = (spec: PlanSpec, after: PlanStage | null): PlanStage => {
  const order: PlanStage[] = [...PLAN_PARTS, 'review']
  const from = after === null ? 0 : order.indexOf(after) + 1
  for (let i = from; i < order.length; i++) {
    const stage = order[i]
    if (stage === 'review') return spec.parts.includes('arcs') ? 'review' : 'done'
    if (spec.parts.includes(stage as PlanPart)) return stage
  }
  return 'done'
}

/**
 * A place saved under an earlier list of parts: a stage this plan no longer asks for moves on to
 * the next one it does, so no saved place opens on a step that has gone.
 */
export function settlePlan(spec: PlanSpec, state: PlanSession): PlanSession {
  const stage = state.stage
  if (stage === 'review' || stage === 'done' || spec.parts.includes(stage)) return state
  return { ...state, stage: nextStage(spec, stage) }
}

/** The map on the bench is the one the bench drew: the learner has not asked to draw their own. */
export const planPrefilled = (spec: PlanSpec, plan: PlanSession) =>
  Boolean(spec.prefilled) && !plan.log.frame.asked

export function startPlan(trace: CtTrace, target: CtNoduleTarget, spec: PlanSpec): PlanSession {
  const divisions = mappedForks(trace, target)
  const frame = divisions.length ? ostiumFrame(trace, divisions[0]) : null
  if (spec.prefilled && frame && spec.parts.includes('frame') && spec.parts.includes('arcs')) {
    // The model's own circle and arcs, held the way the model scope holds them. Nothing here was
    // asked of the learner, so the log holds nothing asked and the summary leaves it out.
    const rim = turnedRim(frame.rim, 0)
    return {
      version: 1,
      traceId: trace.id,
      targetId: target.id,
      stage: 'review',
      lesionMark: null,
      segmentChoice: null,
      views: { coronal: false, sagittal: false },
      frame: Object.fromEntries(RIMS.map((r) => [r, rim[r].word])) as FrameLabels,
      frameChecked: false,
      frameTurn: 0,
      division: Math.max(0, divisions.length - 1),
      arcs: divisions.map((fork) => {
        const bearings = branchBearings(trace, fork, frame)
        return {
          ...emptyArcs(),
          placed: bearings.map((bearing) => bearing.sector),
          leadsOn: bearings.findIndex((bearing) => bearing.onRoute),
          ok: true,
          shown: true,
        }
      }),
      log: { lesion: emptyStep(false), segment: emptyStep(false), frame: emptyStep(false) },
    }
  }
  return {
    version: 1,
    traceId: trace.id,
    targetId: target.id,
    stage: nextStage(spec, null),
    lesionMark: null,
    segmentChoice: null,
    views: { coronal: false, sagittal: false },
    frame: { ...EMPTY_FRAME },
    frameChecked: false,
    frameTurn: spec.parts.includes('frame') ? null : 0,
    division: 0,
    arcs: divisions.map(emptyArcs),
    log: {
      lesion: emptyStep(spec.parts.includes('lesion')),
      segment: emptyStep(spec.parts.includes('segment')),
      frame: emptyStep(spec.parts.includes('frame')),
    },
  }
}

/** The bearings of a mapped division as the learner's circle is turned. */
export function divisionBearings(
  trace: CtTrace,
  target: CtNoduleTarget,
  division: number,
  turn: QuarterTurn,
) {
  const forks = mappedForks(trace, target)
  const frame = ostiumFrame(trace, forks[0])
  if (!frame || forks[division] === undefined) return []
  return turnBearings(branchBearings(trace, forks[division], frame), turn)
}

export function planReducer(trace: CtTrace, target: CtNoduleTarget, spec: PlanSpec) {
  const forks = mappedForks(trace, target)
  const frame = forks.length ? ostiumFrame(trace, forks[0]) : null
  const optionCount = (division: number) =>
    trace.checkpoints[forks[division]]?.decision?.options.length ?? 0

  return function reduce(state: PlanSession, action: PlanAction): PlanSession {
    const step = (key: 'lesion' | 'segment' | 'frame', change: Partial<PlanStepLog>) => ({
      ...state.log,
      [key]: { ...state.log[key], ...change },
    })
    const arcsAt = (division: number, change: Partial<DivisionArcs>) =>
      state.arcs.map((entry, i) => (i === division ? { ...entry, ...change } : entry))
    /** After the current division is drawn: the next one, or the review. */
    const afterDivision = (arcs: DivisionArcs[]): PlanSession =>
      state.division < forks.length - 1
        ? { ...state, arcs, division: state.division + 1 }
        : { ...state, arcs, stage: nextStage(spec, 'arcs') }

    switch (action.type) {
      case 'restart':
        return startPlan(trace, target, spec)
      case 'mark-lesion': {
        if (state.stage !== 'lesion' || !action.mark.pixel) return state
        const ok = lesionVerdict(trace, action.mark).ok
        const lesionMark = {
          slice: action.mark.slice,
          pixel: action.mark.pixel,
          ok,
          shown: false,
        }
        return ok
          ? { ...state, lesionMark, stage: nextStage(spec, 'lesion') }
          : { ...state, lesionMark, log: step('lesion', { misses: state.log.lesion.misses + 1 }) }
      }
      case 'show-lesion': {
        if (state.stage !== 'lesion') return state
        const point = lesionShowPoint(trace)
        return {
          ...state,
          lesionMark: { ...point, ok: true, shown: true },
          stage: nextStage(spec, 'lesion'),
          log: step('lesion', { shown: true }),
        }
      }
      case 'choose-segment': {
        if (state.stage !== 'segment') return state
        if (action.code === target.segment.bronchusCode)
          return { ...state, segmentChoice: action.code, stage: nextStage(spec, 'segment') }
        if (state.segmentChoice === action.code) return state
        return {
          ...state,
          segmentChoice: action.code,
          log: step('segment', { misses: state.log.segment.misses + 1 }),
        }
      }
      case 'show-segment': {
        if (state.stage !== 'segment') return state
        return {
          ...state,
          segmentChoice: target.segment.bronchusCode,
          stage: nextStage(spec, 'segment'),
          log: step('segment', { shown: true }),
        }
      }
      case 'set-view':
        return state.views[action.view] === action.on
          ? state
          : { ...state, views: { ...state.views, [action.view]: action.on } }
      case 'views-done':
        return state.stage === 'views' ? { ...state, stage: nextStage(spec, 'views') } : state
      case 'label-rim': {
        if (state.stage !== 'frame' || state.frame[action.rim] === action.word) return state
        return {
          ...state,
          frame: { ...state.frame, [action.rim]: action.word },
          frameChecked: false,
        }
      }
      case 'check-frame': {
        if (state.stage !== 'frame' || !frame) return state
        const grade = gradeFrame(frame, state.frame)
        if (!grade.complete) return state
        if (grade.ok)
          return {
            ...state,
            frameTurn: grade.turn,
            frameChecked: false,
            stage: nextStage(spec, 'frame'),
          }
        if (state.frameChecked) return state
        return {
          ...state,
          frameChecked: true,
          log: step('frame', { misses: state.log.frame.misses + 1 }),
        }
      }
      case 'show-frame': {
        if (state.stage !== 'frame' || !frame) return state
        const rim = turnedRim(frame.rim, 0)
        return {
          ...state,
          frame: Object.fromEntries(RIMS.map((r) => [r, rim[r].word])) as FrameLabels,
          frameTurn: 0,
          frameChecked: false,
          stage: nextStage(spec, 'frame'),
          log: step('frame', { shown: true }),
        }
      }
      case 'place-arc': {
        if (state.stage !== 'arcs') return state
        const here = state.arcs[state.division]
        if (here.placed.length >= optionCount(state.division)) return state
        if (here.placed.includes(action.sector)) return state
        return {
          ...state,
          arcs: arcsAt(state.division, { placed: [...here.placed, action.sector], checked: false }),
        }
      }
      case 'remove-arc': {
        if (state.stage !== 'arcs') return state
        const here = state.arcs[state.division]
        if (action.index < 0 || action.index >= here.placed.length) return state
        const leadsOn =
          here.leadsOn === null || here.leadsOn === action.index
            ? null
            : here.leadsOn > action.index
              ? here.leadsOn - 1
              : here.leadsOn
        return {
          ...state,
          arcs: arcsAt(state.division, {
            placed: here.placed.filter((_, i) => i !== action.index),
            leadsOn,
            checked: false,
          }),
        }
      }
      case 'lead-on': {
        if (state.stage !== 'arcs') return state
        const here = state.arcs[state.division]
        if (action.index < 0 || action.index >= here.placed.length || here.leadsOn === action.index)
          return state
        return { ...state, arcs: arcsAt(state.division, { leadsOn: action.index, checked: false }) }
      }
      case 'check-arcs': {
        if (state.stage !== 'arcs') return state
        const here = state.arcs[state.division]
        const bearings = divisionBearings(trace, target, state.division, state.frameTurn ?? 0)
        if (here.placed.length !== bearings.length || here.leadsOn === null) return state
        const grade = gradeArcs(bearings, here.placed, here.leadsOn)
        if (grade.ok) return afterDivision(arcsAt(state.division, { ok: true, checked: false }))
        if (here.checked) return state
        return {
          ...state,
          arcs: arcsAt(state.division, { checked: true, misses: here.misses + 1 }),
        }
      }
      case 'show-arcs': {
        if (state.stage !== 'arcs') return state
        const bearings = divisionBearings(trace, target, state.division, state.frameTurn ?? 0)
        return afterDivision(
          arcsAt(state.division, {
            placed: bearings.map((bearing) => bearing.sector),
            leadsOn: bearings.findIndex((bearing) => bearing.onRoute),
            ok: true,
            shown: true,
            checked: false,
          }),
        )
      }
      case 'draw-own':
        return planPrefilled(spec, state)
          ? startPlan(trace, target, { ...spec, prefilled: false })
          : state
      case 'finish':
        return state.stage === 'review' ? { ...state, stage: 'done' } : state
    }
  }
}

/** The ostium frame the plan's map is drawn in. */
export function planFrame(trace: CtTrace, target: CtNoduleTarget) {
  const forks = mappedForks(trace, target)
  return forks.length ? ostiumFrame(trace, forks[0]) : null
}

export interface PlanSummary {
  lesion: PlanStepLog
  segment: PlanStepLog
  frame: PlanStepLog
  /** Divisions drawn, and how many of them fitted at the first check without being shown. */
  arcs: { asked: number; firstTry: number }
}
export function summarizePlan(spec: PlanSpec, plan: PlanSession): PlanSummary {
  // A map the bench drew was not asked of the learner.
  const drawn = spec.parts.includes('arcs') && !planPrefilled(spec, plan)
  const asked = drawn ? plan.arcs.length : 0
  return {
    lesion: plan.log.lesion,
    segment: plan.log.segment,
    frame: plan.log.frame,
    arcs: {
      asked,
      firstTry: drawn ? plan.arcs.filter((a) => a.ok && !a.shown && a.misses === 0).length : 0,
    },
  }
}
