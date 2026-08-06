/**
 * Filling-pressure congestion patterns, from a named source rather than from an invented rule.
 *
 * What this replaced was a two-pressure classifier with an unsourced ratio in it — right-dominant at
 * a right-atrial-to-wedge ratio of 0.85 or more, left-dominant at 0.60 or less, wedge 20 or more for
 * left-sided congestion. None of those numbers came from anywhere. A learner reading a confident
 * label produced by arithmetic nobody published is worse off than a learner reading two pressures.
 *
 * The framework here is the ACC 2025 Concise Clinical Guidance description of the congestion profile
 * in cardiogenic shock. The source is prose, not a decision table: it describes LV-dominant
 * congestion as often characterized by a wedge or LV end-diastolic pressure above 15 mm Hg,
 * RV-dominant congestion as an elevated right atrial or central venous pressure above 15 mm Hg with
 * a relatively normal wedge, and a biventricular profile as elevation of both. Turning that prose
 * into the four-cell grid below is an *educational operationalization*, and every surface that shows
 * it says so — the ACC published a description, not this software.
 *
 * Two boundaries are deliberate:
 *
 *  - The comparison is strictly greater than 15. At exactly 15 mm Hg a pressure is not above the
 *    threshold the source describes, and rounding it upward would invent a category membership.
 *  - The fourth cell is "neither filling pressure is elevated by this framework" and is never called
 *    euvolemic. Ortega-Hernández used "euvolemic" as the label for the quadrant below *their* cut
 *    points; it is a study label for a quadrant, not a finding about total-body volume, and the two
 *    must not be conflated.
 *
 * Nothing here selects a device. A congestion pattern says where filling pressures are elevated. It
 * does not name the cause of shock, prove isolated ventricular failure, measure organ perfusion, or
 * indicate a support pathway.
 */

import {
  MCS_ACC_CONSENSUS_SOURCE_ID,
  MCS_GARAN_COMPLETE_PROFILE_SOURCE_ID,
  MCS_ORTEGA_COHORT_SOURCE_ID,
} from './congestionEvidence'

export type McsCongestionProfileId =
  | 'rv-predominant'
  | 'lv-predominant'
  | 'biventricular'
  | 'neither-elevated'

export interface McsCongestionFramework {
  readonly id: string
  readonly label: string
  readonly thresholdSummary: string
  /** Said wherever the grid is rendered: the source described a pattern, not this software. */
  readonly operationalizationNote: string
  readonly sourceIds: readonly string[]
}

/**
 * The framework the learner-facing classification uses.
 *
 * The ACC description is the primary framework because this module addresses cardiogenic shock
 * broadly, and the alternative cut points available to it come from a single-center AMI-CS cohort.
 */
export const MCS_ACC_CONGESTION_FRAMEWORK: McsCongestionFramework = Object.freeze({
  id: 'acc-2025-congestion-profile',
  label: 'ACC consensus–described filling-pressure congestion pattern',
  thresholdSummary:
    'Right atrial or central venous pressure above 15 mm Hg, and wedge or LV end-diastolic pressure above 15 mm Hg.',
  operationalizationNote:
    'An educational operationalization of the ACC consensus description of filling-pressure congestion patterns. The consensus statement describes these patterns in prose; it did not publish or validate this software grid.',
  sourceIds: [MCS_ACC_CONSENSUS_SOURCE_ID],
})

/**
 * The cohort definition shown beside the primary framework, never merged with it.
 *
 * Kept as a separate record on purpose. Its cut points are 12 and 18 mm Hg, the ACC description uses
 * 15, and there is no honest way to reconcile them into one number — so the module shows both and
 * says which is which.
 */
export const MCS_ORTEGA_CONGESTION_FRAMEWORK: McsCongestionFramework = Object.freeze({
  id: 'ortega-2023-ami-cs-congestion',
  label: 'Ortega-Hernández AMI-CS cohort operational definition',
  thresholdSummary:
    'Right atrial pressure at or above 12 mm Hg, and pulmonary capillary wedge pressure at or above 18 mm Hg.',
  operationalizationNote:
    'The cut points this single-center retrospective AMI-CS cohort used to sort its own patients into four profiles, reassessed serially over the first 24 hours. Cohort-specific; not a universal threshold and not a treatment target.',
  sourceIds: [MCS_ORTEGA_COHORT_SOURCE_ID],
})

export interface McsCongestionProfileDefinition {
  readonly id: McsCongestionProfileId
  /** What the learner reads. Never a diagnosis, never a device. */
  readonly label: string
  readonly statement: string
  /** The label the Ortega cohort used for the same quadrant, where it differs. */
  readonly cohortLabel: string
}

