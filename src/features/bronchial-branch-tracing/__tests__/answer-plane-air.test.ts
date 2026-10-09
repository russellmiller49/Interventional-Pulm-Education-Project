import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import airPlanes from '../geometry/answer-plane-air.json'
import { LESSONS } from '../content/lessons'
import { LOCAL_RESPONSE_SLICE, localExercise } from '../content/local-exercises'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import type { LocalCtExercise } from '../content/ct-types'
import {
  AIR_HU,
  FILL_CAP_MM,
  LOCATOR_SNAP_MM,
  airPlane,
  compareMarks,
  floodFillAir,
  markVerdict,
  nearestAir,
  planeDistanceMm,
  slotLocators,
  type AirPlane,
} from '../engine/junction-feedback'
import { moveSentence, verdictBand } from '../components/JunctionFeedback'
import { emptyLocalSession, parseLocalSession } from '../engine/local-session'
import { freshRouteView } from '../engine/ct-draft'
import { NATIVE_CT, traceById } from '../geometry/native-ct'

/**
 * The result band (teaching-first pass, 2026-10-08): which lumen a mark is in, read from the
 * shipped CT's own air. These tests run the flood fill and the verdict on the real answer planes.
 */

const HU_FLOOR = NATIVE_CT.window[0]
const HU_SPAN = NATIVE_CT.window[1] - NATIVE_CT.window[0]

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
  for (let y = 0; y < 512; y++) pixels.set(raw.subarray(y * 513 + 1, y * 513 + 513), y * 512)
  return pixels
}
const hu = (pixels: Uint8Array, x: number, y: number) =>
  HU_FLOOR + (pixels[y * 512 + x] * HU_SPAN) / 255

const divisions: LocalCtExercise[] = LESSONS.flatMap((lesson) =>
  (lesson.exercises ?? []).map(localExercise),
).filter((exercise) => exercise.trace.checkpoints[0].decision)
const exerciseFor = (checkpointId: string) =>
  divisions.find((e) => e.spec.checkpointId === checkpointId)!
const markAt = (exercise: LocalCtExercise, slot: number, pixel: readonly number[]) => ({
  slice: exercise.answerPoints[slot].slice,
  pixel: [pixel[0], pixel[1]] as [number, number],
})
const locatorOf = (exercise: LocalCtExercise, slot: number, role: string) =>
  slotLocators(exercise, slot).find((l) => l.role === role)!

/** A pixel of lung parenchyma near a locator: neither it nor any neighbour is air or soft tissue. */
function lungPixelNear(slice: number, centre: readonly number[]): [number, number] {
  const pixels = slicePixels(slice)
  for (let y = Math.round(centre[1]) - 20; y <= Math.round(centre[1]) + 20; y++)
    for (let x = Math.round(centre[0]) - 20; x <= Math.round(centre[0]) + 20; x++) {
      const mm = planeDistanceMm([x, y], centre)
      if (mm < 7 || mm > 12) continue
      let parenchyma = true
      for (let dy = -1; dy <= 1 && parenchyma; dy++)
        for (let dx = -1; dx <= 1 && parenchyma; dx++) {
          const air = pixels[(y + dy) * 512 + x + dx] <= airPlanes.airByte
          if (air || hu(pixels, x + dx, y + dy) > -650) parenchyma = false
        }
      if (parenchyma) return [x, y]
    }
  throw new Error(`No lung parenchyma found near ${centre} on slice ${slice}`)
}

