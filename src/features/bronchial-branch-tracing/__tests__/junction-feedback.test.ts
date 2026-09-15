import fs from 'node:fs'
import path from 'node:path'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import {
  JUNCTION_FEEDBACK_OBSERVATION,
  JUNCTION_FEEDBACK_SCOPE,
  junctionFeedbackPacket,
} from '../content/junction-feedback'
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
const packetExercise = (checkpointId: string): LocalCtExercise => {
  const divisionExercise = (spec: { checkpointId: string; kind: string }) =>
    spec.checkpointId === checkpointId && !['same-lumen', 'viewpoint'].includes(spec.kind)
  const lesson = LESSONS.find((l) => l.exercises?.some(divisionExercise))!
  return localExercise(lesson.exercises!.find(divisionExercise)!)
}
const junctionSlice = (checkpointId: string) => {
  const point = decisions.traces
    .flatMap((t) => t.checkpoints)
    .find((p) => p.id === checkpointId && p.decision)!
  return (point.decision!.junctionLps[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2]
}
/** Learner-facing grade, verdict or attributed-error wording that BBT-02 must not introduce. */
const FORBIDDEN =
  /\b(score|scored|grade|graded|pass|passed|fail|failed|penalt\w*|incorrect|wrong|correct)\b|you (mistook|confused)/i

describe('five-junction feedback packet', () => {
  it('covers exactly five junctions that exist as local exercises, an easy central division first and subsegmental choices last', () => {
    expect(JUNCTION_FEEDBACK_SCOPE).toEqual([
      'junction-1',
      'junction-6',
      'junction-10',
      'junction-14',
      'junction-20',
    ])
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const exercise = packetExercise(id)
      const decision = exercise.trace.checkpoints[0].decision!
      expect(packet.parent).toBe(decision.parent.airway.code)
      expect(packet.daughters).toEqual(decision.options.map((o) => o.airway.code))
      expect(Object.keys(packet.whenNearer).sort()).toEqual([...packet.daughters].sort())
      expect(exercise.answerPoints.map((p) => p.label)).toEqual(
        packet.daughters.map((code, i) => `${String.fromCharCode(65 + i)} · ${code}`),
      )
    }
    expect(junctionFeedbackPacket('junction-9')).toBeUndefined()
    expect(junctionFeedbackPacket('junction-2')).toBeUndefined()
  })
  it('ties every revisit interval to the exercise the learner can actually browse and to the model node', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const [low, high] = packetExercise(id).trace.range
      const node = junctionSlice(id)
      for (const r of packet.revisit) {
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
  it('states known source relationships by edge, keeps uncertainty explicit, and never grades, verdicts or attributes an error', () => {
    const phantoms = fs.readFileSync(path.join(FEATURE, 'content/phantoms.ts'), 'utf8')
    const packetSource = fs.readFileSync(path.join(FEATURE, 'content/junction-feedback.ts'), 'utf8')
    expect(packetSource).not.toMatch(/from '\.\/phantoms'|misconceptions/)
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const exercise = packetExercise(id)
      const decision = exercise.trace.checkpoints[0].decision!
      const text = JSON.stringify(packet)
      expect([id, text.match(FORBIDDEN)?.[0] ?? null]).toEqual([id, null])
      expect(packet.known.length).toBeGreaterThan(0)
      expect(packet.uncertain.length).toBeGreaterThan(0)
      expect(packet.known[0]).toContain(`edge ${decision.parent.sourceEdgeId}`)
      for (const option of decision.options)
        expect(packet.known[0]).toContain(`edge ${option.sourceEdgeId}`)
      expect(packet.uncertain.join(' ')).toMatch(/faculty review|authoring[- ]session/)
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
    expect(JUNCTION_FEEDBACK_OBSERVATION.status).toMatch(/Pending faculty review/)
  })
  it('offers a naming try only where the name follows lobar or segmental anatomy, and shows subsegmental labels with their uncertainty', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
      const packet = junctionFeedbackPacket(id)!
      const decision = packetExercise(id).trace.checkpoints[0].decision!
      expect(packet.naming.demonstration.length).toBeGreaterThan(0)
      const subsegmental = packet.daughters.some((code) => /^[RL]B\d+[a-c]$/.test(code))
      if (subsegmental) {
        expect([id, packet.naming.try]).toEqual([id, undefined])
        expect(packet.naming.uncertainty).toMatch(/pending faculty review/)
      } else {
        const attempt = packet.naming.try!
        expect(attempt.choices.map((c) => c.code).sort()).toEqual([...packet.daughters].sort())
        expect(packet.daughters).toContain(attempt.describes)
        expect(Object.keys(attempt.explanation).sort()).toEqual([...packet.daughters].sort())
        // The described daughter agrees with the source geometry in patient LPS coordinates.
        const described = decision.options.find((o) => o.airway.code === attempt.describes)!
        const other = decision.options.find((o) => o.airway.code !== attempt.describes)!
        if (id === 'junction-1') expect(described.lps[0]).toBeLessThan(other.lps[0]) // more right
        if (id === 'junction-6') expect(described.lps[2]).toBeGreaterThan(other.lps[2]) // more cranial
        if (id === 'junction-10') expect(described.lps[0]).toBeLessThan(other.lps[0]) // more lateral (right)
      }
    }
  })
})

