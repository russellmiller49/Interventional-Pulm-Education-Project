import { render } from '@testing-library/react'
import {
  CtContinuationFeedback,
  CtCourseFeedback,
  CtTargetFeedback,
} from '../components/CtTraceControls'
import {
  approachReference,
  continuationReference,
  divisionLevels,
  levelPhrase,
  levelRelation,
  routeLevels,
} from '../engine/model-reference'
import { CT_TARGETS, CT_TRACES, traceById, targetForTrace } from '../geometry/native-ct'

/**
 * BBTF-10, BBTF-37 and BBTF-46. A recorded course, continuation or airway–nodule description is
 * held beside what the source export actually states. There is no reviewed course label in this
 * module, so nothing is matched automatically and nothing is marked right or otherwise.
 */

/** Verdict and accuracy wording these comparisons must never produce. */
const VERDICT =
  /\b(score|scored|grade|graded|accuracy|pass|passed|fail|failed|incorrect|wrong|correct)\b|well done|good job/i

test('level relations read from the source z axis, where higher slices are more cranial', () => {
  expect(levelRelation(416, 422)).toBe('cranial')
  expect(levelRelation(321, 313)).toBe('caudal')
  expect(levelRelation(307, 307)).toBe('same level')
})

test('an in-plane division is described as being on the parent level, not as "0 slices"', () => {
  expect(levelPhrase({ slices: 0, relation: 'same level' })).toBe(
    'on the same level as the parent point',
  )
  expect(levelPhrase({ slices: 1, relation: 'cranial' })).toBe(
    '1 slice cranial of the parent point',
  )
  expect(levelPhrase({ slices: 6, relation: 'caudal' })).toBe('6 slices caudal of the parent point')
  // RML -> RB4/RB5 is the in-plane case the learner actually meets.
  const inPlane = traceById('middle-lobe-lateral').checkpoints.find((p) => p.id === 'junction-10')!
  const levels = divisionLevels(inPlane)!
  expect(levels.daughters.map((d) => d.relation)).toEqual(['same level', 'same level'])
  const { container } = render(<CtCourseFeedback value="horizontal" checkpoint={inPlane} />)
  expect(container.textContent).toContain('on the same level as the parent point')
  expect(container.textContent).not.toMatch(/\d+ slices same level/)
})

test('division levels and the reference continuation come from the checkpoint itself', () => {
  const trace = traceById('right-upper-apical')
  const checkpoint = trace.checkpoints.find((p) => p.id === 'junction-14')!
  const levels = divisionLevels(checkpoint)!
  expect(levels.parentCode).toBe('RB1')
  expect(levels.daughters.map((d) => [d.code, d.slice, d.relation])).toEqual([
    ['RB1b', 422, 'cranial'],
    ['RB1a', 424, 'cranial'],
  ])
  expect(levels.sameDirection).toBe(true)
  const reference = continuationReference(checkpoint)!
  expect(reference.code).toBe(
    checkpoint.decision!.options.find((o) => o.sourceEdgeId === checkpoint.sourceEdgeId)!.airway
      .code,
  )
  expect(reference.others).toHaveLength(1)
  expect(reference.sharedName).toBe(false)
})

test('a division whose daughters share a name is flagged so the name is not the discriminator', () => {
  const trace = traceById('left-lower-returning')
  const shared = trace.checkpoints.filter((p) => {
    const options = p.decision?.options ?? []
    return options.length > 1 && new Set(options.map((o) => o.airway.code)).size < options.length
  })
  expect(shared.length).toBeGreaterThan(0)
  for (const checkpoint of shared) expect(continuationReference(checkpoint)!.sharedName).toBe(true)
})

test('every route’s declared approach branch is its own distal checkpoint', () => {
  for (const trace of CT_TRACES) {
    const reference = approachReference(trace, targetForTrace(trace))
    expect(reference.matchesRoute).toBe(true)
    expect(CT_TARGETS.some((t) => t.approachCode === reference.approachCode)).toBe(true)
  }
})

