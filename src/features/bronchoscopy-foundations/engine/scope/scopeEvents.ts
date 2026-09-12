import {
  AIRWAY_LABELS,
  DECLARABLE_STATUSES,
  SCOPE_ASSISTS,
  SCOPE_CONTROL_IDS,
  type AccessoryPosition,
  type AccessoryState,
  type AirwayLabel,
  type DeclarableStatus,
  type ScopeAssist,
  type ScopeControlId,
  type ScopeEventId,
} from '../../components/scope/types'

/**
 * The event vocabulary goals are written in (`ScopeEventId`): constructors for the templated
 * events, and a runtime guard for events read back from a record or a test.
 *
 * Events are the step's history — what happened, in order, since the step began. A templated
 * event names its airway, control, accessory state or assist; the rest are plain ids.
 */

export type PlainScopeEventId = Exclude<ScopeEventId, `${string}:${string}`>

export const PLAIN_SCOPE_EVENTS = [
  'reached-carina',
  'returned-to-trachea',
  'wall-contact',
  'red-out',
  'red-out-recovered',
  'advanced-in-red-out',
  'suction-in-red-out',
  'lens-contaminated',
  'lens-cleared',
  'advanced-blind',
  'aim-refused',
  'lumen-end',
  'entry-refused',
  'hold-started',
  'drift-detected',
  'hold-completed',
  'captured',
  'acknowledged',
  'accessory-state-verified',
  'accessory-unsafe',
  'glottis-crossed-open',
  'advanced-against-closure',
  'tube-exited',
  'survey-complete',
] as const satisfies readonly PlainScopeEventId[]

export const ACCESSORY_STATES = [
  'none',
  'forceps-closed',
  'forceps-open',
  'brush-sheathed',
  'brush-exposed',
  'needle-sheathed',
  'needle-exposed',
] as const satisfies readonly AccessoryState[]

export const ACCESSORY_POSITIONS = [
  'none',
  'in-channel',
  'at-tip',
  'extended',
] as const satisfies readonly AccessoryPosition[]

type Exhaustive<Union, Listed extends readonly Union[]> = [Exclude<Union, Listed[number]>] extends [
  never,
]
  ? true
  : never

/** Compile-time: every plain event, accessory state and position is listed above. */
export const SCOPE_EVENT_LISTS_COMPLETE: Exhaustive<PlainScopeEventId, typeof PLAIN_SCOPE_EVENTS> &
  Exhaustive<AccessoryState, typeof ACCESSORY_STATES> &
  Exhaustive<AccessoryPosition, typeof ACCESSORY_POSITIONS> = true

export const enteredEvent = (label: AirwayLabel): ScopeEventId => `entered:${label}`
export const withdrewToEvent = (label: AirwayLabel): ScopeEventId => `withdrew-to:${label}`
export const ostiumVisualizedEvent = (label: AirwayLabel): ScopeEventId =>
  `ostium-visualized:${label}`
export const declaredEvent = (label: AirwayLabel, status: DeclarableStatus): ScopeEventId =>
  `declared:${label}:${status}`
export const controlUsedEvent = (control: ScopeControlId): ScopeEventId => `control-used:${control}`
export const accessoryEvent = (state: AccessoryState): ScopeEventId => `accessory:${state}`
export const accessoryMovedEvent = (position: AccessoryPosition): ScopeEventId =>
  `accessory-moved:${position}`
export const assistEvent = (assist: ScopeAssist): ScopeEventId => `assist:${assist}`

const listed = (list: readonly string[], item: string | undefined): boolean =>
  item !== undefined && list.includes(item)

export function isScopeEventId(value: unknown): value is ScopeEventId {
  if (typeof value !== 'string') return false
  if ((PLAIN_SCOPE_EVENTS as readonly string[]).includes(value)) return true
  const parts = value.split(':')
  switch (parts[0]) {
    case 'ostium-visualized':
    case 'entered':
    case 'withdrew-to':
      return parts.length === 2 && listed(AIRWAY_LABELS, parts[1])
    case 'declared':
      return (
        parts.length === 3 &&
        listed(AIRWAY_LABELS, parts[1]) &&
        listed(DECLARABLE_STATUSES, parts[2])
      )
    case 'control-used':
      return parts.length === 2 && listed(SCOPE_CONTROL_IDS, parts[1])
    case 'accessory':
      return parts.length === 2 && listed(ACCESSORY_STATES, parts[1])
    case 'accessory-moved':
      return parts.length === 2 && listed(ACCESSORY_POSITIONS, parts[1])
    case 'assist':
      return parts.length === 2 && listed(SCOPE_ASSISTS, parts[1])
    default:
      return false
  }
}

/** How many times an event happened in the step. */
export function countScopeEvents(events: readonly ScopeEventId[], event: ScopeEventId): number {
  return events.reduce((count, candidate) => (candidate === event ? count + 1 : count), 0)
}
