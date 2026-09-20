import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import decisions from '../geometry/branch-decisions.json'
import routes from '../geometry/paired-routes.json'
import manifest from '../../../../public/branch-tracing/native-v1/manifest.json'
import { NATIVE_CT, sliceZ } from '../geometry/native-ct'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import { edgeCrossings, planeDistanceMm } from '../engine/junction-feedback'

/**
 * BBTF-01. The first bifurcation asks for two daughter marks on a plane where this scan shows one
 * shared air column. These tests separate the two possible causes and pin the answer:
 *
 *  - a technical error (wrong slice index, wrong source, wrong wiring) would be repairable here;
 *  - a limitation of the source anatomy at this response plane is an owner decision, not ours.
 *
 * Everything below measures the shipped native PNGs and the shipped source export. None of it
 * changes a response plane, a branch identity or any model geometry.
 */

const HU_FLOOR = NATIVE_CT.window[0]
const HU_SPAN = NATIVE_CT.window[1] - NATIVE_CT.window[0]
const SOFT_TISSUE_HU = -400

/** Grayscale rows of one native axial PNG, without the per-row filter byte. */
function slicePixels(slice: number): Uint8Array {
  const bytes = readFileSync(
    `public/branch-tracing/native-v1/axial/${String(slice).padStart(3, '0')}.png`,
  )
  const chunks: Buffer[] = []
  for (let offset = 8; offset < bytes.length; ) {
    const size = bytes.readUInt32BE(offset)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(bytes.subarray(offset + 8, offset + 8 + size))
    offset += size + 12
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const pixels = new Uint8Array(512 * 512)
  for (let y = 0; y < 512; y++) {
    expect(raw[y * 513]).toBe(0)
    pixels.set(raw.subarray(y * 513 + 1, y * 513 + 513), y * 512)
  }
  return pixels
}
const huAt = (pixels: Uint8Array, x: number, y: number) =>
  HU_FLOOR + (pixels[Math.round(y) * 512 + Math.round(x)] * HU_SPAN) / 255

const firstDecision = decisions.traces[0].checkpoints.find((p) => p.id === 'junction-1')!.decision!
const [RMSB, LMSB] = firstDecision.options

const mmBetween = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

test('the first junction response points are coherent centreline points, and their plane is set by a fixed distance rule rather than by a graph sample', () => {
  expect(firstDecision.nodeId).toBe(1)
  for (const option of [RMSB, LMSB]) {
    // Slice, patient-space point and native pixel describe one consistent location.
    expect(option.slice).toBe(387)
    expect(option.slice).toBe(
      Math.round((option.lps[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2]),
    )
    for (const axis of [0, 1])
      expect(option.pixel[axis] * NATIVE_CT.spacing[axis] + NATIVE_CT.origin[axis]).toBeCloseTo(
        option.lps[axis],
        3,
      )
    // It lies on the daughter's own centreline where that edge crosses the plane.
    const [crossing] = edgeCrossings(option.sourceEdgeId, option.slice)
    expect(planeDistanceMm(crossing, option.pixel)).toBeLessThan(0.5)

    const edge = routes.edges.find((e) => e.id === option.sourceEdgeId)!
    // The edge begins at the node, about 2.5 mm cranial to the response plane.
    expect(Math.max(...edge.points.map((p) => p[2]))).toBeCloseTo(firstDecision.junctionLps[2], 3)
    // It is NOT one of the graph's own samples: the exporter walked a fixed 5 mm along the
    // centreline from the node and interpolated between the samples that bracket that distance.
    // The plane the learner answers on therefore follows a uniform authoring rule, not the scan.
    expect(edge.points.some((p) => mmBetween(p, option.lps) < 1e-4)).toBe(false)
    expect(mmBetween(option.lps, firstDecision.junctionLps)).toBeCloseTo(5, 3)
    const bracket = edge.points.findIndex(
      (p, i) =>
        i > 0 &&
        (option.lps[2] - edge.points[i - 1][2]) * (option.lps[2] - p[2]) <= 0 &&
        edge.points[i - 1][2] !== p[2],
    )
    expect(bracket).toBeGreaterThan(0)
    const a = edge.points[bracket - 1],
      b = edge.points[bracket]
    const f = (option.lps[2] - a[2]) / (b[2] - a[2])
    expect(
      mmBetween(
        option.lps,
        a.map((v, i) => v + f * (b[i] - v)),
      ),
    ).toBeLessThan(1e-3)
  }
  expect(Math.round((firstDecision.junctionLps[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2])) //
    .toBe(392)
})

test('the 5 mm daughter rule is uniform, so this plane is not a per-junction anatomical choice', () => {
  const distances: number[] = []
  for (const trace of decisions.traces)
    for (const point of trace.checkpoints) {
      const decision = point.decision
      if (!decision) continue
      for (const option of decision.options) {
        const edge = routes.edges.find((e) => e.id === option.sourceEdgeId)
        if (!edge) continue
        distances.push(mmBetween(option.lps, decision.junctionLps))
        expect(option.slice).toBe(
          Math.round((option.lps[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2]),
        )
      }
    }
  expect(distances.length).toBeGreaterThan(150)
  // Capped at 5 mm from the node, shorter only where the daughter edge itself is shorter.
  expect(Math.max(...distances)).toBeCloseTo(5, 3)
  expect(distances.every((d) => d <= 5.001)).toBe(true)
  expect(distances.filter((d) => d > 4.999).length).toBeGreaterThan(50)
})

test('native slice indexing is exact: every sampled source point matches its own plane and no neighbouring one', () => {
  const sampled = new Map<string, { slice: number; pixel: number[]; sourceHu: number }>()
  for (const trace of decisions.traces)
    for (const point of trace.checkpoints)
      for (const p of [
        point,
        ...(point.decision ? [point.decision.parent, ...point.decision.options] : []),
      ])
        if (typeof p.sourceHu === 'number')
          sampled.set(`${p.slice}:${p.pixel.join(',')}`, {
            slice: p.slice,
            pixel: p.pixel,
            sourceHu: p.sourceHu,
          })
  const points = [...sampled.values()]
  expect(points.length).toBeGreaterThan(150)
  const [low, high] = manifest.exportedSliceRange
  const cache = new Map<number, Uint8Array>()
  const pixelsFor = (slice: number) => {
    if (!cache.has(slice)) cache.set(slice, slicePixels(slice))
    return cache.get(slice)!
  }
  const meanError = (offset: number) => {
    const errors = points
      .filter((p) => p.slice + offset >= low && p.slice + offset <= high)
      .map((p) =>
        Math.abs(
          huAt(pixelsFor(p.slice + offset), p.pixel[0], p.pixel[1]) -
            Math.max(p.sourceHu, HU_FLOOR),
        ),
      )
    return errors.reduce((sum, v) => sum + v, 0) / errors.length
  }
  // The shipped indexing reproduces the exporter's own HU samples; a one-slice shift does not.
  expect(meanError(0)).toBeLessThan(2)
  expect(meanError(-1)).toBeGreaterThan(20)
  expect(meanError(1)).toBeGreaterThan(20)
})

test('no soft tissue separates the two main-bronchus locators anywhere in the browsable interval', () => {
  const bifurcation = LESSONS.flatMap((l) => l.exercises ?? []).find(
    (spec) => spec.checkpointId === 'junction-1' && spec.kind === 'bifurcation',
  )!
  const exercise = localExercise(bifurcation)
  const [low, high] = exercise.trace.range
  expect([low, high]).toEqual([384, 411])
  expect(exercise.answerPoints.map((p) => p.slice)).toEqual([387, 387])

  const maxOnSegment = (slice: number) => {
    const pixels = slicePixels(slice)
    let peak = -Infinity
    for (let i = 0; i <= 200; i++) {
      const t = i / 200
      peak = Math.max(
        peak,
        huAt(
          pixels,
          RMSB.pixel[0] + (LMSB.pixel[0] - RMSB.pixel[0]) * t,
          RMSB.pixel[1] + (LMSB.pixel[1] - RMSB.pixel[1]) * t,
        ),
      )
    }
    return peak
  }
  // Through the whole interval the learner can browse, the straight line between the two model
  // locators stays air density: there is no carinal partition to see here.
  for (let slice = low; slice <= Math.min(high, 395); slice++)
    expect([slice, maxOnSegment(slice) < SOFT_TISSUE_HU]).toEqual([slice, true])
  // The partition this exercise talks about appears below the interval, as the packet records.
  expect(maxOnSegment(376)).toBeLessThan(SOFT_TISSUE_HU)
  expect(maxOnSegment(374)).toBeGreaterThan(SOFT_TISSUE_HU)
  expect(374).toBeLessThan(low)

  // Z sign, anchored in the images rather than in the transform we are checking: the single
  // tracheal lumen sits at a HIGHER slice index than the plane where the column divides, so
  // higher indices are more cranial and the split really is below this interval, not above it.
  const parent = firstDecision.parent
  expect(huAt(slicePixels(parent.slice), parent.pixel[0], parent.pixel[1])).toBeLessThan(-800)
  expect(parent.slice).toBeGreaterThan(RMSB.slice)
  expect(RMSB.slice).toBeGreaterThan(374)
  expect(sliceZ(parent.slice)).toBeGreaterThan(sliceZ(374))
})

test('the limitation is stated before the task and the canonical coordinates are untouched', () => {
  const packet = junctionFeedbackPacket('junction-1')!
  expect(packet.entryLimitation).toMatch(/share one transversely elongated air column/)
  expect(packet.entryLimitation).toMatch(/authoring-session reading[^.]*pending faculty review/)
  expect(packet.entryLimitation).toMatch(/unresolved/)
  // Containment only: the packet still describes the same planes it always did.
  expect(packet.divergence).toContain('slice 387')
  expect(packet.divergence).toContain('378 to 375')
  expect(junctionFeedbackPacket('junction-6')!.entryLimitation).toMatch(/no wall resolved/i)
})
