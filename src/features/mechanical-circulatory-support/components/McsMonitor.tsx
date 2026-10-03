'use client'

import {
  interpretMcsCardiacPowerOutput,
  interpretMcsPapi,
  mcsDerivedValueGuides,
  mcsMonitorTargets,
  type McsMonitorTargetId,
} from '../content'
import { MCS_AF_TRIGGER_CONTAINMENT, mcsAfTriggerLimitApplies } from '../content/afTriggerLimit'
import type { McsSimulationState, McsWaveformSample } from '../engine'
import { mcsDeviceFlowLine, mcsLiveValueKindLabels } from './teaching/selectors'
import { ecgDisplayPoints } from './monitorDisplay'
import { McsPressureFlowTrend, mcsMonitorTrendSeries } from './McsPressureFlowTrend'
import styles from './mechanical-circulatory-support.module.css'

type WaveformField = 'ecgMv' | 'arterialMmHg' | 'papMmHg' | 'cvpMmHg'

/**
 * Marks a region as one of the authored monitor targets a Learn section can lead with.
 *
 * A target may cover more than one node — the flow account is three tiles, the filling pressures are
 * a tile and two traces — so the highlight is applied per element rather than by wrapping, which
 * keeps the monitor's grid exactly as it was.
 */
function target(
  id: McsMonitorTargetId,
  highlighted: McsMonitorTargetId | undefined,
): { 'data-monitor-target': McsMonitorTargetId; 'data-monitor-highlighted'?: 'true' } {
  return highlighted === id
    ? { 'data-monitor-target': id, 'data-monitor-highlighted': 'true' }
    : { 'data-monitor-target': id }
}

