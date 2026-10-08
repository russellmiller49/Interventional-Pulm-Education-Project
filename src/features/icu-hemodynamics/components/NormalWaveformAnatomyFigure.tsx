'use client'

import type { NormalWaveformReferenceEntry } from '../content'
import styles from './icu-hemodynamics.module.css'

/**
 * One right-heart schematic whose anatomy never moves.
 *
 * The temptation with a four-state reference is four diagrams. That teaches the wrong thing: a
 * learner comparing them ends up comparing two drawings rather than two positions along one route,
 * and any difference in how the chambers were drawn reads as a difference in anatomy.
 *
 * So the vessels, chambers, and valves are drawn once and are byte-identical in every state. What
 * moves is the catheter tip, the segment of the route already travelled, and — at the wedge — the
 * balloon. The current position is named in words beneath the figure and repeated in the image
 * description, so nothing here depends on noticing which shape changed colour.
 */

type ReferencePosition = NormalWaveformReferenceEntry['position']

/** Where the tip sits for each state, in the figure's own coordinates. */
const TIP_POINTS: Readonly<Record<ReferencePosition, { readonly x: number; readonly y: number }>> =
  {
    ra: { x: 96, y: 84 },
    rv: { x: 152, y: 128 },
    pa: { x: 218, y: 62 },
    wedge: { x: 292, y: 32 },
  }

const ROUTE_PATH =
  'M 82 14 L 82 58 C 82 74, 88 82, 96 84 C 118 90, 132 104, 152 128 C 166 112, 176 100, 188 90 C 208 74, 232 56, 252 44 C 268 35, 282 32, 300 30'

/** Measured length of `ROUTE_PATH`, so the dash that marks the travelled segment lands correctly. */
const ROUTE_LENGTH = 330

/**
 * How far along the route each state is, as a fraction of `ROUTE_LENGTH`.
 *
 * These are the path positions of the tip points above, not estimates: an over-long `ROUTE_LENGTH`
 * silently clamps the later states to a fully drawn route, so the pulmonary artery and the wedge
 * looked identical while the marker moved.
 */
const ROUTE_PROGRESS: Readonly<Record<ReferencePosition, number>> = {
  ra: 0.23,
  rv: 0.45,
  pa: 0.73,
  wedge: 1,
}

/**
 * The tip position in words.
 *
 * Exported because it is the only thing on this figure that says where the catheter is without
 * relying on seeing which shape moved — for a learner reading the caption, and for a suite checking
 * that the anatomy and the trace are describing the same state.
 */
export const NORMAL_WAVEFORM_ANATOMY_POSITION_LABELS: Readonly<Record<ReferencePosition, string>> =
  {
    ra: 'Right atrium',
    rv: 'Right ventricle',
    pa: 'Pulmonary artery',
    wedge: 'Balloon-occluded pulmonary artery branch',
  }

/** The vessels and chambers, drawn once and shared by every figure that shows this anatomy. */
function RightHeartOutline() {
  return (
    <>
      <path className={styles.referenceAnatomyVessel} d="M 70 8 L 94 8 L 94 60 L 70 60 Z" />
      <ellipse className={styles.referenceAnatomyChamber} cx="96" cy="84" rx="32" ry="27" />
      <path
        className={styles.referenceAnatomyChamber}
        d="M 118 96 C 146 96, 170 108, 178 128 C 168 152, 144 162, 126 152 C 110 142, 106 118, 118 96 Z"
      />
      <path
        className={styles.referenceAnatomyVessel}
        d="M 172 104 C 196 82, 226 60, 254 46 C 272 37, 288 32, 306 28 L 310 42 C 292 46, 276 51, 260 60 C 234 74, 206 96, 184 116 Z"
      />
    </>
  )
}

