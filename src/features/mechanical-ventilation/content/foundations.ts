/** Explicit feature-local policy. Later Learn units and original Practice/Assess keep their contracts. */
export const foundationUnitIds = [
  'breathing-with-support',
  'waveform-anatomy',
  'controls-and-goals',
  'mechanics-load-and-pressure',
  'modes-and-breath-delivery',
] as const
export type FoundationUnitId = (typeof foundationUnitIds)[number]
export function isFoundationUnit(id: string): id is FoundationUnitId {
  return (foundationUnitIds as readonly string[]).includes(id)
}
export const FOUNDATION_EVIDENCE_VERSION = 2
/** Authored lesson content; source classes inherited from the existing unit evidence IDs.
 */
export const foundationTeaching: Record<
  FoundationUnitId,
  { title: string; purpose: string; explanation: string; worked: string; boundary?: string }
> = {
  'breathing-with-support': {
    title: 'Read one complete passive breath',
    purpose:
      'Identify inspiration and expiration, then relate flow direction to the change in volume.',
    explanation:
      'A trigger begins inspiration. In this passive teaching patient the ventilator starts the breath on its timer. Positive flow delivers gas and breath-relative volume rises. Cycling ends inspiration; during expiration, elastic recoil drives negative flow and volume falls.',
    worked:
      'Follow the highlighted interval across all three traces. Inspiration begins at the first marker; gas delivery continues until the cycling marker. Move the cursor into expiration to see outward flow and falling volume together.',
    boundary:
      'Volume is displayed relative to the breath’s starting reference, not total gas in the lungs. Returning to that reference does not prove complete emptying or exclude trapped gas.',
  },
  'waveform-anatomy': {
    title: 'Connect pressure, flow and volume',
    purpose: 'Read three signals at the same instant before changing inspiratory flow.',
    explanation:
      'Airway pressure is measured at the airway opening in cmH₂O. Flow is the rate of gas movement in L/min: positive into the patient, negative out. Volume in mL accumulates from flow. A constant positive flow therefore produces a rising, approximately straight volume segment.',
    worked:
      'At the cursor in the inspiratory interval, the flow segment is nearly level while volume accumulates. The later experiment changes flow while keeping selected tidal volume fixed; compare both the duration of inspiration and delivered volume.',
    boundary:
      'Real traces also show effort, leaks and uneven mechanics. A paused display is not an occlusion.',
  },
  'controls-and-goals': {
    title: 'Pair a selected setting with a measured result',
    purpose: 'Name the input you change and the separate measurement you check afterward.',
    explanation:
      'Ventilator settings are operator-selected inputs. Patient measurements describe the response. Similar numbers on the screen can have different roles: selecting a value does not prove that the patient received it.',
    worked:
      'Worked example: selecting an oxygen fraction changes the inspired gas mixture. SpO₂ is a separate patient response that evolves over time. Recheck it; do not read the selected oxygen percentage as the patient’s saturation. The map below applies that distinction to the current mode.',
  },
  'mechanics-load-and-pressure': {
    title: 'Compare pressure during flow and a passive hold',
    purpose:
      'Change one simulated patient property, acquire a fresh hold, and compare it with the reference.',
    explanation:
      'Respiratory-system compliance describes volume change per change in distending pressure. Airway resistance adds pressure while gas flows. Peak pressure includes the flowing pressure cost. During a passive inspiratory occlusion, a settled plateau estimates static end-inspiratory alveolar pressure; it is not a direct measurement in every alveolus.',
    worked:
      'The worked reference below includes an inspiratory hold the simulator actually performed. Flow stops while volume stays nearly constant and airway pressure settles below the flowing peak. Compare plateau with total end-expiratory pressure for elastic load, and peak with plateau for the flowing component under these passive, constant-flow assumptions.',
    boundary:
      'A hold taken while the patient is making an effort does not show passive mechanics. Repeat it once the patient is relaxed.',
  },
  'modes-and-breath-delivery': {
    title: 'Compare conventional volume and pressure control',
    purpose: 'Identify the selected input and the result that depends on mechanics.',
    explanation:
      'Conventional volume control (VC) selects tidal volume and flow; required pressure depends on the load. Conventional pressure control (PC) selects pressure above PEEP and inspiratory time; delivered volume depends on mechanics and time.',
    worked:
      'Use the idealized comparison to make the respiratory system more compliant, then restore its reference. Both columns use the same mechanics and clock. Their fixed inputs remain printed above the traces. Next, retrieve the stiffness experiment in live VC, explicitly switch to PC, and compare the different dependent variable.',
    boundary:
      'Effort, leaks and pressure limits change these relationships. Pressure support and volume-targeted modes behave differently again.',
  },
}
