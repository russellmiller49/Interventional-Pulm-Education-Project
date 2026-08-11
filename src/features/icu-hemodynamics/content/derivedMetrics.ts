/**
 * One canonical record for every derived hemodynamic value this module displays.
 *
 * H5's central rule: a derived hemodynamic value is an equation over measurements. It is not a new
 * independent measurement, and it cannot be more valid than its inputs. Before this file the module
 * held that rule in three places that could drift — formula strings in `derivedValueGuides`, math in
 * `calculateDerivedHemodynamics`, and prose in the teaching panel. Now the formula text, the
 * calculation, the dependency list, the unit account, the sensitivity account, and the interpretation
 * boundary are one record, and every H5 surface — the teaching panel, the episode workbench, the
 * legacy formula drawer's math, the numeric audit, and the tests — reads it.
 *
 * The metric ids are the existing `DerivedHemodynamics` keys on purpose: one namespace, so the
 * legacy drawer and the new station cannot describe two different sets of quantities.
 */

import { SHARED_CRITICAL_CARE_THRESHOLDS as sharedThresholds } from '@/features/critical-care/content/sharedClinicalThresholds'

import type { DerivedHemodynamics } from '../engine/types'
import { cardiacOutputInputStatuses, type CardiacOutputInputStatus } from './cardiacOutputMethods'
import { HEMODYNAMIC_CLINICAL_THRESHOLDS as thresholds } from './clinicalThresholds'
import { hemodynamicsSourceById } from './sources'

export type DerivedMetricId = keyof DerivedHemodynamics

/* ------------------------------------------------------------------ *
 * Input vocabulary — every quantity a formula may consume
 * ------------------------------------------------------------------ */

/**
 * The measurement conventions this station keeps distinct.
 *
 * `mean-end-expiration` is the PAWP the resistance formulas are written for. H3 teaches an
 * end-expiratory read of the occlusion trace for a different purpose; substituting a single
 * end-diastolic value where the mean is required is one of the failures H5 exists to catch, so the
 * convention is data on the input rather than prose beside it.
 */
export const derivedInputConventions = [
  'mean-over-cycle',
  'mean-end-expiration',
  'end-diastolic',
  'systolic-peak',
  'diastolic-trough',
  'respiratory-cycle-extremes',
] as const

export type DerivedInputConvention = (typeof derivedInputConventions)[number]

export interface DerivedInputDefinition {
  readonly id: string
  readonly label: string
  readonly unit: string
  /** What the quantity is, in a sentence a novice can read. */
  readonly whatItIs: string
  /** The convention the formulas here expect this input to have been obtained under, if any. */
  readonly requiredConvention: DerivedInputConvention | null
  /** Whether this quantity is itself an equation over other quantities. */
  readonly isCalculated: boolean
  /**
   * Whether this quantity is read off a pressure waveform.
   *
   * H4 defines `sampled` as a specimen drawn from a named site at a named time — a blood gas, a
   * mixed-venous draw. A pressure is never obtained that way: it is transduced from a trace. Marking
   * the distinction structurally lets the validator refuse `sampled` on a pressure while leaving it
   * available to the oxygen measurements that genuinely are specimens.
   */
  readonly isPressureReading: boolean
}

export const derivedInputDefinitions: readonly DerivedInputDefinition[] = Object.freeze([
  {
    id: 'heartRateBpm',
    label: 'Heart rate',
    unit: 'beats/min',
    whatItIs: 'The rate the monitor derives from the rhythm during this episode.',
    requiredConvention: null,
    isCalculated: false,
    isPressureReading: false,
  },
  {
    id: 'mapMmHg',
    label: 'Mean arterial pressure',
    unit: 'mmHg',
    whatItIs: 'The mean systemic arterial pressure from a validated arterial line.',
    requiredConvention: 'mean-over-cycle',
    isCalculated: false,
    isPressureReading: true,
  },
  {
    id: 'rapMmHg',
    label: 'Right atrial pressure',
    unit: 'mmHg',
    whatItIs: 'The mean right atrial pressure read at end expiration from a validated trace.',
    requiredConvention: 'mean-end-expiration',
    isCalculated: false,
    isPressureReading: true,
  },
  {
    id: 'meanPapMmHg',
    label: 'Mean pulmonary artery pressure',
    unit: 'mmHg',
    whatItIs: 'The mean pulmonary artery pressure from a confirmed PA trace.',
    requiredConvention: 'mean-over-cycle',
    isCalculated: false,
    isPressureReading: true,
  },
  {
    id: 'papSystolicMmHg',
    label: 'PA systolic pressure',
    unit: 'mmHg',
    whatItIs: 'The systolic peak of the pulmonary artery trace.',
    requiredConvention: 'systolic-peak',
    isCalculated: false,
    isPressureReading: true,
  },
  {
    id: 'papDiastolicMmHg',
    label: 'PA diastolic pressure',
    unit: 'mmHg',
    whatItIs: 'The diastolic trough of the pulmonary artery trace.',
    requiredConvention: 'diastolic-trough',
    isCalculated: false,
    isPressureReading: true,
  },
  {
    id: 'pawpMeanMmHg',
    label: 'Mean PAWP',
    unit: 'mmHg',
    whatItIs:
      'The mean pulmonary artery wedge pressure at end expiration during a brief, valid occlusion.',
    requiredConvention: 'mean-end-expiration',
    isCalculated: false,
    isPressureReading: true,
  },
  {
    id: 'cardiacOutputLMin',
    label: 'Cardiac output',
    unit: 'L/min',
    whatItIs:
      'Flow per minute from a named acquisition method. It is itself derived, and it carries that method wherever it goes.',
    requiredConvention: null,
    isCalculated: true,
    isPressureReading: false,
  },
  {
    id: 'strokeVolumeMl',
    label: 'Stroke volume',
    unit: 'mL',
    whatItIs: 'Flow per beat, calculated from cardiac output and heart rate. Not measured.',
    requiredConvention: null,
    isCalculated: true,
    isPressureReading: false,
  },
  {
    id: 'bodySurfaceAreaM2',
    label: 'Body surface area',
    unit: 'm²',
    whatItIs:
      'Calculated by the charting system from an entered height and weight. This module does not implement the estimating formula; it consumes the recorded value with that provenance.',
    requiredConvention: null,
    isCalculated: true,
    isPressureReading: false,
  },
  {
    id: 'pulsePressureMaxMmHg',
    label: 'Maximum pulse pressure',
    unit: 'mmHg',
    whatItIs: 'The largest beat-to-beat arterial pulse pressure across one respiratory cycle.',
    requiredConvention: 'respiratory-cycle-extremes',
    isCalculated: false,
    isPressureReading: true,
  },
  {
    id: 'pulsePressureMinMmHg',
    label: 'Minimum pulse pressure',
    unit: 'mmHg',
    whatItIs:
      'The smallest beat-to-beat arterial pulse pressure across the same respiratory cycle.',
    requiredConvention: 'respiratory-cycle-extremes',
    isCalculated: false,
    isPressureReading: true,
  },
])