describe('air masks', () => {
  test('the threshold and cap are the ones the build script documents', () => {
    expect(airPlanes.airByte).toBe(9)
    expect(AIR_HU).toBeCloseTo(-950.6, 1)
    expect(FILL_CAP_MM).toBe(12)
  })

  test('every plane decodes to its declared size and equals the shipped PNG at the threshold', () => {
    for (const [key, raw] of Object.entries(airPlanes.planes)) {
      const slice = Number(key)
      const plane = airPlane(slice)!
      expect(plane.air.length).toBe(raw.w * raw.h)
      expect(raw.runs.split(' ').reduce((sum, run) => sum + Number(run), 0)).toBe(raw.w * raw.h)
      const pixels = slicePixels(slice)
      let differences = 0
      for (let y = 0; y < raw.h; y++)
        for (let x = 0; x < raw.w; x++) {
          const isAir = pixels[(raw.y0 + y) * 512 + raw.x0 + x] <= airPlanes.airByte
          if (isAir !== (plane.air[y * raw.w + x] === 1)) differences++
        }
      expect([slice, differences]).toEqual([slice, 0])
    }
  })

  test('every answer slot of every local division has a mask that holds the fill cap around its locators', () => {
    // Twelve divisions; junction-20 is marked in two lessons' examples.
    expect(divisions.length).toBe(13)
    for (const exercise of divisions)
      exercise.answerPoints.forEach((point, slot) => {
        const plane = airPlane(point.slice)
        expect([exercise.id, slot, Boolean(plane)]).toEqual([exercise.id, slot, true])
        const reach = FILL_CAP_MM / NATIVE_CT.spacing[0]
        for (const locator of slotLocators(exercise, slot).filter((l) => l.role !== 'other')) {
          expect(locator.pixel[0] - reach).toBeGreaterThanOrEqual(plane!.x0)
          expect(locator.pixel[1] - reach).toBeGreaterThanOrEqual(plane!.y0)
          expect(locator.pixel[0] + reach).toBeLessThanOrEqual(plane!.x0 + plane!.w - 1)
          expect(locator.pixel[1] + reach).toBeLessThanOrEqual(plane!.y0 + plane!.h - 1)
        }
      })
  })
})

describe('flood fill', () => {
  // 7 × 5 plane at (100, 200):   . # # . . # .
  //                              . # . . . # .
  //                              . # # # . . #
  //                              . . . . . . .
  //                              # . . . . . .
  const rows = ['.##..#.', '.#...#.', '.###..#', '.......', '#......']
  const plane: AirPlane = {
    x0: 100,
    y0: 200,
    w: 7,
    h: 5,
    air: Uint8Array.from(rows.join('').split(''), (c) => (c === '#' ? 1 : 0)),
  }
  const has = (region: Set<number>, x: number, y: number) => region.has(y * 512 + x)

  test('fills the four-connected region and nothing diagonal to it', () => {
    const region = floodFillAir(plane, [101, 200], 50)
    expect(region.size).toBe(6)
    expect(has(region, 103, 202)).toBe(true)
    // (105, 200)–(105, 201) is a separate column; (106, 202) touches it only diagonally.
    expect(has(region, 105, 200)).toBe(false)
    expect(floodFillAir(plane, [105, 200], 50).size).toBe(2)
    expect(floodFillAir(plane, [106, 202], 50).size).toBe(1)
  })

  test('a seed that is not air, or outside the plane, fills nothing', () => {
    expect(floodFillAir(plane, [100, 200], 50).size).toBe(0)
    expect(floodFillAir(plane, [90, 190], 50).size).toBe(0)
  })

  test('stops at the cap, measured in millimetres from the seed', () => {
    // One pixel is 0.69 mm and a diagonal 0.98 mm: a 0.8 mm cap reaches the 4-neighbours only.
    const region = floodFillAir(plane, [101, 201], 0.8)
    expect([...region].sort((a, b) => a - b)).toEqual([
      200 * 512 + 101,
      201 * 512 + 101,
      202 * 512 + 101,
    ])
    expect(floodFillAir(plane, [101, 201], 1).size).toBe(5)
  })

  test('nearestAir snaps within its radius and no farther', () => {
    expect(nearestAir(plane, [100.2, 201], 1)).toEqual([101, 201])
    expect(nearestAir(plane, [103, 204], 1)).toBeNull()
    expect(nearestAir(plane, [100, 204], 0)).toEqual([100, 204])
  })
})

