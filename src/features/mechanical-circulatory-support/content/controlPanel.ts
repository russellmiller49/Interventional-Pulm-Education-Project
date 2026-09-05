import type { McsDeviceKind } from '../engine/types'
import { mcsLearnerCopyErrors, mcsSourceIdsRegistered } from './learnerCopy'

/**
 * The small control panel: the few things a learner can change on any of these devices, said once.
 *
 * A novice reads a support console as many things that might need action. Enumerating the few
 * that are actually settings — and saying out loud that everything else is monitoring, and that
 * the patient's own conditions are the other side — is what turns every later alarm from "what do
 * I touch?" into "which setting, if any?". The "if any" is the point: most of the states this
 * module teaches are loading problems no setting answers, and the panel is what makes that a
 * teachable answer rather than a trick.
 *
 * Authored here and quoted nowhere else. Every Explain step reuses it as a strip with each
 * control in one of three states; the section that introduces it reads these records rather than
 * restating them.
 */

export const mcsControlIds = ['iabp-ratio', 'iabp-timing', 'impella-level', 'lvad-speed'] as const
export type McsControlId = (typeof mcsControlIds)[number]

/** The two axes: what the device is asked for, and what the circulation lets it deliver. */
export type McsControlAxis = 'setting' | 'loading'

export interface McsControl {
  readonly id: McsControlId
  readonly deviceKind: McsDeviceKind
  /** Plain name first; the label a learner sees on the device second. */
  readonly plainName: string
  readonly consoleLabel: string
  /** What this setting is for. */
  readonly principallyMoves: string
  /** What it does not do, said beside what it does, because the two are habitually confused. */
  readonly doesNotMove: string
}

export interface McsLoadingCondition {
  readonly id: 'volume' | 'resistance' | 'rhythm' | 'right-ventricle'
  readonly plainName: string
  readonly sentence: string
}

export interface McsControlPanel {
  readonly controls: readonly McsControl[]
  readonly loading: readonly McsLoadingCondition[]
  /** The one sentence the panel is introduced with. */
  readonly sentence: string
  /** The sentence that names the other axis. */
  readonly loadingSentence: string
  readonly sourceIds: readonly string[]
}

export const MCS_CONTROL_PANEL = {
  controls: [
    {
      id: 'iabp-ratio',
      deviceKind: 'iabp',
      plainName: 'The assist ratio',
      consoleLabel: 'the ratio setting',
      principallyMoves: 'how many beats the balloon assists',
      doesNotMove: 'a flow of its own; the balloon moves no stream',
    },
    {
      id: 'iabp-timing',
      deviceKind: 'iabp',
      plainName: 'The inflation and deflation timing',
      consoleLabel: 'the timing offsets',
      principallyMoves: 'how much of the mechanism is available on each assisted beat',
      doesNotMove: 'the failing ventricle the balloon is helping',
    },
    {
      id: 'impella-level',
      deviceKind: 'impella',
      plainName: 'The performance level',
      consoleLabel: 'the P-level',
      principallyMoves: 'what the pump is asked to move',
      doesNotMove: 'what reaches the inlet, or what the outlet ejects against',
    },
    {
      id: 'lvad-speed',
      deviceKind: 'lvad',
      plainName: 'The speed',
      consoleLabel: 'rpm, changed only with an order',
      principallyMoves: 'what the pump is asked to move',
      doesNotMove: 'the displayed flow directly; that number is computed, not measured',
    },
  ],
  loading: [
    {
      id: 'volume',
      plainName: 'Volume',
      sentence: 'What has arrived in front of the pump.',
    },
    {
      id: 'resistance',
      plainName: 'Resistance',
      sentence: 'What the pump ejects against.',
    },
    {
      id: 'rhythm',
      plainName: 'Rhythm',
      sentence: 'What the balloon has to time itself to.',
    },
    {
      id: 'right-ventricle',
      plainName: 'The right ventricle',
      sentence: 'What every left-sided device inherits.',
    },
  ],
  sentence:
    'You can change only a few things on any of these devices. On the balloon, the assist ratio and the inflation and deflation timing. On the transvalvular pump, the performance level. On the durable pump, the speed, and only with an order. Everything else on the console is monitoring.',
  loadingSentence:
    "The patient's own conditions — volume, resistance, rhythm, the right ventricle — are the other side. Most of what the alarms report is about them, not about a setting.",
  sourceIds: [
    'mcs-bedside-reference-supplied',
    'getinge-iabp-current',
    'fda-impella-cp-labeling',
    'fda-heartmate3-ifu',
    'mcs-educational-model-v1',
  ],
} as const satisfies McsControlPanel

