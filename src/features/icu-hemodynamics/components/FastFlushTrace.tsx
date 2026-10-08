'use client'

import { useId, useMemo } from 'react'

import {
  dynamicResponseDefinitions,
  FAST_FLUSH_RELEASE_SECONDS,
  FAST_FLUSH_START_SECONDS,
  fastFlushDisplayedPressures,
  generateFastFlushWaveform,
  getDynamicResponseDefinition,
  type DynamicResponseKind,
  type FastFlushLineType,
} from '../content/pressureSystemVisuals'
import { fixedWithoutNegativeZero } from '../engine/numberFormat'
import styles from './fast-flush.module.css'

const VIEW = { width: 1000, height: 200, top: 8, bottom: 192 } as const
/** The enlarged window: a moment of plateau before the release, and the settling after it. */
const RELEASE_WINDOW = { before: 0.15, after: 1.05 } as const

function percent(value: number, whole: number): string {
  return `${((value / whole) * 100).toFixed(3)}%`
}

function verticalAnchor(y: number): 'top' | 'middle' | 'bottom' {
  const fraction = y / VIEW.height
  return fraction < 0.1 ? 'top' : fraction > 0.9 ? 'bottom' : 'middle'
}

/**
 * One fast-flush test: the tracing before the flush, the flush, and what the line does on release.
 *
 * Three things changed with report L2-08, L2-09 and L2-11.
 *
 * - **Nothing is drawn where it is not.** A pressure outside the axis used to be moved to the edge
 *   of it, so the 300 mmHg flush was a flat line at 40 and ringing that fell below zero was a flat
 *   line at 0. The path now keeps each sample's own height and the plot clips it; the flush is named
 *   in a bracket above the plot, where its label can no longer be cut through by the tracing.
 * - **Every label is page text.** Ticks, times and markers are HTML around the plot, set in rem, so
 *   they are the same size in a wide panel and a narrow one and follow the reader's text size.
 * - **The displayed numbers are stated.** When the response is labelled, the caption gives the
 *   source signal and what this line draws for it, sampled from the trace itself.
 */
