/**
 * Authored measurement episodes for the derived-hemodynamics station.
 *
 * An episode is the unit a derived value is allowed to exist inside: which quantities were obtained
 * together, by what method, under what convention, and whether they still describe one circulatory
 * state. Every episode here is a measurement-validity exercise, not a treatment case — the numbers
 * were chosen so a reviewer can recompute each expected result by hand, and the failures are
 * acquisition failures, never physiology invented to make a formula easier.
 *
 * Sub-episode tags (`measurementEpisodeId`) are how mixing becomes detectable: an input recorded
 * during an earlier vasopressor titration carries a different tag than one recorded now, and the
 * evaluator refuses to combine tags inside one formula.
 */

import type { CardiacOutputMethodId } from './cardiacOutputMethods'
import type { CardiacOutputInputStatus } from './cardiacOutputMethods'
import type { FluidResponsivenessContext } from '../engine/types'
import {
  derivedInputDefinitionById,
  derivedMetricById,
  type DerivedMetricId,
} from './derivedMetrics'
import type { DerivedInputConvention } from './derivedMetrics'
import { hemodynamicsSourceById } from './sources'

export type DerivedEpisodeFlowMethodId = CardiacOutputMethodId | 'method-unknown'

export interface DerivedEpisodeInput {
  readonly inputId: string
  readonly value: number | null
  readonly provenance: CardiacOutputInputStatus
  /** Which acquisition group this value belongs to. Formulas may not mix groups. */
  readonly measurementEpisodeId: string
  readonly convention: DerivedInputConvention | null
  /** Present only when a value was recorded under a different unit than the formulas expect. */
  readonly recordedUnit?: string
  readonly valid: boolean
  /** Why the value is usable or not, in the learner's terms. */
  readonly note: string
}

export interface DerivedEpisodeFlowResult {
  readonly id: string
  readonly methodId: DerivedEpisodeFlowMethodId
  readonly status: 'accepted' | 'withheld'
  readonly valueLMin: number | null
  readonly measurementEpisodeId: string
  readonly acquisitionNote: string
  readonly withheldReasons: readonly string[]
}

export interface DerivedEpisodeSensitivityFocus {
  readonly metricId: DerivedMetricId
  readonly inputId: string
  /** The absolute perturbation applied to the named input, in that input's unit. */
  readonly perturbation: number
  readonly note: string
}

export interface DerivedMeasurementEpisode {
  readonly id: string
  readonly title: string
  readonly presentation: string
  readonly role: 'workbench' | 'transfer-comparison'
  readonly primaryMeasurementEpisodeId: string
  readonly inputs: readonly DerivedEpisodeInput[]
  readonly flowResults: readonly DerivedEpisodeFlowResult[]
  /** How body size reached the record, or why it could not. */
  readonly bodySizeNote: string
  /** Null when no validity screen was performed, which withholds PPV outright. */
  readonly ppvContext: FluidResponsivenessContext | null
  readonly stateNote: string
  readonly shuntPresent: boolean
  readonly sensitivityFocus: DerivedEpisodeSensitivityFocus | null
  readonly evidenceIds: readonly string[]
}

const EPISODE_EVIDENCE = ['pac-derived-part-2-2021', 'icu-hemodynamics-model-v1'] as const

const controlledVentilationContext: FluidResponsivenessContext = {
  controlledMechanicalVentilation: true,
  regularRhythm: true,
  noSpontaneousEffort: true,
  tidalVolumeMlKg: 8,
  closedChest: true,
  validArterialWaveform: true,
  rightVentricularFailure: false,
  intraAbdominalPressureElevated: false,
}

function input(
  inputId: string,
  value: number | null,
  provenance: CardiacOutputInputStatus,
  note: string,
  overrides: Partial<DerivedEpisodeInput> = {},
): DerivedEpisodeInput {
  const definition = derivedInputDefinitionById.get(inputId)
  return {
    inputId,
    value,
    provenance,
    measurementEpisodeId: 'primary',
    convention: definition?.requiredConvention ?? null,
    valid: true,
    note,
    ...overrides,
  }
}

const MEASURED_PRESSURE_NOTE = 'From the leveled, zeroed system validated earlier in this pathway.'
const CHARTED_BSA_NOTE =
  'Calculated by the charting system from an entered height and weight; this module consumes the recorded value with that provenance.'

