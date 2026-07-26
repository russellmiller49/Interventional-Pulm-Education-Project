'use client'

import { useMemo, useState } from 'react'

import type { VentilationSimulationState, WaveformSample } from '../engine'
import styles from './mechanical-ventilation-teaching.module.css'

/**
 * Per-section teaching panels for the Mechanical Ventilation Learn pathway.
 *
 * These occupy the middle pane of the three-pane workspace, between the live bedside and the
 * console the learner acts through. Every figure is computed from live simulation state rather
 * than drawn as static art, carries a computed `aria-label`, and is followed by a text equivalent.
 *
 * Deliberately no numeric targets or threshold tables: this module's source reconciliation is
 * still pending, so the teaching claims here are about relationships between signals.
 */

const EMPTY_STATE_NOTE =
  'Waveform data appears once the simulation has produced a breath. Advance the case to populate this figure.'

function round(value: number, places = 0): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * The most recent *complete* breath cycle: from one inspiration onset to the next.
 *
 * Slicing by phase from the tail instead truncates whichever phase is in progress, which drew a
 * pressure trace that stepped down and flattened rather than showing a breath. Cutting between
 * successive inspiration onsets also keeps a double-triggered pair together in one window, which
 * is what the dyssynchrony cases need to be legible.
 */
function latestBreath(samples: readonly WaveformSample[]): readonly WaveformSample[] {
  if (samples.length < 4) return []
  const onsets: number[] = []
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].phase === 'inspiration' && samples[index - 1].phase === 'expiration') {
      onsets.push(index)
    }
  }
  if (onsets.length >= 2) {
    const start = onsets[onsets.length - 2]
    const end = onsets[onsets.length - 1]
    if (end - start >= 4) return samples.slice(start, end)
  }
  // No two onsets in the window yet: fall back to the most recent second or so of samples.
  return samples.slice(-Math.min(samples.length, 80))
}

