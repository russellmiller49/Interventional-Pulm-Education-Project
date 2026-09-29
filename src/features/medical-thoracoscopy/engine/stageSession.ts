import type { PivotHandDirection, SeenState, UnseenReason } from '../components/space/types'
import type { LessonPartId } from '../content/lessonParts'
import { PLEURAL_ZONE_IDS, type PleuralZoneId } from '../content/pleuralZones'
import type { AuthoredChoice, SectionActivity } from '../content/types'

/**
 * One section's lesson as the learner goes through it (plan, section 4.2, "Lesson host"). Plain
 * data, and none of it is stored: the progress record keeps only where the learner is, the
 * sections visited and those they chose to mark reviewed (learning contract).
 *
 * Three kinds of action, kept apart:
 * - **navigation**: continue, back, move past a part without doing it, or open any part at any
 *   time. None of them counts as doing a part's work.
 * - **answers**: choosing, checking and reading the explanation of the optional questions. Any answer
 *   can be changed, and the explanation can be read before answering.
 * - **activity**: the section's own work (the tour's stops, the pivot's targets, the survey's note).
 *   A pivot target is reached only when the space engine says its region is in view after the
 *   learner moved the telescope; the lesson never decides it.
 *
 * Simulated actions go to the space engine itself; loading the teaching example restarts it.
 */
export type QuestionKey = 'question' | 'transfer'
export type ChoiceId = AuthoredChoice['id']

export interface AnswerState {
  readonly chosen: ChoiceId | null
  readonly checked: boolean
  readonly explanationOpen: boolean
}

export interface SurveyNoteRow {
  readonly seen: SeenState | null
  readonly reason: UnseenReason | null
}

export interface LessonSession {
  readonly parts: readonly LessonPartId[]
  /** The part the learner is on. */
  readonly current: number
  /** The furthest part Continue or moving past has reached. */
  readonly furthest: number
  /** Parts opened out of order, ahead of the furthest. */
  readonly openedAhead: readonly LessonPartId[]
  /** Parts moved past without doing their work. */
  readonly movedPast: readonly LessonPartId[]
  readonly answers: Readonly<Record<QuestionKey, AnswerState>>
  /** The tour: the stop the telescope is at (-1 before the first), and each stop's naming. */
  readonly tour: {
    readonly stop: number
    readonly named: Readonly<Record<number, PleuralZoneId | 'asked'>>
  }
  /** The pivot: the target in hand, the hand's predicted way per target, and the targets reached. */
  readonly pivot: {
    readonly target: number
    readonly predicted: Readonly<Record<number, PivotHandDirection>>
    readonly reached: readonly number[]
  }
  readonly survey: {
    readonly note: Readonly<Record<PleuralZoneId, SurveyNoteRow>>
    readonly compared: boolean
  }
}

export type LessonAction =
  | { readonly type: 'continue' }
  | { readonly type: 'back' }
  | { readonly type: 'move-past' }
  | { readonly type: 'open'; readonly part: LessonPartId }
  | { readonly type: 'choose'; readonly question: QuestionKey; readonly choice: ChoiceId }
  | { readonly type: 'check'; readonly question: QuestionKey }
  | { readonly type: 'explain'; readonly question: QuestionKey }
  | { readonly type: 'tour-stop'; readonly stop: number }
  | { readonly type: 'tour-name'; readonly stop: number; readonly zone: PleuralZoneId }
  | { readonly type: 'tour-ask'; readonly stop: number }
  | { readonly type: 'pivot-predict'; readonly target: number; readonly hand: PivotHandDirection }
  | { readonly type: 'pivot-reached'; readonly target: number }
  | { readonly type: 'pivot-target'; readonly target: number }
  | { readonly type: 'survey-note'; readonly zone: PleuralZoneId; readonly row: SurveyNoteRow }
  | { readonly type: 'survey-compare' }

const EMPTY_ANSWER: AnswerState = { chosen: null, checked: false, explanationOpen: false }

