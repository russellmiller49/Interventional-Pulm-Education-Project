'use client'

import { useId, useMemo, useState, type Dispatch, type KeyboardEvent } from 'react'

import {
  getArtifactDefinition,
  troubleshootingEntries,
  troubleshootingReferenceRows,
  type ArtifactDefinition,
  type ArtifactId,
} from '../content/troubleshootingAtlas'
import { hemodynamicsSourceClassLabel } from '../content/sourceReviewMetadata'
import { hemodynamicsSourceById } from '../content/sources'
import {
  createNormalPulmonaryArteryWaveform,
  derivePressureMetrics,
  generateArtifactWaveform,
  TROUBLESHOOTING_BEAT_COUNT,
  TROUBLESHOOTING_BEAT_SECONDS,
  TROUBLESHOOTING_SCALE_MMHG,
  zeroLevelOptions,
  type PressureMetrics,
  type QualitativePressureEffect,
  type TroubleshootingWaveformSample,
  type ZeroLevelMode,
} from '../engine/troubleshootingWaveforms'
import type { HemodynamicAction, HemodynamicSimulationState } from '../engine'
import plot from './fast-flush.module.css'
import styles from './icu-hemodynamics.module.css'

const VIEW = { width: 1000, height: 200, top: 8, bottom: 192 } as const
const DURATION_SECONDS = TROUBLESHOOTING_BEAT_COUNT * TROUBLESHOOTING_BEAT_SECONDS
const Y_TICKS = [0, 10, 20, 30, 40] as const

function xForTime(timeSeconds: number): number {
  return (timeSeconds / DURATION_SECONDS) * VIEW.width
}

/**
 * A sample's own height. It is not moved to the axis' edge when it lies outside the axis: the plot
 * clips it there instead, as every other figure in this module now does, so a pressure that leaves
 * the scale is never drawn as a pressure *at* the scale's limit.
 */
function yForPressure(pressureMmHg: number): number {
  const fraction =
    (pressureMmHg - TROUBLESHOOTING_SCALE_MMHG.minimum) /
    (TROUBLESHOOTING_SCALE_MMHG.maximum - TROUBLESHOOTING_SCALE_MMHG.minimum)
  return VIEW.bottom - fraction * (VIEW.bottom - VIEW.top)
}

function percent(value: number, whole: number): string {
  return `${((value / whole) * 100).toFixed(3)}%`
}

function waveformPath(samples: readonly TroubleshootingWaveformSample[]): string {
  return samples
    .map(
      (sample, index) =>
        `${index === 0 ? 'M' : 'L'} ${xForTime(sample.timeSeconds).toFixed(2)} ${yForPressure(sample.pressureMmHg).toFixed(2)}`,
    )
    .join(' ')
}

function pressureAtTime(
  samples: readonly TroubleshootingWaveformSample[],
  timeSeconds: number,
): number {
  return samples.reduce((nearest, sample) =>
    Math.abs(sample.timeSeconds - timeSeconds) < Math.abs(nearest.timeSeconds - timeSeconds)
      ? sample
      : nearest,
  ).pressureMmHg
}

/**
 * One tracing of the atlas: the normal reference or a signal problem, on the shared axis.
 *
 * The samples, the scale and the callouts are unchanged. The labels are: ticks, beat names and
 * callouts were drawn inside the SVG in its own units, so in the two-column comparison they shrank
 * to a few pixels. They are page text around the plot now, set in rem, and each callout sits in a
 * track above the plot with a line down to the sample it names.
 */
