/**
 * The Fick calculation, with every input traced back to how it was obtained.
 *
 * Before H4 the module's Fick content was three bullet points. It could not be wrong, which meant a
 * learner could not find out what makes it wrong. This produces the whole chain instead: each input
 * with its provenance, both oxygen contents, their difference, the units carried through the
 * division, the flow, and — where the inputs do not support a flow at all — an explicit withholding
 * with its reasons.
 *
 * Two decisions are deliberate and are the point of the file.
 *
 * The first is that a specimen drawn upstream of where venous return has mixed does not produce a
 * "close enough" answer here. It withholds. This module's registry carries no claim about
 * substituting one for the other in this context, so the safe behavior is to refuse rather than to
 * hedge.
 *
 * The second is that the result carries `vo2Provenance` as data, not as prose. `fickCardiacOutput`
 * cannot produce a result labeled "direct" from an assumed oxygen uptake, because the label is read
 * off the method record, which is validated at import.
 */

import {
  cardiacOutputInputStatusLabels,
  requireCardiacOutputMethod,
  type CardiacOutputInputStatus,
  type CardiacOutputMethodId,
  type CardiacOutputVo2Provenance,
} from '../content/cardiacOutputMethods'
import { requireCardiacOutputParameter } from '../content/cardiacOutputSourceBoundaries'
import { roundTo } from './calculations'

/**
 * The constants an oxygen content cannot be computed without.
 *
 * Both are classified in `cardiacOutputAcquisitionParameters` as simulation parameters rather than
 * source-supported values, and both carry that label onto every surface that shows them. Reading
 * them back out of that registry here keeps one definition rather than two.
 */
export const CARDIAC_OUTPUT_MODEL_CONSTANTS = Object.freeze({
  hemoglobinOxygenBindingCapacityMlPerG: 1.34,
  dissolvedOxygenMlPerDlPerMmHg: 0.003,
  decilitersPerLiter: 10,
})

export const HEMOGLOBIN_BINDING_CONSTANT_QUALIFIER = requireCardiacOutputParameter(
  'hemoglobin-oxygen-binding-capacity',
).learnerFacingQualifier

export const DISSOLVED_OXYGEN_CONSTANT_QUALIFIER = requireCardiacOutputParameter(
  'dissolved-oxygen-coefficient',
).learnerFacingQualifier

export type FickVenousSampleSite =
  | 'pulmonary-artery'
  | 'right-atrium'
  | 'superior-vena-cava'
  | 'unrecorded'

export const fickVenousSampleSiteLabels: Readonly<
  Record<FickVenousSampleSite, { readonly label: string; readonly isTrueMixedVenous: boolean }>
> = Object.freeze({
  'pulmonary-artery': { label: 'Pulmonary artery', isTrueMixedVenous: true },
  'right-atrium': { label: 'Right atrium', isTrueMixedVenous: false },
  'superior-vena-cava': { label: 'Superior vena cava', isTrueMixedVenous: false },
  unrecorded: { label: 'Not recorded', isTrueMixedVenous: false },
})

/**
 * What a venous specimen is called, by where it was drawn (HD-PRE-REVIEW-02, report L7-06).
 *
 * The rows used to read "Mixed-venous oxygen saturation" whatever the site, so a superior vena cava
 * specimen was labelled as the very thing the result was being withheld for not being.
 */
export function fickVenousSpecimenWords(site: FickVenousSampleSite): {
  readonly saturation: string
  readonly content: string
  readonly short: string
} {
  switch (site) {
    case 'pulmonary-artery':
      return {
        saturation: 'Mixed-venous oxygen saturation',
        content: 'Mixed-venous oxygen content',
        short: 'mixed-venous',
      }
    case 'superior-vena-cava':
      return {
        saturation: 'Central venous oxygen saturation (superior vena cava specimen)',
        content: 'Central venous oxygen content (superior vena cava specimen)',
        short: 'central venous (superior vena cava)',
      }
    case 'right-atrium':
      return {
        saturation: 'Venous oxygen saturation (right-atrial specimen)',
        content: 'Venous oxygen content (right-atrial specimen)',
        short: 'right-atrial venous',
      }
    default:
      return {
        saturation: 'Venous oxygen saturation (sampling site not recorded)',
        content: 'Venous oxygen content (sampling site not recorded)',
        short: 'venous',
      }
  }
}

