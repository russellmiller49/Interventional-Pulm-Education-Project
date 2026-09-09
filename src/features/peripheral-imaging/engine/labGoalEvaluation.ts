import type { LabId } from '../types'
import {
  ACQUISITION_CHECK_KEYS,
  labControl,
  labDefaults,
  labNumber,
  labReadouts,
  labValue,
  type LabMetricId,
  type LabState,
  type LabValue,
  type LabValues,
} from './labMetrics'

/**
 * Goals a step can set on a lab, and the one place the labs' history rules live.
 *
 * A goal is a predicate over the lab's state: a control's value, a flag, a derived readout, or an
 * event the learner has caused. Events are how a step can ask for something that a snapshot of
 * the sliders cannot show — that a plane was visited, that a capture was invalidated by moving
 * the setup afterwards. `labStateAfterChange` records them and applies the invalidation rules the
 * draft's lab bodies encoded inline (moving a checked CBCT setup clears every readiness check;
 * moving the tool hides the revealed explanation), so the pane and the goals see one history.
 */
export type LabGoalOp = 'gte' | 'lte' | 'eq' | 'neq' | 'abs-gte' | 'abs-lte'

export type LabGoal =
  | {
      readonly type: 'value'
      readonly key: string
      readonly op: LabGoalOp
      readonly value: LabValue
      readonly label: string
    }
  | { readonly type: 'flag'; readonly key: string; readonly value: boolean; readonly label: string }
  | {
      readonly type: 'metric'
      readonly metric: LabMetricId
      readonly op: LabGoalOp
      readonly value: number | boolean | string
      readonly label: string
    }
  | { readonly type: 'event'; readonly id: string; readonly label: string }

function compare(op: LabGoalOp, actual: LabValue | undefined, expected: LabValue): boolean {
  if (actual === undefined) return false
  if (typeof actual === 'number' && typeof expected === 'number') {
    switch (op) {
      case 'gte':
        return actual >= expected
      case 'lte':
        return actual <= expected
      case 'eq':
        return Math.abs(actual - expected) < 1e-9
      case 'neq':
        return Math.abs(actual - expected) >= 1e-9
      case 'abs-gte':
        return Math.abs(actual) >= expected
      case 'abs-lte':
        return Math.abs(actual) <= expected
      default:
        return false
    }
  }
  if (op === 'eq') return actual === expected
  if (op === 'neq') return actual !== expected
  return false
}

export function labGoalMet(goal: LabGoal, state: LabState, lab: LabId, lessonId: string): boolean {
  switch (goal.type) {
    case 'value':
      return compare(goal.op, labValue(lab, state.values, goal.key, lessonId), goal.value)
    case 'flag':
      return labValue(lab, state.values, goal.key, lessonId) === goal.value
    case 'metric':
      return compare(goal.op, labReadouts(lab, state.values, lessonId)[goal.metric], goal.value)
    case 'event':
      return state.events.includes(goal.id)
    default:
      return false
  }
}

export function labGoalsMet(
  goals: readonly LabGoal[],
  state: LabState,
  lab: LabId,
  lessonId: string,
): boolean {
  return goals.every((goal) => labGoalMet(goal, state, lab, lessonId))
}

export function labGoalLabel(goal: LabGoal): string {
  return goal.label
}

export function emptyLabState(lab: LabId, lessonId: string): LabState {
  return { values: labDefaults(lab, lessonId), events: [] }
}

const ACQUISITION_SETUP_KEYS = ['kind', 'acquisitionOrbit', 'offsetX', 'offsetDepth'] as const
const MPR_TOOL_KEYS = ['tipX', 'tipY', 'tipZ'] as const

function withEvent(events: readonly string[], id: string): readonly string[] {
  return events.includes(id) ? events : [...events, id]
}

/**
 * The lab after a change, with the invalidation rules applied and the history recorded.
 *
 * `patch` may be a partial or a whole values object; only keys whose value actually differs
 * count as touched. An action control (a preset or a capture) is applied through its patch.
 */