export function startLesson(parts: readonly LessonPartId[]): LessonSession {
  if (parts.length === 0) throw new Error('A lesson has at least one part')
  return {
    parts,
    current: 0,
    furthest: 0,
    openedAhead: [],
    movedPast: [],
    answers: { question: EMPTY_ANSWER, transfer: EMPTY_ANSWER },
    tour: { stop: -1, named: {} },
    pivot: { target: 0, predicted: {}, reached: [] },
    survey: {
      note: Object.fromEntries(
        PLEURAL_ZONE_IDS.map((zone) => [zone, { seen: null, reason: null }]),
      ) as Record<PleuralZoneId, SurveyNoteRow>,
      compared: false,
    },
  }
}

const withAnswer = (
  session: LessonSession,
  key: QuestionKey,
  change: Partial<AnswerState>,
): LessonSession => ({
  ...session,
  answers: { ...session.answers, [key]: { ...session.answers[key], ...change } },
})

export function lessonReducer(session: LessonSession, action: LessonAction): LessonSession {
  const last = session.parts.length - 1
  switch (action.type) {
    case 'continue': {
      const current = Math.min(last, session.current + 1)
      return { ...session, current, furthest: Math.max(session.furthest, current) }
    }
    case 'back':
      return { ...session, current: Math.max(0, session.current - 1) }
    case 'move-past': {
      const part = session.parts[session.current]
      const movedPast = session.movedPast.includes(part)
        ? session.movedPast
        : [...session.movedPast, part]
      const current = Math.min(last, session.current + 1)
      return { ...session, movedPast, current, furthest: Math.max(session.furthest, current) }
    }
    case 'open': {
      const index = session.parts.indexOf(action.part)
      if (index < 0) return session
      const ahead = index > session.furthest && !session.openedAhead.includes(action.part)
      return {
        ...session,
        current: index,
        openedAhead: ahead ? [...session.openedAhead, action.part] : session.openedAhead,
      }
    }
    case 'choose':
      // Choosing again is allowed at any time; a new choice waits to be checked.
      return withAnswer(session, action.question, { chosen: action.choice, checked: false })
    case 'check':
      return session.answers[action.question].chosen === null
        ? session
        : withAnswer(session, action.question, { checked: true })
    case 'explain':
      return withAnswer(session, action.question, { explanationOpen: true })
    case 'tour-stop':
      return { ...session, tour: { ...session.tour, stop: action.stop } }
    case 'tour-name':
      return {
        ...session,
        tour: { ...session.tour, named: { ...session.tour.named, [action.stop]: action.zone } },
      }
    case 'tour-ask':
      return session.tour.named[action.stop] === undefined
        ? {
            ...session,
            tour: { ...session.tour, named: { ...session.tour.named, [action.stop]: 'asked' } },
          }
        : session
    case 'pivot-predict':
      return {
        ...session,
        pivot: {
          ...session.pivot,
          predicted: { ...session.pivot.predicted, [action.target]: action.hand },
        },
      }
    case 'pivot-reached':
      return session.pivot.reached.includes(action.target)
        ? session
        : {
            ...session,
            pivot: { ...session.pivot, reached: [...session.pivot.reached, action.target] },
          }
    case 'pivot-target':
      return { ...session, pivot: { ...session.pivot, target: action.target } }
    case 'survey-note':
      return {
        ...session,
        survey: { ...session.survey, note: { ...session.survey.note, [action.zone]: action.row } },
      }
    case 'survey-compare':
      return { ...session, survey: { ...session.survey, compared: true } }
  }
}

/**
 * Whether a part's own work has been done: only the learner's answers and activity count. Reading a
 * part, opening it or moving past it never does.
 */
export function partDone(
  session: LessonSession,
  part: LessonPartId,
  activity: SectionActivity,
): boolean {
  if (part === 'question' || part === 'transfer') return session.answers[part].checked
  if (part !== 'activity') return false
  switch (activity.kind) {
    case 'tour':
      return activity.stops.every((_, stop) => session.tour.named[stop] !== undefined)
    case 'pivot':
      return activity.targets.every((_, target) => session.pivot.reached.includes(target))
    case 'survey':
      return session.survey.compared && surveyNoteComplete(session, activity.order)
  }
}

/** Every region of the survey noted: seen, or not fully seen with a reason. */
export function surveyNoteComplete(
  session: LessonSession,
  order: readonly PleuralZoneId[],
): boolean {
  return order.every((zone) => {
    const row = session.survey.note[zone]
    return row.seen !== null && (row.seen === 'seen' || row.reason !== null)
  })
}
