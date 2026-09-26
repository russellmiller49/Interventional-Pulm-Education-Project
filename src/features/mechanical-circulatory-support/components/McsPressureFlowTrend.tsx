import { useId } from 'react'

import type { McsDeviceKind, McsTrendSample } from '../engine/types'
import {
  fixedTrendAxis,
  trendRange,
  trendTimeStep,
  trendWindow,
  type McsTrendAxis,
  type McsTrendSeries,
} from './monitorDisplay'

/**
 * Pressure and flow, drawn apart on one time axis.
 *
 * What stood here was one plot with no axis: mean pressure on a 20–150 range and every flow
 * multiplied by sixteen to share it — "effective flow ×16" — or, in the Section 4 panel, each line
 * stretched to fill the pane by its own minimum and maximum, so a 71–78 mm Hg wobble drew as wild
 * swings and a flat flow line lay on the frame (F20). A flow of zero sat below the ×16 range and
 * was drawn outside the plot, on top of the caption under it (F34).
 *
 * Now pressure has its own panel in mm Hg and flow its own in L/min, both starting at zero, both on
 * fixed scales that only grow — in whole steps, and said so — when a value would not fit, and both
 * sharing one simulated-time axis over a fixed window. No value is transformed, so the numbers in
 * the legend are the numbers on the lines. Every series is named in words with its line pattern,
 * its latest value and its range; a flat series is drawn inside the plot, above the frame. The
 * whole trend is also a table.
 *
 * No intervention time is marked: the model state records which actions were taken, not when, so
 * there is no event time to draw.
 */

const VIEW_WIDTH = 480
const LEFT = 50
const RIGHT = 470
interface PanelBand {
  readonly top: number
  readonly bottom: number
}
const PRESSURE_PANEL: PanelBand = { top: 24, bottom: 118 }
const FLOW_PANEL: PanelBand = { top: 150, bottom: 244 }
const INSET = 6

export const MCS_TREND_PRESSURE_DEFAULT_MAX = 160
export const MCS_TREND_FLOW_DEFAULT_MAX = 8

function monitorSeries(deviceKind: McsDeviceKind): readonly McsTrendSeries[] {
  const map: McsTrendSeries = {
    id: 'map',
    label: 'Mean arterial pressure',
    unit: 'mm Hg',
    read: (sample) => sample.mapMmHg,
    lineWords: 'solid line',
    color: '#ff7185',
  }
  const effective: McsTrendSeries = {
    id: 'effective-flow',
    label: 'Effective systemic flow',
    unit: 'L/min',
    read: (sample) => sample.effectiveFlowLMin,
    dash: '12 3',
    lineWords: 'long dashes',
    color: '#6ee7f2',
  }
  if (deviceKind === 'iabp') return [map, effective]
  if (deviceKind === 'lvad') {
    return [
      map,
      effective,
      {
        id: 'durable-pump',
        label: 'Durable pump flow (modeled transfer)',
        unit: 'L/min',
        read: (sample) => sample.deviceFlowLMin,
        dash: '6 5',
        lineWords: 'short dashes',
        color: '#f4c66e',
      },
    ]
  }
  return [
    map,
    effective,
    {
      id: 'left-pump',
      label: 'Left pump flow',
      unit: 'L/min',
      read: (sample) => sample.leftDeviceFlowLMin,
      dash: '6 5',
      lineWords: 'short dashes',
      color: '#f4c66e',
    },
    {
      id: 'right-pump',
      label: 'Right pump flow',
      unit: 'L/min',
      read: (sample) => sample.rightDeviceFlowLMin,
      dash: '3 4',
      lineWords: 'dots',
      color: '#b788ff',
    },
  ]
}

/** The series the bedside monitor draws for a device: pressure, delivery, and each pump channel. */
export function mcsMonitorTrendSeries(deviceKind: McsDeviceKind): readonly McsTrendSeries[] {
  return monitorSeries(deviceKind)
}

/** Mean pressure and effective delivery only, in the ink colour of the surrounding text. */
export const MCS_TREND_PRESSURE_AND_DELIVERY: readonly McsTrendSeries[] = [
  {
    id: 'map',
    label: 'Mean arterial pressure',
    unit: 'mm Hg',
    read: (sample) => sample.mapMmHg,
    lineWords: 'solid line',
    color: 'currentColor',
  },
  {
    id: 'effective-flow',
    label: 'Effective systemic flow',
    unit: 'L/min',
    read: (sample) => sample.effectiveFlowLMin,
    dash: '12 3',
    lineWords: 'long dashes',
    color: 'currentColor',
  },
]

