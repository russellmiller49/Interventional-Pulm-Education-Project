import { minus, plus, projectOptical, times, unit } from '@/lib/bronchoscopy-core/frame'
import { sampleEdgePose } from '@/lib/airway-anatomy/scope-state'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import type { Vec3 } from '@/lib/airway-anatomy/types'

import type {
  AirwayLabel,
  ScopeControlKey,
  ScopeEventId,
  ScopeGoalTest,
  ScopeState,
  ScopeViewSpec,
} from '../../components/scope/types'
import { airwayDisplayName, labelAncestry, treeNodeByLabel } from '../../content/airwayTree'
import { scopeGoalTestMet } from './scopeGoalEvaluation'
import type { ScopeCase } from './scopeCase'
import { aimAt } from './scopeFrame'
import { normalizeRotationDeg } from './scopeInputs'
import { tipBaseFrame } from './scopePose'
import { reduceScope } from './scopeReducer'
import type { ScopeRuntimeState } from './scopeRuntime'
import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from './scopeOstia'

/**
 * "Show me where", for the goal the learner is actually on (fellow walkthrough A30).
 *
 * The previous mapping read only the goal's first clause, so every location or airway-sequence goal
 * pointed at Advance — even after the carina was reached and the next thing needed was a turn of the
 * control section. Help now finds the first requirement the step has not yet met. When that
 * requirement is an opening, it asks the engine itself: an opening behind the tip needs a withdraw;
 * one an advance from here would reach (the reducer's own answer, run on a copy) needs Advance;
 * otherwise the align-to-branch math says whether the bend has to be turned into its plane first
 * (rotate) or only bent toward it (deflect).
 *
 * Help is advice, never an action. Nothing here dispatches a command, records an assist, marks an
 * opening seen or an airway inspected, or meets a goal; the host shows the words and highlights a
 * control, and the pane may ring the opening it names as a reference.
 */
export interface GoalHelp {
  /** The control that moves this goal on, or null when none does (a hold, a "without"). */
  readonly control: ScopeControlKey | null
  /** The airway whose opening the help is about, when the requirement names one. */
  readonly target: AirwayLabel | null
  /** One sentence the learner can act on. */
  readonly sentence: string
}

type Requirement =
  | { readonly kind: 'event'; readonly event: ScopeEventId }
  | { readonly kind: 'location'; readonly airway: AirwayLabel }
  | { readonly kind: 'ledger'; readonly airway: AirwayLabel }
  | { readonly kind: 'metric'; readonly test: Extract<ScopeGoalTest, { type: 'metric' }> }

/** The first thing this test still needs, in the order the test states it. */
export function pendingRequirement(test: ScopeGoalTest, state: ScopeState): Requirement | null {
  if (scopeGoalTestMet(test, state)) return null
  switch (test.type) {
    case 'event':
      return { kind: 'event', event: test.event }
    case 'event-sequence': {
      // The same walk as `hasEventSequence`: the first event of the sequence not yet matched.
      let next = 0
      for (const event of state.events)
        if (next < test.events.length && event === test.events[next]) next += 1
      return next < test.events.length ? { kind: 'event', event: test.events[next] } : null
    }
    case 'location':
      return { kind: 'location', airway: test.airway }
    case 'ledger':
      return { kind: 'ledger', airway: test.airway }
    case 'ledger-complete': {
      const missing = test.airways.find((airway) => !state.ledger[airway])
      return missing ? { kind: 'ledger', airway: missing } : null
    }
    case 'metric':
      return { kind: 'metric', test }
    case 'all':
      for (const inner of test.tests) {
        const pending = pendingRequirement(inner, state)
        if (pending) return pending
      }
      return null
    case 'without':
    case 'bench-target':
      return null
  }
}

/** "the right upper lobe bronchus", "RB6 · Right lower lobe, superior". */
export function airwayWords(label: AirwayLabel): string {
  const name = airwayDisplayName(label)
  return treeNodeByLabel(label).type === 'segmental_bronchus'
    ? name
    : `the ${name.charAt(0).toLowerCase()}${name.slice(1)}`
}

/** How far into a child branch the engine probes its direction (`BRANCH_PROBE_MM` in scope-state). */
const BRANCH_PROBE_MM = 8
/** Below this change in rotation, the lever alone brings the opening in. */
const ROTATE_FIRST_DEG = 15
/** How many advances the what-if runs before it gives up. */
const LOOKAHEAD_ADVANCES = 40
/** Events that end an advance short of its goal. */
const STOPS: readonly ScopeEventId[] = [
  'aim-refused',
  'wall-contact',
  'lumen-end',
  'entry-refused',
  'advanced-blind',
  'advanced-in-red-out',
  'advanced-against-closure',
]

/**
 * What advancing from here would do, answered by the reducer itself on a copy of the state — the
 * engine's own aim guard, walls and branch choice, not a second model of them. Pure: the learner's
 * state is never touched, and nothing is dispatched or recorded.
 */
