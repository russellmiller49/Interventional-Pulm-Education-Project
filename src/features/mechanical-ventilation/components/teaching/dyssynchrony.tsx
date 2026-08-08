'use client'

/**
 * Section 6 — Dyssynchrony: mechanism before label.
 *
 * Deliberately not a pattern-naming panel. The lesson's whole claim is that naming the picture is
 * the last step, so the panel asks the learner to commit to a *domain* — drive, load, timing,
 * support, or the whole patient — and then shows what the live state says for and against it.
 * Nothing here classifies the waveform for the learner.
 */
import { useMemo, useState } from 'react'

import { plateauReadingValidity } from '../../content/plateauValidity'
import type { VentilationSimulationState } from '../../engine'
import { ModelBoundary, TextEquivalent, latestBreath, round, styles, tracePath } from './shared'

type Domain = 'drive' | 'load' | 'timing' | 'support' | 'patient'

const domainOrder: readonly Domain[] = ['drive', 'load', 'timing', 'support', 'patient']

const domainCopy: Readonly<
  Record<Domain, { readonly label: string; readonly claim: string; readonly ifDominant: string }>
> = {
  drive: {
    label: 'Drive',
    claim: 'The patient is asking for more than is being asked of them.',
    ifDominant:
      'Efforts are frequent and large, and they continue whether or not each one is answered. Raising support may reduce the visible mismatch without reducing the drive that caused it, so the question that follows is what the drive is for — acidosis, hypoxemia, pain, anxiety, or fever.',
  },
  load: {
    label: 'Load',
    claim: 'The work the breath requires has changed.',
    ifDominant:
      'The pressure cost of the same breath has moved: a wider peak-to-plateau difference points at resistance, a higher plateau above baseline at stiffness, and an expiratory limb that never reaches zero at trapped volume. Load is the domain most likely to be fixed by something other than a ventilator setting.',
  },
  timing: {
    label: 'Timing',
    claim: 'The two clocks disagree about when the breath starts or ends.',
    ifDominant:
      'The mismatch localizes to one transition rather than the whole breath. Trigger problems and cycle problems produce the same complaint from the bedside and need opposite corrections, so this domain is only useful once the transition is named.',
  },
  support: {
    label: 'Support',
    claim: 'The delivered breath does not match what the effort was reaching for.',
    ifDominant:
      'Too little and the patient keeps pulling through delivery; too much and the breath outlasts the effort behind it. The tell is whether effort continues into delivery or stops early, not the size of the support number itself.',
  },
  patient: {
    label: 'Whole patient',
    claim: 'The mismatch is not primarily a ventilator problem at all.',
    ifDominant:
      'Pain, delirium, anxiety, a full bladder, an airway problem, or a new physiological event can all present as fighting the ventilator. This domain is checked first at the bedside and last on a waveform, which is exactly backwards from how it is usually taught.',
  },
}

interface DomainEvidence {
  readonly signal: string
  readonly observed: string
  /** Whether the live state currently *supports* looking here — never a diagnosis. */
  readonly bearing: 'supports' | 'neutral' | 'unmeasured' | 'invalidates'
}

const bearingLabels: Readonly<Record<DomainEvidence['bearing'], string>> = {
  supports: 'Points here',
  neutral: 'Not discriminating',
  unmeasured: 'Not measured',
  /*
   * A measurement that was taken but cannot bear the inference. Distinct from 'unmeasured', which
   * invites the learner to go and measure it — repeating a hold on a patient who is still pulling
   * produces the same uninterpretable number again. The integration panel already made this
   * distinction; the load domain here did not, and it is the domain that reads the plateau.
   */
  invalidates: 'Measured, but cannot be read as mechanics',
}

