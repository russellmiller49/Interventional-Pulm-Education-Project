import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  STANDARD_ORIENTATION,
  turnCt,
  orientationLabels,
  orientationFor,
  orientationName,
  orientationTransform,
  orientedPixel,
  nativePixel,
  orientPoint,
  unorientPoint,
  sameOrientation,
  validOrientation,
  type CtOrientation,
} from '../geometry/orientation'
import { CT_TRACES } from '../geometry/native-ct'
import { scopeUp } from '../geometry/route-stations'
import { cameraFrame, dot, type Vec3 } from '../geometry/coordinates'
import routes from '../geometry/paired-routes.json'

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

test('every display has one name and one transform, and a point comes back through its inverse', () => {
  const all: CtOrientation[] = [false, true].flatMap((reflected) =>
    ([0, 1, 2, 3] as const).map((turns) => ({ turns, reflected })),
  )
  expect(all.map(orientationName)).toEqual([
    'Standard axial',
    '90° clockwise',
    '180° rotation',
    '90° counterclockwise',
    'Left–right reflection',
    'Left–right reflection + 90° clockwise',
    'Left–right reflection + 180° rotation',
    'Left–right reflection + 90° counterclockwise',
  ])
  expect(new Set(all.map(orientationTransform)).size).toBe(8)
  expect(orientationTransform(STANDARD_ORIENTATION)).toBe('rotate(0) scale(1 1)')
  expect(orientationTransform({ turns: 3, reflected: true })).toBe('rotate(-90) scale(-1 1)')
  for (const o of all) {
    expect(validOrientation(o)).toBe(true)
    const [x, y] = unorientPoint(orientPoint([17, -9], o), o)
    expect([x, y]).toEqual([17, -9])
    expect(all.filter((other) => sameOrientation(o, other))).toEqual([o])
  }
  expect(validOrientation({ turns: 4 as CtOrientation['turns'], reflected: false })).toBe(false)
  // Four quarter turns either way, or two flips, return to where they began.
  let o: CtOrientation = { turns: 1, reflected: true }
  for (let i = 0; i < 4; i++) o = turnCt(o, 'right')
  expect(o).toEqual({ turns: 1, reflected: true })
  // The book's regional displays, by preset.
  expect(orientationFor('standard')).toEqual(STANDARD_ORIENTATION)
  expect(orientationName(orientationFor('mirror'))).toBe('Left–right reflection')
  expect(orientationName(orientationFor('rul'))).toBe('90° counterclockwise')
  expect(orientationName(orientationFor('upper-division'))).toBe('90° clockwise')
})

test('paired routes retain unchanged source geometry', () => {
  const bytes = readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json')
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(routes.sourceSha256)
  const source = JSON.parse(bytes.toString())
  for (const e of routes.edges)
    expect(e.points).toEqual(source.edges.find((v: { id: number }) => v.id === e.id).pointsLps)
  // Every edge a route travels is in the paired set.
  const paired = new Set(routes.edges.map((e) => e.id))
  for (const trace of CT_TRACES)
    for (const id of trace.sourceEdgeIds)
      expect([trace.id, id, paired.has(id)]).toEqual([trace.id, id, true])
})

test('the scope roll matches the book display axes for cranial and caudal viewing', () => {
  for (const preset of ['mirror', 'rul', 'upper-division'] as const) {
    const forward: Vec3 = [0, 0, preset === 'mirror' ? -1 : 1]
    const frame = cameraFrame([0, 0, 0], forward, scopeUp(preset, forward), 0)
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
  expect(scopeUp('mirror', [0, -1, 0])).toEqual([0, 0, 1])
})
