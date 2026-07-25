export interface CriticalCareSourcePosition {
  readonly claim: string
  readonly source: string
  readonly locator: string
}

export interface CriticalCareSourceConflict {
  readonly id: string
  readonly title: string
  readonly context: string
  readonly positions: readonly CriticalCareSourcePosition[]
  readonly handling: string
  readonly conceptIds: readonly string[]
  readonly reviewStatus: 'draft' | 'sme-review' | 'released'
}

/**
 * Authored disagreements stay explicit. These records must never be collapsed into an average,
 * silently reconciled, or promoted into a universal treatment target.
 */
export const criticalCareSourceConflicts: readonly CriticalCareSourceConflict[] = Object.freeze([
  {
    id: 'conflict.ecmo.anti-xa-target',
    title: 'ECMO anti-Xa ranges differ across sources',
    context:
      'The supplied ECMO synthesis found no universally endorsed adult anticoagulation target in its source set. Patient context, bleeding and thrombotic risk, the assay, local protocol, and the complete hemostatic picture remain essential.',
    positions: [
      {
        claim: 'Anti-Xa 0.2–0.3 units/mL',
        source: 'ECMO: A Practical Guide to Management',
        locator: 'pages 70 and 161; VV physiology chapter',
      },
      {
        claim: 'Anti-Xa 0.3–0.7 IU/mL',
        source: 'Extracorporeal Membrane Oxygenation for Adults and Extracorporeal Life Support',
        locator: 'adult anticoagulation chapters; pages 169, 35, 75, and 121',
      },
    ],
    handling:
      'Keep both source-stated ranges visible. Do not turn either range into a universal bedside target.',
    conceptIds: ['cc.membrane.resistance-and-aging', 'cc.device.patient-device-coupling'],
    reviewStatus: 'sme-review',
  },
  {
    id: 'conflict.hemodynamics.gef-formula',
    title: 'Global ejection fraction formula conflict',
    context:
      'Two supplied hemodynamic references use formulas that differ by a factor of four. This makes the source convention part of the measurand and prevents an unlabeled value from being interpreted safely.',
    positions: [
      {
        claim: 'GEF = (4 × stroke volume) / global end-diastolic volume',
        source: 'Advanced Hemodynamic Monitoring: Basics and New Horizons',
        locator: 'pages 62, 113, and 121–122',
      },
      {
        claim: 'GEF = stroke volume / global end-diastolic volume',
        source: 'Hemodynamic Monitoring in the ICU',
        locator: 'page 24',
      },
    ],
    handling:
      'Name the device or source convention alongside the displayed value. Do not choose one formula silently.',
    conceptIds: ['cc.measurement.measurand', 'cc.measurement.measured-estimated-inferred'],
    reviewStatus: 'sme-review',
  },
  {
    id: 'conflict.mcs.impella-cp-flow',
    title: 'Impella CP maximum-flow discrepancy',
    context:
      'A single supplied source gives two different maximum-flow statements for the same device. Current manufacturer labeling and the exact device revision remain authoritative.',
    positions: [
      {
        claim: 'Impella CP flow up to 3.8 L/min',
        source: 'Case-Based Device Therapy for Heart Failure',
        locator: 'device table, page 26',
      },
      {
        claim: 'Impella CP flow up to 3.5 L/min',
        source: 'Case-Based Device Therapy for Heart Failure',
        locator: 'narrative, page 27',
      },
    ],
    handling:
      'Retain both printed claims as a documented discrepancy. Do not average them or use either as current labeling.',
    conceptIds: [
      'cc.device.selected-vs-delivered-support',
      'cc.device.preload-afterload-dependence',
    ],
    reviewStatus: 'sme-review',
  },
])

export function sourceConflictsForConcept(
  conceptId: string,
): readonly CriticalCareSourceConflict[] {
  return criticalCareSourceConflicts.filter((conflict) => conflict.conceptIds.includes(conceptId))
}
