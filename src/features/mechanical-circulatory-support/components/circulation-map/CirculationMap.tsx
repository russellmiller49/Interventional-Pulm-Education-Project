'use client'

import { useId } from 'react'

import type { McsSimulationState } from '../../engine/types'
import type { McsMapPathwayId, McsMapSegmentId } from '../../content/supportSpine'
import {
  CIRCULATION_MAP_PATH_ORDER,
  CIRCULATION_MAP_PATHWAYS,
  CIRCULATION_MAP_SEGMENTS,
  CIRCULATION_MAP_VIEW_BOX,
  LEFT_ATRIUM_INFLOW_D,
  circulationMapSegment,
  type McsMapSegment,
} from './circulationMapGeometry'
import styles from './circulation-map.module.css'

/**
 * The circulation map: one loop, the selected pathway drawn on it, and a place lit.
 *
 * The drawing is a teaching schematic and says so. It reads the same geometry the halos and the
 * pins read, so what is lit is exactly what is drawn. The pathway for the mechanism on screen is
 * drawn whether or not the device is running — a learner asked where a right-sided pump returns
 * its blood has to be able to read that before it is started — and a pathway that is not in place
 * is drawn dashed and says so.
 */

export interface CirculationMapEmphasis {
  readonly segmentIds: readonly McsMapSegmentId[]
  /** "You are here: The left ventricle." — the same sentence goes into the drawing's description. */
  readonly caption: string
  readonly tone: 'you-are-here' | 'implicated'
}

export interface CirculationMapAnswerOption {
  readonly id: string
  readonly label: string
  readonly segmentIds: readonly McsMapSegmentId[]
}

export interface CirculationMapAnswer {
  readonly prompt: string
  readonly options: readonly CirculationMapAnswerOption[]
  readonly selectedOptionId: string | null
  readonly committedOptionId: string | null
  readonly correctOptionId: string
  readonly name: string
  readonly onSelect: (optionId: string) => void
}

export interface CirculationMapProps {
  readonly state: McsSimulationState
  readonly emphasis?: CirculationMapEmphasis | null
  readonly answer?: CirculationMapAnswer | null
}

function pathwaysFor(
  state: McsSimulationState,
): readonly { id: McsMapPathwayId; inPlace: boolean; running: boolean }[] {
  if (state.device.kind === 'iabp') {
    return [{ id: 'iabp-balloon', inPlace: true, running: state.device.running }]
  }
  if (state.device.kind === 'lvad') {
    return [
      {
        id: 'durable-pump',
        inPlace: true,
        running: state.device.powerConnected && state.device.running,
      },
    ]
  }
  return [
    {
      id: 'left-pump',
      inPlace: state.device.left.enabled,
      running: state.device.left.enabled && state.device.left.running,
    },
    {
      id: 'right-pump',
      inPlace: state.device.right.enabled,
      running: state.device.right.enabled && state.device.right.running,
    },
  ]
}

function segmentShape(
  segment: McsMapSegment,
  className: string,
  extra: Record<string, unknown> = {},
) {
  const { shape } = segment
  if (shape.kind === 'vessel') {
    return <path d={shape.d} className={className} {...extra} />
  }
  if (shape.kind === 'chamber') {
    return (
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rx={shape.radius}
        className={className}
        {...extra}
      />
    )
  }
  return (
    <ellipse
      cx={shape.cx}
      cy={shape.cy}
      rx={shape.rx}
      ry={shape.ry}
      className={className}
      {...extra}
    />
  )
}

/** Options ordered along the blood path, so pin numbers read around the loop rather than about it. */
export function orderAnswerOptionsAlongPath(
  options: readonly CirculationMapAnswerOption[],
): readonly CirculationMapAnswerOption[] {
  const position = (option: CirculationMapAnswerOption) =>
    CIRCULATION_MAP_PATH_ORDER.indexOf(option.segmentIds[0] ?? 'venous-return')
  return [...options].sort((a, b) => position(a) - position(b))
}

