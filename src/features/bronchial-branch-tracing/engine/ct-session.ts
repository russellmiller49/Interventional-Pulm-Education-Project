import type { Course, CtMark, CtResponse, CtTrace } from '../content/ct-types'
import { COURSE_OPTIONS } from '../content/ct-types'

export interface CtSession {
  step: number
  active: number
  marks: (CtMark | null)[]
  course: Course | ''
  hints: number
  prediction: CtResponse | null
  transfer: CtResponse | null
  complete: boolean
}
export const emptyCtSession = (): CtSession => ({
  step: 0,
  active: 0,
  marks: [null, null, null],
  course: '',
  hints: 0,
  prediction: null,
  transfer: null,
  complete: false,
})
export type CtAction =
  | { type: 'mark'; index: number; mark: CtMark }
  | { type: 'active'; index: number }
  | { type: 'course'; value: Course }
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
    if (s.complete) return s
    const trace = s.step === 5 ? transfer : prediction
    const canMark = s.step === 1 || (s.step === 5 && !s.transfer)
    if (
      action.type === 'active' &&
      Number.isInteger(action.index) &&
      action.index >= 0 &&
      action.index < 3
    )
      return { ...s, active: action.index }
    if (action.type === 'mark' && canMark && validCtMark(action.mark, trace, action.index))
      return { ...s, marks: s.marks.map((m, i) => (i === action.index ? action.mark : m)) }
    if (
      action.type === 'course' &&
      (s.step === 2 || (s.step === 5 && !s.transfer)) &&
      action.value in COURSE_OPTIONS
    )
      return { ...s, course: action.value }
    if (action.type === 'hint' && canMark) return { ...s, hints: Math.min(1, s.hints + 1) }
    if (action.type !== 'advance') return s
    if (s.step === 0 || s.step === 3) return { ...s, step: s.step + 1 }
    if (s.step === 1 && marksComplete(s.marks)) return { ...s, step: 2 }
    if (s.step === 2 && marksComplete(s.marks) && s.course)
      return {
        ...s,
        step: 3,
        prediction: { marks: s.marks as CtMark[], course: s.course, hints: s.hints },
      }
    if (s.step === 4)
      return { ...s, step: 5, active: 0, marks: [null, null, null], course: '', hints: 0 }
    if (s.step === 5 && !s.transfer && marksComplete(s.marks) && s.course)
      return { ...s, transfer: { marks: s.marks as CtMark[], course: s.course, hints: s.hints } }
    if (s.step === 5 && s.transfer) return { ...s, complete: true }
    return s
  }
}