export function NormalWaveformAnatomyFigure({
  position,
  physicalLocation,
}: {
  readonly position: ReferencePosition
  readonly physicalLocation: string
}) {
  const tip = TIP_POINTS[position]
  const travelled = ROUTE_LENGTH * ROUTE_PROGRESS[position]

  return (
    <figure className={styles.referenceAnatomyFigure}>
      <svg
        viewBox="0 0 340 176"
        role="img"
        aria-label={`Right-heart schematic showing the superior vena cava, right atrium, tricuspid valve, right ventricle, pulmonic valve, main pulmonary artery, and a distal pulmonary artery branch. The catheter tip is in the ${NORMAL_WAVEFORM_ANATOMY_POSITION_LABELS[position].toLowerCase()}. ${physicalLocation}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <RightHeartOutline />

        <g className={styles.referenceAnatomyValve}>
          <line x1="110" y1="100" x2="128" y2="90" />
          <text x="104" y="118" textAnchor="middle">
            TV
          </text>
        </g>
        <g className={styles.referenceAnatomyValve}>
          <line x1="170" y1="112" x2="186" y2="100" />
          <text x="190" y="126" textAnchor="middle">
            PV
          </text>
        </g>

        <path
          className={styles.referenceAnatomyRoute}
          d={ROUTE_PATH}
          strokeDasharray={`${travelled.toFixed(1)} ${ROUTE_LENGTH}`}
        />

        {position === 'wedge' ? (
          <circle className={styles.referenceAnatomyBalloon} cx={tip.x - 10} cy={tip.y + 2} r="8" />
        ) : null}
        <circle className={styles.referenceAnatomyTip} cx={tip.x} cy={tip.y} r="5" />

        {/* Chamber names sit clear of the route, the tip marker, and each other — SVC above the
            vessel it names rather than on top of the atrium below it. */}
        <g className={styles.referenceAnatomyLabel}>
          <text x="46" y="34" textAnchor="middle">
            SVC
          </text>
          <text x="60" y="112" textAnchor="middle">
            RA
          </text>
          <text x="150" y="146" textAnchor="middle">
            RV
          </text>
          <text x="232" y="92" textAnchor="middle">
            PA
          </text>
          <text x="300" y="18" textAnchor="middle">
            distal PA
          </text>
        </g>
      </svg>

      <figcaption>
        <strong>Catheter tip: {NORMAL_WAVEFORM_ANATOMY_POSITION_LABELS[position]}</strong>
        <span>{physicalLocation}</span>
      </figcaption>
    </figure>
  )
}

/* ------------------------------------------------------------------ *
 * The catheter's parts, on the same anatomy
 * ------------------------------------------------------------------ */

/**
 * The four parts of the catheter that the section-one origin cards name.
 *
 * Each sentence says where the part sits *relative to the others and to the heart* when the tip is
 * in the pulmonary artery, in the words the registered review uses: a balloon "at the distal tip",
 * a "thermistor near the tip", a "proximal RA port", "proximal CVP and distal PA ports" (Whitener,
 * Konoske and Mark 2014). No distance is given: how far each part is from the tip is a property of
 * a particular catheter, and the walkthrough's example distances are not copied here.
 */
export const PAC_COMPONENT_PARTS = [
  {
    id: 'distal-opening',
    name: 'Distal opening',
    where: 'at the tip, here in the pulmonary artery',
    carries:
      'The catheter’s pressure channel, and the port a mixed-venous blood sample is drawn from.',
    point: { x: 218, y: 62 },
    mark: { x: 244, y: 40 },
  },
  {
    id: 'balloon',
    name: 'Balloon',
    where: 'at the tip, drawn deflated',
    carries:
      'Inflated to float the tip forward, and briefly to occlude a branch for the wedge pressure.',
    point: { x: 207, y: 72 },
    mark: { x: 186, y: 44 },
  },
  {
    id: 'thermistor',
    name: 'Thermistor',
    where: 'near the tip',
    carries: 'Senses blood temperature; the thermodilution curve is its reading over time.',
    point: { x: 194, y: 85 },
    mark: { x: 222, y: 108 },
  },
  {
    id: 'proximal-port',
    name: 'Proximal port',
    where: 'further back along the catheter, in the right atrium when the tip is in the artery',
    carries: 'Right-atrial pressure, and the injectate for thermodilution.',
    point: { x: 96, y: 84 },
    mark: { x: 122, y: 58 },
  },
] as const

const PAC_SCHEMATIC_VIEW = { width: 340, height: 176 } as const

const PAC_CHAMBER_NAMES = [
  { name: 'Superior vena cava', x: 4, y: 26, anchor: 'start' },
  { name: 'Right atrium', x: 4, y: 122, anchor: 'start' },
  { name: 'Right ventricle', x: 150, y: 170, anchor: 'middle' },
  { name: 'Pulmonary artery', x: 284, y: 96, anchor: 'middle' },
] as const

/**
 * A pulmonary artery catheter and its parts, on the module's existing right-heart schematic.
 *
 * Section one described four signal origins in prose and left the learner to picture where the
 * proximal port and the thermistor sit relative to the tip (report L1-01). This is the same anatomy
 * and the same catheter route the normal-waveform reference draws — not a second drawing of the
 * heart — with the catheter's parts marked on it and named in full. The marks are numbered page
 * text over the drawing, so they stay readable at any width, and every part is also listed in
 * words beneath it.
 */
export function PacComponentSchematic() {
  const tip = TIP_POINTS.pa
  const travelled = ROUTE_LENGTH * ROUTE_PROGRESS.pa
  const description = `Schematic of a pulmonary artery catheter passing from the superior vena cava through the right atrium and right ventricle, with its tip in the pulmonary artery. ${PAC_COMPONENT_PARTS.map(
    (part, index) => `${index + 1}, ${part.name.toLowerCase()}: ${part.where}. ${part.carries}`,
  ).join(' ')} The drawing is not to scale and gives no distances.`
  return (
    <figure className={styles.pacSchematic} data-pac-component-schematic>
      <div className={styles.pacSchematicScroll}>
        <div className={styles.pacSchematicDrawing}>
          <svg
            viewBox={`0 0 ${PAC_SCHEMATIC_VIEW.width} ${PAC_SCHEMATIC_VIEW.height}`}
            role="img"
            aria-label={description}
            preserveAspectRatio="xMidYMid meet"
          >
            <RightHeartOutline />
            <path
              className={styles.referenceAnatomyRoute}
              d={ROUTE_PATH}
              strokeDasharray={`${travelled.toFixed(1)} ${ROUTE_LENGTH}`}
            />
            <circle className={styles.referenceAnatomyBalloon} cx="207" cy="72" r="5" />
            <rect
              className={styles.pacSchematicThermistor}
              x="190"
              y="81"
              width="8"
              height="8"
              rx="2"
            />
            <circle className={styles.pacSchematicPort} cx="96" cy="84" r="4.5" />
            <circle className={styles.referenceAnatomyTip} cx={tip.x} cy={tip.y} r="5" />
            {/* Each number stands clear of the catheter and is joined to its part by a line. */}
            {PAC_COMPONENT_PARTS.map((part) => (
              <line
                key={part.id}
                className={styles.pacSchematicLeader}
                x1={part.point.x}
                y1={part.point.y}
                x2={part.mark.x}
                y2={part.mark.y}
              />
            ))}
          </svg>
          <div className={styles.pacSchematicLabels} aria-hidden="true">
            {PAC_CHAMBER_NAMES.map((chamber) => (
              <span
                key={chamber.name}
                className={styles.pacSchematicChamber}
                data-anchor={chamber.anchor}
                style={{
                  left: `${(chamber.x / PAC_SCHEMATIC_VIEW.width) * 100}%`,
                  top: `${(chamber.y / PAC_SCHEMATIC_VIEW.height) * 100}%`,
                }}
              >
                {chamber.name}
              </span>
            ))}
            {PAC_COMPONENT_PARTS.map((part, index) => (
              <span
                key={part.id}
                className={styles.pacSchematicMark}
                data-pac-part-mark={part.id}
                style={{
                  left: `${(part.mark.x / PAC_SCHEMATIC_VIEW.width) * 100}%`,
                  top: `${(part.mark.y / PAC_SCHEMATIC_VIEW.height) * 100}%`,
                }}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption>
        <strong>A pulmonary artery catheter (PAC), tip in the pulmonary artery</strong>
        <ol>
          {PAC_COMPONENT_PARTS.map((part) => (
            <li key={part.id} data-pac-part={part.id}>
              <b>{part.name}</b> — {part.where}. {part.carries}
            </li>
          ))}
        </ol>
        <span>
          A schematic, not to scale. Where each part sits along the catheter, and the balloon’s
          volume, belong to the particular catheter and its instructions for use; this drawing gives
          no distances.
        </span>
      </figcaption>
    </figure>
  )
}
