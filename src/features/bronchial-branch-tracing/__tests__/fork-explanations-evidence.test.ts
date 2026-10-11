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
  optionVerdict,
  planeDistanceMm,
  responseLumen,
  responsePlane,
  type LocatorRole,
} from '../engine/junction-feedback'
import { CT_TRACES, NATIVE_CT } from '../geometry/native-ct'
import routes from '../geometry/paired-routes.json'

/**
 * The fork explanations written on October 9 and 10, 2026 say several kinds of thing that can be
 * checked: on which slices two lumens are one air column and on which a wall separates them; how
 * far apart two centres are on a slice; how wide a lumen is; and how far a daughter runs and
 * climbs. Each such sentence is held here against the shipped CT slices and the airway model, so
 * the text cannot drift from the data.
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

/** The twelve subsegmental forks where openings are marked, written on October 10, 2026. */
const SUBSEGMENTAL_FORKS = [
  'junction-36',
  'junction-73',
  'junction-138',
  'junction-42',
  'junction-86',
  'junction-161',
  'junction-43',
  'junction-46',
  'junction-94',
  'junction-47',
  'junction-53',
  'junction-91',
]
type Lumen = 'parent' | 1 | 2 | 3
const edgeOf = (id: string, lumen: Lumen) => {
  const { parent, daughters } = edgesOf(id)
  return lumen === 'parent' ? parent : daughters[lumen - 1]
}
/** Diameter of a circle with the lumen's area on the slice it is marked on. */
const across = (id: string, option: number) => {
  const { trace, index } = station(id)
  return 2 * Math.sqrt(optionLumenAreaMm2(trace, index, option) / Math.PI)
}

