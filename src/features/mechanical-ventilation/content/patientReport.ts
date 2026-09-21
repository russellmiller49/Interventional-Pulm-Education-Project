/**
 * A number the patient told you, a number the model keeps about the patient, and a number the
 * ventilator measured are three different things.
 *
 * "Readings to watch" printed "Anxiety 8.0 /10" and "Dyspnea 7.6 /10" in the same list as
 * "Delivered rate 31 /min". Nothing on that list said which of them came off a flow sensor, and on
 * Section 13 the same score is printed for a patient the case describes as unable to communicate —
 * so a score that is an internal model state was being read as an answer somebody gave.
 *
 * Three identities, from state this module already carries:
 *
 *   - **ventilator measurement** — anything in `state.measurements`.
 *   - **modeled patient report** — a symptom score on a patient the model says can communicate.
 *     Still modeled, and labelled as such; it is what this simulated patient would say.
 *   - **internal symptom index** — the same field on a patient who cannot answer. The model keeps
 *     it because it drives behaviour; it is not a report, because nobody was asked.
 *
 * `canCommunicate` is the case's own field and `sedationScore` is RASS as the module already uses
 * it. No threshold is introduced: deep sedation is read from the case's own flag rather than from
 * a cutoff invented here. Whether a patient at a given RASS should be reportable at all is a
 * clinical question for batch 02 and the owner list; this file only stops the two being printed
 * under one heading.
 */
import type { VentilationSimulationState } from '../engine/types'

/** The scores that are the patient's, not the machine's. */
export const PATIENT_REPORT_METRICS = ['dyspnea', 'pain', 'anxiety'] as const
export type PatientReportMetric = (typeof PATIENT_REPORT_METRICS)[number]

export type PatientReportAvailability = 'reported' | 'index-only'

export interface PatientReportView {
  readonly availability: PatientReportAvailability
  /** The heading the group is printed under. */
  readonly heading: string
  /** The sentence under the heading, naming what these numbers are and are not. */
  readonly note: string
  /** The suffix beside each score. */
  readonly suffix: string
}

export function patientReportAvailability(state: VentilationSimulationState): PatientReportView {
  const reportable = state.patient.human.canCommunicate
  return reportable
    ? {
        availability: 'reported',
        heading: 'Patient report · modeled',
        note: 'What this simulated patient reports when asked. These are not ventilator measurements and no sensor produces them.',
        suffix: 'patient report (modeled)',
      }
    : {
        availability: 'index-only',
        heading: 'Internal symptom index · not a patient report',
        note: 'This patient cannot answer in the model, so these are the internal scores the simulation keeps, not something the patient said. Obtaining a report would need a way for them to respond.',
        suffix: 'internal model index; not obtained from the patient',
      }
}
