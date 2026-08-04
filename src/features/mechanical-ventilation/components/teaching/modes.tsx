'use client'

/**
 * Section 4 — Modes: trigger, target, cycle, and expiration.
 *
 * The lesson's claim is that a device label is not a description of the breath. So the figure is
 * the live breath with its four variables marked on it, and the table underneath states what the
 * *active* mode does for each variable next to the label the *active console* prints. Change the
 * device and the label column changes while the behavior column does not — which is the point.
 */
import { useMemo, useState } from 'react'

import { getVentilatorDeviceProfile, getVentilatorModeLabel } from '../../content'
import {
  isAdaptivePressureMode,
  isAdaptiveSupportMode,
  isSpontaneousAdaptiveMode,
} from '../../engine'
import type { VentilationSimulationState } from '../../engine'
import {
  AwaitingBreath,
  ModelBoundary,
  TextEquivalent,
  fractionAt,
  latestBreath,
  round,
  styles,
  tracePath,
} from './shared'

type BreathVariable = 'trigger' | 'target' | 'cycle' | 'expiration'

const variableOrder: readonly BreathVariable[] = ['trigger', 'target', 'cycle', 'expiration']

const variableCopy: Readonly<
  Record<
    BreathVariable,
    { readonly label: string; readonly question: string; readonly body: string }
  >
> = {
  trigger: {
    label: 'Trigger',
    question: 'What starts the breath?',
    body: 'Either the ventilator’s own clock or the patient. Every mode has to answer this, and the answer is what decides whether the rate you set is the rate the patient gets. A mode label rarely tells you which it is on any given breath — the waveform does.',
  },
  target: {
    label: 'Target',
    question: 'What is held constant during delivery?',
    body: 'One of volume or pressure is set and the other follows the lung. This is the variable that stays controlled when mechanics change, and the one that will not. Knowing which is which tells you what a stiffening lung will do to the breath before it happens.',
  },
  cycle: {
    label: 'Cycle',
    question: 'What ends inspiration?',
    body: 'Time, a delivered volume, or a fall in flow. Cycling is where a mode most often stops matching the patient, because it is the criterion the patient has least influence over — except in flow-cycled breaths, where they have the most.',
  },
  expiration: {
    label: 'Expiration',
    question: 'What is expiration held at, and is it free?',
    body: 'The baseline pressure the breath falls back to, and whether the patient can breathe during it. Expiration is passive in every mode here, so it is set by the lung and the circuit rather than by the ventilator — which is why it is the limb that reveals trapping.',
  },
}

interface VariableRow {
  readonly variable: BreathVariable
  /** What this mode actually does — device-independent. */
  readonly behavior: string
  /** The setting on the console that governs it, under the active device's own name. */
  readonly control: string
}

