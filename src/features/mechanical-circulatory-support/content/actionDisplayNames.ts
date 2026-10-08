/**
 * What an action is called on screen, beside the id the model stores for it (F33).
 *
 * The worked explanation listed the learner's own actions as `inspect:arterial` and
 * `iabp:set-deflation` — the reducer's ids, which are the stored contract and were never meant to be
 * read. This is the display name for each of them. The ids themselves are untouched: nothing is
 * renamed, nothing is migrated, and `state.actionIds`, every `requiredActionIds` list and every
 * saved value keep exactly the strings they had.
 *
 * A name says what was done, in the words on the control that did it. It does not say which way a
 * value was moved or whether moving it helped: the id does not carry that, so the name may not
 * claim it.
 */

const DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  'inspect:arterial': 'Read the arterial waveform',
  'inspect:preload': 'Read the filling pressures and right-ventricular readings',
  'inspect:device': 'Read the device display',
  'team:escalate': 'Escalated to the shock / mechanical-support team',

  'patient:adjust': 'Changed a simulated patient condition',
  'patient:set-preload': 'Changed simulated preload',
  'patient:set-svr': 'Changed simulated systemic vascular resistance (SVR)',
  'patient:set-rv': 'Changed simulated right-ventricular contractility',
  'patient:set-pvr': 'Changed simulated pulmonary vascular resistance (PVR)',
  'patient:set-rhythm': 'Changed the simulated rhythm',
  'patient:set-tamponade': 'Changed the simulated pericardial constraint',
  'patient:heartRateBpm': 'Changed the simulated heart rate',
  'patient:leftVentricularContractility': 'Changed simulated left-ventricular contractility',
  'patient:peepCmH2O': 'Changed simulated PEEP',
  'patient:aorticInsufficiencySeverity': 'Changed simulated aortic insufficiency',

  'device:select:iabp': 'Selected IABP (counterpulsation)',
  'device:select:impella': 'Selected Impella CP (LV-to-aorta microaxial pump)',
  'device:select:lvad': 'Selected durable LVAD (generic continuous-flow pump)',

  'iabp:set-ratio': 'Changed the IABP assist ratio',
  'iabp:set-trigger': 'Changed the IABP trigger source',
  'iabp:set-inflation': 'Changed IABP inflation timing',
  'iabp:set-deflation': 'Changed IABP deflation timing',
  'iabp:set-running': 'Switched IABP console support',

  'impella:set-left-variant': 'Changed the left-sided Impella configuration (CP or 5.5)',
  'impella:enable-left': 'Switched left-sided Impella support',
  'impella:enable-right': 'Switched right-sided (Impella RP) support',
  'impella:left:set-level': 'Changed the left-sided Impella performance level',
  'impella:left:set-position': 'Changed the simulated left-sided placement state',
  'impella:left:set-purge': 'Changed the simulated left-sided purge-system state',
  'impella:left:set-running': 'Switched the left-sided Impella pump',
  'impella:right:set-level': 'Changed the Impella RP performance level',
  'impella:right:set-position': 'Changed the simulated Impella RP placement state',
  'impella:right:set-purge': 'Changed the simulated Impella RP purge-system state',
  'impella:right:set-running': 'Switched the Impella RP pump',

  'lvad:authorize-speed': 'Recorded the authorized-personnel order for a speed change',
  'lvad:set-speed': 'Changed the durable LVAD pump speed',
  'lvad:set-power': 'Changed the simulated power path',
  'lvad:set-thrombosis': 'Switched the simulated high-power / thrombosis pattern',
  'lvad:set-controller': 'Switched the simulated controller fault',
  'lvad:set-running': 'Switched the durable LVAD pump',
})

/** Every action id this module has a display name for — the reducer's whole vocabulary. */
export const MCS_NAMED_ACTION_IDS: readonly string[] = Object.keys(DISPLAY_NAMES)

export function mcsHasActionDisplayName(actionId: string): boolean {
  return Object.prototype.hasOwnProperty.call(DISPLAY_NAMES, actionId)
}

/**
 * The learner-facing name for a stored action id.
 *
 * An id with no entry is shown as a plain sentence rather than as the raw id, so a control added
 * later cannot put a colon-separated identifier in front of a learner; `actionDisplayNames` tests
 * hold the registry to the reducer's vocabulary so that fallback is not relied on.
 */
export function mcsActionDisplayName(actionId: string): string {
  return mcsHasActionDisplayName(actionId) ? DISPLAY_NAMES[actionId] : 'Used a simulator control'
}

/**
 * The actions of a run, as the learner reads them.
 *
 * `patient:adjust` is the umbrella id the reducer records beside every specific patient change. It
 * is shown only when it stands alone — otherwise the same change would be listed twice.
 */
export function mcsActionDisplayList(
  actionIds: readonly string[],
): readonly { readonly id: string; readonly name: string }[] {
  const specificPatientChange = actionIds.some(
    (id) => id.startsWith('patient:') && id !== 'patient:adjust',
  )
  return actionIds
    .filter((id) => !(id === 'patient:adjust' && specificPatientChange))
    .map((id) => ({ id, name: mcsActionDisplayName(id) }))
}
