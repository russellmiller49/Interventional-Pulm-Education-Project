import type { CtNoduleTarget, CtTrace } from '../content/ct-types'
import { routePlan } from '../content/nav-lessons'
import { mappedForks } from './arc-map'
import { moving } from './nav-session'
import { ROUTE_PLAN_PARTS } from './plan-session'
import {
  startTrip,
  tripReducer,
  type TripAction,
  type TripPlan,
  type TripSession,
} from './trip-session'

/**
 * The method, demonstrated once from the lesion to the lesion: a list of steps, each a caption
 * and the bench's own actions. Nothing here draws or decides anything; the planning and driving
 * reducers do, exactly as they do for a learner who asks to be shown each step. The demonstration
 * is those "show me" actions played in order.
 *
 * The lesion is the one in the left upper lobe's anterior segment: it is in no lesson and not in
 * the closing set, so showing its whole answer costs the course nothing else.
 */
export const DEMO_TARGET_ID = 'l-anterior'
export const DEMO_LESSON_ID = 'watch-the-method'

export interface DemoStep {
  id: string
  /** The part of the method this step belongs to. */
  part: 'Plan' | 'Map' | 'Navigate'
  caption: string
  /** Played in order when the step begins; the first step has none. */
  actions: TripAction[]
}

export function demoTrip(trace: CtTrace): TripPlan {
  return {
    plan: { traceId: trace.id, targetId: DEMO_TARGET_ID, parts: ROUTE_PLAN_PARTS, worked: true },
    nav: routePlan(trace, { matchOptional: true, cruise: true }),
  }
}

const plan = (type: 'show-lesion' | 'show-segment' | 'show-frame' | 'show-arcs' | 'finish') =>
  ({ type: 'plan', action: { type } }) satisfies TripAction
const takeAndDrive: TripAction[] = [
  { type: 'nav', action: { type: 'show-choice' } },
  { type: 'nav', action: { type: 'drive' } },
]

export function demoSteps(trace: CtTrace, target: CtNoduleTarget, trip: TripPlan): DemoStep[] {
  const divisions = mappedForks(trace, target).length
  const stations = trip.nav!.stations
  const firstStop = stations.findIndex((station) => !station.cruise)
  const bronchus = target.segment.bronchusCode
  const steps: DemoStep[] = [
    {
      id: 'lesion',
      part: 'Plan',
      caption:
        'Start at the lesion, not at the trachea. Scroll the CT from the lesion toward the hilum and find the airway that runs into it.',
      actions: [],
    },
    {
      id: 'airway',
      part: 'Plan',
      caption:
        'This is the airway into the lesion. Follow it back, slice by slice, until it joins a bronchus you can name.',
      actions: [plan('show-lesion')],
    },
    {
      id: 'segment',
      part: 'Plan',
      caption: `It is ${bronchus}. The map begins at its ostium: everything central to that you already know.`,
      actions: [plan('show-segment')],
    },
    {
      id: 'circle',
      part: 'Map',
      caption: `Draw the ${bronchus} ostium as a circle, with the four directions round it as the scope will show them when you look in.`,
      actions: [plan('show-frame')],
    },
  ]
  for (let d = 0; d < divisions; d++)
    steps.push({
      id: `arcs-${d + 1}`,
      part: 'Map',
      // The step ends with this division drawn and the bench waiting at the next one.
      caption:
        d === 0
          ? `Division 1 of ${divisions} is drawn. On the CT, see where each branch leaves; each gets an arc on that side of the circle. The shaded branch goes on toward the lesion, and the next division is drawn inside it.`
          : d === divisions - 1
            ? `Division ${d + 1}, the last. The branch that reaches the lesion carries the star. This is the map.`
            : `Division ${d + 1} is drawn, inside the branch shaded at division ${d}.`,
      actions: [plan('show-arcs')],
    })
  // Each step of the drive ends with the scope at rest at a fork, so its caption is about the
  // fork on screen: the opening is taken and the scope driven on as the next step begins.
  steps.push({
    id: 'fly',
    part: 'Navigate',
    caption:
      'The map is drawn. Now drive: the scope flies through the central airways and stops at the fork where the segment’s bronchus leaves. Above the ostium you choose from the anatomy you know.',
    actions: [plan('finish')],
  })
  const firstMapped = stations.length - divisions
  for (let station = firstStop + 1; station < stations.length; station++) {
    const d = station - firstMapped
    steps.push({
      id: d < 0 ? `central-${station - firstStop}` : `division-${d + 1}`,
      part: 'Navigate',
      caption:
        d < 0
          ? `Another fork above the ostium. Take the opening toward ${bronchus}.`
          : d === 0
            ? `The ${bronchus} ostium, where the map takes over. Division 1 on the map is the fork in front of you: the marked arc is the opening to take.`
            : `Division ${d + 1}. Read the arc, find that opening, drive on.`,
      actions: takeAndDrive,
    })
  }
  steps.push({
    id: 'arrived',
    part: 'Navigate',
    caption:
      'The end of the airway: the lesion lies beyond the wall. That is the method. Start at the lesion, follow the airway back, draw the circle and the arcs, then drive with the map.',
    actions: takeAndDrive,
  })
  return steps
}

/** Carries a drive to the fork it is heading for, as the bench does when its scope arrives. */
function settle(reduce: (s: TripSession, a: TripAction) => TripSession, session: TripSession) {
  let state = session
  for (let guard = 0; guard < 60 && state.nav && moving(state.nav.phase); guard++) {
    const next = reduce(state, { type: 'nav', action: { type: 'arrive' } })
    if (next === state) break
    state = next
  }
  return state
}

export interface DemoTimeline {
  /** The session as each step begins: its actions applied, the scope still on its way. */
  begins: TripSession[]
  /** The session once each step has come to rest. */
  rests: TripSession[]
}
/** Every step's session, worked out once, so stepping back lands exactly where a step began. */
export function demoTimeline(
  trace: CtTrace,
  target: CtNoduleTarget,
  trip: TripPlan,
  steps: readonly DemoStep[],
): DemoTimeline {
  const reduce = tripReducer(trace, target, trip)
  const begins: TripSession[] = []
  const rests: TripSession[] = []
  let state = startTrip(trace, target, trip)
  for (const step of steps) {
    state = step.actions.reduce(reduce, state)
    begins.push(state)
    state = settle(reduce, state)
    rests.push(state)
  }
  return { begins, rests }
}
