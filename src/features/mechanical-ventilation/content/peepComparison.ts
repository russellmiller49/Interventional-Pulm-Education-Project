import type { PeepComparison } from '../engine/peepComparison'

/**
 * What the wait-only arm shows, read off the arms that were actually run.
 *
 * This used to be a fixed sentence — "Oxygenation also rises while waiting at the original
 * settings" — which was true only because the model's oxygenation target ignored the case's own
 * presenting PaO₂ and pulled every untreated patient toward it (MV-PRE-REVIEW-02, C1). The live
 * oxygenation panel meanwhile read the same patient as "holding steady" over a different window.
 * The sentence now reports what the control arm did over the interval both arms ran, so it cannot
 * disagree with the table beside it.
 */
export function peepComparisonTimeControl(result: PeepComparison | null): string {
  if (!result) {
    return 'The wait-only arm is the control: PEEP stays at 5 for the same interval, so anything that changes there changed without the PEEP change. Run the comparison to see whether this patient changes while waiting.'
  }
  const before = result.baseline.patient.gasExchange.spo2Percent
  const waited = result.unchanged.patient.gasExchange.spo2Percent
  const window = `from ${result.baseline.simulationTime.toFixed(0)} to ${result.unchanged.simulationTime.toFixed(0)} s`
  if (Math.abs(waited - before) < 0.5) {
    return `At PEEP 5, saturation stays at ${waited.toFixed(1)} % over the same interval (${window}). In this model the wait-only arm does not drift, so the difference between the two arms at the same time is the PEEP change.`
  }
  return `Saturation also moves at PEEP 5 over the same interval (${before.toFixed(1)} → ${waited.toFixed(1)} %, ${window}), so a before-and-after reading mixes waiting with the PEEP effect. Compare the two arms at the same time.`
}

/** Interpretation of the current MV-01 model, audited in MV-02; not clinical approval. */
export const peepComparisonTeaching = {
  purpose: 'Compare oxygenation, pressure and circulation after changing only PEEP.',
  explanation: [
    'In this authored case, PEEP 8–12 selects a more compliant, lower-shunt model state. PEEP 14 and above selects a less compliant state and lowers modeled arterial pressure. At 45 seconds, PEEP 15 produces higher pressure and lower MAP than PEEP 10, despite oxygenation remaining above the unchanged-PEEP result.',
    'These discrete states illustrate the intended recruitment–overdistension tradeoff. They do not measure recruited lung, locate an individual patient’s best PEEP, or establish a smooth clinical response curve. The case authors no response at PEEP 13: the model holds the 8–12 state there — no further recruitment and no overdistension — rather than falling back to the PEEP-5 state, and it does not interpolate. That choice is itself under faculty review.',
    'The patient continues to make respiratory effort. The displayed plateau is a waveform estimate unless an occlusion is actually performed, and it is unsuitable for passive mechanics interpretation here. The compliance row is the model’s assigned compliance, not tidal volume divided by a measured driving pressure. Intrinsic PEEP is reported separately and is not an acquired expiratory hold.',
  ],
  boundary:
    'Authored simulation values, not clinical targets. The step boundaries and quantitative responses remain subject to ventilation faculty/RT review. A completed hold can still be unsuitable for passive interpretation; reading this example performs no hold on your separate patient.',
} as const
