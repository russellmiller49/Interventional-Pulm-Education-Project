'use client'

import { useId, useMemo } from 'react'

import { routeStop, routeStopIds, type RouteStopId } from '../../content/routeSpine'
import type { CatheterPosition } from '../../engine/types'
import {
  CATHETER_MAP_VIEW,
  HEART_ROUTE_LENGTH,
  HEART_ROUTE_PATH,
  HEART_ROUTE_PROGRESS,
  HEART_SHAPES,
  LINE_PARTS,
  LINE_TUBING_PATH,
  STOP_HALO_RADIUS,
  STOP_ORDER,
  STOP_POINTS,
  TIP_POINTS,
} from './catheterMapGeometry'
import styles from './catheter-map.module.css'

/** The drawing's labels: where each sits, in the map's own coordinates, and which way it hangs. */
const MAP_LABELS: readonly {
  readonly text: string
  /** A one-letter key used when the drawing is too narrow for the word; the key is listed below it. */
  readonly short?: string
  readonly x: number
  readonly y: number
  readonly anchor: 'above' | 'below' | 'left'
}[] = [
  {
    text: 'monitor',
    short: 'M',
    x: LINE_PARTS.monitor.x + LINE_PARTS.monitor.width / 2,
    y: LINE_PARTS.monitor.y + LINE_PARTS.monitor.height + 3,
    anchor: 'below',
  },
  {
    text: 'transducer',
    short: 'T',
    x: LINE_PARTS.transducer.x + LINE_PARTS.transducer.width / 2,
    y: LINE_PARTS.transducer.y - 3,
    anchor: 'above',
  },
  {
    text: 'flush bag',
    short: 'F',
    x: LINE_PARTS.flushBag.x + LINE_PARTS.flushBag.width / 2,
    y: LINE_PARTS.flushBag.y + LINE_PARTS.flushBag.height + 3,
    anchor: 'below',
  },
  {
    text: 'stopcock',
    short: 'S',
    x: LINE_PARTS.stopcock.x,
    y: LINE_PARTS.stopcock.y + 8,
    anchor: 'below',
  },
  { text: 'SVC', x: 244, y: 30, anchor: 'left' },
  { text: 'RA', x: 240, y: 108, anchor: 'left' },
  { text: 'RV', x: 330, y: 150, anchor: 'below' },
  { text: 'PA', x: 412, y: 88, anchor: 'below' },
  { text: 'distal PA', x: 512, y: 22, anchor: 'left' },
]

export interface CatheterMapAnswerChoice {
  readonly id: string
  readonly label: string
}

export interface CatheterMapAnswer {
  readonly legend: string
  readonly name: string
  readonly choices: readonly CatheterMapAnswerChoice[]
  /** Choice id → the stop it stands for; a choice with no stop is the off-map option. */
  readonly targets: Readonly<Record<string, RouteStopId | null>>
  readonly selectedChoiceId: string | null
  readonly onSelect: (choiceId: string) => void
  readonly disabled: boolean
  /** Once committed: the keyed choice, so the rows can say which was right. */
  readonly revealed?: { readonly keyedChoiceId: string }
  /** For a confirmation control: rows already confirmed, said in words. */
  readonly confirmed?: ReadonlySet<string>
  readonly hint?: string
  /**
   * The response to the last choice, rendered here rather than in another pane.
   *
   * A confirmation that did not match the tracing used to answer in the Now card while the pins
   * are on the simulator, so pressing a place that was wrong looked like nothing happening at all
   * (report L5-02). It is not a score and not a tally: it describes the tracing at the moment it
   * was pressed, and the caller clears it when the tip moves.
   */
  readonly note?: string | null
}