/**
 * Why a Fick result was withheld, as data, so a surface or a suite can tell a missing input from
 * inputs that contradict each other without parsing prose.
 */
export type FickWithheldReasonKind =
  | 'missing-input'
  | 'contradictory-inputs'
  | 'not-mixed-venous'
  | 'not-steady'
  | 'not-paired-in-time'
  | 'intracardiac-shunt'

export interface FickInputSet {
  readonly methodId: Extract<CardiacOutputMethodId, 'fick-direct' | 'fick-assumed-vo2'>
  readonly vo2MlMin: number | null
  readonly hemoglobinGDl: number | null
  readonly arterialSaturationFraction: number | null
  readonly mixedVenousSaturationFraction: number | null
  readonly venousSampleSite: FickVenousSampleSite
  /** Partial pressures are optional; the dissolved term is only added when both are present. */
  readonly arterialPo2MmHg: number | null
  readonly venousPo2MmHg: number | null
  readonly includeDissolvedOxygen: boolean
  readonly steadyState: boolean
  /** Whether the specimens and the oxygen-uptake figure describe one measurement episode. */
  readonly samplesPairedInTime: boolean
  /**
   * Any intracardiac shunt withholds this calculation outright.
   *
   * There used to be a companion `shuntSamplingAddressed` flag, and setting it produced an ordinary
   * result. Nothing in this input set could support that: it carries one arterial content and one
   * pulmonary-artery mixed-venous content, which is a single systemic difference. Describing
   * pulmonary and systemic flow separately needs compartmental oximetry and a Qp/Qs account that
   * this model does not have, so a boolean could only ever have waved the problem through.
   */
  readonly intracardiacShuntPresent: boolean
}

export interface FickTraceRow {
  readonly id: string
  readonly label: string
  readonly status: CardiacOutputInputStatus
  readonly statusLabel: string
  readonly value: number | null
  readonly unit: string | null
  /** Exactly what the surface prints, so a figure and its text equivalent cannot diverge. */
  readonly display: string
}

