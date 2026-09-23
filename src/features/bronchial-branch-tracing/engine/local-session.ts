import { z } from 'zod'
import type { CtMark } from '../content/ct-types'
import type { LocalCtExercise, CtBranchChoice } from '../content/ct-types'
import { parentViewTask } from '../content/local-teaching'
import { CT_TARGETS } from '../geometry/native-ct'
import {
  orientationFor,
  sameOrientation,
  STANDARD_ORIENTATION,
  type CtOrientation,
} from '../geometry/orientation'
import { markSchema, orientationSchema, viewerSchema } from './ct-draft'

const branchSchema = z.union([z.number().int().nonnegative(), z.literal('unresolved')]).nullable()
export const TRACING_PRESETS = ['mirror', 'rul', 'upper-division'] as const
export type TaughtPreset = (typeof TRACING_PRESETS)[number]
/** Legacy answers to the removed orientation check; kept readable, never written. */
const orientationResponseSchema = z.enum(['display', 'anatomy', 'bronchoscopy'])
const attemptSchema = z.object({
  // Self-paced attempts store 'not-recorded'. Older drafts keep their label, or
  // 'legacy-unknown' when they predate it. Neither is shown to the learner.
  support: z
    .enum(['guided', 'independent', 'after-comparison', 'legacy-unknown', 'not-recorded'])
    .default('legacy-unknown'),
  marks: z.array(markSchema),
  branch: branchSchema,
  /** Legacy drafts only; self-paced attempts do not record hint use. */
  hints: z.number().int().min(0).max(3).optional(),
  course: z.enum(['cranial', 'caudal', 'horizontal', 'returning', 'uncertain', '']),
  orientation: orientationSchema,
})
const stateSchema = z.object({
  exercise: z.number().int().nonnegative(),
  slot: z.number().int().nonnegative(),
  phase: z.enum(['demo', 'attempt', 'compare', 'parent-view', 'complete']),
  frame: z.number().int().nonnegative(),
  marks: z.array(markSchema.nullable()),
  branch: branchSchema,
  course: attemptSchema.shape.course,
  /** In-session help level for the current example: highlight or return to the parent. */
  hints: z.number().int().min(0).max(3),
  orientation: orientationSchema,
  viewAnswer: branchSchema,
  history: z.record(z.array(attemptSchema)),
  /** Legacy opening-choice history; kept readable, no longer appended. */
  viewAnswers: z.record(z.array(branchSchema)),
  parentChoice: z.string().nullable(),
  parentConfirmed: z.boolean(),
  parentSelections: z.array(z.string()),
  views: z.record(viewerSchema),
  orientationGuide: z.enum(['context', 'direction', 'compare']).nullable().default(null),
  taughtPresets: z.array(z.enum(TRACING_PRESETS)).default([]),
  orientationResponses: z.record(z.array(orientationResponseSchema)).default({}),
})
export type LocalSession = z.infer<typeof stateSchema>
export type LocalAttempt = z.infer<typeof attemptSchema>
export type LocalAction =
  | { type: 'focus-airway' }
  | { type: 'explain-orientation' }
  | { type: 'reset-attempt' }
  | { type: 'demonstrate-orientation' }
  | { type: 'finish-orientation' }
  /** Move past the current attempt without marking. Nothing is recorded. */
  | { type: 'skip' }
  | { type: 'orientation'; value: CtOrientation }
  | { type: 'select-parent'; value: string }
  | { type: 'record-parent' }
  | { type: 'begin' }
  | { type: 'check' }
  | { type: 'retry' }
  | { type: 'parent-view' }
  | { type: 'next' }
  | { type: 'restart' }
  | { type: 'hint'; level: number }
  | { type: 'slot'; index: number }
  | { type: 'frame'; index: number }
  | { type: 'mark'; mark: CtMark }
  | { type: 'branch' | 'view-answer'; value: CtBranchChoice }
  | { type: 'course'; value: LocalSession['course'] }

