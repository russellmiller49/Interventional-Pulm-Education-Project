import type { Course, CtMark, CtResponse, CtTrace, TargetRelation } from '../content/ct-types'
import { COURSE_OPTIONS, TARGET_RELATION_OPTIONS } from '../content/ct-types'
import {
  STANDARD_ORIENTATION,
  orientationFor,
  sameOrientation,
  validOrientation,
  type CtOrientation,
} from '../geometry/orientation'

export interface CtSession {
  step: number
  active: number
  marks: (CtMark | null)[]
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
export const emptyCtSession = (): CtSession => ({
  step: 0,
  active: 0,
  marks: [null, null, null],
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
  | { type: 'active'; index: number }
  | { type: 'course'; value: Course }
  | { type: 'target-relation'; value: TargetRelation }
  | { type: 'hint' }
  | { type: 'advance' }
  | { type: 'restart' }
export const marksComplete = (marks: (CtMark | null)[]) =>
  marks.length === 3 && marks.every(Boolean)
export function validCtMark(mark: CtMark, trace: CtTrace, index: number) {
  return (
    mark.slice === trace.checkpoints[index]?.slice &&
    (mark.pixel === null ||
      (mark.pixel.length === 2 &&
        mark.pixel.every((p) => Number.isFinite(p) && p >= 0 && p <= 511)))
  )
}
export function ctSessionReducer(prediction: CtTrace, transfer: CtTrace) {
  return (s: CtSession, action: CtAction): CtSession => {
    if (action.type === 'restart') return emptyCtSession()
    if (action.type === 'orientation' && validOrientation(action.value))
      return { ...s, orientation: action.value }
    if (
      action.type === 'active' &&
      Number.isInteger(action.index) &&
      action.index >= 0 &&
      action.index < 3
    )
      return { ...s, active: action.index }
    if (s.complete) return s
    const trace = s.step === 5 ? transfer : prediction
    const canMark = s.step === 1 || (s.step === 5 && !s.transfer)
    if (
      action.type === 'check-orientation' &&
      canMark &&
      !s.alignment &&
      !sameOrientation(s.orientation, STANDARD_ORIENTATION)
    )
      return {
        ...s,
        orientationAttempts: [...s.orientationAttempts, { ...s.orientation }],
        alignment: sameOrientation(s.orientation, orientationFor(trace.preset))
          ? { ...s.orientation }
          : null,
      }
    if (
      action.type === 'mark' &&
      canMark &&
      s.alignment &&
      validCtMark(action.mark, trace, action.index)
    )
      return { ...s, marks: s.marks.map((m, i) => (i === action.index ? action.mark : m)) }
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
    if (s.step === 0) return { ...s, step: 1, orientation: STANDARD_ORIENTATION }
    if (s.step === 3) return { ...s, step: 4 }
    if (s.step === 1 && s.alignment && marksComplete(s.marks)) return { ...s, step: 2 }
    if (s.step === 2 && s.alignment && marksComplete(s.marks) && s.course && s.targetRelation)
      return {
        ...s,
        step: 3,
        prediction: {
          orientation: { first: s.orientationAttempts[0], used: s.alignment },
          marks: s.marks as CtMark[],
          course: s.course,
          hints: s.hints,
          targetRelation: s.targetRelation,
        },
      }
    if (s.step === 4)
      return {
        ...s,
        step: 5,
        active: 0,
        marks: [null, null, null],
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
      marksComplete(s.marks) &&
      s.course &&
      s.targetRelation
    )
      return {
        ...s,
        transfer: {
          orientation: { first: s.orientationAttempts[0], used: s.alignment },
          marks: s.marks as CtMark[],
          course: s.course,
          hints: s.hints,
          targetRelation: s.targetRelation,
        },
      }
    if (s.step === 5 && s.transfer) return { ...s, complete: true }
    return s
  }
}
