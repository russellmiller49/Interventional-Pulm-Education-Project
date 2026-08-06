'use client'

import {
  interpretMcsCardiacPowerOutput,
  interpretMcsPapi,
  mcsDerivedValueGuides,
  mcsMonitorTargets,
  type McsMonitorTargetId,
} from '../content'
import type { McsSimulationState, McsWaveformSample } from '../engine'
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
}: {
  samples: readonly McsWaveformSample[]
  field: WaveformField
  label: string
  unit: string
  minimum: number
  maximum: number
  color: string
  targetProps?: Record<string, string>
}) {
  const latest = samples.at(-1)?.[field] ?? 0
  const path = linePath(
    samples.slice(-250).map((sample) => ({ x: sample.time, y: sample[field] })),
    720,
    92,
    minimum,
    maximum,
  )
  return (
    <div className={styles.waveStrip} {...targetProps}>
      <div>
        <strong style={{ color }}>{label}</strong>
        <span>
          {latest.toFixed(field === 'ecgMv' ? 2 : 0)} {unit}
        </span>
      </div>
      <svg
        viewBox="0 0 720 92"
        role="img"
        aria-label={`${label} waveform; current value ${latest.toFixed(1)} ${unit}`}
        preserveAspectRatio="none"
      >
        <path className={styles.monitorGridLine} d="M0 23 H720 M0 46 H720 M0 69 H720" />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

function PressureVolumeLoop({ samples }: { samples: readonly McsWaveformSample[] }) {
  const recent = samples.slice(-100)
  const values = recent.map((sample) => ({ x: sample.lvVolumeMl, y: sample.lvMmHg }))
  const xMin = 20
  const xMax = 240
  const yMin = 0
  const yMax = 180
  const width = 320
  const height = 190
  const path = values
    .map((value, index) => {
      const x = ((value.x - xMin) / (xMax - xMin)) * width
      const y = height - ((value.y - yMin) / (yMax - yMin)) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <figure className={styles.pvFigure}>
      <figcaption>
        <strong>LV pressure–volume loop</strong>
        <span>Unloading shifts volume left; afterload changes loop height.</span>
      </figcaption>
      <svg viewBox="0 0 360 225" role="img" aria-label="Left ventricular pressure-volume loop">
        <path d="M28 8 V198 H348" className={styles.axisLine} />
        <path
          d="M28 55 H348 M28 103 H348 M28 151 H348 M108 8 V198 M188 8 V198 M268 8 V198"
          className={styles.monitorGridLine}
        />
        <g transform="translate(28 8)">
          <path d={path} fill="rgba(116, 219, 205, .12)" stroke="#74dbcd" strokeWidth="3" />
        </g>
        <text x="10" y="16">
          180
        </text>
        <text x="13" y="199">
          0
        </text>
        <text x="27" y="218">
          20 mL
        </text>
        <text x="302" y="218">
          240
        </text>
      </svg>
    </figure>
  )
}

function TrendPlot({
  state,
  targetProps,
}: {
  state: McsSimulationState
  targetProps?: Record<string, string>
}) {
  const recent = state.trends.slice(-160)
  const mapPath = linePath(
    recent.map((sample) => ({ x: sample.time, y: sample.mapMmHg })),
    640,
    150,
    20,
    150,
  )
  const flowPath = linePath(
    recent.map((sample) => ({ x: sample.time, y: sample.effectiveFlowLMin * 16 })),
    640,
    150,
    20,
    150,
  )
  const leftDevicePath = linePath(
    recent.map((sample) => ({ x: sample.time, y: sample.leftDeviceFlowLMin * 16 })),
    640,
    150,
    20,
    150,
  )
  const rightDevicePath = linePath(
    recent.map((sample) => ({ x: sample.time, y: sample.rightDeviceFlowLMin * 16 })),
    640,
    150,
    20,
    150,
  )
  return (
    <figure className={styles.trendFigure} {...targetProps}>
      <figcaption>
        <strong>Response trend</strong>
        <span>
          <i data-color="map" /> MAP <i data-color="effective" /> effective flow ×16{' '}
          <i data-color="left-device" /> LV pump ×16 <i data-color="right-device" /> RP pump ×16
        </span>
      </figcaption>
      <svg
        viewBox="0 0 640 150"
        role="img"
        aria-label="Trend of MAP, effective systemic flow, left pump flow, and right pump flow"
      >
        <path d="M0 30 H640 M0 75 H640 M0 120 H640" className={styles.monitorGridLine} />
        <path data-series="map" d={mapPath} fill="none" stroke="#ff7185" strokeWidth="2.5" />
        <path
          data-series="effective-flow"
          d={flowPath}
          fill="none"
          stroke="#6ee7f2"
          strokeWidth="2.5"
          strokeDasharray="12 3"
        />
        <path
          data-series="left-pump"
          d={leftDevicePath}
          fill="none"
          stroke="#f4c66e"
          strokeWidth="2"
          strokeDasharray="6 5"
        />
        <path
          data-series="right-pump"
          d={rightDevicePath}
          fill="none"
          stroke="#b788ff"
          strokeWidth="2"
          strokeDasharray="3 4"
        />
      </svg>
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
}: {
  state: McsSimulationState
  revealCausality?: boolean
  /** The authored Learn target to emphasize, when this monitor is a section's primary surface. */
  highlightTarget?: McsMonitorTargetId
}) {
  const metrics = state.metrics
  const activeAlarms = state.alarms.filter((alarm) => alarm.active)
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
      {highlighted ? (
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
          <span data-priority="clear">NO ACTIVE MODEL ALARMS</span>
        ) : (
          activeAlarms.map((alarm) => (
            <span key={alarm.id} data-priority={alarm.priority}>
              {alarm.priority.toUpperCase()} · {alarm.label}
            </span>
          ))
        )}
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
        <div className={styles.metricGrid} aria-label="Current hemodynamic values" role="group">
          <div data-color="native" {...target('monitor:flow-account', highlightTarget)}>
            <span>NATIVE FLOW</span>
            <strong>{metric(metrics.nativeFlowLMin, 1)}</strong>
            <small>L/min</small>
          </div>
          {state.device.kind === 'impella' ? (
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
            <div data-color="device" {...target('monitor:flow-account', highlightTarget)}>
              <span>DEVICE FLOW</span>
              <strong>{metric(metrics.deviceFlowLMin, 1)}</strong>
              <small>L/min</small>
            </div>
          )}
          <div data-color="effective" {...target('monitor:flow-account', highlightTarget)}>
            <span>EFFECTIVE FLOW</span>
            <strong>{metric(metrics.effectiveSystemicFlowLMin, 1)}</strong>
            <small>L/min</small>
          </div>
          <div>
            <span>MAP / PP</span>
            <strong>
              {metric(metrics.mapMmHg)} / {metric(metrics.pulsePressureMmHg)}
            </strong>
            <small>mm Hg</small>
          </div>
          <div {...target('monitor:filling-pressures', highlightTarget)}>
            <span>RAP / PCWP</span>
            <strong>
              {metric(metrics.rapMmHg)} / {metric(metrics.pcwpMmHg)}
            </strong>
            <small>mm Hg</small>
          </div>
          <div {...target('monitor:filling-pressures', highlightTarget)}>
            <span>PAP</span>
            <strong>
              {metric(metrics.papSystolicMmHg)} / {metric(metrics.papDiastolicMmHg)}
            </strong>
            <small>mm Hg</small>
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
            <div data-color="device">
              <span>TIMING</span>
              <strong>{metric(metrics.timingQualityPercent)}%</strong>
              <small>synchrony</small>
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
        <TrendPlot state={state} targetProps={target('monitor:response-trend', highlightTarget)} />
      </div>
      <p className={styles.causalCallout}>
        <strong>{revealCausality ? 'Why the display changed:' : 'Challenge mode:'}</strong>{' '}
        {revealCausality
          ? state.causalExplanation
          : 'Causal coaching is withheld until you complete the reassessment.'}
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