test('the course comparison states the source levels and refuses to match them for the learner', () => {
  const trace = traceById('right-upper-apical')
  const checkpoint = trace.checkpoints.find((p) => p.id === 'junction-14')!
  const { container } = render(<CtCourseFeedback value="cranial" checkpoint={checkpoint} />)
  expect(container.textContent).toMatch(/Your recorded course: Toward more cranial levels\./)
  expect(container.textContent).toMatch(/A · RB1b is marked on slice 422, \d+ slices cranial/)
  expect(container.textContent).toMatch(/source direction label “More anterior”/)
  expect(container.textContent).toMatch(
    /It holds no reviewed course description for what you traced, so your answer is not matched against one/,
  )
  expect(container.textContent!.match(VERDICT)?.[0] ?? null).toBeNull()

  const route = render(<CtCourseFeedback value="returning" trace={trace} />)
  const levels = routeLevels(trace)
  expect(route.container.textContent).toMatch(
    new RegExp(`${levels.levels[0].code} ${levels.levels[0].slice}`),
  )
  expect(route.container.textContent).toMatch(/change(s)? of cranial–caudal direction|no change of/)
  expect(route.container.textContent!.match(VERDICT)?.[0] ?? null).toBeNull()
})

test('the airway–nodule comparison names the declared approach and its limits', () => {
  const trace = traceById('middle-lobe-lateral')
  const reference = approachReference(trace, targetForTrace(trace))
  const { container } = render(<CtTargetFeedback value="approaches" reference={reference} />)
  expect(container.textContent).toMatch(
    /the source places this simulated nodule in RS4 .* at the end of RB4a, which is this route's distal checkpoint \(RB4a\)/,
  )
  expect(container.textContent).toMatch(/does not establish instrument reach or tool-in-lesion/)
  // A reading the source cannot speak to is said to be uncomparable, not answered.
  const adjacent = render(<CtTargetFeedback value="different-structure" reference={reference} />)
  expect(adjacent.container.textContent).toMatch(
    /what you recorded here cannot be compared with a model answer/,
  )
  expect(container.textContent!.match(VERDICT)?.[0] ?? null).toBeNull()
})

test('the continuation comparison explains the difference by level and direction, not by name', () => {
  const trace = traceById('left-lower-returning')
  const checkpoint = trace.checkpoints.find(
    (p) => p.decision && p.decision.options.length > 1 && p.id === 'junction-52',
  )!
  const reference = continuationReference(checkpoint)!
  const other = checkpoint.decision!.options.find(
    (o) => o.sourceEdgeId !== checkpoint.sourceEdgeId,
  )!
  const { container } = render(
    <CtContinuationFeedback checkpoint={checkpoint} choice={other.sourceEdgeId} />,
  )
  expect(container.textContent).toMatch(/Your recorded continuation: [AB] · /)
  expect(container.textContent).toMatch(
    new RegExp(`Model reference route: it continues through ${reference.label}`),
  )
  expect(container.textContent).toMatch(/The two differ in level and direction, not only in name\./)
  expect(container.textContent).toMatch(/A different choice is not recorded as an error/)
  if (reference.sharedName)
    expect(container.textContent).toMatch(/the name does not tell them apart/)
  expect(container.textContent!.match(VERDICT)?.[0] ?? null).toBeNull()

  // An unresolved continuation stays unresolved and is never turned into a branch.
  const unresolved = render(<CtContinuationFeedback checkpoint={checkpoint} choice="unresolved" />)
  expect(unresolved.container.textContent).toMatch(
    /continuation unresolved\. That response stays unresolved; it is not turned into a branch\./,
  )
  // Moving past without choosing is not presented as a recorded choice either.
  const none = render(<CtContinuationFeedback checkpoint={checkpoint} choice={null} />)
  expect(none.container.textContent).toMatch(/no continuation was recorded at this division\./)
})
