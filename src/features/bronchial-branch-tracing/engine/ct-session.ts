import type {
  Course,
  CtBranchChoice,
  CtMark,
  CtResponse,
  CtTrace,
  TargetRelation,
} from '../content/ct-types'
import { COURSE_OPTIONS, TARGET_RELATION_OPTIONS } from '../content/ct-types'
import { STANDARD_ORIENTATION, validOrientation, type CtOrientation } from '../geometry/orientation'

export interface CtSession {
  junctionHistory: Record<
    string,
    {
      mark: CtMark
      branch: CtBranchChoice | null
      /** Legacy drafts only; self-paced responses record neither hints nor support. */
      hints?: number
      orientation?: CtOrientation
      support?: 'coached' | 'after-comparison'
    }[]
  >
  targetViewed: Record<string, boolean>
  step: number
  active: number
  /** Furthest junction opened on the marking trace, recorded or not. */
  reached: number
  marks: (CtMark | null)[]
  branches: (CtBranchChoice | null)[]
  recorded: boolean[]
  course: Course | ''
  targetRelation: TargetRelation | ''
  hints: number
  prediction: CtResponse | null
  transfer: CtResponse | null
  complete: boolean
  orientation: CtOrientation
  orientationAttempts: CtOrientation[]
  alignment: CtOrientation | null
}
export const emptyTraceWork = (trace?: CtTrace) => ({
  marks: (trace?.checkpoints ?? []).map((): CtMark | null => null),
  branches: (trace?.checkpoints ?? []).map((): CtBranchChoice | null => null),
  recorded: (trace?.checkpoints ?? []).map(() => false),
})
export const emptyCtSession = (trace?: CtTrace): CtSession => ({
  junctionHistory: {},
  targetViewed: {},
  step: 0,
  active: 0,
  reached: 0,
  ...emptyTraceWork(trace),
  course: '',
  targetRelation: '',
  hints: 0,
  prediction: null,
  transfer: null,
  complete: false,
  orientation: STANDARD_ORIENTATION,
  orientationAttempts: [],
  alignment: null,
})
export type CtAction =
  | { type: 'orientation'; value: CtOrientation }
  | { type: 'check-orientation' }
  | { type: 'mark'; index: number; mark: CtMark }
  | { type: 'branch'; index: number; value: CtBranchChoice }
  | { type: 'record-junction' }
  | { type: 'retry-junction' }
  | { type: 'target-inspected' }
  | { type: 'active'; index: number }
  | { type: 'course'; value: Course }
  | { type: 'target-relation'; value: TargetRelation }
  | { type: 'hint' }
  | { type: 'advance' }
  | { type: 'restart' }
  /** Open the next junction without recording this one. */
  | { type: 'skip-junction' }
  /** Leave the current trace or description step without recording an interpretation. */
  | { type: 'continue-without-recording' }
export const marksComplete = (marks: (CtMark | null)[], trace: CtTrace) =>
  marks.length === trace.checkpoints.length && marks.every(Boolean)
export const lastUnlocked = (recorded: boolean[]) => {
  const next = recorded.findIndex((value) => !value)
  return next < 0 ? recorded.length - 1 : next
}
/** Junctions the learner can open: recorded ones, the next unrecorded one, and any reached by continuing. */
export const reachableThrough = (recorded: boolean[], reached: number) =>
  Math.min(Math.max(lastUnlocked(recorded), reached), Math.max(recorded.length - 1, 0))
