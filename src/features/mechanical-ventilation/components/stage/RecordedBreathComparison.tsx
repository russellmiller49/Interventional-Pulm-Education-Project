'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { LabRound } from '../../content/learningExperiments'
import { labMetricLabels, type LabEvidence, type LabSnapshot } from '../../engine/learningLab'
import {
  anchorBreathVolume,
  completedBreath,
  sampleSpacingSeconds,
  sampledInspirationSeconds,
  waveformAxes,
  waveformFields,
  type WaveformAxes,
} from '../../engine/teachingBreath'
import type { WaveformSample } from '../../engine/types'
import { CapturedBreath } from './CapturedBreath'
import styles from './task-flow.module.css'
import stage from './ventilation-stage.module.css'

type ComparisonView = 'side-by-side' | 'overlay'

const ROW_LABELS = {
  pawCmH2O: 'Airway pressure (cmH₂O)',
  flowLMin: 'Flow (L/min)',
  volumeMl: 'Volume from breath start (mL)',
  pmusCmH2O: 'Effort · model (cmH₂O)',
} as const

/** What the captured samples themselves show, for the text equivalent of either view. */
function breathFacts(record: LabSnapshot) {
  const breath = completedBreath(record.waveforms)
  if (breath.length < 4) return null
  const anchored = anchorBreathVolume(breath)
  const cycling = breath.findIndex((sample) => sample.phase === 'expiration')
  return {
    duration: breath.at(-1)!.time - breath[0].time,
    inspiration: sampledInspirationSeconds(breath),
    spacing: sampleSpacingSeconds(breath),
    peakFlow: Math.max(...breath.map((sample) => sample.flowLMin)),
    peakPressure: Math.max(...breath.map((sample) => sample.pawCmH2O)),
    endInspiratoryVolume: cycling > 0 ? anchored[cycling - 1].volumeMl : null,
  }
}

function describe(name: string, record: LabSnapshot): string {
  const facts = breathFacts(record)
  if (!facts) return `${name}: no complete breath in the record.`
  return `${name}: inspiration ${facts.inspiration === null ? 'not identified' : `${facts.inspiration.toFixed(2)} s`} of a ${facts.duration.toFixed(2)}-s breath; peak flow ${facts.peakFlow.toFixed(1)} L/min; peak airway pressure ${facts.peakPressure.toFixed(1)} cmH₂O; volume at the end of inspiration ${facts.endInspiratoryVolume === null ? 'not identified' : `${facts.endInspiratoryVolume.toFixed(0)} mL above the breath’s start`}. Samples every ${Math.round(facts.spacing * 1000)} ms.`
}

/**
 * The two captured breaths on one set of axes, each from its own breath start: baseline dashed,
 * result solid, named in the legend so the difference never rests on colour. Same physical scales
 * and the same time convention as the side-by-side view; a zoom is the same crop of both.
 */
