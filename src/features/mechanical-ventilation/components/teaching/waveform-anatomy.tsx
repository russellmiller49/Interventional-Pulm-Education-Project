'use client'

/**
 * Section 1 — Waveform anatomy: three traces, one breath.
 *
 * Opens the pathway. Everything after it assumes the learner can look at a breath and say what
 * each trace is plotting and which variable the ventilator is holding, and that was the gap: the
 * module went straight to decomposing peak pressure without ever saying what the traces were.
 *
 * Two halves. The first names the three traces off the live breath. The second is the comparison
 * the section exists for — the same lung ventilated volume-targeted and pressure-targeted, side by
 * side, so the difference is a shape rather than a sentence.
 *
 * The comparison breaths are drawn closed-form from *this patient's* compliance and resistance
 * rather than simulated, because two live engine runs inside a render is not affordable and
 * because the point being made is about shape. They move with the case; they are not stock art.
 */
import { useMemo, useState, type Dispatch } from 'react'

import type { VentilationAction, VentilationSimulationState } from '../../engine'
import {
  AwaitingBreath,
  ModelBoundary,
  TextEquivalent,
  latestBreath,
  round,
  styles,
  tracePath,
} from './shared'

type TraceId = 'pressure' | 'flow' | 'volume'

const traceCopy: Readonly<
  Record<
    TraceId,
    {
      readonly label: string
      readonly plots: string
      readonly zero: string
      readonly shapedBy: string
    }
  >
> = {
  pressure: {
    label: 'Pressure',
    plots:
      'The pressure at the airway opening, against time. Not the pressure in the alveoli — the two are only the same when no gas is moving, which is why a hold is the only way to see the alveolar pressure directly.',
    zero: 'Read against the set baseline (PEEP), not against zero. A breath starts from the baseline and returns to it.',
    shapedBy:
      'While gas is flowing, the trace carries a resistive term — flow times resistance — on top of an elastic term that grows with the volume already delivered. Stop the flow and only the elastic term is left.',
  },
  flow: {
    label: 'Flow',
    plots:
      'The rate gas is moving, against time. It is the one signed trace: above the line is gas going into the patient, below the line is gas coming out.',
    zero: 'Read against zero. Where the trace crosses zero is where the breath turns around, and whether the expiratory limb reaches zero before the next breath is the most informative thing on the screen.',
    shapedBy:
      'The inspiratory limb is whatever the ventilator is doing. The expiratory limb is passive in every mode here — an exponential decay set by the lung and the circuit, not by any setting.',
  },
  volume: {
    label: 'Volume',
    plots:
      'The running total of flow — literally the area under the flow trace, integrated over the breath. It carries no information the flow trace does not, but it makes one question easy to ask.',
    zero: 'Read against its own starting point. The question is whether it comes back to where it began.',
    shapedBy:
      'It rises through inspiration to the delivered tidal volume and falls as the lung empties. Volume that does not return either stayed in the chest or left the circuit — the flow trace tells you which.',
  },
}

/* ------------------------------------------------------------------------------------------------
 * The comparison: the same lung, two controlled variables
 * ---------------------------------------------------------------------------------------------- */

interface IdealBreath {
  readonly pressure: readonly number[]
  readonly flow: readonly number[]
  readonly volume: readonly number[]
}

const SAMPLES = 120

/**
 * Closed-form breaths for the two delivery strategies, from this patient's own mechanics.
 *
 * Volume-targeted: flow is the set variable, so it is rectangular; volume is its integral, so it
 * ramps linearly; pressure is whatever the equation of motion demands — a step for the resistive
 * term and then a ramp as volume accumulates.
 *
 * Pressure-targeted: pressure is the set variable, so it is rectangular; flow is the gradient
 * across the resistance, which decays as the lung fills; volume is that decay integrated, so it
 * rises exponentially toward a limit.
 */