export function FastFlushTrace({
  response,
  lineType,
  revealLabel,
  compact = false,
  window: timeWindow = 'whole',
}: {
  readonly response: DynamicResponseKind
  readonly lineType: FastFlushLineType
  readonly revealLabel: boolean
  readonly compact?: boolean
  /** `release` enlarges the moments around the release on the same pressure axis. */
  readonly window?: 'whole' | 'release'
}) {
  const clipId = useId()
  const definition = getDynamicResponseDefinition(response)
  const waveform = useMemo(
    () => generateFastFlushWaveform(lineType, response),
    [lineType, response],
  )
  const displayed = useMemo(
    () => fastFlushDisplayedPressures(lineType, response),
    [lineType, response],
  )
  const { scaleMinimumMmHg: minimum, scaleMaximumMmHg: maximum } = waveform.line
  const from = timeWindow === 'release' ? FAST_FLUSH_RELEASE_SECONDS - RELEASE_WINDOW.before : 0
  const until =
    timeWindow === 'release'
      ? FAST_FLUSH_RELEASE_SECONDS + RELEASE_WINDOW.after
      : waveform.durationSeconds
  const xForTime = (timeSeconds: number) => ((timeSeconds - from) / (until - from)) * VIEW.width
  // Each sample's own height: a value outside the axis is left outside it, and clipped.
  const yForPressure = (pressureMmHg: number) =>
    VIEW.bottom - ((pressureMmHg - minimum) / (maximum - minimum)) * (VIEW.bottom - VIEW.top)
  const inWindow = waveform.samples.filter(
    (sample) => sample.timeSeconds >= from - 0.02 && sample.timeSeconds <= until + 0.02,
  )
  const path = inWindow
    .map(
      (sample, index) =>
        `${index === 0 ? 'M' : 'L'} ${xForTime(sample.timeSeconds).toFixed(2)} ${yForPressure(sample.pressureMmHg).toFixed(2)}`,
    )
    .join(' ')
  const belowAxis = inWindow.some(
    (sample) => sample.segment !== 'flush-plateau' && sample.pressureMmHg < minimum,
  )
  const aboveAxisAfterRelease = inWindow.some(
    (sample) => sample.segment === 'release' && sample.pressureMmHg > maximum,
  )
  const yTicks =
    lineType === 'pulmonary-artery' ? ([0, 10, 20, 30, 40] as const) : ([40, 80, 120, 160] as const)
  const timeTicks =
    timeWindow === 'release'
      ? [0, 0.25, 0.5, 0.75, 1].map((offset) => ({
          time: FAST_FLUSH_RELEASE_SECONDS + offset,
          text: offset === 0 ? 'release' : `+${offset} s`,
        }))
      : Array.from({ length: 6 }, (_, second) => ({ time: second, text: `${second} s` }))
  const flushX = xForTime(FAST_FLUSH_START_SECONDS)
  const releaseX = xForTime(FAST_FLUSH_RELEASE_SECONDS)
  const sourceWords = `${waveform.line.systolicMmHg}/${waveform.line.diastolicMmHg} mmHg`
  const displayedWords = `${fixedWithoutNegativeZero(displayed.systolicMmHg)}/${fixedWithoutNegativeZero(displayed.diastolicMmHg)} mmHg`
  const rangeNotice =
    belowAxis || aboveAxisAfterRelease
      ? `Part of the settling tracing leaves the ${minimum} to ${maximum} mmHg axis and is clipped there, not flattened. The sampled pressures are unchanged.`
      : ''
  const windowWords =
    timeWindow === 'release'
      ? ` This panel enlarges the ${RELEASE_WINDOW.before + RELEASE_WINDOW.after} seconds around the release, on the same pressure axis.`
      : ''
  const accessibleSummary = revealLabel
    ? `${waveform.line.label}. ${definition.label}. A pulsatile baseline precedes a 300 mmHg off-scale flush plateau, drawn above this ${minimum} to ${maximum} mmHg axis rather than on it. The valve releases between beats, independently of cardiac phase. ${definition.observation} The tracing then resumes the ${waveform.line.shortLabel} waveform at its continuously advancing cardiac phase. ${definition.pressureEffect} For a ${sourceWords} source signal this line draws ${displayedWords}.${windowWords}${rangeNotice ? ` ${rangeNotice}` : ''}`
    : `${waveform.line.label} observed fast-flush release response. A pulsatile baseline precedes an off-scale flush plateau. The valve releases between beats, independently of cardiac phase, and the tracing resumes the same continuously advancing pressure-wave family. ${definition.observation} Classification is withheld until the learner submits an interpretation.${windowWords}${rangeNotice ? ` ${rangeNotice}` : ''}`

  return (
    <figure
      className={styles.trace}
      data-fast-flush-trace={response}
      data-compact={compact || undefined}
      data-line-type={lineType}
      data-window={timeWindow}
    >
      <figcaption>
        <strong>
          {waveform.line.shortLabel} · {revealLabel ? definition.shortLabel : 'Observed response'}
          {timeWindow === 'release' ? ' · release, enlarged in time' : ''}
        </strong>
        <span data-flush-displayed>
          {revealLabel
            ? response === 'acceptable'
              ? `Source ${sourceWords}, drawn as ${displayedWords}`
              : `Source ${sourceWords}, drawn here as ${displayedWords}`
            : 'Classification withheld'}
        </span>
      </figcaption>
      <div className={styles.frame}>
        <div className={styles.track} aria-hidden="true">
          {timeWindow === 'whole' ? (
            <>
              {/* The flush is named above the plot. Nothing is drawn at the axis' edge for it. */}
              <span
                className={styles.bracket}
                data-flush-off-scale="above"
                style={{
                  left: percent(flushX, VIEW.width),
                  width: percent(releaseX - flushX, VIEW.width),
                }}
              />
              <span
                className={styles.offScale}
                data-flush-off-scale-label
                style={
                  {
                    '--flush-x': percent((flushX + releaseX) / 2, VIEW.width),
                  } as React.CSSProperties
                }
              >
                flush · off this scale, about 300 mmHg
              </span>
              <span
                className={styles.marker}
                data-anchor="end"
                style={{ '--flush-x': percent(flushX, VIEW.width) } as React.CSSProperties}
              >
                flush
              </span>
              <span
                className={styles.marker}
                style={{ '--flush-x': percent(releaseX, VIEW.width) } as React.CSSProperties}
              >
                release
              </span>
            </>
          ) : (
            <>
              <span
                className={styles.offScale}
                style={{ '--flush-x': '0%' } as React.CSSProperties}
              >
                flush · off this scale
              </span>
              <span
                className={styles.marker}
                style={{ '--flush-x': percent(releaseX, VIEW.width) } as React.CSSProperties}
              >
                release
              </span>
            </>
          )}
        </div>
        <div className={styles.axis} aria-hidden="true">
          <span className={styles.sizer}>{String(yTicks.at(-1))}</span>
          <span className={styles.sizer}>mmHg</span>
          <span className={styles.unit}>mmHg</span>
          {yTicks.map((tick) => {
            const y = yForPressure(tick)
            return (
              <span
                key={tick}
                className={styles.tick}
                data-anchor={verticalAnchor(y)}
                style={{ top: percent(y, VIEW.height) }}
              >
                {tick}
              </span>
            )
          })}
        </div>
        <div className={styles.plot} data-flush-plot>
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            role="img"
            aria-label={accessibleSummary}
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y={VIEW.top} width={VIEW.width} height={VIEW.bottom - VIEW.top} />
              </clipPath>
            </defs>
            {yTicks.map((tick) => {
              const y = yForPressure(tick)
              return (
                <line
                  key={tick}
                  className={styles.gridLine}
                  x1="0"
                  x2={VIEW.width}
                  y1={y}
                  y2={y}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            {timeTicks.map((tick) => (
              <line
                key={tick.time}
                className={styles.timeLine}
                x1={xForTime(tick.time)}
                x2={xForTime(tick.time)}
                y1="0"
                y2={VIEW.height}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {timeWindow === 'whole' ? (
              <line
                className={styles.eventLine}
                x1={flushX}
                x2={flushX}
                y1="0"
                y2={VIEW.height}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <line
              className={styles.eventLine}
              x1={releaseX}
              x2={releaseX}
              y1="0"
              y2={VIEW.height}
              vectorEffect="non-scaling-stroke"
            />
            <path
              className={styles.path}
              data-flush-path
              d={path}
              clipPath={`url(#${clipId})`}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className={styles.time} aria-hidden="true">
          {timeTicks.map((tick) => {
            const x = xForTime(tick.time)
            return (
              <span
                key={tick.time}
                style={{ '--flush-x': percent(x, VIEW.width) } as React.CSSProperties}
              >
                {tick.text}
              </span>
            )
          })}
        </div>
      </div>
      {rangeNotice ? (
        <p className={styles.rangeNote} data-waveform-range-note>
          {rangeNotice}
        </p>
      ) : null}
    </figure>
  )
}

/**
 * The three responses, side by side on one source signal, one pressure axis and one time base.
 *
 * Stacked full-width, each panel filled the screen and the three could only be compared from
 * memory (report L2-09). Here each response is a column: the whole test above, the release
 * enlarged in time beneath it, and what the line does to the numbers under that — so the eye moves
 * across a row to compare like with like. Below the width that holds three columns they stack,
 * each still carrying its own axis, labels and description.
 */
export function DynamicResponseComparison({
  lineType,
  headingLevel = 'h3',
}: {
  readonly lineType: FastFlushLineType
  readonly headingLevel?: 'h3' | 'h5'
}) {
  const Heading = headingLevel
  const line = generateFastFlushWaveform(lineType, 'acceptable').line
  return (
    <section
      className={styles.comparison}
      aria-label="Reference flush responses"
      data-dynamic-response-comparison
    >
      <Heading>Reference flush responses · the fast-flush test</Heading>
      <p>
        Guided demonstration · {line.label}. Every panel starts from the same {line.systolicMmHg}/
        {line.diastolicMmHg} mmHg source signal and uses the same {line.scaleMinimumMmHg}–
        {line.scaleMaximumMmHg} mmHg axis and the same time base, so the three can be compared
        directly. These labeled examples are not captured observations from your attempt.
      </p>
      <div className={styles.multiples}>
        {dynamicResponseDefinitions.map((definition) => {
          const displayed = fastFlushDisplayedPressures(lineType, definition.id)
          return (
            <article key={definition.id} data-response={definition.id}>
              <h4>{definition.shortLabel}</h4>
              <FastFlushTrace response={definition.id} lineType={lineType} revealLabel compact />
              <FastFlushTrace
                response={definition.id}
                lineType={lineType}
                revealLabel
                compact
                window="release"
              />
              <dl>
                <div>
                  <dt>Source signal</dt>
                  <dd>
                    {line.systolicMmHg}/{line.diastolicMmHg} mmHg
                  </dd>
                </div>
                <div>
                  <dt>Drawn by this line</dt>
                  <dd data-response-displayed>
                    {fixedWithoutNegativeZero(displayed.systolicMmHg)}/
                    {fixedWithoutNegativeZero(displayed.diastolicMmHg)} mmHg · mean{' '}
                    {fixedWithoutNegativeZero(displayed.meanMmHg)}
                  </dd>
                </div>
              </dl>
              <p>{definition.observation}</p>
              <p>
                {definition.interpretation} {definition.pressureEffect}
              </p>
            </article>
          )
        })}
      </div>
      <p className={styles.note}>
        The drawn values are sampled from these model tracings. They illustrate the direction of
        each error on this source signal; they are not targets, and a real line&apos;s error depends
        on its own tubing and on the patient&apos;s pressure waveform.
      </p>
    </section>
  )
}
