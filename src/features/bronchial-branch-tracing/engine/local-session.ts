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
const orientationResponseSchema = z.enum(['display', 'anatomy', 'bronchoscopy'])
const attemptSchema = z.object({
  support: z
    .enum(['guided', 'independent', 'after-comparison', 'legacy-unknown'])
    .default('legacy-unknown'),
  marks: z.array(markSchema),
  branch: branchSchema,
  hints: z.number().int().min(0).max(3),
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
  hints: attemptSchema.shape.hints,
  orientation: orientationSchema,
  viewAnswer: branchSchema,
  history: z.record(z.array(attemptSchema)),
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
  | { type: 'orientation-response'; value: z.infer<typeof orientationResponseSchema> }
  | { type: 'finish-orientation' }
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
    showScope: false,
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
  if (
    ['compare', 'parent-view', 'complete'].includes(s.phase) &&
    (!localReady(s, exercise) || !s.history[exercise.id]?.length)
  )
    return null
  if (exercises.slice(0, s.exercise).some((ex) => !s.history[ex.id]?.length)) return null
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
    if (
      action.type === 'orientation-response' &&
      s.orientationGuide === 'compare' &&
      orientationResponseSchema.safeParse(action.value).success
    )
      return {
        ...s,
        orientationResponses: {
          ...s.orientationResponses,
          [exercise.trace.preset]: [
            ...(s.orientationResponses[exercise.trace.preset] ?? []),
            action.value,
          ],
        },
      }
    if (
      action.type === 'finish-orientation' &&
      s.orientationGuide === 'compare' &&
      s.orientationResponses[exercise.trace.preset]?.at(-1) === 'display'
    )
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
    if (action.type === 'check' && localReady(s, exercise)) {
      const attempt: LocalAttempt = {
        support: s.history[exercise.id]?.length
          ? 'after-comparison'
          : s.exercise === 0 ||
              s.hints > 0 ||
              exercises
                .slice(0, s.exercise)
                .some((e) => e.spec.checkpointId === exercise.spec.checkpointId)
            ? 'guided'
            : 'independent',
        marks: s.marks.map((m) => ({ ...m!, pixel: m!.pixel ? [...m!.pixel] : null })),
        branch: s.branch,
        course: s.course,
        hints: s.hints,
        orientation: { ...s.orientation },
      }
      return {
        ...s,
        phase: 'compare',
        history: { ...s.history, [exercise.id]: [...(s.history[exercise.id] ?? []), attempt] },
      }
    }
  }
  if (
    action.type === 'parent-view' &&
    s.phase === 'compare' &&
    parentViewTask(exercise.spec, s.exercise) !== 'none'
  )
    return {
      ...s,
      phase: 'parent-view',
      orientationGuide: hasLearnedPreset(s, exercise) ? null : 'direction',
      orientation: hasLearnedPreset(s, exercise) ? s.orientation : { ...STANDARD_ORIENTATION },
    }
  if (
    action.type === 'view-answer' &&
    s.phase === 'parent-view' &&
    s.viewAnswer === null &&
    validChoice(exercise, action.value)
  )
    return {
      ...s,
      viewAnswer: action.value,
      viewAnswers: {
        ...s.viewAnswers,
        [exercise.id]: [...(s.viewAnswers[exercise.id] ?? []), action.value],
      },
    }
  if (
    action.type === 'next' &&
    ((s.phase === 'parent-view' &&
      (s.viewAnswer !== null || parentViewTask(exercise.spec, s.exercise) === 'guided')) ||
      (s.phase === 'compare' && parentViewTask(exercise.spec, s.exercise) === 'none'))
  ) {
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
  return s
}