function advanceReaches(
  state: ScopeRuntimeState,
  view: ScopeViewSpec,
  scopeCase: ScopeCase,
  reached: (next: ScopeRuntimeState, added: readonly ScopeEventId[]) => boolean,
  onPath: (label: AirwayLabel | null) => boolean,
): boolean {
  if (!view.controls.includes('advance')) return false
  let current = state
  for (let step = 0; step < LOOKAHEAD_ADVANCES; step += 1) {
    const next = reduceScope(current, { type: 'advance', mm: current.inputs.stepMm }, 'keyboard', {
      view,
      scopeCase,
    })
    const added = next.events.slice(current.events.length)
    if (reached(next, added)) return true
    if (added.some((event) => STOPS.includes(event))) return false
    if (!onPath(next.location.label)) return false
    if (next.depthMm === current.depthMm && next.location.label === current.location.label)
      return false
    current = next
  }
  return false
}

/** The turn and bend that point the axis along a direction, the align-to-branch way. */
function steeringAlong(
  direction: Vec3,
  state: ScopeState,
  view: ScopeViewSpec,
  scopeCase: ScopeCase,
): { readonly rotateBy: number; readonly deflectBy: number } | null {
  if (!state.engine) return null
  const base = tipBaseFrame(state.engine, view, scopeCase)
  const aim = aimAt(base, plus(base.position, times(direction, 20)))
  // The same direction is reached by turning the other way round and bending the other way.
  const options = [
    { rotation: aim.rotationDeg, deflection: aim.deflectionDeg },
    { rotation: normalizeRotationDeg(aim.rotationDeg + 180), deflection: -aim.deflectionDeg },
  ].map((option) => ({
    turn: normalizeRotationDeg(option.rotation - state.inputs.rotationDeg),
    bend: option.deflection - state.inputs.deflectionDeg,
    deflection: option.deflection,
  }))
  const chosen = Math.abs(options[0].turn) <= Math.abs(options[1].turn) ? options[0] : options[1]
  // A straight-ahead aim needs no particular turn.
  return {
    rotateBy: Math.abs(chosen.deflection) < 3 ? 0 : chosen.turn,
    deflectBy: chosen.bend,
  }
}

