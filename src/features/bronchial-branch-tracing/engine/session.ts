import { childrenOf, openingPosition, OPENING_POSITIONS } from '../content/phantoms'
import type { OpeningPosition } from '../content/phantoms'
import type { Exercise } from '../content/types'

export type OpeningMap = Record<string, OpeningPosition>
export interface Response {
  branchId: string
  openings: OpeningMap
  hints: number
}
export interface Session {
  step: number
  choice: string | null
  openings: OpeningMap
  hints: number
  committedBranch: { branchId: string; hints: number } | null
  prediction: Response | null
  transfer: Response | null
  complete: boolean
}
export const emptySession = (): Session => ({
  step: 0,
  choice: null,
  openings: {},
  hints: 0,
  committedBranch: null,
  prediction: null,
  transfer: null,
  complete: false,
})
export type Action =
  | { type: 'choose'; id: string }
  | { type: 'place'; id: string; position: OpeningPosition }
  | { type: 'hint' }
  | { type: 'advance' }
  | { type: 'submit' }
  | { type: 'restart' }

export function mapComplete(exercise: Exercise, openings: OpeningMap) {
  const values = childrenOf(exercise.phantom).map((b) => openings[b.id])
  return (
    values.every((v) => OPENING_POSITIONS.includes(v)) && new Set(values).size === values.length
  )
}
export function validChoice(exercise: Exercise, choice: string | null) {
  return choice === 'unresolved' || childrenOf(exercise.phantom).some((b) => b.id === choice)
}
export function scoreResponse(exercise: Exercise, response: Response) {
  const branches = childrenOf(exercise.phantom)
  return {
    connectivity: Number(exercise.targetId === response.branchId),
    viewpoint: branches.filter(
      (b) => response.openings[b.id] === openingPosition(exercise.phantom, b),
    ).length,
    viewpointTotal: branches.length,
    assisted: response.hints > 0,
  }
}
export function feedbackFor(exercise: Exercise, response: Response) {
  return response.branchId === exercise.targetId
    ? exercise.rationale
    : `${exercise.misconceptions[response.branchId]} ${exercise.rationale}`
}
export function sessionReducer(prediction: Exercise, transfer: Exercise) {
  return (s: Session, action: Action): Session => {
    const exercise = s.step === 5 ? transfer : prediction
    if (action.type === 'restart') return emptySession()
    if (s.complete || (s.step === 5 && s.transfer)) {
      return action.type === 'advance' && s.transfer ? { ...s, complete: true } : s
    }
    const answering = s.step === 1 || s.step === 2 || s.step === 5
    if (
      action.type === 'choose' &&
      (s.step === 1 || s.step === 5) &&
      validChoice(exercise, action.id)
    )
      return { ...s, choice: action.id }
    if (
      action.type === 'place' &&
      (s.step === 2 || s.step === 5) &&
      childrenOf(exercise.phantom).some((b) => b.id === action.id) &&
      OPENING_POSITIONS.includes(action.position)
    )
      return { ...s, openings: { ...s.openings, [action.id]: action.position } }
    if (action.type === 'hint' && answering)
      return { ...s, hints: Math.min(s.hints + 1, exercise.hints.length) }
    if (action.type === 'advance') {
      if (s.step === 0 || s.step === 3) return { ...s, step: s.step + 1 }
      if (s.step === 1 && validChoice(exercise, s.choice))
        return { ...s, step: 2, committedBranch: { branchId: s.choice!, hints: s.hints } }
      if (s.step === 4) return { ...s, step: 5, choice: null, openings: {}, hints: 0 }
    }
    if (
      action.type === 'submit' &&
      (s.step === 2 || s.step === 5) &&
      validChoice(exercise, s.choice) &&
      mapComplete(exercise, s.openings)
    ) {
      const response: Response = {
        branchId: s.choice!,
        openings: { ...s.openings },
        hints: s.hints,
      }
      return s.step === 2 ? { ...s, step: 3, prediction: response } : { ...s, transfer: response }
    }
    return s
  }
}

/** A single policy governs mounting answer-bearing views; CSS is not an assessment gate. */
export function referenceVisible(
  mode: 'learn' | 'practice' | 'assess',
  submitted: boolean,
  debrief: boolean,
) {
  return mode === 'learn' ? submitted : debrief
}
