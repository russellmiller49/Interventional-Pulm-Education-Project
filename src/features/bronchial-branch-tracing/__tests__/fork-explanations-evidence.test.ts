import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import airPlanes from '../geometry/answer-plane-air.json'
import type { CtTrace } from '../content/ct-types'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import { forkFacts } from '../engine/fork-facts'
import {
  FILL_CAP_MM,
  LOCATOR_SNAP_MM,
  edgeCrossings,
  optionLocators,
  optionLumenAreaMm2,
  planeDistanceMm,
  responsePlane,
  type LocatorRole,
} from '../engine/junction-feedback'
import { CT_TRACES, NATIVE_CT } from '../geometry/native-ct'

/**
 * The ten fork explanations written on October 9, 2026 say three kinds of thing that can be
 * checked: on which slices two lumens are one air column and on which a wall separates them; how
 * far apart two centres are on a slice; and how wide a lumen is. Each such sentence is held here
 * against the shipped CT slices and the airway model, so the text cannot drift from the data.
 */
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
const AIR_BYTE = airPlanes.airByte
const isAir = (pixels: Uint8Array, x: number, y: number) =>
  x >= 0 && y >= 0 && x < 512 && y < 512 && pixels[y * 512 + x] <= AIR_BYTE

/** The air pixel nearest a centre, no farther than the verdict's own snap distance. */
function seedNear(pixels: Uint8Array, centre: readonly number[]): [number, number] | null {
  const reach = Math.ceil(LOCATOR_SNAP_MM / NATIVE_CT.spacing[0])
  const cx = Math.round(centre[0]),
    cy = Math.round(centre[1])
  let best: { mm: number; at: [number, number] } | null = null
  for (let y = cy - reach; y <= cy + reach; y++)
    for (let x = cx - reach; x <= cx + reach; x++) {
      if (!isAir(pixels, x, y)) continue
      const mm = planeDistanceMm([x, y], centre)
      if ((x === cx && y === cy) || mm <= LOCATOR_SNAP_MM)
        if (!best || mm < best.mm) best = { mm, at: [x, y] }
    }
  return best?.at ?? null
}
/** The air region round a seed, to the verdict's own cap. */
function region(pixels: Uint8Array, seed: readonly [number, number]): Set<number> {
  const seen = new Set<number>([seed[1] * 512 + seed[0]])
  const stack: [number, number][] = [[seed[0], seed[1]]]
  while (stack.length) {
    const [x, y] = stack.pop()!
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (seen.has(ny * 512 + nx) || !isAir(pixels, nx, ny)) continue
      if (planeDistanceMm([nx, ny], seed) > FILL_CAP_MM) continue
      seen.add(ny * 512 + nx)
      stack.push([nx, ny])
    }
  }
  return seen
}
/** Are two model edges' lumens one air column on a slice? Null when either has no air there. */
function joined(edgeA: number, edgeB: number, slice: number): boolean | null {
  const pixels = slicePixels(slice)
  const a = edgeCrossings(edgeA, slice)[0],
    b = edgeCrossings(edgeB, slice)[0]
  if (!a || !b) return null
  const seedA = seedNear(pixels, a),
    seedB = seedNear(pixels, b)
  if (!seedA || !seedB) return null
  return region(pixels, seedA).has(seedB[1] * 512 + seedB[0])
}

function station(id: string): { trace: CtTrace; index: number } {
  for (const trace of CT_TRACES) {
    const index = trace.checkpoints.findIndex((c) => c.id === id && c.decision)
    if (index >= 0) return { trace, index }
  }
  throw new Error(`No route has ${id}`)
}
const edgesOf = (id: string) => {
  const { trace, index } = station(id)
  const decision = trace.checkpoints[index].decision!
  return {
    parent: decision.parent.sourceEdgeId,
    daughters: decision.options.map((o) => o.sourceEdgeId),
  }
}
const learnerText = (id: string) => {
  const p = junctionFeedbackPacket(id)!
  return [
    p.entryLimitation ?? '',
    p.divergence,
    p.continuity,
    p.moreEvidence,
    ...p.known,
    ...p.whenNearer.map((w) => w?.text ?? ''),
    ...p.revisit.map((r) => r.look),
  ].join(' ')
}

