/**
 * Which control a Learn task is waiting for, where it is on the console, and the sentence that
 * names it — the ventilation counterpart of ECMO's `drillControlResolver`.
 *
 * Nothing here decides whether a task is done: `satisfied` is `labGoalMet`, the same predicate the
 * capture gate reads. What this adds is the DOM id "Show me where" highlights (from
 * `consoleControlIds.ts`) and the one instruction the Now card prints, in the selected console's own
 * labels and units — "Set V̇SENS to 1.5 L/min" on the PB980, "Set Trigger to 1.5 L/min" on the
 * Evita — including the confirm step on the three consoles that hold an edit until it is accepted.
 */
import type { LabSession } from '../engine/learningLab'
import { labGoalMet } from '../engine/learningLab'
import type { VentilatorControlKey, VentilatorDeviceProfile } from '../engine/types'
import { buildConsoleNumericControls } from './consoleControls'
import {
  CLOCK_ONE_BREATH_ID,
  CLOCK_RUN_ID,
  CONSOLE_PENDING_CONFIRM_ID,
  bedsideActionId,
  consoleControlId,
  consoleHoldId,
  consoleScreenId,
  interventionLabels,
  quickControlId,
  quickControlRanges,
} from './consoleControlIds'
import { canonicalToNativeControlValue, getVentilatorDeviceProfile } from './deviceProfiles'
import { ventilationExperimentStatus, type PendingConsoleEdit } from './experimentStatus'
import type { LabGoal } from './learningExperiments'

export interface GuidedConsoleTask {
  readonly goal: LabGoal
  /** The element "Show me where" marks and focuses. */
  readonly controlId: string
  /** One sentence, the learner's next move. */
  readonly instruction: string
  readonly satisfied: boolean
}

/** A pending console edit, keyed to the control it changes. */
export interface PendingConsoleControl extends PendingConsoleEdit {
  readonly key: VentilatorControlKey
}