export const derivedMeasurementEpisodes: readonly DerivedMeasurementEpisode[] = Object.freeze([
  /* ------------------------------------------------------------------ *
   * 1. Complete, internally coherent
   * ------------------------------------------------------------------ */
  {
    id: 'ep-coherent-complete',
    title: 'One coherent episode',
    presentation:
      'An adult after major abdominal surgery, sedated on controlled ventilation, rhythm regular, vasopressor dose unchanged for the last half hour. Every value below was obtained inside the same fifteen minutes.',
    role: 'workbench',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 78, 'measured', 'Monitor rate from a regular rhythm.'),
      input('mapMmHg', 86, 'measured', MEASURED_PRESSURE_NOTE),
      input('rapMmHg', 8, 'measured', MEASURED_PRESSURE_NOTE),
      input('meanPapMmHg', 24, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 38, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 16, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        14,
        'measured',
        'Mean of a brief, technically valid occlusion trace read at end expiration.',
      ),
      input('bodySurfaceAreaM2', 1.9, 'calculated', CHARTED_BSA_NOTE),
      input(
        'pulsePressureMaxMmHg',
        46,
        'measured',
        'Largest pulse pressure across one respiratory cycle.',
      ),
      input(
        'pulsePressureMinMmHg',
        41,
        'measured',
        'Smallest pulse pressure across the same cycle.',
      ),
    ],
    flowResults: [
      {
        id: 'ep1-td',
        methodId: 'thermodilution',
        status: 'accepted',
        valueLMin: 5.2,
        measurementEpisodeId: 'primary',
        acquisitionNote:
          'Three reviewed, technically usable trials under one deliberate technique; the series average is carried forward.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Height and weight were entered on admission and the chart calculated 1.9 m².',
    ppvContext: controlledVentilationContext,
    stateNote: 'No rhythm, ventilation, or vasoactive change across the episode.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE],
  },

  /* ------------------------------------------------------------------ *
   * 2. Invalid PAWP — selective, not global
   * ------------------------------------------------------------------ */
  {
    id: 'ep-invalid-pawp',
    title: 'The wedge did not wedge',
    presentation:
      'An adult with worsening oxygenation. During occlusion the trace never developed atrial morphology and drifted upward; the balloon was deflated promptly and the PA waveform returned. A number was stored anyway.',
    role: 'workbench',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 92, 'measured', 'Monitor rate from a regular rhythm.'),
      input('mapMmHg', 78, 'measured', MEASURED_PRESSURE_NOTE),
      input('rapMmHg', 10, 'measured', MEASURED_PRESSURE_NOTE),
      input('meanPapMmHg', 30, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 44, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 20, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        18,
        'measured',
        'The occlusion trace never showed atrial morphology and drifted upward — an over-wedged, incomplete occlusion. The stored number does not represent left-atrial pressure.',
        { valid: false },
      ),
      input('bodySurfaceAreaM2', 2.05, 'calculated', CHARTED_BSA_NOTE),
    ],
    flowResults: [
      {
        id: 'ep2-td',
        methodId: 'thermodilution',
        status: 'accepted',
        valueLMin: 4.6,
        measurementEpisodeId: 'primary',
        acquisitionNote: 'Three reviewed trials, consistent technique, clean curves.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Charted from entered height and weight.',
    ppvContext: {
      ...controlledVentilationContext,
      noSpontaneousEffort: false,
      controlledMechanicalVentilation: false,
    },
    stateNote: 'Hemodynamics otherwise stable across the episode; spontaneous effort is present.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE],
  },

  /* ------------------------------------------------------------------ *
   * 3. Assumption-limited flow
   * ------------------------------------------------------------------ */
  {
    id: 'ep-assumed-vo2',
    title: 'Every flow number inherits the assumption',
    presentation:
      'The thermistor is broken, so no thermodilution is possible. Paired specimens were drawn correctly from the pulmonary artery and an arterial line — but nobody measured oxygen uptake, and a substituted figure fed the Fick calculation. The rhythm is atrial fibrillation.',
    role: 'workbench',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 96, 'measured', 'Monitor rate averaged over an irregular rhythm.'),
      input('mapMmHg', 72, 'measured', MEASURED_PRESSURE_NOTE),
      input('rapMmHg', 12, 'measured', MEASURED_PRESSURE_NOTE),
      input('meanPapMmHg', 32, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 46, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 22, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        20,
        'measured',
        'Mean of a technically valid occlusion trace at end expiration.',
      ),
      input('bodySurfaceAreaM2', 1.8, 'calculated', CHARTED_BSA_NOTE),
    ],
    flowResults: [
      {
        id: 'ep3-fick-assumed',
        methodId: 'fick-assumed-vo2',
        status: 'accepted',
        valueLMin: 4.0,
        measurementEpisodeId: 'primary',
        acquisitionNote:
          'Specimens paired in time from the sites the equation is written for; the oxygen uptake in the numerator was substituted, not measured, so this flow is an estimate that moves in proportion to that figure.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Charted from entered height and weight.',
    ppvContext: { ...controlledVentilationContext, regularRhythm: false },
    stateNote: 'Stable during sampling; the rhythm is irregular throughout.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE, 'esc-ers-ph-2022'],
  },

  /* ------------------------------------------------------------------ *
   * 4. Two acceptable methods that disagree
   * ------------------------------------------------------------------ */
  {
    id: 'ep-method-disagreement',
    title: 'Two defensible flows, two result sets',
    presentation:
      'An adult with chronic pulmonary vascular disease during a stable, quiet study. A tightly reproducible thermodilution series and a fully measured direct Fick were both acquired well — and they disagree.',
    role: 'workbench',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 84, 'measured', 'Monitor rate from a regular rhythm.'),
      input('mapMmHg', 90, 'measured', MEASURED_PRESSURE_NOTE),
      input('rapMmHg', 9, 'measured', MEASURED_PRESSURE_NOTE),
      input('meanPapMmHg', 34, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 52, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 24, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        12,
        'measured',
        'Mean of a technically valid occlusion trace at end expiration.',
      ),
      input('bodySurfaceAreaM2', 1.95, 'calculated', CHARTED_BSA_NOTE),
    ],
    flowResults: [
      {
        id: 'ep4-td',
        methodId: 'thermodilution',
        status: 'accepted',
        valueLMin: 4.1,
        measurementEpisodeId: 'primary',
        acquisitionNote:
          'Three reviewed trials under one deliberate technique; the traces overlay almost exactly.',
        withheldReasons: [],
      },
      {
        id: 'ep4-fick-direct',
        methodId: 'fick-direct',
        status: 'accepted',
        valueLMin: 5.6,
        measurementEpisodeId: 'primary',
        acquisitionNote:
          'Oxygen uptake measured by expired-gas analysis over the sampling interval; both specimens from the sites the equation is written for.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Charted from entered height and weight.',
    ppvContext: null,
    stateNote: 'Steady state throughout; nothing in either acquisition needs repeating.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE, 'esc-ers-ph-2022'],
  },

  /* ------------------------------------------------------------------ *
   * 5. Two hemodynamic states mixed into one chart row
   * ------------------------------------------------------------------ */
  {
    id: 'ep-mixed-states',
    title: 'Numbers from two different patients — the same patient, twice',
    presentation:
      'The arterial pressures on the flowsheet were recorded forty minutes ago, during active norepinephrine titration. The pulmonary pressures and the thermodilution series are from now, on a stable dose. The chart shows them side by side as if they were one moment.',
    role: 'workbench',
    primaryMeasurementEpisodeId: 'current',
    inputs: [
      input('heartRateBpm', 102, 'measured', 'Current monitor rate.', {
        measurementEpisodeId: 'current',
      }),
      input(
        'mapMmHg',
        65,
        'measured',
        'Recorded forty minutes ago while the norepinephrine dose was actively changing.',
        { measurementEpisodeId: 'earlier-titration' },
      ),
      input(
        'rapMmHg',
        14,
        'measured',
        'Recorded in the same earlier titration window as that MAP.',
        { measurementEpisodeId: 'earlier-titration' },
      ),
      input('meanPapMmHg', 28, 'measured', 'Current, on the stable dose.', {
        measurementEpisodeId: 'current',
      }),
      input('papSystolicMmHg', 42, 'measured', 'Current.', { measurementEpisodeId: 'current' }),
      input('papDiastolicMmHg', 19, 'measured', 'Current.', { measurementEpisodeId: 'current' }),
      input('pawpMeanMmHg', 16, 'measured', 'Current, from a valid end-expiratory occlusion.', {
        measurementEpisodeId: 'current',
      }),
      input('bodySurfaceAreaM2', 2.1, 'calculated', CHARTED_BSA_NOTE, {
        measurementEpisodeId: 'current',
      }),
    ],
    flowResults: [
      {
        id: 'ep5-td',
        methodId: 'thermodilution',
        status: 'accepted',
        valueLMin: 5.9,
        measurementEpisodeId: 'current',
        acquisitionNote: 'Acquired now, on the stable dose, from three reviewed trials.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Charted from entered height and weight.',
    ppvContext: null,
    stateNote:
      'The vasopressor dose changed materially between the two recording windows, so the earlier pressures and the current flow describe different circulatory states.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE],
  },

  /* ------------------------------------------------------------------ *
   * 6. A denominator near zero
   * ------------------------------------------------------------------ */
  {
    id: 'ep-near-zero-denominator',
    title: 'When the denominator is 2 mmHg',
    presentation:
      'An adult after aggressive diuresis. Every measurement is technically valid — and the right atrial pressure is 2 mmHg, which sits in the denominator of PAPi.',
    role: 'workbench',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 88, 'measured', 'Monitor rate from a regular rhythm.'),
      input('mapMmHg', 84, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'rapMmHg',
        2,
        'measured',
        'Technically valid, read at end expiration — and very small, which is exactly the point.',
      ),
      input('meanPapMmHg', 26, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 40, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 18, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        11,
        'measured',
        'Mean of a technically valid occlusion trace at end expiration.',
      ),
      input('bodySurfaceAreaM2', 1.85, 'calculated', CHARTED_BSA_NOTE),
    ],
    flowResults: [
      {
        id: 'ep6-td',
        methodId: 'thermodilution',
        status: 'accepted',
        valueLMin: 5.0,
        measurementEpisodeId: 'primary',
        acquisitionNote: 'Three reviewed trials, consistent technique.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Charted from entered height and weight.',
    ppvContext: null,
    stateNote: 'Stable throughout the episode.',
    shuntPresent: false,
    sensitivityFocus: {
      metricId: 'pulmonaryArteryPulsatilityIndex',
      inputId: 'rapMmHg',
      perturbation: 1,
      note: 'A 1 mmHg error in a 2 mmHg denominator moves PAPi between 7.3 and 22. The same 1 mmHg error at a RAP of 10 would barely move it. The extreme value describes the denominator as much as the right ventricle.',
    },
    evidenceIds: [...EPISODE_EVIDENCE],
  },

  /* ------------------------------------------------------------------ *
   * 7. Missing body size
   * ------------------------------------------------------------------ */
  {
    id: 'ep-missing-bsa',
    title: 'No height, no weight, no index',
    presentation:
      'An emergency admission overnight. The catheter data are technically valid, but no height or weight has been recorded, so the chart has no body surface area.',
    role: 'workbench',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 110, 'measured', 'Monitor rate from a regular rhythm.'),
      input('mapMmHg', 68, 'measured', MEASURED_PRESSURE_NOTE),
      input('rapMmHg', 6, 'measured', MEASURED_PRESSURE_NOTE),
      input('meanPapMmHg', 20, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 30, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 14, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        9,
        'measured',
        'Mean of a technically valid occlusion trace at end expiration.',
      ),
      input(
        'bodySurfaceAreaM2',
        null,
        'entered',
        'No height or weight has been recorded; there is no basis for a body surface area.',
        { valid: false },
      ),
    ],
    flowResults: [
      {
        id: 'ep7-td',
        methodId: 'thermodilution',
        status: 'accepted',
        valueLMin: 6.4,
        measurementEpisodeId: 'primary',
        acquisitionNote: 'Three reviewed trials, consistent technique.',
        withheldReasons: [],
      },
    ],
    bodySizeNote:
      'Missing. Indexed values are withheld rather than calculated from an assumed body size; the non-indexed values remain available.',
    ppvContext: null,
    stateNote: 'Stable during the measurement window.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE],
  },

  /* ------------------------------------------------------------------ *
   * 8. A discordant pressure pair, preserved
   * ------------------------------------------------------------------ */
  {
    id: 'ep-discordant-gradient',
    title: 'A wedge above the mean PA pressure',
    presentation:
      'After cardiac surgery, the stored mean PAWP is 26 mmHg and the mean PA pressure is 24 mmHg. Each number looks plausible on its own. Together they claim blood flows backward across the lungs.',
    role: 'workbench',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 95, 'measured', 'Monitor rate from a paced rhythm.'),
      input('mapMmHg', 82, 'measured', MEASURED_PRESSURE_NOTE),
      input('rapMmHg', 12, 'measured', MEASURED_PRESSURE_NOTE),
      input('meanPapMmHg', 24, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 36, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 18, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        26,
        'measured',
        'Stored from a trace that individually cleared its checks — and sits above the mean PA pressure, which the circulation cannot produce. These two measurements cannot both be right.',
      ),
      input('bodySurfaceAreaM2', 2.0, 'calculated', CHARTED_BSA_NOTE),
    ],
    flowResults: [
      {
        id: 'ep8-td',
        methodId: 'thermodilution',
        status: 'accepted',
        valueLMin: 4.8,
        measurementEpisodeId: 'primary',
        acquisitionNote: 'Three reviewed trials, consistent technique.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Charted from entered height and weight.',
    ppvContext: null,
    stateNote:
      'Stable during the window. The conflict is between the two pulmonary pressures, and it is preserved rather than repaired: no input is edited to make the equation look plausible.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE],
  },

  /* ------------------------------------------------------------------ *
   * Transfer pair
   * ------------------------------------------------------------------ */
  {
    id: 'ep-transfer-plausible',
    title: 'Plausible numbers, unknown provenance',
    presentation:
      'A transfer arrives with a flowsheet: cardiac output 5.5 L/min, pressures all in ordinary ranges. Nothing on the sheet says how the flow was obtained — no method, no trial record, no oxygen-uptake note.',
    role: 'transfer-comparison',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 86, 'measured', 'Current monitor rate, regular rhythm.'),
      input('mapMmHg', 80, 'measured', MEASURED_PRESSURE_NOTE),
      input('rapMmHg', 7, 'measured', MEASURED_PRESSURE_NOTE),
      input('meanPapMmHg', 23, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 34, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 17, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        13,
        'measured',
        'Mean of a technically valid occlusion trace at end expiration.',
      ),
      input('bodySurfaceAreaM2', 1.9, 'calculated', CHARTED_BSA_NOTE),
    ],
    flowResults: [
      {
        id: 'tr1-unknown',
        methodId: 'method-unknown',
        status: 'accepted',
        valueLMin: 5.5,
        measurementEpisodeId: 'primary',
        acquisitionNote:
          'A number on a transfer sheet. No acquisition method, trial record, or assumption note travels with it.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Charted from entered height and weight.',
    ppvContext: null,
    stateNote: 'Currently stable. The provenance gap is in the record, not the patient.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE],
  },
  {
    id: 'ep-transfer-coherent',
    title: 'A surprising number from a clean acquisition',
    presentation:
      'Early distributive shock: warm, tachycardic, bounding pulses. A fresh thermodilution series of three reviewed trials under one technique gives 9.6 L/min, and every pressure is valid and current. The calculated SVR comes out far below anything on the reference card.',
    role: 'transfer-comparison',
    primaryMeasurementEpisodeId: 'primary',
    inputs: [
      input('heartRateBpm', 118, 'measured', 'Monitor rate from a regular tachycardia.'),
      input('mapMmHg', 62, 'measured', MEASURED_PRESSURE_NOTE),
      input('rapMmHg', 4, 'measured', MEASURED_PRESSURE_NOTE),
      input('meanPapMmHg', 19, 'measured', MEASURED_PRESSURE_NOTE),
      input('papSystolicMmHg', 29, 'measured', MEASURED_PRESSURE_NOTE),
      input('papDiastolicMmHg', 13, 'measured', MEASURED_PRESSURE_NOTE),
      input(
        'pawpMeanMmHg',
        8,
        'measured',
        'Mean of a technically valid occlusion trace at end expiration.',
      ),
      input('bodySurfaceAreaM2', 2.2, 'calculated', CHARTED_BSA_NOTE),
    ],
    flowResults: [
      {
        id: 'tr2-td',
        methodId: 'thermodilution',
        status: 'accepted',
        valueLMin: 9.6,
        measurementEpisodeId: 'primary',
        acquisitionNote:
          'Three reviewed, technically usable trials under one deliberate technique, acquired within this episode.',
        withheldReasons: [],
      },
    ],
    bodySizeNote: 'Charted from entered height and weight.',
    ppvContext: null,
    stateNote: 'One coherent episode. The number is unexpected; the acquisition is not.',
    shuntPresent: false,
    sensitivityFocus: null,
    evidenceIds: [...EPISODE_EVIDENCE],
  },
])

