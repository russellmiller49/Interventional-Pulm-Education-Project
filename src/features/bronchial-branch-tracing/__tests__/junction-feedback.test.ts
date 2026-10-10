import { JUNCTION_FEEDBACK_SCOPE, junctionFeedbackPacket } from '../content/junction-feedback'
import {
  edgeAirway,
  edgeCrossings,
  optionLocators,
  optionVerdict,
  planeDistanceMm,
  responsePlane,
} from '../engine/junction-feedback'
import decisions from '../geometry/branch-decisions.json'
import routes from '../geometry/paired-routes.json'
import { CT_TRACES, NATIVE_CT } from '../geometry/native-ct'

/** Every route that passes a division, with the division's index on it. */
const stationsFor = (checkpointId: string) =>
  CT_TRACES.flatMap((trace) => {
    const index = trace.checkpoints.findIndex((p) => p.id === checkpointId && p.decision)
    return index < 0 ? [] : [{ trace, index }]
  })
const station = (checkpointId: string) => stationsFor(checkpointId)[0]
/** The division as the route export has it. */
const exportedDecision = (checkpointId: string) =>
  decisions.traces.flatMap((t) => t.checkpoints).find((p) => p.id === checkpointId && p.decision)!
    .decision!
const junctionSlice = (checkpointId: string) =>
  (exportedDecision(checkpointId).junctionLps[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2]
/** What a learner can be shown from a packet: everything but the project-record fields. */
const learnerText = (checkpointId: string) => {
  const packet = junctionFeedbackPacket(checkpointId)!
  return JSON.stringify({
    ...packet,
    checkpointId: '',
    uncertain: [],
    naming: { ...packet.naming, uncertainty: '' },
  })
}
/**
 * Scoring and answer-leak wording a packet must not use. The bench says which lumen a mark is in;
 * it does not score it. ("passed" is left out: junction-52 uses it for divisions travelled past.)
 */
const FORBIDDEN =
  /\b(score|scored|grade|graded|fail|failed|penalt\w*|incorrect|wrong|correct)\b|you (mistook|confused)/i

describe('fork explanations', () => {
  it('covers thirteen divisions, the central one first, each of them on a route', () => {
    expect(JUNCTION_FEEDBACK_SCOPE).toEqual([
      'junction-1',
      'junction-3',
      'junction-6',
      'junction-14',
      'junction-9',
      'junction-10',
      'junction-19',
      'junction-20',
      'junction-16',
      'junction-23',
      'junction-11',
      'junction-25',
      'junction-52',
    ])
    expect(new Set(JUNCTION_FEEDBACK_SCOPE).size).toBe(13)
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      expect(packet.checkpointId).toBe(id)
      // The division is a real fork of at least one route, and the same fork on all of them.
      const on = stationsFor(id)
      expect([id, on.length > 0]).toEqual([id, true])
      const decision = exportedDecision(id)
      for (const { trace, index } of on) {
        const routeDecision = trace.checkpoints[index].decision!
        expect(routeDecision.nodeId).toBe(decision.nodeId)
        expect(routeDecision.options.map((o) => o.airway.code)).toEqual(packet.daughters)
      }
      expect(packet.parent).toBe(decision.parent.airway.code)
      expect(packet.daughters).toEqual(decision.options.map((o) => o.airway.code))
      // Keyed by opening, not by code: several divisions have daughters that share a code.
      expect(packet.whenNearer).toHaveLength(decision.options.length)
      expect(packet.whenNearer).toHaveLength(2)
      expect(packet.divergence.length).toBeGreaterThan(0)
      expect(packet.continuity.length).toBeGreaterThan(0)
      expect(packet.moreEvidence.length).toBeGreaterThan(0)
    }
    expect(junctionFeedbackPacket('junction-2')).toBeUndefined()
    expect(junctionFeedbackPacket('target-approach')).toBeUndefined()
  })

  it('ties every revisit interval to slices the learner can browse and to the model node', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const node = junctionSlice(id)
      for (const { trace } of stationsFor(id)) {
        const [low, high] = trace.range
        for (const r of packet.revisit)
          expect([id, trace.id, [r.from, r.to].every((v) => v >= low && v <= high)]).toEqual([
            id,
            trace.id,
            true,
          ])
      }
      // The junction level is quoted in the divergence text at its rounded slice.
      expect(packet.divergence).toContain(`slice ${Math.round(node)}`)
      const covered = packet.revisit.some(
        (r) => Math.min(r.from, r.to) - 1 <= node && node <= Math.max(r.from, r.to) + 1,
      )
      expect([id, covered]).toEqual([id, true])
    }
  })

  it('names the slice each daughter is identified on', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const { trace, index } = station(id)
      packet.daughters.forEach((_, option) => {
        const plane = responsePlane(trace, index, option)!
        expect([
          id,
          option,
          `${packet.divergence} ${packet.continuity}`.includes(`slice ${plane.slice}`),
        ]).toEqual([id, option, true])
      })
    }
  })

  it('teaches in airway names with no source identifiers, and uses no scoring or answer-leak wording', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const text = learnerText(id)
      expect([id, text.match(FORBIDDEN)?.[0] ?? null]).toEqual([id, null])
      // Levels and distances are stated for the learner; edge and checkpoint ids are not.
      expect(packet.known.length).toBeGreaterThan(0)
      expect([id, text.match(/\bedge \d+|junction-\d+|\bOD-\d+|BBT-\d+/)?.[0] ?? null]).toEqual([
        id,
        null,
      ])
      // Review status is a project record: it is not in anything a learner is shown.
      expect([
        id,
        text.match(/faculty review|authoring session|pending|provisional|not yet reviewed/i)?.[0] ??
          null,
      ]).toEqual([id, null])
    }
  })

  it('tells a learner who could not separate the lumens what to scroll to, not that leaving it is fine', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const { moreEvidence } = junctionFeedbackPacket(id)!
      expect([id, /\b(step|scroll|follow)\b/i.test(moreEvidence)]).toEqual([id, true])
      expect([id, /\bslice \d+|\b\d{3}\b/.test(moreEvidence)]).toEqual([id, true])
      expect(moreEvidence).not.toMatch(
        /valid response|reasonable (record|response)|counted against/i,
      )
    }
    expect(junctionFeedbackPacket('junction-1')!.moreEvidence).toMatch(
      /Scroll down one slice at a time from 376: the wall appears on 375 and is thick by 372\. Mark each oval on 372\./,
    )
  })

  it('asks a naming question wherever the two daughters have different names, in the textbook orientation', () => {
    const withTry = JUNCTION_FEEDBACK_SCOPE.filter((id) => junctionFeedbackPacket(id)!.naming.try)
    expect(withTry).toEqual([
      'junction-1',
      'junction-3',
      'junction-6',
      'junction-14',
      'junction-9',
      'junction-10',
      'junction-20',
      'junction-23',
    ])
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      expect(packet.naming.demonstration.length).toBeGreaterThan(0)
      // No question where this source gives both daughters, or one daughter and the parent, one code.
      const distinct =
        new Set(packet.daughters).size === 2 && !packet.daughters.includes(packet.parent)
      expect([id, Boolean(packet.naming.try)]).toEqual([id, distinct])
      if (!packet.naming.try) continue
      const attempt = packet.naming.try
      const decision = exportedDecision(id)
      expect(attempt.choices.map((c) => c.code).sort()).toEqual([...packet.daughters].sort())
      expect(packet.daughters).toContain(attempt.describes)
      expect(Object.keys(attempt.explanation).sort()).toEqual([...packet.daughters].sort())
      // The described daughter agrees with the source geometry in patient LPS coordinates:
      // +x is the patient's left, +y posterior, +z cranial.
      const described = decision.options.find((o) => o.airway.code === attempt.describes)!
      const other = decision.options.find((o) => o.airway.code !== attempt.describes)!
      const more = { right: 0, anterior: 1, caudal: 2 } as const
      const expectMore = (axis: keyof typeof more, sign: 1 | -1 = 1) =>
        expect([id, axis, sign * (other.lps[more[axis]] - described.lps[more[axis]]) > 0]).toEqual([
          id,
          axis,
          true,
        ])
      if (id === 'junction-1') expectMore('right')
      if (id === 'junction-3') expectMore('caudal') // LLL continues caudally
      if (id === 'junction-3') expectMore('anterior', -1) // and posteriorly
      if (id === 'junction-6') expectMore('caudal', -1) // LB6 runs upward
      if (id === 'junction-9') expectMore('caudal', -1) // RB6 runs upward
      if (id === 'junction-9') expectMore('anterior', -1) // from the posterior wall
      if (id === 'junction-10') expectMore('right') // RB4 is lateral in the right lung
      if (id === 'junction-14') expectMore('anterior', -1) // RB1a is the posterior (dorsal) one
      if (id === 'junction-20') expectMore('caudal') // RB5b descends
      if (id === 'junction-23') expectMore('anterior') // LB3 is the anterior (ventral) one
    }
    // Kurimoto & Morita: B1a dorsal, B1b ventral; B5a horizontal, B5b caudal.
    const rb1 = junctionFeedbackPacket('junction-14')!.naming
    expect(rb1.try!.describes).toBe('RB1a')
    expect(rb1.demonstration.join(' ')).toMatch(
      /RB1a, which goes posteriorly \(dorsal\), and RB1b, which goes anteriorly \(ventral\)/,
    )
    expect(rb1.try!.explanation.RB1a).toMatch(/dorsal.*posterior/)
    expect(rb1.try!.explanation.RB1b).toMatch(/ventral.*anterior/)
    const rb5 = junctionFeedbackPacket('junction-20')!.naming
    expect(rb5.try!.describes).toBe('RB5b')
    expect(rb5.demonstration.join(' ')).toMatch(
      /RB5a, which runs forward near-horizontally, and RB5b, which runs forward and down/,
    )
    expect(rb5.try!.explanation.RB5a).toMatch(/horizontal/)
    expect(rb5.try!.explanation.RB5b).toMatch(/caudal/)
    // The model agrees: on the response planes RB1b lies anterior to RB1a.
    const [rb1b, rb1a] = exportedDecision('junction-14').options
    expect([rb1b.airway.code, rb1a.airway.code]).toEqual(['RB1b', 'RB1a'])
    expect(rb1b.lps[1]).toBeLessThan(rb1a.lps[1])
  })
})

