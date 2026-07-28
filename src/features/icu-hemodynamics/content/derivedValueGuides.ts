import type { CriticalCareDerivedValueGuide } from '@/features/critical-care/content/derivedValueGuides'
import { mcsDerivedValueGuides } from '@/features/mechanical-circulatory-support/content/derivedValueGuides'

import type { DerivedHemodynamics } from '../engine/types'
import { HEMODYNAMIC_CLINICAL_THRESHOLDS as thresholds } from './clinicalThresholds'

export type HemodynamicDerivedValueId = keyof DerivedHemodynamics

/**
 * NOT YET MIGRATED to the shared context-aware model in
 * `critical-care/content/derivedValueGuides`.
 *
 * `normalRange` and `actionableThresholds` are the field names that migration exists to remove:
 * they cannot say whether a number is a cohort observation, a device specification, or a boundary
 * this simulator invented. MCS has moved; these thirteen hemodynamic guides have not, because
 * re-expressing each one is clinical authoring that must not be done mechanically.
 *
 * The audit harness allowlists this one file by path and reports it as outstanding.
 */
export interface DerivedValueGuide {
  readonly id: HemodynamicDerivedValueId
  readonly label: string
  readonly formula: string
  readonly normalRange: string
  readonly actionableThresholds?: string
  readonly caveats: string
  readonly evidenceIds: readonly string[]
  readonly conceptIds: readonly string[]
}

/**
 * Projects a migrated shared guide back into this module's legacy shape.
 *
 * MCS owns CPO and PAPi and has moved to the shared context-aware model; hemodynamics cross-links
 * to them and has not. Rather than duplicate the clinical content, the shared guide is projected:
 * `interpretation` becomes the legacy `normalRange` prose, the authored interpretation rules are
 * flattened into `actionableThresholds`, and the reference evidence is de-duplicated.
 *
 * Lossy by construction — the reference *kinds* cannot survive the projection, which is exactly
 * why the rest of these guides still need migrating.
 */
function fromSharedGuide(
  id: HemodynamicDerivedValueId,
  guide: CriticalCareDerivedValueGuide,
): DerivedValueGuide {
  const thresholdStatements = (guide.rules ?? [])
    .filter((rule) => rule.interval)
    .map((rule) => rule.statement)
  return {
    id,
    label: guide.label,
    formula: guide.formula ?? '',
    normalRange: guide.interpretation,
    actionableThresholds:
      thresholdStatements.length > 0 ? thresholdStatements.join(' ') : undefined,
    caveats: guide.caveats,
    evidenceIds: [...new Set(guide.references.flatMap((reference) => reference.evidenceIds))],
    conceptIds: guide.conceptIds,
  }
}

export const hemodynamicDerivedValueIds = [
  'cardiacIndexLMinM2',
  'strokeVolumeMl',
  'strokeVolumeIndexMlM2',
  'systemicVascularResistance',
  'systemicVascularResistanceIndex',
  'pulmonaryVascularResistance',
  'pulmonaryVascularResistanceIndex',
  'cardiacPowerOutputW',
  'pulmonaryArteryPulsatilityIndex',
  'pulmonaryArteryCompliance',
  'pulsePressureVariationPercent',
] as const satisfies readonly HemodynamicDerivedValueId[]

