'use client'

/**
 * Section 5 — Triggering and cycling.
 *
 * The lesson's demand is "separate inspiratory trigger from expiratory cycling", so the figure is
 * two timelines drawn against each other: what the patient did (from the effort trace) and what the
 * machine did (from the breath phase). The divergence is visible at each end of inspiration, and
 * the learner picks which end they are looking at.
 */
import { useMemo, useState } from 'react'

import type { VentilationSimulationState, WaveformSample } from '../../engine'
import {
  AwaitingBreath,
  ModelBoundary,
  TextEquivalent,
  latestBreath,
  round,
  styles,
  tracePath,
} from './shared'

type Transition = 'trigger' | 'cycle'

const transitionCopy: Readonly<
  Record<
    Transition,
    { readonly label: string; readonly question: string; readonly modes: readonly string[] }
  >
> = {
  trigger: {
    label: 'Trigger',
    question: 'Did the effort that started this breath get one, and how promptly?',
    modes: [
      'Delayed — the breath arrives, but late. The effort has already begun before the machine answers, so the patient does work the ventilator does not see.',
      'Missed — an effort occurs and produces no breath. On the trace it is a deflection with no delivery after it. It is the finding most often read as a quiet patient.',
      'False — a breath arrives with no effort behind it. Circuit water, a leak, or cardiac oscillation can all present the trigger with a signal the patient did not make.',
    ],
  },
  cycle: {
    label: 'Cycle',
    question: 'Did inspiration end when the patient stopped wanting it?',
    modes: [
      'Premature — the machine ends inspiration while effort continues. The patient pulls against a closing valve, and often triggers again immediately.',
      'Delayed — the machine holds inspiration after effort has stopped. The patient is now exhaling against a delivered breath, and the expiratory limb starts short.',
      'Matched — mechanical and neural inspiration end together. This is what the other two are read against, not a number to hit.',
    ],
  },
}

/**
 * Neural inspiration: the *one* contiguous span of effort containing this window's deepest
 * deflection.
 *
 * Taking the first and last qualifying samples instead spans every effort in the window, so a
 * window holding several ineffective efforts reported a neural inspiration of many seconds — which
 * is not a breath, and made the machine-versus-patient comparison meaningless in exactly the cases
 * the section is about.
 */
function neuralWindow(breath: readonly WaveformSample[]): {
  readonly startFraction: number
  readonly endFraction: number
  readonly seconds: number
} {
  const empty = { startFraction: 0, endFraction: 0, seconds: 0 }
  if (breath.length < 2) return empty
  let troughIndex = -1
  let trough = 0
  breath.forEach((sample, index) => {
    if (sample.pmusCmH2O < trough) {
      trough = sample.pmusCmH2O
      troughIndex = index
    }
  })
  // Half this window's peak effort — a shape-relative cut, not a physiological threshold.
  const cut = trough / 2
  if (troughIndex < 0 || cut >= 0) return empty

  let start = troughIndex
  while (start > 0 && breath[start - 1].pmusCmH2O <= cut) start -= 1
  let end = troughIndex
  while (end < breath.length - 1 && breath[end + 1].pmusCmH2O <= cut) end += 1

  const first = breath[0].time
  const duration = Math.max(0.02, breath[breath.length - 1].time - first)
  return {
    startFraction: (breath[start].time - first) / duration,
    endFraction: (breath[end].time - first) / duration,
    seconds: breath[end].time - breath[start].time,
  }
}

