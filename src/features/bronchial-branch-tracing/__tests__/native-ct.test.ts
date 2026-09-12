import { orientationFor } from '../geometry/orientation'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import manifest from '../../../../public/branch-tracing/native-v1/manifest.json'
import legacy from '../../../../public/branch-tracing/targets-v1/manifest.json'
import {
  CT_TRACES,
  NATIVE_CT,
  displayToPixel,
  pixelToDisplay,
  sliceZ,
  ORIENTATION_LABELS,
  targetForTrace,
} from '../geometry/native-ct'
import { LESSONS, lessonLocationErrors } from '../content/lessons'
import { ctSessionReducer, emptyCtSession } from '../engine/ct-session'

function pngPixels(bytes: Buffer) {
  expect(bytes.readUInt32BE(16)).toBe(512)
  expect(bytes.readUInt32BE(20)).toBe(512)
  expect(bytes[24]).toBe(8)
  expect(bytes[25]).toBe(0) // grayscale
  const chunks: Buffer[] = []
  for (let offset = 8; offset < bytes.length; ) {
    const size = bytes.readUInt32BE(offset)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(bytes.subarray(offset + 8, offset + 8 + size))
    offset += size + 12
  }
  const raw = inflateSync(Buffer.concat(chunks))
  expect(raw.length).toBe(513 * 512)
  for (let j = 0; j < 512; j++) expect(raw[j * 513]).toBe(0)
  return raw
}
test('native Slicer PNGs match their hashes and source HU window at every comparison point', () => {
  expect(manifest.sourceSha256).toBe(
    '572afc5bf6b2d80b28439e0397ad4e24e4eb6dfb2630780593259e081ae0a29b',
  )
  expect(manifest.sizeXyz).toEqual([512, 512, 636])
  expect(manifest.spacingXyzMm).toEqual(NATIVE_CT.spacing)
  expect(manifest.assets).toHaveLength(236)
  const slices = new Map<number, Buffer>()
  for (const asset of manifest.assets) {
    const bytes = readFileSync(`public/branch-tracing/native-v1/${asset.path}`)
    expect(bytes.length).toBe(asset.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256)
    const slice = Number(asset.path.match(/(\d+)\.png/)![1])
    slices.set(slice, pngPixels(bytes))
  }
  for (const trace of [...manifest.traces, ...CT_TRACES]) {
    expect(trace.anchor.slice).toBeGreaterThanOrEqual(trace.range[0])
    expect(trace.anchor.slice).toBeLessThanOrEqual(trace.range[1])
    for (const point of trace.checkpoints) {
      expect(point.slice).toBeGreaterThanOrEqual(trace.range[0])
      expect(point.slice).toBeLessThanOrEqual(trace.range[1])
      expect(point.sourceHu).toBeLessThan(-800)
      const x = Math.round(point.pixel[0]),
        y = Math.round(point.pixel[1])
      const intensity = slices.get(point.slice)![y * 513 + 1 + x]
      const expected = Math.round(Math.max(0, Math.min(1, (point.sourceHu + 1000) / 1400)) * 255)
      expect(Math.abs(intensity - expected)).toBeLessThanOrEqual(1)
      expect(Math.abs(point.lps[2] - sliceZ(point.slice))).toBeLessThanOrEqual(0.251)
      for (let i = 0; i < 2; i++)
        expect(point.pixel[i] * NATIVE_CT.spacing[i] + NATIVE_CT.origin[i]).toBeCloseTo(
          point.lps[i],
          3,
        )
    }
  }
})
test('book rotations and reflection preserve native pixel identity in full field and detail views', () => {
  expect(ORIENTATION_LABELS.rul.bottom).toBe('R')
  expect(ORIENTATION_LABELS['upper-division'].bottom).toBe('L')
  expect(ORIENTATION_LABELS.mirror.right).toBe('R')
  for (const trace of CT_TRACES)
    for (const preset of ['standard', 'mirror', 'rul', 'upper-division'] as const)
      for (const point of trace.checkpoints)
        for (const [center, size] of [
          [point.cropCenter ?? trace.cropCenter, point.cropSize ?? trace.cropSize],
          [[255.5, 255.5], 512],
        ] as const) {
          const screen = pixelToDisplay(point.pixel, center, size, preset)
          const recovered = displayToPixel(screen, center, size, preset)
          expect(recovered[0]).toBeCloseTo(point.pixel[0], 10)
          expect(recovered[1]).toBeCloseTo(point.pixel[1], 10)
          expect(screen.every((n) => n > 0 && n < 100)).toBe(true)
        }
  // An asymmetric landmark moves left -> down for the book's RUL CCW display.
  expect(pixelToDisplay([20, 40], [40, 40], 100, 'rul')).toEqual([50, 70])
  expect(pixelToDisplay([20, 40], [40, 40], 100, 'mirror')).toEqual([70, 50])
})
test('every lesson has real CT traces, a changed transfer and a visible stage landmark', () => {
  expect(lessonLocationErrors()).toEqual([])
  for (const lesson of LESSONS) {
    for (const id of [lesson.example, lesson.prediction, lesson.transfer])
      expect(CT_TRACES.some((t) => t.id === id)).toBe(true)
    expect(lesson.prediction).not.toBe(lesson.transfer)
    expect(targetForTrace(CT_TRACES.find((t) => t.id === lesson.prediction)!).id).not.toBe(
      targetForTrace(CT_TRACES.find((t) => t.id === lesson.transfer)!).id,
    )
  }
})
test('preserved c3 source checkpoints distinguish segment identity from CT indices and distal sampling positions', () => {
  const codes: Record<string, string[]> = {
    'central-right': ['Trachea', 'RMSB', 'RB5b'],
    'central-left': ['Trachea', 'LMSB', 'LB5'],
    'right-upper-entry': ['RMSB', 'RUL', 'RB1b'],
    'right-upper-apical': ['RB1/B2', 'RB1', 'RB1b'],
    'right-upper-distal': ['RB1', 'RB1a', 'RB1a'],
    'middle-lobe-entry': ['BI', 'RML', 'RB5a'],
    'middle-lobe-lateral': ['RML', 'RML', 'RB4a'],
    'middle-lobe-caudal': ['RB5', 'RB5', 'RB5b'],
    'middle-lobe-cranial': ['RB5', 'RB5', 'RB5a'],
    'upper-oblique-lateral': ['RB3a', 'RB3a', 'RB3a'],
    'upper-oblique-medial': ['RB3a', 'RB3a', 'RB3a'],
    'left-upper-division': ['LUL', 'LUL division', 'LB1+2'],
    'left-upper-anterior': ['LUL division', 'LUL division', 'LB3'],
    'left-lingula': ['LUL', 'LB4+5', 'LB5'],
    'left-lower-returning': ['LLL', 'LB6', 'LB6'],
    'right-lower-basal': ['RLL', 'R basal', 'RB8'],
    'left-lower-basal': ['L basal', 'L basal', 'LB9'],
  }
  expect(legacy.traces.map((t) => t.id).sort()).toEqual(Object.keys(codes).sort())
  for (const trace of legacy.traces) {
    expect(trace.checkpoints.map((p) => p.airway.code)).toEqual(codes[trace.id])
    expect(new Set(trace.checkpoints.map((p) => `${p.airway.code}:${p.landmark}`)).size).toBe(3)
    expect(trace.anchor.airway.name).toBeTruthy()
  }
  const middle = legacy.traces.find((t) => t.id === 'middle-lobe-caudal')!
  // Two separate positions in RB5 share an acquisition plane. They are not two segments.
  expect(middle.checkpoints[0].slice).toBe(middle.checkpoints[1].slice)
  expect(middle.checkpoints.slice(0, 2).map((p) => p.landmark)).toEqual(['Proximal', 'Distal'])
})
test('anatomical labels use the exact matching case graph and preserve the source branch lineage', () => {
  const labels = readFileSync('public/airway-anatomy/case-001/metadata/centerline_labels.json')
  expect(createHash('sha256').update(labels).digest('hex')).toBe(
    manifest.nomenclature.sourceLabelsSha256,
  )
  const graphPath = 'public/airway-anatomy/case-001/metadata/airway_graph.json'
  const labeledBytes = readFileSync(graphPath)
  expect(createHash('sha256').update(labeledBytes).digest('hex')).toBe(
    manifest.nomenclature.sourceLabeledGraphSha256,
  )
  type Edge = { id: number; startNodeId: number; endNodeId: number; pointsLps: number[][] }
  const original: { edges: Edge[] } = JSON.parse(
    readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json', 'utf8'),
  )
  const labeled: { edges: Edge[] } = JSON.parse(labeledBytes.toString())
  const specs: { traces: { id: string; edges: number[] }[] } = JSON.parse(
    readFileSync('scripts/branch-tracing/authoring/ct-traces.json', 'utf8'),
  )
  for (const trace of CT_TRACES) {
    const ids = trace.sourceEdgeIds
    const originalEdges = specs.traces.find((t) => t.id === trace.id)!.edges
    const begin = ids.indexOf(originalEdges[0])
    expect(begin).toBeGreaterThanOrEqual(0)
    expect(ids.slice(begin, begin + originalEdges.length)).toEqual(originalEdges)
    for (const id of ids) {
      const edge = original.edges.find((e) => e.id === id)!
      const other = labeled.edges.find((e) => e.id === id)!
      expect(edge.pointsLps.length).toBe(other.pointsLps.length)
      edge.pointsLps.forEach((point, i) => {
        // Both hash-pinned graphs retain the same LB6 junction and topology; node 186 differs by 0.135 mm.
        if ((id === 184 && i === edge.pointsLps.length - 1) || (id === 281 && i === 0))
          expect(Math.hypot(...point.map((v, j) => v - other.pointsLps[i][j]))).toBeCloseTo(
            0.13499082206873328,
            10,
          )
        else expect(point).toEqual(other.pointsLps[i])
      })
      expect([edge.startNodeId, edge.endNodeId]).toEqual([other.startNodeId, other.endNodeId])
    }
    for (const point of trace.checkpoints) {
      expect(ids).toContain(point.sourceEdgeId)
      const edge = original.edges.find((e) => e.id === point.sourceEdgeId)!
      const distances = edge.pointsLps.slice(1).map((b, i) => {
        const a = edge.pointsLps[i],
          v = b.map((n, j) => n - a[j])
        const squared = v.reduce((sum, n) => sum + n * n, 0)
        const t = squared
          ? Math.max(
              0,
              Math.min(1, v.reduce((sum, n, j) => sum + n * (point.lps[j] - a[j]), 0) / squared),
            )
          : 0
        return Math.hypot(...a.map((n, j) => point.lps[j] - (n + t * v[j])))
      })
      expect(Math.min(...distances)).toBeLessThan(0.0001)
    }
  }
})
test('CT actions reject an unrecorded response and wrong slice while preserving the actual learner point', () => {
  const [prediction, transfer] = CT_TRACES
  const reduce = ctSessionReducer(prediction, transfer)
  let s = reduce(emptyCtSession(), { type: 'advance' })
  expect(reduce(s, { type: 'advance' })).toBe(s)
  expect(reduce(s, { type: 'mark', index: 0, mark: { slice: 0, pixel: [100, 100] } })).toBe(s)
  expect(
    reduce(s, {
      type: 'mark',
      index: 0,
      mark: { slice: prediction.checkpoints[0].slice, pixel: [NaN, 100] },
    }),
  ).toBe(s)
  s = reduce(s, { type: 'orientation', value: orientationFor(prediction.preset) })
  s = reduce(s, { type: 'check-orientation' })
  for (let i = 0; i < prediction.checkpoints.length; i++) {
    s = reduce(s, { type: 'active', index: i })
    if (prediction.checkpoints[i].decision)
      s = reduce(s, { type: 'branch', index: i, value: 'unresolved' })
    s = reduce(s, {
      type: 'mark',
      index: i,
      mark: { slice: prediction.checkpoints[i].slice, pixel: [10, 10] },
    })
    s = reduce(s, { type: 'record-junction' })
  }
  s = reduce(s, { type: 'advance' })
  expect(reduce(s, { type: 'advance' })).toBe(s)
  s = reduce(s, { type: 'course', value: 'cranial' })
  expect(reduce(s, { type: 'advance' })).toBe(s)
  s = reduce(s, { type: 'target-relation', value: 'unresolved' })
  s = reduce(s, { type: 'advance' })
  expect(s.prediction?.targetRelation).toBe('unresolved')
  expect(s.prediction?.marks[0].pixel).toEqual([10, 10])
  expect(
    reduce(s, {
      type: 'mark',
      index: 0,
      mark: { slice: prediction.checkpoints[0].slice, pixel: [20, 20] },
    }),
  ).toBe(s)
  s = reduce(reduce(s, { type: 'advance' }), { type: 'advance' })
  expect(s.marks).toEqual(transfer.checkpoints.map(() => null))
  expect(s.targetRelation).toBe('')
  expect(reduce(s, { type: 'advance' })).toBe(s)
  expect(s.complete).toBe(false)
})
