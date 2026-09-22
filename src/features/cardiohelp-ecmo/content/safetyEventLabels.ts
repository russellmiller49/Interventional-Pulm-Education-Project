/**
 * Every safety-event identifier this engine can record, in the learner's words.
 *
 * Scenarios author their own `unsafeActionPenalties`, and those labels still win — a case may want
 * to describe the same act in its own terms. What this registry fixes is the gap underneath them:
 * a scenario that never listed an identifier the reducer can raise fell through to "A safety stop
 * was recorded for an action this case treats as unsafe", which names nothing at all. Both air
 * cases and every guided drill reached that sentence for a premature resumption, because
 * `premature-bubble-reset` appears in neither scenario list while `addCriticalError` raises it in
 * two branches.
 *
 * Keeping it beside the content rather than in the engine is deliberate: these are sentences a
 * learner reads, and `engine/` holds none of those. The completeness of the map against the
 * identifiers the reducer can actually raise is held by a test rather than by review.
 */
export const ecmoSafetyEventLabels: Readonly<Record<string, string>> = {
  'ack-without-correction':
    'Recorded a reassessment after silencing the alarm, with the cause still uncorrected',
  'air-correction-before-isolation':
    'Corrected or cleared circuit air before both near-patient clamps had isolated the patient',
  'capstone-flow-reduction':
    'Changed or stopped circuit blood flow during a protected assessment sequence',
  'global-override': 'Used Global Override as routine troubleshooting',
  'ineffective-treatment-delay': 'Repeated an ineffective treatment while the patient deteriorated',
  'premature-bubble-reset':
    'Tried to reset the bubble intervention or resume support before the air source was corrected and the circuit confirmed clear',
  'rpm-during-collapse': 'Increased pump speed during drainage collapse',
  'rpm-during-recirculation': 'Increased pump speed against established recirculation',
  'support-reduction-on-battery':
    'Reduced pump support on reserve power to stretch the battery time',
  'unsafe-clinical-shortcut': 'Used an unsafe shortcut before correcting the cause',
  'unsafe-unclamp-before-deair':
    'Opened a circuit clamp before the air source was corrected and cleared',
  'va-sweep-off': 'Turned sweep gas off while forward VA circuit blood flow continued',
}