function OverlayFigure({
  before,
  after,
  axes,
  duration,
  crop,
  effort,
}: {
  before: readonly WaveformSample[]
  after: readonly WaveformSample[]
  axes: WaveformAxes
  duration: number
  crop: { from: number; to: number } | null
  effort: boolean
}) {
  const figureRef = useRef<HTMLElement>(null)
  const clip = `${useId().replace(/:/g, '')}-overlay`
  const [width, setWidth] = useState(360)
  useEffect(() => {
    if (!figureRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(180, entry.contentRect.width)),
    )
    observer.observe(figureRef.current)
    return () => observer.disconnect()
  }, [])
  const from = crop?.from ?? 0
  const to = crop?.to ?? duration
  const fields = effort ? [...waveformFields, 'pmusCmH2O' as const] : waveformFields
  const bounds = { ...axes, pmusCmH2O: [-25, 5] as const }
  const x = (t: number) => 50 + ((t - from) / Math.max(1e-6, to - from)) * (width - 70)
  const y = (value: number, field: (typeof fields)[number]) =>
    64 - ((value - bounds[field][0]) / (bounds[field][1] - bounds[field][0])) * 54
  const path = (breath: readonly WaveformSample[], field: (typeof fields)[number]) => {
    const start = breath[0]?.time ?? 0
    return breath
      .map(
        (s, i) =>
          `${i ? 'L' : 'M'}${x(s.time - start).toFixed(2)} ${y(s[field], field).toFixed(2)}`,
      )
      .join(' ')
  }
  return (
    <figure className={stage.capturedBreath} ref={figureRef} data-breath-overlay>
      <figcaption>
        <strong>Baseline (dashed) and result (solid), each from its own breath start</strong>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${fields.length * 85 + 23}`}
        role="img"
        aria-label="Baseline and result drawn on the same axes; see the description below."
      >
        <defs>
          <clipPath id={clip}>
            <rect x="50" y="0" width={Math.max(0, width - 70)} height={fields.length * 85} />
          </clipPath>
        </defs>
        {fields.map((field, row) => (
          <g key={field} transform={`translate(0 ${row * 85})`}>
            <text x="0" y="12">
              {ROW_LABELS[field]}
            </text>
            <g transform="translate(0 15)">
              {[bounds[field][0], bounds[field][1]].map((v) => (
                <g key={v}>
                  <text x="0" y={y(v, field) + 3}>
                    {v.toFixed(0)}
                  </text>
                  <line
                    x1="50"
                    x2={width - 20}
                    y1={y(v, field)}
                    y2={y(v, field)}
                    className={stage.breathGrid}
                  />
                </g>
              ))}
              {bounds[field][0] < 0 ? (
                <g>
                  <line
                    x1="50"
                    x2={width - 20}
                    y1={y(0, field)}
                    y2={y(0, field)}
                    className={stage.zeroLine}
                  />
                  <text x="33" y={y(0, field) + 3}>
                    0
                  </text>
                </g>
              ) : null}
              <path
                d={path(before, field)}
                className={stage.breathTrace}
                strokeDasharray="6 4"
                opacity={0.75}
                clipPath={`url(#${clip})`}
                data-overlay-trace="baseline"
              />
              <path
                d={path(after, field)}
                className={stage.breathTrace}
                clipPath={`url(#${clip})`}
                data-overlay-trace="result"
              />
            </g>
          </g>
        ))}
        <text x="50" y={fields.length * 85 + 20}>
          {from.toFixed(crop ? 2 : 0)}
        </text>
        <text x={width / 2} y={fields.length * 85 + 20} textAnchor="middle">
          {crop ? 'Time from breath start (s) · zoomed' : 'Time from breath start (s)'}
        </text>
        <text x={width - 20} y={fields.length * 85 + 20} textAnchor="end">
          {to.toFixed(2)}
        </text>
      </svg>
    </figure>
  )
}