export const derivedMeasurementEpisodeById: ReadonlyMap<string, DerivedMeasurementEpisode> =
  new Map(derivedMeasurementEpisodes.map((episode) => [episode.id, episode]))

export function requireDerivedMeasurementEpisode(id: string): DerivedMeasurementEpisode {
  const episode = derivedMeasurementEpisodeById.get(id)
  if (!episode) throw new Error(`Unknown derived measurement episode: ${id}`)
  return episode
}

export const derivedWorkbenchEpisodes: readonly DerivedMeasurementEpisode[] =
  derivedMeasurementEpisodes.filter((episode) => episode.role === 'workbench')

/* ------------------------------------------------------------------ *
 * Authored decisions — the commitments the station grades
 * ------------------------------------------------------------------ */

export type DerivedDecisionVerdict = 'defensible' | 'not-defensible' | 'averages-methods'

export interface DerivedDecisionOption {
  readonly id: string
  readonly label: string
  readonly verdict: DerivedDecisionVerdict
  readonly why: string
}

/** The method-disagreement commitment on episode 4. Averaging is offered so it can be declined. */
export const derivedMethodDisagreementDecision = Object.freeze({
  episodeId: 'ep-method-disagreement',
  prompt:
    'Thermodilution gives 4.1 L/min and direct Fick gives 5.6 L/min, and both acquisitions are technically acceptable. PVR calculates to 5.4 WU with one flow and 3.9 WU with the other. What happens to the derived values?',
  options: [
    {
      id: 'two-method-labeled-sets',
      label:
        'Keep two method-labeled result sets, report the disagreement, and carry one method forward consistently for the trend.',
      verdict: 'defensible',
      why: 'Each derived set is an equation over one method’s flow. Preserving both keeps the disagreement — the most informative thing in this episode — visible to whoever reads the record next.',
    },
    {
      id: 'average-the-flows',
      label: 'Average the two flows to 4.85 L/min and derive one tidy set of values from that.',
      verdict: 'averages-methods',
      why: 'The midpoint of an indicator-dilution estimate and an oxygen-balance estimate belongs to neither measurement system, and every derived value computed from it inherits that fiction.',
    },
    {
      id: 'pick-expected-set',
      label: 'Report whichever result set fits the clinical impression better.',
      verdict: 'not-defensible',
      why: 'That selects a measurement by expectation and erases the disagreement from the record.',
    },
    {
      id: 'withhold-both-sets',
      label: 'Withhold every derived value until the two methods agree.',
      verdict: 'not-defensible',
      why: 'Neither acquisition shows a technical problem, and repeating until two different measurement systems agree is selection by agreement. Both sets are reportable with their methods named.',
    },
  ] as readonly DerivedDecisionOption[],
  defensibleOptionId: 'two-method-labeled-sets',
})