export const mcsControlById: ReadonlyMap<McsControlId, McsControl> = new Map(
  MCS_CONTROL_PANEL.controls.map((control) => [control.id, control]),
)

export function mcsControl(id: McsControlId): McsControl {
  const control = mcsControlById.get(id)
  if (!control) throw new Error(`Unknown MCS control: ${id}`)
  return control
}

/** The controls a device's console actually carries. */
export function mcsControlsForDevice(deviceKind: McsDeviceKind): readonly McsControl[] {
  return MCS_CONTROL_PANEL.controls.filter((control) => control.deviceKind === deviceKind)
}

/**
 * The state of one control on a section's strip.
 *
 * `this-setting` is the one the section's action moves; `not-this-setting` is a setting the
 * learner may be tempted by that does not answer the section's problem; `no-setting` is the
 * verdict a loading problem earns — find the cause.
 */
export type McsControlStripState = 'this-setting' | 'not-this-setting' | 'no-setting'

export function validateMcsControlPanel(panel: McsControlPanel = MCS_CONTROL_PANEL): string[] {
  const errors: string[] = []
  const ids = panel.controls.map((control) => control.id)
  if (new Set(ids).size !== ids.length) errors.push('two controls share an id')
  for (const id of mcsControlIds) {
    if (!ids.includes(id)) errors.push(`control ${id} is declared but has no record`)
  }
  for (const control of panel.controls) {
    if (control.principallyMoves === control.doesNotMove) {
      errors.push(`${control.id}: says it moves and does not move the same thing`)
    }
    for (const [field, value] of Object.entries({
      plainName: control.plainName,
      consoleLabel: control.consoleLabel,
      principallyMoves: control.principallyMoves,
      doesNotMove: control.doesNotMove,
    })) {
      errors.push(...mcsLearnerCopyErrors(`${control.id}.${field}`, value))
    }
    // The learner is told what can be set by the sentence that introduces the panel.
    if (!panel.sentence.toLowerCase().includes(control.plainName.toLowerCase())) {
      errors.push(`${control.id}: the panel sentence does not name it`)
    }
  }
  for (const condition of panel.loading) {
    errors.push(...mcsLearnerCopyErrors(`${condition.id}.plainName`, condition.plainName))
    errors.push(...mcsLearnerCopyErrors(`${condition.id}.sentence`, condition.sentence))
    if (!panel.loadingSentence.toLowerCase().includes(condition.plainName.toLowerCase())) {
      errors.push(`${condition.id}: the loading sentence does not name it`)
    }
  }
  errors.push(...mcsLearnerCopyErrors('sentence', panel.sentence))
  errors.push(...mcsLearnerCopyErrors('loadingSentence', panel.loadingSentence))
  if (!/monitoring/i.test(panel.sentence)) {
    errors.push('the panel sentence must say that everything else is monitoring')
  }
  if (panel.sourceIds.length === 0) errors.push('no sources')
  if (!mcsSourceIdsRegistered(panel.sourceIds)) errors.push('names a source that is not registered')
  return errors
}

const controlPanelErrors = validateMcsControlPanel()
if (controlPanelErrors.length > 0) {
  throw new Error(`Invalid MCS control panel:\n- ${controlPanelErrors.join('\n- ')}`)
}
