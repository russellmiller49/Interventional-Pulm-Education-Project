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