/** The transfer comparison: a plausible set with no provenance against a surprising coherent one. */
export const derivedTransferComparisonDecision = Object.freeze({
  plausibleEpisodeId: 'ep-transfer-plausible',
  coherentEpisodeId: 'ep-transfer-coherent',
  prompt:
    'Two episodes are on the desk. One produces derived values that all look ordinary, but its cardiac output arrived with no acquisition method. The other produces an SVR far below the reference card, from a fully coherent episode with a named method. Which position is defensible?',
  options: [
    {
      id: 'report-coherent-withhold-plausible',
      label:
        'Report the coherent episode’s values with their method named — including the surprising SVR — and withhold the flow-dependent values built on the method-unknown cardiac output.',
      verdict: 'defensible',
      why: 'Validity comes from the acquisition, not from how ordinary the result looks. A surprising number from a coherent episode is information; a plausible number with unknown provenance is not yet a measurement.',
    },
    {
      id: 'report-plausible-because-normal',
      label: 'Report the first episode’s values, because every one of them is in a normal range.',
      verdict: 'not-defensible',
      why: 'Plausibility is not provenance. Choosing the set whose numbers look expected is selection by expectation — the exact failure this station exists to catch.',
    },
    {
      id: 'blend-the-two',
      label: 'Blend the two episodes, taking whichever value looks more reliable from each.',
      verdict: 'averages-methods',
      why: 'Mixing values across episodes and methods produces a chart row that describes no single circulatory state and hides which acquisition was the problem.',
    },
    {
      id: 'withhold-everything',
      label: 'Withhold both episodes until the surprising SVR is repeated.',
      verdict: 'not-defensible',
      why: 'The coherent episode shows no technical problem. Refusing a valid measurement because it surprises you is selection by expectation in reverse.',
    },
  ] as readonly DerivedDecisionOption[],
  defensibleOptionId: 'report-coherent-withhold-plausible',
})

