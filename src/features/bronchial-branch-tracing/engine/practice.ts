import type { Exercise } from '../content/types'
import type { OpeningPosition } from '../content/phantoms'
import { childrenOf, OPENING_POSITIONS } from '../content/phantoms'
import { mapComplete, validChoice, type OpeningMap, type Response } from './session'

export interface PracticeSession {
  index: number
  choice: string | null
  openings: OpeningMap
  hints: number
  responses: (Response | null)[]
  submitted: boolean
}
export const emptyPractice = (exercises: Exercise[]): PracticeSession => ({
  index: 0,
  choice: null,
  openings: {},
  hints: 0,
  responses: exercises.map(() => null),
  submitted: false,
})
type PracticeAction =
  | { type: 'choose'; id: string }
  | { type: 'place'; id: string; position: OpeningPosition }
  | { type: 'hint' }
  | { type: 'record' }
  | { type: 'go'; index: number }
  | { type: 'submit' }
  | { type: 'restart' }
export function practiceReducer(exercises: Exercise[], allowHints: boolean) {
  return (s: PracticeSession, action: PracticeAction): PracticeSession => {
    if (action.type === 'restart') return emptyPractice(exercises)
    if (s.submitted) return s
    const e = exercises[s.index]
    if (action.type === 'choose' && validChoice(e, action.id)) return { ...s, choice: action.id }
    if (
      action.type === 'place' &&
      childrenOf(e.phantom).some((b) => b.id === action.id) &&
      OPENING_POSITIONS.includes(action.position)
    )
      return { ...s, openings: { ...s.openings, [action.id]: action.position } }
    if (action.type === 'hint' && allowHints)
      return { ...s, hints: Math.min(e.hints.length, s.hints + 1) }
    if (
      action.type === 'go' &&
      action.index >= 0 &&
      action.index < exercises.length &&
      (s.responses[action.index] || action.index <= s.responses.filter(Boolean).length)
    ) {
      const response = s.responses[action.index]
      return {
        ...s,
        index: action.index,
        choice: response?.branchId ?? null,
        openings: response?.openings ?? {},
        hints: response?.hints ?? 0,
      }
    }
    if (action.type === 'record' && validChoice(e, s.choice) && mapComplete(e, s.openings)) {
      const responses = s.responses.map((r, i) =>
        i === s.index ? { branchId: s.choice!, openings: { ...s.openings }, hints: s.hints } : r,
      )
      const nextIndex = Math.min(exercises.length - 1, s.index + 1)
      const next = responses[nextIndex]
      return {
        ...s,
        responses,
        index: nextIndex,
        choice: next?.branchId ?? null,
        openings: next?.openings ?? {},
        hints: next?.hints ?? 0,
      }
    }
    // Edits must be explicitly recorded before final submission.
    const current = s.responses[s.index]
    const unchanged =
      current?.branchId === s.choice &&
      JSON.stringify(current?.openings) === JSON.stringify(s.openings) &&
      current?.hints === s.hints
    if (action.type === 'submit' && s.responses.every(Boolean) && unchanged)
      return { ...s, submitted: true }
    return s
  }
}