export function emptyLocalSession(
  exercises: LocalCtExercise[],
  history: LocalSession['history'] = {},
  taughtPresets: TaughtPreset[] = [],
): LocalSession {
  const first = exercises[0]
  const context = ['same-lumen', 'viewpoint', 'bifurcation'].includes(first.spec.kind)
  return {
    exercise: 0,
    slot: 0,
    phase: 'demo',
    frame: 0,
    marks: exercises[0].answerPoints.map(() => null),
    branch: null,
    course: '',
    hints: 0,
    viewAnswer: null,
    orientation: { ...STANDARD_ORIENTATION },
    history,
    viewAnswers: {},
    parentChoice: null,
    parentConfirmed: first.spec.kind === 'integration',
    parentSelections: [],
    views: context ? { [first.id]: contextView(first) } : {},
    orientationGuide: context ? 'context' : null,
    taughtPresets,
    orientationResponses: {},
  }
}
function contextView(exercise: LocalCtExercise) {
  return {
    slice: exercise.trace.anchor.slice,
    focus: 'start' as const,
    full: true,
    magnification: 1,
    showNodule: false,
    // The viewpoint lesson teaches the CT beside the parent airway view, so it opens paired.
    showScope: exercise.spec.kind === 'viewpoint',
  }
}
const usesTracingView = (s: LocalSession, exercise: LocalCtExercise) =>
  exercise.spec.kind === 'viewpoint' || s.phase === 'parent-view'
const hasLearnedPreset = (s: LocalSession, exercise: LocalCtExercise) =>
  exercise.trace.preset === 'standard' || s.taughtPresets.some((p) => p === exercise.trace.preset)
const validChoice = (exercise: LocalCtExercise, choice: CtBranchChoice | null) =>
  choice === 'unresolved' ||
  exercise.trace.checkpoints[0].decision?.options.some((o) => o.sourceEdgeId === choice)
export function localReady(s: LocalSession, exercise: LocalCtExercise) {
  return (
    s.marks.length === exercise.answerPoints.length &&
    s.marks.every((m, i) => m && m.slice === exercise.answerPoints[i].slice) &&
    (exercise.spec.kind !== 'integration' || validChoice(exercise, s.branch)) &&
    (!['pattern', 'integration'].includes(exercise.spec.kind) ||
      Boolean(s.course) ||
      (exercise.spec.kind === 'integration' &&
        s.history[exercise.id]?.at(-1)?.support === 'legacy-unknown'))
  )
}
export function parseLocalSession(
  value: unknown,
  exercises: LocalCtExercise[],
  taughtPresets: TaughtPreset[] = [],
): LocalSession | null {
  const parsed = stateSchema.safeParse(value)
  if (!parsed.success) return null
  const s = parsed.data,
    exercise = exercises[s.exercise]
  if (
    !exercise ||
    s.slot >= exercise.answerPoints.length ||
    s.frame >= exercise.frames.length ||
    s.marks.length !== exercise.answerPoints.length
  )
    return null
  if (
    [s.parentChoice, ...s.parentSelections].some(
      (choice) =>
        choice !== null && !CT_TARGETS.some((target) => target.segment.bronchusCode === choice),
    )
  )
    return null
  if (exercise.spec.kind === 'integration' && s.phase !== 'demo' && !s.parentConfirmed) return null
  const validMarks = (marks: (CtMark | null)[], ex: LocalCtExercise) =>
    marks.length === ex.answerPoints.length &&
    marks.every((m, i) => !m || m.slice === ex.answerPoints[i].slice)
  if (!validMarks(s.marks, exercise)) return null
  if (s.branch !== null && !validChoice(exercise, s.branch)) return null
  if (s.viewAnswer !== null && !validChoice(exercise, s.viewAnswer)) return null
  for (const [id, attempts] of Object.entries(s.history)) {
    const ex = exercises.find((e) => e.id === id)
    if (
      !ex ||
      attempts.some(
        (a) => !validMarks(a.marks, ex) || (a.branch !== null && !validChoice(ex, a.branch)),
      )
    )
      return null
  }
  // Only the comparison shows a checked attempt, so only it needs one. Position is independent of
  // what was marked: a learner may reach the parent view, a later example or the end of the lesson
  // having continued without marking.
  if (s.phase === 'compare' && (!localReady(s, exercise) || !s.history[exercise.id]?.length))
    return null
  for (const [key, view] of Object.entries(s.views)) {
    const ex = exercises.find((e) => e.id === key)
    if (!ex || view.slice < ex.trace.range[0] || view.slice > ex.trace.range[1] || view.showNodule)
      return null
  }
  if (exercise.spec.kind === 'integration') s.parentConfirmed = true
  s.taughtPresets = [...new Set([...s.taughtPresets, ...taughtPresets])]
  // Compatible drafts retain their chosen display and native coordinates. Teaching
  // completion is a separate versioned record, never inferred from a transform.
  if (
    s.orientationGuide &&
    (s.phase === 'complete' || (exercise.spec.kind === 'integration' && !s.parentConfirmed))
  )
    return null
  if (s.orientationGuide === 'context' || s.orientationGuide === 'direction') {
    if (!sameOrientation(s.orientation, STANDARD_ORIENTATION)) return null
  }
  if (
    s.orientationGuide === 'compare' &&
    !sameOrientation(s.orientation, STANDARD_ORIENTATION) &&
    !sameOrientation(s.orientation, orientationFor(exercise.trace.preset))
  )
    return null
  return s
}