export const derivedInputDefinitionById: ReadonlyMap<string, DerivedInputDefinition> = new Map(
  derivedInputDefinitions.map((input) => [input.id, input]),
)

export function requireDerivedInputDefinition(id: string): DerivedInputDefinition {
  const input = derivedInputDefinitionById.get(id)
  if (!input) throw new Error(`Unknown derived-metric input: ${id}`)
  return input
}

/* ------------------------------------------------------------------ *
 * The metric record
 * ------------------------------------------------------------------ */

export type DerivedMetricCategory =
  | 'flow-and-indexing'
  | 'systemic-load'
  | 'pulmonary-load'
  | 'pump-power'
  | 'dynamic-index'

export type DerivedDependencyRole = 'numerator' | 'denominator' | 'factor'

export interface DerivedMetricDependency {
  readonly inputId: string
  readonly role: DerivedDependencyRole
  /** Provenance labels under which this input can legitimately feed the formula. */
  readonly acceptableProvenance: readonly CardiacOutputInputStatus[]
}

/**
 * A difference the formula computes, checked and displayed as data.
 *
 * Gradients are where discordance lives: a wedge above the mean PA pressure makes this quantity
 * negative, and the evaluator preserves that number as evidence of measurement disagreement instead
 * of clamping it or letting it pass into a division.
 */
export interface DerivedMetricGradient {
  readonly minuendInputId: string
  readonly subtrahendInputId: string
  readonly label: string
  /** True when a zero or negative difference makes the equation unusable, not merely zero. */
  readonly mustBePositive: boolean
}

export interface DerivedMetricRecord {
  readonly id: DerivedMetricId
  readonly name: string
  readonly shortLabel: string
  readonly category: DerivedMetricCategory
  /** The symbolic formula, exactly as every surface prints it. */
  readonly formulaText: string
  readonly outputUnit: string
  readonly displayPrecision: number
  readonly dependencies: readonly DerivedMetricDependency[]
  /** Whether the result inherits a cardiac-output acquisition method. */
  readonly requiresFlowMethod: boolean
  readonly requiresBodySurfaceArea: boolean
  /** What the arithmetic itself needs — stated in words a learner reads beside the formula. */
  readonly mathematicalDomain: string
  /** The differences the formula computes, in evaluation order. */
  readonly gradients: readonly DerivedMetricGradient[]
  /** Inputs that must be strictly positive for the equation to mean anything. */
  readonly requiredPositiveInputIds: readonly string[]
  /** A physiologic validity screen the result additionally depends on, if any. */
  readonly validityScreen: 'fluid-responsiveness' | null
  /** The units, carried through the calculation, including any conversion constant. */
  readonly unitAccount: readonly string[]
  /** The pure calculation. Inputs are keyed by input id; callers validate before calling. */
  readonly calculate: (inputs: Readonly<Record<string, number>>) => number
  /** Which input the result is disproportionately sensitive to, and why. */
  readonly sensitivityAccount: string
  readonly interpretation: string
  /** What the number still does not establish, even when valid. */
  readonly cannotEstablish: string
  /** The major conditions under which this metric must not be calculated. */
  readonly invalidWhen: readonly string[]
  readonly thresholdContextIds: readonly string[]
  readonly evidenceIds: readonly string[]
  readonly sourceLimitations: readonly string[]
}

const RESISTANCE_UNIT_CONVERSION =
  '×80 converts mmHg·min/L (Wood units) to dyn·s·cm⁻⁵: 1 WU = 80 dyn·s·cm⁻⁵.'

const CPO_UNIT_CONVERSION =
  '÷451 converts mmHg × L/min to watts; 451 is the conversion constant the source formula states.'

const FLOW_LIMITATION =
  'The result carries the cardiac-output method that produced its flow input, including any assumption inside that method.'

const sharedSourceLimitations = [
  'The Bootsma Part 2 review was read against its supplied text for the formula, unit, and reference-interval claims marked verified in the H5 source boundaries; the document itself is not distributed in this repository.',
] as const

