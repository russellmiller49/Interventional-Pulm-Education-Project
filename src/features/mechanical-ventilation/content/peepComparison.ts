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
    'In this patient, raising PEEP from 5 to between 8 and 12 recruits lung: compliance improves and shunt falls. At PEEP 14 and above the lung overdistends: compliance falls, and so does arterial pressure. At 45 seconds, PEEP 15 gives a higher airway pressure and a lower MAP than PEEP 10, though oxygenation is still better than at the starting PEEP.',
    'That is the trade to look for after any PEEP change. Oxygenation gained by recruitment comes with better compliance. The same oxygenation gained by overdistension costs compliance and blood pressure. The model steps between these states; a real lung moves between them gradually.',
    'This patient is making respiratory effort, so the plateau shown is estimated from the waveform and is not a hold. The compliance row is the value the model assigned. Intrinsic PEEP is reported separately.',
  ],
  boundary:
    'These values are simulated for this patient. At the bedside, find the best PEEP by stepping it and rechecking compliance, oxygenation and blood pressure at each step.',
} as const