export function labStateAfterChange(
  lab: LabId,
  state: LabState,
  patch: LabValues,
  lessonId: string,
): LabState {
  let values: Record<string, LabValue> = { ...state.values }
  let events = state.events
  const touched: string[] = []

  for (const [key, raw] of Object.entries(patch)) {
    const control = labControl(lab, key)
    if (control?.kind === 'action') {
      if (raw !== true) continue
      const actionPatch =
        key === 'capture' && lab === 'registration'
          ? { previous: labNumber(lab, values, 'shift', lessonId), overlay: true }
          : (control.patch ?? {})
      for (const [patchKey, patchValue] of Object.entries(actionPatch)) {
        if (values[patchKey] !== patchValue) {
          values[patchKey] = patchValue
          touched.push(patchKey)
        }
      }
      touched.push(key)
      continue
    }
    if (values[key] !== raw) {
      values[key] = raw
      touched.push(key)
    }
  }
  if (touched.length === 0) return state

  for (const key of touched) events = withEvent(events, `touched-${key}`)

  if (lab === 'acquisition') {
    const moved = touched.some((key) => (ACQUISITION_SETUP_KEYS as readonly string[]).includes(key))
    if (moved) {
      if (state.values.captured === true) events = withEvent(events, 'moved-after-capture')
      for (const key of ACQUISITION_CHECK_KEYS) values[key] = false
      values.captured = false
    }
    if (touched.includes('captured') && values.captured === true) {
      events = withEvent(events, 'state-captured')
    }
  }

  if (lab === 'mpr') {
    if (touched.some((key) => (MPR_TOOL_KEYS as readonly string[]).includes(key))) {
      values.revealed = false
    }
    if (touched.includes('slab')) {
      events = withEvent(events, values.slab === true ? 'slab-on-seen' : 'slab-off-seen')
      if (events.includes('slab-on-seen') && events.includes('slab-off-seen')) {
        events = withEvent(events, 'slab-compared')
      }
    }
    const readouts = labReadouts(lab, values, lessonId)
    if (readouts.windowIntersects === true) events = withEvent(events, 'window-intersects-seen')
    const tipX = labNumber(lab, values, 'tipX', lessonId)
    const tipY = labNumber(lab, values, 'tipY', lessonId)
    const tipZ = labNumber(lab, values, 'tipZ', lessonId)
    const windowX = Math.max(-20, Math.min(20, tipX - 10))
    if (
      labNumber(lab, values, 'axial', lessonId) === tipZ &&
      labNumber(lab, values, 'coronal', lessonId) === tipY &&
      labNumber(lab, values, 'sagittal', lessonId) === windowX
    ) {
      events = withEvent(events, 'window-slices-visited')
    }
    if (values.revealed === true) events = withEvent(events, 'explanation-revealed')
  }

  if (lab === 'dts') {
    const plane = labNumber(lab, values, 'plane', lessonId)
    if (Math.abs(plane - -18) <= 1) events = withEvent(events, 'plane-tool-visited')
    if (Math.abs(plane) <= 1) events = withEvent(events, 'plane-lesion-visited')
    if (plane >= 20) events = withEvent(events, 'plane-deeper-visited')
  }

  if (lab === 'geometry') {
    const readouts = labReadouts(lab, values, lessonId)
    const separation = readouts.separationMm
    const depth = labNumber(lab, values, 'depth', lessonId)
    if (typeof separation === 'number' && separation < 0.5 && depth !== 0) {
      events = withEvent(events, 'overlap-seen')
    }
    if (typeof separation === 'number' && separation >= 10) {
      events = withEvent(events, 'separation-seen')
    }
  }

  if (lab === 'registration' && touched.includes('capture')) {
    events = withEvent(
      events,
      state.events.includes('contour-captured') ? 'contour-recaptured' : 'contour-captured',
    )
  }

  values = Object.fromEntries(Object.entries(values)) as Record<string, LabValue>
  return { values, events }
}