/**
 * Exactly what a restart would discard, in the learner's words. Recorded (checked) attempts,
 * earlier opening choices, recorded parent selections and every other lesson's draft survive a
 * restart, so they are never listed here. An empty list means nothing would be lost.
 */
export function restartDiscards(s: LocalSession, exercises: LocalCtExercise[]): string[] {
  const exercise = exercises[s.exercise]
  const placed = s.marks.filter((m) => m?.pixel).length
  const unresolved = s.marks.filter((m) => m && m.pixel === null).length
  const discards: string[] = []
  if (placed)
    discards.push(
      `${placed} lumen mark${placed === 1 ? '' : 's'} on the ${exercise.trace.anchor.airway.code} example`,
    )
  if (unresolved)
    discards.push(`${unresolved} unresolved response${unresolved === 1 ? '' : 's'} on this example`)
  if (s.branch !== null) discards.push('the continuation branch chosen on this example')
  if (s.course) discards.push('the airway course chosen on this example')
  if (s.viewAnswer !== null) discards.push('the parent-view opening chosen on this example')
  if (s.exercise > 0)
    discards.push(`your place in the lesson: you would return to example 1 of ${exercises.length}`)
  else if (s.phase !== 'demo') discards.push('your place in this example: it would start again')
  return discards
}