export function RecordedBreathComparison({
  evidence,
  effort = false,
}: {
  evidence: LabEvidence
  effort?: boolean
}) {
  const [view, setView] = useState<ComparisonView>('side-by-side')
  const [zoom, setZoom] = useState(false)
  const before = evidence.baseline,
    after = evidence.response
  if (!before || !after) return null
  const breaths = [before, after].map((record) => completedBreath(record.waveforms))
  /*
   * The shared scale is built from what the two figures actually draw. Both re-anchor volume to
   * their own breath start, so an axis taken from the raw samples would leave the comparison
   * squeezed into the top of a range set by retained gas neither trace shows.
   */
  const axes = waveformAxes(breaths.flatMap((breath) => [...anchorBreathVolume(breath)]))
  const duration = Math.max(
    ...breaths.map((breath) => (breath.length ? breath.at(-1)!.time - breath[0].time : 0)),
  )
  /*
   * The inspiration zoom (walkthrough V3): the longer of the two sampled inspirations plus a
   * margin that keeps the switch to expiration and its first flow in view, for both breaths alike.
   * A crop of the same seconds — never a stretch of each breath to its own width.
   */
  const inspirations = breaths
    .map((breath) => sampledInspirationSeconds(breath))
    .filter((value): value is number => value !== null)
  const zoomTo =
    inspirations.length > 0
      ? Math.min(
          duration,
          Math.max(...inspirations) + Math.max(0.3, 0.5 * Math.max(...inspirations)),
        )
      : duration
  const crop = zoom && zoomTo < duration ? { from: 0, to: zoomTo } : null
  return (
    <section
      data-recorded-breath-comparison
      data-comparison-view={view}
      data-zoomed={Boolean(crop)}
    >
      <h3>Retained baseline and result</h3>
      {before.inputs?.mode === 'volume-ac' ? (
        <p className={styles.note}>
          Selected VT: {before.inputs.vtMl} → {after.inputs?.vtMl ?? 'not recorded'} mL ·
          inspiratory flow: {before.inputs.peakFlowLMin} →{' '}
          {after.inputs?.peakFlowLMin ?? 'not recorded'} L/min. These are selected inputs; delivery
          is recorded separately.
        </p>
      ) : null}
      <div className={styles.tools} data-comparison-controls>
        <div className={styles.viewSwitch} role="group" aria-label="View">
          <span>View</span>
          <button
            type="button"
            aria-pressed={view === 'side-by-side'}
            onClick={() => setView('side-by-side')}
          >
            Side by side
          </button>
          <button
            type="button"
            aria-pressed={view === 'overlay'}
            onClick={() => setView('overlay')}
          >
            Overlay
          </button>
        </div>
        {zoomTo < duration ? (
          <button type="button" aria-pressed={zoom} onClick={() => setZoom((value) => !value)}>
            {zoom ? 'Show the whole breath' : 'Zoom to inspiration'}
          </button>
        ) : null}
      </div>
      {crop ? (
        <p className={styles.note} data-zoom-bounds>
          Zoomed to 0.00–{crop.to.toFixed(2)} s from each breath’s start: inspiration and the switch
          to expiration, out of breaths up to {duration.toFixed(2)} s long. Both breaths are cropped
          to the same seconds; nothing is retimed. The whole-breath view is one button away.
        </p>
      ) : null}
      {view === 'overlay' ? (
        <OverlayFigure
          before={anchorBreathVolume(breaths[0])}
          after={anchorBreathVolume(breaths[1])}
          axes={axes}
          duration={duration}
          crop={crop}
          effort={effort}
        />
      ) : (
        <div className={styles.comparison}>
          <CapturedBreath
            label="Captured baseline"
            samples={before.waveforms}
            axes={axes}
            durationSeconds={duration}
            effort={effort}
            timeWindow={crop ?? undefined}
          />
          <CapturedBreath
            label="Captured result"
            samples={after.waveforms}
            axes={axes}
            durationSeconds={duration}
            effort={effort}
            timeWindow={crop ?? undefined}
          />
        </div>
      )}
      <p className={styles.note} data-comparison-description>
        From the captured samples. {describe('Baseline', before)} {describe('Result', after)}
      </p>
    </section>
  )
}

/**
 * A captured result as the learner reads it: the two retained breaths, the watched readings before
 * and after, and the plateau's provenance. Shown beside the task once captured, and in the
 * explanation, from the same component so the two cannot drift.
 */
export function CapturedResult({
  round,
  evidence,
  effort = false,
}: {
  round: LabRound
  evidence: LabEvidence
  /** Draw the model effort row, where the step's instruction reads it (S7-2). */
  effort?: boolean
}) {
  if (!evidence.baseline || !evidence.response) return null
  const before = evidence.baseline
  const after = evidence.response
  return (
    <div data-captured-result>
      <RecordedBreathComparison evidence={evidence} effort={effort} />
      <table>
        <caption>Captured baseline and observed response</caption>
        <thead>
          <tr>
            <th>Reading</th>
            <th>Before</th>
            <th>After</th>
          </tr>
        </thead>
        <tbody>
          {round.watch.map((metric) => (
            <tr key={metric}>
              <th>
                {labMetricLabels[metric].label} ({labMetricLabels[metric].unit})
              </th>
              <td>{before.values[metric].toFixed(labMetricLabels[metric].digits)}</td>
              <td>{after.values[metric].toFixed(labMetricLabels[metric].digits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Plateau: {after.plateauSource};{' '}
        {after.plateauValid ? 'interpretable within this model' : 'not interpretable'}.{' '}
        {after.issues?.join(' ')}
      </p>
    </div>
  )
}
