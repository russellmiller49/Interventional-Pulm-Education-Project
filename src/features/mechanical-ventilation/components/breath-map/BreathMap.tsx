'use client'

import { useId, useMemo } from 'react'

import {
  breathMapSegments,
  breathMapTrace,
  breathStop,
  breathStopIds,
  type BreathStopId,
} from '../../content/breathSpine'
import styles from './breath-map.module.css'

const VIEW_WIDTH = 640
const VIEW_HEIGHT = 330
const PLOT_LEFT = 58
const PLOT_RIGHT = 624
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT
const ROWS = [
  { key: 'pressure', label: 'Pressure', top: 26, height: 88, className: styles.tracePressure },
  { key: 'flow', label: 'Flow', top: 124, height: 88, className: styles.traceFlow },
  { key: 'volume', label: 'Volume', top: 222, height: 88, className: styles.traceVolume },
] as const
const SAMPLES = 160

function xAt(t: number): number {
  return PLOT_LEFT + t * PLOT_WIDTH
}

function yAt(row: (typeof ROWS)[number], value: number): number {
  return row.top + row.height - value * (row.height - 8) - 4
}

function tracePath(row: (typeof ROWS)[number]): string {
  const points: string[] = []
  for (let index = 0; index <= SAMPLES; index += 1) {
    const t = index / SAMPLES
    const value = breathMapTrace(t)[row.key]
    points.push(`${index === 0 ? 'M' : 'L'}${xAt(t).toFixed(1)} ${yAt(row, value).toFixed(1)}`)
  }
  return points.join(' ')
}

function segmentPath(row: (typeof ROWS)[number], stopId: BreathStopId): string {
  const { from, to } = breathMapSegments[stopId]
  const points: string[] = []
  const count = Math.max(4, Math.round((to - from) * SAMPLES))
  for (let index = 0; index <= count; index += 1) {
    const t = from + ((to - from) * index) / count
    const value = breathMapTrace(t)[row.key]
    points.push(`${index === 0 ? 'M' : 'L'}${xAt(t).toFixed(1)} ${yAt(row, value).toFixed(1)}`)
  }
  return points.join(' ')
}

export interface BreathMapAnswerChoice {
  readonly id: string
  readonly label: string
}

export interface BreathMapAnswer {
  readonly legend: string
  readonly name: string
  readonly choices: readonly BreathMapAnswerChoice[]
  /** Choice id → the stop it stands for. Total over the choices. */
  readonly targets: Readonly<Record<string, BreathStopId>>
  readonly selectedChoiceId: string | null
  readonly onSelect: (choiceId: string) => void
  readonly disabled: boolean
  /** Once committed: the keyed choice, so the rows can say which was right. */
  readonly revealed?: { readonly keyedChoiceId: string }
}

/**
 * One breath, four stops, and where you are.
 *
 * The map lights the stops a step stands at, names the place in words above the drawing and in the
 * drawing's description, and — when a step asks where on the breath a problem lives — becomes the
 * answer control: each stop is a numbered pin on the drawing and a row beneath it, both labels for
 * one visually hidden radio, so the browser supplies the group's keyboard and screen-reader
 * behaviour. Pins are numbered along the breath, not in choice order.
 *
 * Authored teaching schematic of a passive volume-controlled breath. It is not a sample of the
 * engine; the live traces are on the console.
 */
