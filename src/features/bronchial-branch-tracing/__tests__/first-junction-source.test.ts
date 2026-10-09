import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import decisions from '../geometry/branch-decisions.json'
import routes from '../geometry/paired-routes.json'
import manifest from '../../../../public/branch-tracing/native-v1/manifest.json'
import { NATIVE_CT, sliceZ } from '../geometry/native-ct'
import { LESSONS } from '../content/lessons'
import { LOCAL_RESPONSE_SLICE, localExercise } from '../content/local-exercises'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import { edgeCrossings, planeDistanceMm } from '../engine/junction-feedback'

/**
 * BBTF-01. The route export asks for the two main-bronchus marks on slice 387, a plane where this
 * scan shows one shared air column. These tests separate the two possible causes and pin the answer:
 *
 *  - a technical error (wrong slice index, wrong source, wrong wiring) would be repairable here;
 *  - a limitation of the source anatomy at this response plane is an owner decision, not ours.
 *
 * Owner decision, 2026-10-08: the routes keep slice 387; Lesson 3's first example is marked on
 * slice 372, below the carina (LOCAL_RESPONSE_SLICE). The last tests prove the complement: two
 * lumens with soft tissue between them from slice 375 down.
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

const lessonBifurcation = () =>
  localExercise(
    LESSONS.flatMap((l) => l.exercises ?? []).find(
      (spec) => spec.checkpointId === 'junction-1' && spec.kind === 'bifurcation',
    )!,
  )
/** The highest HU on the straight line between two native pixels of one slice. */
const maxOnSegment = (slice: number, from: readonly number[], to: readonly number[]) => {
  const pixels = slicePixels(slice)
  let peak = -Infinity
  for (let i = 0; i <= 400; i++) {
    const t = i / 400
    peak = Math.max(
      peak,
      huAt(pixels, from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t),
    )
  }
  return peak
}

test('no soft tissue separates the two main-bronchus locators on the route plane, slice 387, or anywhere near it', () => {
  // The routes keep the exported plane.
  expect([RMSB.slice, LMSB.slice]).toEqual([387, 387])
  // From the old lesson interval's floor up to the carina's level, the straight line between the
  // two exported locators stays air density: slice 387 shows one air region, not a bifurcation.
  for (let slice = 384; slice <= 395; slice++)
    expect([slice, maxOnSegment(slice, RMSB.pixel, LMSB.pixel) < SOFT_TISSUE_HU]).toEqual([
      slice,
      true,
    ])
  expect(maxOnSegment(387, RMSB.pixel, LMSB.pixel)).toBeLessThan(-800)
  // The partition appears lower down.
  expect(maxOnSegment(376, RMSB.pixel, LMSB.pixel)).toBeLessThan(SOFT_TISSUE_HU)
  expect(maxOnSegment(374, RMSB.pixel, LMSB.pixel)).toBeGreaterThan(SOFT_TISSUE_HU)

  // Z sign, anchored in the images rather than in the transform we are checking: the single
  // tracheal lumen sits at a HIGHER slice index than the plane where the column divides, so
  // higher indices are more cranial and the split really is below slice 387, not above it.
  const parent = firstDecision.parent
  expect(huAt(slicePixels(parent.slice), parent.pixel[0], parent.pixel[1])).toBeLessThan(-800)
  expect(parent.slice).toBeGreaterThan(RMSB.slice)
  expect(RMSB.slice).toBeGreaterThan(374)
  expect(sliceZ(parent.slice)).toBeGreaterThan(sliceZ(374))
})

test('the lesson marks the main bronchi on slice 372, where the carina stands between two lumens', () => {
  const exercise = lessonBifurcation()
  const [low, high] = exercise.trace.range
  // The lesson interval now reaches down past the carina; the answer plane is 372, not 387.
  expect([low, high]).toEqual([369, 411])
  expect(LOCAL_RESPONSE_SLICE[exercise.id]).toBe(372)
  expect(exercise.answerPoints.map((p) => p.slice)).toEqual([372, 372])
  // Same two centrelines as the route, followed 15 slices farther down.
  const options = exercise.trace.checkpoints[0].decision!.options
  expect(options.map((o) => o.sourceEdgeId)).toEqual([RMSB.sourceEdgeId, LMSB.sourceEdgeId])
  for (const option of options) {
    const [crossing] = edgeCrossings(option.sourceEdgeId, 372)
    expect(planeDistanceMm(crossing, option.pixel)).toBeLessThan(0.5)
    expect(option.lps[2]).toBeCloseTo(sliceZ(372), 6)
    // Each answer point is in air: the centre of its own lumen.
    expect(huAt(slicePixels(372), option.pixel[0], option.pixel[1])).toBeLessThan(-800)
  }
  expect(planeDistanceMm(options[0].pixel, options[1].pixel)).toBeCloseTo(30.5, 1)

  // Between the two centrelines, slice by slice: air only from the carina's level down to 377,
  // soft tissue from 375 down to the answer slice. (376 is the transition; the flood-fill test
  // in answer-plane-air.test.ts reads it as still joined.)
  const between = (slice: number) =>
    maxOnSegment(
      slice,
      edgeCrossings(RMSB.sourceEdgeId, slice)[0],
      edgeCrossings(LMSB.sourceEdgeId, slice)[0],
    )
  for (let slice = 377; slice <= 391; slice++)
    expect([slice, between(slice) < SOFT_TISSUE_HU]).toEqual([slice, true])
  for (let slice = 372; slice <= 375; slice++)
    expect([slice, between(slice) > SOFT_TISSUE_HU]).toEqual([slice, true])
  // Every slice the lesson talks about can be browsed.
  for (const slice of [372, 375, 376, 387, 392]) {
    expect(slice).toBeGreaterThanOrEqual(low)
    expect(slice).toBeLessThanOrEqual(high)
  }
})

test('the lesson is taught on the separated plane, the route is told what slice 387 shows, and neither carries status text', () => {
  const packet = junctionFeedbackPacket('junction-1')!
  // The lesson no longer asks for marks on a shared air column, so it needs no entry limitation.
  expect(packet.entryLimitation).toBeUndefined()
  expect(packet.divergence).toMatch(/divides at about slice 392/)
  expect(packet.divergence).toMatch(/stays one air column down to slice 376/)
  expect(packet.divergence).toMatch(/On slice 375 a thin wall, the carina, first crosses it/)
  expect(packet.divergence).toMatch(/You mark both main bronchi on slice 372/)
  expect(packet.known.join(' ')).toMatch(
    /8\.6 mm apart on slice 387, 26 mm apart on slice 375 and 30\.5 mm apart on slice 372/,
  )
  // The routes still answer on 387: the learner is told what that plane shows and where to mark.
  expect(packet.routeEntryNote).toMatch(
    /marked on slice 387, 5 mm below the tracheal bifurcation, where they still share one wide air column/,
  )
  expect(packet.routeEntryNote).toMatch(/Mark RMSB in the half on the patient's right/)
  expect(packet.routeEntryNote).toMatch(/Scroll down to slice 375 to see the carina/)
  // A division that is still marked on a shared air column says so before the task, and says
  // which part to mark.
  const lb6 = junctionFeedbackPacket('junction-6')!
  expect(lb6.entryLimitation).toMatch(/still one dark area with no wall between them/)
  expect(lb6.entryLimitation).toMatch(/Mark the posterior part/)
  for (const text of [packet.routeEntryNote!, packet.divergence, lb6.entryLimitation!])
    expect(text).not.toMatch(/authoring|faculty review|pending|unresolved is|valid response/i)
})