/**
 * The pressure's path from the tip to the number, and where you are on it.
 *
 * One drawing: the right-heart schematic the normal-waveform reference draws, with the line —
 * tubing, stopcock, flush bag, transducer, monitor — continued to its left from the catheter hub.
 * The map lights the stops a step stands at, names the place in words above the drawing and in
 * its description, shows where the simulated tip actually is when the step allows, and — when a
 * step asks where the tip is or where a problem lives — becomes the answer control: each place is
 * a numbered pin on the drawing and a row beneath it, both labels for one visually hidden radio,
 * so the browser supplies the group's keyboard and screen-reader behaviour. Pins are numbered
 * along the path, not in choice order; an option with no place on the drawing keeps its row.
 *
 * A teaching schematic, badged as one. The live tracings are on the monitor above it.
 */
export function CatheterMap({
  emphasis,
  caption,
  tipPosition,
  balloonUp = false,
  answer,
}: {
  readonly emphasis: readonly RouteStopId[]
  /** "You are here: the pulmonary artery." Absent when the step stands at the whole path. */
  readonly caption?: string
  /** Where the simulated tip is; omitted while its place is the question. */
  readonly tipPosition?: CatheterPosition | null
  readonly balloonUp?: boolean
  readonly answer?: CatheterMapAnswer
}) {
  const titleId = useId()
  const descriptionId = useId()
  const inputBase = useId()
  const lit = useMemo(() => new Set(emphasis), [emphasis])
  const litStops = routeStopIds.filter((id) => lit.has(id))

  const description = useMemo(() => {
    const where =
      litStops.length === 0
        ? 'No single stop is marked; the whole path is in view.'
        : `Marked: ${litStops.map((id) => routeStop(id).title).join('; ')}.`
    const tip =
      tipPosition === undefined || tipPosition === null
        ? 'The position of the simulated tip is not shown on this step.'
        : `The simulated tip is at ${positionWords(tipPosition)}${balloonUp ? ', with the balloon up' : ''}.`
    return `Schematic of the pressure's path from the catheter tip to the number on the screen. On the left, the line: a monitor, a transducer with its reference height, a flush bag, tubing and a stopcock running to the catheter hub. On the right, the right heart: the superior vena cava, the right atrium, the tricuspid valve, the right ventricle, the pulmonic valve, the main pulmonary artery and a distal branch where the balloon occludes. Five stops are marked along the path: the line, the right atrium, the right ventricle, the pulmonary artery, the wedge. ${where} ${tip}`
  }, [litStops, tipPosition, balloonUp])

  const stopNumber = (stopId: RouteStopId) => STOP_ORDER.indexOf(stopId) + 1
  const choiceForStop = (stopId: RouteStopId) =>
    answer?.choices.find((choice) => answer.targets[choice.id] === stopId)
  const tip = tipPosition ? TIP_POINTS[tipPosition] : null
  const travelled = tipPosition ? HEART_ROUTE_LENGTH * HEART_ROUTE_PROGRESS[tipPosition] : 0

  return (
    <section
      className={styles.map}
      data-catheter-map
      data-emphasis={litStops.length > 0 ? 'some' : 'none'}
      data-lit={litStops.join(' ')}
      data-tip={tipPosition ?? 'withheld'}
      aria-labelledby={titleId}
    >
      <div className={styles.header}>
        <h3 id={titleId} className={styles.heading}>
          The catheter map
        </h3>
        <span className={styles.badge}>Teaching schematic</span>
      </div>
      <p className={styles.caption} data-catheter-map-caption data-empty={!caption}>
        {caption ??
          'From the tip to the number: the line on the left, the right heart on the right. The live tracings are on the monitor above.'}
      </p>
      <div className={styles.frame}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${CATHETER_MAP_VIEW.width} ${CATHETER_MAP_VIEW.height}`}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <desc id={descriptionId}>{description}</desc>

          {/* The line */}
          <g data-map-part="line">
            <rect
              className={styles.monitor}
              x={LINE_PARTS.monitor.x}
              y={LINE_PARTS.monitor.y}
              width={LINE_PARTS.monitor.width}
              height={LINE_PARTS.monitor.height}
              rx={5}
            />
            <path
              className={styles.monitorTrace}
              d={`M ${LINE_PARTS.monitor.x + 8} ${LINE_PARTS.monitor.y + 34} l 8 0 l 4 -18 l 5 22 l 5 -8 l 8 0 l 4 -14 l 5 18 l 5 -6 l 8 0`}
            />
            <path className={styles.cable} d={LINE_PARTS.cable} />
            <rect
              className={styles.transducer}
              x={LINE_PARTS.transducer.x}
              y={LINE_PARTS.transducer.y}
              width={LINE_PARTS.transducer.width}
              height={LINE_PARTS.transducer.height}
              rx={4}
            />
            <path className={styles.tubing} d={LINE_PARTS.bagLine} />
            <rect
              className={styles.flushBag}
              x={LINE_PARTS.flushBag.x}
              y={LINE_PARTS.flushBag.y}
              width={LINE_PARTS.flushBag.width}
              height={LINE_PARTS.flushBag.height}
              rx={6}
            />
            <path className={styles.tubing} data-lit={lit.has('line')} d={LINE_TUBING_PATH} />
            <g
              className={styles.stopcock}
              transform={`translate(${LINE_PARTS.stopcock.x} ${LINE_PARTS.stopcock.y})`}
            >
              <line x1={-6} y1={0} x2={6} y2={0} />
              <line x1={0} y1={-6} x2={0} y2={6} />
            </g>
          </g>

          {/* The heart */}
          <g data-map-part="heart">
            <path className={styles.vessel} d={HEART_SHAPES.svc} />
            <ellipse
              className={styles.chamber}
              cx={HEART_SHAPES.rightAtrium.cx}
              cy={HEART_SHAPES.rightAtrium.cy}
              rx={HEART_SHAPES.rightAtrium.rx}
              ry={HEART_SHAPES.rightAtrium.ry}
            />
            <path className={styles.chamber} d={HEART_SHAPES.rightVentricle} />
            <path className={styles.vessel} d={HEART_SHAPES.pulmonaryArtery} />
            <g className={styles.valve}>
              <line {...HEART_SHAPES.tricuspid} />
              <line {...HEART_SHAPES.pulmonic} />
            </g>
            <path className={styles.routeGhost} d={HEART_ROUTE_PATH} />
            {tip ? (
              <path
                className={styles.route}
                d={HEART_ROUTE_PATH}
                strokeDasharray={`${travelled.toFixed(1)} ${HEART_ROUTE_LENGTH}`}
              />
            ) : null}
            {tip && balloonUp ? (
              <circle className={styles.balloon} cx={tip.x - 10} cy={tip.y + 2} r={8} />
            ) : null}
            {tip ? (
              <circle className={styles.tip} data-map-tip cx={tip.x} cy={tip.y} r={5} />
            ) : null}
          </g>

          {/* Halos */}
          {litStops.map((stopId) => (
            <circle
              key={stopId}
              className={styles.halo}
              data-map-emphasis-target={stopId}
              cx={STOP_POINTS[stopId].x}
              cy={STOP_POINTS[stopId].y}
              r={STOP_HALO_RADIUS[stopId]}
            />
          ))}
        </svg>

        {/*
          The drawing's labels, as page text over it. Inside the SVG they were sized in the view
          box's units, so on a phone they shrank with the drawing to about seven pixels (report
          X-01). Here they keep the text size the reader chose at any width.
        */}
        <div className={styles.labels} aria-hidden="true" data-map-labels>
          {MAP_LABELS.map((label) => (
            <span
              key={label.text}
              data-anchor={label.anchor}
              data-map-label={label.text}
              style={{
                left: `${(label.x / CATHETER_MAP_VIEW.width) * 100}%`,
                top: `${(label.y / CATHETER_MAP_VIEW.height) * 100}%`,
              }}
            >
              {label.short ? (
                <>
                  <span data-label-form="full">{label.text}</span>
                  <span data-label-form="short">{label.short}</span>
                </>
              ) : (
                label.text
              )}
            </span>
          ))}
        </div>

        {answer
          ? STOP_ORDER.map((stopId) => {
              const choice = choiceForStop(stopId)
              if (!choice) return null
              const point = STOP_POINTS[stopId]
              const selected = answer.selectedChoiceId === choice.id
              return (
                <label
                  key={stopId}
                  htmlFor={`${inputBase}-${choice.id}`}
                  className={styles.pin}
                  data-map-pin={stopId}
                  data-selected={selected}
                  data-disabled={answer.disabled}
                  style={{
                    left: `${(point.x / CATHETER_MAP_VIEW.width) * 100}%`,
                    top: `${(point.y / CATHETER_MAP_VIEW.height) * 100}%`,
                  }}
                  aria-hidden="true"
                >
                  {stopNumber(stopId)}
                </label>
              )
            })
          : null}
      </div>

      <p className={styles.abbreviations} data-map-abbreviations>
        <span data-label-form="short">
          M, monitor · T, transducer · F, flush bag · S, stopcock ·{' '}
        </span>
        SVC, superior vena cava · RA, right atrium · RV, right ventricle · PA, pulmonary artery
      </p>

      {!answer ? (
        <ol className={styles.legend} aria-label="The five stops">
          {STOP_ORDER.map((stopId) => (
            <li key={stopId} data-lit={lit.has(stopId)}>
              <span className={styles.number} aria-hidden="true">
                {stopNumber(stopId)}
              </span>
              {routeStop(stopId).title}
            </li>
          ))}
        </ol>
      ) : null}

      {answer ? (
        <fieldset
          className={styles.answer}
          disabled={answer.disabled}
          data-catheter-map-answer
          data-prediction-choices
        >
          <legend>{answer.legend}</legend>
          <p className={styles.hint}>
            {answer.hint ??
              'Choose a place: the numbered pins on the drawing and the rows below are the same choices.'}
          </p>
          {[
            ...STOP_ORDER.map((stopId) => ({ stopId, choice: choiceForStop(stopId) })),
            ...answer.choices
              .filter((choice) => answer.targets[choice.id] === null)
              .map((choice) => ({ stopId: null, choice })),
          ].map(({ stopId, choice }) => {
            if (!choice) return null
            const selected = answer.selectedChoiceId === choice.id
            const confirmed = answer.confirmed?.has(choice.id) ?? false
            const outcome = answer.revealed
              ? answer.revealed.keyedChoiceId === choice.id
                ? selected
                  ? 'your answer · correct'
                  : 'correct'
                : selected
                  ? 'your answer'
                  : null
              : confirmed
                ? 'confirmed'
                : null
            return (
              <label
                key={choice.id}
                className={styles.option}
                data-selected={selected}
                data-off-map={stopId === null}
                data-outcome={
                  outcome === null
                    ? undefined
                    : answer.revealed?.keyedChoiceId === choice.id
                      ? 'correct'
                      : confirmed
                        ? 'confirmed'
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
                  {stopId ? stopNumber(stopId) : '–'}
                </span>
                <span>{choice.label}</span>
                {outcome ? (
                  <span className={styles.outcome} data-catheter-map-outcome>
                    {outcome}
                  </span>
                ) : null}
              </label>
            )
          })}
          {answer.note ? (
            <p className={styles.answerNote} role="status" data-place-note>
              {answer.note}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <p className={styles.equivalent}>{description}</p>
    </section>
  )
}

export function positionWords(position: CatheterPosition): string {
  switch (position) {
    case 'introducer':
      return 'the introducer'
    case 'ra':
      return 'the right atrium'
    case 'rv':
      return 'the right ventricle'
    case 'pa':
      return 'the pulmonary artery'
    case 'wedge':
      return 'the wedge'
    default:
      return position
  }
}

/** "You are here: The pulmonary artery." for a set of lit stops, or undefined for the whole path. */
export function catheterMapCaption(stops: readonly RouteStopId[]): string | undefined {
  if (stops.length === 0) return undefined
  if (stops.length === 1) return `You are here: ${routeStop(stops[0]).title.toLowerCase()}.`
  return `You are here: ${stops.map((id) => routeStop(id).title.toLowerCase()).join(' and ')}.`
}