describe('model locators on a response plane', () => {
  const j1 = station('junction-1')
  const [routeRmsb, routeLmsb] = exportedDecision('junction-1').options
  const [rmsb, lmsb] = [0, 1].map((option) => responsePlane(j1.trace, j1.index, option)!)

  it('labels every route-union edge from the branch registry and interpolates plane crossings in native pixels', () => {
    for (const edge of routes.edges)
      expect([edge.id, edgeAirway(edge.id)?.code]).not.toContain(undefined)
    expect(edgeAirway(999)).toBeUndefined()
    expect(edgeCrossings(0, 400)).toHaveLength(1) // trachea crosses slice 400 once
    expect(edgeCrossings(0, 387)).toHaveLength(0) // and ends at the carina above 387
    expect(edgeCrossings(999, 387)).toHaveLength(0)
    // The export keeps its own plane, slice 387. The exported pixel was sampled by the build
    // script; it sits within half a millimetre of the interpolated crossing.
    expect([routeRmsb.slice, routeLmsb.slice]).toEqual([387, 387])
    const [routeCrossing] = edgeCrossings(routeRmsb.sourceEdgeId, 387)
    expect(planeDistanceMm(routeCrossing, routeRmsb.pixel)).toBeLessThan(0.5)
    expect(planeDistanceMm(routeRmsb.pixel, routeLmsb.pixel)).toBeCloseTo(8.6, 1)
    // The same two centrelines are identified on slice 372, below the carina.
    expect([rmsb.slice, lmsb.slice]).toEqual([372, 372])
    expect(rmsb.pixel).toEqual(edgeCrossings(routeRmsb.sourceEdgeId, 372)[0])
    expect(lmsb.pixel).toEqual(edgeCrossings(routeLmsb.sourceEdgeId, 372)[0])
    expect(planeDistanceMm(rmsb.pixel, lmsb.pixel)).toBeCloseTo(30.5, 1)
  })

  it('reports the intended locator, the other daughter and the lumen, and never moves a mark', () => {
    const locators = optionLocators(j1.trace, j1.index, 0)
    expect(locators[0]).toEqual({
      edgeId: routeRmsb.sourceEdgeId,
      airway: routeRmsb.airway,
      role: 'intended',
      pixel: rmsb.pixel,
    })
    expect(locators.filter((l) => l.role === 'intended')).toHaveLength(1)
    const sibling = locators.find((l) => l.role === 'daughter')!
    expect(sibling).toMatchObject({ edgeId: routeLmsb.sourceEdgeId, airway: { code: 'LMSB' } })
    expect(sibling.pixel).toEqual(lmsb.pixel)
    // The trachea ends above slice 372: no parent locator on this plane.
    expect(locators.some((l) => l.role === 'parent')).toBe(false)

    const mark = { slice: 372, pixel: [...rmsb.pixel] as [number, number] }
    const before = JSON.stringify(mark)
    const result = optionVerdict(j1.trace, j1.index, 0, mark)!
    expect(JSON.stringify(mark)).toBe(before)
    expect(result.verdict).toBe('intended-lumen')
    expect(result.toIntended.mm).toBeCloseTo(0, 9)
    expect(result.nearest).toEqual(locators[0])
    expect(result.reached[0].mm).toBeCloseTo(0, 9)
    // A mark on the other daughter's locator is in the other main bronchus, 30.5 mm away.
    const swapped = optionVerdict(j1.trace, j1.index, 0, { slice: 372, pixel: [...lmsb.pixel] })!
    expect(swapped.verdict).toBe('other-airway')
    expect(swapped.nearest!.airway.code).toBe('LMSB')
    expect(swapped.reached[0].mm).toBeCloseTo(0, 9)
    expect(swapped.toIntended.mm).toBeCloseTo(30.5, 1)
    // A mark on another slice is not compared against this plane's locators: the export's
    // plane, slice 387, is not where the main bronchi are identified.
    for (const slice of [387, 375])
      expect([
        slice,
        optionVerdict(j1.trace, j1.index, 0, { slice, pixel: [...rmsb.pixel] }),
      ]).toEqual([slice, null])
  })

  it('includes the parent where its edge still crosses the response plane, and other named airways', () => {
    const j6 = station('junction-6')
    const plane = responsePlane(j6.trace, j6.index, 0)!
    expect(plane.slice).toBe(326)
    const parent = optionLocators(j6.trace, j6.index, 0).find((l) => l.role === 'parent')!
    expect(parent.airway.code).toBe('LLL')
    expect(edgeCrossings(parent.edgeId, 326)).toHaveLength(1)
    const onParent = optionVerdict(j6.trace, j6.index, 0, { slice: 326, pixel: [...parent.pixel] })!
    expect(onParent.nearest).toMatchObject({ role: 'parent', airway: { code: 'LLL' } })
    expect(onParent.verdict).toBe('near-fork')

    const j20 = station('junction-20')
    const rb5a = responsePlane(j20.trace, j20.index, 0)!
    expect(rb5a.slice).toBe(309)
    const locators = optionLocators(j20.trace, j20.index, 0)
    expect(locators.filter((l) => l.role === 'other').map((l) => l.airway.code)).toContain('RML')
    // A division's own edges are never listed again as "other".
    const decision = j20.trace.checkpoints[j20.index].decision!
    const own = new Set([
      decision.parent.sourceEdgeId,
      ...decision.options.map((o) => o.sourceEdgeId),
    ])
    expect(locators.filter((l) => l.role === 'other').some((l) => own.has(l.edgeId))).toBe(false)
    // Each airway a mark's air reaches is reported once, nearest crossing first.
    const reached = optionVerdict(j20.trace, j20.index, 0, {
      slice: 309,
      pixel: [...rb5a.pixel],
    })!.reached
    expect(new Set(reached.map((r) => r.locator.edgeId)).size).toBe(reached.length)
    expect(reached.map((r) => r.mm)).toEqual([...reached.map((r) => r.mm)].sort((a, b) => a - b))
  })

  it('gives every division with an explanation an intended locator at each opening’s own response pixel', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const { trace, index } = station(id)
      trace.checkpoints[index].decision!.options.forEach((option, k) => {
        const plane = responsePlane(trace, index, k)!
        const intended = optionLocators(trace, index, k).filter((l) => l.role === 'intended')
        expect(intended).toHaveLength(1)
        expect(intended[0]).toMatchObject({ edgeId: option.sourceEdgeId, pixel: plane.pixel })
        expect(optionVerdict(trace, index, k, { slice: plane.slice, pixel: null })).toBeNull()
      })
    }
    // A checkpoint without a division has no locators.
    const last = CT_TRACES[0].checkpoints.length - 1
    expect(optionLocators(CT_TRACES[0], last, 0)).toEqual([])
  })
})