export function VentilationModeVariables({
  state,
}: {
  readonly state: VentilationSimulationState
}) {
  const [selected, setSelected] = useState<BreathVariable | null>(null)
  const breath = useMemo(() => latestBreath(state.waveforms), [state.waveforms])
  const settings = state.ventilator.settings
  const profile = getVentilatorDeviceProfile(state.deviceId)
  const deviceLabel = getVentilatorModeLabel(state.deviceId, settings.deviceMode)
  const names = profile.controlLabels

  /*
   * Every adaptive or dual-control mode this console actually offers, under its own labels. Read
   * off the source-bound profile rather than listed here, so the caveat below names what this
   * device calls them and stays right when the learner changes console.
   */
  const adaptiveModes = profile.modes.filter(
    (mode) =>
      isAdaptivePressureMode(mode.id) ||
      isAdaptiveSupportMode(mode.id) ||
      isSpontaneousAdaptiveMode(mode.id),
  )

  const supported = settings.mode !== 'pressure-support'
  const pressureTargeted = settings.mode === 'pressure-ac'
  const spontaneousBreath = breath.some((sample) => sample.spontaneous)
  const patientTriggered = breath.some((sample) => sample.triggered)

  const rows: readonly VariableRow[] = [
    {
      variable: 'trigger',
      behavior: supported
        ? `Time or patient — a set rate delivers the breath, and an effort large enough to meet the trigger delivers it earlier. This breath was ${patientTriggered ? 'patient-triggered' : 'time-triggered'}.`
        : `Patient only — every breath must be triggered by an effort, with the apnea backup as the fallback. This breath was ${patientTriggered ? 'patient-triggered' : 'delivered by the backup'}.`,
      control: `${names.triggerThreshold ?? 'Trigger'}${supported ? ` · ${names.ratePerMin ?? 'Rate'}` : ` · ${names.apneaRatePerMin ?? 'Apnea rate'}`}`,
    },
    {
      variable: 'target',
      behavior: pressureTargeted
        ? 'Pressure — inspiratory pressure is held and the volume that results is whatever the mechanics allow. A stiffer lung takes a smaller breath at the same setting.'
        : supported
          ? 'Volume — the set tidal volume is delivered and the pressure that results is whatever the mechanics demand. A stiffer lung raises pressure at the same setting.'
          : 'Pressure — the support level is held above baseline and volume follows both the mechanics and the patient’s own effort.',
      control: pressureTargeted
        ? (names.deltaPControlCmH2O ?? 'Inspiratory pressure')
        : supported
          ? (names.vtMl ?? 'Tidal volume')
          : (names.pressureSupportCmH2O ?? 'Pressure support'),
    },
    {
      variable: 'cycle',
      behavior: supported
        ? `Time — inspiration ends when the set inspiratory time expires, independent of what the patient is doing. Mechanical inspiratory time this breath was ${round(state.measurements.mechanicalInspiratoryTimeSeconds, 2)} s.`
        : 'Flow — inspiration ends when inspiratory flow falls to a set fraction of its own peak, so the patient influences breath length directly.',
      control: supported
        ? (names.inspiratoryTimeSeconds ?? 'Inspiratory time')
        : (names.etsPercent ?? 'Cycle criterion'),
    },
    {
      variable: 'expiration',
      behavior: `Passive to the set baseline${spontaneousBreath ? ', with spontaneous breathing available throughout' : ''}. Emptying is set by the lung and circuit, not by the ventilator, so how completely it finishes is a measurement rather than a setting.`,
      control: names.peepCmH2O ?? 'PEEP',
    },
  ]

  // Marker positions come from the breath itself: the first sample, the last inspiratory sample,
  // and the midpoints of each phase.
  const lastInspiratory = breath.reduce(
    (last, sample, index) => (sample.phase === 'inspiration' ? index : last),
    0,
  )
  const markers: Readonly<Record<BreathVariable, number>> = {
    trigger: fractionAt(breath, 0),
    target: fractionAt(breath, Math.floor(lastInspiratory / 2)),
    cycle: fractionAt(breath, lastInspiratory),
    expiration: fractionAt(breath, Math.floor((lastInspiratory + breath.length - 1) / 2)),
  }

  const pressurePath = tracePath(breath, 'pawCmH2O', -5, 45, 300, 96)
  const flowPath = tracePath(breath, 'flowLMin', -80, 80, 300, 96)

  const summary =
    breath.length === 0
      ? 'No complete breath yet, so the four breath variables cannot be marked on a trace.'
      : `One breath of the active mode, which this console calls ${deviceLabel}. Four points are marked along it: trigger at the start of inspiration, target during delivery, cycle at the end of inspiration, and expiration during the return to baseline. This breath was ${patientTriggered ? 'patient-triggered' : 'time-triggered'}, the controlled variable is ${pressureTargeted || !supported ? 'pressure' : 'volume'}, inspiration ended by ${supported ? 'time' : 'flow'}, and mechanical inspiratory time was ${round(state.measurements.mechanicalInspiratoryTimeSeconds, 2)} seconds.${selected ? ` The selected variable is ${variableCopy[selected].label}.` : ''}`

  return (
    <section className={styles.panel} aria-labelledby="mv-modes-teaching">
      <header className={styles.panelHeader}>
        <span>Mode view</span>
        <h2 id="mv-modes-teaching">Four questions a mode name does not answer</h2>
        <p>
          This console calls the active mode <strong>{deviceLabel}</strong>. That label is local to
          this device. What travels between devices is the answer to four questions about the breath
          — select one to see what this mode answers, and which setting decides it.
        </p>
      </header>

      {breath.length === 0 ? (
        <AwaitingBreath label="Breath variables" />
      ) : (
        <figure className={styles.figure}>
          <svg viewBox="0 0 300 210" role="img" aria-label={summary}>
            <path className={styles.traceGrid} d="M0 96 H300" />
            <path className={styles.traceGrid} d="M0 200 H300" />
            <g>
              <path className={styles.trace} d={pressurePath} />
            </g>
            <g transform="translate(0 104)">
              <path className={styles.zeroFlowLine} d="M0 48 H300" />
              <path className={styles.trace} d={flowPath} />
            </g>
            {variableOrder.map((variable, index) => {
              const x = markers[variable] * 300
              const active = selected === null || selected === variable
              // Staggered rows: with a short inspiratory time, trigger, target, and cycle all land
              // in the first quarter of the breath and their labels would print on top of one
              // another at a shared height.
              const labelY = 12 + index * 11
              return (
                <g
                  key={variable}
                  className={active ? styles.variableMarker : styles.variableMarkerMuted}
                >
                  <path d={`M${x.toFixed(1)} 4 V200`} />
                  <text x={Math.min(x + 4, 246)} y={labelY}>
                    {variableCopy[variable].label}
                  </text>
                </g>
              )
            })}
          </svg>
          <figcaption>
            Pressure above, flow below, for the most recent breath. The four vertical marks are
            where each breath variable acts. Selecting a variable dims the other three.
          </figcaption>
        </figure>
      )}

      <div className={styles.componentToggles}>
        {variableOrder.map((variable) => (
          <button
            key={variable}
            type="button"
            aria-pressed={selected === variable}
            onClick={() => setSelected((current) => (current === variable ? null : variable))}
          >
            {variableCopy[variable].label}
          </button>
        ))}
      </div>

      <div className={styles.evidenceTable} aria-label="Breath variables of the active mode">
        {rows
          .filter((row) => selected === null || row.variable === selected)
          .map((row) => (
            <div key={row.variable} className={styles.evidenceRow}>
              <span>
                {variableCopy[row.variable].question}
                <small>{row.behavior}</small>
                <small>Set on this console by: {row.control}</small>
              </span>
              <span className={styles.verdict} data-verdict="neutral">
                {variableCopy[row.variable].label}
              </span>
            </div>
          ))}
      </div>

      {selected ? (
        <div className={styles.stepDetail}>
          <span>Why this variable earns its own question</span>
          <p>{variableCopy[selected].body}</p>
        </div>
      ) : null}

      {/*
       * The caveat to the rule the pathway opened with.
       *
       * Section 1 states that a ventilator sets one of pressure or volume and cannot set both, and
       * that scaffold is worth keeping — it is what makes a trace readable at sight. But it is a
       * simplification, and this is the right place to say so: the learner has just spent a section
       * reading breaths by their four variables, which is exactly the apparatus needed to see what
       * the adaptive modes actually do.
       *
       * The names come from the active console's own source-bound profile rather than a hardcoded
       * list, so they are examples of what one manufacturer calls it, not universal vocabulary.
       */}
      {adaptiveModes.length > 0 ? (
        <div className={styles.stepDetail}>
          <span>Where the one-of-two rule stops being exact</span>
          <p>
            &ldquo;The ventilator sets one of pressure or volume&rdquo; is the rule that makes a
            breath readable, and it holds for every mode above. It is a simplification, though, and
            the adaptive or dual-control modes are where it stops being exact: they set{' '}
            <em>pressure</em> on each breath, then adjust that pressure over the next several
            breaths to chase a volume you asked for. So the controlled variable within a breath is
            pressure, while the thing being defended across breaths is volume — and neither answer
            alone describes what the machine is doing.
          </p>
          <p>
            That has a consequence worth carrying to the bedside: the delivered volume can look
            stable while the pressure required to produce it climbs, so the number that would have
            warned you is the one the mode is quietly changing. Read the pressure trace on these
            modes, not only the volume.
          </p>
          <p>
            This console offers {adaptiveModes.length === 1 ? 'one such mode' : 'several'}, under{' '}
            {profile.manufacturer}&rsquo;s own names:{' '}
            {adaptiveModes.map((mode, index) => (
              <span key={mode.id}>
                {index > 0 ? ', ' : ''}
                <strong>{mode.label}</strong>
              </span>
            ))}
            . Another manufacturer will call the same behaviour something else, which is the reason
            to read a mode by its variables rather than by its name.
          </p>
        </div>
      ) : null}

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        Mode availability, labels, and confirmation workflow are specific to the selected training
        console and come from its source-bound profile. The four-variable description is what
        carries across devices; the names do not.
      </ModelBoundary>
    </section>
  )
}
