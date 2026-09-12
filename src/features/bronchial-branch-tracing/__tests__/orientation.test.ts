import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  STANDARD_ORIENTATION,
  turnCt,
  orientationLabels,
  orientationFor,
  orientedPixel,
  nativePixel,
  type CtOrientation,
} from '../geometry/orientation'
import { CT_TRACES, sliceZ, traceById } from '../geometry/native-ct'
import { pairedScope, bookScopeUp } from '../geometry/paired-scope'
import { cameraFrame, dot, type Vec3 } from '../geometry/coordinates'
import { orientPoint } from '../geometry/orientation'
import routes from '../geometry/paired-routes.json'
import { ctSessionReducer, emptyCtSession } from '../engine/ct-session'

test('manual rotations and screen reflection preserve patient pixels in all eight orientations', () => {
  const expected = [
    ['A', 'L', 'P', 'R'],
    ['R', 'A', 'L', 'P'],
    ['P', 'R', 'A', 'L'],
    ['L', 'P', 'R', 'A'],
    ['A', 'R', 'P', 'L'],
    ['L', 'A', 'R', 'P'],
    ['P', 'L', 'A', 'R'],
    ['R', 'P', 'L', 'A'],
  ]
  for (const reflected of [false, true])
    for (const turns of [0, 1, 2, 3] as const) {
      const o = { turns, reflected }
      const labels = orientationLabels(o)
      expect([labels.top, labels.right, labels.bottom, labels.left]).toEqual(
        expected[turns + (reflected ? 4 : 0)],
      )
      for (const trace of CT_TRACES)
        for (const cp of trace.checkpoints) {
          const display = orientedPixel(cp.pixel, trace.cropCenter, trace.cropSize, o)
          const native = nativePixel(display, trace.cropCenter, trace.cropSize, o)
          expect(native[0]).toBeCloseTo(cp.pixel[0], 10)
          expect(native[1]).toBeCloseTo(cp.pixel[1], 10)
          const flipped = orientedPixel(
            cp.pixel,
            trace.cropCenter,
            trace.cropSize,
            turnCt(o, 'flip'),
          )
          expect(flipped[0]).toBeCloseTo(100 - display[0], 10)
          expect(flipped[1]).toBeCloseTo(display[1], 10)
        }
      expect(turnCt(turnCt(o, 'flip'), 'flip')).toEqual(o)
      expect(turnCt(turnCt(o, 'left'), 'right')).toEqual(o)
      expect(turnCt(o, 'reset')).toEqual(STANDARD_ORIENTATION)
    }
})

test('paired routes retain unchanged source geometry and report actual plane correspondence', () => {
  const bytes = readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json')
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(routes.sourceSha256)
  const source = JSON.parse(bytes.toString())
  for (const e of routes.edges)
    expect(e.points).toEqual(source.edges.find((v: { id: number }) => v.id === e.id).pointsLps)
  for (const trace of CT_TRACES)
    for (const [i, cp] of trace.checkpoints.entries()) {
      const pose = pairedScope(trace, cp.slice, i, false)
      expect(pose.planeGapMm).toBeLessThanOrEqual(0.251)
      expect(Math.abs(pose.point[2] - sliceZ(cp.slice))).toBeCloseTo(pose.planeGapMm, 8)
      expect(Math.hypot(...pose.direction)).toBeCloseTo(1, 8)
      expect(pose.position.every(Number.isFinite)).toBe(true)
    }
  const trace = traceById('middle-lobe-caudal')
  const proximal = pairedScope(trace, 299, 5, false),
    distal = pairedScope(trace, 299, 6, false)
  expect(distal.arc).toBeGreaterThan(proximal.arc)
  expect(pairedScope(trace, 0, 0, false).planeGapMm).toBeGreaterThan(1)
})

test('the reference scope roll matches the book display axes for cranial and caudal viewing', () => {
  for (const preset of ['mirror', 'rul', 'upper-division'] as const) {
    const forward: Vec3 = [0, 0, preset === 'mirror' ? -1 : 1]
    const frame = cameraFrame([0, 0, 0], forward, bookScopeUp(preset, forward), 0)
    for (const patient of [
      [1, 0, 0],
      [0, 1, 0],
    ] as Vec3[]) {
      const projected = [dot(patient, frame.right), -dot(patient, frame.up)]
      const ct = orientPoint(patient, orientationFor(preset))
      expect(projected[0]).toBeCloseTo(ct[0], 8)
      expect(projected[1]).toBeCloseTo(ct[1], 8)
    }
  }
  expect(bookScopeUp('mirror', [0, -1, 0])).toEqual([0, 0, 1])
})

test('orientation is required, a wrong first response survives correction, and transfer starts standard', () => {
  const prediction = traceById('middle-lobe-caudal'),
    transfer = traceById('right-upper-apical')
  const reduce = ctSessionReducer(prediction, transfer)
  let s = reduce(emptyCtSession(), { type: 'advance' })
  const mark = {
    type: 'mark' as const,
    index: 0,
    mark: { slice: prediction.checkpoints[0].slice, pixel: null },
  }
  expect(reduce(s, mark)).toBe(s)
  expect(reduce(s, { type: 'check-orientation' })).toBe(s)
  const wrong: CtOrientation = { turns: 1, reflected: false }
  s = reduce(reduce(s, { type: 'orientation', value: wrong }), { type: 'check-orientation' })
  expect(s.alignment).toBeNull()
  expect(reduce(s, mark)).toBe(s)
  s = reduce(reduce(s, { type: 'orientation', value: orientationFor(prediction.preset) }), {
    type: 'check-orientation',
  })
  for (const [i, cp] of prediction.checkpoints.entries()) {
    s = reduce(s, { type: 'active', index: i })
    if (cp.decision) s = reduce(s, { type: 'branch', index: i, value: 'unresolved' })
    s = reduce(s, { type: 'mark', index: i, mark: { slice: cp.slice, pixel: null } })
    s = reduce(s, { type: 'record-junction' })
  }
  s = reduce(s, { type: 'advance' })
  s = reduce(s, { type: 'course', value: 'uncertain' })
  s = reduce(s, { type: 'target-relation', value: 'unresolved' })
  s = reduce(s, { type: 'advance' })
  expect(s.prediction?.orientation.first).toEqual(wrong)
  expect(s.prediction?.orientation.used).toEqual(orientationFor(prediction.preset))
  s = reduce(reduce(s, { type: 'advance' }), { type: 'advance' })
  expect(s.orientation).toEqual(STANDARD_ORIENTATION)
  expect(s.alignment).toBeNull()
  expect(s.orientationAttempts).toEqual([])
  expect(reduce(s, { type: 'advance' })).toBe(s)
  const completed = { ...s, complete: true }
  expect(reduce(completed, { type: 'orientation', value: wrong })).toMatchObject({
    complete: true,
    orientation: wrong,
  })
  expect(reduce(completed, { type: 'active', index: 2 })).toMatchObject({
    complete: true,
    active: 2,
  })
  expect(reduce(completed, { type: 'advance' })).toBe(completed)
})
