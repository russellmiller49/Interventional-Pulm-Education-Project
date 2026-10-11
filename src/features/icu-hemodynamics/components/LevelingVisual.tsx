'use client'

import { useId, useMemo } from 'react'

import {
  formatSignedPressure,
  hydrostaticPressureOffsetMmHg,
  levelingPressureTracePath,
} from '../content/pressureSystemVisuals'
import {
  deriveUnroundedHemodynamicMeasurements,
  fixedWithoutNegativeZero,
  unroundedModelEstimates,
  type HemodynamicSimulationState,
} from '../engine'
import styles from './leveling-visual.module.css'

/*
 * The drawing's geometry, in the units of its own view box.
 *
 * A supine patient seen from the side: the bed is at the bottom, the anterior chest surface is the
 * top of the outline, and the back rests on the bed. The reference point is drawn **midway between
 * those two** at the chest. It used to sit on the anterior surface, which is not what the module's
 * own source describes: Ragosta and Kennedy define the zero position as "the patient's midchest in
 * the anteroposterior dimension at the level of the sternal angle of Louis (fourth intercostal
 * space)… also known as the phlebostatic axis" (ch. 2, "Calibration, Balancing, and Zeroing", and
 * Fig. 2.2: "a point midway in the anteroposterior chest dimension"). The marker's position was a
 * drawing error against that sentence and is corrected here (report L2-05). Which reference level
 * a unit uses for a given position, and how it is found on a patient, are not decided by a
 * schematic and are not claimed by this one.
 */
const VIEW = { width: 640, height: 300 } as const
const BED_TOP = 226
const CHEST = { x: 232, anteriorY: 146, posteriorY: BED_TOP } as const
const AXIS_Y = (CHEST.anteriorY + CHEST.posteriorY) / 2
const BRACKET_X = 520
/** Drawing units per centimetre of transducer height; ±20 cm stays inside the view box. */
const UNITS_PER_CM = 3.4

function percent(value: number, whole: number): string {
  return `${((value / whole) * 100).toFixed(2)}%`
}

export type LevelingChannel = 'arterial' | 'pac'

const CHANNEL_WORDS: Readonly<Record<LevelingChannel, { readonly name: string }>> = {
  arterial: { name: 'mean arterial pressure' },
  pac: { name: 'mean pulmonary-artery pressure' },
}

/**
 * Leveling, drawn large enough to read.
 *
 * The teaching picture — patient, reference level, transducer and the height between them — used to
 * be a strip at the foot of its card with labels a few pixels tall (report L2-04). It now takes the
 * card's width; its labels are HTML set in rem over the drawing, so they keep their size when the
 * card narrows and grow with the reader's text size; and the values beside it name the channel the
 * monitor is showing instead of always reporting arterial pressure beside a pulmonary-artery strip
 * (report L2-06).
 */
