'use client'

/**
 * Section 9 — Safety, reassessment, and the whole patient.
 *
 * The lesson's first objective is recognizing when the patient needs a bedside assessment rather
 * than another look at the screen. So this panel deliberately does not decide urgency from
 * thresholds of its own: it groups whatever the engine's alarm logic has already raised by *where
 * the answer lives* — patient, circuit, ventilator, or the person — and orders the checks so the
 * ones that are both fastest and most lethal come first.
 */
import { useState } from 'react'

import type { AlarmEvent, VentilationSimulationState } from '../../engine'
import { exhaledVolumeReading } from '../../content/measurementReadiness'
import { patientReportAvailability } from '../../content/patientReport'
import { referenceAlarmSet } from '../../content/referenceAlarmSet'
import { ModelBoundary, TextEquivalent, round, styles } from './shared'

type Locus = 'patient' | 'circuit' | 'ventilator' | 'person'

const locusOrder: readonly Locus[] = ['patient', 'circuit', 'ventilator', 'person']

const locusCopy: Readonly<
  Record<Locus, { readonly label: string; readonly checks: readonly string[] }>
> = {
  patient: {
    label: 'The patient',
    checks: [
      'Look at the chest and feel it. Symmetry, expansion, and whether the effort you can see matches the effort on the screen.',
      'Listen. Air entry on both sides settles more of the differential in seconds than any waveform will.',
      'Check the circulation alongside the airway. A pressure problem that has become a circulation problem has changed category.',
    ],
  },
  circuit: {
    label: 'The circuit',
    checks: [
      'Follow the tubing from the patient to the ventilator with your hands. Kinks, water, and disconnections are found this way, not on a screen.',
      'Check the artificial airway itself — position, patency, and whether it is where it was.',
      'If the circuit cannot be excluded quickly, disconnect and ventilate by hand. That both treats and diagnoses.',
    ],
  },
  ventilator: {
    label: 'The ventilator',
    checks: [
      'Read what the machine says it is doing, and compare it against what it was asked to do.',
      'Confirm the alarm is reporting the thing it names. An alarm is a claim about a measurement, and the measurement can be wrong.',
      'Change one thing at a time so the response stays attributable.',
    ],
  },
  person: {
    label: 'The person',
    checks: [
      'Ask, if they can answer. Pain, breathlessness, and fear are reportable and are none of them visible on a trace.',
      'Consider delirium, position, a full bladder, and the ordinary indignities of being ventilated.',
      'Note who else needs to know. Reassessment that is not communicated is not reassessment.',
    ],
  },
}

/** Where the answer to this alarm most likely lives. Keyed on the engine's own alarm codes. */
function locusForAlarm(code: string, message: string): Locus {
  const text = `${code} ${message}`.toLowerCase()
  if (/disconnect|leak|circuit|tubing|obstruct/.test(text)) return 'circuit'
  if (/spo|sat|oxygen|blood pressure|hypotens|map|heart|shock|apnea/.test(text)) return 'patient'
  if (/dyspnea|pain|anxiety|agitat|comfort/.test(text)) return 'person'
  return 'ventilator'
}

