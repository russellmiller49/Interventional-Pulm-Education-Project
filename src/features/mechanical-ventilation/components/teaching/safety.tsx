'use client'

/**
 * Section 8 — Safety, reassessment, and the whole patient.
 *
 * The lesson's first objective is recognizing when the patient needs a bedside assessment rather
 * than another look at the screen. So this panel deliberately does not decide urgency from
 * thresholds of its own: it groups whatever the engine's alarm logic has already raised by *where
 * the answer lives* — patient, circuit, ventilator, or the person — and orders the checks so the
 * ones that are both fastest and most lethal come first.
 */
import { useState } from 'react'

import type { VentilationSimulationState } from '../../engine'
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

  const grouped = locusOrder.map((locus) => ({
    locus,
    alarms: alarms.filter((alarm) => locusForAlarm(alarm.code, alarm.message) === locus),
  }))
  const activeCount = alarms.length
  const highest = alarms.find((alarm) => alarm.priority === 'high') ?? alarms[0]

  const summary = `${activeCount === 0 ? 'No alarm is active' : `${activeCount} alarm${activeCount === 1 ? '' : 's'} active, the most urgent being ${highest?.message ?? 'unnamed'} at ${highest?.priority ?? 'unknown'} priority`}. Grouped by where the answer lives: ${grouped
    .map((group) => `${locusCopy[group.locus].label}, ${group.alarms.length}`)
    .join(
      '; ',
    )}. Alongside them, peak airway pressure is ${round(measurements.peakPressureCmH2O, 1)} centimetres of water, oxygen saturation ${round(patient.gasExchange.spo2Percent)} percent, mean arterial pressure ${round(patient.hemodynamics.mapMmHg)} millimetres of mercury, and the highest of the reported pain, anxiety, and dyspnea scores is ${round(Math.max(patient.human.painScore, patient.human.anxietyScore, patient.human.dyspneaScore), 1)}. The selected place to look is ${locusCopy[selected].label}.`

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

      <figure className={styles.figure}>
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
          Whatever the console is currently alarming on, sorted by where its answer lives. The
          numbering is the order to check in, not a ranking of how many alarms each holds.
        </figcaption>
      </figure>

      <dl className={styles.readouts} aria-label="Signals checked at every reassessment">
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
            {round(measurements.exhaledVtMl)} <small>mL</small>
          </dd>
        </div>
        <div data-state={patient.human.dyspneaScore > 0 ? undefined : 'unavailable'}>
          <dt>Reported dyspnea</dt>
          <dd>{round(patient.human.dyspneaScore, 1)}</dd>
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
