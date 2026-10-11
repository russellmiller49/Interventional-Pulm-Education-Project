/**
 * Where a live case's authored text claims something the model does not do (MV-PRE-REVIEW-02).
 *
 * Batch 02 made each case open at its authored presentation and move only when something the model
 * represents changes. That removed the drift that had been standing in for several authored
 * responses: MV-14's saturation used to "recover" after decompression only because it rose
 * identically without it. Where the case still *says* a response happens that the model has no
 * dependency for, the case says so where the claim is made, rather than a number silently
 * contradicting it. Each note names what is held and for whom; none is a clinical statement.
 *
 * Three places a learner meets such a claim, and each has its own statement here:
 *
 * - beside the case description (`casePresentationModelNote`), read against the live console;
 * - beside the authored expected response in the explanation (`caseResponseModelNote`);
 * - on the action path itself — the feedback printed the moment the action is taken
 *   (`interventionSimulatedResponse`, composed into the case's intervention in `runtimeCases`) and
 *   the coaching card written once its response has been observed (`faultOxygenationBoundary`).
 *   The first repair put the boundary only in the optional explanation, so MV-14's decompression
 *   still announced "Compliance, oxygenation, and blood pressure improve abruptly but temporarily"
 *   over a saturation that went from 76 to 76 and an improvement the model never lets fade.
 */
import type { VentilationCaseDefinition, VentilationSimulationState } from '../engine/types'

function cmH2O(value: number, digits = 0): string {
  return `${value.toFixed(digits)} cmH₂O`
}

/**
 * MV-13's alarm, stated against the console as it is now (C3, owner decision D4).
 *
 * The stem says the patient "develops a sudden high-pressure alarm after a turn"; the case is
 * constructed with a 60 cmH₂O limit, and the peak the model produces for every branch sits near 43,
 * so the case opens without one. Lowering the default to make it sound would sound it over a breath
 * the simulator delivers in full — it does not model what a ventilator does to a breath at its
 * pressure limit — so the limit is left alone and the mismatch is stated.
 *
 * The first version interpolated the *current* limit into a sentence that always went on to say the
 * limit was above the peak and no alarm was active. A learner who set the limit to 40 then read
 * "the high-pressure limit at 40 cmH₂O — above the peak this patient is now generating — so the
 * console shows no active high-pressure alarm" directly beside a console sounding "High pressure".
 * Now the note has two parts that cannot be confused: what the case opened with (fixed, and said to
 * be the opening), and what the console is doing now, read from the same limit, peak and alarm list
 * the console itself shows. Alarms are re-evaluated only when the simulation runs, so a limit
 * changed while paused is described as what the console will do next, never as what it is doing.
 */
function mv13AlarmNote(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): string {
  const openingLimit = definition.initialSettings.highPressureLimitCmH2O
  const limit = state.ventilator.settings.highPressureLimitCmH2O
  const peak = state.measurements.peakPressureCmH2O
  const showing = (code: string) =>
    state.alarms.some((alarm) => alarm.code === code && alarm.active)
  const reached = peak >= limit
  const entry = `The alarm in this description is what prompted the call. The simulation opens after that event, with the high-pressure limit at ${cmH2O(openingLimit)} — above the peak this patient generates — so the case opens without an active high-pressure alarm.`
  let now: string
  if (showing('HIGH_PRESSURE')) {
    now = reached
      ? `Now the limit is ${cmH2O(limit)} and the peak, ${cmH2O(peak, 1)}, has reached it, so the console’s high-pressure alarm is active.`
      : `The console’s high-pressure alarm is still showing from the last breath the simulation evaluated; with the limit now at ${cmH2O(limit)}, above the peak of ${cmH2O(peak, 1)}, it clears when the simulation next runs.`
  } else if (reached) {
    now = `The limit is now ${cmH2O(limit)}, at or below the peak of ${cmH2O(peak, 1)}, so the console raises its high-pressure alarm when the simulation next runs.`
  } else if (limit !== openingLimit || showing('PRESSURE_LIMITATION')) {
    now = `Now the limit is ${cmH2O(limit)}, still above the peak of ${cmH2O(peak, 1)}, so no high-pressure alarm is active${
      showing('PRESSURE_LIMITATION')
        ? '; the peak is close enough to it that the console shows its pressure-limitation alert'
        : ''
    }.`
  } else {
    now = ''
  }
  return [entry, now].filter(Boolean).join(' ')
}

/** Beside the case description, read against the live console. */
export function casePresentationModelNote(
  state: VentilationSimulationState,
  definition: VentilationCaseDefinition,
): string | null {
  if (state.caseId === 'MV-13') return mv13AlarmNote(state, definition)
  return null
}

/** Beside the authored expected response in the case explanation. */
export function caseResponseModelNote(caseId: string): string | null {
  switch (caseId) {
    case 'MV-06':
      return 'In this simulation, releasing trapped gas lowers the trapped pressure at once, but the blood pressure recovers only after the full treatment has taken effect. At the bedside, expect the blood pressure to rise within seconds of disconnection.'
    case 'MV-12':
      return 'In this simulation the patient’s breathing drive does not respond to carbon dioxide. Lowering support reduces delivered ventilation and lets PaCO₂ rise; lightening sedation adds breaths, which moves it the other way.'
    default:
      return null
  }
}