export function CirculationMap({ state, emphasis, answer }: CirculationMapProps) {
  const titleId = useId()
  const descriptionId = useId()
  /*
   * While a place is the question, a pathway that is drawn but not in place is not drawn at all:
   * a dashed line ending at the answer is the answer. In-place pathways stay, because they are on
   * the screen the learner is reading. Committing the answer restores the full drawing.
   */
  const answerPending = answer !== null && answer !== undefined && answer.committedOptionId === null
  const pathways = pathwaysFor(state).filter((pathway) => pathway.inPlace || !answerPending)
  const lit = new Set(emphasis?.segmentIds ?? [])
  const orderedOptions = answer ? orderAnswerOptionsAlongPath(answer.options) : []
  const committed = answer?.committedOptionId ?? null
  const { width, height } = CIRCULATION_MAP_VIEW_BOX

  const description = [
    'A schematic of the circulation as one loop: venous return, the right atrium and ventricle, the pulmonary artery, the lungs, the left atrium and ventricle, the aortic valve, the aorta, and the body.',
    ...pathways.map((pathway) => {
      const shape = CIRCULATION_MAP_PATHWAYS.find((candidate) => candidate.id === pathway.id)
      return `${shape?.label ?? pathway.id}${pathway.inPlace ? (pathway.running ? ', running.' : ', in place, paused.') : ', drawn but not in place.'}`
    }),
    emphasis?.caption ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.map} data-circulation-map data-map-emphasis-tone={emphasis?.tone}>
      {emphasis ? (
        <p className={styles.caption} data-map-emphasis-caption>
          {emphasis.caption}
        </p>
      ) : null}
      <div className={styles.stage}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={styles.svg}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          data-map-svg
        >
          <title id={titleId}>Circulation map, a teaching schematic</title>
          <desc id={descriptionId}>{description}</desc>

          {/* Halos first, under everything, so a lit segment is lit and not covered. */}
          {CIRCULATION_MAP_SEGMENTS.filter((segment) => lit.has(segment.id)).map((segment) => (
            <g key={`halo-${segment.id}`} data-map-emphasis-target={segment.id}>
              {segmentShape(segment, styles.halo)}
            </g>
          ))}

          {/* The loop. */}
          <g className={styles.loop}>
            <path d={LEFT_ATRIUM_INFLOW_D} className={styles.vessel} />
            <path d={LEFT_ATRIUM_INFLOW_D} className={styles.flow} />
            {CIRCULATION_MAP_SEGMENTS.map((segment) => (
              <g
                key={segment.id}
                data-map-segment={segment.id}
                data-map-lit={lit.has(segment.id) || undefined}
              >
                {segmentShape(
                  segment,
                  segment.shape.kind === 'vessel' ? styles.vessel : styles.chamber,
                )}
                {segment.shape.kind === 'vessel' ? segmentShape(segment, styles.flow) : null}
                <text
                  x={segment.labelAt.x}
                  y={segment.labelAt.y}
                  textAnchor={segment.labelAt.anchor}
                  className={styles.label}
                >
                  {segment.label}
                </text>
              </g>
            ))}
          </g>

          {/* The pathway for the mechanism on screen. */}
          {pathways.map((pathway) => {
            const shape = CIRCULATION_MAP_PATHWAYS.find((candidate) => candidate.id === pathway.id)
            if (!shape) return null
            return (
              <g
                key={pathway.id}
                data-map-pathway={pathway.id}
                data-map-pathway-in-place={pathway.inPlace}
                data-map-pathway-running={pathway.running}
                className={styles.pathway}
              >
                <path d={shape.d} className={styles.deviceLine} />
                {pathway.running ? <path d={shape.d} className={styles.deviceFlow} /> : null}
                {pathway.id === 'iabp-balloon' ? (
                  <ellipse
                    cx={shape.componentAt.x}
                    cy={shape.componentAt.y}
                    rx={13}
                    ry={36}
                    className={styles.balloon}
                  />
                ) : (
                  <rect
                    x={shape.componentAt.x - 14}
                    y={shape.componentAt.y - 14}
                    width={28}
                    height={28}
                    rx={6}
                    className={styles.component}
                  />
                )}
                {shape.inletAt ? (
                  <circle
                    cx={shape.inletAt.x}
                    cy={shape.inletAt.y}
                    r={7}
                    className={styles.inlet}
                  />
                ) : null}
                {shape.outletAt ? (
                  <circle
                    cx={shape.outletAt.x}
                    cy={shape.outletAt.y}
                    r={7}
                    className={styles.outlet}
                  />
                ) : null}
                <text
                  x={shape.labelAt.x}
                  y={shape.labelAt.y}
                  textAnchor={shape.labelAt.anchor}
                  className={styles.pathwayLabel}
                >
                  {pathway.inPlace ? shape.label : `${shape.label} — not in place`}
                </text>
              </g>
            )
          })}

          {/* Answer pins, numbered along the loop. Decorative here; the rows below are the control. */}
          {orderedOptions.map((option, index) => {
            const segment = circulationMapSegment(option.segmentIds[0] ?? 'venous-return')
            const marking =
              committed === null
                ? undefined
                : option.id === committed && option.id === answer?.correctOptionId
                  ? 'your-answer-correct'
                  : option.id === committed
                    ? 'your-answer'
                    : option.id === answer?.correctOptionId
                      ? 'correct'
                      : undefined
            return (
              <g
                key={option.id}
                className={styles.pin}
                data-map-pin={option.id}
                data-map-pin-marking={marking}
                data-map-pin-selected={answer?.selectedOptionId === option.id || undefined}
                aria-hidden="true"
              >
                <circle
                  cx={segment.pinAt.x}
                  cy={segment.pinAt.y}
                  r={20}
                  className={styles.pinDisc}
                />
                <text
                  x={segment.pinAt.x}
                  y={segment.pinAt.y + 7}
                  textAnchor="middle"
                  className={styles.pinNumber}
                >
                  {index + 1}
                </text>
              </g>
            )
          })}
        </svg>

        {/* The same pins as clickable labels over the drawing, each a label for the row's radio.
            They are part of the answer control, and marked as such for the pre-commitment scan. */}
        {answer ? (
          <div data-prediction-choices data-map-pin-targets>
            {orderedOptions.map((option) => {
              const segment = circulationMapSegment(option.segmentIds[0] ?? 'venous-return')
              return (
                <label
                  key={option.id}
                  htmlFor={`${answer.name}-${option.id}`}
                  className={styles.pinTarget}
                  style={{
                    left: `${(segment.pinAt.x / width) * 100}%`,
                    top: `${(segment.pinAt.y / height) * 100}%`,
                  }}
                  data-map-pin-target={option.id}
                >
                  <span className={styles.visuallyHidden}>{option.label}</span>
                </label>
              )
            })}
          </div>
        ) : null}
      </div>

      {answer ? <CirculationMapAnswerRows answer={answer} options={orderedOptions} /> : null}

      <p className={styles.footnote}>
        A teaching schematic, not anatomy to scale. The pathway drawn follows the mechanism on
        screen; the readings are on the monitor beside it.
      </p>
    </div>
  )
}

