/**
 * The controls a Learn section is allowed to point at.
 *
 * A section that says "adjust the pump" and leaves the learner to find which of thirteen sliders it
 * meant has not given an instruction. Each entry here names one control that actually renders, the
 * simulator action it produces, what variable it changes, and — the part that keeps the module
 * honest — what moving it does *not* guarantee.
 *
 * The id is the contract with the components: every control listed here renders carrying
 * `data-mcs-control="<id>"`, so the learner-action pane can highlight exactly one control and a test
 * can prove the control a section points at is on the screen. Renaming a visible label is then a
 * cosmetic change; removing a control is one a test catches.
 */

import type { McsDeviceKind } from '../engine/types'

export type McsLearnControlId =
  | 'control:inspect-arterial'
  | 'control:inspect-preload'
  | 'control:inspect-device'
  | 'control:select-iabp'
  | 'control:select-impella'
  | 'control:select-lvad'
  | 'control:iabp-inflation'
  | 'control:iabp-trigger'
  | 'control:impella-left-level'
  | 'control:impella-left-position'
  | 'control:impella-right-enable'
  | 'control:lvad-thrombosis'
  | 'control:patient-rv-contractility'
  | 'control:patient-svr'
  | 'control:team-escalate'

export interface McsLearnControl {
  readonly id: McsLearnControlId
  /** The visible label beside the control. */
  readonly label: string
  /** Where it lives, so the instruction can say so without the learner hunting. */
  readonly location: 'guided-actions' | 'patient-conditions' | 'device-settings'
  /** The simulator action id the control produces. */
  readonly actionId: string
  /** Which topology renders it. `null` means it renders under every topology. */
  readonly deviceKind: McsDeviceKind | null
  /** The one variable this control changes. */
  readonly changes: string
  /** What moving it does not establish, stated wherever the control is highlighted. */
  readonly doesNotGuarantee: string
}

function control(entry: McsLearnControl): McsLearnControl {
  return entry
}