export function localSessionReducer(
  exercises: LocalCtExercise[],
  s: LocalSession,
  action: LocalAction,
): LocalSession {
  const exercise = exercises[s.exercise]
  if (action.type === 'restart')
    return {
      ...emptyLocalSession(exercises, s.history, s.taughtPresets),
      viewAnswers: s.viewAnswers,
      parentSelections: s.parentSelections,
      orientationResponses: s.orientationResponses,
    }
  if (action.type === 'orientation' && orientationSchema.safeParse(action.value).success) {
    if (sameOrientation(action.value, STANDARD_ORIENTATION))
      return { ...s, orientation: { ...action.value } }
    const allowed =
      s.orientationGuide === 'compare'
        ? sameOrientation(action.value, STANDARD_ORIENTATION) ||
          sameOrientation(action.value, orientationFor(exercise.trace.preset))
        : !s.orientationGuide && exercise.spec.kind !== 'same-lumen'
    return allowed ? { ...s, orientation: { ...action.value } } : s
  }
  if (action.type === 'explain-orientation' && !s.orientationGuide && s.phase !== 'complete')
    return { ...s, orientationGuide: 'direction', orientation: { ...STANDARD_ORIENTATION } }
  if (s.orientationGuide) {
    if (action.type === 'focus-airway' && s.orientationGuide === 'context') {
      const needsTransform = usesTracingView(s, exercise)
      const teach =
        needsTransform && (exercise.spec.kind === 'viewpoint' || !hasLearnedPreset(s, exercise))
      return {
        ...s,
        orientationGuide: teach ? 'direction' : null,
        orientation: { ...STANDARD_ORIENTATION },
        views: { ...s.views, [exercise.id]: { ...contextView(exercise), full: false } },
      }
    }
    if (action.type === 'demonstrate-orientation' && s.orientationGuide === 'direction')
      return {
        ...s,
        orientationGuide: 'compare',
        orientation: orientationFor(exercise.trace.preset),
      }
    // The explanation and side-by-side comparison precede any transform; leaving it needs no answer.
    if (action.type === 'finish-orientation' && s.orientationGuide === 'compare')
      return {
        ...s,
        orientationGuide: null,
        taughtPresets: [...new Set([...s.taughtPresets, exercise.trace.preset as TaughtPreset])],
      }
    return s
  }
  if (s.phase === 'demo' && exercise.spec.kind === 'integration' && !s.parentConfirmed) {
    if (
      action.type === 'select-parent' &&
      CT_TARGETS.some((target) => target.segment.bronchusCode === action.value)
    )
      return { ...s, parentChoice: action.value }
    if (action.type === 'record-parent' && s.parentChoice)
      return {
        ...s,
        parentConfirmed: true,
        parentSelections: [...s.parentSelections, s.parentChoice],
        orientationGuide: null,
        orientation: { ...STANDARD_ORIENTATION },
      }
    if (action.type === 'begin') return s
  }
  if (action.type === 'frame' && action.index >= 0 && action.index < exercise.frames.length)
    return { ...s, frame: action.index }
  if (action.type === 'hint' && action.level >= 1 && action.level <= 3 && s.phase === 'attempt')
    return { ...s, hints: Math.max(s.hints, action.level) }
  if (action.type === 'begin' && s.phase === 'demo') return { ...s, phase: 'attempt', frame: 0 }
  if (
    (action.type === 'retry' && s.phase === 'compare') ||
    (action.type === 'reset-attempt' && s.phase === 'attempt')
  )
    return {
      ...s,
      phase: 'attempt',
      slot: 0,
      marks: exercise.answerPoints.map(() => null),
      branch: null,
      course: '',
      viewAnswer: null,
      hints: s.hints,
      orientation: { ...STANDARD_ORIENTATION },
    }
  if (action.type === 'slot' && action.index >= 0 && action.index < exercise.answerPoints.length)
    return { ...s, slot: action.index }
  if (s.phase === 'attempt') {
    if (
      action.type === 'mark' &&
      markSchema.safeParse(action.mark).success &&
      action.mark.slice === exercise.answerPoints[s.slot].slice
    )
      return { ...s, marks: s.marks.map((m, i) => (i === s.slot ? action.mark : m)) }
    if (action.type === 'branch' && validChoice(exercise, action.value))
      return { ...s, branch: action.value }
    if (action.type === 'course' && attemptSchema.shape.course.safeParse(action.value).success)
      return { ...s, course: action.value }
    // A checked attempt keeps the learner's own marks for comparison and retry, exactly as placed.
    // It records no hint use and no guided/independent label.
    if (action.type === 'check' && localReady(s, exercise)) {
      const attempt: LocalAttempt = {
        support: 'not-recorded',
        marks: s.marks.map((m) => ({ ...m!, pixel: m!.pixel ? [...m!.pixel] : null })),
        branch: s.branch,
        course: s.course,
        orientation: { ...s.orientation },
      }
      return {
        ...s,
        phase: 'compare',
        history: { ...s.history, [exercise.id]: [...(s.history[exercise.id] ?? []), attempt] },
      }
    }
    // Continue without marking: unplaced responses are discarded, no attempt is created, and the
    // parent-view teaching for this example stays available when the lesson has one.
    if (action.type === 'skip') {
      const cleared: LocalSession = {
        ...s,
        slot: 0,
        marks: exercise.answerPoints.map(() => null),
        branch: null,
        course: '',
        viewAnswer: null,
      }
      return parentViewTask(exercise.spec, s.exercise) !== 'none'
        ? enterParentView(cleared, exercise)
        : advance(exercises, cleared)
    }
  }
  if (
    action.type === 'parent-view' &&
    s.phase === 'compare' &&
    parentViewTask(exercise.spec, s.exercise) !== 'none'
  )
    return enterParentView(s, exercise)
  if (
    action.type === 'view-answer' &&
    s.phase === 'parent-view' &&
    s.viewAnswer === null &&
    validChoice(exercise, action.value)
  )
    return { ...s, viewAnswer: action.value }
  // Moving on never waits on an opening choice or on the parent view itself.
  if (action.type === 'next' && (s.phase === 'compare' || s.phase === 'parent-view'))
    return advance(exercises, s)
  return s
}

function enterParentView(s: LocalSession, exercise: LocalCtExercise): LocalSession {
  return {
    ...s,
    phase: 'parent-view',
    orientationGuide: hasLearnedPreset(s, exercise) ? null : 'direction',
    orientation: hasLearnedPreset(s, exercise) ? s.orientation : { ...STANDARD_ORIENTATION },
  }
}

function advance(exercises: LocalCtExercise[], s: LocalSession): LocalSession {
  if (s.exercise === exercises.length - 1) return { ...s, phase: 'complete' }
  const next = exercises[s.exercise + 1]
  return {
    ...s,
    exercise: s.exercise + 1,
    slot: 0,
    phase: 'attempt',
    frame: 0,
    marks: next.answerPoints.map(() => null),
    branch: null,
    course: '',
    hints: 0,
    viewAnswer: null,
    orientation: { ...STANDARD_ORIENTATION },
    orientationGuide: null,
  }
}
