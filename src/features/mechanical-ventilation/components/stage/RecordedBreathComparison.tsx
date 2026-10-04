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
import {
  BREATH_ORIGIN,
  BREATH_ROW_LABELS,
  BREATH_TIME_AXIS_LABEL,
  breathOriginFacts,
} from '../../content/breathOrigin'
import { describeModeledEffort } from '../../content/effortDescription'
import { BREATH_LABEL_LINE_PX, breathRowLayout } from './breathFigureLayout'
import { CapturedBreath } from './CapturedBreath'
import styles from './task-flow.module.css'
import stage from './ventilation-stage.module.css'

type ComparisonView = 'side-by-side' | 'overlay'

/**
 * What the drawn breath's own samples show, for the text equivalent of either view.
 *
 * Samples are recorded after each 20 ms step, so a breath's inspiratory flow lasts one step per
 * inspiratory sample, and the volume it received is its peak less the sample just before its first
 * inspiratory sample — the same definition the ventilator's exhaled-volume reading uses. The figure
 * draws volume from the first inspiratory sample itself, which already holds one step, so the drawn
 * rise is that step smaller than the volume received (about 400 against 413 mL at 40 L/min); both
 * numbers are given, with the step. The drawn breath is the last complete one in the record; the
 * readings table is what the ventilator published at capture, from its most recent inflation, so at
 * 40 L/min the two can differ by one delivery step (413 against 427 mL). Each is stated as what it
 * is rather than made to agree.
 */
function breathFacts(record: LabSnapshot) {
  const breath = completedBreath(record.waveforms)
  if (breath.length < 4) return null
  const origin = breathOriginFacts(record.waveforms, breath)
  const cycling = breath.findIndex((sample) => sample.phase === 'expiration')
  const inspiratory = cycling > 0 ? breath.slice(0, cycling) : []
  const spacing = sampleSpacingSeconds(breath)
  const peakMl = inspiratory.length ? Math.max(...inspiratory.map((sample) => sample.volumeMl)) : 0
  return {
    duration: breath.at(-1)!.time - breath[0].time,
    inspiratorySamples: inspiratory.length,
    inspiration: sampledInspirationSeconds(breath),
    spacing,
    peakFlow: Math.max(...breath.map((sample) => sample.flowLMin)),
    peakPressure: Math.max(...breath.map((sample) => sample.pawCmH2O)),
    received:
      origin && origin.precedingMl !== null && inspiratory.length
        ? peakMl - origin.precedingMl
        : null,
    drawnRise: origin && inspiratory.length ? peakMl - origin.originMl : null,
    firstStepMl: origin?.firstStepMl ?? null,
  }
}

function describe(name: string, record: LabSnapshot): string {
  const facts = breathFacts(record)
  if (!facts) return `${name}: no complete breath in the record.`
  const flow =
    facts.inspiration === null
      ? 'inspiration not identified'
      : `inspiratory flow over ${facts.inspiratorySamples} samples (${facts.inspiration.toFixed(2)} s as sampled)`
  const received =
    facts.received === null
      ? ''
      : `; it received ${facts.received.toFixed(0)} mL (peak volume less the volume in the sample before its first inspiratory sample)`
  /* A pressure-targeted breath's first step can be under a millilitre; then there is no gap to explain. */
  const drawn =
    facts.drawnRise === null || facts.firstStepMl === null
      ? ''
      : Math.abs(facts.firstStepMl) < 0.5
        ? `; its drawn volume rises ${facts.drawnRise.toFixed(0)} mL from its first inspiratory sample, which holds less than 1 mL`
        : `; its drawn volume rises ${facts.drawnRise.toFixed(0)} mL, because the first inspiratory sample it is drawn from already holds ${Math.abs(facts.firstStepMl).toFixed(0)} mL`
  return `${name} breath drawn above: ${flow} of a ${facts.duration.toFixed(2)}-s breath${received}${drawn}; peak flow ${facts.peakFlow.toFixed(1)} L/min; peak airway pressure ${facts.peakPressure.toFixed(1)} cmH₂O.`
}

/**
 * The Inspiratory time reading beside the sampled flow time, for volume control (S2-1).
 *
 * The reading is the flow time the selected volume and flow calculate — 0.63 s at 420 mL and
 * 40 L/min — and is not timed on the trace; the drawn breath shows flow for a whole number of 20-ms
 * samples, 0.62 or 0.64 s there. Both are true and they are different things, so the text says which
 * is which instead of leaving the calculated value to be read as the sampled duration.
 */
function inspiratoryTimeNote(before: LabSnapshot, after: LabSnapshot): string | null {
  if (before.inputs?.mode !== 'volume-ac' || after.inputs?.mode !== 'volume-ac') return null
  const spacing = sampleSpacingSeconds(completedBreath(after.waveforms))
  if (spacing <= 0) return null
  return `The Inspiratory time reading (${before.values.ti.toFixed(2)} s before, ${after.values.ti.toFixed(2)} s after) is calculated from the selected volume and flow; it is not timed on the trace. The sampled flow times above are what the drawn breaths show, to the nearest ${Math.round(spacing * 1000)}-ms sample.`
}