function idealBreaths(
  complianceLPerCmH2O: number,
  resistanceCmH2OPerLps: number,
  peepCmH2O: number,
  tidalVolumeL: number,
  drivingPressureCmH2O: number,
  inspiratorySeconds: number,
): { volumeTargeted: IdealBreath; pressureTargeted: IdealBreath } {
  const tau = Math.max(0.05, resistanceCmH2OPerLps * complianceLPerCmH2O)
  /*
   * Both limbs share one clock. Drawing inspiration and expiration on separate time axes made the
   * inspiratory flow rectangle look tiny beside the expiratory spike, which is a drawing artifact
   * rather than a property of the breath.
   */
  const expiratorySeconds = tau * 4
  const inspiratorySamples = Math.max(
    6,
    Math.round((SAMPLES * inspiratorySeconds) / (inspiratorySeconds + expiratorySeconds)),
  )
  const setFlowLps = tidalVolumeL / inspiratorySeconds

  const vcPressure: number[] = []
  const vcFlow: number[] = []
  const vcVolume: number[] = []
  const pcPressure: number[] = []
  const pcFlow: number[] = []
  const pcVolume: number[] = []

  for (let index = 0; index < SAMPLES; index += 1) {
    const inInspiration = index < inspiratorySamples
    const t = inInspiration
      ? (index / inspiratorySamples) * inspiratorySeconds
      : ((index - inspiratorySamples) / (SAMPLES - inspiratorySamples)) * expiratorySeconds

    if (inInspiration) {
      // Volume targeted — square flow, linear volume, ramping pressure.
      const volume = setFlowLps * t
      vcFlow.push(setFlowLps)
      vcVolume.push(volume)
      vcPressure.push(peepCmH2O + resistanceCmH2OPerLps * setFlowLps + volume / complianceLPerCmH2O)

      // Pressure targeted — rectangular pressure, decelerating flow, exponential volume.
      const filled = 1 - Math.exp(-t / tau)
      const pcVolumeL = drivingPressureCmH2O * complianceLPerCmH2O * filled
      pcFlow.push((drivingPressureCmH2O / resistanceCmH2OPerLps) * Math.exp(-t / tau))
      pcVolume.push(pcVolumeL)
      pcPressure.push(peepCmH2O + drivingPressureCmH2O)
    } else {
      // Expiration is passive in both: the same exponential emptying from wherever it got to.
      const decay = Math.exp(-t / tau)
      const vcVolumeL = tidalVolumeL * decay
      vcVolume.push(vcVolumeL)
      vcFlow.push(-vcVolumeL / tau)
      vcPressure.push(peepCmH2O)

      const pcPeak = drivingPressureCmH2O * complianceLPerCmH2O
      const pcVolumeL = pcPeak * decay
      pcVolume.push(pcVolumeL)
      pcFlow.push(-pcVolumeL / tau)
      pcPressure.push(peepCmH2O)
    }
  }

  return {
    volumeTargeted: { pressure: vcPressure, flow: vcFlow, volume: vcVolume },
    pressureTargeted: { pressure: pcPressure, flow: pcFlow, volume: pcVolume },
  }
}

/**
 * What a resistance multiple looks like at the bedside.
 *
 * Named rather than numeric because "4× this patient" means nothing on a ward round, and because
 * the causes sit at recognisable magnitudes: secretions and bronchospasm raise resistance
 * substantially, a kinked or bitten tube raises it enormously and is the one that reaches the
 * ventilator's pressure alarm within a breath or two. Descriptive labels for a slider, not
 * thresholds — the module's no-numeric-thresholds rule still holds.
 */
/**
 * Both sliders run on an exponent from −1 to +1 and convert with a per-slider base, so 0 is always
 * this patient and it always sits under the middle label. A linear multiplier range does not: 1.0
 * on a 0.5–5 scale lands about a tenth of the way along, so the thumb and the "this patient" label
 * disagreed about where the patient was.
 */
const complianceBase = 2 // 0.5x to 2x
const resistanceBase = 4 // 0.25x to 4x — a bitten tube is a bigger multiple than a stiff lung

function scaleToExponent(scale: number, base: number): number {
  return Math.log(scale) / Math.log(base)
}

function exponentToScale(exponent: number, base: number): number {
  return Number(base ** exponent === 1 ? 1 : (base ** exponent).toFixed(3))
}

function resistanceAnchor(scale: number): string {
  if (scale <= 0.6) return 'wide open'
  if (scale < 1) return 'less obstructed'
  if (scale === 1) return 'this patient'
  if (scale <= 1.8) return 'secretions'
  if (scale <= 3) return 'bronchospasm'
  return 'biting or kinking the tube'
}

/** Row geometry for the comparison figure: a label band above a plotted band. */
const ROW_HEIGHT = 52
const PLOT_HEIGHT = 38
const PLOT_TOP = 12
const PLOT_WIDTH = 150