/** The threshold-context commitment on episode 1: a phenotype boundary stays in its phenotype. */
export const derivedThresholdContextDecision = Object.freeze({
  episodeId: 'ep-coherent-complete',
  thresholdContextId: 'papi-acute-rv-infarction-cut-point',
  prompt:
    'In this postoperative episode PAPi calculates to 2.75. A widely quoted cut point of 0.9 identified severe RV dysfunction in acute inferior myocardial infarction. How may that boundary be used here?',
  options: [
    {
      id: 'phenotype-bounded',
      label:
        'As a cohort finding from acute inferior MI — it does not transfer to this postoperative patient as a universal definition, and 2.75 does not rule RV dysfunction in or out.',
      verdict: 'defensible',
      why: 'A PAPi boundary varies widely between studied populations, and the cited review states directly that a threshold from one population should not be extrapolated to another.',
    },
    {
      id: 'universal-definition',
      label: 'As a universal rule: any PAPi below 0.9 defines RV failure in any patient.',
      verdict: 'not-defensible',
      why: 'The 0.9 figure comes from one small phenotype-specific cohort. Universalizing it discards the population the number was derived in.',
    },
    {
      id: 'treatment-trigger',
      label: 'As a treatment trigger: below 0.9, mechanical support is indicated.',
      verdict: 'not-defensible',
      why: 'No registered source supports any derived boundary here as a treatment target, and a risk association is not an instruction.',
    },
    {
      id: 'rules-out-dysfunction',
      label: 'As reassurance: a PAPi of 2.75 excludes right-ventricular dysfunction.',
      verdict: 'not-defensible',
      why: 'A value above a cohort’s high-risk band does not exclude dysfunction — the boundary was derived to flag risk in its cohort, not to clear patients outside it.',
    },
  ] as readonly DerivedDecisionOption[],
  defensibleOptionId: 'phenotype-bounded',
})