function PaWaveformFigure({
  label,
  description,
  samples,
  metrics,
  callouts = [],
  showSystoleMarkers = false,
}: {
  readonly label: string
  readonly description: string
  readonly samples: readonly TroubleshootingWaveformSample[]
  readonly metrics: PressureMetrics
  readonly callouts?: ArtifactDefinition['callouts']
  readonly showSystoleMarkers?: boolean
}) {
  const clipId = useId()
  const path = useMemo(() => waveformPath(samples), [samples])
  const outOfRange = samples.some(
    (sample) =>
      sample.pressureMmHg < TROUBLESHOOTING_SCALE_MMHG.minimum ||
      sample.pressureMmHg > TROUBLESHOOTING_SCALE_MMHG.maximum,
  )
  const rangeNotice = outOfRange
    ? `Part of this tracing leaves the ${TROUBLESHOOTING_SCALE_MMHG.minimum} to ${TROUBLESHOOTING_SCALE_MMHG.maximum} mmHg axis and is clipped there, not flattened. The sampled pressures are unchanged.`
    : ''
  const accessibleDescription = `${label}. Four complete beats on a fixed 0 to 40 mmHg scale. ${description} Generated pressures: systolic ${metrics.systolicMmHg.toFixed(1)}, diastolic ${metrics.diastolicMmHg.toFixed(1)}, mean ${metrics.meanMmHg.toFixed(1)}, and pulse pressure ${metrics.pulsePressureMmHg.toFixed(1)} mmHg.${rangeNotice ? ` ${rangeNotice}` : ''}`
  const placedCallouts = callouts.map((callout, index) => {
    const x = xForTime(callout.timeSeconds)
    return {
      ...callout,
      x,
      y: yForPressure(pressureAtTime(samples, callout.timeSeconds)),
      row: index % 2,
      anchor: x < VIEW.width * 0.2 ? 'start' : x > VIEW.width * 0.8 ? 'end' : 'middle',
    }
  })

  return (
    <figure className={`${styles.artifactWaveformFigure} ${plot.trace}`} data-artifact-figure>
      <figcaption>
        <strong>{label}</strong>
        <span>
          Fixed scale · {TROUBLESHOOTING_SCALE_MMHG.minimum}–{TROUBLESHOOTING_SCALE_MMHG.maximum}{' '}
          mmHg · {TROUBLESHOOTING_BEAT_COUNT} beats
        </span>
      </figcaption>
      <div className={plot.frame}>
        <div className={plot.track} aria-hidden="true">
          {showSystoleMarkers ? (
            <span
              className={plot.marker}
              style={{ left: percent(xForTime(0.045 * TROUBLESHOOTING_BEAT_SECONDS), VIEW.width) }}
            >
              QRS / systole
            </span>
          ) : null}
          {placedCallouts.map((callout) => (
            <span
              key={callout.id}
              className={plot.offScale}
              data-artifact-callout={callout.id}
              data-anchor={callout.anchor}
              style={{
                left: percent(callout.x, VIEW.width),
                top: `${callout.row * 1.2}rem`,
              }}
            >
              {callout.label}
            </span>
          ))}
        </div>
        <div className={plot.axis} aria-hidden="true">
          <span className={plot.sizer}>40</span>
          <span className={plot.unit}>mmHg</span>
          {Y_TICKS.map((tick) => {
            const y = yForPressure(tick)
            return (
              <span
                key={tick}
                className={plot.tick}
                data-anchor={
                  y / VIEW.height < 0.1 ? 'top' : y / VIEW.height > 0.9 ? 'bottom' : 'middle'
                }
                style={{ top: percent(y, VIEW.height) }}
              >
                {tick}
              </span>
            )
          })}
        </div>
        <div className={plot.plot}>
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            role="img"
            aria-label={accessibleDescription}
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y={VIEW.top} width={VIEW.width} height={VIEW.bottom - VIEW.top} />
              </clipPath>
            </defs>
            {Y_TICKS.map((tick) => {
              const y = yForPressure(tick)
              return (
                <line
                  key={tick}
                  className={plot.gridLine}
                  x1="0"
                  x2={VIEW.width}
                  y1={y}
                  y2={y}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            {Array.from({ length: TROUBLESHOOTING_BEAT_COUNT + 1 }, (_, index) => {
              const x = xForTime(index * TROUBLESHOOTING_BEAT_SECONDS)
              return (
                <line
                  key={index}
                  className={plot.timeLine}
                  x1={x}
                  x2={x}
                  y1="0"
                  y2={VIEW.height}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            {showSystoleMarkers
              ? Array.from({ length: TROUBLESHOOTING_BEAT_COUNT }, (_, beatIndex) => {
                  const x = xForTime((beatIndex + 0.045) * TROUBLESHOOTING_BEAT_SECONDS)
                  return (
                    <line
                      key={beatIndex}
                      className={plot.eventLine}
                      x1={x}
                      x2={x}
                      y1="0"
                      y2={VIEW.height}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                })
              : null}
            {placedCallouts.map((callout) => (
              <line
                key={callout.id}
                className={styles.artifactCalloutLeader}
                data-artifact-leader={callout.id}
                x1={callout.x}
                x2={callout.x}
                y1="0"
                y2={Math.max(0, Math.min(VIEW.height, callout.y))}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path
              className={styles.artifactTracePath}
              d={path}
              clipPath={`url(#${clipId})`}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className={styles.artifactCalloutPoints} aria-hidden="true">
            {placedCallouts
              .filter((callout) => callout.y >= VIEW.top && callout.y <= VIEW.bottom)
              .map((callout) => (
                <span
                  key={callout.id}
                  style={{
                    left: percent(callout.x, VIEW.width),
                    top: percent(callout.y, VIEW.height),
                  }}
                />
              ))}
          </div>
        </div>
        <div className={plot.time} aria-hidden="true">
          {Array.from({ length: TROUBLESHOOTING_BEAT_COUNT }, (_, index) => (
            <span
              key={index}
              style={{
                left: percent(xForTime((index + 0.5) * TROUBLESHOOTING_BEAT_SECONDS), VIEW.width),
              }}
            >
              beat {index + 1}
            </span>
          ))}
        </div>
      </div>
      {rangeNotice ? (
        <p className={plot.rangeNote} data-waveform-range-note>
          {rangeNotice}
        </p>
      ) : null}
    </figure>
  )
}

const pressureEffectPresentation: Record<
  QualitativePressureEffect,
  { readonly icon: string; readonly label: string }
> = {
  'falsely high': { icon: '↑', label: 'Falsely high' },
  'falsely low': { icon: '↓', label: 'Falsely low' },
  'relatively preserved': { icon: '≈', label: 'Relatively preserved' },
  'shifted high': { icon: '↑', label: 'Shifted high' },
  'shifted low': { icon: '↓', label: 'Shifted low' },
  'measuring a different compartment': { icon: '↔', label: 'Different compartment' },
  unreliable: { icon: '!', label: 'Unreliable' },
}

function PressureEffectTiles({
  metrics,
  effects,
  showNumbers,
}: {
  readonly metrics: PressureMetrics
  readonly effects: Record<
    'systolic' | 'diastolic' | 'mean' | 'pulsePressure',
    QualitativePressureEffect
  >
  readonly showNumbers: boolean
}) {
  const tiles = [
    { id: 'systolic', label: 'Systolic', value: metrics.systolicMmHg },
    { id: 'diastolic', label: 'Diastolic', value: metrics.diastolicMmHg },
    { id: 'mean', label: 'Mean', value: metrics.meanMmHg },
    { id: 'pulsePressure', label: 'Pulse pressure', value: metrics.pulsePressureMmHg },
  ] as const

  return (
    <dl className={styles.artifactEffectGrid}>
      {tiles.map((tile) => {
        const effect = effects[tile.id]
        const presentation = pressureEffectPresentation[effect]
        return (
          <div data-effect={effect} key={tile.id}>
            <dt>{tile.label}</dt>
            <dd>
              <span aria-hidden="true">{presentation.icon}</span>
              {presentation.label}
            </dd>
            <small>
              {showNumbers ? `${tile.value.toFixed(1)} mmHg` : 'No valid numeric readout'}
            </small>
          </div>
        )
      })}
    </dl>
  )
}

interface TroubleshootingPanelProps {
  readonly state?: HemodynamicSimulationState
  readonly dispatch?: Dispatch<HemodynamicAction>
}

export function TroubleshootingPanel({ state, dispatch }: TroubleshootingPanelProps) {
  const [selectedId, setSelectedId] = useState<ArtifactId>('overdamped')
  const [zeroLevelMode, setZeroLevelMode] = useState<ZeroLevelMode>('transducer-too-low')
  const selected = getArtifactDefinition(selectedId)
  const normalSamples = useMemo(() => createNormalPulmonaryArteryWaveform(), [])
  const normalMetrics = useMemo(() => derivePressureMetrics(normalSamples), [normalSamples])
  const artifactResult = useMemo(
    () => generateArtifactWaveform(selectedId, { zeroLevelMode }),
    [selectedId, zeroLevelMode],
  )
  const canApply = Boolean(state && dispatch && selected.liveArtifact)
  const applied =
    selected.liveArtifact !== null && state?.measurementSystem.artifact === selected.liveArtifact
  const sources = selected.sourceIds.map((sourceId) => {
    const source = hemodynamicsSourceById.get(sourceId)
    if (!source) throw new Error(`Unknown hemodynamics source in ${selected.id}: ${sourceId}`)
    return source
  })
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % troubleshootingEntries.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + troubleshootingEntries.length) % troubleshootingEntries.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = troubleshootingEntries.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    const nextEntry = troubleshootingEntries[nextIndex]
    setSelectedId(nextEntry.id)
    document.getElementById(`artifact-tab-${nextEntry.id}`)?.focus()
  }

  return (
    <section className={styles.troubleshootingPanel} aria-labelledby="troubleshooting-heading">
      <header className={styles.atlasPanelHeader}>
        <div>
          <span>PA signal troubleshooting</span>
          <h3 id="troubleshooting-heading">Name the waveform, then validate the numbers</h3>
          <p>
            Every example starts with the same deterministic 25/10 mmHg PA source signal. The panels
            share one time scale and one 0–40 mmHg pressure scale.
          </p>
        </div>
      </header>

      <div className={styles.atlasTabs} role="tablist" aria-label="PA catheter signal problems">
        {troubleshootingEntries.map((entry, index) => (
          <button
            id={`artifact-tab-${entry.id}`}
            key={entry.id}
            type="button"
            role="tab"
            aria-controls={`artifact-panel-${entry.id}`}
            aria-selected={entry.id === selected.id}
            tabIndex={entry.id === selected.id ? 0 : -1}
            onClick={() => setSelectedId(entry.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {entry.shortLabel}
          </button>
        ))}
      </div>

      <div
        className={styles.troubleshootingDetail}
        id={`artifact-panel-${selected.id}`}
        role="tabpanel"
        aria-labelledby={`artifact-tab-${selected.id}`}
      >
        <header className={styles.artifactScenarioHeader}>
          <div>
            <span>Selected signal problem</span>
            <h4>{selected.label}</h4>
          </div>
          <strong>{selected.pressureInterpretation.replace('-', ' ')}</strong>
        </header>

        {selected.warning ? (
          <p className={styles.artifactDangerBanner} role="alert">
            <strong>Safety stop.</strong> {selected.warning}
          </p>
        ) : null}

        {selected.id === 'zero-level' ? (
          <label className={styles.zeroLevelScenarioControl}>
            Zero/level scenario
            <select
              value={zeroLevelMode}
              onChange={(event) => setZeroLevelMode(event.target.value as ZeroLevelMode)}
            >
              {Object.values(zeroLevelOptions).map((option) => (
                <option value={option.id} key={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>{zeroLevelOptions[zeroLevelMode].explanation}</small>
          </label>
        ) : null}

        <div className={styles.artifactComparison}>
          <PaWaveformFigure
            label="Normal PA reference"
            description="Rapid upstroke, systolic decline, pulmonic closure notch, and diastolic runoff."
            samples={normalSamples}
            metrics={normalMetrics}
          />
          <PaWaveformFigure
            label={selected.shortLabel}
            description={selected.appearance.join(' ')}
            samples={artifactResult.samples}
            metrics={artifactResult.metrics}
            callouts={selected.callouts}
            showSystoleMarkers={selected.id === 'catheter-whip'}
          />
        </div>

        <PressureEffectTiles
          metrics={artifactResult.metrics}
          effects={artifactResult.effects}
          showNumbers={artifactResult.metricDisplay === 'derived'}
        />

        <p className={styles.artifactNumbersExplanation}>{selected.numbersTeaching}</p>

        <div className={styles.artifactTeachingGrid}>
          <section>
            <h4>What you see</h4>
            <ul>
              {selected.appearance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4>Why it happens</h4>
            <ul>
              {selected.causes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4>What it does to the numbers</h4>
            <p>{selected.numbersTeaching}</p>
          </section>
          <section>
            <h4>Why it matters</h4>
            <p>{selected.whyItMatters}</p>
          </section>
          <section>
            <h4>What to do</h4>
            <ol>
              {selected.actions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
          <section className={styles.artifactDoNot}>
            <h4>Do not</h4>
            <ul>
              {selected.doNot.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        {canApply && dispatch && selected.liveArtifact ? (
          <button
            type="button"
            className={styles.applyArtifactButton}
            aria-pressed={applied}
            onClick={() =>
              dispatch({
                type: 'SET_ARTIFACT',
                artifact: applied ? 'none' : selected.liveArtifact!,
              })
            }
          >
            {applied
              ? 'Clear this artifact from the live monitor'
              : 'Apply this artifact to the live monitor'}
          </button>
        ) : null}

        <aside className={styles.artifactSources} aria-label="References for selected artifact">
          <strong>References</strong>
          <ul>
            {sources.map((source) => (
              <li key={source.id}>
                {hemodynamicsSourceClassLabel(source)}:{' '}
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                ) : (
                  source.title
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <details className={styles.troubleshootingReference}>
        <summary>Corrected PA catheter troubleshooting reference</summary>
        <div className={styles.troubleshootingTableScroller}>
          <table>
            <thead>
              <tr>
                <th scope="col">Problem</th>
                <th scope="col">What the waveform looks like</th>
                <th scope="col">Likely causes</th>
                <th scope="col">Immediate checks</th>
                <th scope="col">Corrective action</th>
                <th scope="col">Important “do not”</th>
              </tr>
            </thead>
            <tbody>
              {troubleshootingReferenceRows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" data-label="Problem">
                    {row.problem}
                  </th>
                  <td data-label="Waveform">{row.waveform}</td>
                  <td data-label="Likely causes">{row.causes}</td>
                  <td data-label="Immediate checks">{row.checks}</td>
                  <td data-label="Corrective action">{row.action}</td>
                  <td data-label="Do not">{row.warning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