export function VentilationSafetyReassessment({
  state,
}: {
  readonly state: VentilationSimulationState
}) {
  const [selected, setSelected] = useState<Locus>('patient')
  const { alarms, measurements, patient } = state
  /*
   * Your patient's alarms when it has any. When it has none — Section 13's live patient raises
   * none — the sort is practised on a separate reference: what the simulator raises for the
   * tension pneumothorax the written example describes, labelled as that patient's every time.
   * The panel used to sort an empty list and read "No alarm is active" under a worked example of
   * a high-pressure alarm (S13-1). No alarm is added to your patient.
   */
  const reference = alarms.length === 0 ? referenceAlarmSet(state.deviceId) : null
  const sorted: readonly AlarmEvent[] = reference ? reference.alarms : alarms
  const grouped = locusOrder.map((locus) => ({
    locus,
    alarms: sorted.filter((alarm) => locusForAlarm(alarm.code, alarm.message) === locus),
  }))
  const activeCount = sorted.length
  const highest = sorted.find((alarm) => alarm.priority === 'high') ?? sorted[0]
  const report = patientReportAvailability(state)
  const volume = exhaledVolumeReading(state)
  const whose = reference
    ? `Your patient has no active alarm. Sorted instead: the ${activeCount} alarm${activeCount === 1 ? '' : 's'} the simulator raises for a separate reference patient, case ${reference.caseId} (${reference.branch} branch) as it opens`
    : `${activeCount} alarm${activeCount === 1 ? '' : 's'} active on your patient`

  const summary = `${whose}, the most urgent being ${highest?.message ?? 'unnamed'} at ${highest?.priority ?? 'unknown'} priority. Grouped by where the answer lives: ${grouped
    .map((group) => `${locusCopy[group.locus].label}, ${group.alarms.length}`)
    .join(
      '; ',
    )}. On your patient, peak airway pressure is ${round(measurements.peakPressureCmH2O, 1)} centimetres of water, oxygen saturation ${round(patient.gasExchange.spo2Percent)} percent, mean arterial pressure ${round(patient.hemodynamics.mapMmHg)} millimetres of mercury, and the highest of the pain, anxiety, and dyspnea scores is ${round(Math.max(patient.human.painScore, patient.human.anxietyScore, patient.human.dyspneaScore), 1)} — ${report.availability === 'reported' ? 'a modeled patient report' : 'an internal model index, not something this patient reported'}. The selected place to look is ${locusCopy[selected].label}.`

  return (
    <section className={styles.panel} aria-labelledby="mv-safety-teaching">
      <header className={styles.panelHeader}>
        <span>Reassessment</span>
        <h2 id="mv-safety-teaching">Where does the answer live?</h2>
        <p>
          An alarm names a measurement, not a cause. Sorting what is active by where its answer
          lives is what turns a screen full of alarms into an order to check things in — and the
          first two places are reached with your hands, not the console.
        </p>
      </header>

      <figure
        className={styles.figure}
        data-alarm-source={reference ? 'reference' : 'live'}
        data-reference-case={reference?.caseId}
      >
        {reference ? (
          <p className={styles.textEquivalent} data-alarm-source-note>
            <strong>Your patient has no active alarm.</strong> To practise the sort, the boxes below
            hold what this simulator raises for a separate reference patient — case{' '}
            {reference.caseId}, the tension pneumothorax, as it opens. Nothing here is happening to
            your patient, and the written example in the teaching column is a third, constructed
            patient.
          </p>
        ) : null}
        <div className={styles.locusGrid} role="img" aria-label={summary}>
          {grouped.map((group, index) => (
            <div
              key={group.locus}
              className={styles.locusCard}
              data-active={selected === group.locus}
              data-populated={group.alarms.length > 0}
            >
              <span className={styles.locusRank} aria-hidden="true">
                {index + 1}
              </span>
              <h3>{locusCopy[group.locus].label}</h3>
              {group.alarms.length === 0 ? (
                <p className={styles.locusEmpty}>Nothing active here</p>
              ) : (
                <ul className={styles.plainList}>
                  {group.alarms.map((alarm) => (
                    <li key={alarm.id} data-priority={alarm.priority}>
                      {alarm.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <figcaption>
          {reference
            ? `The reference patient’s alarms (case ${reference.caseId}), sorted by where the answer lives.`
            : 'Whatever your console is currently alarming on, sorted by where its answer lives.'}{' '}
          The numbering is the order to check in, not a ranking of how many alarms each holds.
        </figcaption>
      </figure>

      <dl
        className={styles.readouts}
        aria-label="Your patient’s signals, checked at every reassessment"
      >
        <div>
          <dt>Peak pressure</dt>
          <dd>
            {round(measurements.peakPressureCmH2O, 1)} <small>cmH₂O</small>
          </dd>
        </div>
        <div>
          <dt>Saturation</dt>
          <dd>
            {round(patient.gasExchange.spo2Percent)} <small>%</small>
          </dd>
        </div>
        <div>
          <dt>Mean arterial pressure</dt>
          <dd>
            {round(patient.hemodynamics.mapMmHg)} <small>mmHg</small>
          </dd>
        </div>
        <div>
          <dt>Exhaled tidal volume</dt>
          <dd>
            {volume.exhaledVtMl === null ? (
              <small>Awaiting a completed breath</small>
            ) : (
              <>
                {round(volume.exhaledVtMl)} <small>mL</small>
              </>
            )}
          </dd>
        </div>
        <div data-report-availability={report.availability}>
          <dt>
            {report.availability === 'reported' ? 'Reported dyspnea · modeled' : 'Dyspnea index'}
          </dt>
          <dd>
            {round(patient.human.dyspneaScore, 1)}{' '}
            {report.availability === 'reported' ? null : <small>not a patient report</small>}
          </dd>
        </div>
      </dl>

      <div className={styles.componentToggles}>
        {locusOrder.map((locus) => (
          <button
            key={locus}
            type="button"
            aria-pressed={selected === locus}
            onClick={() => setSelected(locus)}
          >
            {locusCopy[locus].label}
          </button>
        ))}
      </div>

      <div className={styles.stepDetail}>
        <span>Checking {locusCopy[selected].label.toLowerCase()}</span>
        <ul className={styles.plainList}>
          {locusCopy[selected].checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </div>

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        Alarms shown here are the simulator’s own; no additional urgency threshold is applied by
        this panel. The checks are a recognition-and-priority exercise, not a protocol — perform any
        bedside procedure according to local policy and under appropriate supervision.
      </ModelBoundary>
    </section>
  )
}
