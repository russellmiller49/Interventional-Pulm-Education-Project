import type { McsSimulationState } from '../engine/types'

/**
 * The atrial-fibrillation trigger limitation, in one place, in the wording MCS-03 already wrote.
 *
 * MCS-03 found a disagreement it deliberately did not resolve (claim-review queue `MCS-03-05`,
 * `NOT REVIEWED`): in atrial fibrillation the model rates pressure triggering above ECG triggering
 * and clears its own trigger alarm on pressure, while the supplied Cardiosave material prefers ECG
 * for arrhythmias and advises against pressure triggering in a sustained irregular rhythm. The
 * model was held; the limitation was written into the transfer exercise label, the transfer
 * explanation, the two worked case explanations and a boundary beside the timing panel's synchrony
 * figure.
 *
 * What was missing was where the learner meets it. The boundary renders only inside the live
 * teaching panel, and the IABP timing section is an introductory lesson whose teaching column takes
 * the guided branch, so that panel is never mounted on the Learn route; the exercise label sits
 * below the transfer's answer choices, in a different pane from the control. A learner who simply
 * opens the trigger selector — on the transfer step, in IABP-02, in CAP-IABP-01 or in the studio —
 * could watch the modeled synchrony figure rise and the alarm clear on pressure triggering and read
 * that as the recommended response.
 *
 * These sentences are the ones already reviewed-as-drafted by MCS-03, not new clinical prose:
 * `modelRating`, `deviceLabeling` and `besideTheFigure` are the timing panel's boundary verbatim;
 * `heldLead` and `atTheControl` are the lead and closing sentence of the IABP-02 and CAP-IABP-01
 * worked explanations. Nothing here is a clinical recommendation and nothing here is approved.
 */
export const MCS_AF_TRIGGER_LIMIT = {
  /** Lead of the IABP-02 and CAP-IABP-01 worked explanations. */
  heldLead: 'Model limit held for faculty review',
  /** What the simulation does. */
  modelRating: 'In atrial fibrillation this model rates pressure triggering above ECG triggering.',
  /** What the checked Cardiosave documents say. */
  deviceLabeling:
    'The supplied Cardiosave material recommends ECG triggering for arrhythmias, warns against pressure triggering in a sustained irregular rhythm, and says not to keep internal triggering while the heart generates an output.',
  /** Closing sentence where the synchrony figure itself is on screen. */
  besideTheFigure:
    'Read the synchrony figure here as this model’s output, not as a guide to choosing a trigger.',
  /** Closing sentence where the trigger selector is on screen. */
  atTheControl:
    'Check a trigger choice against the console’s own instructions and the trace, not against the modeled synchrony figure.',
  /** The MCS-03 claim-review queue item this points at; its decision is still `NOT REVIEWED`. */
  queueItemId: 'MCS-03-05',
} as const

/**
 * Whether the limitation is the learner's to read right now.
 *
 * Read from the live model state, not from a lesson or case id, so the note follows the rhythm
 * wherever it is reached — the Learn transfer, either authored atrial-fibrillation case, or a
 * rhythm the learner sets themselves in the studio.
 */
export function mcsAfTriggerLimitApplies(state: McsSimulationState): boolean {
  return state.device.kind === 'iabp' && state.patient.rhythm === 'atrial-fibrillation'
}