const CLINICAL_NAMES: Partial<Record<VentilatorControlKey, string>> = {
  vtMl: 'tidal volume',
  peakFlowLMin: 'inspiratory flow',
  oxygenPercent: 'oxygen',
  peepCmH2O: 'PEEP',
  ratePerMin: 'rate',
  triggerThreshold: 'flow trigger',
  etsPercent: 'cycle-off',
  pRampMs: 'rise time',
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

/** "the PEEP (PEEP/CPAP)", "the flow trigger (V̇SENS)", or the device label alone when it says it. */
function controlName(key: VentilatorControlKey, deviceLabel: string): string {
  const clinical =
    CLINICAL_NAMES[key] ?? quickControlRanges[key]?.label.toLowerCase() ?? deviceLabel
  const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (plain(deviceLabel) === plain(clinical) || plain(deviceLabel).startsWith(plain(clinical)))
    return deviceLabel
  return `the ${clinical} (${deviceLabel})`
}

function confirmPhrase(profile: VentilatorDeviceProfile): string {
  if (profile.commitBehavior === 'immediate') return ''
  return profile.id === 'carefusion-avea'
    ? ', then press ACCEPT'
    : ', then press the knob to confirm'
}

export function resolveGuidedConsoleTask(
  goal: LabGoal,
  session: LabSession,
  profile: VentilatorDeviceProfile = getVentilatorDeviceProfile(session.device),
  pending: PendingConsoleControl | null = null,
): GuidedConsoleTask {
  const state = session.simulation
  const satisfied = labGoalMet(goal, session)
  const screen = state.ventilator.screen
  const nav = profile.navigationLabels

  if (goal.type === 'control') {
    const control = buildConsoleNumericControls(state.deviceId, state.ventilator.settings).find(
      (candidate) => candidate.key === goal.key,
    )
    const label = control?.label ?? quickControlRanges[goal.key]?.label ?? goal.key
    const unit = control?.unit ?? quickControlRanges[goal.key]?.unit ?? ''
    const target = formatValue(
      canonicalToNativeControlValue(
        state.deviceId,
        state.ventilator.settings,
        goal.key,
        goal.value,
      ),
    )
    const name = controlName(goal.key, label)
    const tile = consoleControlId(goal.key)
    if (satisfied)
      return {
        goal,
        satisfied,
        controlId: tile,
        instruction: `${name} is set to ${target} ${unit}.`,
      }
    if (pending && pending.key === goal.key && profile.commitBehavior !== 'immediate')
      return {
        goal,
        satisfied,
        controlId: CONSOLE_PENDING_CONFIRM_ID,
        instruction: `${label} ${pending.displayValue} is waiting: ${profile.id === 'carefusion-avea' ? 'press ACCEPT' : 'press the knob'} on the console to confirm it.`,
      }
    if (screen !== 'controls')
      return {
        goal,
        satisfied,
        controlId: consoleScreenId('controls'),
        instruction: `Open ${nav.controls} on the console, then select ${label}.`,
      }
    return {
      goal,
      satisfied,
      controlId: tile,
      instruction: `Set ${name} to ${target} ${unit}: select it, then turn the knob with − and + or the arrow keys${confirmPhrase(profile)}.`,
    }
  }

  if (goal.type === 'hold') {
    const holdLabel = goal.hold === 'inspiratory' ? 'Inspiratory hold' : 'Expiratory hold'
    const id = consoleHoldId(goal.hold)
    if (satisfied)
      return { goal, satisfied, controlId: id, instruction: `The ${goal.hold} hold is recorded.` }
    const ventilator = state.ventilator
    if (ventilator.pendingHold === goal.hold || ventilator.holdType === goal.hold) {
      return state.paused
        ? {
            goal,
            satisfied,
            controlId: CLOCK_RUN_ID,
            instruction: `The ${goal.hold} hold is armed. Press Run on the clock bar: the valves close at the next breath boundary.`,
          }
        : {
            goal,
            satisfied,
            controlId: id,
            instruction: `The ${goal.hold} hold is running; the reading completes when the valves reopen.`,
          }
    }
    const status = ventilationExperimentStatus(session).goals.find(
      (entry) => entry.goal.type === 'hold' && entry.goal.hold === goal.hold,
    )
    const repeat = status?.note ? ` (${status.note})` : ''
    if (screen !== 'tools')
      return {
        goal,
        satisfied,
        controlId: consoleScreenId('tools'),
        instruction: `Open ${nav.tools} on the console, then press ${holdLabel}${repeat}.`,
      }
    return {
      goal,
      satisfied,
      controlId: id,
      instruction: `Press ${holdLabel}${repeat}. It waits for the end of the next push, so let the clock run.`,
    }
  }

  if (goal.type === 'intervention') {
    const label = interventionLabels[goal.id] ?? goal.id
    const id = bedsideActionId(goal.id)
    if (satisfied) return { goal, satisfied, controlId: id, instruction: `${label}: in effect.` }
    const record = state.interventions.find((item) => item.interventionId === goal.id)
    if (record) {
      const wait = Math.max(0, Math.ceil(record.effectiveAt - state.simulationTime))
      return {
        goal,
        satisfied,
        controlId: state.paused ? CLOCK_RUN_ID : id,
        instruction: `${label} is selected; its effect starts in ${wait} s of model time.${state.paused ? ' Press Run on the clock bar.' : ''}`,
      }
    }
    return {
      goal,
      satisfied,
      controlId: id,
      instruction: `Choose ${label} under Bedside actions, beside the console.`,
    }
  }

  if (goal.type === 'mechanics') {
    const name = goal.key === 'complianceScale' ? 'Patient compliance' : 'Patient resistance'
    const id = quickControlId(goal.key)
    if (satisfied)
      return { goal, satisfied, controlId: id, instruction: `${name} is at ${goal.value}×.` }
    return {
      goal,
      satisfied,
      controlId: id,
      instruction: `Move ${name} to ${goal.value}× under Teaching patient, beside the console. Leave the ventilator settings alone.`,
    }
  }

  if (goal.type === 'pause-expiration') {
    if (satisfied)
      return {
        goal,
        satisfied,
        controlId: CLOCK_RUN_ID,
        instruction: 'Your reading of expiration is recorded.',
      }
    return {
      goal,
      satisfied,
      controlId: CLOCK_RUN_ID,
      instruction: state.paused
        ? 'Move the cursor into expiration on the frozen breath and choose Use this captured interval, or press Run and then Pause while gas is flowing out.'
        : 'Press Pause while gas is flowing out, or press Pause now and choose an expiratory interval on the frozen breath.',
    }
  }

  // inspect-inspiration
  if (satisfied)
    return {
      goal,
      satisfied,
      controlId: CLOCK_ONE_BREATH_ID,
      instruction: 'Your reading of inspiration is recorded.',
    }
  return {
    goal,
    satisfied,
    controlId: CLOCK_ONE_BREATH_ID,
    instruction: state.paused
      ? 'Move the cursor into inspiration on the frozen breath, then choose Use this captured interval.'
      : 'Press One breath to freeze the console, then move the cursor into inspiration on the frozen breath and choose Use this captured interval.',
  }
}

/** Every goal of the current round, resolved; the first unsatisfied one is the Now card's. */
export function resolveGuidedConsoleTasks(
  goals: readonly LabGoal[],
  session: LabSession,
  pending: PendingConsoleControl | null = null,
): readonly GuidedConsoleTask[] {
  const profile = getVentilatorDeviceProfile(session.device)
  return goals.map((goal) => resolveGuidedConsoleTask(goal, session, profile, pending))
}
