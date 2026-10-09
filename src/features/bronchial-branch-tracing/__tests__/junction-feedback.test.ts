import fs from 'node:fs'
import path from 'node:path'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { JUNCTION_FEEDBACK_SCOPE, junctionFeedbackPacket } from '../content/junction-feedback'
import {
  compareMarks,
  edgeAirway,
  edgeCrossings,
  planeDistanceMm,
  slotLocators,
} from '../engine/junction-feedback'
import decisions from '../geometry/branch-decisions.json'
import routes from '../geometry/paired-routes.json'
import { NATIVE_CT } from '../geometry/native-ct'
import type { LocalCtExercise } from '../content/ct-types'

const FEATURE = path.join(process.cwd(), 'src/features/bronchial-branch-tracing')
const divisionSpec = (checkpointId: string) => (spec: { checkpointId: string; kind: string }) =>
  spec.checkpointId === checkpointId && !['same-lumen', 'viewpoint'].includes(spec.kind)
const hasLocalExercise = (checkpointId: string) =>
  LESSONS.some((l) => l.exercises?.some(divisionSpec(checkpointId)))
const packetExercise = (checkpointId: string): LocalCtExercise => {
  const lesson = LESSONS.find((l) => l.exercises?.some(divisionSpec(checkpointId)))!
  return localExercise(lesson.exercises!.find(divisionSpec(checkpointId))!)
}
/** The division as the route export has it, for divisions with and without a local lesson. */
const exportedDecision = (checkpointId: string) =>
  decisions.traces.flatMap((t) => t.checkpoints).find((p) => p.id === checkpointId && p.decision)!
    .decision!
const junctionSlice = (checkpointId: string) =>
  (exportedDecision(checkpointId).junctionLps[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2]
/** The divisions the local lessons mark, in packet order. */
const LESSON_SCOPE = JUNCTION_FEEDBACK_SCOPE.filter(hasLocalExercise)
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
 * Scoring and answer-leak wording a packet must not use. The band says which lumen a mark is in;
 * it does not score it. ("passed" is left out: junction-52 uses it for divisions travelled past.)
 */
const FORBIDDEN =
  /\b(score|scored|grade|graded|fail|failed|penalt\w*|incorrect|wrong|correct)\b|you (mistook|confused)/i

describe('junction explanations', () => {
  it('covers all thirteen divisions, the central one first, and every division a local lesson marks', () => {
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
    // Every division a local lesson asks the learner to mark has an explanation.
    const lessonDivisions = new Set(
      LESSONS.flatMap((l) => l.exercises ?? [])
        .filter((spec) => !['same-lumen', 'viewpoint'].includes(spec.kind))
        .map((spec) => spec.checkpointId),
    )
    expect([...lessonDivisions].filter((id) => !junctionFeedbackPacket(id))).toEqual([])
    // junction-3 is written for the routes; no local lesson marks it.
    expect(JUNCTION_FEEDBACK_SCOPE.filter((id) => !lessonDivisions.has(id))).toEqual(['junction-3'])
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const decision = exportedDecision(id)
      expect(packet.parent).toBe(decision.parent.airway.code)
      expect(packet.daughters).toEqual(decision.options.map((o) => o.airway.code))
      // Keyed by answer slot, not by code: several divisions have daughters that share a code.
      expect(packet.whenNearer).toHaveLength(2)
      expect(packet.divergence.length).toBeGreaterThan(0)
      expect(packet.continuity.length).toBeGreaterThan(0)
      expect(packet.moreEvidence.length).toBeGreaterThan(0)
    }
    for (const id of LESSON_SCOPE)
      expect(packetExercise(id).answerPoints.map((p) => p.label)).toEqual(
        junctionFeedbackPacket(id)!.daughters.map(
          (code, i) => `${String.fromCharCode(65 + i)} · ${code}`,
        ),
      )
    expect(junctionFeedbackPacket('junction-2')).toBeUndefined()
  })
  it('ties every revisit interval to the exercise the learner can actually browse and to the model node', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const node = junctionSlice(id)
      if (hasLocalExercise(id)) {
        const [low, high] = packetExercise(id).trace.range
        for (const r of packet.revisit)
          expect(
            [id, r.from, r.to].every((v) => typeof v === 'string' || (v >= low && v <= high)),
          ).toBe(true)
      }
      // The junction level is quoted in the divergence text at its rounded slice.
      expect(packet.divergence).toContain(`slice ${Math.round(node)}`)
      const covered = packet.revisit.some(
        (r) => Math.min(r.from, r.to) - 1 <= node && node <= Math.max(r.from, r.to) + 1,
      )
      expect([id, covered]).toEqual([id, true])
    }
  })
  it('teaches in airway names with no source identifiers, and uses no scoring or answer-leak wording', () => {
    const phantoms = fs.readFileSync(path.join(FEATURE, 'content/phantoms.ts'), 'utf8')
    const packetSource = fs.readFileSync(path.join(FEATURE, 'content/junction-feedback.ts'), 'utf8')
    expect(packetSource).not.toMatch(/from '\.\/phantoms'|misconceptions/)
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
      // Synthetic phantom misconception sentences are not reused as evidence about the scan.
      for (const sentence of [
        'Recheck the course through adjacent slices; a screen position alone does not identify the destination.',
        'A visible proximal opening does not establish its unseen distal connection.',
        'Trace that evidence before deciding the continuation is unresolved.',
      ]) {
        expect(phantoms).toContain(sentence)
        expect(text).not.toContain(sentence)
      }
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
    // The model agrees: on the answer slices RB1b lies anterior to RB1a.
    const [rb1b, rb1a] = exportedDecision('junction-14').options
    expect([rb1b.airway.code, rb1a.airway.code]).toEqual(['RB1b', 'RB1a'])
    expect(rb1b.lps[1]).toBeLessThan(rb1a.lps[1])
  })
})

