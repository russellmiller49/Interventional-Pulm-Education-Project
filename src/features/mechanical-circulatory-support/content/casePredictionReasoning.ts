import { mcsCapstoneScenarios, mcsPracticeScenarios } from './scenarios'

/**
 * Why each case prediction option does or does not fit the state the case is built in (F32).
 *
 * After a learner compared a prediction, a case showed its one-line hint and the keyed label, and
 * nothing about the option they had actually chosen — so a fellow could not tell whether an answer
 * had been taken, or why it was or was not the fit. Each option now carries its own reasoning.
 *
 * The reasoning is deliberately about the modeled state: what this case sets, what its alarms
 * read, what is and is not off its reference. That is checkable against `scenarios.ts`, and the
 * tests beside this file check it. It is not a clinical rule about real patients, it changes no key
 * and no option id, and nothing here is counted: there is no total and no history, and the
 * reasoning is available without answering at all.
 *
 * DRAFT, NOT REVIEWED — the thirty-six sentences are listed for owner review in the
 * MCS-PRE-REVIEW-04 owner packet (OD-07).
 */

export const MCS_CASE_PREDICTION_REASONING: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = Object.freeze({
  'IABP-01': {
    'late-deflation':
      'This case combines later deflation with weaker left-ventricular contractility than the reference patient. The model’s late-deflation alarm is active; this is not an isolated timing comparison. The balloon is still inflated when the next ejection begins, so the ventricle ejects against it.',
    underfilled:
      'Nothing about filling was changed in this case: preload is the reference patient’s and the wedge pressure reads elevated, not low. The timing alarm concerns assisted-beat deflation; the case also changes LV contractility.',
    'low-svr':
      'Systemic vascular resistance is at the reference value in this case. The late-deflation alarm points to deflation timing; check it on the trace at 1:2.',
  },
  'IABP-02': {
    trigger:
      'The case is built in atrial fibrillation, with the model’s trigger-reliability alarm active and inconsistent assisted beats. Which signal the balloon is triggering from, and whether each beat is recognized, is what the trace can confirm first. In atrial fibrillation this model rates pressure triggering above ECG triggering, which the supplied Cardiosave material advises against.',
    'more-volume':
      'Preload is the reference patient’s in this case and the wedge pressure reads elevated. A high wedge pressure argues against a volume deficit.',
    'inflate-early':
      'Inflation is at its reference in this case. Moving it ahead of valve closure is the early-inflation relationship Section 3 demonstrates: the balloon would inflate while ejection is still under way.',
  },
  'IABP-03': {
    'support-ceiling':
      'Timing reads fully aligned here while native flow is very low, and the model’s limited-native-output alarm is active. The case is built with both ventricles weakened, and a balloon has no flow stream of its own, so its effect is bounded by the beat the patient still generates.',
    'late-inflation':
      'Inflation and deflation are both at their references in this case and the model reads the timing as aligned. A timing fault is not what is on the screen.',
    'excess-flow':
      'An IABP has no pump-flow stream: the device flow line reads none reported. It cannot deliver a continuous flow, excessive or otherwise.',
  },
  'IMP-01': {
    'rv-preload':
      'The case is built with low preload, a weakened right ventricle and a high pulmonary vascular resistance, at a high performance level. Right atrial pressure reads above the wedge pressure and the suction alarm is active: the pump is short of filling at its inlet, not short of setting.',
    'raise-level':
      'The pump is already at a high performance level with the suction alarm active. Raising the level into suction gains little flow and leaves the alarm in place.',
    vasoplegia:
      'Systemic vascular resistance is at the reference value in this case. The suction alarm and the filling pressures put the limit at the inlet rather than at the outlet.',
  },
  'IMP-02': {
    malposition:
      'The case is built with the left pump’s placement state set to too deep and nothing changed in the patient. The model’s position alarm is active and the displayed flow is below what this level gives when the pump is aligned.',
    'low-level':
      'Nothing about the level is the limit here: it has not been lowered, and the flow is low because of where the inlet sits. The hemolysis-risk pattern is also active, and a higher level does not correct a position.',
    normal:
      'A position alarm and a hemolysis-risk pattern are both active. That is not expected at this level: check position.',
  },
  'IMP-03': {
    'afterload-purge':
      'Two things are set in this case: a high systemic vascular resistance, giving a high mean pressure at the pump’s outlet, and a purge-system state of high pressure with its own alarm. The model lowers pump flow against the higher outlet pressure; the purge warning is a separate observation with its own evaluation.',
    'suction-only':
      'No suction alarm is active, and neither preload nor the wedge pressure is low in this case. Suction is a filling problem at the inlet; this state is built at the outlet.',
    normal:
      'A purge-pressure alarm is active and estimated flow is low for the P-level in use. Neither is expected: work through purge system, position and filling.',
  },
  'LVAD-01': {
    hypertension:
      'The case is built with a high systemic vascular resistance and preserved filling, and mean pressure reads very high at an unchanged speed. A continuous-flow pump moves less blood against a higher outlet pressure.',
    hypovolemia:
      'Preload is above the reference value in this case and the filling pressures are not low. The low flow here does not come from an empty ventricle.',
    power:
      'The power path reads connected and the pump is running: the displayed flow is reduced, not zero. A lost power path takes pump flow to zero with its own critical alarm.',
  },
  'LVAD-02': {
    'rv-failure':
      'The case is built with a weakened right ventricle and a high pulmonary vascular resistance. Right atrial pressure reads high, the pulmonary pulsatility ratio is low, and pump flow is low at an unchanged speed: the left-sided pump is short of blood delivered through the lung.',
    afterload:
      'Systemic vascular resistance is at the reference value and mean pressure is not high in this case. The limit is upstream of the pump rather than at its outlet.',
    thrombosis:
      'The high-power pattern is not switched on in this case, and pump power has not risen.',
  },
  'LVAD-03': {
    'restore-power':
      'The case is built with the power path disconnected: the external-power alarm is active and pump flow is zero. Nothing else restores flow. Reconnect power at once (a charged battery or the power module), check the driveline connection, and call the LVAD team while you do it.',
    'speed-up':
      'Speed changes are locked without an authorized-personnel order, and a pump with no power does not answer a speed setting: flow is zero because power is absent.',
    observe:
      'The model does not restore power or flow by itself. Loss of continuous-flow support is treated as time-critical in this case.',
  },
  'CAP-IABP-01': {
    'trigger-plus-timing':
      'Three settings are off their references in this case: the trigger source is internal in a patient with a rhythm of their own, inflation is late and deflation is early. The alarms for all three are active.',
    'late-deflation':
      'Deflation is set early in this case, not late, and it is not the only setting off its reference.',
    'volume-only':
      'Preload is at the reference value in this case. The assisted beats differ from the unassisted ones because of the trigger and timing settings.',
  },
  'CAP-IMP-01': {
    'position-afterload-recirculation':
      'Three things are set in this case: the placement state is too shallow, systemic vascular resistance is high, and aortic insufficiency is present. The model’s position alarm is active, and regurgitant recirculation is counted out of effective systemic flow, which is why the displayed and effective lines separate.',
    suction:
      'No suction alarm is active in this case; preload is above the reference value and the wedge pressure reads high.',
    purge:
      'The purge-system state is normal in this case. Purge pressure describes the pump’s own purge system, not the systemic flow.',
  },
  'CAP-LVAD-01': {
    'constrained-filling':
      'The case is built with tamponade. Both filling pressures read high and close together, pump flow is low at unchanged speed, and the power path is connected. Pump power and the pulsatility index are low; the high-power pattern is absent.',
    hypertension:
      'Systemic vascular resistance is at the reference value in this case and the mean pressure is not high.',
    thrombosis:
      'The high-power pattern is not switched on in this case and pump power has not risen.',
  },
})