/**
 * The selective-invalidation commitment on episode 2: decide metric by metric, with a reason.
 *
 * The withhold reasons are authored ids graded against the evaluator's own verdicts, so "withhold
 * everything to be safe" and "the number exists so calculate it" are both wrong in ways the learner
 * has to see.
 */
export const derivedSelectiveDecision = Object.freeze({
  episodeId: 'ep-invalid-pawp',
  prompt:
    'The stored PAWP in this episode is not a wedge. Decide, metric by metric, what survives — and give the reason for anything you withhold.',
  metricIds: [
    'pulmonaryVascularResistance',
    'systemicVascularResistance',
    'pulmonaryArteryPulsatilityIndex',
    'cardiacIndexLMinM2',
  ] as readonly DerivedMetricId[],
  withholdReasonOptions: [
    {
      id: 'required-input-invalid-pawp',
      label: 'A required input is invalid: the stored PAWP is not a true wedge pressure.',
    },
    {
      id: 'cardiac-output-method-unknown',
      label: 'The cardiac-output method is unknown.',
    },
    {
      id: 'different-measurement-episodes',
      label: 'Its inputs come from different measurement episodes.',
    },
    {
      id: 'denominator-zero',
      label: 'Its denominator is zero or negative.',
    },
  ],
  correctWithholdReasonId: 'required-input-invalid-pawp',
})

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

