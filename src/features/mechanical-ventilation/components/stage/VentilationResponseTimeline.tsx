'use client'

import { useEffect, useRef, useState } from 'react'
import { ventilationExperimentByUnit } from '../../content/learningExperiments'
import type { LabSession } from '../../engine/learningLab'
import type { TrendSample } from '../../engine/types'
import styles from './task-flow.module.css'

const channels: Record<
  string,
  { key: keyof Omit<TrendSample, 'time'>; label: string; max: number }[]
> = {
  'oxygenation-response': [
    { key: 'spo2Percent', label: 'SpO₂ (%)', max: 100 },
    { key: 'mapMmHg', label: 'Mean arterial pressure (mm Hg)', max: 140 },
    { key: 'peakPressureCmH2O', label: 'Peak airway pressure (cmH₂O)', max: 80 },
  ],
  'ventilation-and-co2': [
    { key: 'paCO2MmHg', label: 'Modeled PaCO₂ (mm Hg)', max: 100 },
    { key: 'peakPressureCmH2O', label: 'Peak airway pressure (cmH₂O)', max: 80 },
  ],
}

/** Read-only renderer of the engine's recorded trends, without additional response models. */
export function VentilationResponseTimeline({ session }: { session: LabSession }) {
  const container = useRef<HTMLElement>(null)
  const [plotWidth, setPlotWidth] = useState(350)
  useEffect(() => {
    const figure = container.current?.querySelector('figure')
    if (!figure || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setPlotWidth(Math.max(180, entry.contentRect.width)),
    )
    observer.observe(figure)
    return () => observer.disconnect()
  }, [session.unitId])
  const state = session.simulation
  const traces = channels[session.unitId] ?? []
  const start = Math.max(0, state.trends[0]?.time ?? 0)
  const end = Math.max(start + 1, state.simulationTime)
  const points = state.trends.filter((point) => point.time >= start)
  const x = (time: number) => 40 + ((time - start) / (end - start)) * (plotWidth - 60)
  const round = ventilationExperimentByUnit.get(session.unitId)!.rounds[session.round]
  const elapsed =
    session.readySince === null ? 0 : Math.max(0, state.simulationTime - session.readySince)
  const actions = session.events.filter((event) =>
    ['SET_CONTROL', 'SET_TEACHING_MECHANICS', 'PERFORM_INTERVENTION'].includes(event.action.type),
  )
  const lastAction = actions.at(-1)
  return (
    <section ref={container} className={styles.timeline} data-response-timeline>
      <h3>Modeled response over time</h3>
      <p className={styles.note}>
        Delivery changes first; patient gas exchange develops over time. All rows use the same
        elapsed model time. These are model values, not newly sampled blood gases.
      </p>
      {traces.map((trace) => {
        const max = Math.max(trace.max, ...points.map((point) => point[trace.key]))
        const y = (value: number) => 68 - (value / max) * 56
        return (
          <figure key={trace.key}>
            <figcaption>
              {trace.label} · range 0–{max.toFixed(0)}
              {max > trace.max ? ' (expanded)' : ''}
            </figcaption>
            <svg
              viewBox={`0 0 ${plotWidth} 95`}
              role="img"
              aria-label={`${trace.label}, ${start.toFixed(0)} to ${end.toFixed(0)} simulated seconds; current ${points.at(-1)?.[trace.key].toFixed(1) ?? 'not recorded'}`}
            >
              <line x1="40" x2={plotWidth - 20} y1="68" y2="68" stroke="#aec5c8" />
              <text x="5" y="70" fill="#aec5c8" fontSize="12">
                0
              </text>
              <text x="5" y="15" fill="#aec5c8" fontSize="12">
                {max.toFixed(0)}
              </text>
              <path
                d={points
                  .map((point, i) => `${i ? 'L' : 'M'}${x(point.time)} ${y(point[trace.key])}`)
                  .join(' ')}
                stroke="#71e1e5"
                strokeWidth="2"
                fill="none"
              />
              {lastAction && lastAction.at >= start ? (
                <line
                  x1={x(lastAction.at)}
                  x2={x(lastAction.at)}
                  y1="10"
                  y2="68"
                  stroke="#ffbf62"
                  strokeDasharray="3 3"
                />
              ) : null}
              <text x="40" y="90" fill="#aec5c8" fontSize="12">
                {start.toFixed(0)} s
              </text>
              <text x={plotWidth - 20} y="90" fill="#aec5c8" fontSize="12" textAnchor="end">
                {end.toFixed(0)} s
              </text>
            </svg>
          </figure>
        )
      })}
      <p aria-live="off">
        {lastAction
          ? `Dashed marker: latest selected action at ${lastAction.at.toFixed(1)} s. `
          : 'No selected change yet. '}
        {session.readySince === null
          ? 'Perform the required action before the observation interval begins.'
          : `${Math.min(round.seconds, elapsed).toFixed(0)} / ${round.seconds} simulated seconds of required observation; ${elapsed < round.seconds ? 'response pending' : 'ready for comparison'}.`}
      </p>
      <p className={styles.note}>
        The gas model simplifies dead space and CO₂ production. Advancing time is playback, and does
        not replace the required action or specify a clinical blood-gas schedule.
      </p>
    </section>
  )
}
