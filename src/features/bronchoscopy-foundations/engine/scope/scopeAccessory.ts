import type {
  AccessoryKind,
  AccessoryPosition,
  AccessoryState,
  ScopeEventId,
  ScopeInputs,
} from '../../components/scope/types'
import { accessoryEvent, accessoryMovedEvent, controlUsedEvent } from './scopeEvents'
import { SCOPE_MESSAGES, SCRIPT_REPORTS } from './scopeMessages'
import { ACCESSORY_STATE_WORDS } from './scopeMetrics'

/**
 * The accessory's protected and exposed states, and the channel rule (drill D21, A12).
 *
 * An accessory is exposed only beyond the tip, where the image shows it; an exposed accessory is
 * never moved back through the channel. Either move is refused and recorded as
 * `accessory-unsafe` — a rule about state, not a model of damage. A command is complete only when
 * the image agrees: the assistant-misreport script answers the first protecting command with a
 * scripted report that the image contradicts, and only a check against the image, then a second
 * command, resolves it.
 */

export type MisreportPhase = 'waiting' | 'misreported' | 'revealed' | 'resolved'

const KIND: Readonly<Record<AccessoryState, AccessoryKind | null>> = {
  none: null,
  'forceps-closed': 'forceps',
  'forceps-open': 'forceps',
  'brush-sheathed': 'brush',
  'brush-exposed': 'brush',
  'needle-sheathed': 'needle',
  'needle-exposed': 'needle',
}

const EXPOSED: ReadonlySet<AccessoryState> = new Set<AccessoryState>([
  'forceps-open',
  'brush-exposed',
  'needle-exposed',
])

export const accessoryIsExposed = (state: AccessoryState): boolean => EXPOSED.has(state)
export const accessoryKind = (state: AccessoryState): AccessoryKind | null => KIND[state]

export interface AccessoryOutcome {
  readonly inputs: ScopeInputs
  readonly events: readonly ScopeEventId[]
  readonly message: string | null
  /** The misreport script's phase after the command; null when the script is not running. */
  readonly phase: MisreportPhase | null
}

const words = (state: AccessoryState) => ACCESSORY_STATE_WORDS[state].toLowerCase()
const VISIBLE_POSITIONS: readonly AccessoryPosition[] = ['at-tip', 'extended']

/** Open, expose, close or sheath the loaded accessory. */
export function commandAccessory(
  inputs: ScopeInputs,
  target: AccessoryState,
  phase: MisreportPhase | null,
): AccessoryOutcome {
  const used = controlUsedEvent('accessory')
  const kind = KIND[inputs.accessory]
  if (!kind) return { inputs, events: [used], message: SCOPE_MESSAGES.noAccessory, phase }
  if (KIND[target] !== kind)
    return { inputs, events: [used], message: SCOPE_MESSAGES.wrongAccessory(kind), phase }
  if (target === inputs.accessory) return { inputs, events: [used], message: null, phase }
  if (EXPOSED.has(target)) {
    if (inputs.accessoryPosition !== 'extended')
      return {
        inputs,
        events: [used, 'accessory-unsafe'],
        message: SCOPE_MESSAGES.exposeInChannel,
        phase,
      }
    return {
      inputs: { ...inputs, accessory: target },
      events: [used, accessoryEvent(target)],
      message: null,
      phase,
    }
  }
  if (phase === 'waiting' && EXPOSED.has(inputs.accessory))
    return {
      inputs,
      events: [used],
      message:
        kind === 'brush' ? SCRIPT_REPORTS.misreportSheathed : SCRIPT_REPORTS.misreportProtected,
      phase: 'misreported',
    }
  const resolving = phase === 'misreported' || phase === 'revealed'
  return {
    inputs: { ...inputs, accessory: target },
    events: [used, accessoryEvent(target)],
    message: resolving
      ? kind === 'brush'
        ? SCRIPT_REPORTS.sheathedNow
        : SCRIPT_REPORTS.protectedNow
      : null,
    phase: resolving ? 'resolved' : phase,
  }
}

/** Load, advance, extend or withdraw the accessory in the working channel. */
export function moveAccessory(
  inputs: ScopeInputs,
  to: AccessoryPosition,
  phase: MisreportPhase | null,
): AccessoryOutcome {
  const used = controlUsedEvent('accessory')
  if (inputs.accessory === 'none')
    return { inputs, events: [used], message: SCOPE_MESSAGES.noAccessory, phase }
  if (to === inputs.accessoryPosition) return { inputs, events: [used], message: null, phase }
  if (EXPOSED.has(inputs.accessory) && to !== 'extended')
    return {
      inputs,
      events: [used, 'accessory-unsafe'],
      message:
        inputs.accessoryPosition === 'none'
          ? SCOPE_MESSAGES.loadExposed
          : SCOPE_MESSAGES.retrieveExposed,
      phase,
    }
  return {
    inputs: { ...inputs, accessoryPosition: to },
    events: [used, accessoryMovedEvent(to)],
    message: null,
    phase,
  }
}

/** Check the accessory's state against the image, where the image can show it. */
export function verifyAccessory(
  inputs: ScopeInputs,
  phase: MisreportPhase | null,
): AccessoryOutcome {
  if (inputs.accessory === 'none')
    return { inputs, events: [], message: SCOPE_MESSAGES.noAccessory, phase }
  if (!VISIBLE_POSITIONS.includes(inputs.accessoryPosition))
    return { inputs, events: [], message: SCOPE_MESSAGES.cannotSeeAccessory, phase }
  if (phase === 'misreported')
    return {
      inputs,
      events: [],
      message: SCOPE_MESSAGES.reportDisagrees(words(inputs.accessory)),
      phase: 'revealed',
    }
  return {
    inputs,
    events: ['accessory-state-verified'],
    message: SCOPE_MESSAGES.accessoryChecked(words(inputs.accessory)),
    phase,
  }
}