export const mcsLearnControls: Readonly<Record<McsLearnControlId, McsLearnControl>> = Object.freeze(
  {
    'control:inspect-arterial': control({
      id: 'control:inspect-arterial',
      label: 'Read the arterial pressure',
      location: 'guided-actions',
      actionId: 'inspect:arterial',
      deviceKind: null,
      changes:
        'Nothing in the patient. It reports the current mean and pulse pressure back to you in words.',
      doesNotGuarantee:
        'A mean pressure says nothing about how much blood is moving. Reading it is the first level of the model, and the answer stops there.',
    }),
    'control:inspect-preload': control({
      id: 'control:inspect-preload',
      label: 'Read the filling pressures and right-sided delivery',
      location: 'guided-actions',
      actionId: 'inspect:preload',
      deviceKind: null,
      changes:
        'Nothing in the patient. It reports right atrial pressure, wedge pressure, and the pulmonary pulsatility ratio back to you in words.',
      doesNotGuarantee:
        'Filling pressures describe the conditions a ventricle is working under, not the volume it is delivering.',
    }),
    'control:inspect-device': control({
      id: 'control:inspect-device',
      label: 'Read the device and effective flow',
      location: 'guided-actions',
      actionId: 'inspect:device',
      deviceKind: null,
      changes:
        'Nothing in the patient. It reports the displayed device contribution and the effective systemic delivery back to you as two separate lines.',
      doesNotGuarantee:
        'The displayed device number is flow along the device pathway. Whether it reaches the tissues is read at the bedside.',
    }),
    'control:select-iabp': control({
      id: 'control:select-iabp',
      label: 'Select IABP (counterpulsation)',
      location: 'guided-actions',
      actionId: 'device:select:iabp',
      deviceKind: null,
      changes:
        'The mechanism on display, and with it the pathway drawn in the anatomy pane. The patient returns to the shared baseline so the three mechanisms are compared at the same starting point.',
      doesNotGuarantee:
        'At the bedside the mechanism follows the limiting problem: name what is failing, then choose the pathway that supports it.',
    }),
    'control:select-impella': control({
      id: 'control:select-impella',
      label: 'Select Impella CP (LV-to-aorta microaxial pump)',
      location: 'guided-actions',
      actionId: 'device:select:impella',
      deviceKind: null,
      changes:
        'The mechanism on display, and with it the pathway drawn in the anatomy pane. The patient returns to the shared baseline so the three mechanisms are compared at the same starting point.',
      doesNotGuarantee:
        'At the bedside the mechanism follows the limiting problem: name what is failing, then choose the pathway that supports it.',
    }),
    'control:select-lvad': control({
      id: 'control:select-lvad',
      label: 'Select durable LVAD (generic continuous-flow pump)',
      location: 'guided-actions',
      actionId: 'device:select:lvad',
      deviceKind: null,
      changes:
        'The mechanism on display, and with it the pathway drawn in the anatomy pane. The patient returns to the shared baseline so the three mechanisms are compared at the same starting point.',
      doesNotGuarantee:
        'A durable pump is a different decision in kind, not a larger temporary one. Candidacy, implantation, and an agreed exit strategy are settled before support begins.',
    }),
    'control:iabp-inflation': control({
      id: 'control:iabp-inflation',
      label: 'Inflation vs notch',
      location: 'device-settings',
      actionId: 'iabp:set-inflation',
      deviceKind: 'iabp',
      changes:
        'Where inflation sits relative to aortic-valve closure, in milliseconds. Zero places it at the dicrotic notch.',
      doesNotGuarantee:
        'Correcting timing restores what this mechanism can offer. It does not create forward flow the native ventricle is not generating.',
    }),
    'control:iabp-trigger': control({
      id: 'control:iabp-trigger',
      label: 'Trigger source',
      location: 'device-settings',
      actionId: 'iabp:set-trigger',
      deviceKind: 'iabp',
      changes: 'Which signal the console uses to decide where each cardiac cycle begins.',
      doesNotGuarantee:
        'No trigger source is universally better. Choosing one only helps if the resulting inflation and deflation still land in the right place, beat by beat.',
    }),
    'control:impella-left-level': control({
      id: 'control:impella-left-level',
      label: 'Performance level',
      location: 'device-settings',
      actionId: 'impella:left:set-level',
      deviceKind: 'impella',
      changes: 'The selected performance level of the left-sided pump.',
      doesNotGuarantee:
        'The level is a setting, not a delivered flow. What the pump achieves depends on what fills the ventricle and on the pressure it has to eject against.',
    }),
    'control:impella-left-position': control({
      id: 'control:impella-left-position',
      label: 'Placement state',
      location: 'device-settings',
      actionId: 'impella:left:set-position',
      deviceKind: 'impella',
      changes:
        'Where the inlet and outlet sit relative to the aortic valve: aligned, too deep, or too shallow.',
      doesNotGuarantee:
        'At the bedside, confirm position with echo and the placement signal before you change the P-level.',
    }),
    'control:impella-right-enable': control({
      id: 'control:impella-right-enable',
      label: 'Right-sided support',
      location: 'device-settings',
      actionId: 'impella:enable-right',
      deviceKind: 'impella',
      changes:
        'Whether a right-sided pump is running from the inferior vena cava into the pulmonary artery.',
      doesNotGuarantee:
        'Adding right-sided delivery does not add a second systemic flow. Its blood still has to cross the lungs and be ejected or pumped out of the left heart.',
    }),
    'control:lvad-thrombosis': control({
      id: 'control:lvad-thrombosis',
      label: 'High-power / thrombosis pattern',
      location: 'device-settings',
      actionId: 'lvad:set-thrombosis',
      deviceKind: 'lvad',
      changes:
        'Whether the pump has thrombus on its rotor: the high-power pattern of suspected pump thrombosis.',
      doesNotGuarantee:
        'At the bedside the first moves are LDH and plasma free hemoglobin, a check of the anticoagulation, an echo, and a call to the LVAD team and surgeon.',
    }),
    'control:patient-rv-contractility': control({
      id: 'control:patient-rv-contractility',
      label: 'RV contractility',
      location: 'patient-conditions',
      actionId: 'patient:set-rv',
      deviceKind: null,
      changes:
        'How hard the right ventricle contracts, and so how much blood reaches the left heart through the lungs.',
      doesNotGuarantee:
        'A simulator control: it lets you watch the same well-timed support against two different right ventricles.',
    }),
    'control:patient-svr': control({
      id: 'control:patient-svr',
      label: 'SVR',
      location: 'patient-conditions',
      actionId: 'patient:set-svr',
      deviceKind: null,
      changes: 'Systemic vascular resistance, and so the pressure a pump ejects against.',
      doesNotGuarantee:
        'A simulator control: it lets you watch a fixed pump setting under two different afterloads. At the bedside you change afterload with a vasodilator or a vasopressor.',
    }),
    'control:team-escalate': control({
      id: 'control:team-escalate',
      label: 'Call the shock or LVAD team',
      location: 'guided-actions',
      actionId: 'team:escalate',
      deviceKind: null,
      changes: 'Records that you have called the team.',
      doesNotGuarantee:
        'The call is one step in the sequence. Start the first moves while you make it.',
    }),
  },
)

export function mcsLearnControl(id: McsLearnControlId): McsLearnControl {
  return mcsLearnControls[id]
}

function validateLearnControls(): readonly string[] {
  const errors: string[] = []
  const actionIds = new Set<string>()
  for (const [id, entry] of Object.entries(mcsLearnControls)) {
    if (entry.id !== id) errors.push(`control ${id} disagrees with its own id`)
    if (!entry.label.trim()) errors.push(`control ${id}: no label`)
    if (!entry.actionId.trim()) errors.push(`control ${id}: no simulator action id`)
    if (!entry.changes.trim()) errors.push(`control ${id}: does not say what it changes`)
    if (!entry.doesNotGuarantee.trim()) {
      errors.push(`control ${id}: does not say what moving it fails to establish`)
    }
    if (actionIds.has(entry.actionId) && !id.startsWith('control:select-')) {
      errors.push(`control ${id}: duplicate simulator action id ${entry.actionId}`)
    }
    actionIds.add(entry.actionId)
  }
  return errors
}

const learnControlErrors = validateLearnControls()
if (learnControlErrors.length > 0) {
  throw new Error(`Invalid MCS learn-control registry:\n- ${learnControlErrors.join('\n- ')}`)
}