describe('verdict on the real answer planes', () => {
  test('a mark on the intended centre is in the intended lumen, at every slot of every division', () => {
    for (const exercise of divisions)
      exercise.answerPoints.forEach((point, slot) => {
        const result = markVerdict(exercise, slot, markAt(exercise, slot, point.pixel))
        expect([exercise.id, slot, result?.verdict]).toEqual([exercise.id, slot, 'intended-lumen'])
      })
  })

  test('every intended lumen has air at the threshold within the locator snap', () => {
    for (const exercise of divisions)
      exercise.answerPoints.forEach((point, slot) => {
        const seed = nearestAir(airPlane(point.slice)!, point.pixel, LOCATOR_SNAP_MM)
        expect([exercise.id, slot, seed !== null]).toEqual([exercise.id, slot, true])
      })
  })

  test.each([
    ['junction-14', 0],
    ['junction-14', 1],
    ['junction-52', 1],
    ['junction-1', 0],
    ['junction-1', 1],
  ])('%s slot %i: a mark in the other daughter is in another airway', (id, slot) => {
    const exercise = exerciseFor(id)
    const sibling = locatorOf(exercise, slot, 'daughter')
    const result = markVerdict(exercise, slot, markAt(exercise, slot, sibling.pixel))!
    expect(result.verdict).toBe('other-airway')
    expect(result.nearest?.edgeId).toBe(sibling.edgeId)
    expect(result.reached.some((r) => r.locator.role === 'intended')).toBe(false)
  })

  test.each([
    ['junction-10', 0, 'daughter'],
    ['junction-10', 1, 'daughter'],
    ['junction-23', 0, 'daughter'],
    ['junction-6', 0, 'parent'],
    ['junction-9', 1, 'parent'],
    ['junction-11', 0, 'parent'],
  ])(
    '%s slot %i: a mark on the %s centre of a shared air column is near the fork',
    (id, slot, role) => {
      const exercise = exerciseFor(id)
      const other = locatorOf(exercise, slot, role)
      const result = markVerdict(exercise, slot, markAt(exercise, slot, other.pixel))!
      expect(result.verdict).toBe('near-fork')
      expect(result.nearest?.role).toBe(role)
    },
  )

  test.each([
    ['junction-20', 0],
    ['junction-20', 1],
    ['junction-52', 0],
    ['junction-52', 1],
    ['junction-16', 1],
    ['junction-14', 1],
    ['junction-25', 1],
  ])('%s slot %i: a mark in lung parenchyma is not in an airway', (id, slot) => {
    const exercise = exerciseFor(id)
    const point = exercise.answerPoints[slot]
    const lung = lungPixelNear(point.slice, point.pixel)
    const result = markVerdict(exercise, slot, markAt(exercise, slot, lung))!
    expect(result.verdict).toBe('not-in-airway')
    expect(result.markInAir).toBe(false)
    expect(result.toIntended.mm).toBeGreaterThan(6)
  })

  test.each([
    ['junction-20', 0],
    ['junction-20', 1],
    ['junction-52', 0],
    ['junction-52', 1],
  ])('%s slot %i: a dark speck of lung that reads as air still joins no airway', (id, slot) => {
    const exercise = exerciseFor(id)
    const point = exercise.answerPoints[slot]
    const plane = airPlane(point.slice)!
    let speck: [number, number] | null = null
    for (let y = plane.y0; y < plane.y0 + plane.h && !speck; y++)
      for (let x = plane.x0; x < plane.x0 + plane.w && !speck; x++) {
        const mm = planeDistanceMm([x, y], point.pixel)
        if (mm < 7 || mm > 11) continue
        const size = floodFillAir(plane, [x, y], FILL_CAP_MM).size
        if (size > 0 && size <= 4) speck = [x, y]
      }
    expect(speck).not.toBeNull()
    const result = markVerdict(exercise, slot, markAt(exercise, slot, speck!))!
    expect(result.verdict).toBe('not-in-airway')
    expect(result.markInAir).toBe(true)
    expect(result.reached).toEqual([])
  })

  test('at −950 HU no lumen fill leaks: within 12 mm of each intended centre, a mark that reads as the intended lumen is on air connected to it', () => {
    // The leak the plan warned of (−852 HU at junction-20 and junction-52) would show here as a
    // large "intended" region. Each small lumen stays small.
    const areaMm2 = (id: string, slot: number) => {
      const exercise = exerciseFor(id)
      const point = exercise.answerPoints[slot]
      const plane = airPlane(point.slice)!
      const seed = nearestAir(plane, point.pixel, LOCATOR_SNAP_MM)!
      return floodFillAir(plane, seed, FILL_CAP_MM).size * NATIVE_CT.spacing[0] ** 2
    }
    expect(areaMm2('junction-52', 0)).toBeLessThan(10)
    expect(areaMm2('junction-52', 1)).toBeLessThan(4)
    expect(areaMm2('junction-20', 0)).toBeLessThan(70)
    expect(areaMm2('junction-20', 1)).toBeLessThan(60)
    expect(areaMm2('junction-14', 1)).toBeLessThan(10)
    expect(areaMm2('junction-16', 0)).toBeLessThan(12)
  })

  test('no verdict without a mark on the answer slice, and none where there is no mask', () => {
    const exercise = exerciseFor('junction-14')
    expect(markVerdict(exercise, 0, null)).toBeNull()
    expect(markVerdict(exercise, 0, { slice: 422, pixel: null })).toBeNull()
    expect(markVerdict(exercise, 0, { slice: 421, pixel: [188, 303] })).toBeNull()
    expect(airPlane(250)).toBeNull()
  })

  test('compareMarks carries the verdict, and counts a same-named sibling as the other daughter', () => {
    const exercise = exerciseFor('junction-52')
    const sibling = locatorOf(exercise, 1, 'daughter')
    const [, comparison] = compareMarks(exercise, [null, markAt(exercise, 1, sibling.pixel)])
    expect(comparison.status).toBe('nearest-other')
    expect(comparison.nearestSibling?.locator.edgeId).toBe(sibling.edgeId)
    expect(comparison.verdict?.verdict).toBe('other-airway')
    const [unresolved] = compareMarks(exercise, [{ slice: 358, pixel: null }, null])
    expect(unresolved.verdict).toBeNull()
  })
})

