'use client'

import { useId, useRef } from 'react'

import { CARDIAC_PHASE, ecgShapeMv } from '../engine/waveformMorphology'
import { applyPressureArtifact } from '../engine/waveformArtifacts'
import { waveformValueAt, type WaveformAtlasEntry } from '../content/waveformAtlas'
import styles from './icu-hemodynamics.module.css'
import { useRenderedMetrics } from './useRenderedMetrics'
import { estimateLabelWidthPx, layoutLabels } from './waveformLabelLayout'

/*
 * The figure's logical units. The pressure plot occupies TRACE_TOP..TRACE_BOTTOM, the ECG lane
 * ECG_TOP..ECG_BOTTOM and the respiration lane RESPIRATION_TOP..RESPIRATION_BOTTOM, exactly as they
 * did when HD Batch 03's display-range repair fixed them: every sample, clip rectangle and landmark
 * is still written in these coordinates. What changed is where each lane is *placed*. The lanes are
 * groups, moved apart by however much room the labels between them need at the size the figure is
 * actually drawn — so the plot's coordinates never move and its labels never land on it.
 */
const MAX_VIEW_WIDTH = 660
/** Between this and the target, a narrowing card shrinks the drawing a little before it reflows. */
const NARROW_VIEW_WIDTH = 360
/** The plot is drawn at about this many CSS pixels per logical unit, so its height reads the same at any width. */
const TARGET_PX_PER_UNIT = 1.25
/** The left gutter at ordinary text sizes. Enlarged text widens it: see `plotLeft`. */
const PLOT_LEFT = 54
const PLOT_RIGHT_MARGIN = 14
const ECG_TOP = 10
const ECG_BOTTOM = 46
const TRACE_TOP = 66
const TRACE_BOTTOM = 192
const RESPIRATION_TOP = 224
const RESPIRATION_BOTTOM = 258
const SAMPLES_PER_BEAT = 260
/** One drawn beat is one second, so artifact transforms that take a time get a deterministic one. */
const BEAT_SECONDS = 1

/**
 * A display fault applied to an otherwise correct trace.
 *
 * Every field describes the *display*, not the patient. The artifact transforms are the ones the
 * live monitor already uses, so a distortion taught in a figure and the same distortion selected at
 * the bedside monitor deform the trace identically — there is no second waveform implementation
 * here.
 */
export interface WaveformFigureFault {
  readonly levelOffsetMmHg?: number
  readonly scaleMaxMmHg?: number
  readonly artifact?: 'overdamped' | 'underdamped' | 'catheter-whip'
  readonly dampingRatio?: number
  readonly naturalFrequencyHz?: number
}

export interface WaveformFigureRespiration {
  /** Peak-to-trough swing added to the drawn trace. Qualitative — see the reference content. */
  readonly swingMmHg: number
  readonly cyclesPerStrip: number
  /** Fraction of the strip where the slow envelope reaches its trough. */
  readonly endExpirationPhase: number
  readonly modeLabel: string
  /** Where the reading marker sits. Defaults to the end-expiratory trough. */
  readonly readAtStripFraction?: number
  readonly readMarkerLabel?: string
}

