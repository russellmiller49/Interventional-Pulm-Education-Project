import baseline from './fixtures/local-draft-baseline.json'
import { LESSONS, ORIENTATION_CONTRACT } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { draftSignature } from '../engine/ct-draft'
import { divisionIdentities, displayAnswerLabel, sourceNamingNote } from '../engine/branch-identity'
import { CT_TRACES, traceById } from '../geometry/native-ct'

/**
 * BBT-PRE-REVIEW-03, section C (BBTF-06, BBTF-34). Neutral Parent / Daughter A / Daughter B
 * identities carry repeated source names; the stored labels, answer points and draft signatures
 * are untouched, and no new a/b/c suffix or graph identity appears.
 */
const checkpoint = (traceId: string, id: string) =>
  traceById(traceId).checkpoints.find((p) => p.id === id)!

test('daughters that repeat a name are told apart by role and the source direction, not by a new name', () => {
  const oblique = divisionIdentities(checkpoint('upper-oblique-lateral', 'junction-16'))!
  expect(oblique.parent.display).toBe('Parent · RB3a')
  expect(oblique.daughters.map((d) => d.display)).toEqual([
    'Daughter A · RB3a · more cranial',
    'Daughter B · RB3a · more caudal',
  ])
  expect(oblique.anyRepeatedName).toBe(true)
  const lb6 = divisionIdentities(checkpoint('left-lower-returning', 'junction-11'))!
  expect(lb6.daughters.map((d) => d.display)).toEqual([
    'Daughter A · LB6 · more caudal',
    'Daughter B · LB6 · more cranial',
  ])
  const rb4 = divisionIdentities(checkpoint('middle-lobe-lateral', 'junction-19'))!
  expect(rb4.daughters.map((d) => d.display)).toEqual([
    'Daughter A · RB4 · more anterior',
    'Daughter B · RB4a',
  ])
  expect(rb4.daughters[0].repeatedName).toBe(true)
  expect(rb4.daughters[1].repeatedName).toBe(false)
  const carina = divisionIdentities(checkpoint('central-right', 'junction-1'))!
  expect(carina.daughters.map((d) => d.display)).toEqual(['Daughter A · RMSB', 'Daughter B · LMSB'])
  expect(carina.anyRepeatedName).toBe(false)
  // Nothing invents LB6a, LB6b or LB6c and nothing renames a source code.
  for (const trace of CT_TRACES)
    for (const cp of trace.checkpoints) {
      const identities = divisionIdentities(cp)
      if (!identities) continue
      for (const d of identities.daughters) {
        expect(d.code).toBe(cp.decision!.options[d.index].airway.code)
        expect(d.sourceEdgeId).toBe(cp.decision!.options[d.index].sourceEdgeId)
        expect(d.direction).toBe(cp.decision!.options[d.index].direction)
        expect(d.storedLabel).toBe(`${d.letter} · ${d.code}`)
        expect(d.display).not.toMatch(/LB6[abc]\b/)
      }
    }
})

test('the RB1 naming aid states the source assignment before marking and marks it provisional', () => {
  const rb1 = divisionIdentities(checkpoint('right-upper-apical', 'junction-14'))!
  expect(rb1.provisionalSuffix).toBe(true)
  const note = sourceNamingNote(rb1)
  expect(note).toBe(
    'Daughter A is labelled RB1b in this source (more anterior); Daughter B is labelled RB1a in this source (more posterior). The a/b letters follow this source’s labelling and are pending nomenclature review: they are shown so you can follow each lumen, not asked.',
  )
  expect(note).not.toMatch(/always|universal|anatomically/i)
  const carina = divisionIdentities(checkpoint('central-right', 'junction-1'))!
  expect(carina.provisionalSuffix).toBe(false)
  expect(sourceNamingNote(carina)).not.toMatch(/pending nomenclature review/)
})

test('stored answer labels, answer points, frame counts and draft signatures are unchanged from the base SHA', () => {
  const signatures: Record<string, string> = {}
  const answers: Record<string, unknown> = {}
  for (const lesson of LESSONS) {
    if (!lesson.exercises) continue
    const exercises = lesson.exercises.map(localExercise)
    signatures[lesson.id] = draftSignature([
      lesson.id,
      lesson.id === 'orientation' ? ORIENTATION_CONTRACT : 'local-tracing',
      exercises.map((e) => ({
        id: e.id,
        trace: e.trace,
        answers: e.answerPoints,
        review: e.review,
      })),
    ])
    for (const e of exercises) {
      answers[e.id] = {
        labels: e.answerPoints.map((p) => p.label),
        slices: e.answerPoints.map((p) => p.slice),
        frames: e.frames.length,
        range: e.trace.range,
      }
      // The learner-facing label is derived at display time; the stored label is the data.
      e.answerPoints.forEach((p, i) => {
        const display = displayAnswerLabel(e.trace.checkpoints[0], i, p.label)
        if (e.trace.checkpoints[0].decision)
          expect(display.startsWith(`Daughter ${p.label}`)).toBe(true)
        else expect(display).toBe(p.label)
      })
    }
  }
  expect(signatures).toEqual(baseline.signatures)
  expect(answers).toEqual(baseline.answers)
})
