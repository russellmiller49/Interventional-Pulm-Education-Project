'use client'

import { useId, useState } from 'react'

import {
  MCS_ECHO_CP_TARGET_DEPTH_CM,
  MCS_ECHO_CP_TOO_DEEP_BEYOND_CM,
  MCS_ECHO_FIGURE_STATES,
  MCS_ECHO_WORKED_INLET_DEPTH_CM,
  type McsEchoFigureStateId,
} from '../../content/impellaEchoPosition'
import styles from './mcs-echo-figure.module.css'

/**
 * The Impella CP on a parasternal long-axis view, drawn.
 *
 * Section 5 taught the position on echo in words alone: which view, what aligned looks like, how
 * deep, and two malpositions. This is the picture those words describe. It is a drawing, not an
 * echo image: the chambers are outlines in the layout the view gives (right ventricle nearest the
 * probe, left ventricle to the left, aortic root to the right, left atrium behind it), and the
 * pump is drawn across the aortic valve in one of three positions the learner switches between.
 *
 * Only the inlet depth is drawn to scale, against a ruler from the annulus: the target and the
 * too-deep limit are the register's, and the too-deep example is the worked example's own depth.
 * The pump's own lengths are not to scale, and the drawing gives no other distance.
 */

/** Pixels per centimetre along the pump. */
const SCALE = 30
/** The middle of the aortic valve annulus. */
const ANNULUS = { x: 285, y: 192 }
/** Unit directions from the annulus: into the ventricle toward the apex, and up the aorta. */
const INTO_VENTRICLE = { x: -0.983, y: 0.183 }
const UP_THE_AORTA = { x: 0.999, y: -0.041 }
/** The drawn distance from inlet to outlet; chosen so the too-deep example puts the outlet at the valve. */
const INLET_TO_OUTLET_CM = MCS_ECHO_WORKED_INLET_DEPTH_CM
const PIGTAIL_BEYOND_INLET_CM = 1.2

/** A point on the pump's course: `depthCm` below the annulus when positive, above it when negative. */
function onCourse(depthCm: number): { x: number; y: number } {
  const direction = depthCm >= 0 ? INTO_VENTRICLE : UP_THE_AORTA
  const distance = Math.abs(depthCm) * SCALE
  return { x: ANNULUS.x + direction.x * distance, y: ANNULUS.y + direction.y * distance }
}

const INLET_DEPTH_CM: Readonly<Record<McsEchoFigureStateId, number>> = {
  aligned: MCS_ECHO_CP_TARGET_DEPTH_CM,
  'too-deep': MCS_ECHO_WORKED_INLET_DEPTH_CM,
  'inlet-in-aorta': -0.5,
}

function course(fromCm: number, toCm: number): string {
  const points = [onCourse(fromCm)]
  // The course bends at the annulus, so a span that crosses it passes through that point.
  if (fromCm * toCm < 0) points.push(ANNULUS)
  points.push(onCourse(toCm))
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')
}

const MOSAIC = [
  [0, 0, '#ff5a5f'],
  [9, -6, '#ffd166'],
  [-8, 7, '#4cc9f0'],
  [14, 6, '#80ed99'],
  [-13, -5, '#ffd166'],
  [4, 12, '#ff5a5f'],
  [20, -3, '#4cc9f0'],
  [-3, -12, '#80ed99'],
] as const