/** The reasoning for one option of one case; undefined when the case or option is unknown. */
export function mcsCasePredictionReasoning(caseId: string, optionId: string): string | undefined {
  return MCS_CASE_PREDICTION_REASONING[caseId]?.[optionId]
}

/** The heading said over an option's reasoning. It names a fit to the model, not a verdict on a learner. */
export function mcsCaseReasoningHeading(fits: boolean): string {
  return fits ? 'Why this fits this patient' : 'Why this does not fit this patient'
}

function validateCaseReasoning(): readonly string[] {
  const errors: string[] = []
  const scenarios = [...mcsPracticeScenarios, ...mcsCapstoneScenarios]
  for (const scenario of scenarios) {
    const reasoning = MCS_CASE_PREDICTION_REASONING[scenario.id]
    if (!reasoning) {
      errors.push(`${scenario.id}: no option reasoning`)
      continue
    }
    for (const option of scenario.predictionOptions) {
      if (!reasoning[option.id]?.trim())
        errors.push(`${scenario.id}: no reasoning for option ${option.id}`)
    }
    for (const optionId of Object.keys(reasoning)) {
      if (!scenario.predictionOptions.some((option) => option.id === optionId))
        errors.push(`${scenario.id}: reasoning for an option the case does not have: ${optionId}`)
    }
  }
  for (const caseId of Object.keys(MCS_CASE_PREDICTION_REASONING)) {
    if (!scenarios.some((scenario) => scenario.id === caseId))
      errors.push(`reasoning for a case that does not exist: ${caseId}`)
  }
  return errors
}

const caseReasoningErrors = validateCaseReasoning()
if (caseReasoningErrors.length > 0) {
  throw new Error(`Invalid MCS case prediction reasoning:\n- ${caseReasoningErrors.join('\n- ')}`)
}