/**
 * The two captured breaths on one set of axes, each from its own first recorded inspiratory sample:
 * baseline dashed, result solid, named in the legend so the difference never rests on colour. Same
 * physical scales and the same time convention as the side-by-side view; a zoom is the same crop of
 * both.
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
  const layout = breathRowLayout(
    fields.map((field) => BREATH_ROW_LABELS[field]),
    width,
  )
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
        <strong>Baseline (dashed) and result (solid), each from its own {BREATH_ORIGIN}</strong>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${layout.rowsHeight + 23}`}
        role="img"
        aria-label="Baseline and result drawn on the same axes; see the description below."
      >
        <defs>
          <clipPath id={clip}>
            <rect x="50" y="0" width={Math.max(0, width - 70)} height={layout.rowsHeight} />
          </clipPath>
        </defs>
        {fields.map((field, row) => (
          <g key={field} transform={`translate(0 ${row * layout.pitch})`}>
            <text x="0" y="12" data-row-label={field}>
              {layout.labels[row].map((line, i, lines) => (
                <tspan key={line} x="0" dy={i === 0 ? 0 : BREATH_LABEL_LINE_PX}>
                  {i < lines.length - 1 ? `${line} ` : line}
                </tspan>
              ))}
            </text>
            <g transform={`translate(0 ${layout.plotTop})`}>
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
        {/* The axis title is the line under the figure; see `CapturedBreath`. */}
        <text x="50" y={layout.rowsHeight + 20} data-time-tick="start">
          {from.toFixed(crop ? 2 : 0)}
        </text>
        <text x={width - 20} y={layout.rowsHeight + 20} textAnchor="end" data-time-tick="end">
          {to.toFixed(2)}
        </text>
      </svg>
      <p className={stage.axisCaption} data-time-axis>
        {BREATH_TIME_AXIS_LABEL}
        {crop ? ' · zoomed' : ''}
      </p>
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
   * their own first recorded inspiratory sample, so an axis taken from the raw samples would leave
   * the comparison squeezed into the top of a range set by retained gas neither trace shows.
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
  const timingNote = inspiratoryTimeNote(before, after)
  const missing = ['baseline', 'result'].filter((_, i) => breaths[i].length < 4)
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
          Zoomed to 0.00–{crop.to.toFixed(2)} s from each breath’s {BREATH_ORIGIN}: inspiration and
          the switch to expiration, out of breaths up to {duration.toFixed(2)} s long. Both breaths
          are cropped to the same seconds; nothing is retimed. The whole-breath view is one button
          away.
        </p>
      ) : null}
      {view === 'overlay' && missing.length > 0 ? (
        <p className={styles.boundary} data-overlay-missing-breath>
          The retained {missing.join(' and ')} {missing.length > 1 ? 'hold' : 'holds'} no complete
          breath, so {missing.length > 1 ? 'neither is' : 'it is not'} drawn in this overlay.
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
            retained
          />
          <CapturedBreath
            label="Captured result"
            samples={after.waveforms}
            axes={axes}
            durationSeconds={duration}
            effort={effort}
            timeWindow={crop ?? undefined}
            retained
          />
        </div>
      )}
      <p className={styles.note} data-comparison-description>
        From the captured samples, every {Math.round(sampleSpacingSeconds(breaths[1]) * 1000)} ms.
        Time and drawn volume are counted from each breath’s {BREATH_ORIGIN}.{' '}
        {describe('Baseline', before)} {describe('Result', after)} The readings below are what the
        ventilator published at the moment of capture; they are not all taken from the drawn breath.
      </p>
      {timingNote ? (
        <p className={styles.note} data-inspiratory-time-note>
          {timingNote}
        </p>
      ) : null}
      {effort ? (
        <p className={styles.note} data-effort-description>
          Effort row, from the same samples. Effort is this simulator’s modeled signal, not a
          measurement from a patient, and is counted here where it is at or above the model’s effort
          floor. {describeModeledEffort('Baseline', before.waveforms)}{' '}
          {describeModeledEffort('Result', after.waveforms)} These are sample times on two modeled
          signals: they do not show that an effort started a breath, and no interval here is a
          measured delay.
        </p>
      ) : null}
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
  /* In volume control the Inspiratory time reading is calculated from the settings (S2-1). */
  const calculatedTi = before.inputs?.mode === 'volume-ac' && after.inputs?.mode === 'volume-ac'
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
                {labMetricLabels[metric].label}
                {metric === 'ti' && calculatedTi ? ' · calculated' : ''} (
                {labMetricLabels[metric].unit})
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