function seriesPath(values: readonly number[], minimum: number, maximum: number) {
  const span = Math.max(0.01, maximum - minimum)
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * PLOT_WIDTH
      const normalized = Math.max(0, Math.min(1, (value - minimum) / span))
      const y = PLOT_HEIGHT - normalized * (PLOT_HEIGHT - 4) - 2
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function ComparisonColumn({
  title,
  controlled,
  follows,
  breath,
  peepCmH2O,
  emphasis,
}: {
  readonly title: string
  readonly controlled: TraceId
  readonly follows: TraceId
  readonly breath: IdealBreath
  readonly peepCmH2O: number
  readonly emphasis: TraceId | null
}) {
  const rows: readonly { id: TraceId; values: readonly number[]; min: number; max: number }[] = [
    {
      id: 'pressure',
      values: breath.pressure,
      min: peepCmH2O - 4,
      max: Math.max(...breath.pressure) + 4,
    },
    {
      id: 'flow',
      values: breath.flow,
      min: -Math.max(...breath.flow.map(Math.abs)) * 1.1,
      max: Math.max(...breath.flow.map(Math.abs)) * 1.1,
    },
    { id: 'volume', values: breath.volume, min: 0, max: Math.max(...breath.volume) * 1.15 },
  ]

  return (
    <div className={styles.comparisonColumn}>
      <h3>{title}</h3>
      <p className={styles.comparisonRule}>
        <strong>{traceCopy[controlled].label}</strong> is set ·{' '}
        <strong>{traceCopy[follows].label}</strong> follows the lung
      </p>
      <svg viewBox={`0 0 ${PLOT_WIDTH} ${rows.length * ROW_HEIGHT}`} aria-hidden="true">
        {rows.map((row, index) => (
          <g key={row.id} transform={`translate(0 ${index * ROW_HEIGHT})`}>
            {/* Label sits in its own band above the plot so it never crosses the trace. */}
            <text className={styles.comparisonAxis} x="0" y="7">
              {traceCopy[row.id].label}
            </text>
            <g transform={`translate(0 ${PLOT_TOP})`}>
              <path className={styles.traceGrid} d={`M0 ${PLOT_HEIGHT} H${PLOT_WIDTH}`} />
              {row.id === 'flow' ? (
                <path className={styles.zeroFlowLine} d={`M0 ${PLOT_HEIGHT / 2} H${PLOT_WIDTH}`} />
              ) : null}
              <path
                className={
                  emphasis === null || emphasis === row.id ? styles.trace : styles.traceMuted
                }
                d={seriesPath(row.values, row.min, row.max)}
              />
            </g>
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------
 * Panel
 * ---------------------------------------------------------------------------------------------- */

export function VentilationWaveformAnatomy({
  state,
  dispatch,
}: {
  readonly state: VentilationSimulationState
  readonly dispatch?: Dispatch<VentilationAction>
}) {
  const [selected, setSelected] = useState<TraceId | null>(null)
  const breath = useMemo(() => latestBreath(state.waveforms), [state.waveforms])
  const { patient, ventilator, measurements } = state

  /*
   * The sliders drive the *engine*, not a local copy — `SET_TEACHING_MECHANICS` scales this
   * patient's mechanics, so the live console beside this panel shows the consequence on its own
   * traces and monitored numbers. `patient` here is already the scaled patient, so the comparison
   * figure below follows for free.
   *
   * Where there is no dispatch — the offline render harness, or a read-only embedding — the sliders
   * are shown disabled rather than lying about being interactive.
   */
  const { complianceScale, resistanceScale } = state.teachingMechanics
  const setScale = (overrides: Partial<typeof state.teachingMechanics>) =>
    dispatch?.({ type: 'SET_TEACHING_MECHANICS', overrides })

  const compliance = Math.max(0.005, patient.mechanics.complianceLPerCmH2O)
  const airwayResistance = Math.max(1, patient.mechanics.resistanceCmH2OPerLps)
  const resistance = Math.max(
    1,
    patient.mechanics.resistanceCmH2OPerLps + patient.mechanics.tubeResistanceCmH2OPerLps,
  )
  const peep = ventilator.settings.peepCmH2O
  const tidalVolumeL = Math.max(0.1, measurements.exhaledVtMl / 1000)

  /*
   * Each column holds *its own* set variable while the lung moves, which is the whole point of the
   * comparison. Volume targeting keeps the tidal volume; pressure targeting keeps the driving
   * pressure it was set to at this patient's *unscaled* compliance. Deriving the driving pressure
   * from the current compliance instead would have made the pressure-targeted column silently hold
   * volume too, and the two columns would have moved together — showing nothing.
   */
  const patientCompliance = Math.max(0.005, compliance / Math.max(0.01, complianceScale))
  const drivingPressure = Math.max(5, tidalVolumeL / patientCompliance)

  const inspiratorySeconds = Math.max(0.2, measurements.mechanicalInspiratoryTimeSeconds)
  const comparison = useMemo(
    () =>
      idealBreaths(compliance, resistance, peep, tidalVolumeL, drivingPressure, inspiratorySeconds),
    [compliance, resistance, peep, tidalVolumeL, drivingPressure, inspiratorySeconds],
  )

  // What the two columns cost: the pressure volume targeting needs, the volume pressure delivers.
  const volumeTargetedPeak =
    peep + resistance * (tidalVolumeL / inspiratorySeconds) + tidalVolumeL / compliance
  const pressureTargetedVtMl = drivingPressure * compliance * 1000

  const pressurePath = tracePath(breath, 'pawCmH2O', -5, 45, 300, 62)
  const flowPath = tracePath(breath, 'flowLMin', -80, 80, 300, 62)
  const volumePath = tracePath(breath, 'volumeMl', 0, 800, 300, 62)

  const summary =
    breath.length === 0
      ? 'No complete breath yet, so the three traces cannot be labelled.'
      : `One breath drawn as three stacked traces. Pressure runs from the baseline of ${round(peep, 1)} centimetres of water up to ${round(measurements.peakPressureCmH2O, 1)} and back. Flow is signed, rising above the zero line during inspiration and falling below it during expiration. Volume is the running total of flow, reaching ${round(measurements.exhaledVtMl)} millilitres. Below them, the same lung — compliance ${round(compliance * 1000)} millilitres per centimetre of water and resistance ${round(resistance)} — is drawn twice, once ventilated with volume as the controlled variable and once with pressure, so that the rectangular trace swaps from flow to pressure.${selected ? ` The selected trace is ${traceCopy[selected].label}.` : ''}`

  return (
    <section className={styles.panel} aria-labelledby="mv-anatomy-teaching">
      <header className={styles.panelHeader}>
        <span>Start here</span>
        <h2 id="mv-anatomy-teaching">Three traces, one breath</h2>
        <p>
          Everything later in this pathway is read off these three lines. Select one to see what it
          plots, what it is measured against, and what decides its shape.
        </p>
      </header>

      {breath.length === 0 ? (
        <AwaitingBreath label="The three traces" />
      ) : (
        <figure className={styles.figure}>
          <svg viewBox="0 0 300 200" role="img" aria-label={summary}>
            {(['pressure', 'flow', 'volume'] as const).map((id, index) => (
              <g key={id} transform={`translate(0 ${index * 68})`}>
                <path className={styles.traceGrid} d="M0 62 H300" />
                {id === 'flow' ? <path className={styles.zeroFlowLine} d="M0 32 H300" /> : null}
                <path
                  className={
                    selected === null || selected === id ? styles.trace : styles.traceMuted
                  }
                  d={id === 'pressure' ? pressurePath : id === 'flow' ? flowPath : volumePath}
                />
                <text className={styles.comparisonAxis} x="2" y="10">
                  {traceCopy[id].label}
                </text>
              </g>
            ))}
          </svg>
          <figcaption>
            The most recent breath on this patient. The dashed line on the flow trace is zero flow —
            the only one of the three that is read against zero.
          </figcaption>
        </figure>
      )}

      <div className={styles.componentToggles}>
        {(['pressure', 'flow', 'volume'] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={selected === id}
            onClick={() => setSelected((current) => (current === id ? null : id))}
          >
            {traceCopy[id].label}
          </button>
        ))}
      </div>

      {selected ? (
        <div className={styles.stepDetail}>
          <span>What it plots</span>
          <p>{traceCopy[selected].plots}</p>
          <span>What it is read against</span>
          <p>{traceCopy[selected].zero}</p>
          <span>What sets its shape</span>
          <p>{traceCopy[selected].shapedBy}</p>
        </div>
      ) : null}

      <div className={styles.stepDetail}>
        <span>The one rule that makes the rest of this readable</span>
        <p>
          A ventilator sets <strong>one</strong> of pressure or volume. It cannot set both — the
          lung decides the relationship between them. Whichever one is set holds its shape when the
          patient changes; the other one moves, which is precisely why the other one is the one
          worth watching.
        </p>
      </div>

      <figure className={styles.figure}>
        <div className={styles.comparisonColumns} role="img" aria-label={summary}>
          <ComparisonColumn
            title="Volume targeted"
            controlled="flow"
            follows="pressure"
            breath={comparison.volumeTargeted}
            peepCmH2O={peep}
            emphasis={selected}
          />
          <ComparisonColumn
            title="Pressure targeted"
            controlled="pressure"
            follows="volume"
            breath={comparison.pressureTargeted}
            peepCmH2O={peep}
            emphasis={selected}
          />
        </div>
        <figcaption>
          The same lung both times — compliance {round(compliance * 1000)} mL/cmH₂O, resistance{' '}
          {round(resistance)} cmH₂O/L/s. Notice which trace is the rectangle: it moves from flow to
          pressure, and everything else follows from that.
        </figcaption>
      </figure>

      <div className={styles.stepDetail}>
        <span>Change the lung and watch which trace moves</span>
        <p className={styles.sliderIntro}>
          These change the patient, not the ventilator — the console beside this panel is running on
          them, so its traces and its monitored numbers move with the sliders.
        </p>

        <label className={styles.complianceSlider}>
          <span>
            Compliance <strong>{round(compliance * 1000)} mL/cmH₂O</strong>
            {complianceScale === 1
              ? ' — this patient'
              : complianceScale < 1
                ? ' — stiffer'
                : ' — more compliant'}
          </span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={scaleToExponent(complianceScale, complianceBase)}
            disabled={!dispatch}
            onChange={(event) =>
              setScale({
                complianceScale: exponentToScale(Number(event.target.value), complianceBase),
              })
            }
            aria-label="Respiratory-system compliance, as a multiple of this patient's own"
            aria-valuetext={`${round(compliance * 1000)} millilitres per centimetre of water`}
          />
          <span className={styles.sliderScale} aria-hidden="true">
            <span>Stiffer</span>
            <span>This patient</span>
            <span>More compliant</span>
          </span>
        </label>

        {/*
         * Resistance is the other half of the equation of motion, and it moves a different trace:
         * compliance changes the elastic term, resistance changes the resistive one. The anchors
         * are named rather than numeric because "4× this patient" means nothing at the bedside and
         * "biting the tube" is instantly recognisable.
         */}
        <label className={styles.complianceSlider}>
          <span>
            Airway resistance <strong>{round(airwayResistance)} cmH₂O/L/s</strong>
            {` — ${resistanceAnchor(resistanceScale)}`}
          </span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={scaleToExponent(resistanceScale, resistanceBase)}
            disabled={!dispatch}
            onChange={(event) =>
              setScale({
                resistanceScale: exponentToScale(Number(event.target.value), resistanceBase),
              })
            }
            aria-label="Airway resistance, as a multiple of this patient's own"
            aria-valuetext={`${round(airwayResistance)} centimetres of water per litre per second, ${resistanceAnchor(resistanceScale)}`}
          />
          <span className={styles.sliderScale} aria-hidden="true">
            <span>Wide open</span>
            <span>This patient</span>
            <span>Biting the tube</span>
          </span>
        </label>

        {dispatch && (complianceScale !== 1 || resistanceScale !== 1) ? (
          <button
            type="button"
            className={styles.resetMechanics}
            onClick={() => setScale({ complianceScale: 1, resistanceScale: 1 })}
          >
            Put the patient back
          </button>
        ) : null}
        {/*
         * Each column names what it *holds* and what consequently *moves*. Printing both as
         * "N mL at N cmH₂O" put a peak pressure beside a set pressure — different quantities, and
         * side by side they read as a cost difference between the two strategies, which is not the
         * point and is not true.
         */}
        <dl className={styles.comparisonReadout}>
          <div>
            <dt>Volume targeted holds</dt>
            <dd>{round(tidalVolumeL * 1000)} mL</dd>
            <dt>so peak pressure moves to</dt>
            <dd data-moves="true">{round(volumeTargetedPeak)} cmH₂O</dd>
          </div>
          <div>
            <dt>Pressure targeted holds</dt>
            <dd>{round(peep + drivingPressure)} cmH₂O</dd>
            <dt>so the breath moves to</dt>
            <dd data-moves="true">{round(pressureTargetedVtMl)} mL</dd>
          </div>
        </dl>
        <p aria-live="polite">
          {complianceScale === 1
            ? 'Both columns are set to deliver the same breath at this patient’s own compliance. Move the slider to make the lung stiffer or more compliant.'
            : complianceScale < 1
              ? `A stiffer lung. Volume targeting still delivers ${round(tidalVolumeL * 1000)} mL — it just costs ${round(volumeTargetedPeak)} cmH₂O to do it, so the pressure trace rises and the flow and volume traces are unchanged. Pressure targeting holds ${round(peep + drivingPressure)} cmH₂O, so the pressure trace is unchanged and the breath shrinks to ${round(pressureTargetedVtMl)} mL.`
              : `A more compliant lung. Volume targeting still delivers ${round(tidalVolumeL * 1000)} mL and needs only ${round(volumeTargetedPeak)} cmH₂O for it. Pressure targeting holds the same ${round(peep + drivingPressure)} cmH₂O and now delivers ${round(pressureTargetedVtMl)} mL.`}
        </p>
        {/*
         * Resistance is deliberately described separately: it moves a *different* part of the
         * pressure trace, and conflating the two is the misconception this section exists to
         * prevent. Compliance changes what the trace ends at; resistance changes the step it starts
         * with, and leaves the plateau alone.
         */}
        <p aria-live="polite">
          {resistanceScale === 1
            ? 'Resistance is at this patient’s own. Raising it — secretions, bronchospasm, a bitten tube — adds to the pressure trace in a different place.'
            : `Resistance is now ${resistanceAnchor(resistanceScale)}. That adds to the *resistive* part of the breath: on volume targeting the trace steps higher the instant flow starts and the expiratory limb takes longer to come back to zero, while the plateau it settles to is unchanged, because resistance costs nothing once gas stops moving. On pressure targeting the set pressure is still reached, so the breath is delivered more slowly instead — flow decays more gently and the volume may not finish.`}
        </p>
        <p>
          Expiration is passive in both columns, so that limb is identical — which is why the
          expiratory limb reports the lung rather than the machine.
        </p>
      </div>

      <div className={styles.evidenceTable} aria-label="What changes between the two">
        <div className={styles.evidenceRow}>
          <span>
            Volume targeted
            <small>
              Flow is rectangular because it is the setting. Volume is its integral, so it ramps
              straight up. Pressure is left to the mechanics: a step for the resistive term, then a
              ramp as the elastic term builds.
            </small>
            <small>
              <strong>
                A stiffer lung raises the pressure trace and leaves the breath size alone.
              </strong>
            </small>
          </span>
          <span className={styles.verdict} data-verdict="neutral">
            Pressure varies
          </span>
        </div>
        <div className={styles.evidenceRow}>
          <span>
            Pressure targeted
            <small>
              Pressure is rectangular because it is the setting. Flow is the pressure gradient
              across the resistance, so it decays as the lung fills and the gradient closes. Volume
              is that decay integrated, approaching a limit rather than a straight line.
            </small>
            <small>
              <strong>
                A stiffer lung shrinks the breath and leaves the pressure trace alone.
              </strong>
            </small>
          </span>
          <span className={styles.verdict} data-verdict="neutral">
            Volume varies
          </span>
        </div>
        <div className={styles.evidenceRow}>
          <span>
            Both
            <small>
              Expiration is passive either way, so the expiratory limb is the same exponential decay
              in both columns. Nothing about it is a setting — which is why it reports the lung
              rather than the ventilator.
            </small>
          </span>
          <span className={styles.verdict} data-verdict="consistent">
            Unchanged
          </span>
        </div>
      </div>

      <TextEquivalent>{summary}</TextEquivalent>
      <ModelBoundary>
        The two comparison breaths are drawn from the equation of motion using this patient’s
        compliance and resistance, as idealized single-compartment breaths. A real trace carries
        patient effort, circuit compliance, and more than one time constant — which is what the rest
        of this pathway is about. No target pressure or tidal volume is stated here.
      </ModelBoundary>
    </section>
  )
}
