import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import airPlanes from '../geometry/answer-plane-air.json'
import type { CtTrace } from '../content/ct-types'
import { identifiable } from '../content/nav-lessons'
import {
  AIR_HU,
  FILL_CAP_MM,
  LOCATOR_SNAP_MM,
  MARK_SNAP_MM,
  airPlane,
  edgeCrossings,
  floodFillAir,
  nearestAir,
  optionHasVerdict,
  optionLocators,
  optionLumenAreaMm2,
  optionVerdict,
  planeDistanceMm,
  responsePlane,
  type AirPlane,
} from '../engine/junction-feedback'
import { RESPONSE_PLANE_OVERRIDES } from '../engine/response-planes'
import { CT_TRACES, NATIVE_CT, traceById } from '../geometry/native-ct'

/**
 * Which lumen a mark is in, read from the shipped CT's own air. These tests run the flood fill and
 * the verdict on the real response planes: every division of every route.
 */

interface RawPlane {
  x0: number
  y0: number
  w: number
  h: number
  runs: string
}
interface AirScript {
  RESPONSE_PLANE_OVERRIDES: Record<string, number>
  AIR_BYTE: number
  AIR_HU: number
  CAP_MM: number
  divisions(): { id: string; decision: { options: { sourceEdgeId: number }[] } }[]
  responsePoints(id: string, decision: unknown): { slice: number; pixel: [number, number] }[]
  planeRequests(): Map<number, [number, number][]>
  buildPlanes(): Record<string, RawPlane>
  edgeCrossings(edgeId: number, slice: number): [number, number][]
}
// Plain Node, outside the TypeScript project: loaded by path so the two stay separate programs.
const script = jest.requireActual<AirScript>(
  '../../../../scripts/branch-tracing/build-answer-plane-air.mjs',
)

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
const HU_FLOOR = NATIVE_CT.window[0]
const HU_SPAN = NATIVE_CT.window[1] - NATIVE_CT.window[0]
const hu = (pixels: Uint8Array, x: number, y: number) =>
  HU_FLOOR + (pixels[y * 512 + x] * HU_SPAN) / 255

/** Every opening of every division of every route. */
interface Opening {
  trace: CtTrace
  index: number
  option: number
  checkpointId: string
  /** `checkpointId:optionIndex` */
  key: string
  plane: { slice: number; pixel: [number, number] }
}
const OPENINGS: Opening[] = CT_TRACES.flatMap((trace) =>
  trace.checkpoints.flatMap((checkpoint, index) =>
    (checkpoint.decision?.options ?? []).map((_, option) => ({
      trace,
      index,
      option,
      checkpointId: checkpoint.id,
      key: `${checkpoint.id}:${option}`,
      plane: responsePlane(trace, index, option)!,
    })),
  ),
)
/** One of each: the same division is on several routes. */
const UNIQUE_OPENINGS = OPENINGS.filter(
  (opening, i) => OPENINGS.findIndex((other) => other.key === opening.key) === i,
)
const opening = (checkpointId: string, option: number) =>
  UNIQUE_OPENINGS.find((o) => o.checkpointId === checkpointId && o.option === option)!
const markOn = (o: Opening, pixel: readonly number[]) => ({
  slice: o.plane.slice,
  pixel: [pixel[0], pixel[1]] as [number, number],
})
const locatorOf = (o: Opening, role: string) =>
  optionLocators(o.trace, o.index, o.option).find((l) => l.role === role)!