const NEW_FORKS = [
  'junction-2',
  'junction-4',
  'junction-5',
  'junction-7',
  'junction-8',
  'junction-21',
  'junction-22',
  'junction-12',
  'junction-17',
  'junction-26',
]

describe('the ten lobar and basal fork explanations', () => {
  test('each quotes the fork’s own slice and both identifying slices, as the bench computes them', () => {
    for (const id of NEW_FORKS) {
      const { trace, index } = station(id)
      const facts = forkFacts(trace, index)!
      const packet = junctionFeedbackPacket(id)!
      expect([id, packet.divergence.includes(`at about slice ${facts.forkSlice}`)]).toEqual([
        id,
        true,
      ])
      for (const opening of facts.openings)
        expect([id, opening.index, packet.divergence.includes(`slice ${opening.slice}`)]).toEqual([
          id,
          opening.index,
          true,
        ])
    }
  })

  test('"one air column" and "separate" are what the shipped slices show at the verdict’s threshold', () => {
    // [fork, which two lumens, slices where they are one air column, slices where a wall separates them]
    const claims: [string, 'parent-1' | 'parent-2' | '1-2', number[], number[]][] = [
      ['junction-2', 'parent-1', [366, 370, 374, 376], []],
      ['junction-4', 'parent-2', [384, 385, 386], []],
      ['junction-5', '1-2', [313, 314], [312, 311, 310]],
      ['junction-7', '1-2', [], [395, 397, 399]],
      ['junction-8', '1-2', [386, 387], []],
      ['junction-21', 'parent-1', [342, 345, 347], []],
      ['junction-22', 'parent-1', [334, 335, 337], []],
      ['junction-12', '1-2', [280, 282, 283], [279]],
      ['junction-17', '1-2', [], [284, 282, 280]],
      ['junction-26', '1-2', [], [278, 277, 274]],
    ]
    for (const [id, pair, together, apart] of claims) {
      const { parent, daughters } = edgesOf(id)
      const [a, b] =
        pair === 'parent-1'
          ? [parent, daughters[0]]
          : pair === 'parent-2'
            ? [parent, daughters[1]]
            : [daughters[0], daughters[1]]
      for (const slice of together)
        expect([id, pair, slice, joined(a, b, slice)]).toEqual([id, pair, slice, true])
      for (const slice of apart)
        expect([id, pair, slice, joined(a, b, slice)]).toEqual([id, pair, slice, false])
    }
  })

  test('every distance between two centres is the model’s, to a tenth of a millimetre', () => {
    // [fork, opening whose slice it is, role of the other airway, its code, the figure in the text]
    const distances: [string, number, LocatorRole, string, string][] = [
      ['junction-2', 0, 'parent', 'RMSB', '9.6 mm'],
      ['junction-4', 1, 'parent', 'RUL', '7.1 mm'],
      ['junction-5', 0, 'daughter', 'RML', '10.6 mm'],
      ['junction-5', 1, 'daughter', 'RLL', '6.4 mm'],
      ['junction-8', 0, 'daughter', 'RB3a', '7.0 mm'],
      ['junction-12', 0, 'daughter', 'LB10', '4.4 mm'],
      ['junction-12', 1, 'daughter', 'LB7+8/B9', '7.4 mm'],
      ['junction-17', 0, 'daughter', 'RB7', '8.4 mm'],
      ['junction-17', 1, 'daughter', 'R basal', '7.3 mm'],
      ['junction-26', 0, 'other', 'LB10', '7.8 mm'],
      ['junction-26', 1, 'daughter', 'LB9', '4.7 mm'],
    ]
    for (const [id, option, role, code, figure] of distances) {
      const { trace, index } = station(id)
      const locators = optionLocators(trace, index, option)
      const intended = locators.find((l) => l.role === 'intended')!
      const nearest = locators
        .filter((l) => l.role === role && l.airway.code === code)
        .map((l) => planeDistanceMm(l.pixel, intended.pixel))
        .sort((x, y) => x - y)[0]
      expect([id, option, code, `${nearest?.toFixed(1)} mm`]).toEqual([id, option, code, figure])
      expect([id, figure, junctionFeedbackPacket(id)!.known.join(' ').includes(figure)]).toEqual([
        id,
        figure,
        true,
      ])
    }
    // The rounded figures in the feedback sentences agree with the same numbers.
    expect(junctionFeedbackPacket('junction-2')!.whenNearer[0]!.text).toContain('about 10 mm')
    expect(junctionFeedbackPacket('junction-17')!.whenNearer[0]!.text).toContain('about 8 mm')
    expect(junctionFeedbackPacket('junction-17')!.whenNearer[1]!.text).toContain('about 7 mm')
    expect(junctionFeedbackPacket('junction-26')!.whenNearer[0]!.text).toContain('about 8 mm')
  })

  test('the two marks that fall almost on one spot are told apart by slice, as the text says', () => {
    // LB4 and LB5: 1 mm apart on the screen, 6 mm apart in height.
    const lingula = station('junction-22')
    const [lb4, lb5] = [0, 1].map((o) => responsePlane(lingula.trace, lingula.index, o)!)
    expect(planeDistanceMm(lb4.pixel, lb5.pixel)).toBeCloseTo(1.1, 1)
    expect(Math.abs(lb4.slice - lb5.slice) * NATIVE_CT.spacing[2]).toBe(6)
    expect(junctionFeedbackPacket('junction-22')!.known.join(' ')).toContain(
      '1 mm apart on the screen and 6 mm apart in height (slices 337 and 325)',
    )
    // The upper division and the lingular bronchus: 4 mm on the screen, 9 mm in height.
    const upper = station('junction-21')
    const [lingular, division] = [0, 1].map((o) => responsePlane(upper.trace, upper.index, o)!)
    expect(planeDistanceMm(lingular.pixel, division.pixel)).toBeCloseTo(4.0, 1)
    expect(Math.abs(lingular.slice - division.slice) * NATIVE_CT.spacing[2]).toBe(9)
    expect(junctionFeedbackPacket('junction-21')!.known.join(' ')).toContain(
      '4 mm apart on the screen and 9 mm apart in height (slices 339 and 357)',
    )
  })

  test('a lumen’s stated width is the width of its air on the slice it is marked on', () => {
    // Diameter of a circle with the lumen's area: the text says "about N mm across".
    const across = (id: string, option: number) => {
      const { trace, index } = station(id)
      return 2 * Math.sqrt(optionLumenAreaMm2(trace, index, option) / Math.PI)
    }
    expect(across('junction-7', 1)).toBeCloseTo(3.7, 0) // RB1 on 401: "about 4 mm"
    expect(across('junction-21', 1)).toBeCloseTo(5.8, 0) // upper division on 357: "about 6 mm"
    expect(across('junction-22', 1)).toBeCloseTo(4.1, 0) // LB5 on 325: "about 4 mm"
    expect(across('junction-12', 1)).toBeCloseTo(5.2, 0) // LB10 on 279: "about 5 mm"
    expect(across('junction-17', 1)).toBeCloseTo(3.6, 0) // RB7 on 282: "about 4 mm"
    expect(across('junction-17', 0)).toBeCloseTo(7.1, 0) // basal trunk on 280: "about 7 mm"
    expect(across('junction-26', 0)).toBeCloseTo(4.5, 0) // LB9 on 270: "about 5 mm"
    expect(junctionFeedbackPacket('junction-7')!.known.join(' ')).toContain('about 4 mm across')
    expect(junctionFeedbackPacket('junction-21')!.continuity).toContain('about 6 mm across')
    expect(junctionFeedbackPacket('junction-12')!.continuity).toContain('about 5 mm across')
    expect(junctionFeedbackPacket('junction-26')!.continuity).toContain('about 5 mm across')
  })

  test('sides are given as patient directions, never as sides of the screen', () => {
    // The learner has usually flipped or turned the CT by the time these are read.
    for (const id of NEW_FORKS)
      expect([
        id,
        /screen-(left|right)|left of the screen|right of the screen/i.test(learnerText(id)),
      ]).toEqual([id, false])
  })
})