export function BreathMap({
  emphasis,
  caption,
  answer,
}: {
  readonly emphasis: readonly BreathStopId[]
  /** "You are here: Trigger — the start." Absent when the step stands at the whole breath. */
  readonly caption?: string
  readonly answer?: BreathMapAnswer
}) {
  const titleId = useId()
  const descriptionId = useId()
  const inputBase = useId()
  const lit = useMemo(() => new Set(emphasis), [emphasis])
  const litStops = breathStopIds.filter((id) => lit.has(id))
  const description = useMemo(() => {
    const where =
      litStops.length === 0
        ? 'No single stop is marked; the whole breath is in view.'
        : `Marked: ${litStops.map((id) => breathStop(id).title).join('; ')}.`
    return `Schematic of one passive volume-controlled breath on three stacked traces. Pressure rises quickly as gas starts to move, climbs to a peak at the end of inspiration, then falls back to the PEEP baseline. Flow is a flat positive shelf during inspiration, reverses through zero at cycling, and decays back toward zero during expiration. Volume climbs during inspiration and empties during expiration. Four stops are marked across all three traces: trigger, inspiration, cycling, expiration. ${where}`
  }, [litStops])

  const stopNumber = (stopId: BreathStopId) => breathStop(stopId).ordinal
  const choiceForStop = (stopId: BreathStopId) =>
    answer?.choices.find((choice) => answer.targets[choice.id] === stopId)

  return (
    <section
      className={styles.map}
      data-breath-map
      data-emphasis={litStops.length > 0 ? 'some' : 'none'}
      data-lit={litStops.join(' ')}
      aria-labelledby={titleId}
    >
      <div className={styles.header}>
        <h3 id={titleId} className={styles.heading}>
          The breath map
        </h3>
        <span className={styles.badge}>Teaching schematic</span>
      </div>
      <p className={styles.caption} data-breath-map-caption data-empty={!caption}>
        {caption ??
          'One passive volume-controlled breath, start to finish. The live traces are on the console above.'}
      </p>
      <div className={styles.frame}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <desc id={descriptionId}>{description}</desc>
          {breathStopIds.map((stopId) => {
            const { from, to } = breathMapSegments[stopId]
            const x = xAt(from)
            const width = xAt(to) - x
            const isLit = lit.has(stopId)
            return (
              <g key={stopId} data-breath-segment={stopId} data-lit={isLit}>
                <rect
                  className={styles.band}
                  data-lit={isLit}
                  x={x}
                  y={18}
                  width={width}
                  height={VIEW_HEIGHT - 26}
                  rx={6}
                />
                <text className={styles.segmentLabel} data-lit={isLit} x={x + width / 2} y={13}>
                  {stopNumber(stopId)}
                </text>
              </g>
            )
          })}
          {ROWS.map((row) => (
            <g key={row.key}>
              <text className={styles.rowLabel} x={4} y={row.top + 14}>
                {row.label}
              </text>
              {row.key === 'flow' ? (
                <>
                  <line
                    className={styles.zeroLine}
                    x1={PLOT_LEFT}
                    x2={PLOT_RIGHT}
                    y1={yAt(row, 0.5)}
                    y2={yAt(row, 0.5)}
                  />
                  <text className={styles.baselineLabel} x={PLOT_LEFT + 4} y={yAt(row, 0.5) - 4}>
                    zero flow
                  </text>
                </>
              ) : null}
              {row.key === 'pressure' ? (
                <>
                  <line
                    className={styles.zeroLine}
                    x1={PLOT_LEFT}
                    x2={PLOT_RIGHT}
                    y1={yAt(row, 0.18)}
                    y2={yAt(row, 0.18)}
                  />
                  <text
                    className={styles.baselineLabel}
                    x={PLOT_RIGHT - 4}
                    y={yAt(row, 0.18) - 4}
                    textAnchor="end"
                  >
                    PEEP baseline
                  </text>
                </>
              ) : null}
              <path className={`${styles.trace} ${row.className}`} d={tracePath(row)} />
              {litStops.map((stopId) => (
                <path
                  key={stopId}
                  className={`${styles.trace} ${row.className} ${styles.traceLit}`}
                  d={segmentPath(row, stopId)}
                />
              ))}
            </g>
          ))}
        </svg>
        {answer
          ? breathStopIds.map((stopId) => {
              const choice = choiceForStop(stopId)
              if (!choice) return null
              const { from, to } = breathMapSegments[stopId]
              const left = ((xAt(from) + xAt(to)) / 2 / VIEW_WIDTH) * 100
              const selected = answer.selectedChoiceId === choice.id
              return (
                <label
                  key={stopId}
                  htmlFor={`${inputBase}-${choice.id}`}
                  className={styles.pin}
                  data-breath-pin={stopId}
                  data-selected={selected}
                  data-disabled={answer.disabled}
                  style={{ left: `${left}%`, top: '50%' }}
                  aria-hidden="true"
                >
                  {stopNumber(stopId)}
                </label>
              )
            })
          : null}
      </div>
      {!answer ? (
        <ol className={styles.legend} aria-label="The four stops">
          {breathStopIds.map((stopId) => (
            <li key={stopId} data-lit={lit.has(stopId)}>
              <span className={styles.number} aria-hidden="true">
                {stopNumber(stopId)}
              </span>
              {breathStop(stopId).title}
            </li>
          ))}
        </ol>
      ) : null}
      {answer ? (
        <fieldset
          className={styles.answer}
          disabled={answer.disabled}
          data-breath-map-answer
          data-prediction-choices
        >
          <legend>{answer.legend}</legend>
          <p className={styles.hint}>
            Choose a stop: the numbered pins on the drawing and the rows below are the same choices.
          </p>
          {breathStopIds.map((stopId) => {
            const choice = choiceForStop(stopId)
            if (!choice) return null
            const selected = answer.selectedChoiceId === choice.id
            const outcome = answer.revealed
              ? answer.revealed.keyedChoiceId === choice.id
                ? selected
                  ? 'your answer · correct'
                  : 'correct'
                : selected
                  ? 'your answer'
                  : null
              : null
            return (
              <label
                key={choice.id}
                className={styles.option}
                data-selected={selected}
                data-outcome={
                  outcome === null
                    ? undefined
                    : answer.revealed?.keyedChoiceId === choice.id
                      ? 'correct'
                      : 'chosen'
                }
              >
                <input
                  id={`${inputBase}-${choice.id}`}
                  type="radio"
                  name={answer.name}
                  value={choice.id}
                  checked={selected}
                  onChange={() => answer.onSelect(choice.id)}
                />
                <span className={styles.number} aria-hidden="true">
                  {stopNumber(stopId)}
                </span>
                <span>{choice.label}</span>
                {outcome ? (
                  <span className={styles.outcome} data-breath-map-outcome>
                    {outcome}
                  </span>
                ) : null}
              </label>
            )
          })}
        </fieldset>
      ) : null}
      <p className={styles.equivalent}>{description}</p>
    </section>
  )
}

/** "You are here: Trigger — the start." for a set of lit stops, or null for the whole breath. */
export function breathMapCaption(stops: readonly BreathStopId[]): string | undefined {
  if (stops.length === 0) return undefined
  if (stops.length === 1) return `You are here: ${breathStop(stops[0]).title}.`
  return `You are here: ${stops.map((id) => breathStop(id).title).join(' and ')}.`
}