export function VentilationDyssynchronyDomains({
  state,
}: {
  readonly state: VentilationSimulationState
}) {
  const [selected, setSelected] = useState<Domain | null>(null)
  const breath = useMemo(() => latestBreath(state.waveforms), [state.waveforms])
  const { measurements, patient } = state

  const peakEffort = breath.reduce((lowest, sample) => Math.min(lowest, sample.pmusCmH2O), 0)
  const effortPresent = peakEffort < -1.5
  const plateauMeasured = measurements.plateauPressureCmH2O > 0
  const plateauInterpretable = plateauReadingValidity(state).interpretable
  const gap = Math.max(0, measurements.peakPressureCmH2O - measurements.plateauPressureCmH2O)
  const plateauAboveBaseline = Math.max(
    0,
    measurements.plateauPressureCmH2O - state.ventilator.settings.peepCmH2O,
  )
  const trapping = Math.abs(measurements.expiratoryFlowAtNextBreathLMin) >= 1
  const patientRate = measurements.observedPatientRatePerMin
  // In pressure support there is no mandatory rate to breathe over, only the apnea backup — so the
  // comparison is against the rate the ventilator would impose if the patient stopped.
  const settings = state.ventilator.settings
  const setRate =
    settings.mode === 'pressure-support' ? settings.apneaRatePerMin : settings.ratePerMin
  const rateLabel = settings.mode === 'pressure-support' ? 'apnea backup rate' : 'set rate'
  const overBreathing = patientRate > setRate + 0.5
  const ineffective = measurements.ineffectiveEffortFraction > 0
  const autotriggering = measurements.autotriggerFraction > 0
  const human = patient.human
  const humanBurden = Math.max(human.painScore, human.anxietyScore, human.dyspneaScore)

  const evidenceFor = (domain: Domain): readonly DomainEvidence[] => {
    if (domain === 'drive') {
      return [
        {
          signal: `Patient rate against the ${rateLabel}`,
          observed: `${round(patientRate)} against ${round(setRate)} per minute`,
          bearing: overBreathing ? 'supports' : 'neutral',
        },
        {
          signal: 'Size of effort this breath',
          observed: effortPresent ? `${round(peakEffort, 1)} cmH₂O` : 'No appreciable effort',
          bearing: effortPresent ? 'supports' : 'neutral',
        },
        {
          signal: 'Reported dyspnea',
          observed: `${round(human.dyspneaScore, 1)} on the modeled scale`,
          bearing: human.dyspneaScore > 0 ? 'supports' : 'neutral',
        },
      ]
    }
    if (domain === 'load') {
      return [
        {
          signal: 'Peak-to-plateau difference',
          observed: !plateauMeasured
            ? 'No plateau measured — perform an inspiratory hold'
            : plateauInterpretable
              ? `${round(gap, 1)} cmH₂O`
              : 'The plateau is depressed by the patient’s own effort, so this difference is not purely resistive',
          bearing: !plateauMeasured
            ? 'unmeasured'
            : !plateauInterpretable
              ? 'invalidates'
              : gap > 6
                ? 'supports'
                : 'neutral',
        },
        {
          signal: 'Plateau above baseline',
          observed: !plateauMeasured
            ? 'No plateau measured — perform an inspiratory hold'
            : plateauInterpretable
              ? `${round(plateauAboveBaseline, 1)} cmH₂O`
              : 'Not the distending pressure of the respiratory system while the patient is pulling',
          bearing: !plateauMeasured
            ? 'unmeasured'
            : !plateauInterpretable
              ? 'invalidates'
              : 'neutral',
        },
        {
          signal: 'Expiratory flow at the next breath',
          observed: `${round(measurements.expiratoryFlowAtNextBreathLMin, 1)} L/min`,
          bearing: trapping ? 'supports' : 'neutral',
        },
      ]
    }
    if (domain === 'timing') {
      return [
        {
          signal: 'Trigger delay',
          observed: `${round(measurements.triggerDelayMs)} ms`,
          bearing: measurements.triggerDelayMs > 0 ? 'supports' : 'neutral',
        },
        {
          signal: 'Efforts producing no breath',
          observed: `${round(measurements.ineffectiveEffortFraction * 100)}%`,
          bearing: ineffective ? 'supports' : 'neutral',
        },
        {
          signal: 'Breaths with no effort behind them',
          observed: `${round(measurements.autotriggerFraction * 100)}%`,
          bearing: autotriggering ? 'supports' : 'neutral',
        },
      ]
    }
    if (domain === 'support') {
      return [
        {
          signal: 'Effort continuing into delivery',
          observed: effortPresent
            ? `Effort present at ${round(peakEffort, 1)} cmH₂O during this breath`
            : 'No appreciable effort',
          bearing: effortPresent ? 'supports' : 'neutral',
        },
        {
          signal: 'Delivered tidal volume',
          observed: `${round(measurements.exhaledVtMl)} mL exhaled`,
          bearing: 'neutral',
        },
        {
          signal: 'Stacked volume',
          observed:
            measurements.stackedVolumeMl > 0
              ? `${round(measurements.stackedVolumeMl)} mL delivered before the previous breath emptied`
              : 'None',
          bearing: measurements.stackedVolumeMl > 0 ? 'supports' : 'neutral',
        },
      ]
    }
    return [
      {
        signal: 'Pain, anxiety, dyspnea',
        observed: `Highest of the three is ${round(humanBurden, 1)} on the modeled scale`,
        bearing: humanBurden > 0 ? 'supports' : 'neutral',
      },
      {
        signal: 'Delirium and sedation',
        observed: `Delirium ${round(human.deliriumScore, 1)}, sedation ${round(human.sedationScore, 1)}`,
        bearing: human.deliriumScore > 0 ? 'supports' : 'neutral',
      },
      {
        signal: 'Circulation',
        observed: `Mean arterial pressure ${round(patient.hemodynamics.mapMmHg)} mmHg, heart rate ${round(patient.hemodynamics.heartRatePerMin)}`,
        bearing: patient.hemodynamics.obstructiveShock ? 'supports' : 'neutral',
      },
    ]
  }

  const evidence = selected ? evidenceFor(selected) : []
  const pressurePath = tracePath(breath, 'pawCmH2O', -5, 45, 300, 70)
  const effortPath = tracePath(breath, 'pmusCmH2O', -25, 5, 300, 70)

  const summary = `Pressure and patient effort for the most recent breath. Patient rate is ${round(patientRate)} against a set rate of ${round(setRate)}, effort this breath ${effortPresent ? `peaks at ${round(peakEffort, 1)} centimeters of water` : 'is not appreciable'}, ${round(measurements.ineffectiveEffortFraction * 100)} percent of efforts produce no breath, and expiratory flow at the next breath is ${round(measurements.expiratoryFlowAtNextBreathLMin, 1)} liters per minute.${selected ? ` The selected domain is ${domainCopy[selected].label}.` : ' No domain has been selected yet.'}`

  return (
    <section className={styles.panel} aria-labelledby="mv-dyssynchrony-teaching">
      <header className={styles.panelHeader}>
        <span>Mechanism view</span>
        <h2 id="mv-dyssynchrony-teaching">Commit to a domain before naming a pattern</h2>
        <p>
          This panel will not classify the waveform for you. Choose where you think the mismatch is
          coming from, and it shows what the live signals say for and against looking there.
        </p>
      </header>

      <figure className={styles.figure}>
        <svg viewBox="0 0 300 150" role="img" aria-label={summary}>
          <path className={styles.traceGrid} d="M0 70 H300" />
          <path className={styles.trace} d={pressurePath} />
          <g transform="translate(0 78)">
            <path className={styles.traceGrid} d="M0 70 H300" />
            <path className={styles.traceEffort} d={effortPath} />
          </g>
        </svg>
        <figcaption>
          Airway pressure above, patient effort below, for the most recent breath. Both are shown at
          all times — the domains are read against the same breath, not against different ones.
        </figcaption>
      </figure>

      <div className={styles.candidates} role="group" aria-label="Candidate domains">
        {domainOrder.map((domain) => (
          <button
            key={domain}
            type="button"
            aria-pressed={selected === domain}
            onClick={() => setSelected((current) => (current === domain ? null : domain))}
          >
            {domainCopy[domain].label}
          </button>
        ))}
      </div>

      {selected ? (
        <>
          <div className={styles.stepDetail}>
            <span>{domainCopy[selected].label}</span>
            <p>
              <strong>{domainCopy[selected].claim}</strong>
            </p>
            <span>If this is dominant</span>
            <p>{domainCopy[selected].ifDominant}</p>
          </div>
          <div
            className={styles.evidenceTable}
            aria-label={`Live signals bearing on ${domainCopy[selected].label}`}
          >
            {evidence.map((item) => (
              <div key={item.signal} className={styles.evidenceRow}>
                <span>
                  {item.signal}
                  <small>Observed: {item.observed}</small>
                </span>
                <span
                  className={styles.verdict}
                  data-verdict={
                    item.bearing === 'supports'
                      ? 'consistent'
                      : item.bearing === 'unmeasured'
                        ? 'unmeasured'
                        : 'neutral'
                  }
                >
                  {bearingLabels[item.bearing]}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.stepDetail}>
          <span>Before selecting</span>
          <p>
            More than one domain is usually contributing, and the pattern name comes last. The
            useful commitment is which domain you would act on first, and what you would expect to
            change if you were right.
          </p>
        </div>
      )}

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        “Points here” means the live signal is consistent with looking in that domain — not that the
        mechanism is established. Effort, drive, and the human scores come from the bounded
        educational model, and no signal here is a substitute for examining the patient.
      </ModelBoundary>
    </section>
  )
}
