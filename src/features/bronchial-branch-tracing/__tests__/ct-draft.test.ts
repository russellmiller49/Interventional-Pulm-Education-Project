import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { traceById } from '../geometry/native-ct'
import { orientationFor } from '../geometry/orientation'
import { draftSignature, freshRouteView, readCtDraft, writeCtDraft } from '../engine/ct-draft'
import { emptyCtSession, emptyTraceWork } from '../engine/ct-session'
import { emptyLocalSession, localSessionReducer, parseLocalSession } from '../engine/local-session'
import { parseRouteDraft } from '../engine/route-draft'
import { parsePracticeDraft, type PracticeDraft } from '../engine/practice-draft'

const exercises = LESSONS.find((lesson) => lesson.id === 'continuity')!.exercises!.map(
  localExercise,
)
const trace = traceById('central-right')
const transfer = traceById('left-lower-returning')
const orientation = orientationFor('mirror')
const mark = { slice: trace.checkpoints[0].slice, pixel: [200, 210] as [number, number] }
const branch = trace.checkpoints[0].decision!.options[0].sourceEdgeId
const view = { ...freshRouteView(trace), focus: 'junction' as const, showScope: true }

function localDraft() {
  let session = emptyLocalSession(exercises)
  for (const action of [{ type: 'focus-airway' }, { type: 'begin' }] as const)
    session = localSessionReducer(exercises, session, action)
  session = localSessionReducer(exercises, session, {
    type: 'mark',
    mark: { slice: exercises[0].answerPoints[0].slice, pixel: [200, 210] },
  })
  session = localSessionReducer(exercises, session, { type: 'check' })
  return {
    ...session,
    orientation,
    views: Object.fromEntries(
      exercises.map((exercise) => [
        exercise.id,
        { ...freshRouteView(exercise.trace), showNodule: false, showScope: true },
      ]),
    ),
  }
}
function routeDraft() {
  return {
    session: {
      ...emptyCtSession(trace),
      step: 1,
      orientation,
      marks: [mark, ...emptyTraceWork(trace).marks.slice(1)],
      branches: [branch, ...emptyTraceWork(trace).branches.slice(1)],
      recorded: [true, ...emptyTraceWork(trace).recorded.slice(1)],
      targetViewed: { [trace.id]: true },
      junctionHistory: { [`${trace.id}.${trace.checkpoints[0].id}`]: [{ mark, branch }] },
    },
    views: { [trace.id]: view, [transfer.id]: freshRouteView(transfer) },
  }
}
function practiceDraft(): PracticeDraft {
  const session = routeDraft().session
  return {
    index: 0,
    active: 0,
    furthest: 0,
    work: {
      ...emptyTraceWork(trace),
      marks: session.marks,
      branches: session.branches,
      recorded: session.recorded,
      course: 'uncertain',
      targetRelation: '',
      orientation,
      alignment: { first: orientation, used: orientation },
      reached: 0,
    },
    drafts: {},
    responses: [null, null],
    firstOrientations: [orientation, null],
    submitted: false,
    attempts: session.junctionHistory,
    targetViewed: session.targetViewed,
    views: { [trace.id]: view, [transfer.id]: freshRouteView(transfer) },
  }
}

const cases = [
  {
    name: 'local lesson',
    make: localDraft,
    parse: (v: unknown) => parseLocalSession(v, exercises),
  },
  {
    name: 'complete route',
    make: routeDraft,
    parse: (v: unknown) => parseRouteDraft(v, trace, transfer, trace),
  },
  {
    name: 'Practice / More routes',
    make: practiceDraft,
    parse: (v: unknown) => parsePracticeDraft(v, [trace.id, transfer.id]),
  },
]

beforeEach(() => localStorage.clear())
describe.each(cases)('$name saved CT magnification', ({ name, make, parse }) => {
  const signature = draftSignature(name)
  function roundTrip(value: ReturnType<typeof make>) {
    expect(writeCtDraft(localStorage, name, signature, value)).toBe(true)
    return readCtDraft<NonNullable<ReturnType<typeof parse>>>(localStorage, name, signature, parse)
      .value
  }
  it.each([1, 1.6, 2.5, 3, 4])('restores %s× without changing any draft field', (magnification) => {
    const value = make()
    const id = Object.keys(value.views)[0]
    value.views[id] = { ...value.views[id], magnification }
    expect(parse(value)).toEqual(value)
    expect(roundTrip(value)).toEqual(value)
  })
  it.each([0.9, 0, -1, 4.1, 5, 999])(
    'defaults an out-of-range %s× field to 1× while retaining all other work and views',
    (magnification) => {
      const value = make()
      const id = Object.keys(value.views)[0]
      value.views[id] = { ...value.views[id], magnification }
      const expected = {
        ...value,
        views: { ...value.views, [id]: { ...value.views[id], magnification: 1 } },
      }
      expect(roundTrip(value)).toEqual(expected)
      // Parsing must not mutate the input or repair unrelated fields.
      expect(value.views[id].magnification).toBe(magnification)
      expect(
        parse({ ...value, views: { ...value.views, [id]: { ...value.views[id], slice: 999 } } }),
      ).toBeNull()
    },
  )
})