export function LevelingVisual({
  state,
  channel = 'arterial',
}: {
  readonly state: HemodynamicSimulationState
  /** The pressure the values describe: the one on the monitor beside this card. */
  readonly channel?: LevelingChannel
}) {
  const titleId = useId()
  const levelCm = state.measurementSystem.transducerLevelCm
  const offsetMmHg = hydrostaticPressureOffsetMmHg(levelCm)
  const reference = useMemo(
    () =>
      deriveUnroundedHemodynamicMeasurements(state.parameters, {
        ...state.measurementSystem,
        transducerLevelCm: 0,
      }),
    [state.measurementSystem, state.parameters],
  )
  const current = unroundedModelEstimates(state)
  const referenceValue = channel === 'pac' ? reference.meanPapMmHg : reference.mapMmHg
  const currentValue = channel === 'pac' ? current.meanPapMmHg : current.mapMmHg
  const levelPosition =
    levelCm === 0
      ? 'at the phlebostatic axis'
      : `${Math.abs(levelCm).toFixed(0)} centimeters ${levelCm > 0 ? 'above' : 'below'} the phlebostatic axis`
  const direction =
    offsetMmHg === 0 ? 'No leveling offset' : offsetMmHg > 0 ? 'Reads high' : 'Reads low'
  const directionSentence =
    offsetMmHg === 0 ? 'has no leveling offset' : offsetMmHg > 0 ? 'reads high' : 'reads low'
  const transducerY = AXIS_Y - levelCm * UNITS_PER_CM
  const traceShift = Math.max(-22, Math.min(22, -offsetMmHg * 1.8))
  const heightLabel = `${levelCm > 0 ? '+' : levelCm < 0 ? '−' : ''}${Math.abs(levelCm).toFixed(0)} cm`
  const visualSummary = `Side view of a supine patient. The reference point, the phlebostatic axis, is drawn midway between the front and the back of the chest at the fourth intercostal space, with a dashed level line through it. The pressure transducer is ${levelPosition}. The modeled leveling contribution is ${formatSignedPressure(offsetMmHg)}, so the displayed pressure ${directionSentence}. Waveform morphology and pulse pressure are unchanged by leveling alone.`

  return (
    <section className={styles.card} aria-labelledby={titleId} data-leveling-visual={channel}>
      <header>
        <div>
          <span>Hydrostatic leveling</span>
          <h4 id={titleId}>Leveling changes the number, not the waveform</h4>
        </div>
        <strong data-offset={offsetMmHg === 0 ? 'neutral' : offsetMmHg > 0 ? 'high' : 'low'}>
          {formatSignedPressure(offsetMmHg)}
        </strong>
      </header>

      {/*
        The frame is what the labels are placed against and what keeps a least drawing width; the
        box around it scrolls when the card is narrower than that (a phone with text at 200 %).
      */}
      <div className={styles.diagram} data-leveling-diagram>
        <div className={styles.diagramFrame}>
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            role="img"
            aria-label={visualSummary}
            preserveAspectRatio="xMidYMid meet"
          >
            <rect className={styles.bed} x="24" y={BED_TOP} width="420" height="18" rx="9" />
            <circle className={styles.patient} cx="76" cy="182" r="36" />
            <path
              className={styles.patient}
              d={`M 110 198 C 140 168, 186 ${CHEST.anteriorY}, ${CHEST.x} ${CHEST.anteriorY} C 290 ${CHEST.anteriorY}, 330 168, 372 186 L 428 ${BED_TOP} L 100 ${BED_TOP} Z`}
            />
            {/* The chest's front-to-back depth at the reference point, so "midway" can be seen. */}
            <line
              className={styles.depth}
              data-leveling-chest-depth
              x1={CHEST.x}
              x2={CHEST.x}
              y1={CHEST.anteriorY}
              y2={CHEST.posteriorY}
            />
            <line
              className={styles.axis}
              x1="16"
              x2={VIEW.width - 16}
              y1={AXIS_Y}
              y2={AXIS_Y}
              data-leveling-axis-line
            />
            <circle
              className={styles.axisPoint}
              cx={CHEST.x}
              cy={AXIS_Y}
              r="8"
              data-leveling-axis-point
              data-anterior-y={CHEST.anteriorY}
              data-posterior-y={CHEST.posteriorY}
            />
            <line className={styles.leader} x1={CHEST.x} y1={AXIS_Y} x2="300" y2="98" />
            <line
              className={styles.measure}
              x1={BRACKET_X}
              x2={BRACKET_X}
              y1={AXIS_Y}
              y2={transducerY}
            />
            <line
              className={styles.measureCap}
              x1={BRACKET_X - 14}
              x2={BRACKET_X + 14}
              y1={AXIS_Y}
              y2={AXIS_Y}
            />
            <line
              className={styles.measureCap}
              x1={BRACKET_X - 14}
              x2={BRACKET_X + 14}
              y1={transducerY}
              y2={transducerY}
            />
            <g transform={`translate(${BRACKET_X + 20} ${transducerY - 16})`}>
              <rect className={styles.transducerBody} width="84" height="32" rx="8" />
              <circle className={styles.transducerPort} cx="14" cy="16" r="6" />
            </g>
          </svg>
          <span
            className={styles.label}
            data-leveling-label="axis"
            style={{ left: percent(304, VIEW.width), top: percent(98, VIEW.height) }}
          >
            Phlebostatic axis
            <small>mid-chest, front to back</small>
          </span>
          <span
            className={styles.label}
            data-leveling-label="transducer"
            data-anchor="end"
            style={{
              left: percent(VIEW.width - 8, VIEW.width),
              // Clear of the box: above it when the transducer is raised, beneath it otherwise.
              top: percent(transducerY + (levelCm > 0 ? -34 : 34), VIEW.height),
            }}
          >
            transducer
          </span>
          <span
            className={styles.label}
            data-leveling-label="height"
            data-anchor="end"
            data-tone="measure"
            style={{
              left: percent(BRACKET_X - 20, VIEW.width),
              top: percent((AXIS_Y + transducerY) / 2 + (levelCm === 0 ? -16 : 0), VIEW.height),
            }}
          >
            {heightLabel}
          </span>
        </div>
      </div>
      <p className={styles.caption} data-leveling-caption>
        A schematic side view, not to scale. The reference point is drawn midway between the front
        and the back of the chest at the fourth intercostal space; it shows what the level is
        measured from, not how to find it on a patient.
      </p>

      <div className={styles.comparison}>
        <div className={styles.legend} aria-hidden="true">
          <span data-line="reference">Reference level</span>
          <span data-line="current">Current display</span>
        </div>
        <svg
          viewBox="0 0 388 92"
          role="img"
          aria-label={`A schematic of one pressure-wave shape drawn twice. The current display is shifted by ${formatSignedPressure(offsetMmHg)} compared with the reference level, with no change of shape.`}
        >
          <path className={styles.grid} d="M 0 18 H 388 M 0 46 H 388 M 0 74 H 388" />
          <path className={styles.referenceTrace} d={levelingPressureTracePath} />
          <path
            className={styles.currentTrace}
            d={levelingPressureTracePath}
            transform={`translate(0 ${traceShift.toFixed(1)})`}
          />
        </svg>
        <dl>
          <div>
            <dt>Same system at the reference level</dt>
            <dd data-leveling-reference>
              {fixedWithoutNegativeZero(referenceValue, 1)} mmHg
              <small>{CHANNEL_WORDS[channel].name}, model estimate</small>
            </dd>
          </div>
          <div>
            <dt>At this transducer height</dt>
            <dd data-leveling-current>
              {fixedWithoutNegativeZero(currentValue, 1)} mmHg
              <small>{CHANNEL_WORDS[channel].name}, model estimate</small>
            </dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd data-leveling-direction>{direction}</dd>
          </div>
        </dl>
      </div>

      {!state.measurementSystem.zeroed ? (
        <p className={styles.boundary} role="note">
          Zero is still required. This comparison isolates the modeled leveling contribution only.
        </p>
      ) : null}
    </section>
  )
}