/** Reference marks shown on the CT: every junction recorded or explicitly revealed, and those before it. */
export function referenceIndex(recorded: boolean[], shown: ReadonlySet<number>) {
  let through = -1
  recorded.forEach((value, i) => {
    if (value || shown.has(i)) through = i
  })
  return through
}
export function validCtMark(mark: CtMark, trace: CtTrace, index: number) {
  return (
    Boolean(trace.checkpoints[index]) &&
    mark.slice === trace.checkpoints[index].slice &&
    (mark.pixel === null ||
      (mark.pixel.length === 2 &&
        mark.pixel.every((p) => Number.isFinite(p) && p >= 0 && p <= 511)))
  )
}
export function validBranch(trace: CtTrace, index: number, choice: CtBranchChoice | null) {
  const decision = trace.checkpoints[index]?.decision
  return decision
    ? choice === 'unresolved' || decision.options.some((o) => o.sourceEdgeId === choice)
    : choice === null
}
export function junctionReady(
  trace: CtTrace,
  index: number,
  marks: (CtMark | null)[],
  branches: (CtBranchChoice | null)[],
) {
  return Boolean(
    marks[index] &&
    validCtMark(marks[index]!, trace, index) &&
    validBranch(trace, index, branches[index]),
  )
}
export function traceComplete(
  trace: CtTrace,
  work: Pick<CtSession, 'marks' | 'branches' | 'recorded'>,
) {
  return (
    marksComplete(work.marks, trace) &&
    work.branches.length === trace.checkpoints.length &&
    work.recorded.length === trace.checkpoints.length &&
    work.recorded.every((v, i) => v && junctionReady(trace, i, work.marks, work.branches))
  )
}
export function ctSessionReducer(prediction: CtTrace, transfer: CtTrace, example = prediction) {
  return (s: CtSession, action: CtAction): CtSession => {
    if (action.type === 'restart')
      return { ...emptyCtSession(prediction), junctionHistory: s.junctionHistory }
    if (action.type === 'orientation' && validOrientation(action.value))
      return { ...s, orientation: action.value }
    const trace = s.step === 0 ? example : s.step === 5 ? transfer : prediction
    const canMark = !s.complete && (s.step === 1 || (s.step === 5 && !s.transfer))
    if (
      action.type === 'active' &&
      Number.isInteger(action.index) &&
      action.index >= 0 &&
      action.index < trace.checkpoints.length &&
      (!canMark || (s.alignment && action.index <= reachableThrough(s.recorded, s.reached)))
    )
      return { ...s, active: action.index }
    if (action.type === 'target-inspected')
      return s.targetViewed[trace.id]
        ? s
        : { ...s, targetViewed: { ...s.targetViewed, [trace.id]: true } }
    if (s.complete) return s
    if (action.type === 'check-orientation' && canMark && !s.alignment)
      return {
        ...s,
        orientationAttempts: [...s.orientationAttempts, { ...s.orientation }],
        alignment: { ...s.orientation },
      }
    if (action.type === 'retry-junction' && canMark && s.recorded[s.active])
      return {
        ...s,
        marks: s.marks.map((v, i) => (i === s.active ? null : v)),
        branches: s.branches.map((v, i) => (i === s.active ? null : v)),
        recorded: s.recorded.map((v, i) => (i === s.active ? false : v)),
      }
    if (
      action.type === 'skip-junction' &&
      canMark &&
      s.alignment &&
      s.active < trace.checkpoints.length - 1 &&
      s.active <= reachableThrough(s.recorded, s.reached)
    )
      return { ...s, active: s.active + 1, reached: Math.max(s.reached, s.active + 1) }
    if (action.type === 'continue-without-recording') {
      if (s.step === 1) return { ...s, step: 2 }
      if (s.step === 2 && !s.prediction) return { ...s, step: 3 }
      if (s.step === 5 && !s.transfer) return { ...s, complete: true }
      return s
    }
    const editable =
      canMark &&
      s.alignment &&
      !s.recorded[s.active] &&
      s.active <= reachableThrough(s.recorded, s.reached)
    if (
      action.type === 'mark' &&
      editable &&
      action.index === s.active &&
      validCtMark(action.mark, trace, action.index)
    )
      return { ...s, marks: s.marks.map((m, i) => (i === action.index ? action.mark : m)) }
    if (
      action.type === 'branch' &&
      editable &&
      action.index === s.active &&
      trace.checkpoints[s.active].decision &&
      validBranch(trace, s.active, action.value)
    )
      return { ...s, branches: s.branches.map((v, i) => (i === s.active ? action.value : v)) }
    if (
      action.type === 'record-junction' &&
      editable &&
      junctionReady(trace, s.active, s.marks, s.branches)
    ) {
      const key = `${trace.id}.${trace.checkpoints[s.active].id}`
      return {
        ...s,
        recorded: s.recorded.map((v, i) => (i === s.active ? true : v)),
        junctionHistory: {
          ...s.junctionHistory,
          [key]: [
            ...(s.junctionHistory[key] ?? []),
            {
              mark: {
                ...s.marks[s.active]!,
                pixel: s.marks[s.active]!.pixel ? [...s.marks[s.active]!.pixel!] : null,
              },
              branch: s.branches[s.active],
              orientation: { ...s.orientation },
            },
          ],
        },
      }
    }
    if (
      action.type === 'course' &&
      (s.step === 2 || (s.step === 5 && !s.transfer)) &&
      action.value in COURSE_OPTIONS
    )
      return { ...s, course: action.value }
    if (action.type === 'hint' && canMark) return { ...s, hints: Math.min(1, s.hints + 1) }
    if (
      action.type === 'target-relation' &&
      (s.step === 2 || (s.step === 5 && !s.transfer)) &&
      action.value in TARGET_RELATION_OPTIONS
    )
      return { ...s, targetRelation: action.value }
    if (action.type !== 'advance') return s
    if (s.step === 0)
      return {
        ...s,
        step: 1,
        active: 0,
        reached: 0,
        ...emptyTraceWork(prediction),
        orientation: STANDARD_ORIENTATION,
      }
    if (s.step === 3) return { ...s, step: 4 }
    if (s.step === 1 && s.alignment && traceComplete(trace, s)) return { ...s, step: 2 }
    const response = (): CtResponse => ({
      orientation: { first: s.orientationAttempts[0], used: { ...s.orientation } },
      marks: s.marks as CtMark[],
      branches: [...s.branches],
      course: s.course as Course,
      targetRelation: s.targetRelation as TargetRelation,
    })
    if (
      s.step === 2 &&
      s.alignment &&
      traceComplete(trace, s) &&
      s.course &&
      s.targetRelation &&
      s.targetViewed[trace.id]
    )
      return { ...s, step: 3, prediction: response() }
    if (s.step === 4)
      return {
        ...s,
        step: 5,
        active: 0,
        reached: 0,
        ...emptyTraceWork(transfer),
        course: '',
        targetRelation: '',
        hints: 0,
        orientation: STANDARD_ORIENTATION,
        orientationAttempts: [],
        alignment: null,
      }
    if (
      s.step === 5 &&
      !s.transfer &&
      s.alignment &&
      traceComplete(trace, s) &&
      s.course &&
      s.targetRelation &&
      s.targetViewed[trace.id]
    )
      return { ...s, transfer: response() }
    if (s.step === 5 && s.transfer) return { ...s, complete: true }
    return s
  }
}