const definitions: Readonly<Record<McsCongestionProfileId, McsCongestionProfileDefinition>> =
  Object.freeze({
    'rv-predominant': {
      id: 'rv-predominant',
      label: 'RV-predominant filling-pressure congestion pattern',
      statement:
        'The right atrial pressure is above the threshold the consensus statement describes while the wedge pressure is not.',
      cohortLabel: 'right-ventricular (RV) profile',
    },
    'lv-predominant': {
      id: 'lv-predominant',
      label: 'LV-predominant filling-pressure congestion pattern',
      statement:
        'The wedge pressure is above the threshold the consensus statement describes while the right atrial pressure is not.',
      cohortLabel: 'left-ventricular (LV) profile',
    },
    biventricular: {
      id: 'biventricular',
      label: 'Biventricular filling-pressure congestion pattern',
      statement:
        'Both filling pressures are above the threshold the consensus statement describes.',
      cohortLabel: 'biventricular (BiV) profile',
    },
    'neither-elevated': {
      id: 'neither-elevated',
      label: 'Neither filling pressure is elevated by this framework',
      statement:
        'Neither pressure is above the threshold the consensus statement describes. This does not establish true euvolemia, adequate preload, adequate forward flow, or adequate organ perfusion.',
      cohortLabel: 'the quadrant the cohort labeled “euvolemic”',
    },
  })

export function mcsCongestionProfileDefinition(
  id: McsCongestionProfileId,
): McsCongestionProfileDefinition {
  return definitions[id]
}

export const mcsCongestionProfileDefinitions: readonly McsCongestionProfileDefinition[] =
  Object.freeze(Object.values(definitions))

/** The threshold the ACC description states, in mm Hg. Strictly greater than, never at. */
export const MCS_ACC_CONGESTION_THRESHOLD_MMHG = 15

/** The cut points the Ortega-Hernández cohort used, kept apart from the framework above. */
export const MCS_ORTEGA_COHORT_CUTOFFS = Object.freeze({
  rapMmHg: 12,
  pcwpMmHg: 18,
})

export function mcsCongestionProfileId(
  rapMmHg: number,
  pcwpMmHg: number,
  thresholdMmHg: number = MCS_ACC_CONGESTION_THRESHOLD_MMHG,
): McsCongestionProfileId {
  const rapElevated = rapMmHg > thresholdMmHg
  const pcwpElevated = pcwpMmHg > thresholdMmHg
  if (rapElevated && pcwpElevated) return 'biventricular'
  if (rapElevated) return 'rv-predominant'
  if (pcwpElevated) return 'lv-predominant'
  return 'neither-elevated'
}

/**
 * What a congestion pattern is for, and what it is not for.
 *
 * Rendered beside every congestion classification in the module, so the boundary travels with the
 * label rather than sitting somewhere a learner has to go and find.
 */
export const MCS_CONGESTION_PATTERN_BOUNDARY = Object.freeze({
  establishes:
    'Where filling pressures are elevated right now, under a named framework, with the threshold and the source visible.',
  doesNotEstablish:
    'This pattern describes where filling pressures are elevated. It does not independently establish the cause of shock, prove isolated ventricular failure, measure organ perfusion, or select a support device.',
  reconcileWith:
    'Reconcile the congestion pattern with cardiac output or effective flow, pulmonary artery pressures, PA saturation when measured, echocardiography, clinical examination, gas-exchange requirements, and trajectory.',
})

/**
 * What Garan et al. counted as a complete invasive profile.
 *
 * Used to say what two filling pressures are *not*: five measured components, with derived values —
 * cardiac index, cardiac power output, PAPi, vascular resistance — noted but explicitly not counted
 * toward completeness, because a derived number cannot stand in for a measurement that was never
 * taken.
 */
export const MCS_COMPLETE_PROFILE_COMPONENTS: readonly string[] = Object.freeze([
  'Right atrial pressure',
  'Pulmonary artery systolic pressure',
  'Pulmonary artery diastolic pressure',
  'Pulmonary capillary wedge pressure',
  'Pulmonary artery oxygen saturation',
])

export const MCS_COMPLETE_PROFILE_BOUNDARY = Object.freeze({
  sourceId: MCS_GARAN_COMPLETE_PROFILE_SOURCE_ID,
  statement:
    'A complete invasive profile in this registry meant all five measured components. Derived values — cardiac index, cardiac power output, pulmonary artery pulsatility index, vascular resistance — were recorded but were not counted toward a complete profile, because a derived number cannot replace a measurement that was never taken.',
  inThisSimulation:
    'This simulation models right atrial, pulmonary artery and wedge pressures. Its mixed venous saturation is a modeled balance signal rather than a measured pulmonary artery saturation, and organ-level perfusion findings are not modeled at all. Two filling pressures are a congestion pattern, not a complete profile.',
})

/**
 * The right-atrial-to-wedge ratio, kept as context and never as a boundary.
 *
 * The ACC statement lists a ratio above 0.6 among hemodynamic parameters associated with adverse
 * mortality in cardiogenic shock — an outcome association, not a phenotype rule. It is not used to
 * classify anything in this module, and it carries no unit, notwithstanding the "mm Hg" the source
 * prints beside it.
 */
export const MCS_RAP_PCWP_RATIO_CONTEXT = Object.freeze({
  label: 'Right atrial to wedge pressure ratio',
  valueType: 'derived arithmetic relationship' as const,
  association:
    'A ratio above 0.6 is listed in the cited cardiogenic-shock consensus statement among parameters associated with adverse mortality, together with a low mean arterial pressure, an elevated right atrial pressure, and a reduced pulmonary artery pulsatility index.',
  doNotInfer:
    'It does not assign a ventricular phenotype, does not define a congestion pattern, does not select a device, and is not a treatment target.',
  sourceIds: [MCS_ACC_CONSENSUS_SOURCE_ID],
})