/** Which control moves the tip toward an opening, read from the engine's own behaviour. */
function steer(
  state: ScopeRuntimeState,
  view: ScopeViewSpec,
  scopeCase: ScopeCase | null,
  target: AirwayLabel,
  purpose: 'enter' | 'see',
): GoalHelp {
  const current = state.location.label
  const words = airwayWords(target)
  if (state.place !== 'airway' || current === null)
    return {
      control: 'advance',
      target,
      sentence: `Advance into the airway first; ${words} is further on.`,
    }
  const path = labelAncestry(target)
  const beyondTip = path.includes(current) && current !== target
  if (!beyondTip)
    return {
      control: 'withdraw',
      target,
      sentence:
        current === target
          ? `The tip is inside ${words}; its opening is behind the tip. Withdraw to see it.`
          : `${capitalize(words)} is not ahead of the tip from here. Withdraw toward the airway it branches from.`,
    }
  // The next labelled opening on the way: the target itself, or the airway it branches from.
  const pin = state.ostia.find(
    (candidate) => candidate.label === target || path.includes(candidate.label),
  )
  if (!pin || !state.pose || !scopeCase)
    return {
      control: 'advance',
      target,
      sentence: `Advance: the opening toward ${words} is further along this airway.`,
    }
  const intermediate = pin.label !== target
  const which = intermediate ? `${airwayWords(pin.label)}, on the way to ${words}` : words
  const opening = `the opening of ${which}`
  const seeing = purpose === 'see' && !intermediate
  const onPath = (label: AirwayLabel | null) => label !== null && path.includes(label)
  const reaches = seeing
    ? advanceReaches(
        state,
        view,
        scopeCase,
        (_next, added) => added.includes(`ostium-visualized:${target}`),
        onPath,
      )
    : advanceReaches(state, view, scopeCase, (next) => next.location.label === pin.label, onPath)
  if (reaches)
    return {
      control: 'advance',
      target: pin.label,
      sentence: seeing
        ? `Advance: ${opening} comes into view as the tip goes on.`
        : `Advance: an advance from here goes into ${opening}.`,
    }
  // To see an opening, point the axis at it; to go through one, point along its branch.
  const frame = scopeOpticalFrame(state.pose)
  const child = scopeCase.index.edgesById.get(pin.edgeId)
  const node = child ? scopeCase.index.nodesById.get(child.startNodeId) : undefined
  const direction =
    seeing || !child || !node
      ? unit(minus(pin.pointLps, frame.position), frame.forward)
      : unit(
          minus(sampleEdgePose(child, Math.min(BRANCH_PROBE_MM, child.lengthMm)).point, node.lps),
          frame.forward,
        )
  const steering = steeringAlong(direction, state, view, scopeCase)
  const projected = projectOptical(pin.pointLps, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)
  const inField = projected !== null && Math.hypot(projected.x * OPTICAL_ASPECT, projected.y) < 1
  const outside = inField ? '' : ' It is outside the field of view now.'
  if (steering && Math.abs(steering.rotateBy) > ROTATE_FIRST_DEG)
    return {
      control: 'rotate',
      target: pin.label,
      sentence: `Rotate ${steering.rotateBy > 0 ? 'clockwise' : 'counterclockwise'}: ${opening} is off the plane the lever bends in.${outside}`,
    }
  return {
    control: 'deflect',
    target: pin.label,
    sentence: `Deflect toward ${steering && steering.deflectBy < 0 ? 'D' : 'U'}: ${opening} is in the plane the lever bends in.${outside}`,
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function eventHelp(
  event: ScopeEventId,
  state: ScopeRuntimeState,
  view: ScopeViewSpec,
  scopeCase: ScopeCase | null,
): GoalHelp {
  const [kind, value] = event.split(':') as [string, string | undefined]
  switch (kind) {
    case 'entered':
      return steer(state, view, scopeCase, value as AirwayLabel, 'enter')
    case 'ostium-visualized':
      return steer(state, view, scopeCase, value as AirwayLabel, 'see')
    case 'withdrew-to':
      return {
        control: 'withdraw',
        target: value as AirwayLabel,
        sentence: `Withdraw until the tip is back in ${airwayWords(value as AirwayLabel)}.`,
      }
    case 'declared':
      return {
        control: 'declare',
        target: value as AirwayLabel,
        sentence: `Declare ${airwayWords(value as AirwayLabel)} in the inspection record.`,
      }
    case 'control-used':
      return {
        control:
          value === 'insertion'
            ? 'advance'
            : value === 'rotation'
              ? 'rotate'
              : value === 'deflection'
                ? 'deflect'
                : value === 'suction'
                  ? 'suction'
                  : 'accessory',
        target: null,
        sentence: 'Use the highlighted control.',
      }
    case 'accessory':
    case 'accessory-moved':
      return { control: 'accessory', target: null, sentence: 'Use the accessory controls.' }
    case 'accessory-state-verified':
      return {
        control: 'verifyAccessory',
        target: null,
        sentence: 'Check the accessory against the image.',
      }
    case 'returned-to-trachea':
      return {
        control: 'withdraw',
        target: 'TR',
        sentence: 'Withdraw until the tip is back in the trachea.',
      }
    case 'withdrawn':
      return { control: 'withdraw', target: null, sentence: 'Withdraw the scope.' }
    case 'captured':
      return { control: 'capture', target: null, sentence: 'Capture an image.' }
    case 'acknowledged':
      return { control: 'acknowledge', target: null, sentence: 'Acknowledge the assistant.' }
    case 'lens-cleared':
      return { control: 'clearLens', target: null, sentence: 'Clear the lens.' }
    case 'suction-applied':
    case 'suction-released':
      return { control: 'suction', target: null, sentence: 'Use the suction control.' }
    case 'hold-completed':
      return view.controls.includes('step')
        ? { control: 'step', target: null, sentence: 'Step the scripted hold on.' }
        : {
            control: null,
            target: null,
            sentence: 'Hold the tip where it is; the scripted hold runs down on its own.',
          }
    case 'glottis-crossed-open':
      return {
        control: 'advance',
        target: null,
        sentence: 'Advance through the glottis when the folds readout shows the opening.',
      }
    case 'reached-carina':
      return {
        control: 'advance',
        target: null,
        sentence: 'Advance down the trachea to the main carina.',
      }
    default:
      return { control: 'advance', target: null, sentence: 'Advance along the airway.' }
  }
}

/** Help for a goal not yet met, or null when the goal is met or nothing moves it on. */
export function goalHelp(
  test: ScopeGoalTest,
  state: ScopeRuntimeState,
  view: ScopeViewSpec,
  scopeCase: ScopeCase | null,
): GoalHelp | null {
  const pending = pendingRequirement(test, state)
  if (!pending) return null
  switch (pending.kind) {
    case 'event':
      return eventHelp(pending.event, state, view, scopeCase)
    case 'location':
      return steer(state, view, scopeCase, pending.airway, 'enter')
    case 'ledger':
      return {
        control: 'declare',
        target: pending.airway,
        sentence: `Record ${airwayWords(pending.airway)} in the inspection record.`,
      }
    case 'metric': {
      const { metric, op, value } = pending.test
      if (metric === 'rotationDeg')
        return { control: 'rotate', target: null, sentence: 'Turn the control section.' }
      if (metric === 'deflectionDeg')
        return { control: 'deflect', target: null, sentence: 'Move the angulation lever.' }
      if (metric === 'depthMm')
        return op === '<=' && state.depthMm > value
          ? { control: 'withdraw', target: null, sentence: 'Withdraw the scope.' }
          : { control: 'advance', target: null, sentence: 'Advance the scope.' }
      return null
    }
  }
}