function names(series: readonly McsTrendSeries[]): string {
  const words = series.map((line) =>
    line.id === 'map'
      ? 'MAP'
      : line.id === 'effective-flow'
        ? 'effective systemic flow'
        : line.id === 'left-pump'
          ? 'left pump flow'
          : line.id === 'right-pump'
            ? 'right pump flow'
            : 'durable pump flow',
  )
  if (words.length <= 2) return words.join(' and ')
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`
}

function formatValue(value: number, unit: McsTrendSeries['unit']): string {
  return unit === 'mm Hg' ? value.toFixed(0) : value.toFixed(1)
}

function yFor(value: number, axis: McsTrendAxis, panel: PanelBand) {
  const span = axis.max - axis.min || 1
  const clamped = Math.min(axis.max, Math.max(axis.min, value))
  return (
    panel.bottom - INSET - ((clamped - axis.min) / span) * (panel.bottom - panel.top - 2 * INSET)
  )
}

export function McsPressureFlowTrend({
  samples,
  windowSeconds,
  series,
  tone = 'monitor',
  withholdFlow = false,
  targetProps,
}: {
  readonly samples: readonly McsTrendSample[]
  readonly windowSeconds: number
  readonly series: readonly McsTrendSeries[]
  /** `monitor` draws on the dark monitor card; `inherit` draws in the surrounding ink colour. */
  readonly tone?: 'monitor' | 'inherit'
  /** Cover the flow lines until a prediction is committed, as the monitor's flow tiles are. */
  readonly withholdFlow?: boolean
  readonly targetProps?: Record<string, string>
}) {
  const clipId = useId()
  const { samples: window, start, end, span } = trendWindow(samples, windowSeconds)
  const pressureSeries = series.filter((line) => line.unit === 'mm Hg')
  const flowSeries = withholdFlow ? [] : series.filter((line) => line.unit === 'L/min')
  const pressureAxis = fixedTrendAxis(
    pressureSeries.flatMap((line) => window.map(line.read)),
    MCS_TREND_PRESSURE_DEFAULT_MAX,
    40,
  )
  const flowAxis = fixedTrendAxis(
    flowSeries.flatMap((line) => window.map(line.read)),
    MCS_TREND_FLOW_DEFAULT_MAX,
    2,
  )
  const xFor = (time: number) => LEFT + ((time - start) / span) * (RIGHT - LEFT)
  const timeStep = trendTimeStep(span)
  const timeTicks: number[] = []
  for (
    let tick = Math.ceil(Math.max(0, start) / timeStep) * timeStep;
    tick <= end;
    tick += timeStep
  )
    timeTicks.push(tick)
  const ink = tone === 'monitor' ? '#b9cdcd' : 'currentColor'
  const grid = tone === 'monitor' ? '#1f4049' : 'currentColor'
  const frame = tone === 'monitor' ? '#4d6a70' : 'currentColor'
  const seriesLabel = names([...pressureSeries, ...series.filter((line) => line.unit === 'L/min')])
  const path = (line: McsTrendSeries, axis: McsTrendAxis, panel: PanelBand) =>
    window
      .filter((sample) => Number.isFinite(line.read(sample)))
      .map(
        (sample, index) =>
          `${index === 0 ? 'M' : 'L'}${xFor(sample.time).toFixed(1)},${yFor(line.read(sample), axis, panel).toFixed(1)}`,
      )
      .join(' ')
  const tableRows = window.filter(
    (sample, index) =>
      index === window.length - 1 ||
      Math.floor(sample.time / 5) !== Math.floor((window[index + 1]?.time ?? sample.time) / 5),
  )

  const panelFrame = (
    panel: PanelBand,
    axis: McsTrendAxis,
    title: string,
    kind: 'pressure' | 'flow',
  ) => (
    <g data-trend-panel={kind}>
      <text x={LEFT} y={panel.top - 8} fontSize="12" fontWeight="700" fill={ink}>
        {title}
      </text>
      {axis.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={LEFT}
            x2={RIGHT}
            y1={yFor(tick, axis, panel)}
            y2={yFor(tick, axis, panel)}
            stroke={grid}
            strokeOpacity={tone === 'monitor' ? 1 : 0.18}
            strokeWidth="1"
          />
          <text
            x={LEFT - 6}
            y={yFor(tick, axis, panel) + 4}
            textAnchor="end"
            fontSize="11"
            fill={ink}
            data-axis-tick={kind}
          >
            {tick}
          </text>
        </g>
      ))}
      <rect
        x={LEFT}
        y={panel.top}
        width={RIGHT - LEFT}
        height={panel.bottom - panel.top}
        fill="none"
        stroke={frame}
        strokeOpacity={tone === 'monitor' ? 1 : 0.45}
      />
    </g>
  )

  return (
    <div className="min-w-0" data-pressure-flow-trend {...targetProps}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} 284`}
        role="img"
        aria-label={`Trend of ${seriesLabel} over the last ${span.toFixed(0)} simulated seconds, pressure and flow on separate labelled scales: pressure 0 to ${pressureAxis.max} mm Hg, flow 0 to ${flowAxis.max} L/min`}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: '40rem',
          height: 'auto',
          overflow: 'hidden',
        }}
        data-trend-svg
      >
        <defs>
          <clipPath id={`${clipId}-pressure`}>
            <rect
              x={LEFT}
              y={PRESSURE_PANEL.top}
              width={RIGHT - LEFT}
              height={PRESSURE_PANEL.bottom - PRESSURE_PANEL.top}
            />
          </clipPath>
          <clipPath id={`${clipId}-flow`}>
            <rect
              x={LEFT}
              y={FLOW_PANEL.top}
              width={RIGHT - LEFT}
              height={FLOW_PANEL.bottom - FLOW_PANEL.top}
            />
          </clipPath>
        </defs>
        {panelFrame(PRESSURE_PANEL, pressureAxis, 'Pressure · mm Hg', 'pressure')}
        {panelFrame(FLOW_PANEL, flowAxis, 'Flow · L/min', 'flow')}
        <g clipPath={`url(#${clipId}-pressure)`}>
          {pressureSeries.map((line) => (
            <path
              key={line.id}
              data-series={line.id}
              d={path(line, pressureAxis, PRESSURE_PANEL)}
              fill="none"
              stroke={line.color}
              strokeWidth="2.5"
              strokeDasharray={line.dash}
            />
          ))}
        </g>
        <g clipPath={`url(#${clipId}-flow)`}>
          {flowSeries.map((line) => (
            <path
              key={line.id}
              data-series={line.id}
              d={path(line, flowAxis, FLOW_PANEL)}
              fill="none"
              stroke={line.color}
              strokeWidth="2.5"
              strokeDasharray={line.dash}
            />
          ))}
        </g>
        {withholdFlow ? (
          <text
            x={(LEFT + RIGHT) / 2}
            y={(FLOW_PANEL.top + FLOW_PANEL.bottom) / 2 + 4}
            textAnchor="middle"
            fontSize="12"
            fill={ink}
          >
            Flow lines covered until you commit your prediction
          </text>
        ) : null}
        {timeTicks.map((tick) => (
          <text
            key={tick}
            x={xFor(tick)}
            y={FLOW_PANEL.bottom + 16}
            textAnchor="middle"
            fontSize="11"
            fill={ink}
            data-axis-tick="time"
          >
            {tick}
          </text>
        ))}
        <text
          x={(LEFT + RIGHT) / 2}
          y={278}
          textAnchor="middle"
          fontSize="11"
          fill={ink}
          data-axis-title="time"
        >
          Simulated time (s)
        </text>
      </svg>
      <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-xs leading-5" data-trend-legend>
        {series.map((line) => {
          const covered = withholdFlow && line.unit === 'L/min'
          const range = covered ? null : trendRange(window, line.read)
          return (
            <li
              key={line.id}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2"
              data-trend-legend-item={line.id}
            >
              <svg viewBox="0 0 36 10" aria-hidden="true" focusable="false" className="h-2.5 w-9">
                <line
                  x1="1"
                  x2="35"
                  y1="5"
                  y2="5"
                  stroke={line.color}
                  strokeWidth="2.5"
                  strokeDasharray={line.dash}
                />
              </svg>
              <span style={{ overflowWrap: 'normal' }}>
                <strong>{line.label}</strong> · {line.lineWords} ·{' '}
                {covered
                  ? 'covered until you commit your prediction'
                  : range
                    ? `now ${formatValue(range.latest, line.unit)} ${line.unit}; ${formatValue(range.minimum, line.unit)}–${formatValue(range.maximum, line.unit)} ${line.unit} over this window`
                    : 'no samples yet'}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="m-0 mt-1 text-xs leading-5" data-trend-scale-note>
        Fixed scales from zero: pressure 0–{pressureAxis.max} mm Hg
        {pressureAxis.extended ? ' (raised from 0–160 to hold this run)' : ''}, flow 0–
        {flowAxis.max} L/min
        {flowAxis.extended ? ' (raised from 0–8 to hold this run)' : ''}, one simulated-time axis
        across the {span.toFixed(0)} s shown (at most the last {windowSeconds} s). No value is
        rescaled; a flat line is a steady value.
      </p>
      <details className="mt-1 text-xs leading-5" data-trend-table>
        <summary>Trend as a table</summary>
        <div
          className="overflow-x-auto"
          role="region"
          tabIndex={0}
          aria-label="Trend values by simulated time"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Simulated time</th>
                {series.map((line) => (
                  <th key={line.id} scope="col">
                    {line.label} ({line.unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((sample) => (
                <tr key={sample.time}>
                  <th scope="row">{sample.time.toFixed(1)} s</th>
                  {series.map((line) => (
                    <td key={line.id}>
                      {withholdFlow && line.unit === 'L/min'
                        ? 'covered'
                        : formatValue(line.read(sample), line.unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
