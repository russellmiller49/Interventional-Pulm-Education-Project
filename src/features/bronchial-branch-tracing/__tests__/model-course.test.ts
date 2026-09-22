import routes from '../geometry/paired-routes.json'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { courseLocatorNote, modelCourseLocators } from '../engine/model-course'
import { NATIVE_CT, sliceZ } from '../geometry/native-ct'

/**
 * BBT-PRE-REVIEW-03, section D (BBTF-26). Intermediate demonstration planes carry a model course
 * locator only where a source edge of the current division actually crosses that native plane.
 * Each locator lies on the unchanged graph polyline; none is interpolated across structures or
 * placed on a plane that already carries an authored locator.
 */
const onEdge = (edgeId: number, pixel: [number, number], slice: number) => {
  const edge = routes.edges.find((e) => e.id === edgeId)!
  const z = sliceZ(slice)
  const lps = [
    NATIVE_CT.origin[0] + pixel[0] * NATIVE_CT.spacing[0],
    NATIVE_CT.origin[1] + pixel[1] * NATIVE_CT.spacing[1],
    z,
  ]
  let best = Infinity
  for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1],
      b = edge.points[i]
    if ((z - a[2]) * (z - b[2]) > 0 || a[2] === b[2]) continue
    const f = (z - a[2]) / (b[2] - a[2])
    const p = a.map((v, k) => v + f * (b[k] - v))
    best = Math.min(best, Math.hypot(...p.map((v, k) => v - lps[k])))
  }
  return best
}

test('the first bifurcation: the parent crosses the planes above its node, the demonstrated daughter below it, and nothing sits on an authored plane', () => {
  const exercise = localExercise(LESSONS.find((l) => l.id === 'continuity')!.exercises![0])
  const parentEdge = exercise.trace.checkpoints[0].decision!.parent.sourceEdgeId
  let parentPlanes = 0,
    daughterPlanes = 0
  exercise.frames.forEach((frame, index) => {
    const locators = modelCourseLocators(exercise, index)
    if (frame.overlays.length) {
      expect(locators).toEqual([])
      return
    }
    expect(locators.length).toBeGreaterThan(0)
    for (const l of locators) {
      expect(l.slice).toBe(frame.slice)
      expect(onEdge(l.edgeId, l.pixel, frame.slice)).toBeLessThan(1e-6)
      expect(l.pixel.every((v) => v >= 0 && v <= 511)).toBe(true)
      if (l.role === 'parent') {
        expect(l.edgeId).toBe(parentEdge)
        parentPlanes++
      } else daughterPlanes++
    }
    // Above the model node only the parent crosses; below it only a daughter does.
    const roles = new Set(locators.map((l) => l.role))
    if (frame.slice >= 393) expect(roles).toEqual(new Set(['parent']))
    if (frame.slice <= 391) expect(roles).toEqual(new Set(['daughter']))
  })
  expect(parentPlanes).toBeGreaterThan(0)
  expect(daughterPlanes).toBeGreaterThan(0)
  // Both daughters are marked on the same response plane, so both are demonstrated in one pass
  // and both model crossings are shown below the node.
  const below = exercise.frames.findIndex((f) => f.slice === 390)
  expect(modelCourseLocators(exercise, below).map((l) => l.roleLabel)).toEqual([
    'Daughter A',
    'Daughter B',
  ])
  expect(courseLocatorNote(modelCourseLocators(exercise, below))).toBe(
    'Dotted gold crosshair: where the model centreline of Daughter A · RMSB and Daughter B · LMSB crosses this plane. A model course locator, not a reviewed lumen boundary.',
  )
  expect(courseLocatorNote([])).toBeNull()
})

test('a daughter marked on a different plane gets its own pass after the return to the parent', () => {
  const exercise = localExercise(LESSONS.find((l) => l.id === 'vertical')!.exercises![0])
  const start = exercise.trace.anchor.slice
  const firstPass = exercise.frames.findIndex((f) => f.slice === 419)
  expect(modelCourseLocators(exercise, firstPass).map((l) => l.roleLabel)).toEqual(['Daughter A'])
  const secondVisit = exercise.frames.findIndex((f, i) => i > firstPass && f.slice === start)
  const secondPass = exercise.frames.findIndex((f, i) => i > secondVisit && f.slice === 419)
  expect(secondPass).toBeGreaterThan(secondVisit)
  expect(modelCourseLocators(exercise, secondPass).map((l) => l.roleLabel)).toEqual(['Daughter B'])
  // Consecutive parent frames (end of the return trip, start of the next pass) are one visit.
  const returnEnd = exercise.frames.findIndex((f, i) => i > firstPass && f.slice === start)
  expect(exercise.frames[returnEnd + 1].slice).toBe(start)
  expect(modelCourseLocators(exercise, returnEnd)).toEqual([])
  expect(modelCourseLocators(exercise, returnEnd + 1)).toEqual([])
})

test('every local exercise: locators lie on the graph, name only edges of the division or its approach, and never move an answer point', () => {
  for (const lesson of LESSONS)
    for (const spec of lesson.exercises ?? []) {
      const exercise = localExercise(spec)
      const decision = exercise.trace.checkpoints[0].decision
      const allowed = new Set([
        decision?.parent.sourceEdgeId ?? exercise.trace.checkpoints[0].sourceEdgeId,
        ...(decision?.options.map((o) => o.sourceEdgeId) ?? []),
      ])
      const before = JSON.stringify(exercise.answerPoints)
      exercise.frames.forEach((frame, index) => {
        for (const l of modelCourseLocators(exercise, index)) {
          if (l.role !== 'approach') expect(allowed.has(l.edgeId)).toBe(true)
          expect(onEdge(l.edgeId, l.pixel, frame.slice)).toBeLessThan(1e-6)
        }
      })
      expect(JSON.stringify(exercise.answerPoints)).toBe(before)
    }
  // The same-lumen intervals follow one edge only.
  const trachea = localExercise(LESSONS[0].exercises![0])
  for (let i = 1; i < trachea.frames.length - 1; i++) {
    const locators = modelCourseLocators(trachea, i)
    expect(locators.map((l) => l.role)).toEqual(['parent'])
    expect(locators[0].code).toBe('Trachea')
  }
  // The LB6 route map's approach lead-in names the LLL approach edge before the parent is reached.
  const leadIn = localExercise(LESSONS.find((l) => l.id === 'orientation-changes')!.exercises![0])
  const approach = modelCourseLocators(leadIn, 1)
  expect(approach.some((l) => l.role === 'approach' && l.code === 'LLL')).toBe(true)
})
