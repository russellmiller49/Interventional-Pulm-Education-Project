import fs from 'node:fs'
import { LESSONS, lessonAfter, ORIENTATION_CONTRACT } from '../content/lessons'
import { localExercise, modelPoint } from '../content/local-exercises'
import { NATIVE_CT, traceById } from '../geometry/native-ct'
import { validJunctionHistory } from '../engine/route-draft'
import { pairedScope } from '../geometry/paired-scope'
import {
  completedLessons,
  hasHistoricalOrientation,
  PREFIX,
  readProgress,
  saveVisit,
} from '../engine/progress'
import { DRAFT_PREFIX, readCtDraft, writeCtDraft } from '../engine/ct-draft'
import { emptyLocalSession, localSessionReducer, parseLocalSession } from '../engine/local-session'
import { orientationFor, STANDARD_ORIENTATION } from '../geometry/orientation'

beforeEach(() => localStorage.clear())
it('retains all nine identities and resolves the opening dependency from the registry', () => {
  expect(LESSONS).toHaveLength(9)
  expect(LESSONS.slice(0, 3).map((l) => l.id)).toEqual([
    'follow-one-airway',
    'orientation',
    'continuity',
  ])
  expect(lessonAfter('follow-one-airway')?.id).toBe('orientation')
  expect(new Set(LESSONS.map((l) => l.id)).size).toBe(9)
})
it('versions only the new orientation completion, retaining earlier participation and unrelated completion', () => {
  saveVisit('continuity', true)
  const prior = readProgress()
  const progress: typeof prior = {
    ...prior,
    activities: [
      ...prior.activities,
      {
        activityId: `${PREFIX}.learn.orientation`,
        status: 'completed',
        attempts: 1,
        competencyEvidenceIds: [],
        updatedAt: new Date().toISOString(),
      },
    ],
  }
  expect(hasHistoricalOrientation(progress)).toBe(true)
  expect(completedLessons(progress)).toEqual(['continuity'])
  expect(progress.activities.some((a) => a.activityId.endsWith(ORIENTATION_CONTRACT))).toBe(false)
  saveVisit('orientation', true)
  expect(completedLessons(readProgress())).toEqual(['orientation', 'continuity'])
})
it('all local source examples carry exact source provenance and provisional overlay semantics', () => {
  for (const lesson of LESSONS)
    for (const spec of lesson.exercises ?? []) {
      const ex = localExercise(spec)
      expect(ex.teaching.sourceSha256).toMatch(/^[0-9a-f]{64}$/)
      expect(ex.teaching.graphSha256).toMatch(/^[0-9a-f]{64}$/)
      expect(ex.teaching.overlayKind).toBe('model-locator')
      expect(ex.review.status).toBe('provisional')
      if (['same-lumen', 'viewpoint'].includes(spec.kind))
        expect(ex.trace.checkpoints[0].sourceHu).toBeUndefined()
      expect(
        ex.frames.every((f) => f.caption.includes('slice') || f.caption.includes('Slice')),
      ).toBe(true)
      expect(ex.frames.flatMap((f) => f.overlays).every((o) => !o.contour)).toBe(true)
    }
})
it('the short map includes every source fork in its declared LB6 interval, with caudal approach context explicitly separate', () => {
  const lesson = LESSONS.find((l) => l.id === 'orientation-changes')!
  const examples = lesson.exercises!.map(localExercise)
  const source = traceById('left-lower-returning')
  const graph = JSON.parse(
    fs.readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json', 'utf8'),
  ) as { edges: { id: number; startNodeId: number; endNodeId: number }[] }
  const first = source.sourceEdgeIds.indexOf(examples[0].teaching.parentEdge)
  const last = source.sourceEdgeIds.indexOf(examples.at(-1)!.trace.checkpoints[0].sourceEdgeId)
  const edges = source.sourceEdgeIds.slice(first, last)
  const forks = edges
    .map((id) => graph.edges.find((e) => e.id === id)!.endNodeId)
    .filter((node) => graph.edges.filter((e) => e.startNodeId === node).length > 1)
  expect(examples.map((e) => e.trace.checkpoints[0].decision!.nodeId)).toEqual(forks)
  expect(examples[0].frames[0].caption).toMatch(/Approach context/)
  const levels = examples[0].frames.map((f) => f.slice)
  expect(levels.some((s, i) => i > 0 && s < levels[i - 1])).toBe(true)
  expect(levels.some((s, i) => i > 0 && s > levels[i - 1])).toBe(true)
})
it('matching a returning plane stays within the active source interval and reports unavailable correspondence elsewhere', () => {
  const trace = traceById('left-lower-returning')
  const active = trace.checkpoints.findIndex((c) => c.id === 'junction-11')
  expect(pairedScope(trace, 335, active, false).planeGapMm).toBeLessThan(0.01)
  expect(pairedScope(trace, 335, 0, false).planeGapMm).toBeGreaterThan(1)
})
it('local locators choose the nearby source crossing instead of the first polyline intersection', () => {
  const near = [-51.86720457718, -166.61338701338, -176.5]
  const pixel = modelPoint(7, 384, near)
  expect(pixel[0] * NATIVE_CT.spacing[0] + NATIVE_CT.origin[0]).toBeCloseTo(near[0], 6)
  expect(pixel[1] * NATIVE_CT.spacing[1] + NATIVE_CT.origin[1]).toBeCloseTo(near[1], 6)
})
it('stored route attempts cannot be restored against a different source division', () => {
  const trace = traceById('left-lower-returning')
  const key = `${trace.id}.${trace.checkpoints[0].id}`
  const attempt = {
    mark: { slice: trace.checkpoints[0].slice, pixel: null },
    branch: 'unresolved' as const,
  }
  expect(validJunctionHistory({ [key]: [attempt] }, [trace])).toBe(true)
  expect(
    validJunctionHistory({ [key]: [{ ...attempt, mark: { ...attempt.mark, slice: 0 } }] }, [trace]),
  ).toBe(false)
  expect(validJunctionHistory({ 'other-case.junction-1': [attempt] }, [trace])).toBe(false)
})
it('fresh examples and retries remain standard while compatible transformed drafts preserve marks and display', () => {
  const examples = LESSONS.find((l) => l.id === 'vertical')!.exercises!.map(localExercise)
  let s = emptyLocalSession(examples, {}, ['rul'])
  expect(s.orientation).toEqual(STANDARD_ORIENTATION)
  s = localSessionReducer(examples, s, { type: 'begin' })
  s = localSessionReducer(examples, s, { type: 'orientation', value: orientationFor('rul') })
  s = localSessionReducer(examples, s, {
    type: 'mark',
    mark: { slice: examples[0].answerPoints[0].slice, pixel: [220, 240] },
  })
  expect(parseLocalSession(s, examples)?.orientation).toEqual(orientationFor('rul'))
  const marks = JSON.stringify(s.marks)
  s = localSessionReducer(examples, s, { type: 'orientation', value: STANDARD_ORIENTATION })
  expect(JSON.stringify(s.marks)).toBe(marks)
  expect(localSessionReducer(examples, s, { type: 'restart' }).orientation).toEqual(
    STANDARD_ORIENTATION,
  )
})
it('archives incompatible drafts before replacement and refuses to overwrite when recovery storage fails', () => {
  const key = DRAFT_PREFIX + 'learn.orientation'
  const old = JSON.stringify({
    version: 1,
    signature: 'prior-contract',
    value: { marks: ['recoverable'] },
  })
  localStorage.setItem(key, old)
  expect(writeCtDraft(localStorage, 'learn.orientation', 'current', {})).toBe(true)
  expect(localStorage.getItem(key + '.recovery.prior-contract')).toBe(old)
  const denied = {
    getItem: () => old,
    setItem: () => {
      throw Error('quota')
    },
  } as unknown as Storage
  expect(writeCtDraft(denied, 'learn.orientation', 'current', {})).toBe(false)
  const damaged = JSON.stringify({ version: 1, signature: 'current', value: { invalid: true } })
  localStorage.setItem(key, damaged)
  expect(readCtDraft(localStorage, 'learn.orientation', 'current', () => null).value).toBeNull()
  expect(writeCtDraft(localStorage, 'learn.orientation', 'current', {})).toBe(true)
  expect(localStorage.getItem(key + '.recovery.current')).toBe(damaged)
})
