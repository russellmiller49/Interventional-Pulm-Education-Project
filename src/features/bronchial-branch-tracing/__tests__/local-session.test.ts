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

const exercises = LESSONS.find((l) => l.id === 'continuity')!.exercises!.map(localExercise)
const reduce = (
  s: ReturnType<typeof emptyLocalSession>,
  action: Parameters<typeof localSessionReducer>[2],
) => localSessionReducer(exercises, s, action)
function answer(s = emptyLocalSession(exercises)) {
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
  expect(s.hints).toBe(0)
  expect(s.history[exercises[0].id][0].hints).toBe(3)
  s = answer(s)
  s = reduce(s, { type: 'check' })
  expect(s.history[exercises[0].id]).toHaveLength(2)
  expect(JSON.stringify(s.history[exercises[0].id][0])).toBe(first)
  expect(reduce(s, { type: 'next' })).toBe(s)
  s = reduce(s, { type: 'parent-view' })
  expect(reduce(s, { type: 'next' })).toBe(s)
  s = reduce(s, { type: 'view-answer', value: 'unresolved' })
  s = reduce(s, { type: 'next' })
  expect(s.exercise).toBe(1)
  expect(s.phase).toBe('attempt')
  expect(s.hints).toBe(0)
  s = reduce(s, { type: 'restart' })
  expect(JSON.stringify(s.history[exercises[0].id][0])).toBe(first)
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