export function McsEchoLongAxisFigure() {
  const [stateId, setStateId] = useState<McsEchoFigureStateId>('aligned')
  const clipId = useId()
  const titleId = useId()
  const descId = useId()
  const active = MCS_ECHO_FIGURE_STATES.find((state) => state.id === stateId)!
  const inletCm = INLET_DEPTH_CM[stateId]
  const outletCm = inletCm - INLET_TO_OUTLET_CM
  const inlet = onCourse(inletCm)
  // An outlet high in the aorta is past the edge of the view; it is drawn at the edge.
  const outlet = onCourse(Math.max(outletCm, -3.6))
  const pigtail = onCourse(inletCm + PIGTAIL_BEYOND_INLET_CM)
  // The color mosaic sits at the outlet: above the valve when aligned, below it when too deep.
  const mosaic = onCourse(outletCm >= 0 ? outletCm + 0.9 : Math.max(outletCm - 0.9, -2.7))
  const ruled = inletCm > 0
  // The ruler runs beside the pump on its septal side, where the cavity is clear of the leaflets.
  const rulerOffset = { x: -0.183 * 22, y: -0.983 * 22 }
  const rulerStart = { x: ANNULUS.x + rulerOffset.x, y: ANNULUS.y + rulerOffset.y }
  const rulerEnd = { x: inlet.x + rulerOffset.x, y: inlet.y + rulerOffset.y }
  const limit = onCourse(MCS_ECHO_CP_TOO_DEEP_BEYOND_CM)
  const rulerLimit = { x: limit.x + rulerOffset.x, y: limit.y + rulerOffset.y }

  return (
    <figure className={styles.figure} data-echo-figure data-echo-state={stateId}>
      <div className={styles.states} role="group" aria-label="Pump position shown in the drawing">
        {MCS_ECHO_FIGURE_STATES.map((state) => (
          <button
            key={state.id}
            type="button"
            aria-pressed={state.id === stateId}
            onClick={() => setStateId(state.id)}
            data-echo-state-button={state.id}
          >
            {state.label}
          </button>
        ))}
      </div>
      <svg
        viewBox="0 0 480 344"
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className={styles.drawing}
      >
        {/* One string: a title with two text children does not hydrate cleanly. */}
        <title id={titleId}>{`Impella CP on a parasternal long-axis view: ${active.label}`}</title>
        <desc id={descId}>{active.reading}</desc>
        <defs>
          <clipPath id={clipId}>
            <path d="M240 6 L12 236 A322 322 0 0 0 468 236 Z" />
          </clipPath>
        </defs>
        <path d="M240 6 L12 236 A322 322 0 0 0 468 236 Z" className={styles.sector} />
        <g clipPath={`url(#${clipId})`}>
          {/* Right ventricle, nearest the probe. */}
          <path d="M150 92 Q226 56 300 92 Q232 120 150 92 Z" className={styles.chamber} />
          {/* Septum, continuous with the anterior wall of the aorta. */}
          <path d="M40 112 Q180 128 285 170 L440 158" className={styles.wall} />
          {/* Posterior wall of the ventricle, and the back of the left atrium. */}
          <path d="M40 300 Q170 292 272 262" className={styles.wall} />
          <path d="M272 262 Q300 318 372 314 Q448 304 452 236" className={styles.wall} />
          {/* Posterior wall of the aorta, which is the roof of the left atrium. */}
          <path d="M285 215 L448 206" className={styles.wall} />
          {/* Aortic valve cusps at the annulus. */}
          <path
            d="M285 170 Q301 184 300 192 M285 215 Q301 200 300 192"
            className={styles.leaflet}
          />
          {/* Mitral leaflets: the anterior one hangs from the aortic root. */}
          <path
            d="M285 215 Q262 236 236 250 M272 262 Q254 260 240 255"
            className={styles.leaflet}
          />
          <line x1={ANNULUS.x} y1="166" x2={ANNULUS.x} y2="219" className={styles.annulus} />

          {/* The pump: catheter from the aorta, cannula from outlet to inlet, pigtail beyond. */}
          <path d={course(-6, outletCm)} className={styles.catheter} />
          <path d={course(outletCm, inletCm)} className={styles.cannula} />
          <path
            d={`M${inlet.x.toFixed(1)} ${inlet.y.toFixed(1)} L${pigtail.x.toFixed(1)} ${pigtail.y.toFixed(1)} q-9 4 -8 -7 q4 -8 10 -1`}
            className={styles.pigtail}
          />
          <g data-echo-mosaic>
            {MOSAIC.map(([dx, dy, fill]) => (
              <circle key={`${dx}-${dy}`} cx={mosaic.x + dx} cy={mosaic.y + dy} r="4" fill={fill} />
            ))}
          </g>
          <circle cx={outlet.x} cy={outlet.y} r="6" className={styles.outlet} data-echo-outlet />
          <circle cx={inlet.x} cy={inlet.y} r="6" className={styles.inlet} data-echo-inlet />

          {ruled ? (
            <g data-echo-ruler>
              <line
                x1={rulerStart.x}
                y1={rulerStart.y}
                x2={rulerEnd.x}
                y2={rulerEnd.y}
                className={styles.ruler}
              />
              <line
                x1={ANNULUS.x}
                y1={ANNULUS.y}
                x2={rulerStart.x}
                y2={rulerStart.y}
                className={styles.rulerTick}
              />
              <line
                x1={inlet.x}
                y1={inlet.y}
                x2={rulerEnd.x}
                y2={rulerEnd.y}
                className={styles.rulerTick}
              />
              {stateId === 'too-deep' ? (
                <line
                  x1={limit.x + rulerOffset.x * 0.55}
                  y1={limit.y + rulerOffset.y * 0.55}
                  x2={rulerLimit.x + rulerOffset.x * 0.45}
                  y2={rulerLimit.y + rulerOffset.y * 0.45}
                  className={styles.rulerLimit}
                  data-echo-limit
                />
              ) : null}
            </g>
          ) : null}
        </g>

        {/* Labels sit outside the clip so none is cut by the sector's edge. */}
        <text x="226" y="94" className={styles.label} textAnchor="middle">
          RV
        </text>
        <text x="84" y="270" className={styles.label} textAnchor="middle">
          LV
        </text>
        {/* Beside the root, just outside the sector, so it never sits on the pump. */}
        <text x="396" y="172" className={styles.label}>
          Aorta
        </text>
        <text x="352" y="272" className={styles.label} textAnchor="middle">
          LA
        </text>
        <text x={ANNULUS.x + 4} y="152" className={styles.note} textAnchor="middle">
          Annulus
        </text>
        <text
          x={ruled ? inlet.x : inlet.x + 18}
          y={ruled ? inlet.y + 24 : inlet.y - 14}
          className={styles.inletLabel}
          textAnchor="middle"
        >
          Inlet
        </text>
        <text
          x={outlet.x + (stateId === 'too-deep' ? 14 : 4)}
          y={outlet.y - 12}
          className={styles.outletLabel}
          textAnchor={stateId === 'too-deep' ? 'start' : 'end'}
        >
          Outlet
        </text>
        {/* The depth in words, in the corner the sector leaves empty. */}
        <text x="10" y="24" className={styles.depth} data-echo-depth>
          {ruled
            ? `Inlet ${inletCm} cm below the annulus${
                stateId === 'too-deep' ? ` · limit ${MCS_ECHO_CP_TOO_DEEP_BEYOND_CM} cm` : ''
              }`
            : 'Inlet above the valve'}
        </text>
      </svg>
      <figcaption>
        <p role="status" data-echo-reading>
          <strong>{active.label}.</strong> {active.reading}
        </p>
        <p className={styles.key}>
          <span data-key="inlet" /> Inlet <span data-key="outlet" /> Outlet{' '}
          <span data-key="mosaic" /> Color Doppler mosaic
        </p>
        <p className={styles.caption}>
          A drawing of the view, not an echo image. Only the inlet depth is to scale, ruled from the
          annulus.
        </p>
      </figcaption>
    </figure>
  )
}