export function VentilationTriggerAndCycle({
  state,
}: {
  readonly state: VentilationSimulationState
}) {
  const [selected, setSelected] = useState<Transition>('trigger')
  const breath = useMemo(() => latestBreath(state.waveforms), [state.waveforms])
  const neural = useMemo(() => neuralWindow(breath), [breath])
  const { measurements } = state

  const machineStart = 0
  const lastInspiratory = breath.reduce(
    (last, sample, index) => (sample.phase === 'inspiration' ? index : last),
    0,
  )
  const first = breath[0]?.time ?? 0
  const duration = Math.max(0.02, (breath.at(-1)?.time ?? 0) - first)
  const machineEnd = breath.length > 1 ? (breath[lastInspiratory].time - first) / duration : 0

  const effortPresent = neural.seconds > 0
  const triggerDelayMs = measurements.triggerDelayMs
  const ineffectivePercent = measurements.ineffectiveEffortFraction * 100
  const autotriggerPercent = measurements.autotriggerFraction * 100
  const machineSeconds = measurements.mechanicalInspiratoryTimeSeconds

  // Direction only: which of the two inspirations ended first, never "by more than X".
  const cycleRelation = !effortPresent
    ? 'not comparable — no appreciable effort this breath'
    : machineSeconds > neural.seconds
      ? 'the machine held inspiration after effort had stopped'
      : machineSeconds < neural.seconds
        ? 'the machine ended inspiration while effort continued'
        : 'the two ended together'

  const width = 300
  const laneHeight = 26
  const effortPath = tracePath(breath, 'pmusCmH2O', -25, 5, width, 62)
  const flowPath = tracePath(breath, 'flowLMin', -80, 80, width, 62)

  const summary =
    breath.length === 0
      ? 'No complete breath yet, so patient and machine timing cannot be compared.'
      : `Two timelines for the most recent breath. The machine's inspiration runs from the start of the breath for ${round(machineSeconds, 2)} seconds. Patient effort ${effortPresent ? `runs for ${round(neural.seconds, 2)} seconds` : 'is not appreciable this breath'}. At the cycle end, ${cycleRelation}. Measured trigger delay is ${round(triggerDelayMs)} milliseconds, ineffective efforts ${round(ineffectivePercent)} percent of efforts, and breaths with no effort behind them ${round(autotriggerPercent)} percent. The selected transition is ${transitionCopy[selected].label}.`

  return (
    <section className={styles.panel} aria-labelledby="mv-timing-teaching">
      <header className={styles.panelHeader}>
        <span>Timing view</span>
        <h2 id="mv-timing-teaching">Two clocks, and where they diverge</h2>
        <p>
          A breath has two beginnings and two ends — the patient’s and the machine’s. Naming which
          transition is mismatched comes before touching a control, because the same complaint is
          produced at both ends by opposite problems.
        </p>
      </header>

      {breath.length === 0 ? (
        <AwaitingBreath label="Trigger and cycle" />
      ) : (
        <figure className={styles.figure}>
          <svg viewBox="0 0 300 196" role="img" aria-label={summary}>
            {/* Machine inspiration lane */}
            <text className={styles.laneLabel} x="0" y="10">
              Machine
            </text>
            <rect className={styles.laneTrack} x="0" y="14" width={width} height={laneHeight} />
            <rect
              className={styles.laneMachine}
              x={machineStart * width}
              y="14"
              width={Math.max(2, (machineEnd - machineStart) * width)}
              height={laneHeight}
            />

            {/* Patient effort lane */}
            <text className={styles.laneLabel} x="0" y="60">
              Patient
            </text>
            <rect className={styles.laneTrack} x="0" y="64" width={width} height={laneHeight} />
            {effortPresent ? (
              <rect
                className={styles.lanePatient}
                x={neural.startFraction * width}
                y="64"
                width={Math.max(2, (neural.endFraction - neural.startFraction) * width)}
                height={laneHeight}
              />
            ) : null}

            {/* The two transitions, emphasized by selection. */}
            {/* Staggered rows: the two transitions sit close together whenever the trigger is
                prompt, and their labels would otherwise print on top of one another. */}
            <g
              className={
                selected === 'trigger' ? styles.variableMarker : styles.variableMarkerMuted
              }
            >
              <path d={`M${(neural.startFraction * width).toFixed(1)} 10 V190`} />
              <text x={Math.min(neural.startFraction * width + 4, 236)} y="100">
                Trigger
              </text>
            </g>
            <g
              className={selected === 'cycle' ? styles.variableMarker : styles.variableMarkerMuted}
            >
              <path d={`M${(machineEnd * width).toFixed(1)} 10 V190`} />
              <text x={Math.min(machineEnd * width + 4, 244)} y="110">
                Cycle
              </text>
            </g>

            <g transform="translate(0 110)">
              <path className={styles.traceGrid} d="M0 62 H300" />
              <path className={styles.traceEffort} d={effortPath} />
            </g>
            <g transform="translate(0 128)">
              <path className={styles.zeroFlowLine} d="M0 31 H300" />
              <path className={styles.traceMuted} d={flowPath} />
            </g>
          </svg>
          <figcaption>
            Top two bars: when the machine was inspiring, and when the patient was. Below them, the
            effort and flow traces the bars are derived from. The selected transition is emphasized.
          </figcaption>
        </figure>
      )}

      <dl className={styles.readouts} aria-label="Measured timing signals">
        <div>
          <dt>Trigger delay</dt>
          <dd>
            {round(triggerDelayMs)} <small>ms</small>
          </dd>
        </div>
        <div data-state={effortPresent ? undefined : 'unavailable'}>
          <dt>Neural inspiration</dt>
          <dd>
            {effortPresent ? round(neural.seconds, 2) : '—'} <small>s</small>
          </dd>
        </div>
        <div>
          <dt>Machine inspiration</dt>
          <dd>
            {round(machineSeconds, 2)} <small>s</small>
          </dd>
        </div>
        <div data-state={ineffectivePercent > 0 ? undefined : 'unavailable'}>
          <dt>Ineffective efforts</dt>
          <dd>
            {round(ineffectivePercent)} <small>%</small>
          </dd>
        </div>
        <div data-state={autotriggerPercent > 0 ? undefined : 'unavailable'}>
          <dt>Breaths with no effort</dt>
          <dd>
            {round(autotriggerPercent)} <small>%</small>
          </dd>
        </div>
      </dl>

      <div className={styles.componentToggles}>
        {(['trigger', 'cycle'] as const).map((transition) => (
          <button
            key={transition}
            type="button"
            aria-pressed={selected === transition}
            onClick={() => setSelected(transition)}
          >
            {transitionCopy[transition].label}
          </button>
        ))}
      </div>

      <div className={styles.stepDetail}>
        <span>{transitionCopy[selected].question}</span>
        <ul className={styles.plainList}>
          {transitionCopy[selected].modes.map((mode) => (
            <li key={mode}>{mode}</li>
          ))}
        </ul>
        <span>Right now</span>
        <p>
          {selected === 'trigger'
            ? `Measured trigger delay is ${round(triggerDelayMs)} ms, with ${round(ineffectivePercent)}% of efforts producing no breath and ${round(autotriggerPercent)}% of breaths having no effort behind them. A rise in the last of those points away from the patient and toward the circuit.`
            : `Mechanical inspiration is ${round(machineSeconds, 2)} s against a neural inspiration of ${effortPresent ? `${round(neural.seconds, 2)} s` : 'no appreciable effort'}, so ${cycleRelation}.`}
        </p>
      </div>

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        Neural inspiration here is read off the modeled effort signal, using each breath’s own peak
        effort as the reference — a shape comparison, not a measured airway occlusion pressure. No
        limit is stated for what counts as an acceptable delay; that belongs to this module’s source
        reconciliation and to the bedside.
      </ModelBoundary>
    </section>
  )
}
