export interface CriticalCareSourcePosition {
  readonly claim: string
  readonly source: string
  readonly locator: string
  readonly evidenceIds: readonly string[]
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
 *
 * A record belongs here only when sources genuinely contradict each other about the *same*
 * quantity. Numbers that differ because they measure different things are not a disagreement and
 * live in `measurementClarifications.ts` instead — filing them here would teach that the sources
 * conflict when they do not.
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
        evidenceIds: ['attached-ecmo-case-curriculum'],
      },
      {
        claim: 'Anti-Xa 0.3–0.7 IU/mL',
        source: 'Extracorporeal Membrane Oxygenation for Adults and Extracorporeal Life Support',
        locator: 'adult anticoagulation chapters; pages 169, 35, 75, and 121',
        evidenceIds: ['attached-ecmo-case-curriculum'],
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
        evidenceIds: ['master-hemodynamics-reference'],
      },
      {
        claim: 'GEF = stroke volume / global end-diastolic volume',
        source: 'Hemodynamic Monitoring in the ICU',
        locator: 'page 24',
        evidenceIds: ['master-hemodynamics-reference'],
      },
    ],
    handling:
      'Name the device or source convention alongside the displayed value. Do not choose one formula silently.',
    conceptIds: ['cc.measurement.measurand', 'cc.measurement.measured-estimated-inferred'],
    reviewStatus: 'sme-review',
  },
  {
    id: 'conflict.mcs.impella-cp-textbook-flow',
    title: 'A textbook states two different Impella CP flows',
    context:
      'A single supplied textbook gives two different maximum-flow statements for the same device, in its table and in its narrative. This is an internal inconsistency in that source, not a disagreement between the textbook and the manufacturer — the manufacturer figures name different measurands and are handled as a measurement clarification rather than as competing positions.',
    positions: [
      {
        claim: 'Impella CP flow up to 3.8 L/min',
        source: 'Case-Based Device Therapy for Heart Failure',
        locator: 'device table, page 26',
        evidenceIds: ['case-based-device-therapy-hf'],
      },
      {
        claim: 'Impella CP flow up to 3.5 L/min',
        source: 'Case-Based Device Therapy for Heart Failure',
        locator: 'narrative, page 27',
        evidenceIds: ['case-based-device-therapy-hf'],
      },
    ],
    handling:
      'Retain both textbook claims as a documented source inconsistency. Do not average them, and do not use either as the current device specification — take device specifications from current device-revision labeling.',
    conceptIds: [
      'cc.device.selected-vs-delivered-support',
      'cc.device.preload-afterload-dependence',
    ],
    reviewStatus: 'sme-review',
  },
])

export const criticalCareSourceConflictById: ReadonlyMap<string, CriticalCareSourceConflict> =
  new Map(criticalCareSourceConflicts.map((conflict) => [conflict.id, conflict]))

export function sourceConflictsForConcept(
  conceptId: string,
): readonly CriticalCareSourceConflict[] {
  return criticalCareSourceConflicts.filter((conflict) => conflict.conceptIds.includes(conceptId))
}

export function validateCriticalCareSourceConflicts(
  conflicts: readonly CriticalCareSourceConflict[],
): readonly string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const conflict of conflicts) {
    if (seen.has(conflict.id)) errors.push(`duplicate conflict id: ${conflict.id}`)
    seen.add(conflict.id)
    if (conflict.positions.length < 2) {
      errors.push(`${conflict.id}: a disagreement needs at least two positions`)
    }
    for (const position of conflict.positions) {
      if (position.evidenceIds.length === 0) {
        errors.push(`${conflict.id}: position "${position.claim}" has no evidence ids`)
      }
      if (!position.locator.trim()) {
        errors.push(`${conflict.id}: position "${position.claim}" has no locator`)
      }
    }
  }
  return errors
}

const conflictErrors = validateCriticalCareSourceConflicts(criticalCareSourceConflicts)
if (conflictErrors.length > 0) {
  throw new Error(`Invalid critical-care source conflicts:\n- ${conflictErrors.join('\n- ')}`)
}
