/** Interpretation of the current MV-01 model, audited in MV-02; not clinical approval. */
export const peepComparisonTeaching = {
  purpose: 'Compare oxygenation, pressure and circulation after changing only PEEP.',
  explanation: [
    'Compare the changed-PEEP result with PEEP held at 5 at the same time. Oxygenation also rises while waiting at the original settings, so a before-and-after saturation alone overstates the effect of PEEP.',
    'In this authored case, PEEP 8–12 selects a more compliant, lower-shunt model state. PEEP 14 and above selects a less compliant state and lowers modeled arterial pressure. At 45 seconds, PEEP 15 produces higher pressure and lower MAP than PEEP 10, despite oxygenation remaining above the unchanged-PEEP result.',
    'These discrete states illustrate the intended recruitment–overdistension tradeoff. They do not measure recruited lung, locate an individual patient’s best PEEP, or establish a smooth clinical response curve. At PEEP 13, compliance and shunt use the case’s initial assigned values; interpolation between the ranges is not represented.',
    'The patient continues to make respiratory effort. The displayed plateau is a waveform estimate unless an occlusion is actually performed, and it is unsuitable for passive mechanics interpretation here. The compliance row is the model’s assigned compliance, not tidal volume divided by a measured driving pressure. Intrinsic PEEP is reported separately and is not an acquired expiratory hold.',
  ],
  boundary:
    'Authored simulation values, not clinical targets. The step boundaries and quantitative responses remain subject to ventilation faculty/RT review. A completed hold can still be unsuitable for passive interpretation; reading this example performs no hold on your separate patient.',
} as const