interface WaveformAtlasFigureProps {
  readonly entry: WaveformAtlasEntry
  /** Number of cardiac cycles drawn across the strip. */
  readonly beats?: number
  readonly showEcg?: boolean
  readonly annotated?: boolean
  readonly compact?: boolean
  /** Larger tracing and labels for a narrow lesson panel, using the same sampled waveform. */
  readonly readable?: boolean
  /** Omit repeated prose when the caller supplies component-by-component explanations. */
  readonly showLegend?: boolean
  /**
   * Axis maximum, overriding the entry's own.
   *
   * The atlas gives each entry the scale that suits it alone. A surface that steps through several
   * entries has to pin one instead, or the learner reads a change of axis as a change of pressure.
   */
  readonly scaleMaxMmHg?: number
  /** Channel heading shown above the figure, when it is not simply the entry's label. */
  readonly channelLabel?: string
  /** Draws P, QRS, and T markers on the ECG lane. */
  readonly ecgLandmarks?: boolean
  /** Draws a respiratory envelope onto the trace, plus a respiration lane and a reading marker. */
  readonly respiration?: WaveformFigureRespiration
  readonly fault?: WaveformFigureFault
  /** Replaces the generated image description, for a caller that authors its own. */
  readonly figureDescription?: string
  /**
   * Where on the trace the value is read, marked as its own point.
   *
   * The end-expiration line says *when* to read; it crosses the trace wherever the cardiac cycle
   * happens to be at that instant, which on the right-atrial figure was between the v wave and the
   * y descent — nowhere near the base of the c wave the text names (report L3-04). This marks the
   * point itself, on the beat nearest the reading line.
   */
  readonly readingPoint?: {
    readonly cardiacPhase: number
    readonly label: string
    readonly description: string
  }
  /**
   * Other entries drawn beside this one for comparison, with the same options.
   *
   * Each figure gives its labels as many tracks as they need, so two figures side by side could put
   * their plots at different heights and a level on one would not be the same pressure on the
   * other. Naming the companions makes every figure reserve the tracks the fullest of them needs.
   */
  readonly alignLabelRowsWith?: readonly WaveformAtlasEntry[]
}

function pressureToY(value: number, scaleMaxMmHg: number): number {
  return TRACE_BOTTOM - (value / scaleMaxMmHg) * (TRACE_BOTTOM - TRACE_TOP)
}

function phaseToX(
  phase: number,
  beat: number,
  beats: number,
  plotLeft: number,
  plotRight: number,
): number {
  const progress = (beat + phase) / beats
  return plotLeft + progress * (plotRight - plotLeft)
}

function stripFractionToX(fraction: number, plotLeft: number, plotRight: number): number {
  return plotLeft + Math.max(0, Math.min(1, fraction)) * (plotRight - plotLeft)
}

/** Evenly spaced pressure ticks that stay readable at any scale. */
function pressureTicks(scaleMaxMmHg: number): number[] {
  const step = scaleMaxMmHg <= 20 ? 5 : scaleMaxMmHg <= 45 ? 10 : scaleMaxMmHg <= 90 ? 20 : 40
  const ticks: number[] = []
  for (let value = 0; value <= scaleMaxMmHg; value += step) ticks.push(value)
  return ticks
}

/**
 * The trace's own mean and pulse pressure, sampled from the spec.
 *
 * The artifact transforms need both: damping and resonance act on the pulsatile component around
 * the mean, which is exactly why they leave a mean relatively preserved while ruining a systolic
 * value. Sampling keeps this true for every trace kind without special-casing any of them.
 */
function traceEnvelope(entry: WaveformAtlasEntry): { mean: number; pulsePressureMmHg: number } {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (let step = 0; step < SAMPLES_PER_BEAT; step += 1) {
    const value = waveformValueAt(entry.trace, step / SAMPLES_PER_BEAT)
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }
  return { mean: (minimum + maximum) / 2, pulsePressureMmHg: Math.max(1, maximum - minimum) }
}

const ECG_LANDMARKS: readonly {
  readonly id: string
  readonly label: string
  readonly phase: number
}[] = [
  { id: 'p', label: 'P', phase: CARDIAC_PHASE.pWave },
  { id: 'qrs', label: 'QRS', phase: CARDIAC_PHASE.rWave },
  { id: 't', label: 'T', phase: CARDIAC_PHASE.tWavePeak },
]