export const derivedMetricRecords: readonly DerivedMetricRecord[] = Object.freeze([
  {
    id: 'cardiacIndexLMinM2',
    name: 'Cardiac index',
    shortLabel: 'CI',
    category: 'flow-and-indexing',
    formulaText: 'CO / BSA',
    outputUnit: 'L/min/m²',
    displayPrecision: 1,
    dependencies: [
      { inputId: 'cardiacOutputLMin', role: 'numerator', acceptableProvenance: ['calculated'] },
      {
        inputId: 'bodySurfaceAreaM2',
        role: 'denominator',
        acceptableProvenance: ['calculated', 'entered'],
      },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: true,
    mathematicalDomain:
      'Both inputs must be finite and positive; a zero body surface area cannot be divided by.',
    gradients: [],
    requiredPositiveInputIds: ['cardiacOutputLMin', 'bodySurfaceAreaM2'],
    validityScreen: null,
    unitAccount: ['L/min ÷ m² = L/min/m². No conversion constant.'],
    calculate: (inputs) => inputs.cardiacOutputLMin / inputs.bodySurfaceAreaM2,
    sensitivityAccount:
      'The denominator is body surface area. An unverified height or weight moves the index without any change in flow, and the flow input carries its own method error on top.',
    interpretation:
      'Indexing reduces body-size effects when comparing flow between patients. It does not establish whether perfusion is adequate for this patient.',
    cannotEstablish:
      'Whether organ perfusion is adequate, and whether the underlying cardiac output was itself acquired well.',
    invalidWhen: [
      'No accepted cardiac-output result exists, or its method is unknown.',
      'Body surface area is missing or its height and weight provenance is unknown.',
    ],
    thresholdContextIds: ['ci-adult-reference-interval', 'ci-educational-alarm-boundaries'],
    evidenceIds: ['pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations],
  },
  {
    id: 'strokeVolumeMl',
    name: 'Stroke volume',
    shortLabel: 'SV',
    category: 'flow-and-indexing',
    formulaText: 'CO × 1000 / HR',
    outputUnit: 'mL',
    displayPrecision: 0,
    dependencies: [
      { inputId: 'cardiacOutputLMin', role: 'numerator', acceptableProvenance: ['calculated'] },
      { inputId: 'heartRateBpm', role: 'denominator', acceptableProvenance: ['measured'] },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: false,
    mathematicalDomain: 'Cardiac output and heart rate must be finite and positive.',
    gradients: [],
    requiredPositiveInputIds: ['cardiacOutputLMin', 'heartRateBpm'],
    validityScreen: null,
    unitAccount: ['L/min × 1000 mL/L ÷ beats/min = mL per beat.'],
    calculate: (inputs) => (inputs.cardiacOutputLMin * 1000) / inputs.heartRateBpm,
    sensitivityAccount:
      'The value inherits error from both cardiac output and heart rate; an irregular rhythm makes the per-beat figure an average over unequal beats.',
    interpretation:
      'Flow per beat. It converts a minute flow into a per-beat quantity; it does not measure ventricular performance directly.',
    cannotEstablish: 'Preload, contractility, or the mechanism behind a high or low value.',
    invalidWhen: ['No accepted cardiac-output result exists, or its method is unknown.'],
    thresholdContextIds: ['sv-adult-reference-interval'],
    evidenceIds: ['pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations],
  },
  {
    id: 'strokeVolumeIndexMlM2',
    name: 'Stroke volume index',
    shortLabel: 'SVI',
    category: 'flow-and-indexing',
    formulaText: 'SV / BSA',
    outputUnit: 'mL/m²',
    displayPrecision: 0,
    dependencies: [
      { inputId: 'strokeVolumeMl', role: 'numerator', acceptableProvenance: ['calculated'] },
      {
        inputId: 'bodySurfaceAreaM2',
        role: 'denominator',
        acceptableProvenance: ['calculated', 'entered'],
      },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: true,
    mathematicalDomain: 'Stroke volume and body surface area must be finite and positive.',
    gradients: [],
    requiredPositiveInputIds: ['strokeVolumeMl', 'bodySurfaceAreaM2'],
    validityScreen: null,
    unitAccount: ['mL ÷ m² = mL/m². No conversion constant.'],
    calculate: (inputs) => inputs.strokeVolumeMl / inputs.bodySurfaceAreaM2,
    sensitivityAccount:
      'Stroke volume is itself calculated, so this index stacks the flow method error, the heart-rate error, and the body-size provenance in one number.',
    interpretation:
      'Per-beat flow scaled to body size. A value inside a reference interval does not prove adequate perfusion.',
    cannotEstablish: 'The mechanism of an abnormal value, or the validity of its own inputs.',
    invalidWhen: [
      'No accepted cardiac-output result exists, or its method is unknown.',
      'Body surface area is missing or its provenance is unknown.',
    ],
    thresholdContextIds: ['svi-adult-reference-interval'],
    evidenceIds: ['pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations],
  },
  {
    id: 'systemicVascularResistance',
    name: 'Systemic vascular resistance',
    shortLabel: 'SVR',
    category: 'systemic-load',
    formulaText: '80 × (MAP − RAP) / CO',
    outputUnit: 'dyn·s·cm⁻⁵',
    displayPrecision: 0,
    dependencies: [
      { inputId: 'mapMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'rapMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'cardiacOutputLMin', role: 'denominator', acceptableProvenance: ['calculated'] },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: false,
    mathematicalDomain:
      'MAP, RAP, and cardiac output must be finite, cardiac output positive, and the MAP − RAP gradient positive. A negative gradient is a measurement conflict to reconcile, not a resistance.',
    gradients: [
      {
        minuendInputId: 'mapMmHg',
        subtrahendInputId: 'rapMmHg',
        label: 'MAP − RAP gradient',
        mustBePositive: true,
      },
    ],
    requiredPositiveInputIds: ['cardiacOutputLMin'],
    validityScreen: null,
    unitAccount: [`(mmHg − mmHg) ÷ L/min = Wood units. ${RESISTANCE_UNIT_CONVERSION}`],
    calculate: (inputs) => (80 * (inputs.mapMmHg - inputs.rapMmHg)) / inputs.cardiacOutputLMin,
    sensitivityAccount:
      'Cardiac output is the denominator: an artifactually low flow inflates the calculated resistance in exact proportion. An invalid RAP moves the gradient directly.',
    interpretation:
      'A systemic pressure gradient divided by flow — a summary of arterial load, not a measured vessel property.',
    cannotEstablish:
      'Vasomotor tone as a mechanism on its own, or whether any treatment is indicated. The pressures and the flow must also belong to one measurement episode.',
    invalidWhen: [
      'MAP, RAP, or cardiac output is missing, invalid, or from a different measurement episode.',
      'No accepted cardiac-output result exists, or its method is unknown.',
      'The MAP − RAP gradient is zero or negative — the inputs disagree and must be reconciled first.',
    ],
    thresholdContextIds: ['svr-adult-reference-interval'],
    evidenceIds: ['pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations, FLOW_LIMITATION],
  },
  {
    id: 'systemicVascularResistanceIndex',
    name: 'Systemic vascular resistance index',
    shortLabel: 'SVRI',
    category: 'systemic-load',
    formulaText: 'SVR × BSA',
    outputUnit: 'dyn·s·cm⁻⁵·m²',
    displayPrecision: 0,
    dependencies: [
      { inputId: 'mapMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'rapMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'cardiacOutputLMin', role: 'denominator', acceptableProvenance: ['calculated'] },
      {
        inputId: 'bodySurfaceAreaM2',
        role: 'factor',
        acceptableProvenance: ['calculated', 'entered'],
      },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: true,
    mathematicalDomain: 'Everything SVR requires, plus a finite positive body surface area.',
    gradients: [
      {
        minuendInputId: 'mapMmHg',
        subtrahendInputId: 'rapMmHg',
        label: 'MAP − RAP gradient',
        mustBePositive: true,
      },
    ],
    requiredPositiveInputIds: ['cardiacOutputLMin', 'bodySurfaceAreaM2'],
    validityScreen: null,
    unitAccount: [
      `SVR in dyn·s·cm⁻⁵ × BSA in m² = dyn·s·cm⁻⁵·m² — algebraically identical to 80 × (MAP − RAP) / CI. ${RESISTANCE_UNIT_CONVERSION}`,
    ],
    calculate: (inputs) =>
      ((80 * (inputs.mapMmHg - inputs.rapMmHg)) / inputs.cardiacOutputLMin) *
      inputs.bodySurfaceAreaM2,
    sensitivityAccount:
      'Indexing multiplies by body surface area, so the index inherits every limitation of MAP, RAP, and CO, and adds the body-size provenance on top.',
    interpretation:
      'Systemic resistance scaled to body size, for comparison across patients. Indexing does not repair an invalid input.',
    cannotEstablish: 'Anything SVR itself cannot, and nothing further about body composition.',
    invalidWhen: [
      'Anything that invalidates SVR.',
      'Body surface area is missing or its provenance is unknown.',
    ],
    thresholdContextIds: ['svri-no-bedside-boundary'],
    evidenceIds: ['pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations, FLOW_LIMITATION],
  },
  {
    id: 'pulmonaryVascularResistance',
    name: 'Pulmonary vascular resistance',
    shortLabel: 'PVR',
    category: 'pulmonary-load',
    formulaText: '(mPAP − mean PAWP) / CO',
    outputUnit: 'WU',
    displayPrecision: 1,
    dependencies: [
      { inputId: 'meanPapMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'pawpMeanMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'cardiacOutputLMin', role: 'denominator', acceptableProvenance: ['calculated'] },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: false,
    mathematicalDomain:
      'mPAP, mean PAWP, and cardiac output must be finite, cardiac output positive, and the transpulmonary gradient positive. A negative gradient is preserved as a measurement conflict, never clamped to zero.',
    gradients: [
      {
        minuendInputId: 'meanPapMmHg',
        subtrahendInputId: 'pawpMeanMmHg',
        label: 'mPAP − PAWP transpulmonary gradient',
        mustBePositive: true,
      },
    ],
    requiredPositiveInputIds: ['cardiacOutputLMin'],
    validityScreen: null,
    unitAccount: [
      `(mmHg − mmHg) ÷ L/min = mmHg·min/L, reported as Wood units. ${RESISTANCE_UNIT_CONVERSION}`,
    ],
    calculate: (inputs) => (inputs.meanPapMmHg - inputs.pawpMeanMmHg) / inputs.cardiacOutputLMin,
    sensitivityAccount:
      'Both the wedge pressure and the flow sit inside this number: a PAWP read away from end expiration moves the gradient, and an erroneous cardiac output scales the whole result.',
    interpretation:
      'The pressure drop across the pulmonary circulation divided by the flow through it. The formula requires the mean PAWP, not a single end-diastolic value.',
    cannotEstablish:
      'A pulmonary-hypertension diagnosis on its own. The guideline definition reads PVR together with mPAP and PAWP from the same valid episode.',
    invalidWhen: [
      'The PAWP is invalid, absent, or replaced by an end-diastolic value where the mean is required.',
      'No accepted cardiac-output result exists, or its method is unknown.',
      'The mPAP − PAWP gradient is zero or negative — the inputs disagree and must be reconciled first.',
    ],
    thresholdContextIds: ['pvr-esc-ers-definition-component'],
    evidenceIds: ['esc-ers-ph-2022', 'pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations, FLOW_LIMITATION],
  },
  {
    id: 'pulmonaryVascularResistanceIndex',
    name: 'Pulmonary vascular resistance index',
    shortLabel: 'PVRI',
    category: 'pulmonary-load',
    formulaText: 'PVR × BSA',
    outputUnit: 'WU·m²',
    displayPrecision: 1,
    dependencies: [
      { inputId: 'meanPapMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'pawpMeanMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'cardiacOutputLMin', role: 'denominator', acceptableProvenance: ['calculated'] },
      {
        inputId: 'bodySurfaceAreaM2',
        role: 'factor',
        acceptableProvenance: ['calculated', 'entered'],
      },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: true,
    mathematicalDomain: 'Everything PVR requires, plus a finite positive body surface area.',
    gradients: [
      {
        minuendInputId: 'meanPapMmHg',
        subtrahendInputId: 'pawpMeanMmHg',
        label: 'mPAP − PAWP transpulmonary gradient',
        mustBePositive: true,
      },
    ],
    requiredPositiveInputIds: ['cardiacOutputLMin', 'bodySurfaceAreaM2'],
    validityScreen: null,
    unitAccount: ['PVR in WU × BSA in m² = WU·m² — algebraically identical to (mPAP − PAWP) / CI.'],
    calculate: (inputs) =>
      ((inputs.meanPapMmHg - inputs.pawpMeanMmHg) / inputs.cardiacOutputLMin) *
      inputs.bodySurfaceAreaM2,
    sensitivityAccount:
      'Everything PVR is sensitive to, multiplied by a body surface area whose own provenance must hold.',
    interpretation:
      'Pulmonary resistance scaled to body size. Indexing does not repair an invalid PAWP, mPAP, or CO, and it does not replace the guideline PVR definition.',
    cannotEstablish: 'Anything PVR itself cannot.',
    invalidWhen: [
      'Anything that invalidates PVR.',
      'Body surface area is missing or its provenance is unknown.',
    ],
    thresholdContextIds: ['pvri-no-bedside-boundary'],
    evidenceIds: ['esc-ers-ph-2022', 'pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations, FLOW_LIMITATION],
  },
  {
    id: 'cardiacPowerOutputW',
    name: 'Cardiac power output',
    shortLabel: 'CPO',
    category: 'pump-power',
    formulaText: 'MAP × CO / 451',
    outputUnit: 'W',
    displayPrecision: 2,
    dependencies: [
      { inputId: 'mapMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'cardiacOutputLMin', role: 'numerator', acceptableProvenance: ['calculated'] },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: false,
    mathematicalDomain: 'MAP and cardiac output must be finite and positive.',
    gradients: [],
    requiredPositiveInputIds: ['mapMmHg', 'cardiacOutputLMin'],
    validityScreen: null,
    unitAccount: [`mmHg × L/min ÷ 451 = watts. ${CPO_UNIT_CONVERSION}`],
    calculate: (inputs) => (inputs.mapMmHg * inputs.cardiacOutputLMin) / 451,
    sensitivityAccount:
      'Pressure and flow multiply, so an error in either moves the result in proportion — and the flow input carries its acquisition method with it.',
    interpretation:
      'A pressure–flow product summarizing pump work. This module uses the uncorrected MAP × CO form its cohort source reports; a variant that subtracts RAP and indexes to BSA exists and is not interchangeable with this one.',
    cannotEstablish:
      'Whether perfusion is adequate, or that any support decision follows from the number alone.',
    invalidWhen: [
      'MAP or cardiac output is missing, invalid, or from a different measurement episode.',
      'No accepted cardiac-output result exists, or its method is unknown.',
    ],
    thresholdContextIds: ['cpo-acute-cardiac-cohort-cut-point', 'cpo-teaching-band'],
    evidenceIds: ['cpo-acute-cardiac-2007', 'pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations, FLOW_LIMITATION],
  },
  {
    id: 'pulmonaryArteryPulsatilityIndex',
    name: 'Pulmonary artery pulsatility index',
    shortLabel: 'PAPi',
    category: 'pulmonary-load',
    formulaText: '(PASP − PADP) / RAP',
    outputUnit: '',
    displayPrecision: 2,
    dependencies: [
      { inputId: 'papSystolicMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'papDiastolicMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'rapMmHg', role: 'denominator', acceptableProvenance: ['measured'] },
    ],
    requiresFlowMethod: false,
    requiresBodySurfaceArea: false,
    mathematicalDomain:
      'All three pressures must be finite, the PA pulse pressure positive, and RAP positive. A zero RAP cannot be divided by, and a small RAP makes the quotient extremely sensitive to RAP error.',
    gradients: [
      {
        minuendInputId: 'papSystolicMmHg',
        subtrahendInputId: 'papDiastolicMmHg',
        label: 'PA pulse pressure',
        mustBePositive: true,
      },
    ],
    requiredPositiveInputIds: ['rapMmHg'],
    validityScreen: null,
    unitAccount: ['(mmHg − mmHg) ÷ mmHg — the units cancel, leaving a dimensionless ratio.'],
    calculate: (inputs) => (inputs.papSystolicMmHg - inputs.papDiastolicMmHg) / inputs.rapMmHg,
    sensitivityAccount:
      'RAP is the denominator and is often a small number. Near zero, a 1 mmHg RAP error moves the ratio enormously, so an extreme value says as much about the denominator as about the right ventricle.',
    interpretation:
      'A pressure-only ratio read as a right-ventricular performance signal in specific populations. It needs no cardiac output, so it can survive when flow-dependent metrics are withheld.',
    cannotEstablish:
      'A universal definition of RV failure. Each published cut point is population-specific and does not transfer between phenotypes.',
    invalidWhen: [
      'PASP, PADP, or RAP is missing or invalid.',
      'The PA pulse pressure is zero or negative.',
      'RAP is zero or negative — the ratio is undefined or meaningless.',
    ],
    thresholdContextIds: ['papi-acute-rv-infarction-cut-point', 'papi-advanced-hf-teaching-band'],
    evidenceIds: ['papi-rvmi-2012', 'pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations],
  },
  {
    id: 'pulmonaryArteryCompliance',
    name: 'Pulmonary artery compliance',
    shortLabel: 'PA compliance',
    category: 'pulmonary-load',
    formulaText: 'SV / (PASP − PADP)',
    outputUnit: 'mL/mmHg',
    displayPrecision: 1,
    dependencies: [
      { inputId: 'strokeVolumeMl', role: 'numerator', acceptableProvenance: ['calculated'] },
      { inputId: 'papSystolicMmHg', role: 'denominator', acceptableProvenance: ['measured'] },
      { inputId: 'papDiastolicMmHg', role: 'denominator', acceptableProvenance: ['measured'] },
    ],
    requiresFlowMethod: true,
    requiresBodySurfaceArea: false,
    mathematicalDomain:
      'Stroke volume must be finite and positive and the PA pulse pressure positive. A narrow pulse pressure is a small denominator, and a zero one cannot be divided by.',
    gradients: [
      {
        minuendInputId: 'papSystolicMmHg',
        subtrahendInputId: 'papDiastolicMmHg',
        label: 'PA pulse pressure',
        mustBePositive: true,
      },
    ],
    requiredPositiveInputIds: ['strokeVolumeMl'],
    validityScreen: null,
    unitAccount: ['mL ÷ (mmHg − mmHg) = mL/mmHg.'],
    calculate: (inputs) =>
      inputs.strokeVolumeMl / (inputs.papSystolicMmHg - inputs.papDiastolicMmHg),
    sensitivityAccount:
      'The denominator is the PA pulse pressure, so a damped or resonant trace changes the result without any change in the circulation — and the numerator is itself a calculated stroke volume carrying the flow method.',
    interpretation:
      'Stroke volume per unit of PA pulse pressure — a load-dependent stiffness summary of the pulmonary circulation, lower when the bed is stiffer.',
    cannotEstablish:
      'A universal normal interval. The registered cohort reports a distribution for its own population, not limits for every patient.',
    invalidWhen: [
      'Stroke volume cannot be calculated, or its cardiac-output method is unknown.',
      'PASP or PADP is missing or invalid, or the pulse pressure is zero or negative.',
    ],
    thresholdContextIds: ['pa-compliance-cohort-distribution'],
    evidenceIds: ['pa-compliance-outcomes-2026', 'pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations, FLOW_LIMITATION],
  },
  {
    id: 'pulsePressureVariationPercent',
    name: 'Pulse pressure variation',
    shortLabel: 'PPV',
    category: 'dynamic-index',
    formulaText: '(PPmax − PPmin) / PPmean × 100',
    outputUnit: '%',
    displayPrecision: 0,
    dependencies: [
      { inputId: 'pulsePressureMaxMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
      { inputId: 'pulsePressureMinMmHg', role: 'numerator', acceptableProvenance: ['measured'] },
    ],
    requiresFlowMethod: false,
    requiresBodySurfaceArea: false,
    mathematicalDomain:
      'Both pulse pressures must be finite and their mean positive. On top of the arithmetic, the physiologic validity screen must also hold before the number means anything.',
    gradients: [
      {
        minuendInputId: 'pulsePressureMaxMmHg',
        subtrahendInputId: 'pulsePressureMinMmHg',
        label: 'Pulse-pressure swing (PPmax − PPmin)',
        mustBePositive: false,
      },
    ],
    requiredPositiveInputIds: ['pulsePressureMaxMmHg', 'pulsePressureMinMmHg'],
    validityScreen: 'fluid-responsiveness',
    unitAccount: [
      'Largest minus smallest pulse pressure, divided by their mean and scaled to parts per hundred — the millimeters of mercury cancel.',
    ],
    calculate: (inputs) =>
      (100 * (inputs.pulsePressureMaxMmHg - inputs.pulsePressureMinMmHg)) /
      ((inputs.pulsePressureMaxMmHg + inputs.pulsePressureMinMmHg) / 2),
    sensitivityAccount:
      'The whole quantity is a respiratory-cycle difference, so rhythm irregularity, spontaneous effort, and waveform artifact all inject variation that is not volume responsiveness.',
    interpretation:
      'A dynamic index of heart–lung interaction, interpretable only inside its validated conditions: controlled ventilation, regular rhythm, no spontaneous effort, adequate tidal volume, closed chest, a valid arterial trace, and no confounding RV failure.',
    cannotEstablish:
      'Volume status, a diagnosis of hypovolemia, or a mandate to give fluid. It predicts responsiveness in the validated setting only.',
    invalidWhen: [
      'Any element of the validity screen fails — rhythm, ventilation, effort, tidal volume, chest, waveform, or RV context.',
      'Either pulse-pressure extreme is missing or the mean pulse pressure is not positive.',
    ],
    thresholdContextIds: ['ppv-conditional-cohort-threshold'],
    evidenceIds: ['ppv-sepsis-2000', 'pac-derived-part-2-2021'],
    sourceLimitations: [...sharedSourceLimitations],
  },
])

export const derivedMetricById: ReadonlyMap<DerivedMetricId, DerivedMetricRecord> = new Map(
  derivedMetricRecords.map((metric) => [metric.id, metric]),
)

export function requireDerivedMetric(id: DerivedMetricId): DerivedMetricRecord {
  const metric = derivedMetricById.get(id)
  if (!metric) throw new Error(`Unknown derived metric: ${id}`)
  return metric
}

/* ------------------------------------------------------------------ *
 * Threshold contexts — every number, classified before it is shown
 * ------------------------------------------------------------------ */

/**
 * What kind of claim a displayed boundary is.
 *
 * The classification exists so a cohort observation cannot be rendered as a target. Two members are
 * deliberately unusable: `treatment-target` and `unsupported` are in the vocabulary so a test can
 * prove the validator rejects them, and no record here may carry either.
 */
export const derivedThresholdClassifications = [
  'diagnostic-definition',
  'cohort-risk-association',
  'phenotype-specific-cutoff',
  'reference-interval',
  'device-or-protocol-value',
  'model-parameter',
  'treatment-target',
  'unsupported',
] as const

export type DerivedThresholdClassification = (typeof derivedThresholdClassifications)[number]

export const derivedThresholdClassificationLabels: Readonly<
  Record<DerivedThresholdClassification, string>
> = Object.freeze({
  'diagnostic-definition': 'Diagnostic definition',
  'cohort-risk-association': 'Cohort risk association',
  'phenotype-specific-cutoff': 'Phenotype-specific cut point',
  'reference-interval': 'Reference interval',
  'device-or-protocol-value': 'Device or protocol value',
  'model-parameter': 'Simulation parameter',
  'treatment-target': 'Treatment target',
  unsupported: 'Unsupported',
})

export interface DerivedThresholdContext {
  readonly id: string
  readonly metricId: DerivedMetricId
  readonly classification: DerivedThresholdClassification
  /** The claim, with its number, exactly as surfaces print it. */
  readonly statement: string
  /** The population, phenotype, or context the claim belongs to. */
  readonly population: string
  /** What the source used the boundary for. */
  readonly intendedUse: string
  /** The sentence that stops the boundary from traveling where it does not belong. */
  readonly notUniversal: string
  readonly evidenceIds: readonly string[]
}

const ph = thresholds.pulmonaryHypertension
const papi = sharedThresholds.pulmonaryArteryPulsatilityIndex
const cpo = sharedThresholds.cardiacPowerOutput

export const derivedThresholdContexts: readonly DerivedThresholdContext[] = Object.freeze([
  {
    id: 'ci-adult-reference-interval',
    metricId: 'cardiacIndexLMinM2',
    classification: 'reference-interval',
    statement: 'A commonly cited resting adult reference interval is 2.5–4.0 L/min/m².',
    population: 'Resting adults, as tabulated in the cited PAC review.',
    intendedUse: 'Orientation to the usual magnitude of an indexed resting flow.',
    notUniversal:
      'A value inside the interval does not prove adequate perfusion, and a value outside it does not name a mechanism.',
    evidenceIds: ['pac-derived-part-2-2021'],
  },
  {
    id: 'ci-educational-alarm-boundaries',
    metricId: 'cardiacIndexLMinM2',
    classification: 'model-parameter',
    statement: `This simulator warns below ${thresholds.cardiacIndexAlarm.lowLMinM2} L/min/m² and alarms below ${thresholds.cardiacIndexAlarm.criticalLowLMinM2} L/min/m².`,
    population: 'This educational simulation only.',
    intendedUse: 'Deterministic alarm behavior inside the module.',
    notUniversal: 'An alarm boundary this simulator uses carries no clinical authority.',
    evidenceIds: ['pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'],
  },
  {
    id: 'sv-adult-reference-interval',
    metricId: 'strokeVolumeMl',
    classification: 'reference-interval',
    statement: 'A commonly cited adult reference interval is roughly 60–100 mL per beat.',
    population: 'Resting adults, as tabulated in the cited PAC review.',
    intendedUse: 'Orientation to the usual magnitude of a per-beat flow.',
    notUniversal: 'The interval does not identify the mechanism of an abnormal value.',
    evidenceIds: ['pac-derived-part-2-2021'],
  },
  {
    id: 'svi-adult-reference-interval',
    metricId: 'strokeVolumeIndexMlM2',
    classification: 'reference-interval',
    statement: 'A commonly cited adult reference interval is roughly 33–47 mL/m².',
    population: 'Resting adults, as tabulated in the cited PAC review.',
    intendedUse: 'Orientation to the usual magnitude of an indexed per-beat flow.',
    notUniversal: 'A value inside the interval does not prove adequate perfusion for this patient.',
    evidenceIds: ['pac-derived-part-2-2021'],
  },
  {
    id: 'svr-adult-reference-interval',
    metricId: 'systemicVascularResistance',
    classification: 'reference-interval',
    statement: `A commonly cited adult reference interval is ${thresholds.systemicVascularResistance.referenceMinDynSecCm5.toLocaleString('en-US')}–${thresholds.systemicVascularResistance.referenceMaxDynSecCm5.toLocaleString('en-US')} dyn·s·cm⁻⁵.`,
    population: 'Resting adults, as tabulated in the cited PAC review.',
    intendedUse: 'Orientation to the usual magnitude of systemic resistance.',
    notUniversal:
      'No SVR range labels a patient good or bad on its own; the pressure–flow pattern and the validity of every input decide what the number means.',
    evidenceIds: ['pac-derived-part-2-2021'],
  },
  {
    id: 'svri-no-bedside-boundary',
    metricId: 'systemicVascularResistanceIndex',
    classification: 'reference-interval',
    statement:
      'This module presents no adult reference interval for SVRI. The reference figures verified against a registered source here cover CI, SV, SVI, and SVR; no SVRI interval was verified, so no number is shown.',
    population: 'Not applicable — no interval is presented.',
    intendedUse:
      'Naming the absence of a source-verified interval, so the gap is visible rather than filled.',
    notUniversal:
      'Indexing changes both the units and the numbers, so the verified SVR interval must not be read across as an SVRI interval.',
    evidenceIds: ['pac-derived-part-2-2021'],
  },
  {
    id: 'pvr-esc-ers-definition-component',
    metricId: 'pulmonaryVascularResistance',
    classification: 'diagnostic-definition',
    statement: `A resting PVR above ${ph.elevatedPvrWoodUnits} WU contributes to the pre-capillary definition only together with mPAP above ${ph.meanPapMmHg} mmHg and PAWP at or below ${ph.preCapillaryPawpMaxMmHg} mmHg.`,
    population: 'The 2022 ESC/ERS hemodynamic definition of pulmonary hypertension.',
    intendedUse: 'Diagnostic classification at right heart catheterization.',
    notUniversal:
      'A diagnostic definition is not a treatment target, and the guideline itself notes uncertainty about treatment evidence just above the boundary.',
    evidenceIds: ['esc-ers-ph-2022'],
  },
  {
    id: 'pvri-no-bedside-boundary',
    metricId: 'pulmonaryVascularResistanceIndex',
    classification: 'reference-interval',
    statement:
      'No single adult bedside classification boundary is stated for indexed PVR in this module.',
    population: 'Adult bedside practice; the registered sources state no boundary here.',
    intendedUse: 'Interpretation together with PVR, body size, and phenotype.',
    notUniversal: 'Indexing does not create a boundary the sources do not carry.',
    evidenceIds: ['esc-ers-ph-2022', 'pac-derived-part-2-2021'],
  },
  {
    id: 'cpo-acute-cardiac-cohort-cut-point',
    metricId: 'cardiacPowerOutputW',
    classification: 'cohort-risk-association',
    statement: `A cut point of ${cpo.originalCohortWatts} W identified a high-mortality group in the original acute-cardiac cohort.`,
    population: 'An observational acute cardiac disease and cardiogenic shock cohort.',
    intendedUse: 'Mortality risk association in that cohort.',
    notUniversal:
      'A cohort association is not a universal trigger for mechanical support and does not replace the full shock phenotype or serial response.',
    evidenceIds: ['cpo-acute-cardiac-2007'],
  },
  {
    id: 'cpo-teaching-band',
    metricId: 'cardiacPowerOutputW',
    classification: 'cohort-risk-association',
    statement: `Values near or below ${cpo.highRiskTeachingWatts} W are discussed as a high-risk low-power state in shock cohorts.`,
    population: 'Shock cohorts discussed in the cited reviews.',
    intendedUse: 'Teaching band drawn from those cohorts.',
    notUniversal: 'A teaching band is not a threshold for action in any individual patient.',
    evidenceIds: ['cpo-acute-cardiac-2007', 'pac-derived-part-2-2021'],
  },
  {
    id: 'papi-acute-rv-infarction-cut-point',
    metricId: 'pulmonaryArteryPulsatilityIndex',
    classification: 'phenotype-specific-cutoff',
    statement: `PAPi at or below ${papi.acuteRvInfarctionHighRiskMax} identified severe RV dysfunction in acute inferior myocardial infarction.`,
    population: 'A small acute inferior-MI cohort with suspected RV involvement.',
    intendedUse: 'Identifying severe RV dysfunction in that presentation.',
    notUniversal:
      'A PAPi boundary varies widely between studied populations and must not be extrapolated from one phenotype to another; this is not a universal definition of RV failure.',
    evidenceIds: ['papi-rvmi-2012', 'pac-derived-part-2-2021'],
  },
  {
    id: 'papi-advanced-hf-teaching-band',
    metricId: 'pulmonaryArteryPulsatilityIndex',
    classification: 'phenotype-specific-cutoff',
    statement: `A PAPi below ${papi.advancedHeartFailureTeachingMax} was the receiver-operating-characteristic cut point for right ventricular failure after implantation in a 132-patient continuous-flow LVAD cohort.`,
    population:
      'Recipients of a durable continuous-flow left ventricular assist device in a single-center cohort of 132 patients.',
    intendedUse:
      "Preoperative identification of patients who went on to develop postoperative right ventricular failure under that study's definition.",
    notUniversal:
      'This is a surgical-cohort cut point for one postoperative outcome, not a general advanced-heart-failure threshold, not a universal RV-failure definition, and not a treatment target.',
    evidenceIds: ['papi-lvad-rvf-2016'],
  },
  {
    id: 'pa-compliance-cohort-distribution',
    metricId: 'pulmonaryArteryCompliance',
    classification: 'cohort-risk-association',
    statement: `A broad right-heart-catheterization cohort had a median of ${thresholds.pulmonaryArteryCompliance.cohortMedianMlMmHg} mL/mmHg with an interquartile range of ${thresholds.pulmonaryArteryCompliance.cohortIqrLowMlMmHg}–${thresholds.pulmonaryArteryCompliance.cohortIqrHighMlMmHg}, with lower compliance associated with adverse events.`,
    population: 'A single-center right-heart-catheterization cohort.',
    intendedUse: 'Describing that cohort’s distribution and its outcome association.',
    notUniversal:
      'A cohort median and interquartile range describe that population; they are not a universal normal interval or a target.',
    evidenceIds: ['pa-compliance-outcomes-2026'],
  },
  {
    id: 'ppv-conditional-cohort-threshold',
    metricId: 'pulsePressureVariationPercent',
    classification: 'cohort-risk-association',
    statement: `A variation near ${thresholds.pulsePressureVariation.responsivePercent} in every 100 predicted fluid responsiveness in the original selected, controlled-ventilation septic cohort.`,
    population:
      'Sedated, mechanically ventilated septic patients without spontaneous effort or arrhythmia.',
    intendedUse: 'Predicting fluid responsiveness inside those validated conditions.',
    notUniversal:
      'Outside the validated conditions the number has no interpretable meaning, and inside them it predicts responsiveness — not volume status and not a mandate to give fluid.',
    evidenceIds: ['ppv-sepsis-2000'],
  },
])

export const derivedThresholdContextById: ReadonlyMap<string, DerivedThresholdContext> = new Map(
  derivedThresholdContexts.map((context) => [context.id, context]),
)

export function requireDerivedThresholdContext(id: string): DerivedThresholdContext {
  const context = derivedThresholdContextById.get(id)
  if (!context) throw new Error(`Unknown derived threshold context: ${id}`)
  return context
}

export function derivedThresholdContextsForMetric(
  metricId: DerivedMetricId,
): readonly DerivedThresholdContext[] {
  return derivedThresholdContexts.filter((context) => context.metricId === metricId)
}

/* ------------------------------------------------------------------ *
 * Text equivalents and copy
 * ------------------------------------------------------------------ */

/** The complete text equivalent of a metric card, assembled from the same record it renders. */
export function derivedMetricTextEquivalent(metric: DerivedMetricRecord): string {
  const dependencies = metric.dependencies
    .map((dependency) => {
      const input = requireDerivedInputDefinition(dependency.inputId)
      return `${input.label}, in ${input.unit}, as ${dependency.role}${
        input.requiredConvention
          ? `, obtained as ${input.requiredConvention.replaceAll('-', ' ')}`
          : ''
      }. ${input.whatItIs}`
    })
    .join(' ')
  const contexts = metric.thresholdContextIds
    .map((id) => {
      const context = requireDerivedThresholdContext(id)
      return `${derivedThresholdClassificationLabels[context.classification]}: ${context.statement} Applies to: ${context.population} ${context.notUniversal}`
    })
    .join(' ')
  return [
    `${metric.name} (${metric.shortLabel}) — a calculated value, not a measurement.`,
    `Formula: ${metric.formulaText}, reported in ${metric.outputUnit || 'a dimensionless ratio'}.`,
    `Inputs: ${dependencies}`,
    `Units: ${metric.unitAccount.join(' ')}`,
    `Arithmetic requirements: ${metric.mathematicalDomain}`,
    metric.requiresFlowMethod
      ? 'The result inherits the cardiac-output method that produced its flow input.'
      : 'The result does not require a cardiac output.',
    metric.requiresBodySurfaceArea
      ? 'The result requires a body surface area with known provenance.'
      : '',
    `Sensitivity: ${metric.sensitivityAccount}`,
    `Interpretation: ${metric.interpretation}`,
    `It does not establish: ${metric.cannotEstablish}`,
    `Withhold when: ${metric.invalidWhen.join(' ')}`,
    contexts.length > 0 ? `Context-specific boundaries: ${contexts}` : '',
  ]
    .filter((part) => part.trim().length > 0)
    .join(' ')
}

/** Every learner-visible string the derived-metric model can put on screen. Used by copy checks. */
export function derivedMetricCopy(metric: DerivedMetricRecord): readonly string[] {
  return [
    metric.name,
    metric.formulaText,
    metric.mathematicalDomain,
    ...metric.unitAccount,
    metric.sensitivityAccount,
    metric.interpretation,
    metric.cannotEstablish,
    ...metric.invalidWhen,
    ...metric.sourceLimitations,
    ...metric.thresholdContextIds.flatMap((id) => {
      const context = requireDerivedThresholdContext(id)
      return [context.statement, context.population, context.intendedUse, context.notUniversal]
    }),
  ]
}

/* ------------------------------------------------------------------ *
 * Import-time validation
 * ------------------------------------------------------------------ */

export function validateDerivedMetrics(
  metrics: readonly DerivedMetricRecord[] = derivedMetricRecords,
  contexts: readonly DerivedThresholdContext[] = derivedThresholdContexts,
): void {
  const seen = new Set<string>()
  const contextIds = new Set(contexts.map((context) => context.id))

  for (const context of contexts) {
    if (context.classification === 'treatment-target') {
      throw new Error(
        `${context.id}: no derived-hemodynamics boundary may be classified as a treatment target.`,
      )
    }
    if (context.classification === 'unsupported') {
      throw new Error(`${context.id}: an unsupported boundary must not be authored for display.`)
    }
    if (context.notUniversal.trim().length < 20) {
      throw new Error(`${context.id} does not say where its boundary must not travel.`)
    }
    if (context.population.trim().length < 10 || context.intendedUse.trim().length < 10) {
      throw new Error(`${context.id} is missing its population or intended use.`)
    }
    for (const evidenceId of context.evidenceIds) {
      if (!hemodynamicsSourceById.has(evidenceId)) {
        throw new Error(`${context.id} cites unregistered evidence: ${evidenceId}`)
      }
    }
    if (!metrics.some((metric) => metric.id === context.metricId)) {
      throw new Error(`${context.id} names an unknown metric: ${context.metricId}`)
    }
  }

  for (const metric of metrics) {
    if (seen.has(metric.id)) throw new Error(`Duplicate derived metric: ${metric.id}`)
    seen.add(metric.id)

    if (metric.dependencies.length === 0) {
      throw new Error(`${metric.id} has no dependencies, which cannot be right for an equation.`)
    }
    for (const dependency of metric.dependencies) {
      const input = derivedInputDefinitionById.get(dependency.inputId)
      if (!input) throw new Error(`${metric.id} depends on an unknown input: ${dependency.inputId}`)
      if (dependency.acceptableProvenance.length === 0) {
        throw new Error(`${metric.id}/${dependency.inputId} accepts no provenance at all.`)
      }
      for (const provenance of dependency.acceptableProvenance) {
        if (!cardiacOutputInputStatuses.includes(provenance)) {
          throw new Error(
            `${metric.id}/${dependency.inputId} names an unknown provenance label: ${provenance}`,
          )
        }
      }
      if (input.isCalculated && !dependency.acceptableProvenance.includes('calculated')) {
        throw new Error(
          `${metric.id}/${dependency.inputId}: a calculated input must be acceptable as calculated.`,
        )
      }
      /**
       * A calculated quantity may never be described as measured. This is the H5 analogue of H4's
       * direct-Fick naming rule: the label is enforced against the structural field.
       */
      if (input.isCalculated && dependency.acceptableProvenance.includes('measured')) {
        throw new Error(
          `${metric.id}/${dependency.inputId}: ${input.label} is an equation over other values and must not be labeled measured.`,
        )
      }
      /**
       * A pressure is transduced from a waveform, never drawn as a specimen. H4 reserves `sampled`
       * for a specimen taken from a named site at a named time; letting a pressure claim it would
       * blur the one provenance distinction the oxygen-based Fick inputs depend on.
       */
      if (input.isPressureReading && dependency.acceptableProvenance.includes('sampled')) {
        throw new Error(
          `${metric.id}/${dependency.inputId}: ${input.label} is read from a pressure waveform and must not accept sampled, which names a specimen.`,
        )
      }
    }

    const flowDependent = metric.dependencies.some(
      (dependency) =>
        dependency.inputId === 'cardiacOutputLMin' || dependency.inputId === 'strokeVolumeMl',
    )
    if (flowDependent !== metric.requiresFlowMethod) {
      throw new Error(`${metric.id}: requiresFlowMethod disagrees with its own dependency list.`)
    }
    const bsaDependent = metric.dependencies.some(
      (dependency) => dependency.inputId === 'bodySurfaceAreaM2',
    )
    if (bsaDependent !== metric.requiresBodySurfaceArea) {
      throw new Error(
        `${metric.id}: requiresBodySurfaceArea disagrees with its own dependency list.`,
      )
    }

    const dependencyIds = new Set(metric.dependencies.map((dependency) => dependency.inputId))
    for (const gradient of metric.gradients) {
      if (
        !dependencyIds.has(gradient.minuendInputId) ||
        !dependencyIds.has(gradient.subtrahendInputId)
      ) {
        throw new Error(`${metric.id}: gradient "${gradient.label}" uses a non-dependency input.`)
      }
    }
    for (const positiveId of metric.requiredPositiveInputIds) {
      if (!dependencyIds.has(positiveId)) {
        throw new Error(`${metric.id}: required-positive input ${positiveId} is not a dependency.`)
      }
    }

    if (metric.unitAccount.length === 0) throw new Error(`${metric.id} has no unit account.`)
    if (metric.mathematicalDomain.trim().length < 30) {
      throw new Error(`${metric.id} does not state its mathematical domain.`)
    }
    if (metric.sensitivityAccount.trim().length < 40) {
      throw new Error(`${metric.id} does not explain its sensitivity.`)
    }
    if (metric.cannotEstablish.trim().length < 20) {
      throw new Error(`${metric.id} does not say what it cannot establish.`)
    }
    if (metric.invalidWhen.length === 0) {
      throw new Error(`${metric.id} silently omits its invalidity conditions.`)
    }
    if (metric.thresholdContextIds.length === 0) {
      throw new Error(
        `${metric.id} displays no context record, so any number beside it would be unclassified.`,
      )
    }
    for (const contextId of metric.thresholdContextIds) {
      if (!contextIds.has(contextId)) {
        throw new Error(`${metric.id} names an unknown threshold context: ${contextId}`)
      }
    }
    for (const evidenceId of metric.evidenceIds) {
      if (!hemodynamicsSourceById.has(evidenceId)) {
        throw new Error(`${metric.id} cites unregistered evidence: ${evidenceId}`)
      }
    }
  }
}

validateDerivedMetrics()
