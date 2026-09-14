import fs from 'node:fs'
import path from 'node:path'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { nativeImageUrl, traceById } from '../geometry/native-ct'
import {
  emptyLocalSession,
  localSessionReducer,
  localReady,
  parseLocalSession,
} from '../engine/local-session'
import { draftSignature, readCtDraft, writeCtDraft } from '../engine/ct-draft'
import { parentMap } from '../geometry/parent-map'
import { orientationFor, STANDARD_ORIENTATION, orientationLabels } from '../geometry/orientation'

const exercises = LESSONS.find((l) => l.id === 'continuity')!.exercises!.map(localExercise)
const reduce = (
  s: ReturnType<typeof emptyLocalSession>,
  action: Parameters<typeof localSessionReducer>[2],
) => localSessionReducer(exercises, s, action)
function answer(s = emptyLocalSession(exercises)) {
  s = reduce(s, { type: 'focus-airway' })
  s = reduce(s, { type: 'begin' })
  for (const [i, point] of exercises[s.exercise].answerPoints.entries()) {
    s = reduce(s, { type: 'slot', index: i })
    s = reduce(s, { type: 'mark', mark: { slice: point.slice, pixel: [5, 8] } })
  }
  return s
}
it('uses existing native CT intervals and leaves source routes unchanged', () => {
  const before = JSON.stringify(traceById('central-right'))
  for (const lesson of LESSONS.filter((l) => l.exercises)) {
    for (const spec of lesson.exercises!) {
      const exercise = localExercise(spec)
      expect(exercise.trace.checkpoints).toHaveLength(1)
      expect(exercise.frames.length).toBeGreaterThan(1)
      expect(exercise.review.status).toBe('provisional')
      for (const frame of exercise.frames) {
        expect(fs.existsSync(path.join(process.cwd(), 'public', nativeImageUrl(frame.slice)))).toBe(
          true,
        )
        expect(frame.overlays.every((o) => !o.contour)).toBe(true)
      }
    }
  }
  expect(JSON.stringify(traceById('central-right'))).toBe(before)
})
it('gates phase transitions, permits off-center lumen marks without grading, and preserves first attempts through retries and restart', () => {
  let s = emptyLocalSession(exercises)
  expect(reduce(s, { type: 'check' })).toBe(s)
  expect(reduce(s, { type: 'begin' })).toBe(s)
  s = reduce(s, { type: 'focus-airway' })
  s = reduce(s, { type: 'begin' })
  const before = s
  s = reduce(s, { type: 'hint', level: 2 })
  expect(s.marks).toEqual(before.marks)
  expect(s.phase).toBe('attempt')
  expect(reduce(s, { type: 'mark', mark: { slice: 239, pixel: [5, 8] } })).toBe(s)
  expect(reduce(s, { type: 'mark', mark: { slice: 387, pixel: [NaN, 8] } })).toBe(s)
  s = reduce(s, { type: 'hint', level: 3 })
  s = answer(s)
  expect(localReady(s, exercises[0])).toBe(true)
  s = reduce(s, { type: 'check' })
  const first = JSON.stringify(s.history[exercises[0].id][0])
  expect(s.phase).toBe('compare')
  expect(reduce(s, { type: 'mark', mark: { slice: 387, pixel: null } })).toBe(s)
  s = reduce(s, { type: 'retry' })
  expect(s.hints).toBe(3)
  expect(s.history[exercises[0].id][0].hints).toBe(3)
  s = answer(s)
  s = reduce(s, { type: 'check' })
  expect(s.history[exercises[0].id]).toHaveLength(2)
  expect(JSON.stringify(s.history[exercises[0].id][0])).toBe(first)
  expect(reduce(s, { type: 'next' })).toBe(s)
  s = reduce(s, { type: 'parent-view' })
  expect(reduce(s, { type: 'next' })).toBe(s)
  expect(reduce(s, { type: 'view-answer', value: 'unresolved' })).toBe(s)
  s = reduce(s, { type: 'demonstrate-orientation' })
  s = reduce(s, { type: 'orientation-response', value: 'display' })
  s = reduce(s, { type: 'finish-orientation' })
  s = reduce(s, { type: 'view-answer', value: 'unresolved' })
  s = reduce(s, { type: 'next' })
  expect(s.exercise).toBe(1)
  expect(s.phase).toBe('attempt')
  expect(s.hints).toBe(0)
  s = reduce(s, { type: 'restart' })
  expect(JSON.stringify(s.history[exercises[0].id][0])).toBe(first)
})
it('keeps both warm-up intervals and restart standard, even after learning a tracing preset', () => {
  const warmup = LESSONS[0].exercises!.map(localExercise)
  const step = (s: ReturnType<typeof emptyLocalSession>, a: Parameters<typeof reduce>[1]) =>
    localSessionReducer(warmup, s, a)
  let s = emptyLocalSession(warmup, {}, ['mirror'])
  expect(s.orientation).toEqual(STANDARD_ORIENTATION)
  expect(s.views[warmup[0].id].full).toBe(true)
  s = step(s, { type: 'focus-airway' })
  s = step(s, { type: 'begin' })
  expect(step(s, { type: 'orientation', value: orientationFor('mirror') })).toBe(s)
  s = step(s, { type: 'mark', mark: { slice: warmup[0].answerPoints[0].slice, pixel: [200, 200] } })
  s = step(s, { type: 'check' })
  const history = s.history
  s = step(s, { type: 'next' })
  expect(s.orientation).toEqual(STANDARD_ORIENTATION)
  expect(s.orientationGuide).toBeNull()
  s = step(s, { type: 'restart' })
  expect(s.orientation).toEqual(STANDARD_ORIENTATION)
  expect(s.orientationGuide).toBe('context')
  expect(s.history).toEqual(history)
})
it.each(['mirror', 'rul', 'upper-division'] as const)(
  'teaches %s before tracing, gates comprehension, and preserves the first response',
  (preset) => {
    const exercise = LESSONS.flatMap((l) => l.exercises ?? [])
      .map(localExercise)
      .find((ex) => ex.trace.preset === preset && ex.spec.kind === 'pattern')!
    const step = (s: ReturnType<typeof emptyLocalSession>, a: Parameters<typeof reduce>[1]) =>
      localSessionReducer([exercise], s, a)
    let s = emptyLocalSession([exercise])
    expect(s.orientation).toEqual(STANDARD_ORIENTATION)
    expect(s.orientationGuide).toBeNull()
    s = step(s, { type: 'explain-orientation' })
    expect(s.orientationGuide).toBe('direction')
    expect(step(s, { type: 'begin' })).toBe(s)
    expect(step(s, { type: 'orientation', value: orientationFor(preset) })).toBe(s)
    s = step(s, { type: 'demonstrate-orientation' })
    expect(s.orientation).toEqual(orientationFor(preset))
    expect(orientationLabels(s.orientation)).toEqual(
      preset === 'mirror'
        ? { top: 'A', right: 'R', bottom: 'P', left: 'L' }
        : preset === 'rul'
          ? { top: 'L', right: 'P', bottom: 'R', left: 'A' }
          : { top: 'R', right: 'A', bottom: 'L', left: 'P' },
    )
    s = step(s, { type: 'orientation-response', value: 'anatomy' })
    expect(step(s, { type: 'finish-orientation' })).toBe(s)
    expect(parseLocalSession(s, [exercise])).toEqual(s)
    s = step(s, { type: 'orientation', value: STANDARD_ORIENTATION })
    expect(s.orientation).toEqual(STANDARD_ORIENTATION)
    s = step(s, { type: 'orientation-response', value: 'display' })
    expect(s.orientationGuide).toBe('compare')
    s = step(s, { type: 'finish-orientation' })
    expect(s.orientationGuide).toBeNull()
    expect(s.orientation).toEqual(STANDARD_ORIENTATION)
    expect(s.orientationResponses[preset]).toEqual(['anatomy', 'display'])
    expect(emptyLocalSession([exercise], {}, s.taughtPresets).orientationGuide).toBeNull()
    expect(step(s, { type: 'restart' }).orientationResponses).toEqual(s.orientationResponses)
  },
)
it('migrates pre-onboarding drafts without losing marks, branch responses or historical orientations', () => {
  const current = reduce(answer(), { type: 'check' })
  const legacy: Record<string, unknown> = { ...current, orientation: orientationFor('mirror') }
  legacy.history = Object.fromEntries(
    Object.entries(current.history).map(([id, attempts]) => [
      id,
      attempts.map((attempt) => ({ ...attempt, orientation: orientationFor('mirror') })),
    ]),
  )
  delete legacy.orientationGuide
  delete legacy.taughtPresets
  delete legacy.orientationResponses
  const restored = parseLocalSession(legacy, exercises)!
  expect(restored.phase).toBe('compare')
  expect(restored.orientationGuide).toBeNull()
  expect(restored.orientation).toEqual(orientationFor('mirror'))
  expect(restored.marks).toEqual(current.marks)
  expect(restored.history).toEqual(legacy.history)
  expect(restored.branch).toEqual(current.branch)
  expect(restored.views).toEqual(current.views)
  expect(parseLocalSession(restored, exercises)).toEqual(restored)
  expect(
    parseLocalSession({ ...restored, orientation: orientationFor('rul') }, exercises),
  ).not.toBeNull()
})
it('restores only compatible, structurally valid drafts and reports damaged or changed versions', () => {
  const storage = window.localStorage
  const signature = draftSignature(exercises)
  const s = reduce(answer(), { type: 'check' })
  const parse = (v: unknown) => parseLocalSession(v, exercises)
  expect(writeCtDraft(storage, 'unit', signature, s)).toBe(true)
  expect(readCtDraft(storage, 'unit', signature, parse).value).toEqual(s)
  expect(readCtDraft(storage, 'unit', 'changed-geometry', parse).notice).toMatch(
    /cannot be resumed/,
  )
  expect(parse({ ...s, exercise: 100 })).toBeNull()
  expect(parse({ ...s, marks: [{ slice: 300, pixel: null }] })).toBeNull()
  expect(writeCtDraft(null, 'unit', signature, s)).toBe(false)
})
it('keeps parent-view projection finite, independent of CT display rotation, and retains siblings', () => {
  for (const exercise of exercises) {
    const map = parentMap(exercise.trace)!
    expect(map.points).toHaveLength(exercise.answerPoints.length)
    expect(map.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(map.axes.length).toBeGreaterThan(0)
    const reordered = JSON.parse(JSON.stringify(exercise.trace)) as typeof exercise.trace
    reordered.checkpoints[0].decision!.options.reverse()
    expect(parentMap(reordered)!.points.map((p) => [p.edgeId, p.number])).toEqual(
      map.points.map((p) => [p.edgeId, p.number]),
    )
  }
})
