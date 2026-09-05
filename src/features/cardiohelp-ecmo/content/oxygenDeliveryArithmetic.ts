/**
 * The oxygen-delivery arithmetic, in one place.
 *
 * The same two equations were written three times in this module — once in the engine's oxygen
 * balance, once in the first foundation panel, and once in the explorer that panel now hosts — each
 * with its own literal for the oxygen carried per gram of hemoglobin. A physiology audit in
 * September 2026 found the obvious hazard: an edit to any one of them reached none of the others,
 * and the module could have shown a learner a content figure its own engine disagreed with.
 *
 * So the constant and both equations live here, and the engine and the panels import them. This
 * module deliberately imports nothing, so anything in the feature may depend on it.
 *
 * Both constants below are model constants rather than sourced values. No record in this module's
 * evidence registry states an oxygen-content equation or the delivery product, and published values
 * for the binding capacity differ slightly, so every surface that prints one labels it as a model
 * constant — the same classification the sibling hemodynamics module already applies to the
 * identical figure.
 */

/** mL of oxygen carried per gram of fully saturated hemoglobin. A model constant. */
export const OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN = 1.34

/**
 * The learner-facing qualifier for that constant, worded once.
 *
 * Matched to `hemoglobin-oxygen-binding-capacity` in the hemodynamics module's acquisition-parameter
 * registry, so the two modules do not describe the same constant two different ways.
 */
export const OXYGEN_BINDING_CONSTANT_QUALIFIER =
  'A model constant. Published values differ slightly, and the difference between them is far smaller than the effects this section is about.'

export interface EcmoOxygenDeliveryInputs {
  /** g/dL. */
  readonly hemoglobin: number
  /** Percent, as a number between 0 and 100. */
  readonly saturation: number
  /** L/min of blood carrying that content. */
  readonly flowLpm: number
}

export interface EcmoOxygenDeliveryFigures {
  /** mL of oxygen per decilitre of arterial blood — the hemoglobin-bound term alone. */
  readonly content: number
  /** mL of oxygen carried past a point each minute. */
  readonly delivery: number
}

/**
 * Content and delivery for a set of inputs.
 *
 * The dissolved term is deliberately absent: the engine's own oxygen balance omits it, and a panel
 * that added it would stop reproducing the engine's arithmetic. Every surface that shows these
 * figures says so.
 */
export function ecmoOxygenDeliveryFigures(
  inputs: EcmoOxygenDeliveryInputs,
): EcmoOxygenDeliveryFigures {
  const content = OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN * inputs.hemoglobin * (inputs.saturation / 100)
  // Content is per decilitre and flow is per litre, so the ten converts between them.
  const delivery = content * inputs.flowLpm * 10
  return { content, delivery }
}

/**
 * What the delivery figures are cited to, and the claim taken from each.
 *
 * Deliberately narrower than the section's own source list. A physiology audit in September 2026
 * found the explorer inheriting all of the section's sources, two of which support nothing about
 * oxygen delivery: an id that resolves is not an id that supports the claim it is attached to. These
 * three are what the arithmetic on this surface actually rests on.
 */
export const OXYGEN_DELIVERY_ARITHMETIC_SOURCE_IDS: readonly string[] = Object.freeze([
  'ecmo-book-ch16',
  'ecmo-book-ch17',
  'bounded-educational-model',
])

export const OXYGEN_DELIVERY_ARITHMETIC_CLAIMS: Readonly<Record<string, string>> = Object.freeze({
  'ecmo-book-ch16':
    'Support is chosen by naming the step that has failed, which is what separating these components is for.',
  'ecmo-book-ch17':
    'Blood flow is a dose that is titrated, within preload and recirculation limits.',
  'bounded-educational-model':
    'The bounded oxygen content and delivery arithmetic these two figures are computed with.',
})