function linePath(
  values: readonly { x: number; y: number }[],
  width: number,
  height: number,
  minimum: number,
  maximum: number,
) {
  if (values.length === 0) return ''
  const xMin = values[0].x
  const xMax = values.at(-1)?.x ?? xMin + 1
  const xSpan = Math.max(0.01, xMax - xMin)
  const ySpan = Math.max(0.01, maximum - minimum)
  return values
    .map((value, index) => {
      const x = ((value.x - xMin) / xSpan) * width
      const y = height - ((value.y - minimum) / ySpan) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function WaveStrip({
  samples,
  field,
  label,
  unit,
  minimum,
  maximum,
  color,
  targetProps,
  heartRateBpm,
  focused = false,
}: {
  samples: readonly McsWaveformSample[]
  field: WaveformField
  label: string
  unit: string
  minimum: number
  maximum: number
  color: string
  targetProps?: Record<string, string>
  /** For the ECG only: the rate the stored samples were generated at, for the display fill. */
  heartRateBpm?: number
  /** The strip a step points at is drawn taller, so an assisted beat can be told from an unassisted one. */
  focused?: boolean
}) {
  const latest = samples.at(-1)?.[field] ?? 0
  const window = samples.slice(-250)
  const points =
    field === 'ecgMv' && heartRateBpm !== undefined
      ? ecgDisplayPoints(window, heartRateBpm).map((point) => ({ x: point.time, y: point.value }))
      : window.map((sample) => ({ x: sample.time, y: sample[field] }))
  const path = linePath(points, 720, 92, minimum, maximum)
  return (
    <div
      className={styles.waveStrip}
      data-wave-strip={field}
      data-focused={focused || undefined}
      {...targetProps}
    >
      <div>
        <strong style={{ color }}>{label}</strong>
        <span>
          {latest.toFixed(field === 'ecgMv' ? 2 : 0)} {unit}
          {/*
           * Which number this is.
           *
           * A strip carries the newest waveform sample at the model's current time; the tile beside
           * it carries the modeled mean or the derived systolic/diastolic pair. They are different
           * quantities over different windows, so the arterial strip can read 65 while the MAP tile
           * reads 76 with neither being wrong — and a learner who was not told which is which read
           * whichever came first (F04). Nothing about the values changes here; they are named.
           */}
          <small data-readout-window="instantaneous">instantaneous</small>
          {/* The strip's own fixed vertical scale, so a trace's height can be read in its units. */}
          <small data-strip-scale>
            scale {minimum}–{maximum} {unit}
          </small>
        </span>
      </div>
      <svg
        viewBox="0 0 720 92"
        role="img"
        aria-label={`${label} waveform; instantaneous sample ${latest.toFixed(1)} ${unit} at the model's current time; drawn on a fixed ${minimum} to ${maximum} ${unit} scale`}
        preserveAspectRatio="none"
      >
        <path className={styles.monitorGridLine} d="M0 23 H720 M0 46 H720 M0 69 H720" />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={focused ? 2.6 : 2.2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

/*
 * The left-ventricular pressure–volume display, as what it is.
 *
 * The samples are this model's plotted surrogate: a modeled LV pressure and a modeled volume
 * generated per sample from the mean values, not a conductance-catheter loop. It was a thin sliver
 * with "180", "0", "20 mL" and "240" at its corners and no axis names, hidden entirely below
 * 760 px (F04, F34). It now names both axes with their units, keeps a fixed scale so a change in
 * position is a change in the model, says in words what range the plotted samples cover, and stays
 * on screen at every width. The samples are drawn as they are — no smoothing, no reshaping.
 */
const PV_VOLUME_AXIS = { min: 0, max: 250, ticks: [0, 50, 100, 150, 200, 250] } as const
const PV_PRESSURE_AXIS = { min: 0, max: 200, ticks: [0, 50, 100, 150, 200] } as const

function PressureVolumeLoop({ samples }: { samples: readonly McsWaveformSample[] }) {
  const recent = samples.slice(-100)
  const values = recent.map((sample) => ({ x: sample.lvVolumeMl, y: sample.lvMmHg }))
  const left = 46
  const right = 330
  const top = 10
  const bottom = 190
  const xFor = (volume: number) =>
    left +
    ((Math.min(PV_VOLUME_AXIS.max, Math.max(PV_VOLUME_AXIS.min, volume)) - PV_VOLUME_AXIS.min) /
      (PV_VOLUME_AXIS.max - PV_VOLUME_AXIS.min)) *
      (right - left)
  const yFor = (pressure: number) =>
    bottom -
    ((Math.min(PV_PRESSURE_AXIS.max, Math.max(PV_PRESSURE_AXIS.min, pressure)) -
      PV_PRESSURE_AXIS.min) /
      (PV_PRESSURE_AXIS.max - PV_PRESSURE_AXIS.min)) *
      (bottom - top)
  const path = values
    .map(
      (value, index) =>
        `${index === 0 ? 'M' : 'L'}${xFor(value.x).toFixed(1)},${yFor(value.y).toFixed(1)}`,
    )
    .join(' ')
  const volumes = values.map((value) => value.x)
  const pressures = values.map((value) => value.y)
  const seconds = recent.length > 1 ? recent[recent.length - 1].time - recent[0].time : 0
  const summary =
    values.length > 1
      ? `Plotted over the last ${seconds.toFixed(1)} simulated seconds: volume ${Math.min(...volumes).toFixed(0)}–${Math.max(...volumes).toFixed(0)} mL, pressure ${Math.min(...pressures).toFixed(0)}–${Math.max(...pressures).toFixed(0)} mm Hg.`
      : 'No samples yet.'
  return (
    <figure className={styles.pvFigure} data-pv-display>
      <figcaption>
        <strong>LV pressure–volume display</strong>
        <span>
          This model’s plotted pressure–volume surrogate, not a calibrated clinical PV loop.
          Unloading shifts the plotted volume left; afterload changes its height.
        </span>
      </figcaption>
      <svg
        viewBox="0 0 340 232"
        role="img"
        aria-label={`Left ventricular pressure-volume loop as this model plots it, a surrogate and not a calibrated clinical PV loop: LV volume in mL across, LV pressure in mm Hg up. ${summary}`}
      >
        {PV_PRESSURE_AXIS.ticks.map((tick) => (
          <g key={`p${tick}`}>
            <path d={`M${left} ${yFor(tick)} H${right}`} className={styles.monitorGridLine} />
            <text x={left - 5} y={yFor(tick) + 3} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {PV_VOLUME_AXIS.ticks.map((tick) => (
          <g key={`v${tick}`}>
            <path d={`M${xFor(tick)} ${top} V${bottom}`} className={styles.monitorGridLine} />
            <text x={xFor(tick)} y={bottom + 13} textAnchor="middle">
              {tick}
            </text>
          </g>
        ))}
        <path d={`M${left} ${top} V${bottom} H${right}`} className={styles.axisLine} />
        <path d={path} fill="rgba(116, 219, 205, .12)" stroke="#74dbcd" strokeWidth="3" />
        <text x={(left + right) / 2} y={bottom + 30} textAnchor="middle" data-pv-axis="volume">
          LV volume (mL)
        </text>
        <text
          x={12}
          y={(top + bottom) / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${(top + bottom) / 2})`}
          data-pv-axis="pressure"
        >
          LV pressure (mm Hg)
        </text>
      </svg>
      <p className={styles.pvSummary} data-pv-summary>
        {summary}
      </p>
    </figure>
  )
}

function metric(value: number, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

export function McsMonitor({
  state,
  revealCausality = true,
  highlightTarget,
  highlightNote = true,
  withheldNote,
  withholdFlowAccount = false,
}: {
  state: McsSimulationState
  revealCausality?: boolean
  /** The authored Learn target to emphasize, when this monitor is a section's primary surface. */
  highlightTarget?: McsMonitorTargetId
  /**
   * Whether the highlighted target's text equivalent is printed. The lesson stage highlights the
   * region before the prediction but prints its words only after: several equivalents state what
   * the reading is made from, which is the answer a section is asking for.
   */
  highlightNote?: boolean
  /** What the causal callout says while causality is withheld; the case-workflow wording otherwise. */
  withheldNote?: string
  /**
   * Cover the three flow lines — native, device and effective — and their trend. A section whose
   * prediction is "what will the flow account show" cannot have the account on screen while it asks.
   */
  withholdFlowAccount?: boolean
}) {
  const metrics = state.metrics
  const activeAlarms = state.alarms.filter((alarm) => alarm.active)
  /*
   * A quiet alarm bar is not an all-clear while a model limit is held.
   *
   * In atrial fibrillation the engine's trigger alarm is quiet on exactly one source — arterial
   * pressure — and that is the source the supplied Cardiosave material advises against. Reading
   * "NO ACTIVE MODEL ALARMS" after making that switch is the last place the contained result could
   * still arrive as a success signal (F19). The alarms themselves are untouched and every one of
   * them still shows; the bar simply stops being able to say only "clear" here.
   */
  const afTriggerLimitHeld = mcsAfTriggerLimitApplies(state)
  /*
   * The same flow account the teaching panels and the two context summaries read, so the four
   * surfaces cannot disagree about what the device is reporting.
   */
  const deviceFlowLine = mcsDeviceFlowLine(state)
  const highlighted = highlightTarget ? mcsMonitorTargets[highlightTarget] : undefined
  const impellaMode =
    state.device.kind === 'impella'
      ? state.device.left.enabled && state.device.right.enabled
        ? `${state.device.left.variant === '55' ? '5.5' : 'CP'} + RP · BIVENTRICULAR`
        : state.device.left.enabled
          ? `IMPELLA ${state.device.left.variant === '55' ? '5.5' : 'CP'} · LV SUPPORT`
          : state.device.right.enabled
            ? 'IMPELLA RP · RV SUPPORT'
            : 'IMPELLA · SUPPORT OFF'
      : state.deviceKind.toUpperCase()
  return (
    <section
      className={styles.monitorCard}
      aria-label="Synchronized mechanical-support bedside monitor"
    >
      <header className={styles.monitorHeader}>
        <div>
          <span className={styles.monitorLabel}>MCS // EDU</span>
          <strong>{impellaMode} · 50 Hz deterministic model</strong>
        </div>
        <time>{state.timeSeconds.toFixed(1)} s</time>
      </header>
      {highlighted && highlightNote ? (
        <p className={styles.surfaceHighlightNote} data-monitor-highlight-note>
          <strong>Look here now:</strong> {highlighted.label}. {highlighted.textEquivalent}
        </p>
      ) : null}
      <div
        className={styles.alarmBar}
        role="status"
        aria-live="polite"
        {...target('monitor:alarms', highlightTarget)}
      >
        {activeAlarms.length === 0 ? (
          afTriggerLimitHeld ? null : (
            <span data-priority="clear">NO ACTIVE MODEL ALARMS</span>
          )
        ) : (
          activeAlarms.map((alarm) => (
            <span key={alarm.id} data-priority={alarm.priority}>
              {alarm.priority.toUpperCase()} · {alarm.label}
            </span>
          ))
        )}
        {afTriggerLimitHeld ? (
          <span data-priority="held" data-af-trigger-held>
            {MCS_AF_TRIGGER_CONTAINMENT.notAnAllClear}
          </span>
        ) : null}
      </div>
      <div className={styles.monitorMain}>
        <div className={styles.waveStack}>
          <WaveStrip
            samples={state.waveforms}
            field="ecgMv"
            label="ECG II"
            unit="mV"
            minimum={-0.3}
            maximum={1.3}
            color="#66df9a"
            heartRateBpm={state.patient.heartRateBpm}
          />
          <WaveStrip
            samples={state.waveforms}
            field="arterialMmHg"
            label="ART"
            unit="mmHg"
            minimum={0}
            maximum={180}
            color="#ff7185"
            targetProps={target('monitor:arterial-waveform', highlightTarget)}
            focused={highlightTarget === 'monitor:arterial-waveform'}
          />
          <WaveStrip
            samples={state.waveforms}
            field="papMmHg"
            label="PAP"
            unit="mmHg"
            minimum={0}
            maximum={80}
            color="#f5c867"
            targetProps={target('monitor:filling-pressures', highlightTarget)}
          />
          <WaveStrip
            samples={state.waveforms}
            field="cvpMmHg"
            label="RAP / CVP"
            unit="mmHg"
            minimum={0}
            maximum={35}
            color="#69c9ff"
            targetProps={target('monitor:filling-pressures', highlightTarget)}
          />
        </div>
        <div
          className={styles.metricGrid}
          aria-label="Current hemodynamic values"
          role="group"
          data-flow-account-withheld={withholdFlowAccount || undefined}
        >
          {withholdFlowAccount ? (
            <div
              data-color="native"
              data-withheld
              {...target('monitor:flow-account', highlightTarget)}
            >
              <span>FLOW ACCOUNT</span>
              <strong>—</strong>
              <small>covered until you have committed your prediction</small>
            </div>
          ) : null}
          {withholdFlowAccount ? null : (
            <div data-color="native" {...target('monitor:flow-account', highlightTarget)}>
              <span>NATIVE FLOW</span>
              <strong>{metric(metrics.nativeFlowLMin, 1)}</strong>
              <small>L/min</small>
            </div>
          )}
          {withholdFlowAccount ? null : state.device.kind === 'impella' ? (
            <>
              <div data-color="left-device" {...target('monitor:flow-account', highlightTarget)}>
                <span>LV PUMP FLOW</span>
                <strong>{metric(metrics.leftDeviceFlowLMin, 1)}</strong>
                <small>L/min · systemic assist</small>
              </div>
              <div data-color="right-device" {...target('monitor:flow-account', highlightTarget)}>
                <span>RP PUMP FLOW</span>
                <strong>{metric(metrics.rightDeviceFlowLMin, 1)}</strong>
                <small>L/min · pulmonary delivery</small>
              </div>
              <div {...target('monitor:flow-account', highlightTarget)}>
                <span>RP − LEFT PUMP</span>
                <strong>{metric(metrics.pumpBalanceLMin, 1)}</strong>
                <small>L/min · reconcile with filling</small>
              </div>
            </>
          ) : (
            /*
             * One tile, two readings, decided by the flow account rather than here.
             *
             * A durable pump reports a flow its controller computes, so the tile carries the number
             * and says it is an estimate. Counterpulsation has no pump pathway at all: the engine
             * still holds a zero for the arithmetic, but rendering that zero under a DEVICE FLOW
             * heading claims a channel that reports nothing — on the same screen as a flow account
             * reading "none reported", and beside a context bar that had already been corrected.
             */
            <div
              data-color="device"
              data-device-flow-reported={deviceFlowLine.value === null ? 'false' : 'true'}
              {...target('monitor:flow-account', highlightTarget)}
            >
              <span>DEVICE FLOW</span>
              <strong>
                {deviceFlowLine.value === null ? 'NONE REPORTED' : metric(deviceFlowLine.value, 1)}
              </strong>
              <small>
                {deviceFlowLine.value === null
                  ? 'no direct pump-flow channel on this mechanism'
                  : `L/min · ${mcsLiveValueKindLabels[deviceFlowLine.kind]}`}
              </small>
            </div>
          )}
          {withholdFlowAccount ? null : (
            <div data-color="effective" {...target('monitor:flow-account', highlightTarget)}>
              <span>EFFECTIVE FLOW</span>
              <strong>{metric(metrics.effectiveSystemicFlowLMin, 1)}</strong>
              <small>L/min</small>
            </div>
          )}
          <div>
            <span>MAP / PP</span>
            <strong>
              {metric(metrics.mapMmHg)} / {metric(metrics.pulsePressureMmHg)}
            </strong>
            <small>mm Hg · modeled mean and pulse, not the strip sample</small>
          </div>
          <div {...target('monitor:filling-pressures', highlightTarget)}>
            <span>RAP / PCWP</span>
            <strong>
              {metric(metrics.rapMmHg)} / {metric(metrics.pcwpMmHg)}
            </strong>
            <small>mm Hg · modeled mean, not the strip sample</small>
          </div>
          <div {...target('monitor:filling-pressures', highlightTarget)}>
            <span>PAP</span>
            <strong>
              {metric(metrics.papSystolicMmHg)} / {metric(metrics.papDiastolicMmHg)}
            </strong>
            <small>mm Hg · modeled systolic / diastolic</small>
          </div>
          <div>
            <span>PAPi / CPO</span>
            <strong>
              {metric(metrics.papi, 1)} / {metric(metrics.cardiacPowerOutputW, 2)}
            </strong>
            <small>ratio / W</small>
          </div>
          <div>
            <span>SvO₂ / LVEDP</span>
            <strong>
              {metric(metrics.svo2Percent)} / {metric(metrics.lvedpMmHg)}
            </strong>
            <small>% / mm Hg</small>
          </div>
          <div>
            <span>AV OPENING</span>
            <strong>{metrics.aorticValveOpening ? 'YES' : 'NO'}</strong>
            <small>modeled</small>
          </div>
          {metrics.timingQualityPercent !== null ? (
            /*
             * Synchrony is this model's own index, and no IABP console reports it. It was tiled and
             * captioned like every measured value beside it, and the two atrial-fibrillation
             * activities then used it as a success condition, so a learner reasonably took it for a
             * console reading (F04, F19). The number is unchanged; what it is is now on the tile.
             */
            <div data-color="device" data-quantity-class="model-index">
              <span>TIMING</span>
              <strong>{metric(metrics.timingQualityPercent)}%</strong>
              <small>model index · no console reports this</small>
            </div>
          ) : null}
          {metrics.pumpPowerW !== null ? (
            <div data-color="device" {...target('monitor:power-pulsatility', highlightTarget)}>
              <span>POWER / PI</span>
              <strong>
                {metric(metrics.pumpPowerW, 1)} / {metric(metrics.pulsatilityIndex ?? 0, 1)}
              </strong>
              <small>W / estimate</small>
            </div>
          ) : null}
        </div>
      </div>
      <section
        className={styles.derivedValueGuide}
        aria-label="PAPi and cardiac power interpretation"
      >
        <p>
          <strong>
            PAPi {metric(metrics.papi, 1)} · {interpretMcsPapi(metrics.papi)}
          </strong>
          <span>
            {mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex.formula}.{' '}
            {mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex.interpretation}
          </span>
          <small>{mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex.caveats}</small>
        </p>
        <p>
          <strong>
            CPO {metric(metrics.cardiacPowerOutputW, 2)} W ·{' '}
            {interpretMcsCardiacPowerOutput(metrics.cardiacPowerOutputW)}
          </strong>
          <span>
            {mcsDerivedValueGuides.cardiacPowerOutputW.formula}.{' '}
            {mcsDerivedValueGuides.cardiacPowerOutputW.interpretation}
          </span>
          <small>{mcsDerivedValueGuides.cardiacPowerOutputW.caveats}</small>
        </p>
      </section>
      <div className={styles.chartGrid}>
        <PressureVolumeLoop samples={state.waveforms} />
        <figure className={styles.trendFigure}>
          <figcaption>
            <strong>Pressure and flow trend</strong>
            <span>Separate scales in mm Hg and L/min on one simulated-time axis.</span>
          </figcaption>
          <McsPressureFlowTrend
            samples={state.trends}
            windowSeconds={40}
            series={mcsMonitorTrendSeries(state.deviceKind)}
            withholdFlow={withholdFlowAccount}
            targetProps={target('monitor:response-trend', highlightTarget)}
          />
        </figure>
      </div>
      <p className={styles.causalCallout}>
        <strong>
          {revealCausality
            ? 'Why the display changed:'
            : withheldNote
              ? 'Withheld for now:'
              : 'Challenge mode:'}
        </strong>{' '}
        {revealCausality
          ? state.causalExplanation
          : (withheldNote ?? 'Causal coaching is withheld until you complete the reassessment.')}
      </p>
      {revealCausality && activeAlarms.length > 0 ? (
        <div className={styles.alarmExplanations} {...target('monitor:alarms', highlightTarget)}>
          {activeAlarms.map((alarm) => (
            <p key={alarm.id}>
              <strong>{alarm.label}:</strong> {alarm.explanation}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