function tracePath(
  samples: readonly WaveformSample[],
  field: 'pawCmH2O' | 'flowLMin' | 'volumeMl' | 'pmusCmH2O',
  minimum: number,
  maximum: number,
  width = 300,
  height = 78,
): string {
  if (samples.length === 0) return ''
  const firstTime = samples[0].time
  const duration = Math.max(0.02, samples[samples.length - 1].time - firstTime)
  return samples
    .map((sample, index) => {
      const x = ((sample.time - firstTime) / duration) * width
      const normalized = Math.max(0, Math.min(1, (sample[field] - minimum) / (maximum - minimum)))
      const y = height - normalized * (height - 6) - 3
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function TextEquivalent({ children }: { readonly children: string }) {
  return (
    <p className={styles.textEquivalent}>
      <strong>Visual text equivalent:</strong> {children}
    </p>
  )
}

function ModelBoundary({ children }: { readonly children: string }) {
  return <p className={styles.boundary}>{children}</p>
}

/* ------------------------------------------------------------------------------------------------
 * Section 1 — Mechanics: what peak pressure is made of
 * ---------------------------------------------------------------------------------------------- */

type PressureComponent = 'baseline' | 'elastic' | 'resistive'

const componentCopy: Readonly<
  Record<PressureComponent, { readonly label: string; readonly body: string }>
> = {
  baseline: {
    label: 'Baseline',
    body: 'The pressure the respiratory system is held at before this breath begins — set PEEP plus any trapped pressure that did not escape during the previous expiration. Everything else is measured on top of it, so a rise here raises peak pressure without anything about the lung having changed.',
  },
  elastic: {
    label: 'Elastic',
    body: 'The pressure required to distend the respiratory system by this breath’s volume. It is what remains at end-inspiration when flow has stopped, which is why an inspiratory hold isolates it. It scales with delivered volume and with how stiff the system is.',
  },
  resistive: {
    label: 'Resistive',
    body: 'The pressure spent moving gas through the tube and airways. It exists only while gas is flowing, so it disappears during a hold — the peak-to-plateau difference is this component. It scales with flow and with the resistance the gas meets.',
  },
}

export function VentilationPressureDecomposition({
  state,
}: {
  readonly state: VentilationSimulationState
}) {
  const [focused, setFocused] = useState<PressureComponent | null>(null)
  const { measurements, ventilator } = state
  const setPeep = ventilator.settings.peepCmH2O
  const intrinsic = measurements.intrinsicPeepCmH2O
  const totalBaseline = setPeep + intrinsic
  const peak = measurements.peakPressureCmH2O
  const plateau = measurements.plateauPressureCmH2O
  const elastic = Math.max(0, plateau - totalBaseline)
  const resistive = Math.max(0, peak - plateau)
  const scaleMax = Math.max(peak, totalBaseline + elastic + resistive, 1)

  const height = 150
  const barLeft = 66
  const barWidth = 106
  const pxPerUnit = (height - 26) / scaleMax
  const baselineHeight = totalBaseline * pxPerUnit
  const elasticHeight = elastic * pxPerUnit
  const resistiveHeight = resistive * pxPerUnit
  const baseY = height - 14

  const dim = (component: PressureComponent) =>
    focused && focused !== component ? styles.segmentMuted : undefined

  const summary = `Peak airway pressure ${round(peak, 1)} centimeters of water decomposes into a baseline of ${round(totalBaseline, 1)} — set PEEP ${round(setPeep, 1)} plus ${round(intrinsic, 1)} of trapped pressure — an elastic component of ${round(elastic, 1)} measured as plateau minus baseline, and a resistive component of ${round(resistive, 1)} measured as peak minus plateau.`

  return (
    <section className={styles.panel} aria-labelledby="mv-mechanics-teaching">
      <header className={styles.panelHeader}>
        <span>Mechanism view</span>
        <h2 id="mv-mechanics-teaching">What peak pressure is made of</h2>
        <p>
          Peak pressure is a sum, not a measurement of the lung. Select a component to see what it
          reports and what changes it.
        </p>
      </header>

      <figure className={styles.figure}>
        <svg viewBox={`0 0 300 ${height}`} role="img" aria-label={summary}>
          {[0.25, 0.5, 0.75, 1].map((fraction) => (
            <path
              key={fraction}
              className={styles.gridLine}
              d={`M${barLeft - 6} ${baseY - (height - 26) * fraction} H196`}
            />
          ))}
          <path className={styles.axis} d={`M${barLeft - 6} 8 V${baseY} H196`} />

          <rect
            className={[styles.segmentBaseline, dim('baseline')].filter(Boolean).join(' ')}
            x={barLeft}
            y={baseY - baselineHeight}
            width={barWidth}
            height={Math.max(1, baselineHeight)}
          />
          <rect
            className={[styles.segmentElastic, dim('elastic')].filter(Boolean).join(' ')}
            x={barLeft}
            y={baseY - baselineHeight - elasticHeight}
            width={barWidth}
            height={Math.max(1, elasticHeight)}
          />
          <rect
            className={[styles.segmentResistive, dim('resistive')].filter(Boolean).join(' ')}
            x={barLeft}
            y={baseY - baselineHeight - elasticHeight - resistiveHeight}
            width={barWidth}
            height={Math.max(1, resistiveHeight)}
          />

          {/*
           * Component magnitude sits inside its own band; the cumulative console pressure sits
           * outside, on the band's upper edge. Putting only the cumulative value beside the band
           * name read as "the resistive component is <peak>", which is wrong by the plateau.
           */}
          <text className={styles.segmentLabel} x="4" y={baseY - baselineHeight / 2 - 4}>
            Baseline
          </text>
          <text className={styles.segmentBandValue} x="4" y={baseY - baselineHeight / 2 + 7}>
            {round(totalBaseline, 1)} cmH₂O
          </text>

          <text
            className={styles.segmentLabel}
            x="4"
            y={baseY - baselineHeight - elasticHeight / 2 - 4}
          >
            Elastic
          </text>
          <text
            className={styles.segmentBandValue}
            x="4"
            y={baseY - baselineHeight - elasticHeight / 2 + 7}
          >
            +{round(elastic, 1)} cmH₂O
          </text>

          <text
            className={styles.segmentLabel}
            x="4"
            y={baseY - baselineHeight - elasticHeight - resistiveHeight / 2 - 4}
          >
            Resistive
          </text>
          <text
            className={styles.segmentBandValue}
            x="4"
            y={baseY - baselineHeight - elasticHeight - resistiveHeight / 2 + 7}
          >
            +{round(resistive, 1)} cmH₂O
          </text>

          <path
            className={styles.boundaryTick}
            d={`M${barLeft + barWidth} ${baseY - baselineHeight - elasticHeight} h10`}
          />
          <text
            className={styles.segmentValue}
            x={barLeft + barWidth + 13}
            y={baseY - baselineHeight - elasticHeight + 4}
          >
            Pplat {round(plateau, 1)}
          </text>
          <path
            className={styles.boundaryTick}
            d={`M${barLeft + barWidth} ${baseY - baselineHeight - elasticHeight - resistiveHeight} h10`}
          />
          <text
            className={styles.segmentValue}
            x={barLeft + barWidth + 13}
            y={baseY - baselineHeight - elasticHeight - resistiveHeight + 4}
          >
            Ppeak {round(peak, 1)}
          </text>
        </svg>
        <figcaption>
          Each band is labelled with its own magnitude. The values on the right are the cumulative
          pressures a console reports at those boundaries — plateau at the top of the elastic band,
          peak at the top of the resistive band.
        </figcaption>
      </figure>

      <div className={styles.componentToggles}>
        {(['baseline', 'elastic', 'resistive'] as const).map((component) => (
          <button
            key={component}
            type="button"
            aria-pressed={focused === component}
            onClick={() => setFocused((current) => (current === component ? null : component))}
          >
            {componentCopy[component].label}
          </button>
        ))}
      </div>

      {focused ? (
        <div className={styles.stepDetail}>
          <span>{componentCopy[focused].label} component</span>
          <p>{componentCopy[focused].body}</p>
        </div>
      ) : (
        <div className={styles.equation}>
          <strong>Equation of motion</strong>
          Pressure = (volume ÷ compliance) + (flow × resistance) + baseline. The three bars are
          those three terms, in the same order.
        </div>
      )}

      <dl className={styles.readouts} aria-label="Live derived mechanics">
        <div>
          <dt>Peak − plateau</dt>
          <dd>
            {round(resistive, 1)} <small>cmH₂O</small>
          </dd>
        </div>
        <div data-state={measurements.staticComplianceMlCmH2O > 0 ? undefined : 'unavailable'}>
          <dt>Static compliance</dt>
          <dd>
            {measurements.staticComplianceMlCmH2O > 0
              ? round(measurements.staticComplianceMlCmH2O, 1)
              : '—'}{' '}
            <small>mL/cmH₂O</small>
          </dd>
        </div>
        <div data-state={intrinsic > 0 ? undefined : 'unavailable'}>
          <dt>Trapped pressure</dt>
          <dd>
            {round(intrinsic, 1)} <small>cmH₂O</small>
          </dd>
        </div>
      </dl>

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        Compliance and resistance here are derived from the bounded educational model and assume a
        relaxed patient. Numeric safety limits are deliberately not stated; they belong to this
        module’s source reconciliation and to local policy.
      </ModelBoundary>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------------
 * Section 2 — Waveforms: a repeatable reading sequence
 * ---------------------------------------------------------------------------------------------- */

type ReadingStepId = 'pressure' | 'inspiratory-flow' | 'expiratory-flow' | 'volume' | 'effort'

interface ReadingStep {
  readonly id: ReadingStepId
  readonly title: string
  readonly cue: string
  readonly lookFor: string
  readonly meaning: string
}

const readingSteps: readonly ReadingStep[] = [
  {
    id: 'pressure',
    title: 'Pressure',
    cue: 'Shape first, then height',
    lookFor:
      'Whether the pressure trace rises to a peak and falls, or rises and holds a shelf, and whether the breath starts from the baseline you expect.',
    meaning:
      'The shape tells you how the breath is being delivered before any number matters. A shelf at end-inspiration means flow has stopped and what remains is distending pressure.',
  },
  {
    id: 'inspiratory-flow',
    title: 'Inspiratory flow',
    cue: 'Square, decelerating, or shaped by the patient',
    lookFor:
      'The pattern of flow during inspiration, and whether it looks imposed by the ventilator or pulled by the patient.',
    meaning:
      'A constant flow implies the ventilator is setting it. A decelerating flow implies pressure is the target and flow follows the lung. A ragged or scooped inspiratory limb implies the patient is contributing.',
  },
  {
    id: 'expiratory-flow',
    title: 'Expiratory flow',
    cue: 'Does it return to zero?',
    lookFor:
      'Whether expiratory flow reaches the zero line before the next breath starts, and how steeply it decays.',
    meaning:
      'Expiration that is still flowing when the next breath begins means the previous breath did not finish emptying. This is the single most informative part of the trace and the easiest to skip.',
  },
  {
    id: 'volume',
    title: 'Volume',
    cue: 'Does it come back?',
    lookFor: 'Whether the volume trace returns to its starting point at the end of expiration.',
    meaning:
      'Volume that does not return either stayed in the chest or left the circuit. Which of those it was is settled by the expiratory flow limb and by inspecting the circuit — not by the volume trace alone.',
  },
  {
    id: 'effort',
    title: 'Patient effort',
    cue: 'Who started this breath?',
    lookFor:
      'Negative deflections that precede or interrupt the machine breath, and whether each effort produced a breath.',
    meaning:
      'Effort changes how every other trace should be read, and it invalidates hold maneuvers. An effort that produced no breath is as informative as one that did.',
  },
]

export function VentilationWaveformReadingSequence({
  state,
}: {
  readonly state: VentilationSimulationState
}) {
  const [activeStepId, setActiveStepId] = useState<ReadingStepId>('pressure')
  const breath = useMemo(() => latestBreath(state.waveforms), [state.waveforms])
  const activeStep = readingSteps.find((step) => step.id === activeStepId) ?? readingSteps[0]

  const pressurePath = tracePath(breath, 'pawCmH2O', -5, 45)
  const flowPath = tracePath(breath, 'flowLMin', -80, 80)
  const volumePath = tracePath(breath, 'volumeMl', 0, 800)
  const effortPath = tracePath(breath, 'pmusCmH2O', -25, 5)

  const focusesFlow = activeStepId === 'inspiratory-flow' || activeStepId === 'expiratory-flow'
  const traceClass = (isActive: boolean) => (isActive ? styles.trace : styles.traceMuted)

  const expiratoryEndFlow = state.measurements.expiratoryFlowAtNextBreathLMin
  const returnsToZero = Math.abs(expiratoryEndFlow) < 1
  const summary =
    breath.length === 0
      ? EMPTY_STATE_NOTE
      : `One breath is shown as four stacked traces: pressure, flow, volume, and patient effort. Expiratory flow at the moment the next breath begins is ${round(expiratoryEndFlow, 1)} liters per minute, which ${returnsToZero ? 'is effectively zero, so this breath finished emptying' : 'is not zero, so this breath had not finished emptying'}. The currently selected reading step is ${activeStep.title}.`

  return (
    <section className={styles.panel} aria-labelledby="mv-waveform-teaching">
      <header className={styles.panelHeader}>
        <span>Reading sequence</span>
        <h2 id="mv-waveform-teaching">Read the traces in a fixed order</h2>
        <p>
          The order is the skill. Naming a pattern before finishing the sequence is how the
          expiratory limb gets missed.
        </p>
      </header>

      <figure className={styles.figure}>
        <svg viewBox="0 0 300 336" role="img" aria-label={summary}>
          {[0, 84, 168, 252].map((offset) => (
            <path key={offset} className={styles.traceGrid} d={`M0 ${offset + 78} H300`} />
          ))}
          <g transform="translate(0 0)">
            <path className={traceClass(activeStepId === 'pressure')} d={pressurePath} />
          </g>
          <g transform="translate(0 84)">
            {/* Zero-flow reference: the line the expiratory limb has to reach. */}
            <path className={styles.zeroFlowLine} d="M0 39 H300" />
            <path className={traceClass(focusesFlow)} d={flowPath} />
          </g>
          <g transform="translate(0 168)">
            <path className={traceClass(activeStepId === 'volume')} d={volumePath} />
          </g>
          <g transform="translate(0 252)">
            <path className={traceClass(activeStepId === 'effort')} d={effortPath} />
          </g>
        </svg>
        <figcaption>
          Pressure, flow, volume, and patient effort for the most recent breath. The dashed line on
          the flow trace is zero flow. The selected step is emphasized; the others are dimmed.
        </figcaption>
      </figure>

      <ol className={styles.steps}>
        {readingSteps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              aria-current={step.id === activeStepId ? 'step' : undefined}
              onClick={() => setActiveStepId(step.id)}
            >
              <span aria-hidden="true">{index + 1}</span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.cue}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.stepDetail}>
        <span>Look for</span>
        <p>{activeStep.lookFor}</p>
        <span>What it means</span>
        <p>{activeStep.meaning}</p>
      </div>

      <TextEquivalent>{summary}</TextEquivalent>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------------
 * Section 9 — High peak pressure: four mechanisms behind one alarm
 * ---------------------------------------------------------------------------------------------- */

type MechanismId = 'resistance' | 'compliance' | 'auto-peep' | 'effort'

/**
 * `neutral` and `invalidates` exist because "argues against" was overclaiming. Patient effort
 * being present does not argue against a resistive rise — it simply does not discriminate. And
 * for the plateau-dependent mechanisms, effort does not weigh against them either: it makes the
 * plateau uninterpretable, which is a statement about the measurement rather than the mechanism.
 */
type Verdict = 'consistent' | 'against' | 'neutral' | 'invalidates' | 'unmeasured'

const verdictLabels: Readonly<Record<Verdict, string>> = {
  consistent: 'Consistent',
  against: 'Argues against',
  neutral: 'Not discriminating',
  invalidates: 'Measurement invalid',
  unmeasured: 'Not measured',
}

interface MechanismPrediction {
  readonly signal: string
  readonly expectation: string
  readonly verdict: Verdict
  readonly observed: string
}

const mechanismLabels: Readonly<Record<MechanismId, string>> = {
  resistance: 'Resistive: tube, secretions, or bronchospasm',
  compliance: 'Reduced respiratory-system compliance',
  'auto-peep': 'Dynamic hyperinflation with trapped volume',
  effort: 'Patient effort shaping the measurement',
}

export function VentilationHighPressureDiscriminator({
  state,
}: {
  readonly state: VentilationSimulationState
}) {
  const [selected, setSelected] = useState<MechanismId | null>(null)
  const { measurements, ventilator } = state
  const gap = Math.max(0, measurements.peakPressureCmH2O - measurements.plateauPressureCmH2O)
  const plateauAboveBaseline = Math.max(
    0,
    measurements.plateauPressureCmH2O - ventilator.settings.peepCmH2O,
  )
  const expiratoryEndFlow = measurements.expiratoryFlowAtNextBreathLMin
  const breath = useMemo(() => latestBreath(state.waveforms), [state.waveforms])
  const peakEffort = breath.reduce((lowest, sample) => Math.min(lowest, sample.pmusCmH2O), 0)
  const plateauMeasured = measurements.plateauPressureCmH2O > 0
  const effortPresent = peakEffort < -1.5

  const predictionsFor = (mechanism: MechanismId): readonly MechanismPrediction[] => {
    const trapping = Math.abs(expiratoryEndFlow) >= 1
    const plateauObserved = plateauMeasured
      ? `${round(plateauAboveBaseline, 1)} cmH₂O above baseline`
      : 'No plateau measured — perform an inspiratory hold'
    const effortObserved = effortPresent
      ? `Effort present, ${round(peakEffort, 1)} cmH₂O`
      : 'No appreciable effort'

    // Plateau-derived rows are only interpretable in a relaxed patient, so an unexcluded effort
    // invalidates them rather than counting for or against the mechanism.
    const plateauVerdict = (consistentWhen: boolean): Verdict =>
      !plateauMeasured
        ? 'unmeasured'
        : effortPresent
          ? 'invalidates'
          : consistentWhen
            ? 'consistent'
            : 'against'

    const gapRow = (expectation: string, verdict: Verdict): MechanismPrediction => ({
      signal: 'Peak-to-plateau difference',
      expectation,
      verdict,
      observed: plateauMeasured
        ? `${round(gap, 1)} cmH₂O`
        : 'No plateau measured — perform an inspiratory hold',
    })
    const plateauRow = (expectation: string, verdict: Verdict): MechanismPrediction => ({
      signal: 'Plateau above baseline',
      expectation,
      verdict,
      observed: plateauObserved,
    })
    const expiratoryRow = (expectation: string, verdict: Verdict): MechanismPrediction => ({
      signal: 'Expiratory flow at next breath',
      expectation,
      verdict,
      observed: `${round(expiratoryEndFlow, 1)} L/min`,
    })
    const effortRow = (expectation: string, verdict: Verdict): MechanismPrediction => ({
      signal: 'Patient effort this breath',
      expectation,
      verdict,
      observed: effortObserved,
    })

    if (mechanism === 'resistance') {
      return [
        gapRow('Widened — the extra pressure is spent moving gas', plateauVerdict(gap > 6)),
        plateauRow('Little changed — the system is no stiffer', plateauVerdict(gap > 6)),
        expiratoryRow('Reaches zero unless trapping coexists', trapping ? 'against' : 'consistent'),
        effortRow('Compatible with or without effort', 'neutral'),
      ]
    }
    if (mechanism === 'compliance') {
      return [
        gapRow('Little changed — flow still meets the same resistance', plateauVerdict(gap <= 6)),
        plateauRow(
          'Raised — more pressure is needed to distend the same volume',
          plateauVerdict(gap <= 6),
        ),
        expiratoryRow('Reaches zero unless trapping coexists', trapping ? 'against' : 'consistent'),
        effortRow(
          'Must be excluded before the plateau can be trusted',
          effortPresent ? 'invalidates' : 'consistent',
        ),
      ]
    }
    if (mechanism === 'auto-peep') {
      return [
        gapRow('May be normal or widened; not discriminating on its own', 'neutral'),
        plateauRow(
          'Raised, because the breath started above set PEEP',
          plateauVerdict(plateauAboveBaseline > 0),
        ),
        expiratoryRow(
          'Does not reach zero before the next breath — the discriminating finding',
          trapping ? 'consistent' : 'against',
        ),
        effortRow('Often present as ineffective efforts, but not required', 'neutral'),
      ]
    }
    return [
      gapRow(
        'Not interpretable while the patient is active',
        effortPresent ? 'invalidates' : 'neutral',
      ),
      plateauRow(
        'Not interpretable while the patient is active',
        effortPresent ? 'invalidates' : 'neutral',
      ),
      expiratoryRow(
        'May be cut short by an early next effort',
        trapping ? 'consistent' : 'neutral',
      ),
      effortRow('Present, by definition', effortPresent ? 'consistent' : 'against'),
    ]
  }

  const predictions = selected ? predictionsFor(selected) : []
  const summary = `Peak ${round(measurements.peakPressureCmH2O, 1)}, plateau ${plateauMeasured ? round(measurements.plateauPressureCmH2O, 1) : 'not measured'}, peak-to-plateau difference ${plateauMeasured ? round(gap, 1) : 'unavailable'}, expiratory flow at the next breath ${round(expiratoryEndFlow, 1)} liters per minute, and patient effort ${effortPresent ? `present at ${round(peakEffort, 1)} centimeters of water` : 'not appreciable'}.${selected ? ` The selected mechanism is ${mechanismLabels[selected]}.` : ' No mechanism has been selected yet.'}`

  return (
    <section className={styles.panel} aria-labelledby="mv-discriminator-teaching">
      <header className={styles.panelHeader}>
        <span>Integration</span>
        <h2 id="mv-discriminator-teaching">One alarm, four mechanisms</h2>
        <p>
          Select the mechanism you think is dominant. The panel then shows what that mechanism
          predicts for each discriminating signal, and compares it against what is measured now.
        </p>
      </header>

      <dl className={styles.readouts} aria-label="Discriminating signals">
        <div>
          <dt>Peak</dt>
          <dd>
            {round(measurements.peakPressureCmH2O, 1)} <small>cmH₂O</small>
          </dd>
        </div>
        <div data-state={plateauMeasured ? undefined : 'unavailable'}>
          <dt>Plateau</dt>
          <dd>
            {plateauMeasured ? round(measurements.plateauPressureCmH2O, 1) : '—'}{' '}
            <small>cmH₂O</small>
          </dd>
        </div>
        <div data-state={plateauMeasured ? undefined : 'unavailable'}>
          <dt>Peak − plateau</dt>
          <dd>
            {plateauMeasured ? round(gap, 1) : '—'} <small>cmH₂O</small>
          </dd>
        </div>
        <div>
          <dt>Exp. flow at next</dt>
          <dd>
            {round(expiratoryEndFlow, 1)} <small>L/min</small>
          </dd>
        </div>
        <div data-state={effortPresent ? undefined : 'unavailable'}>
          <dt>Patient effort</dt>
          <dd>
            {effortPresent ? round(peakEffort, 1) : 'None'}{' '}
            {effortPresent ? <small>cmH₂O</small> : null}
          </dd>
        </div>
      </dl>

      <div className={styles.candidates} role="group" aria-label="Candidate mechanisms">
        {(['resistance', 'compliance', 'auto-peep', 'effort'] as const).map((mechanism) => (
          <button
            key={mechanism}
            type="button"
            aria-pressed={selected === mechanism}
            onClick={() => setSelected((current) => (current === mechanism ? null : mechanism))}
          >
            {mechanismLabels[mechanism]}
          </button>
        ))}
      </div>

      {selected ? (
        <div
          className={styles.evidenceTable}
          aria-label={`Predictions for ${mechanismLabels[selected]}`}
        >
          {predictions.map((prediction) => (
            <div key={prediction.signal} className={styles.evidenceRow}>
              <span>
                {prediction.signal}
                <small>Predicted: {prediction.expectation}</small>
                <small>Observed: {prediction.observed}</small>
              </span>
              <span className={styles.verdict} data-verdict={prediction.verdict}>
                {verdictLabels[prediction.verdict]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.stepDetail}>
          <span>Before selecting</span>
          <p>
            Establish whether the measurements are interpretable at all. An inspiratory hold in an
            actively breathing patient does not report mechanics, so an unexcluded effort makes
            every plateau-based comparison below unreliable rather than reassuring.
          </p>
        </div>
      )}

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        More than one mechanism can be present at once; the useful claim is which is dominant now.
        The comparisons above use relationships between signals, not published thresholds, and are
        not a corrective protocol.
      </ModelBoundary>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------------
 * Dispatcher
 * ---------------------------------------------------------------------------------------------- */

/** Sections that currently have an authored teaching panel (WP10 follow-up, flagship three). */
export const ventilationTeachingPanelSectionIds = [
  'mechanics-load-and-pressure',
  'waveform-reading-sequence',
  'high-peak-pressure-integration',
] as const

export function hasVentilationTeachingPanel(lessonId: string): boolean {
  return (ventilationTeachingPanelSectionIds as readonly string[]).includes(lessonId)
}

export function MechanicalVentilationTeachingPanel({
  lessonId,
  state,
}: {
  readonly lessonId: string
  readonly state: VentilationSimulationState
}) {
  if (lessonId === 'mechanics-load-and-pressure') {
    return <VentilationPressureDecomposition state={state} />
  }
  if (lessonId === 'waveform-reading-sequence') {
    return <VentilationWaveformReadingSequence state={state} />
  }
  if (lessonId === 'high-peak-pressure-integration') {
    return <VentilationHighPressureDiscriminator state={state} />
  }
  return null
}