describe('result band wording', () => {
  test('a miss says what the mark is in and which way to move, in patient directions', () => {
    const exercise = exerciseFor('junction-14')
    const sibling = locatorOf(exercise, 0, 'daughter')
    const [comparison] = compareMarks(exercise, [markAt(exercise, 0, sibling.pixel), null])
    const band = verdictBand(exercise, comparison)!
    expect(band.tone).toBe('miss')
    expect(band.headline).toBe('In RB1a, not RB1b.')
    expect(band.detail).toMatch(/Move about 5 mm anterior to reach RB1b\./)
  })

  test('directions follow the native axes: +x is the patient’s left, +y is posterior', () => {
    expect(moveSentence({ mm: 5, leftMm: 0, posteriorMm: 5 })).toBe('about 5 mm posterior')
    expect(moveSentence({ mm: 5, leftMm: -5, posteriorMm: 0 })).toBe(
      'about 5 mm toward the patient’s right',
    )
    expect(moveSentence({ mm: 7.1, leftMm: 5, posteriorMm: -5 })).toBe(
      'about 7 mm anterior and toward the patient’s left',
    )
    expect(moveSentence({ mm: 1.2, leftMm: 1.2, posteriorMm: 0 })).toBe(
      '1 to 2 mm toward the patient’s left',
    )
  })

  test('same-named airways are told apart by role and direction', () => {
    const exercise = exerciseFor('junction-11')
    const parent = locatorOf(exercise, 0, 'parent')
    const [comparison] = compareMarks(exercise, [markAt(exercise, 0, parent.pixel), null])
    const band = verdictBand(exercise, comparison)!
    expect(band.headline).toBe('Still in the parent (LB6), before the fork.')
    expect(band.detail).toContain('Daughter A (LB6, more caudal)')
  })

  test('no band and no packet text uses an answer-leak word', () => {
    const banned = /\b(correct|incorrect|wrong)\b/i
    for (const exercise of divisions) {
      const packet = junctionFeedbackPacket(exercise.spec.checkpointId)!
      expect(packet).toBeDefined()
      expect(JSON.stringify({ ...packet, uncertain: [] })).not.toMatch(banned)
      exercise.answerPoints.forEach((_, slot) => {
        for (const locator of slotLocators(exercise, slot)) {
          const marks = exercise.answerPoints.map((__, i) =>
            i === slot ? markAt(exercise, slot, locator.pixel) : null,
          )
          const band = verdictBand(exercise, compareMarks(exercise, marks)[slot])
          if (band) expect(`${band.headline} ${band.detail}`).not.toMatch(banned)
        }
      })
    }
  })
})

describe('every local division has a written explanation keyed by slot', () => {
  test('packet daughters match the division, and every slice it sends the learner to can be browsed', () => {
    for (const exercise of divisions) {
      const packet = junctionFeedbackPacket(exercise.spec.checkpointId)!
      const decision = exercise.trace.checkpoints[0].decision!
      expect(packet.parent).toBe(decision.parent.airway.code)
      expect(packet.daughters).toEqual(decision.options.map((o) => o.airway.code))
      expect(packet.whenNearer).toHaveLength(2)
      for (const revisit of packet.revisit)
        for (const slice of [revisit.from, revisit.to]) {
          expect(slice).toBeGreaterThanOrEqual(exercise.trace.range[0])
          expect(slice).toBeLessThanOrEqual(exercise.trace.range[1])
        }
      for (const point of exercise.answerPoints)
        expect(`${packet.divergence} ${packet.continuity}`).toContain(`slice ${point.slice}`)
    }
  })
})