describe('mark comparison engine', () => {
  const j1 = packetExercise('junction-1')
  const [rmsb, lmsb] = j1.trace.checkpoints[0].decision!.options
  it('labels every route-union edge from the branch registry and interpolates plane crossings in native pixels', () => {
    for (const edge of routes.edges)
      expect([edge.id, edgeAirway(edge.id)?.code]).not.toContain(undefined)
    expect(edgeCrossings(0, 400)).toHaveLength(1) // trachea crosses slice 400 once
    expect(edgeCrossings(0, 387)).toHaveLength(0) // and ends at the carina above 387
    expect(edgeCrossings(999, 387)).toHaveLength(0)
    const [crossing] = edgeCrossings(rmsb.sourceEdgeId, 387)
    // The authored answer pixel was sampled by the build script; it sits within half a millimetre of the interpolated crossing.
    expect(planeDistanceMm(crossing, rmsb.pixel)).toBeLessThan(0.5)
  })
  it('reports the intended locator, the nearest other named airway and the span, and never mutates the marks', () => {
    const marks = [
      { slice: 387, pixel: [...rmsb.pixel] as [number, number] },
      { slice: 387, pixel: null },
    ]
    const before = JSON.stringify(marks)
    const [a, b] = compareMarks(j1, marks)
    expect(JSON.stringify(marks)).toBe(before)
    expect(a.status).toBe('nearest-intended')
    expect(a.intended!.mm).toBeCloseTo(0, 5)
    expect(a.others[0].locator.airway.code).toBe('LMSB')
    expect(a.others[0].locator.role).toBe('daughter')
    expect(a.others[0].mm).toBeCloseTo(8.6, 1)
    expect(a.beyondSpan).toBe(false)
    expect(b).toMatchObject({ status: 'unresolved', intended: null, others: [], beyondSpan: false })
    // A mark placed on the other daughter's locator is reported as nearer that airway, not as an error.
    const [swapped] = compareMarks(j1, [{ slice: 387, pixel: [...lmsb.pixel] }, null])
    expect(swapped.status).toBe('nearest-other')
    expect(swapped.others[0].locator.airway.code).toBe('LMSB')
    expect(swapped.others[0].mm).toBeCloseTo(0, 5)
    expect(swapped.intended!.mm).toBeCloseTo(8.6, 1)
    expect(swapped.beyondSpan).toBe(false)
    // Beyond the other locator: farther from RMSB than LMSB is.
    const [beyond] = compareMarks(j1, [
      { slice: 387, pixel: [lmsb.pixel[0] + 6, lmsb.pixel[1]] },
      null,
    ])
    expect(beyond.status).toBe('nearest-other')
    expect(beyond.beyondSpan).toBe(true)
    // A mark on another slice is not compared against this slice's locators.
    expect(compareMarks(j1, [{ slice: 390, pixel: [...rmsb.pixel] }, null])[0].status).toBe(
      'unresolved',
    )
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
  it('returns every packet junction as unresolved without marks and as nearest-intended at the model locators, and nothing for same-lumen intervals', () => {
    for (const id of JUNCTION_FEEDBACK_SCOPE) {
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
