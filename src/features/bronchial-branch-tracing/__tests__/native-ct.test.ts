import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import manifest from '../../../../public/branch-tracing/native-v1/manifest.json'
import {
  CT_TRACES,
  NATIVE_CT,
  displayToPixel,
  pixelToDisplay,
  sliceZ,
  ORIENTATION_LABELS,
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
  for (const trace of CT_TRACES) {
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
      for (const [center, size] of [
        [trace.cropCenter, trace.cropSize],
        [[255.5, 255.5], 512],
      ] as const)
        for (const point of trace.checkpoints) {
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
  for (let i = 0; i < 3; i++)
    s = reduce(s, {
      type: 'mark',
      index: i,
      mark: { slice: prediction.checkpoints[i].slice, pixel: [10, 10] },
    })
  s = reduce(s, { type: 'advance' })
  expect(reduce(s, { type: 'advance' })).toBe(s)
  s = reduce(s, { type: 'course', value: 'cranial' })
  s = reduce(s, { type: 'advance' })
  expect(s.prediction?.marks[0].pixel).toEqual([10, 10])
  expect(
    reduce(s, {
      type: 'mark',
      index: 0,
      mark: { slice: prediction.checkpoints[0].slice, pixel: [20, 20] },
    }),
  ).toBe(s)
  s = reduce(reduce(s, { type: 'advance' }), { type: 'advance' })
  expect(s.marks).toEqual([null, null, null])
  expect(reduce(s, { type: 'advance' })).toBe(s)
  expect(s.complete).toBe(false)
})
