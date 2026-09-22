/**
 * Where a live case's authored text claims something the model does not do (MV-PRE-REVIEW-02).
 *
 * Batch 02 made each case open at its authored presentation and move only when something the model
 * represents changes. That removed the drift that had been standing in for several authored
 * responses: MV-14's saturation used to "recover" after decompression only because it rose
 * identically without it. Where the case still *says* a response happens that the model has no
 * dependency for, the case says so beside the claim, rather than a number silently contradicting it.
 * Each note names what is held and for whom; none is a clinical statement.
 *
 * Kept to claims the learner can actually read on the case page: the stem and the authored
 * expected response.
 */
import type { VentilationSimulationState } from '../engine/types'

/** Beside the case description, read against the live console. */
export function casePresentationModelNote(state: VentilationSimulationState): string | null {
  if (state.caseId === 'MV-13') {
    /*
     * C3. The stem says the patient "develops a sudden high-pressure alarm after a turn"; the case
     * is constructed with a 60 cmH₂O limit, and the peak the model produces for every branch sits
     * near 43, so the console never raises one. Lowering the limit to make it sound would sound it
     * over a breath the simulator delivers in full — it does not model what a ventilator does to a
     * breath at its pressure limit — so the limit is left alone and the mismatch is stated.
     */
    const limit = state.ventilator.settings.highPressureLimitCmH2O
    return `The alarm in this description is what prompted the call. The simulation opens after that event, with the high-pressure limit at ${limit.toFixed(0)} cmH₂O — above the peak this patient is now generating — so the console shows no active high-pressure alarm. The simulator does not model what a ventilator does to a breath that reaches its pressure limit, so whether this case should open with the alarm sounding is held for RT and device review.`
  }
  return null
}

/** Beside the authored expected response in the case explanation. */
export function caseResponseModelNote(caseId: string): string | null {
  switch (caseId) {
    case 'MV-06':
      return 'In this simulation, releasing trapped gas lowers the trapped pressure at once, but the blood pressure stays at the obstructive-shock ceiling until the case’s full treatment has taken effect; the prompt rise the case describes after disconnection is not represented and is held for faculty review.'
    case 'MV-12':
      return 'In this simulation the patient’s breathing drive does not respond to carbon dioxide. Lowering support reduces delivered ventilation and lets PaCO₂ rise; lightening sedation adds breaths, which moves it the other way. How the two should combine is held for faculty review.'
    case 'MV-14':
      return 'In this simulation the saturation is not linked to the pneumothorax: decompression restores compliance and blood pressure, but the saturation stays where it opened. How far oxygenation should recover, and how fast, is held for faculty review.'
    default:
      return null
  }
}