describe('the ten lobar and basal fork explanations', () => {
  test('each quotes the fork’s own slice and every identifying slice, as the bench computes them', () => {
    for (const id of [...NEW_FORKS, ...SUBSEGMENTAL_FORKS]) {
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
    for (const id of [...NEW_FORKS, ...SUBSEGMENTAL_FORKS])
      expect([
        id,
        /screen-(left|right)|left of the screen|right of the screen/i.test(learnerText(id)),
      ]).toEqual([id, false])
  })
})

describe('the twelve subsegmental fork explanations', () => {
  test('"one air column" and "separate" are what the shipped slices show at the verdict’s threshold', () => {
    // [fork, which two lumens, slices where they are one air column, slices where a wall separates them]
    const claims: [string, Lumen, Lumen, number[], number[]][] = [
      ['junction-36', 1, 2, [], [272, 271, 269, 265]],
      ['junction-73', 1, 2, [], [257, 256, 255]],
      ['junction-138', 2, 3, [249, 248], [247, 245, 243]],
      ['junction-138', 'parent', 1, [253], []],
      ['junction-42', 'parent', 1, [], [309]],
      ['junction-86', 'parent', 1, [314, 313], []],
      ['junction-43', 1, 2, [299, 298], []],
      ['junction-46', 1, 2, [378, 379], [380, 381, 382, 386]],
      ['junction-94', 1, 2, [388, 389, 390], [391, 393, 395]],
      ['junction-47', 1, 2, [], [395, 398, 402]],
      ['junction-91', 'parent', 1, [309], []],
      ['junction-91', 1, 2, [], [307, 306, 305]],
    ]
    for (const [id, a, b, together, apart] of claims) {
      for (const slice of together)
        expect([id, a, b, slice, joined(edgeOf(id, a), edgeOf(id, b), slice)]).toEqual([
          id,
          a,
          b,
          slice,
          true,
        ])
      for (const slice of apart)
        expect([id, a, b, slice, joined(edgeOf(id, a), edgeOf(id, b), slice)]).toEqual([
          id,
          a,
          b,
          slice,
          false,
        ])
    }
  })

  test('on its own slice each opening is a lumen of its own, or one air column with what the text says', () => {
    // What the air round an opening's own centre also reaches on the slice it is marked on.
    // Empty: the text calls it a lumen on its own there.
    const sharedWith: Record<string, LocatorRole[][]> = {
      'junction-36': [[], []],
      'junction-73': [[], ['other']], // the thin line running forward belongs to the next fork
      'junction-138': [['parent'], [], []], // the thin front end of the parent's teardrop
      'junction-42': [[], []],
      'junction-86': [[], []], // the parent is 17.5 mm back along the channel, beyond the fill
      'junction-161': [[], []],
      'junction-43': [['daughter', 'other'], []], // the front part of one channel
      'junction-46': [[], []],
      'junction-94': [[], ['daughter']], // the front part of one tall oval
      'junction-47': [[], []],
      'junction-53': [['parent'], []], // the thin line leaving the corner of the lumen
      'junction-91': [['parent'], []], // the outer part of one oblique channel
    }
    expect(Object.keys(sharedWith)).toEqual(SUBSEGMENTAL_FORKS)
    for (const id of SUBSEGMENTAL_FORKS) {
      const { trace, index } = station(id)
      const packet = junctionFeedbackPacket(id)!
      sharedWith[id].forEach((roles, option) => {
        const plane = responsePlane(trace, index, option)!
        const own = responseLumen(trace, index, option)!
        const result = optionVerdict(trace, index, option, {
          slice: plane.slice,
          pixel: own.pixel,
        })!
        expect([id, option, result.verdict]).toEqual([id, option, 'intended-lumen'])
        const reached = [...new Set(result.reached.map((r) => r.locator.role))]
          .filter((role) => role !== 'intended')
          .sort()
        expect([id, option, reached]).toEqual([id, option, [...roles].sort()])
      })
      // A note before marking is written exactly where an opening is not a lumen of its own, or
      // is too thin to show as a ring.
      const joinedSomewhere = sharedWith[id].some((roles) =>
        roles.some((role) => role === 'parent' || role === 'daughter'),
      )
      const thin = ['junction-42', 'junction-86', 'junction-161'].includes(id)
      expect([id, Boolean(packet.entryLimitation)]).toEqual([id, joinedSomewhere || thin])
    }
  })

  test('every distance between two centres is the model’s, to a tenth of a millimetre', () => {
    // [fork, opening whose slice it is, role of the other airway, its code, the figure in the text]
    const distances: [string, number, LocatorRole, string, string][] = [
      ['junction-36', 0, 'daughter', 'R basal', '5.4 mm'],
      ['junction-36', 1, 'daughter', 'RB8', '7.2 mm'],
      ['junction-36', 1, 'other', 'RB7', '12.3 mm'],
      ['junction-73', 0, 'daughter', 'RB8', '5.9 mm'],
      ['junction-73', 1, 'other', 'RB8', '5.8 mm'],
      ['junction-138', 0, 'parent', 'RB8', '6.6 mm'],
      ['junction-138', 1, 'daughter', 'RB8', '7.2 mm'],
      ['junction-138', 2, 'daughter', 'RB8', '7.2 mm'],
      ['junction-42', 0, 'parent', 'RB5a', '5.3 mm'],
      ['junction-86', 0, 'parent', 'RB5a', '17.5 mm'],
      ['junction-161', 0, 'parent', 'RB5a', '7.7 mm'],
      ['junction-43', 0, 'daughter', 'RB5b', '5.0 mm'],
      ['junction-46', 0, 'daughter', 'LB3', '7.6 mm'],
      ['junction-46', 1, 'daughter', 'LB3', '8.8 mm'],
      ['junction-46', 0, 'other', 'LB1+2', '10.3 mm'],
      ['junction-94', 1, 'daughter', 'LB3', '4.8 mm'],
      ['junction-47', 0, 'daughter', 'LB1+2', '5.9 mm'],
      ['junction-47', 1, 'daughter', 'LB1+2', '8.5 mm'],
      ['junction-53', 0, 'parent', 'LB9', '5.5 mm'],
      ['junction-91', 0, 'parent', 'LB5', '6.5 mm'],
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
      const packet = junctionFeedbackPacket(id)!
      expect([
        id,
        figure,
        `${packet.known.join(' ')} ${packet.continuity}`.includes(figure),
      ]).toEqual([id, figure, true])
    }
  })

  test('how far each daughter runs and climbs is the model’s own centreline', () => {
    // [fork, opening, millimetres travelled in the plane, millimetres up (+) or down (−), the
    //  words in the text]. The text rounds to the millimetre, so each figure is within half a
    //  millimetre of the model.
    const courses: [string, number, number, number, string][] = [
      ['junction-36', 0, 12, -7.5, 'RB8 runs 12 mm toward the patient’s right, dropping 7.5 mm'],
      ['junction-36', 1, 4, -4, 'the continuing trunk runs 4 mm back, dropping 4 mm'],
      [
        'junction-73',
        0,
        10,
        -2,
        'Daughter A runs 10 mm toward the patient’s right and slightly back, dropping 2 mm',
      ],
      ['junction-73', 1, 5, -4.4, 'Daughter B runs 5 mm forward, dropping 4.4 mm'],
      [
        'junction-138',
        0,
        25,
        3.5,
        'Daughter A runs 25 mm forward and toward the patient’s right, rising 3.5 mm',
      ],
      [
        'junction-138',
        1,
        8,
        -5,
        'Daughter B runs 8 mm forward and toward the patient’s left, dropping 5 mm',
      ],
      ['junction-138', 2, 9, -6, 'Daughter C runs 9 mm toward the patient’s right, dropping 6 mm'],
      [
        'junction-42',
        0,
        6,
        -0.7,
        'Daughter A runs 6 mm forward and toward the patient’s left, almost level',
      ],
      [
        'junction-42',
        1,
        16,
        3,
        'Daughter B runs 16 mm forward and toward the patient’s right, rising 3 mm',
      ],
      ['junction-86', 0, 29, -3, 'Daughter A runs 29 mm forward, dropping 3 mm'],
      ['junction-86', 1, 6.5, 3, 'Daughter B runs 6.5 mm forward, rising 3 mm'],
      [
        'junction-161',
        0,
        21,
        1,
        'Daughter A runs 21 mm forward and toward the patient’s right, rising 1 mm',
      ],
      [
        'junction-161',
        1,
        22,
        0,
        'Daughter B runs 22 mm forward and toward the patient’s left, staying level',
      ],
      [
        'junction-43',
        0,
        12,
        -0.8,
        'Daughter A runs 12 mm forward and toward the patient’s right, almost level',
      ],
      [
        'junction-46',
        0,
        11,
        4.6,
        'Daughter A runs 11 mm toward the patient’s left and back, rising 4.6 mm',
      ],
      ['junction-46', 1, 8, 5, 'Daughter B runs 8 mm forward, rising 5 mm'],
      [
        'junction-94',
        0,
        6,
        14,
        'Daughter A rises 14 mm with 6 mm of travel toward the patient’s left',
      ],
      ['junction-94', 1, 12, 4, 'Daughter B runs 12 mm forward, rising 4 mm'],
      [
        'junction-47',
        0,
        11,
        6,
        'Daughter A runs 11 mm back and toward the patient’s left, rising 6 mm',
      ],
      [
        'junction-47',
        1,
        4,
        11,
        'Daughter B rises 11 mm with 4 mm of travel toward the patient’s right',
      ],
      [
        'junction-53',
        0,
        29,
        -2.4,
        'Daughter A runs 29 mm back and toward the patient’s left, dropping only 2.4 mm',
      ],
      [
        'junction-53',
        1,
        4,
        -9,
        'Daughter B drops 9 mm with 4 mm of travel toward the patient’s left',
      ],
      [
        'junction-91',
        0,
        13.5,
        -1.4,
        'Daughter A runs 13.5 mm toward the patient’s left and forward, dropping 1.4 mm',
      ],
      [
        'junction-91',
        1,
        3.5,
        -7,
        'Daughter B drops 7 mm with 3.5 mm of forward and outward travel',
      ],
    ]
    for (const [id, option, inPlane, rise, words] of courses) {
      const { trace, index } = station(id)
      const decision = trace.checkpoints[index].decision!
      const points = routes.edges.find(
        (e) => e.id === decision.options[option].sourceEdgeId,
      )!.points
      const far = (p: number[]) => Math.hypot(...p.map((v, i) => v - decision.junctionLps[i]))
      const [from, to] =
        far(points[0]) <= far(points[points.length - 1])
          ? [points[0], points[points.length - 1]]
          : [points[points.length - 1], points[0]]
      const net = to.map((v, i) => v - from[i])
      expect([id, option, Math.abs(Math.hypot(net[0], net[1]) - inPlane) <= 0.5]).toEqual([
        id,
        option,
        true,
      ])
      expect([id, option, Math.abs(net[2] - rise) <= 0.5]).toEqual([id, option, true])
      expect([id, option, junctionFeedbackPacket(id)!.known.join(' ').includes(words)]).toEqual([
        id,
        option,
        true,
      ])
    }
    // The short daughter of RB5b: 3 mm in all, down and back, and no farther in the model.
    const short = station('junction-43')
    const edge = short.trace.checkpoints[short.index].decision!.options[1].sourceEdgeId
    const points = routes.edges.find((e) => e.id === edge)!.points
    const first = points[0],
      last = points[points.length - 1]
    expect(Math.hypot(...last.map((v, i) => v - first[i]))).toBeCloseTo(3.2, 1)
    expect(junctionFeedbackPacket('junction-43')!.known.join(' ')).toContain(
      'Daughter B runs 3 mm down and back',
    )
  })

  test('two marks that fall close together on the screen are apart in height, as the text says', () => {
    // [fork, millimetres apart on the screen, millimetres apart in height, the words in the text]
    const pairs: [string, number, number, string][] = [
      [
        'junction-42',
        6.3,
        2,
        '6.3 mm apart on the screen and 2 mm apart in height (slices 308 and 312)',
      ],
      [
        'junction-86',
        1.4,
        4.5,
        '1.4 mm apart on the screen and 4.5 mm apart in height (slices 312 and 321)',
      ],
      [
        'junction-161',
        5.8,
        0.5,
        '5.8 mm apart on the screen and half a millimetre apart in height (slices 310 and 309)',
      ],
      [
        'junction-53',
        4.8,
        5,
        '4.8 mm apart on the screen and 5 mm apart in height (slices 262 and 252)',
      ],
      [
        'junction-91',
        3.2,
        5,
        '3.2 mm apart on the screen and 5 mm apart in height (slices 309 and 299)',
      ],
    ]
    for (const [id, onScreen, inHeight, words] of pairs) {
      const { trace, index } = station(id)
      const [a, b] = [0, 1].map((o) => responsePlane(trace, index, o)!)
      expect([id, planeDistanceMm(a.pixel, b.pixel).toFixed(1)]).toEqual([id, onScreen.toFixed(1)])
      expect([id, Math.abs(a.slice - b.slice) * NATIVE_CT.spacing[2]]).toEqual([id, inHeight])
      expect([id, junctionFeedbackPacket(id)!.known.join(' ').includes(words)]).toEqual([id, true])
    }
  })

  test('a lumen’s stated width is the width of its air on the slice it is marked on', () => {
    // [fork, opening, the width the text gives as a range in millimetres, the words, where]
    const widths: [string, number, number, number, string, 'known' | 'continuity'][] = [
      ['junction-36', 1, 5.5, 6.5, 'the basal trunk is about 6 mm across', 'known'],
      ['junction-138', 1, 3, 4, 'each 3 to 4 mm across', 'continuity'],
      ['junction-138', 2, 3, 4, 'each 3 to 4 mm across', 'continuity'],
      ['junction-43', 1, 2.5, 3.5, 'On slice 297 Daughter B is about 3 mm across', 'known'],
      ['junction-46', 0, 3.5, 4.5, 'On slice 381 Daughter A is about 4 mm across', 'known'],
      ['junction-46', 1, 5.5, 6.5, 'on slice 382 Daughter B is about 6 mm across', 'known'],
      ['junction-94', 0, 2.5, 3.5, 'On slice 397 Daughter A is about 3 mm across', 'known'],
      ['junction-47', 0, 3.5, 4.5, 'On slice 398 Daughter A is about 4 mm across', 'known'],
      ['junction-47', 1, 2.5, 3.5, 'on slice 402 Daughter B is about 3 mm across', 'known'],
      ['junction-53', 1, 4, 5, 'one oval lumen, 4 to 5 mm across', 'continuity'],
      ['junction-91', 1, 2.5, 3.5, 'On slice 299 Daughter B is about 3 mm across', 'known'],
    ]
    for (const [id, option, low, high, words, where] of widths) {
      const mm = across(id, option)
      expect([id, option, mm >= low && mm <= high]).toEqual([id, option, true])
      const packet = junctionFeedbackPacket(id)!
      const text = where === 'known' ? packet.known.join(' ') : packet.continuity
      expect([id, words, text.includes(words)]).toEqual([id, words, true])
    }
  })

  test('each opening is tied to its own slice wherever the text gives one', () => {
    for (const id of SUBSEGMENTAL_FORKS) {
      const { trace, index } = station(id)
      const packet = junctionFeedbackPacket(id)!
      const slices = packet.daughters.map((_, option) => responsePlane(trace, index, option)!.slice)
      // The advice for an opening speaks of that opening's slice.
      packet.whenNearer.forEach((advice, option) =>
        expect([id, option, advice!.text.includes(`On slice ${slices[option]} `)]).toEqual([
          id,
          option,
          true,
        ]),
      )
      // In "where each daughter leaves", a clause that says where a lettered daughter is marked
      // gives that daughter's slice.
      let tied = 0
      for (const clause of packet.divergence.split(/[.;]\s+/)) {
        const marked = clause.match(/marked\b[^.;]*?\bon slice (\d+)/)
        if (!marked) continue
        for (const [, letter] of clause.matchAll(/\bDaughter ([A-C])\b/g)) {
          expect([id, letter, Number(marked[1])]).toEqual([
            id,
            letter,
            slices[letter.charCodeAt(0) - 65],
          ])
          tied += 1
        }
      }
      // Every fork but the one whose daughters have two different names uses the letters.
      expect([id, tied]).toEqual([id, id === 'junction-36' ? 0 : packet.daughters.length])
    }
  })

  test('a lumen said to keep its place does, and one said to slide does', () => {
    const drift = (id: string, lumen: Lumen, from: number, to: number) =>
      planeDistanceMm(
        edgeCrossings(edgeOf(id, lumen), from)[0],
        edgeCrossings(edgeOf(id, lumen), to)[0],
      )
    // RB8 slides toward the patient's right, "about 7 mm by slice 261".
    expect(drift('junction-36', 1, 272, 261)).toBeCloseTo(6.9, 0)
    // The ring that climbs keeps "the same place on every slice up to 401".
    expect(drift('junction-94', 1, 391, 401)).toBeLessThan(2.5)
    // One ring of LB1+2 stays put; the other slides back.
    expect(drift('junction-47', 2, 395, 405)).toBeLessThan(2.5)
    expect(drift('junction-47', 1, 395, 405)).toBeGreaterThan(6)
    // The continuation of LB9 "keeps nearly the same place from slice 260 down to 245".
    expect(drift('junction-53', 2, 260, 245)).toBeLessThan(4)
    // The daughter of LB5 that turns down "keeps nearly the same place down to slice 295".
    expect(drift('junction-91', 2, 307, 295)).toBeLessThan(3.5)
  })
})