export interface FickResult {
  readonly methodId: FickInputSet['methodId']
  readonly methodName: string
  readonly vo2Provenance: CardiacOutputVo2Provenance
  readonly status: 'calculated' | 'withheld'
  readonly cardiacOutputLMin: number | null
  readonly arterialOxygenContentMlDl: number | null
  readonly mixedVenousOxygenContentMlDl: number | null
  readonly contentDifferenceMlDl: number | null
  readonly trace: readonly FickTraceRow[]
  /** The units, carried step by step through the division. */
  readonly unitAccount: readonly string[]
  readonly withheldReasons: readonly string[]
  /** One kind per entry of `withheldReasons`, in the same order. */
  readonly withheldReasonKinds: readonly FickWithheldReasonKind[]
  /** The unrounded difference and flow, so a displayed rounding step can be explained. */
  readonly contentDifferenceUnroundedMlDl: number | null
  readonly cardiacOutputUnroundedLMin: number | null
  readonly caveats: readonly string[]
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function saturationIsPlausible(value: unknown): value is number {
  return finite(value) && value > 0 && value <= 1
}

function formatFraction(value: number): string {
  return `${roundTo(value * 100, 0)} of every 100 hemoglobin binding sites`
}

/**
 * Oxygen carried per deciliter of blood.
 *
 * The dissolved term is included only when the caller asks for it *and* a partial pressure is
 * available, so a scenario cannot end up with the term on one side of the subtraction and not the
 * other — a small, entirely artificial change to the denominator.
 */
export function oxygenContentMlDl(input: {
  readonly hemoglobinGDl: number
  readonly saturationFraction: number
  readonly po2MmHg?: number | null
  readonly includeDissolvedOxygen?: boolean
}): number {
  const bound =
    CARDIAC_OUTPUT_MODEL_CONSTANTS.hemoglobinOxygenBindingCapacityMlPerG *
    input.hemoglobinGDl *
    input.saturationFraction
  const dissolved =
    input.includeDissolvedOxygen && finite(input.po2MmHg)
      ? CARDIAC_OUTPUT_MODEL_CONSTANTS.dissolvedOxygenMlPerDlPerMmHg * input.po2MmHg
      : 0
  return bound + dissolved
}

function traceRow(
  id: string,
  label: string,
  status: CardiacOutputInputStatus,
  value: number | null,
  unit: string | null,
  display: string,
): FickTraceRow {
  return {
    id,
    label,
    status,
    statusLabel: cardiacOutputInputStatusLabels[status].label,
    value,
    unit,
    display,
  }
}

/**
 * The full Fick account for one input set.
 *
 * Withholding reasons are collected rather than short-circuited: a learner who has three problems
 * should see three problems, not the first one the code happened to reach.
 */
export function fickCardiacOutput(inputs: FickInputSet): FickResult {
  const method = requireCardiacOutputMethod(inputs.methodId)
  const vo2Provenance = method.vo2Provenance
  if (vo2Provenance === null) {
    throw new Error(`${inputs.methodId} is not a Fick method.`)
  }

  const withheldReasons: string[] = []
  const withheldReasonKinds: FickWithheldReasonKind[] = []
  const withhold = (kind: FickWithheldReasonKind, reason: string) => {
    withheldReasonKinds.push(kind)
    withheldReasons.push(reason)
  }
  const caveats: string[] = []
  const site = fickVenousSampleSiteLabels[inputs.venousSampleSite]
  const specimen = fickVenousSpecimenWords(inputs.venousSampleSite)

  const missing: string[] = []
  if (!finite(inputs.vo2MlMin) || inputs.vo2MlMin <= 0) missing.push('oxygen uptake')
  if (!finite(inputs.hemoglobinGDl) || inputs.hemoglobinGDl <= 0) missing.push('hemoglobin')
  if (!saturationIsPlausible(inputs.arterialSaturationFraction))
    missing.push('arterial oxygen saturation')
  if (!saturationIsPlausible(inputs.mixedVenousSaturationFraction))
    missing.push(`${specimen.short} oxygen saturation`)
  if (missing.length > 0) {
    // A missing specimen is missing — not zero, and not something the other inputs can be checked
    // against. It is never reported as a contradiction.
    withhold(
      'missing-input',
      `A required input is missing or outside a usable range: ${missing.join(', ')}.`,
    )
  }

  const useDissolved =
    inputs.includeDissolvedOxygen && finite(inputs.arterialPo2MmHg) && finite(inputs.venousPo2MmHg)
  if (inputs.includeDissolvedOxygen && !useDissolved) {
    caveats.push(
      'A dissolved-oxygen term was requested but only one partial pressure is available, so it is applied to neither content. Adding it to one side alone would change the difference artificially.',
    )
  }

  const arterialContent =
    missing.length === 0
      ? oxygenContentMlDl({
          hemoglobinGDl: inputs.hemoglobinGDl as number,
          saturationFraction: inputs.arterialSaturationFraction as number,
          po2MmHg: inputs.arterialPo2MmHg,
          includeDissolvedOxygen: useDissolved,
        })
      : null
  const venousContent =
    missing.length === 0
      ? oxygenContentMlDl({
          hemoglobinGDl: inputs.hemoglobinGDl as number,
          saturationFraction: inputs.mixedVenousSaturationFraction as number,
          po2MmHg: inputs.venousPo2MmHg,
          includeDissolvedOxygen: useDissolved,
        })
      : null
  const contentDifference =
    arterialContent !== null && venousContent !== null ? arterialContent - venousContent : null

  if (contentDifference !== null && contentDifference <= 0) {
    withhold(
      'contradictory-inputs',
      `The ${specimen.short} oxygen content is at or above the arterial content, so the difference is not a quantity this form can be divided by. The inputs contradict each other.`,
    )
  }
  if (!site.isTrueMixedVenous) {
    withhold(
      'not-mixed-venous',
      `The venous specimen came from the ${site.label.toLowerCase()} rather than the pulmonary artery, so it is not a true mixed-venous specimen: it is drawn upstream of where venous return from the whole body has mixed. This module does not treat the two as interchangeable and does not substitute one for the other.`,
    )
  }
  if (!inputs.steadyState) {
    withhold(
      'not-steady',
      'The patient was not in a steady state across the interval these inputs describe, so the oxygen balance the equation depends on did not hold while they were collected.',
    )
  }
  if (!inputs.samplesPairedInTime) {
    withhold(
      'not-paired-in-time',
      'The specimens and the oxygen-uptake figure do not belong to one measurement episode, so their difference describes no single circulatory state.',
    )
  }
  if (inputs.intracardiacShuntPresent) {
    withhold(
      'intracardiac-shunt',
      'An intracardiac shunt is present. This simple one-difference Fick calculation cannot represent separate pulmonary and systemic flow. A dedicated compartmental oximetry and Qp/Qs calculation is outside this model.',
    )
  }

  const status: FickResult['status'] = withheldReasons.length === 0 ? 'calculated' : 'withheld'
  const cardiacOutput =
    status === 'calculated' && contentDifference !== null && contentDifference > 0
      ? (inputs.vo2MlMin as number) /
        (contentDifference * CARDIAC_OUTPUT_MODEL_CONSTANTS.decilitersPerLiter)
      : null

  if (status === 'calculated' && contentDifference !== null && contentDifference < 2.5) {
    caveats.push(
      'The oxygen-content difference is small, so this result is unusually sensitive to error in either saturation, in hemoglobin, and in the oxygen uptake. The same absolute input error moves it much further than it would with a wider difference.',
    )
  }
  if (vo2Provenance === 'assumed') {
    caveats.push(
      'Oxygen uptake was assumed rather than measured on this patient. The result is an estimate that moves in direct proportion to that substituted figure, and it should be reported as an estimate with the assumption named.',
    )
  }
  if (useDissolved) {
    caveats.push(
      `A dissolved-oxygen term is included in both contents. ${DISSOLVED_OXYGEN_CONSTANT_QUALIFIER}`,
    )
  }

  const trace: readonly FickTraceRow[] = [
    traceRow(
      'vo2',
      'Oxygen uptake',
      vo2Provenance === 'measured' ? 'measured' : 'assumed',
      inputs.vo2MlMin,
      'mL/min',
      finite(inputs.vo2MlMin)
        ? `${roundTo(inputs.vo2MlMin, 0)} mL/min · ${
            vo2Provenance === 'measured'
              ? 'measured on this patient'
              : 'assumed; not measured on this patient'
          }`
        : 'Not available',
    ),
    traceRow(
      'hemoglobin',
      'Hemoglobin',
      'measured',
      inputs.hemoglobinGDl,
      'g/dL',
      finite(inputs.hemoglobinGDl) ? `${roundTo(inputs.hemoglobinGDl, 1)} g/dL` : 'Not available',
    ),
    traceRow(
      'arterial-saturation',
      'Arterial oxygen saturation',
      'sampled',
      inputs.arterialSaturationFraction,
      'fraction',
      saturationIsPlausible(inputs.arterialSaturationFraction)
        ? formatFraction(inputs.arterialSaturationFraction)
        : 'Not available',
    ),
    traceRow(
      'mixed-venous-saturation',
      specimen.saturation,
      'sampled',
      inputs.mixedVenousSaturationFraction,
      'fraction',
      saturationIsPlausible(inputs.mixedVenousSaturationFraction)
        ? formatFraction(inputs.mixedVenousSaturationFraction)
        : 'Not available',
    ),
    traceRow(
      'venous-sample-site',
      'Venous sampling site',
      'entered',
      null,
      null,
      `${site.label} · ${site.isTrueMixedVenous ? 'true mixed-venous specimen' : 'not a true mixed-venous specimen'}`,
    ),
    traceRow(
      'sample-timing',
      'One measurement episode',
      'entered',
      null,
      null,
      inputs.samplesPairedInTime
        ? 'Specimens and oxygen uptake describe the same interval'
        : 'Specimens and oxygen uptake describe different intervals',
    ),
    traceRow(
      'steady-state',
      'Steady state',
      'entered',
      null,
      null,
      inputs.steadyState ? 'Steady across the interval' : 'Not steady across the interval',
    ),
    traceRow(
      'dissolved-oxygen',
      'Dissolved-oxygen term',
      'calculated',
      null,
      'mL/dL',
      useDissolved
        ? `Included in both contents at ${CARDIAC_OUTPUT_MODEL_CONSTANTS.dissolvedOxygenMlPerDlPerMmHg} mL/dL per mmHg (model constant)`
        : 'Not included',
    ),
    traceRow(
      'arterial-content',
      'Arterial oxygen content',
      'calculated',
      arterialContent,
      'mL/dL',
      arterialContent === null
        ? 'Not available'
        : `${roundTo(arterialContent, 2)} mL of oxygen per dL`,
    ),
    traceRow(
      'mixed-venous-content',
      specimen.content,
      'calculated',
      venousContent,
      'mL/dL',
      venousContent === null ? 'Not available' : `${roundTo(venousContent, 2)} mL of oxygen per dL`,
    ),
    traceRow(
      'content-difference',
      'Arteriovenous oxygen-content difference',
      'calculated',
      contentDifference,
      'mL/dL',
      contentDifference === null
        ? 'Not available'
        : `${roundTo(contentDifference, 2)} mL of oxygen per dL · this is the denominator`,
    ),
    traceRow(
      'fick-cardiac-output',
      'Cardiac output',
      'calculated',
      cardiacOutput,
      'L/min',
      cardiacOutput === null
        ? 'Withheld'
        : `${roundTo(cardiacOutput, 2)} L/min by ${method.name.toLowerCase()}`,
    ),
  ]

  const unitAccount =
    arterialContent === null || venousContent === null
      ? [
          'The unit chain cannot be followed because one of the oxygen contents could not be computed.',
        ]
      : [
          `Arterial content: ${CARDIAC_OUTPUT_MODEL_CONSTANTS.hemoglobinOxygenBindingCapacityMlPerG} mL of oxygen per g of hemoglobin × ${roundTo(inputs.hemoglobinGDl as number, 1)} g/dL × ${roundTo((inputs.arterialSaturationFraction as number) * 100, 0)} in every 100 binding sites${useDissolved ? ' plus the dissolved term' : ''} = ${roundTo(arterialContent, 2)} mL/dL.`,
          `${specimen.content.charAt(0).toUpperCase()}${specimen.content.slice(1)}, computed the same way = ${roundTo(venousContent, 2)} mL/dL.`,
          differenceLine(arterialContent, venousContent),
          cardiacOutput === null
            ? 'The division is not carried out, because the inputs above do not support it.'
            : divisionLine(inputs.vo2MlMin as number, contentDifference as number, cardiacOutput),
        ]

  return {
    methodId: inputs.methodId,
    methodName: method.name,
    vo2Provenance,
    status,
    cardiacOutputLMin: cardiacOutput === null ? null : roundTo(cardiacOutput, 2),
    arterialOxygenContentMlDl: arterialContent === null ? null : roundTo(arterialContent, 2),
    mixedVenousOxygenContentMlDl: venousContent === null ? null : roundTo(venousContent, 2),
    contentDifferenceMlDl: contentDifference === null ? null : roundTo(contentDifference, 2),
    contentDifferenceUnroundedMlDl: contentDifference,
    cardiacOutputUnroundedLMin: cardiacOutput,
    trace,
    unitAccount,
    withheldReasons,
    withheldReasonKinds,
    caveats,
  }
}

/** The division step, with the same rule: say when the printed denominator does not reproduce it. */
function divisionLine(vo2MlMin: number, difference: number, cardiacOutput: number): string {
  const shownDifference = roundTo(difference, 2)
  const shownOutput = roundTo(cardiacOutput, 2)
  const fromLabels = roundTo(
    roundTo(vo2MlMin, 0) / (shownDifference * CARDIAC_OUTPUT_MODEL_CONSTANTS.decilitersPerLiter),
    2,
  )
  const base = `Division: ${roundTo(vo2MlMin, 0)} mL/min ÷ (${shownDifference} mL/dL × ${CARDIAC_OUTPUT_MODEL_CONSTANTS.decilitersPerLiter} dL per L)`
  const units =
    'The millilitres of oxygen cancel and the deciliters convert to liters, leaving liters per minute.'
  if (Math.abs(fromLabels - shownOutput) < 0.005) return `${base} = ${shownOutput} L/min. ${units}`
  return `${base} ≈ ${shownOutput} L/min, divided by the unrounded difference of ${difference.toFixed(4)} mL/dL (the rounded ${shownDifference} alone would give ${fromLabels.toFixed(2)}). ${units}`
}

/**
 * The subtraction step, at a precision that explains itself (report L7-06).
 *
 * Each content is shown to two decimals and the difference is computed from the unrounded contents,
 * so the two-decimal figures can subtract to something other than the printed difference
 * (16.12 − 14.12 printed as 1.99). When they do, the line says so and shows the contents to four
 * decimals, where the difference is visible. The backend never computes from the rounded labels.
 */
function differenceLine(arterialContent: number, venousContent: number): string {
  const shownArterial = roundTo(arterialContent, 2)
  const shownVenous = roundTo(venousContent, 2)
  const difference = arterialContent - venousContent
  const shownDifference = roundTo(difference, 2)
  const subtractedLabels = roundTo(shownArterial - shownVenous, 2)
  if (Math.abs(subtractedLabels - shownDifference) < 0.005) {
    return `Difference: ${shownArterial} mL/dL − ${shownVenous} mL/dL = ${shownDifference} mL/dL.`
  }
  return `Difference: ${shownArterial} mL/dL − ${shownVenous} mL/dL ≈ ${shownDifference} mL/dL. The contents are rounded to two decimals for display and the difference is taken before rounding: ${arterialContent.toFixed(4)} − ${venousContent.toFixed(4)} = ${difference.toFixed(4)} mL/dL, which rounds to ${shownDifference.toFixed(2)} (the rounded figures alone would give ${subtractedLabels.toFixed(2)}).`
}

/* ------------------------------------------------------------------ *
 * Error amplification
 * ------------------------------------------------------------------ */

export interface FickAmplification {
  readonly contentDifferenceMlDl: number
  readonly baselineCardiacOutputLMin: number
  readonly perturbedCardiacOutputLMin: number
  /** The absolute change applied to the mixed-venous saturation, in binding-site fraction. */
  readonly saturationErrorFraction: number
  /** How far the result moved, relative to where it started. */
  readonly relativeOutputChange: number
}

/**
 * What one fixed saturation error does to the result.
 *
 * The causal direction the section teaches — same absolute input error, smaller denominator, larger
 * proportional output error — is only visible when two input sets are compared, so this returns the
 * pieces rather than a verdict, and the surface puts two of them side by side.
 *
 * Returns null when the input set could not produce a result in the first place; a withheld
 * calculation has no sensitivity to describe.
 */
export function fickErrorAmplification(
  inputs: FickInputSet,
  saturationErrorFraction: number,
): FickAmplification | null {
  const baseline = fickCardiacOutput(inputs)
  if (baseline.status !== 'calculated' || baseline.cardiacOutputLMin === null) return null
  if (baseline.contentDifferenceMlDl === null || baseline.contentDifferenceMlDl <= 0) return null
  if (!saturationIsPlausible(inputs.mixedVenousSaturationFraction)) return null

  const perturbedSaturation = Math.min(
    0.999,
    Math.max(0.001, inputs.mixedVenousSaturationFraction + saturationErrorFraction),
  )
  const perturbed = fickCardiacOutput({
    ...inputs,
    mixedVenousSaturationFraction: perturbedSaturation,
  })
  if (perturbed.status !== 'calculated' || perturbed.cardiacOutputLMin === null) return null

  return {
    contentDifferenceMlDl: baseline.contentDifferenceMlDl,
    baselineCardiacOutputLMin: baseline.cardiacOutputLMin,
    perturbedCardiacOutputLMin: perturbed.cardiacOutputLMin,
    saturationErrorFraction,
    relativeOutputChange:
      (perturbed.cardiacOutputLMin - baseline.cardiacOutputLMin) / baseline.cardiacOutputLMin,
  }
}

/** The complete text equivalent of a Fick result panel, built from the same rows it renders. */
export function fickResultTextEquivalent(result: FickResult): string {
  const rows = result.trace
    .map((row) => `${row.label} — ${row.statusLabel.toLowerCase()}: ${row.display}.`)
    .join(' ')
  const outcome =
    result.status === 'calculated'
      ? `Result: ${result.cardiacOutputLMin} L/min by ${result.methodName.toLowerCase()}.`
      : `Result withheld. ${result.withheldReasons.join(' ')}`
  return [
    `${result.methodName}. Oxygen uptake was ${result.vo2Provenance === 'measured' ? 'measured on this patient' : 'assumed rather than measured'}.`,
    rows,
    result.unitAccount.join(' '),
    outcome,
    result.caveats.join(' '),
  ]
    .filter((part) => part.trim().length > 0)
    .join(' ')
}