export function WaveformAtlasFigure({
  entry,
  beats = 3,
  showEcg = true,
  annotated = true,
  compact = false,
  readable = false,
  showLegend = true,
  scaleMaxMmHg,
  channelLabel,
  ecgLandmarks = false,
  respiration,
  fault,
  figureDescription,
  readingPoint,
  alignLabelRowsWith,
}: WaveformAtlasFigureProps) {
  const gradientId = useId()
  const clipId = useId()
  const rangeNoteId = useId()
  const frameRef = useRef<HTMLDivElement>(null)
  const { widthPx, remPx } = useRenderedMetrics(frameRef)
  /*
   * The figure used to choose between two fixed view boxes, and its text was drawn in their units:
   * the wider the card, the larger every label, until axis titles were bigger than the page's
   * headings and wrote over each other (report L3-01). The view box is now sized from the width the
   * figure is drawn at, so one logical unit is about the same number of pixels everywhere, and the
   * labels are page text set in rem — the same size in a wide card and a narrow one, and larger
   * only when the reader's own text size is.
   */
  /*
   * Below the narrow width the view box follows the card one unit to the pixel. It used to stop
   * shrinking at 360 units, so on a phone the whole drawing was scaled down under labels that were
   * not: a plot a third of its intended height beneath text of full size, with the ECG's names
   * printed on top of each other.
   */
  const viewWidth = Math.round(
    Math.max(
      Math.min(NARROW_VIEW_WIDTH, widthPx),
      Math.min(MAX_VIEW_WIDTH, widthPx / TARGET_PX_PER_UNIT),
    ),
  )
  const pxPerUnit = widthPx / viewWidth
  const scaleMax = fault?.scaleMaxMmHg ?? scaleMaxMmHg ?? entry.scaleMaxMmHg
  const ticks = pressureTicks(scaleMax)
  /*
   * The left gutter holds the axis numbers, the unit and the lanes' names, all of them page text.
   * It is as wide as the widest of them at the reader's text size, and never narrower than it was.
   */
  const gutterFontPx = 0.75 * remPx
  const gutterTextPx = Math.max(
    estimateLabelWidthPx('mmHg', gutterFontPx),
    estimateLabelWidthPx(String(ticks[ticks.length - 1]), gutterFontPx),
    showEcg ? estimateLabelWidthPx('ECG', gutterFontPx) : 0,
    respiration ? estimateLabelWidthPx('RESP', gutterFontPx) : 0,
  )
  const plotLeft = Math.max(PLOT_LEFT, Math.ceil((gutterTextPx + 4) / pxPerUnit))
  const plotRight = Math.max(plotLeft + 40, viewWidth - PLOT_RIGHT_MARGIN)
  const envelope = traceEnvelope(entry)

  /**
   * Sampling and path building are plain functions rather than memoized ones.
   *
   * The compiler cannot preserve a `useMemo` that returns a closure, and hand-memoizing these
   * around object props that callers build inline would never hit anyway. Leaving them plain lets
   * the compiler memoize the component as a whole.
   */
  function respiratoryOffsetAt(progress: number): number {
    if (!respiration) return 0
    const { swingMmHg, cyclesPerStrip, endExpirationPhase } = respiration
    return (
      (swingMmHg / 2) * -Math.cos(2 * Math.PI * cyclesPerStrip * (progress - endExpirationPhase))
    )
  }

  function sampleAt(
    progress: number,
    phase: number,
    source: WaveformAtlasEntry = entry,
    sourceEnvelope: { mean: number; pulsePressureMmHg: number } = envelope,
  ): number {
    const base = waveformValueAt(source.trace, phase) + respiratoryOffsetAt(progress)
    const distorted = fault?.artifact
      ? applyPressureArtifact({
          value: base,
          mean: sourceEnvelope.mean + respiratoryOffsetAt(progress),
          state: {
            artifact: fault.artifact,
            dampingRatio: fault.dampingRatio ?? 0.65,
            naturalFrequencyHz: fault.naturalFrequencyHz ?? 12,
          },
          timeSeconds: progress * beats * BEAT_SECONDS,
          cardiacPhase: phase,
          pulsePressureMmHg: sourceEnvelope.pulsePressureMmHg,
        })
      : base
    return distorted + (fault?.levelOffsetMmHg ?? 0)
  }

  const trace = (() => {
    const steps = Math.round(SAMPLES_PER_BEAT * beats)
    const commands: string[] = []
    let exceedsScale = false
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps
      const phase = (progress * beats) % 1
      const x = plotLeft + progress * (plotRight - plotLeft)
      const value = sampleAt(progress, phase)
      exceedsScale ||= value < 0 || value > scaleMax
      const y = pressureToY(value, scaleMax)
      commands.push(`${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    return { path: commands.join(' '), exceedsScale }
  })()
  const tracePath = trace.path

  const ecgPath = (() => {
    if (!showEcg) return ''
    const steps = Math.round(SAMPLES_PER_BEAT * beats)
    const commands: string[] = []
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps
      const phase = (progress * beats) % 1
      const x = plotLeft + progress * (plotRight - plotLeft)
      const millivolts = ecgShapeMv(phase)
      const y = ECG_BOTTOM - ((millivolts + 0.3) / 1.75) * (ECG_BOTTOM - ECG_TOP)
      commands.push(`${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
    return commands.join(' ')
  })()

  const respirationPath = (() => {
    if (!respiration) return ''
    const commands: string[] = []
    const steps = 220
    const midpoint = (RESPIRATION_TOP + RESPIRATION_BOTTOM) / 2
    const amplitude = (RESPIRATION_BOTTOM - RESPIRATION_TOP) / 2 - 2
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps
      const x = plotLeft + progress * (plotRight - plotLeft)
      const offset =
        -Math.cos(
          2 * Math.PI * respiration.cyclesPerStrip * (progress - respiration.endExpirationPhase),
        ) * amplitude
      commands.push(`${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${(midpoint - offset).toFixed(1)}`)
    }
    return commands.join(' ')
  })()

  // Annotations are drawn on the middle beat so their leader lines are never clipped.
  const annotationBeat = Math.max(0, Math.floor(beats / 2) - (beats % 2 === 0 ? 1 : 0))
  const readingFractionForPoint = respiration
    ? (respiration.readAtStripFraction ?? respiration.endExpirationPhase)
    : 0.5
  // The beat whose reading point falls nearest the reading line.
  const readingBeat = readingPoint
    ? Array.from({ length: Math.max(1, Math.floor(beats)) }, (_, beat) => beat).reduce(
        (best, beat) =>
          Math.abs((beat + readingPoint.cardiacPhase) / beats - readingFractionForPoint) <
          Math.abs((best + readingPoint.cardiacPhase) / beats - readingFractionForPoint)
            ? beat
            : best,
        0,
      )
    : 0
  const READING_POINT_ID = 'reading-point'
  /** The landmarks of an entry that fall on the axis, where this figure's options would draw them. */
  function landmarkPointsOf(source: WaveformAtlasEntry, withReadingPoint: boolean) {
    const sourceEnvelope = source === entry ? envelope : traceEnvelope(source)
    return (
      [
        ...source.annotations.map((annotation) => ({ annotation, beat: annotationBeat })),
        ...(withReadingPoint && readingPoint
          ? [
              {
                annotation: {
                  id: READING_POINT_ID,
                  label: readingPoint.label,
                  phase: readingPoint.cardiacPhase,
                  placement: 'below' as const,
                  description: readingPoint.description,
                },
                beat: readingBeat,
              },
            ]
          : []),
      ]
        .map(({ annotation, beat }) => {
          const x = phaseToX(annotation.phase, beat, beats, plotLeft, plotRight)
          const progress = (x - plotLeft) / (plotRight - plotLeft)
          return {
            annotation,
            x,
            y: pressureToY(sampleAt(progress, annotation.phase, source, sourceEnvelope), scaleMax),
          }
        })
        // Do not pin an off-axis landmark to the boundary and imply it is a measured peak there.
        .filter(({ y }) => y >= TRACE_TOP && y <= TRACE_BOTTOM)
        .sort((left, right) => left.x - right.x)
    )
  }
  const annotationPoints = annotated ? landmarkPointsOf(entry, true) : []

  /*
   * Labels, laid out in the pixels they occupy.
   *
   * Each placement has its own track outside the plot — above it for the labels authored `above`,
   * below it for `below` — and within a track the labels are spread until none touches the next,
   * spilling into a second track if one cannot hold them. A label that had to move keeps a leader
   * line to its landmark, so the mark on the trace is still the feature the label names.
   */
  const labelFontPx = 0.85 * remPx
  const rowUnits = (1.5 * remPx) / pxPerUnit
  const plotWidthPx = (plotRight - plotLeft) * pxPerUnit
  // A figure drawn beside others keeps the tracks the fullest of them needs, so their plots align.
  const companions = annotated
    ? (alignLabelRowsWith ?? [])
        .filter((other) => other.id !== entry.id)
        .map((other) => landmarkPointsOf(other, false))
    : []
  /*
   * A label wider than the whole plot — long words, large text, a narrow card — is given the plot's
   * width and wraps inside it. Every track is then as tall as the longest label's lines, so a
   * wrapped label still clears the track beyond it.
   */
  const labelLines = Math.max(
    1,
    ...[annotationPoints, ...companions]
      .flat()
      .map((point) =>
        Math.ceil(estimateLabelWidthPx(point.annotation.label, labelFontPx) / plotWidthPx),
      ),
  )
  const labelRowUnits = ((1.02 * labelLines + 0.48) * remPx) / pxPerUnit
  const layoutFor = (points: typeof annotationPoints, placement: 'above' | 'below') =>
    layoutLabels(
      points
        .filter((point) => point.annotation.placement === placement)
        .map((point) => ({
          id: point.annotation.id,
          anchorPx: (point.x - plotLeft) * pxPerUnit,
          widthPx: Math.min(plotWidthPx, estimateLabelWidthPx(point.annotation.label, labelFontPx)),
        })),
      plotWidthPx,
    )
  const aboveLayout = layoutFor(annotationPoints, 'above')
  const belowLayout = layoutFor(annotationPoints, 'below')
  const aboveRows = Math.max(
    aboveLayout.rows,
    ...companions.map((points) => layoutFor(points, 'above').rows),
  )
  const belowRows = Math.max(
    belowLayout.rows,
    ...companions.map((points) => layoutFor(points, 'below').rows),
  )

  /*
   * The ECG's P, QRS and T names share one track above the lane and are spread the same way: on a
   * narrow plot QRS and T are a few pixels apart and were printed on top of each other.
   */
  const ecgNames =
    showEcg && ecgLandmarks
      ? ECG_LANDMARKS.map((landmark) => ({
          ...landmark,
          x: phaseToX(landmark.phase, annotationBeat, beats, plotLeft, plotRight),
        }))
      : []
  const ecgLayout = layoutLabels(
    ecgNames.map((landmark) => ({
      id: landmark.id,
      anchorPx: (landmark.x - plotLeft) * pxPerUnit,
      widthPx: estimateLabelWidthPx(landmark.label, gutterFontPx),
    })),
    plotWidthPx,
    2,
  )

  // Axis numbers are thinned, never overlapped, when the text is large for the plot's height.
  const tickSpacingPx = ((TRACE_BOTTOM - TRACE_TOP) / Math.max(1, ticks.length - 1)) * pxPerUnit
  const labelEveryTick = Math.max(1, Math.ceil((gutterFontPx * 1.25) / tickSpacingPx))

  const readingFraction = respiration
    ? (respiration.readAtStripFraction ?? respiration.endExpirationPhase)
    : null
  const readingX =
    readingFraction === null ? null : stripFractionToX(readingFraction, plotLeft, plotRight)
  const readingLabel =
    respiration?.readMarkerLabel ??
    (readingFraction !== null && readingFraction === respiration?.endExpirationPhase
      ? 'end expiration'
      : 'reading point')
  /*
   * The reading marker's name is centred on its line and kept inside the plot. When it is wider
   * than the plot — a phone with enlarged text — it takes the figure's full width beneath the lane,
   * on as many lines as it needs, instead of running out of the card.
   */
  const readNameWidthPx = estimateLabelWidthPx(readingLabel, gutterFontPx)
  const readNameFits = readNameWidthPx <= plotWidthPx
  const readNameRows = readNameFits
    ? 1
    : Math.min(readingLabel.split(' ').length, Math.ceil(readNameWidthPx / widthPx) + 1)
  const readNameLeft =
    readingX === null || !readNameFits
      ? 0
      : Math.max(
          plotLeft,
          Math.min(
            plotRight - readNameWidthPx / pxPerUnit,
            readingX - readNameWidthPx / pxPerUnit / 2,
          ),
        )

  /*
   * Where each lane is placed. The gaps are sized from the label tracks; with no ECG the lane is
   * not reserved at all, where it used to leave an empty band that looked like a strip that had
   * failed to load (report L4-02).
   */
  const landmarkRowUnits = ecgLayout.rows * rowUnits
  const topPadding = 4
  const ecgShift = topPadding + landmarkRowUnits - ECG_TOP
  const ecgBottomY = showEcg ? ECG_BOTTOM + ecgShift : topPadding
  // The unit label sits above the top tick, so the gap always has room for it.
  const aboveGapUnits = Math.max(aboveRows * labelRowUnits, rowUnits * 1.7) + 6
  const plotShift = ecgBottomY + aboveGapUnits - TRACE_TOP
  const plotTopY = TRACE_TOP + plotShift
  const plotBottomY = TRACE_BOTTOM + plotShift
  const belowGapUnits = belowRows > 0 ? belowRows * labelRowUnits + 6 : 0
  const afterPlotY = plotBottomY + belowGapUnits
  const respirationShift = afterPlotY + 10 - RESPIRATION_TOP
  const respirationBottomY = RESPIRATION_BOTTOM + respirationShift
  // Enlarged lane names are taller than the lane; the reading name starts below them.
  const readNameTopY =
    respirationBottomY +
    2 +
    Math.max(0, (rowUnits * 0.6 - (RESPIRATION_BOTTOM - RESPIRATION_TOP)) / 2)
  const viewHeight = respiration ? readNameTopY + readNameRows * rowUnits + 2 : afterPlotY + 8

  const placedAnnotations = annotationPoints.map((point) => {
    const above = point.annotation.placement === 'above'
    const placed = (above ? aboveLayout : belowLayout).labels.find(
      (label) => label.id === point.annotation.id,
    )!
    const labelLeft = plotLeft + placed.leftPx / pxPerUnit
    const labelCenter = labelLeft + placed.widthPx / pxPerUnit / 2
    // The edge of the label that faces the plot: its bottom when above, its top when below.
    const labelEdgeY = above
      ? plotTopY - 4 - placed.row * labelRowUnits
      : plotBottomY + 4 + placed.row * labelRowUnits
    return {
      ...point,
      above,
      row: placed.row,
      labelLeft,
      labelCenter,
      labelEdgeY,
      labelWidth: placed.widthPx / pxPerUnit,
    }
  })
  const placedEcgNames = ecgNames.map((landmark) => {
    const placed = ecgLayout.labels.find((label) => label.id === landmark.id)!
    const nameLeft = plotLeft + placed.leftPx / pxPerUnit
    // Track 0 is the one nearest the lane.
    const nameTopY = topPadding + (ecgLayout.rows - 1 - placed.row) * rowUnits
    return {
      ...landmark,
      nameLeft,
      nameWidth: placed.widthPx / pxPerUnit,
      nameCenter: nameLeft + placed.widthPx / pxPerUnit / 2,
      nameTopY,
      nameBottomY: nameTopY + rowUnits * 0.72,
    }
  })

  const rangeNotice = trace.exceedsScale
    ? `Trace exceeds the displayed 0–${scaleMax} mmHg axis; out-of-range portions are clipped and their landmarks are not shown. Sampled pressures are unchanged.`
    : ''
  const description =
    figureDescription ??
    `${channelLabel ? `Channel labelled ${channelLabel}. ` : ''}${entry.label}. ${entry.summary} Drawn against a 0 to ${scaleMax} mmHg axis.${
      respiration
        ? ` One respiratory cycle is drawn beneath the trace under ${respiration.modeLabel}, with a marker at ${readingLabel}.`
        : ''
    } ${entry.annotations
      .map((annotation) => `${annotation.label}: ${annotation.description}`)
      .join(
        ' ',
      )}${annotated && readingPoint ? ` ${readingPoint.label}: ${readingPoint.description}` : ''}${
      annotated && entry.renderingLimit ? ` ${entry.renderingLimit}` : ''
    }`

  const left = (x: number) => `${((x / viewWidth) * 100).toFixed(3)}%`
  const top = (y: number) => `${((y / viewHeight) * 100).toFixed(3)}%`

  return (
    <figure
      className={styles.atlasFigure}
      data-compact={compact || undefined}
      data-readable={readable || undefined}
    >
      <figcaption>
        <div>
          <strong>{channelLabel ?? entry.label}</strong>
          {entry.normalRange ? <span>{entry.normalRange}</span> : null}
        </div>
        {entry.insertionDepth ? <small>{entry.insertionDepth}</small> : null}
      </figcaption>

      {/* Caption, then everything else: two children, so figures compared in a row share two rows. */}
      <div className={styles.atlasBody}>
        <div className={styles.atlasFrame} ref={frameRef} data-atlas-frame>
          {/*
          The figure's name is its full description; the range notice, when there is one, is its
          description rather than a second copy inside the name. The notice is also the visible
          paragraph beneath the figure, so it is written once and announced as part of this image.
        */}
          <svg
            viewBox={`0 0 ${viewWidth} ${viewHeight.toFixed(1)}`}
            role="img"
            aria-label={description}
            aria-describedby={rangeNotice ? rangeNoteId : undefined}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={plotLeft}
                  y={TRACE_TOP}
                  width={plotRight - plotLeft}
                  height={TRACE_BOTTOM - TRACE_TOP}
                />
              </clipPath>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--atlas-trace)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--atlas-trace)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {showEcg ? (
              <g transform={`translate(0 ${ecgShift.toFixed(2)})`} data-atlas-lane="ecg">
                <path className={styles.atlasEcgTrace} d={ecgPath} />
              </g>
            ) : null}
            {placedEcgNames.map((landmark) => (
              <g key={landmark.id}>
                <line
                  className={styles.atlasEcgLandmarkLine}
                  data-atlas-ecg-landmark={landmark.label}
                  x1={landmark.x}
                  x2={landmark.x}
                  y1={ECG_TOP + ecgShift - 2}
                  y2={plotBottomY}
                />
                {/* A name that was moved aside keeps a tie to its own line. */}
                <line
                  className={styles.atlasEcgLandmarkLine}
                  data-atlas-ecg-leader={landmark.label}
                  x1={landmark.x}
                  x2={landmark.nameCenter}
                  y1={ECG_TOP + ecgShift - 2}
                  y2={landmark.nameBottomY}
                />
              </g>
            ))}

            {/* The pressure plot, in its own unchanged coordinates. */}
            <g transform={`translate(0 ${plotShift.toFixed(2)})`} data-atlas-lane="pressure">
              {ticks.map((tick) => {
                const y = pressureToY(tick, scaleMax)
                return (
                  <line
                    key={tick}
                    className={styles.atlasGridline}
                    x1={plotLeft}
                    x2={plotRight}
                    y1={y}
                    y2={y}
                  />
                )
              })}
              <path
                className={styles.atlasTraceFill}
                d={`${tracePath} L ${plotRight} ${TRACE_BOTTOM} L ${plotLeft} ${TRACE_BOTTOM} Z`}
                fill={`url(#${gradientId})`}
                clipPath={`url(#${clipId})`}
              />
              <path className={styles.atlasTrace} d={tracePath} clipPath={`url(#${clipId})`} />
              {placedAnnotations.map(({ annotation, x, y }) => (
                <g
                  key={annotation.id}
                  className={
                    annotation.id === READING_POINT_ID
                      ? styles.atlasReadingPoint
                      : styles.atlasAnnotation
                  }
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={annotation.id === READING_POINT_ID ? 5 : 3.4}
                    data-atlas-landmark={annotation.id}
                  />
                </g>
              ))}
            </g>

            {/* Leader lines run from each landmark to the edge of its own label. */}
            {placedAnnotations.map(({ annotation, x, y, labelCenter, labelEdgeY }) => (
              <line
                key={annotation.id}
                className={styles.atlasLeader}
                data-atlas-leader={annotation.id}
                x1={x}
                y1={y + plotShift}
                x2={labelCenter}
                y2={labelEdgeY}
              />
            ))}

            {respiration && readingX !== null ? (
              <>
                <g
                  transform={`translate(0 ${respirationShift.toFixed(2)})`}
                  data-atlas-lane="respiration"
                >
                  <path className={styles.atlasRespirationTrace} d={respirationPath} />
                </g>
                <line
                  className={styles.atlasReadMarkerLine}
                  x1={readingX}
                  x2={readingX}
                  y1={plotTopY - 4}
                  y2={respirationBottomY}
                />
              </>
            ) : null}
          </svg>

          {/* Every label is page text over the drawing: sized in rem, placed in the figure's units. */}
          <div className={styles.atlasLabels} aria-hidden="true">
            {showEcg ? (
              <span
                className={styles.atlasLaneName}
                style={{ top: top((ECG_TOP + ECG_BOTTOM) / 2 + ecgShift) }}
              >
                ECG
              </span>
            ) : null}
            {placedEcgNames.map((landmark) => (
              <span
                key={landmark.id}
                className={styles.atlasEcgName}
                data-atlas-ecg-name={landmark.label}
                style={{
                  left: left(landmark.nameLeft),
                  top: top(landmark.nameTopY),
                  width: left(landmark.nameWidth),
                }}
              >
                {landmark.label}
              </span>
            ))}
            <span
              className={styles.atlasUnitName}
              data-atlas-unit
              style={{ top: top(plotTopY - rowUnits * 0.55) }}
            >
              mmHg
            </span>
            {ticks
              .filter((_, index) => index % labelEveryTick === 0)
              .map((tick) => (
                <span
                  key={tick}
                  className={styles.atlasTick}
                  style={{
                    left: left(plotLeft - 6),
                    top: top(pressureToY(tick, scaleMax) + plotShift),
                  }}
                >
                  {tick}
                </span>
              ))}
            {placedAnnotations.map(({ annotation, above, labelLeft, labelEdgeY, labelWidth }) => (
              <span
                key={annotation.id}
                className={styles.atlasLabel}
                data-atlas-label={annotation.id}
                data-reading-point={annotation.id === READING_POINT_ID || undefined}
                data-placement={above ? 'above' : 'below'}
                data-wrapped={labelLines > 1 || undefined}
                style={{
                  left: left(labelLeft),
                  top: top(labelEdgeY),
                  maxWidth: labelLines > 1 ? left(labelWidth) : undefined,
                }}
              >
                {annotation.label}
              </span>
            ))}
            {respiration && readingX !== null ? (
              <>
                <span
                  className={styles.atlasLaneName}
                  style={{
                    top: top((RESPIRATION_TOP + RESPIRATION_BOTTOM) / 2 + respirationShift),
                  }}
                >
                  RESP
                </span>
                <span
                  className={styles.atlasReadName}
                  data-atlas-read-name
                  data-wrapped={readNameFits ? undefined : true}
                  style={{
                    left: left(readNameLeft),
                    top: top(readNameTopY),
                    width: readNameFits ? left(readNameWidthPx / pxPerUnit) : '100%',
                  }}
                >
                  {readingLabel}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {rangeNotice ? (
          <p id={rangeNoteId} className={styles.paneCaveat} data-waveform-range-note>
            {rangeNotice}
          </p>
        ) : null}

        {/* Only beside a labelled figure: on an unlabelled question tracing it would name the pattern. */}
        {annotated && entry.renderingLimit ? (
          <p className={styles.paneCaveat} data-waveform-rendering-limit>
            {entry.renderingLimit}
          </p>
        ) : null}

        {showLegend && annotated && entry.annotations.length > 0 ? (
          <dl className={styles.atlasLegend}>
            {entry.annotations.map((annotation) => (
              <div key={annotation.id}>
                <dt>{annotation.label}</dt>
                <dd>{annotation.description}</dd>
              </div>
            ))}
            {readingPoint ? (
              <div data-legend-reading-point>
                <dt>{readingPoint.label}</dt>
                <dd>{readingPoint.description}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </figure>
  )
}