/**
 * The answer rows: one radio group, each row a label for the same hidden radio its pin points at.
 *
 * The pin carries the numeral, the row carries the words, and both select the same input, so a
 * learner can answer from either and a keyboard or a screen reader meets one ordinary radio group.
 * Nothing is said until the commitment; then it is said in words on the row.
 */
function CirculationMapAnswerRows({
  answer,
  options,
}: {
  readonly answer: CirculationMapAnswer
  readonly options: readonly CirculationMapAnswerOption[]
}) {
  const legendId = useId()
  const committed = answer.committedOptionId
  return (
    <fieldset
      className={styles.answerRows}
      disabled={committed !== null}
      aria-labelledby={legendId}
      data-prediction-choices
      data-map-answer
    >
      {/* The group's name for assistive technology; the Now card already shows the prompt. */}
      <legend id={legendId} className={styles.visuallyHidden}>
        {answer.prompt}
      </legend>
      {options.map((option, index) => {
        const inputId = `${answer.name}-${option.id}`
        const isCommitted = committed === option.id
        const isCorrect = option.id === answer.correctOptionId
        const marking =
          committed === null
            ? null
            : isCommitted && isCorrect
              ? 'Your answer · correct'
              : isCommitted
                ? 'Your answer'
                : isCorrect
                  ? 'Correct'
                  : null
        return (
          <label
            key={option.id}
            htmlFor={inputId}
            className={styles.answerRow}
            data-selected={answer.selectedOptionId === option.id}
            data-map-answer-row={option.id}
            data-map-answer-marking={
              marking === null
                ? undefined
                : isCommitted && isCorrect
                  ? 'your-answer-correct'
                  : isCommitted
                    ? 'your-answer'
                    : 'correct'
            }
          >
            <input
              id={inputId}
              type="radio"
              name={answer.name}
              value={option.id}
              checked={answer.selectedOptionId === option.id}
              onChange={() => answer.onSelect(option.id)}
            />
            <span className={styles.answerNumber} aria-hidden="true">
              {index + 1}
            </span>
            <span className={styles.answerText}>
              <span className={styles.visuallyHidden}>{index + 1}. </span>
              {option.label}
            </span>
            {marking ? (
              <span className={styles.answerMarking} data-map-answer-marking-label>
                {marking}
              </span>
            ) : null}
          </label>
        )
      })}
    </fieldset>
  )
}
