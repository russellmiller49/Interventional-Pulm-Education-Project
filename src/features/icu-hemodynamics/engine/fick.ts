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
  const caveats: string[] = []
  const site = fickVenousSampleSiteLabels[inputs.venousSampleSite]

  const missing: string[] = []
  if (!finite(inputs.vo2MlMin) || inputs.vo2MlMin <= 0) missing.push('oxygen uptake')
  if (!finite(inputs.hemoglobinGDl) || inputs.hemoglobinGDl <= 0) missing.push('hemoglobin')
  if (!saturationIsPlausible(inputs.arterialSaturationFraction))
    missing.push('arterial oxygen saturation')
  if (!saturationIsPlausible(inputs.mixedVenousSaturationFraction))
    missing.push('mixed-venous oxygen saturation')
  if (missing.length > 0) {
    withheldReasons.push(
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
    withheldReasons.push(
      'The mixed-venous oxygen content is at or above the arterial content, so the difference is not a quantity this form can be divided by. The inputs contradict each other.',
    )
  }
  if (!site.isTrueMixedVenous) {
    withheldReasons.push(
      `The venous specimen came from the ${site.label.toLowerCase()} rather than the pulmonary artery, so it is not a true mixed-venous specimen. This module does not treat the two as interchangeable.`,
    )
  }
  if (!inputs.steadyState) {
    withheldReasons.push(
      'The patient was not in a steady state across the interval these inputs describe, so the oxygen balance the equation depends on did not hold while they were collected.',
    )
  }
  if (!inputs.samplesPairedInTime) {
    withheldReasons.push(
      'The specimens and the oxygen-uptake figure do not belong to one measurement episode, so their difference describes no single circulatory state.',
    )
  }
  if (inputs.intracardiacShuntPresent) {
    withheldReasons.push(
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
      'Mixed-venous oxygen saturation',
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
      'Mixed-venous oxygen content',
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
          `Mixed-venous content, computed the same way = ${roundTo(venousContent, 2)} mL/dL.`,
          `Difference: ${roundTo(arterialContent, 2)} mL/dL − ${roundTo(venousContent, 2)} mL/dL = ${roundTo(arterialContent - venousContent, 2)} mL/dL.`,
          cardiacOutput === null
            ? 'The division is not carried out, because the inputs above do not support it.'
            : `Division: ${roundTo(inputs.vo2MlMin as number, 0)} mL/min ÷ (${roundTo(contentDifference as number, 2)} mL/dL × ${CARDIAC_OUTPUT_MODEL_CONSTANTS.decilitersPerLiter} dL per L) = ${roundTo(cardiacOutput, 2)} L/min. The millilitres of oxygen cancel and the deciliters convert to liters, leaving liters per minute.`,
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
    trace,
    unitAccount,
    withheldReasons,
    caveats,
  }
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