const verdictAt = (o: Opening, pixel: readonly number[]) =>
  optionVerdict(o.trace, o.index, o.option, markOn(o, pixel))

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
    expect(airPlanes.airByte).toBe(script.AIR_BYTE)
    expect(AIR_HU).toBeCloseTo(-950.6, 1)
    expect(AIR_HU).toBe(Number(script.AIR_HU.toFixed(1)))
    expect(FILL_CAP_MM).toBe(12)
    expect(FILL_CAP_MM).toBe(script.CAP_MM)
  })

  test('the shipped mask equals what the build script produces from the PNGs', () => {
    const built = script.buildPlanes()
    expect(Object.keys(built)).toHaveLength(84)
    expect(Object.keys(airPlanes.planes).sort()).toEqual(Object.keys(built).sort())
    for (const [slice, plane] of Object.entries(built))
      expect([slice, (airPlanes.planes as Record<string, RawPlane>)[slice]]).toEqual([slice, plane])
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

  test('the response-plane overrides are one table, in the engine and in the build script', () => {
    expect(RESPONSE_PLANE_OVERRIDES).toEqual(script.RESPONSE_PLANE_OVERRIDES)
    expect(RESPONSE_PLANE_OVERRIDES).toEqual({ 'junction-1': 372 })
    // The script and the engine put every daughter of every division on the same plane and pixel.
    const divisions = script.divisions()
    expect(divisions.map((d) => d.id).sort()).toEqual(
      [...new Set(UNIQUE_OPENINGS.map((o) => o.checkpointId))].sort(),
    )
    for (const { id, decision } of divisions)
      script.responsePoints(id, decision).forEach((point, option) => {
        const ours = opening(id, option).plane
        expect([id, option, ours.slice]).toEqual([id, option, point.slice])
        expect(ours.pixel[0]).toBeCloseTo(point.pixel[0], 9)
        expect(ours.pixel[1]).toBeCloseTo(point.pixel[1], 9)
      })
  })

  test('every opening of every division of every route has a mask on its response plane', () => {
    expect(CT_TRACES).toHaveLength(17)
    expect(OPENINGS).toHaveLength(257)
    expect(UNIQUE_OPENINGS).toHaveLength(115)
    for (const o of OPENINGS)
      expect([o.trace.id, o.key, Boolean(airPlane(o.plane.slice))]).toEqual([
        o.trace.id,
        o.key,
        true,
      ])
    // No mask is left over from an older set of planes, and none is missing.
    expect(Object.keys(airPlanes.planes).map(Number).sort()).toEqual(
      [...new Set(OPENINGS.map((o) => o.plane.slice))].sort(),
    )
  })

  test('no response plane lies outside the shipped native slices, 240 to 475', () => {
    for (const o of UNIQUE_OPENINGS) {
      expect([o.key, o.plane.slice >= 240 && o.plane.slice <= 475]).toEqual([o.key, true])
      // The same opening is identified on the same plane whichever route reaches it.
      for (const other of OPENINGS.filter((entry) => entry.key === o.key))
        expect([other.trace.id, other.key, other.plane]).toEqual([other.trace.id, o.key, o.plane])
    }
  })

  test('each mask holds the fill cap around the division’s own locators, up to the image edge', () => {
    const reach = FILL_CAP_MM / NATIVE_CT.spacing[0]
    for (const o of UNIQUE_OPENINGS) {
      const plane = airPlane(o.plane.slice)!
      for (const locator of optionLocators(o.trace, o.index, o.option).filter(
        (l) => l.role !== 'other',
      )) {
        expect(Math.max(0, locator.pixel[0] - reach)).toBeGreaterThanOrEqual(plane.x0)
        expect(Math.max(0, locator.pixel[1] - reach)).toBeGreaterThanOrEqual(plane.y0)
        expect(Math.min(511, locator.pixel[0] + reach)).toBeLessThanOrEqual(plane.x0 + plane.w - 1)
        expect(Math.min(511, locator.pixel[1] + reach)).toBeLessThanOrEqual(plane.y0 + plane.h - 1)
      }
    }
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

describe('verdict on the real response planes', () => {
  test('at every fork the bench asks to be marked, a mark on an opening’s own locator is in its lumen', () => {
    const asked = OPENINGS.filter((o) => identifiable(o.trace, o.index))
    expect(asked.length).toBeGreaterThan(100)
    for (const o of asked) {
      expect([o.trace.id, o.key, optionHasVerdict(o.trace, o.index, o.option)]).toEqual([
        o.trace.id,
        o.key,
        true,
      ])
      const result = verdictAt(o, o.plane.pixel)
      expect([o.trace.id, o.key, result?.verdict, result?.markInAir]).toEqual([
        o.trace.id,
        o.key,
        'intended-lumen',
        true,
      ])
    }
  })

  test('wherever an opening has air under its locator, a mark in that air is in its lumen', () => {
    const withAir = UNIQUE_OPENINGS.filter((o) => optionHasVerdict(o.trace, o.index, o.option))
    expect(withAir).toHaveLength(111)
    for (const o of withAir) {
      const plane = airPlane(o.plane.slice)!
      const lumen = nearestAir(plane, o.plane.pixel, LOCATOR_SNAP_MM)!
      expect(planeDistanceMm(lumen, o.plane.pixel)).toBeLessThanOrEqual(LOCATOR_SNAP_MM)
      const result = verdictAt(o, lumen)!
      expect([o.key, result.verdict, result.markInAir]).toEqual([o.key, 'intended-lumen', true])
      expect(result.nearest?.role).toBe('intended')
      expect(optionLumenAreaMm2(o.trace, o.index, o.option)).toBeGreaterThan(0)
      // Where that air is within a mark's own snap, the locator itself reads the same.
      if (nearestAir(plane, o.plane.pixel, MARK_SNAP_MM))
        expect([o.key, verdictAt(o, o.plane.pixel)?.verdict]).toEqual([o.key, 'intended-lumen'])
    }
  })

  test('four openings have no air under their locator; there the nearest model centre decides', () => {
    const without = UNIQUE_OPENINGS.filter((o) => !optionHasVerdict(o.trace, o.index, o.option))
    expect(without.map((o) => o.key).sort()).toEqual([
      'junction-103:0',
      'junction-170:0',
      'junction-271:0',
      'junction-63:1',
    ])
    for (const o of without) {
      // The plane has a mask; it is the lumen that is a pixel or two wide at this threshold.
      expect(airPlane(o.plane.slice)).not.toBeNull()
      expect(optionLumenAreaMm2(o.trace, o.index, o.option)).toBe(0)
      const result = verdictAt(o, o.plane.pixel)!
      expect([o.key, result.verdict, result.markInAir]).toEqual([o.key, 'intended-lumen', false])
      expect(result.nearest?.role).toBe('intended')
      // And no fork with such an opening is asked to be marked.
      expect([o.key, identifiable(o.trace, o.index)]).toEqual([o.key, false])
    }
  })

  test('at the carina a mark in the other main bronchus is in another airway, each way round', () => {
    const [rmsb, lmsb] = [opening('junction-1', 0), opening('junction-1', 1)]
    expect([rmsb.plane.slice, lmsb.plane.slice]).toEqual([372, 372])
    const onLeft = verdictAt(rmsb, lmsb.plane.pixel)!
    expect(onLeft.verdict).toBe('other-airway')
    expect(onLeft.markInAir).toBe(true)
    expect(onLeft.nearest?.role).toBe('daughter')
    expect(onLeft.nearest?.airway.code).toBe('LMSB')
    expect(onLeft.reached.some((r) => r.locator.role === 'intended')).toBe(false)
    expect(onLeft.toIntended.mm).toBeCloseTo(30.5, 1)
    // The right main bronchus is toward the patient's right: −x in native pixels.
    expect(onLeft.toIntended.leftMm).toBeLessThan(-29)
    const onRight = verdictAt(lmsb, rmsb.plane.pixel)!
    expect([onRight.verdict, onRight.nearest?.role, onRight.nearest?.airway.code]).toEqual([
      'other-airway',
      'daughter',
      'RMSB',
    ])
  })

  test('at the carina a mark on the wall between the bronchi, or far out in the chest, is not in an airway', () => {
    const rmsb = opening('junction-1', 0)
    const lmsb = opening('junction-1', 1)
    const pixels = slicePixels(372)
    /** Not air, and no air within two pixels: beyond a mark's own snap. */
    const solid = ([x, y]: readonly number[]) => {
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (pixels[(y + dy) * 512 + x + dx] <= airPlanes.airByte) return false
      return true
    }
    // The carina: the first solid pixel on the straight line from one centre to the other.
    const [from, to] = [rmsb.plane.pixel, lmsb.plane.pixel]
    const carina = Array.from({ length: 101 }, (_, i): [number, number] => [
      Math.round(from[0] + ((to[0] - from[0]) * i) / 100),
      Math.round(from[1] + ((to[1] - from[1]) * i) / 100),
    ]).find(solid)!
    expect(carina).toBeDefined()
    expect(planeDistanceMm(carina, from)).toBeGreaterThan(5)
    expect(planeDistanceMm(carina, to)).toBeGreaterThan(5)
    for (const o of [rmsb, lmsb]) {
      const onCarina = verdictAt(o, carina)!
      expect([o.key, onCarina.verdict, onCarina.markInAir, onCarina.nearest]).toEqual([
        o.key,
        'not-in-airway',
        false,
        null,
      ])
      expect(onCarina.reached).toEqual([])
    }
    // Forty pixels (28 mm) or more from the right main bronchus, on tissue: no airway is near it.
    let far: [number, number] | null = null
    for (let y = 60; y < 452 && !far; y++)
      for (let x = 60; x < 452 && !far; x++) {
        const pixelsAway = Math.hypot(x - from[0], y - from[1])
        if (pixelsAway >= 40 && pixelsAway <= 44 && solid([x, y])) far = [x, y]
      }
    expect(far).not.toBeNull()
    const result = verdictAt(rmsb, far!)!
    expect([result.verdict, result.markInAir, result.nearest]).toEqual([
      'not-in-airway',
      false,
      null,
    ])
    expect(result.toIntended.mm).toBeGreaterThan(27)
  })

  test.each([
    ['junction-14', 0],
    ['junction-14', 1],
    ['junction-52', 1],
  ])('%s opening %i: a mark in the other daughter is in another airway', (id, option) => {
    const o = opening(id, option)
    const sibling = locatorOf(o, 'daughter')
    const result = verdictAt(o, sibling.pixel)!
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
    '%s opening %i: a mark on the %s centre of a shared air column is near the fork',
    (id, option, role) => {
      const o = opening(id, option)
      const other = locatorOf(o, role)
      const result = verdictAt(o, other.pixel)!
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
  ])('%s opening %i: a mark in lung parenchyma is not in an airway', (id, option) => {
    const o = opening(id, option)
    const lung = lungPixelNear(o.plane.slice, o.plane.pixel)
    const result = verdictAt(o, lung)!
    expect(result.verdict).toBe('not-in-airway')
    expect(result.markInAir).toBe(false)
    expect(result.toIntended.mm).toBeGreaterThan(6)
  })

  test.each([
    ['junction-20', 0],
    ['junction-20', 1],
    ['junction-52', 0],
    ['junction-52', 1],
  ])(
    '%s opening %i: a dark speck of lung that reads as air still joins no airway',
    (id, option) => {
      const o = opening(id, option)
      const plane = airPlane(o.plane.slice)!
      let speck: [number, number] | null = null
      for (let y = plane.y0; y < plane.y0 + plane.h && !speck; y++)
        for (let x = plane.x0; x < plane.x0 + plane.w && !speck; x++) {
          const mm = planeDistanceMm([x, y], o.plane.pixel)
          if (mm < 7 || mm > 11) continue
          const size = floodFillAir(plane, [x, y], FILL_CAP_MM).size
          if (size > 0 && size <= 4) speck = [x, y]
        }
      expect(speck).not.toBeNull()
      const result = verdictAt(o, speck!)!
      expect(result.verdict).toBe('not-in-airway')
      expect(result.markInAir).toBe(true)
      expect(result.reached).toEqual([])
    },
  )

  test('at −950 HU no lumen fill leaks: each small lumen stays small', () => {
    // A leak into lung (seen at −852 HU at junction-20 and junction-52) would show here as a large
    // region for a small lumen.
    const areaMm2 = (id: string, option: number) => {
      const o = opening(id, option)
      return optionLumenAreaMm2(o.trace, o.index, o.option)
    }
    expect(areaMm2('junction-52', 0)).toBeLessThan(10)
    expect(areaMm2('junction-52', 1)).toBeLessThan(4)
    expect(areaMm2('junction-20', 0)).toBeLessThan(70)
    expect(areaMm2('junction-20', 1)).toBeLessThan(60)
    expect(areaMm2('junction-14', 1)).toBeLessThan(10)
    expect(areaMm2('junction-16', 0)).toBeLessThan(12)
    // The area is the flood fill from the locator's own air, in square millimetres.
    const o = opening('junction-14', 1)
    const seed = nearestAir(airPlane(o.plane.slice)!, o.plane.pixel, LOCATOR_SNAP_MM)!
    expect(areaMm2('junction-14', 1)).toBeCloseTo(
      floodFillAir(airPlane(o.plane.slice)!, seed, FILL_CAP_MM).size * NATIVE_CT.spacing[0] ** 2,
      9,
    )
  })

  test('no verdict without a mark on the response plane, and no mask off the response planes', () => {
    const o = opening('junction-14', 0)
    const { trace, index, option, plane } = o
    expect(optionVerdict(trace, index, option, null)).toBeNull()
    expect(optionVerdict(trace, index, option, undefined)).toBeNull()
    expect(optionVerdict(trace, index, option, { slice: plane.slice, pixel: null })).toBeNull()
    // The right pixel on a neighbouring slice is not a mark on this plane.
    for (const slice of [plane.slice - 1, plane.slice + 1])
      expect(optionVerdict(trace, index, option, { slice, pixel: plane.pixel })).toBeNull()
    // At the carina the export's own plane, 387, is not the response plane.
    const carina = opening('junction-1', 0)
    expect(
      optionVerdict(carina.trace, carina.index, 0, { slice: 387, pixel: carina.plane.pixel }),
    ).toBeNull()
    // No opening, no verdict.
    expect(responsePlane(trace, index, 9)).toBeNull()
    expect(optionVerdict(trace, index, 9, markOn(o, plane.pixel))).toBeNull()
    expect(optionVerdict(trace, trace.checkpoints.length - 1, 0, markOn(o, plane.pixel))).toBeNull()
    const unused = Array.from({ length: 236 }, (_, i) => 240 + i).find(
      (slice) => !(String(slice) in airPlanes.planes),
    )!
    expect(airPlane(unused)).toBeNull()
  })
})

describe('the tracheal bifurcation is identified where the carina separates the main bronchi', () => {
  const trace = traceById('central-right')
  const decision = trace.checkpoints[0].decision!
  const [RMSB, LMSB] = decision.options

  test('both main bronchi are identified on slice 372, on their own centrelines, 30.5 mm apart', () => {
    expect(trace.checkpoints[0].id).toBe('junction-1')
    const planes = [0, 1].map((option) => responsePlane(trace, 0, option)!)
    expect(planes.map((p) => p.slice)).toEqual([372, 372])
    planes.forEach((plane, option) => {
      const [crossing] = edgeCrossings(decision.options[option].sourceEdgeId, 372)
      expect(plane.pixel).toEqual(crossing)
      const [built] = script.edgeCrossings(decision.options[option].sourceEdgeId, 372)
      expect(plane.pixel[0]).toBeCloseTo(built[0], 9)
      expect(plane.pixel[1]).toBeCloseTo(built[1], 9)
    })
    expect(planeDistanceMm(planes[0].pixel, planes[1].pixel)).toBeCloseTo(30.5, 1)
    // Every route starts at the trachea and can be scrolled to both planes.
    for (const route of CT_TRACES) {
      expect(route.checkpoints[0].id).toBe('junction-1')
      expect(route.range[0]).toBeLessThanOrEqual(372)
      expect(route.range[1]).toBeGreaterThanOrEqual(392)
      expect(responsePlane(route, 0, 0)).toEqual(planes[0])
      expect(responsePlane(route, 0, 1)).toEqual(planes[1])
    }
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
      const [right, left] = [RMSB, LMSB].map(
        (option) =>
          nearestAir(plane, edgeCrossings(option.sourceEdgeId, slice)[0], LOCATOR_SNAP_MM)!,
      )
      return floodFillAir(plane, right, 60).has(left[1] * 512 + left[0])
    }
    expect(connected(372)).toBe(false)
    expect(connected(375)).toBe(false)
    expect(connected(376)).toBe(true)
  })

  test('the route export keeps its own plane, slice 387; only the response plane moved', () => {
    for (const route of CT_TRACES)
      expect(route.checkpoints[0].decision!.options.map((o) => o.slice)).toEqual([387, 387])
    // Every other division is identified on the export's own plane and pixel.
    for (const o of UNIQUE_OPENINGS.filter((entry) => entry.checkpointId !== 'junction-1')) {
      const exported = o.trace.checkpoints[o.index].decision!.options[o.option]
      expect([o.key, o.plane]).toEqual([o.key, { slice: exported.slice, pixel: exported.pixel }])
    }
  })
})