describe('first bifurcation is marked where the carina separates the main bronchi', () => {
  const exercise = exerciseFor('junction-1')

  test('both daughters are marked on slice 372, on their own centrelines, 30.5 mm apart', () => {
    expect(LOCAL_RESPONSE_SLICE[exercise.id]).toBe(372)
    expect(exercise.answerPoints.map((p) => p.slice)).toEqual([372, 372])
    expect(exercise.trace.checkpoints[0].decision!.options.map((o) => o.slice)).toEqual([372, 372])
    expect(
      planeDistanceMm(exercise.answerPoints[0].pixel, exercise.answerPoints[1].pixel),
    ).toBeCloseTo(30.5, 1)
    expect(exercise.trace.range[0]).toBeLessThanOrEqual(372)
    expect(exercise.trace.range[1]).toBeGreaterThanOrEqual(392)
    expect(exercise.frames.at(-1)!.slice).toBe(372)
  })

  test('on slice 372 the two lumens are separate air regions; on 376 they are still one', () => {
    const connected = (slice: number) => {
      const pixels = slicePixels(slice)
      const plane: AirPlane = {
        x0: 0,
        y0: 0,
        w: 512,
        h: 512,
        air: Uint8Array.from(pixels, (v) => (v <= airPlanes.airByte ? 1 : 0)),
      }
      const [right, left] = exercise.trace.checkpoints[0].decision!.options.map((option) => {
        const edge = slotLocators(
          { ...exercise, answerPoints: exercise.answerPoints.map((p) => ({ ...p, slice })) },
          0,
        ).find((l) => l.edgeId === option.sourceEdgeId)
        return edge ? nearestAir(plane, edge.pixel, LOCATOR_SNAP_MM)! : null
      })
      // The first slot's own locator is its answer pixel, which belongs to slice 372: read the
      // right main bronchus from the second slot's view of it instead.
      const rightSeed =
        slice === 372
          ? right!
          : nearestAir(
              plane,
              slotLocators(
                { ...exercise, answerPoints: exercise.answerPoints.map((p) => ({ ...p, slice })) },
                1,
              ).find((l) => l.role === 'daughter')!.pixel,
              LOCATOR_SNAP_MM,
            )!
      const region = floodFillAir(plane, rightSeed, 60)
      return region.has(left![1] * 512 + left![0])
    }
    expect(connected(372)).toBe(false)
    expect(connected(375)).toBe(false)
    expect(connected(376)).toBe(true)
  })

  test('the routes keep the exported plane', () => {
    const route = traceById('central-right').checkpoints.find((p) => p.id === 'junction-1')!
    expect(route.decision!.options.map((o) => o.slice)).toEqual([387, 387])
  })
})

describe('the bronchoscopic view opens by default and saved views still load', () => {
  const lesson = LESSONS.find((l) => l.id === 'vertical')!
  const exercises = lesson.exercises!.map(localExercise)

  test('new sessions and new route views open with the parent airway view shown', () => {
    const continuity = LESSONS.find((l) => l.id === 'continuity')!.exercises!.map(localExercise)
    const session = emptyLocalSession(continuity)
    expect(session.views[continuity[0].id].showScope).toBe(true)
    expect(freshRouteView(traceById('central-right')).showScope).toBe(true)
  })

  test('a saved draft whose view hid the parent airway view parses and keeps it hidden', () => {
    const saved = {
      ...emptyLocalSession(exercises),
      views: {
        [exercises[0].id]: {
          slice: exercises[0].trace.anchor.slice,
          focus: 'start',
          full: false,
          magnification: 4,
          showNodule: false,
          showScope: false,
        },
      },
    }
    const parsed = parseLocalSession(JSON.parse(JSON.stringify(saved)), exercises)
    expect(parsed).not.toBeNull()
    expect(parsed!.views[exercises[0].id].showScope).toBe(false)
    expect(parsed!.views[exercises[0].id].magnification).toBe(4)
  })
})