export const hemodynamicDerivedValueGuides = {
  cardiacIndexLMinM2: {
    id: 'cardiacIndexLMinM2',
    label: 'CI',
    formula: 'CO / BSA',
    normalRange: 'Approximate resting adult reference: 2.5–4.0 L/min/m².',
    caveats:
      'Indexing reduces body-size effects but does not establish whether organ perfusion is adequate. Interpret the trend with the method used to obtain CO and the whole-patient picture.',
    evidenceIds: ['pac-derived-part-2-2021'],
    conceptIds: ['cc.perfusion.cardiac-output'],
  },
  strokeVolumeMl: {
    id: 'strokeVolumeMl',
    label: 'SV',
    formula: 'CO × 1000 / HR',
    normalRange: 'Common adult reference: approximately 60–100 mL/beat.',
    caveats:
      'The value inherits error from both cardiac output and heart rate and varies with body size, loading, rhythm, and contractility.',
    evidenceIds: ['pac-derived-part-2-2021'],
    conceptIds: ['cc.perfusion.cardiac-output'],
  },
  strokeVolumeIndexMlM2: {
    id: 'strokeVolumeIndexMlM2',
    label: 'SVI',
    formula: 'SV / BSA',
    normalRange: 'Common adult reference: approximately 33–47 mL/beat/m².',
    caveats:
      'A value inside a reference interval does not prove adequate perfusion, and an out-of-range value does not identify the mechanism.',
    evidenceIds: ['pac-derived-part-2-2021'],
    conceptIds: ['cc.perfusion.cardiac-output'],
  },
  systemicVascularResistance: {
    id: 'systemicVascularResistance',
    label: 'SVR',
    formula: '80 × (MAP − RAP) / CO',
    normalRange: `Usual adult reference: approximately ${thresholds.systemicVascularResistance.referenceMinDynSecCm5.toLocaleString()}–${thresholds.systemicVascularResistance.referenceMaxDynSecCm5.toLocaleString()} dyn·s·cm⁻⁵.`,
    caveats:
      'An artifactually low CO inflates SVR. Temperature, vasoactive support, pressure validity, and the pressure-flow pattern determine what the result means.',
    evidenceIds: ['pac-derived-part-2-2021'],
    conceptIds: ['cc.flow.resistance-and-impedance'],
  },
  systemicVascularResistanceIndex: {
    id: 'systemicVascularResistanceIndex',
    label: 'SVRI',
    formula: 'SVR × BSA',
    normalRange:
      'Common adult reference: approximately 1,970–2,390 dyn·s·cm⁻⁵·m²; laboratory and text references vary.',
    caveats:
      'SVRI inherits every limitation of MAP, RAP, CO, and BSA. Use the same validated inputs when following a trend.',
    evidenceIds: ['pac-derived-part-2-2021'],
    conceptIds: ['cc.flow.resistance-and-impedance'],
  },
  pulmonaryVascularResistance: {
    id: 'pulmonaryVascularResistance',
    label: 'PVR',
    formula: '(mPAP − PAWP) / CO',
    normalRange: `A resting PVR at or below ${thresholds.pulmonaryHypertension.elevatedPvrWoodUnits} WU is inside the 2022 ESC/ERS hemodynamic boundary.`,
    actionableThresholds: `PVR greater than ${thresholds.pulmonaryHypertension.elevatedPvrWoodUnits} WU contributes to the pre-capillary definition only when mPAP is greater than ${thresholds.pulmonaryHypertension.meanPapMmHg} mmHg and PAWP is at or below ${thresholds.pulmonaryHypertension.preCapillaryPawpMaxMmHg} mmHg.`,
    caveats:
      'PVR is not a stand-alone diagnosis. PAWP, mPAP, and CO must be valid and obtained in the same physiologic state.',
    evidenceIds: ['esc-ers-ph-2022', 'pac-derived-part-2-2021'],
    conceptIds: ['cc.flow.resistance-and-impedance', 'cc.measurement.signal-validity'],
  },
  pulmonaryVascularResistanceIndex: {
    id: 'pulmonaryVascularResistanceIndex',
    label: 'PVRI',
    formula: 'PVR × BSA',
    normalRange:
      'No single adult bedside classification boundary is used here; interpret indexed resistance with PVR, body size, and the clinical phenotype.',
    caveats:
      'Indexing does not repair an invalid PAWP, mPAP, or CO and should not be substituted for the guideline PVR definition.',
    evidenceIds: ['esc-ers-ph-2022', 'pac-derived-part-2-2021'],
    conceptIds: ['cc.flow.resistance-and-impedance'],
  },
  cardiacPowerOutputW: fromSharedGuide(
    'cardiacPowerOutputW',
    mcsDerivedValueGuides.cardiacPowerOutputW,
  ),
  pulmonaryArteryPulsatilityIndex: fromSharedGuide(
    'pulmonaryArteryPulsatilityIndex',
    mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex,
  ),
  pulmonaryArteryCompliance: {
    id: 'pulmonaryArteryCompliance',
    label: 'PA compliance',
    formula: 'SV / (PASP − PADP)',
    normalRange: `A broad contemporary RHC cohort had a median ${thresholds.pulmonaryArteryCompliance.cohortMedianMlMmHg} mL/mmHg (IQR ${thresholds.pulmonaryArteryCompliance.cohortIqrLowMlMmHg}–${thresholds.pulmonaryArteryCompliance.cohortIqrHighMlMmHg}); this is not a universal normal interval.`,
    caveats:
      'Lower values indicate a stiffer pulmonary circulation, but the result inherits CO and PA pulse-pressure error and is load dependent.',
    evidenceIds: ['pa-compliance-outcomes-2026', 'pac-derived-part-2-2021'],
    conceptIds: ['cc.flow.resistance-and-impedance', 'cc.flow.rv-lv-coupling'],
  },
  pulsePressureVariationPercent: {
    id: 'pulsePressureVariationPercent',
    label: 'PPV',
    formula: '(PPmax − PPmin) / PPmean × 100',
    normalRange:
      'There is no interpretable reference interval when rhythm, ventilation, effort, chest condition, waveform quality, or RV context is invalid.',
    actionableThresholds: `Around or above ${thresholds.pulsePressureVariation.responsivePercent}% predicted fluid responsiveness in the original selected, controlled-ventilation cohort.`,
    caveats:
      'PPV does not diagnose hypovolemia or mandate fluid. Right-ventricular failure can create a false-positive value.',
    evidenceIds: ['ppv-sepsis-2000', 'pac-derived-part-2-2021'],
    conceptIds: ['cc.measurement.signal-validity', 'cc.flow.venous-return'],
  },
} as const satisfies Readonly<Record<HemodynamicDerivedValueId, DerivedValueGuide>>