describe('mark comparison engine', () => {
  const j1 = packetExercise('junction-1')
  const [rmsb, lmsb] = j1.trace.checkpoints[0].decision!.options
  const [routeRmsb, routeLmsb] = exportedDecision('junction-1').options
  it('labels every route-union edge from the branch registry and interpolates plane crossings in native pixels', () => {
    for (const edge of routes.edges)
      expect([edge.id, edgeAirway(edge.id)?.code]).not.toContain(undefined)
    expect(edgeCrossings(0, 400)).toHaveLength(1) // trachea crosses slice 400 once
    expect(edgeCrossings(0, 387)).toHaveLength(0) // and ends at the carina above 387
    expect(edgeCrossings(999, 387)).toHaveLength(0)
    // The routes keep the exported plane, slice 387. The authored answer pixel was sampled by the
    // build script; it sits within half a millimetre of the interpolated crossing.
    expect([routeRmsb.slice, routeLmsb.slice]).toEqual([387, 387])
    const [routeCrossing] = edgeCrossings(routeRmsb.sourceEdgeId, 387)
    expect(planeDistanceMm(routeCrossing, routeRmsb.pixel)).toBeLessThan(0.5)
    expect(planeDistanceMm(routeRmsb.pixel, routeLmsb.pixel)).toBeCloseTo(8.6, 1)
    // The lesson marks the same two centrelines on slice 372, below the carina.
    expect([rmsb.slice, lmsb.slice]).toEqual([372, 372])
    expect([rmsb.sourceEdgeId, lmsb.sourceEdgeId]).toEqual([
      routeRmsb.sourceEdgeId,
      routeLmsb.sourceEdgeId,
    ])
    const [crossing] = edgeCrossings(rmsb.sourceEdgeId, 372)
    expect(planeDistanceMm(crossing, rmsb.pixel)).toBeLessThan(0.5)
  })
  it('reports the intended locator, the nearest other named airway, the span and the lumen, and never mutates the marks', () => {
    const marks = [
      { slice: 372, pixel: [...rmsb.pixel] as [number, number] },
      { slice: 372, pixel: null },
    ]
    const before = JSON.stringify(marks)
    const [a, b] = compareMarks(j1, marks)
    expect(JSON.stringify(marks)).toBe(before)
    expect(a.status).toBe('nearest-intended')
    expect(a.intended!.mm).toBeCloseTo(0, 5)
    expect(a.nearestSibling!.locator.airway.code).toBe('LMSB')
    expect(a.nearestSibling!.locator.role).toBe('daughter')
    expect(a.nearestSibling!.mm).toBeCloseTo(30.5, 1)
    expect(a.beyondSpan).toBe(false)
    expect(a.verdict!.verdict).toBe('intended-lumen')
    // An unresolved response gets no verdict.
    expect(b).toMatchObject({
      status: 'unresolved',
      intended: null,
      others: [],
      beyondSpan: false,
      verdict: null,
    })
    // A mark placed on the other daughter's locator is in the other main bronchus.
    const [swapped] = compareMarks(j1, [{ slice: 372, pixel: [...lmsb.pixel] }, null])
    expect(swapped.status).toBe('nearest-other')
    expect(swapped.others[0].locator.airway.code).toBe('LMSB')
    expect(swapped.others[0].mm).toBeCloseTo(0, 5)
    expect(swapped.intended!.mm).toBeCloseTo(30.5, 1)
    expect(swapped.beyondSpan).toBe(false)
    expect(swapped.verdict!.verdict).toBe('other-airway')
    expect(swapped.verdict!.nearest!.airway.code).toBe('LMSB')
    // Beyond the other locator: farther from RMSB than LMSB is.
    const [beyond] = compareMarks(j1, [
      { slice: 372, pixel: [lmsb.pixel[0] + 6, lmsb.pixel[1]] },
      null,
    ])
    expect(beyond.status).toBe('nearest-other')
    expect(beyond.beyondSpan).toBe(true)
    // A mark on another slice is not compared against this slice's locators: the route plane,
    // slice 387, is not this lesson's answer slice.
    for (const slice of [387, 375]) {
      const [elsewhere] = compareMarks(j1, [{ slice, pixel: [...rmsb.pixel] }, null])
      expect([slice, elsewhere.status, elsewhere.verdict]).toEqual([slice, 'unresolved', null])
    }
  })
  it('includes the parent where its edge still crosses the answer plane and other named airways, one per code', () => {
    const j6 = packetExercise('junction-6')
    const lb6Locators = slotLocators(j6, 0)
    const parent = lb6Locators.find((l) => l.role === 'parent')!
    expect(parent.airway.code).toBe('LLL')
    expect(edgeCrossings(parent.edgeId, 326)).toHaveLength(1)
    const [onParent] = compareMarks(j6, [{ slice: 326, pixel: [...parent.pixel] }, null])
    expect(onParent.status).toBe('nearest-other')
    expect(onParent.others[0].locator).toMatchObject({ role: 'parent', airway: { code: 'LLL' } })
    const j20 = packetExercise('junction-20')
    const [rb5a] = compareMarks(j20, [
      { slice: 309, pixel: [...j20.answerPoints[0].pixel] },
      { slice: 301, pixel: null },
    ])
    expect(rb5a.status).toBe('nearest-intended')
    expect(rb5a.others.map((o) => o.locator.airway.code)).toContain('RML')
    const codes = rb5a.others.map((o) => o.locator.airway.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).not.toContain('RB5a')
  })
  it('returns every lesson division as unresolved without marks and as nearest-intended at the model locators, and nothing for same-lumen intervals', () => {
    for (const id of LESSON_SCOPE) {
      const exercise = packetExercise(id)
      const none = compareMarks(
        exercise,
        exercise.answerPoints.map(() => null),
      )
      expect(none.map((c) => c.status)).toEqual(exercise.answerPoints.map(() => 'unresolved'))
      const exact = compareMarks(
        exercise,
        exercise.answerPoints.map((p) => ({
          slice: p.slice,
          pixel: [...p.pixel] as [number, number],
        })),
      )
      expect(exact.map((c) => [c.status, Number(c.intended!.mm.toFixed(3))])).toEqual(
        exercise.answerPoints.map(() => ['nearest-intended', 0]),
      )
    }
    const warmup = localExercise(LESSONS[0].exercises![0])
    expect(compareMarks(warmup, [{ slice: warmup.answerPoints[0].slice, pixel: [5, 5] }])).toEqual(
      [],
    )
  })
})