const KNOWN_FLOW_METHODS: readonly DerivedEpisodeFlowMethodId[] = [
  'thermodilution',
  'fick-direct',
  'fick-assumed-vo2',
  'method-unknown',
]

function validateDecisionOptions(
  label: string,
  options: readonly DerivedDecisionOption[],
  defensibleOptionId: string,
): void {
  const defensible = options.filter((option) => option.verdict === 'defensible')
  if (defensible.length !== 1 || defensible[0].id !== defensibleOptionId) {
    throw new Error(`${label} must offer exactly one defensible position.`)
  }
  if (!options.some((option) => option.verdict === 'averages-methods')) {
    throw new Error(
      `${label} must offer an averaging or blending position, so the learner declines it rather than never meeting it.`,
    )
  }
  if (
    options.some(
      (option) => option.verdict === 'averages-methods' && option.id === defensibleOptionId,
    )
  ) {
    throw new Error(`${label} marks an averaging position as defensible.`)
  }
}

export function validateDerivedMeasurementEpisodes(
  episodes: readonly DerivedMeasurementEpisode[] = derivedMeasurementEpisodes,
): void {
  const seen = new Set<string>()
  for (const episode of episodes) {
    if (seen.has(episode.id)) throw new Error(`Duplicate derived episode: ${episode.id}`)
    seen.add(episode.id)

    const inputIds = new Set<string>()
    for (const episodeInput of episode.inputs) {
      if (!derivedInputDefinitionById.has(episodeInput.inputId)) {
        throw new Error(`${episode.id} carries an unknown input: ${episodeInput.inputId}`)
      }
      if (inputIds.has(episodeInput.inputId)) {
        throw new Error(`${episode.id} carries ${episodeInput.inputId} twice.`)
      }
      inputIds.add(episodeInput.inputId)
      if (episodeInput.value === null && episodeInput.valid) {
        throw new Error(
          `${episode.id}/${episodeInput.inputId}: a missing value cannot be marked valid.`,
        )
      }
      if (!episodeInput.valid && episodeInput.note.trim().length < 20) {
        throw new Error(
          `${episode.id}/${episodeInput.inputId}: an invalid input must say why it is invalid.`,
        )
      }
    }

    if (episode.flowResults.length === 0) {
      throw new Error(`${episode.id} has no cardiac-output account at all.`)
    }
    for (const flow of episode.flowResults) {
      if (!KNOWN_FLOW_METHODS.includes(flow.methodId)) {
        throw new Error(`${episode.id}/${flow.id} names an unknown flow method: ${flow.methodId}`)
      }
      if (flow.status === 'accepted' && (flow.valueLMin === null || flow.valueLMin <= 0)) {
        throw new Error(`${episode.id}/${flow.id}: an accepted flow must carry a positive value.`)
      }
      if (flow.status === 'withheld' && flow.withheldReasons.length === 0) {
        throw new Error(`${episode.id}/${flow.id}: a withheld flow must say why.`)
      }
    }

    const tagUniverse = new Set(
      episode.inputs.map((episodeInput) => episodeInput.measurementEpisodeId),
    )
    for (const flow of episode.flowResults) tagUniverse.add(flow.measurementEpisodeId)
    if (!tagUniverse.has(episode.primaryMeasurementEpisodeId)) {
      throw new Error(`${episode.id}: nothing belongs to its own primary measurement episode.`)
    }

    if (episode.sensitivityFocus) {
      if (!derivedMetricById.has(episode.sensitivityFocus.metricId)) {
        throw new Error(`${episode.id} focuses sensitivity on an unknown metric.`)
      }
      if (!derivedInputDefinitionById.has(episode.sensitivityFocus.inputId)) {
        throw new Error(`${episode.id} focuses sensitivity on an unknown input.`)
      }
      if (episode.sensitivityFocus.perturbation <= 0) {
        throw new Error(`${episode.id}: a sensitivity perturbation must be positive.`)
      }
    }

    for (const evidenceId of episode.evidenceIds) {
      if (!hemodynamicsSourceById.has(evidenceId)) {
        throw new Error(`${episode.id} cites unregistered evidence: ${evidenceId}`)
      }
    }
  }

  requireDerivedMeasurementEpisode(derivedMethodDisagreementDecision.episodeId)
  requireDerivedMeasurementEpisode(derivedThresholdContextDecision.episodeId)
  requireDerivedMeasurementEpisode(derivedSelectiveDecision.episodeId)
  requireDerivedMeasurementEpisode(derivedTransferComparisonDecision.plausibleEpisodeId)
  requireDerivedMeasurementEpisode(derivedTransferComparisonDecision.coherentEpisodeId)

  const disagreementEpisode = requireDerivedMeasurementEpisode(
    derivedMethodDisagreementDecision.episodeId,
  )
  const acceptedMethods = disagreementEpisode.flowResults.filter(
    (flow) => flow.status === 'accepted',
  )
  if (acceptedMethods.length < 2) {
    throw new Error('The method-disagreement episode must carry two accepted flow methods.')
  }

  validateDecisionOptions(
    'derivedMethodDisagreementDecision',
    derivedMethodDisagreementDecision.options,
    derivedMethodDisagreementDecision.defensibleOptionId,
  )
  validateDecisionOptions(
    'derivedTransferComparisonDecision',
    derivedTransferComparisonDecision.options,
    derivedTransferComparisonDecision.defensibleOptionId,
  )
  {
    const options = derivedThresholdContextDecision.options
    const defensible = options.filter((option) => option.verdict === 'defensible')
    if (
      defensible.length !== 1 ||
      defensible[0].id !== derivedThresholdContextDecision.defensibleOptionId
    ) {
      throw new Error('derivedThresholdContextDecision must offer exactly one defensible position.')
    }
    if (!options.some((option) => /treatment|support is indicated/i.test(option.label))) {
      throw new Error(
        'derivedThresholdContextDecision must offer a treatment-target reading, so the learner declines it explicitly.',
      )
    }
  }
  for (const metricId of derivedSelectiveDecision.metricIds) {
    if (!derivedMetricById.has(metricId)) {
      throw new Error(`derivedSelectiveDecision names an unknown metric: ${metricId}`)
    }
  }
}

validateDerivedMeasurementEpisodes()
