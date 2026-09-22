import type { McsDeviceState, McsPatientState, McsSimulationState } from '../engine/types'

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
  return mcsAfTriggerLimitAppliesTo(state.patient, state.device)
}

/**
 * The same predicate for callers that hold a patient and a device but not a whole state — the
 * engine's causal sentence is built inside the step, before a state object exists.
 */
export function mcsAfTriggerLimitAppliesTo(
  patient: Pick<McsPatientState, 'rhythm'>,
  device: Pick<McsDeviceState, 'kind'>,
): boolean {
  return device.kind === 'iabp' && patient.rhythm === 'atrial-fibrillation'
}

/**
 * What the two atrial-fibrillation activities may no longer say.
 *
 * MCS-PRE-REVIEW-01 found that the hold MCS-03 wrote was still only a caveat: in atrial
 * fibrillation the modeled synchrony figure reaches IABP-02's condition (≥60) and CAP-IABP-01's
 * (≥65) on pressure triggering and on nothing else, so the only route to either case's stated
 * signal was the trigger the supplied Cardiosave material advises against. Those two conditions are
 * now quarantined — kept in the record, excluded from scoring, and never shown as a result — and
 * these are the words that say so.
 */
export const MCS_AF_TRIGGER_CONTAINMENT = {
  /** Why the two conditions are not treated as outcomes. */
  conditionHoldReason:
    'In atrial fibrillation this condition is reached on pressure triggering and on no other trigger source, so treating it as an outcome would endorse the trigger the supplied Cardiosave material advises against',
  /** The open item the hold belongs to. */
  openItemId: 'MCS-03-05',
  /** Lead for the worked comparison that replaced the graded decision. */
  comparisonLead: 'What this model rates each trigger source, side by side',
  /** What the comparison is, and is not. */
  comparisonScope:
    'The three figures below are this model’s own trigger rating at the settings and simulated time on screen, run on separate copies of this circulation. They are not console readings, and the model represents neither R-wave quality nor a console’s own arrhythmia handling.',
  /** Said wherever the model's alarms happen to be quiet while the limit applies. */
  notAnAllClear: 'Model limit held · a quiet trigger alarm here is not a correctly operated device',
} as const
