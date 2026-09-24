'use client'

import { useId } from 'react'

import type { CaseFigureDeclaration } from '../../content/caseFigures'
import styles from './figures.module.css'

/**
 * Where the positions are, in plan-view drawing units. Position 2 is farther along the table's long
 * axis on the tube side, at the same distance from the table's edge as position 1, as the owner
 * confirmed (OD4-12, 2026-09-22) and the case's own choice and rationale imply. Position 3 is across
 * the table, the same distance from the far edge.
 */
export const STANDING_PLAN = {
  table: { x: 50, y: 92, width: 260, height: 56 },
  tube: { x: 170, y: 156, width: 44, height: 22 },
  detector: { x: 160, y: 58, width: 64, height: 20 },
  /** Distance from the table edge to every position, the same for all three. */
  standoff: 52,
  positions: [
    { id: 1, x: 232, side: 'near', text: 'beside the tube housing' },
    { id: 2, x: 292, side: 'near', text: 'farther along the table, tube side' },
    { id: 3, x: 232, side: 'far', text: 'across, on the detector side' },
  ],
} as const

export function standingPositionY(side: 'near' | 'far'): number {
  const { table, standoff } = STANDING_PLAN
  return side === 'near' ? table.y + table.height + standoff : table.y - standoff
}

/**
 * Practice case 15's floor plan (brief E, OD4-12): a reading aid for a case that already states its
 * geometry. It draws sides and positions only — no numbers, no colour scale, no contours — so it
 * cannot be read as staff dosimetry. The one exposure statement the brief allows is the section's
 * qualitative sentence, and because it answers the question it waits for the explanation.
 */
export function StandingPositionsPlan({
  declaration,
  revealed,
}: {
  readonly declaration: CaseFigureDeclaration
  readonly revealed: boolean
}) {
  const { table, tube, detector, positions } = STANDING_PLAN
  const arrowId = `${useId().replace(/:/g, '')}-beam`
  const beamX = tube.x + tube.width / 2
  const nearRail = standingPositionY('near')
  const farRail = standingPositionY('far')
  return (
    <figure
      className={styles.figure}
      data-case-figure={declaration.identity}
      data-case-figure-evidence={declaration.evidence}
      data-case-figure-medium={declaration.medium}
      data-figure-state="ready"
      data-figure-revealed={revealed ? 'true' : 'false'}
    >
      <p className={styles.modelLabel} data-model-label>
        {declaration.label}
      </p>
      <svg
        viewBox="0 0 360 250"
        className={`${styles.svgFigure} ${styles.planSvg}`}
        role="img"
        aria-label="Top-down schematic of the room. The patient lies on the table. The X-ray tube is on the near side and the detector on the far side, with the primary beam crossing the patient from tube to detector. Position 1 is beside the tube housing, position 2 is farther along the table on the tube side, and position 3 is across on the detector side. All three are about the same distance from the table."
        data-standing-plan
      >
        <text x="8" y="16" fill="#9fb6bb" fontSize="11">
          Far side
        </text>
        <text x="8" y="244" fill="#9fb6bb" fontSize="11">
          Near side
        </text>
        {/* Table and patient */}
        <rect
          x={table.x}
          y={table.y}
          width={table.width}
          height={table.height}
          rx="6"
          fill="#1b3139"
          stroke="#6f8e96"
        />
        <text x={table.x + 6} y={table.y + table.height - 6} fill="#9fb6bb" fontSize="10">
          Table
        </text>
        <rect
          x={table.x + 30}
          y={table.y + 12}
          width={table.width - 70}
          height={table.height - 24}
          rx="14"
          fill="#2c4a52"
          stroke="#a9c3c8"
        />
        <circle
          cx={table.x + table.width - 26}
          cy={table.y + table.height / 2}
          r="11"
          fill="#2c4a52"
          stroke="#a9c3c8"
        />
        <text x={table.x + 40} y={table.y + table.height / 2 - 2} fill="#e2eef0" fontSize="10">
          Patient
        </text>
        <text x={table.x + 40} y={table.y + table.height / 2 + 9} fill="#c9dcdf" fontSize="8.5">
          the principal source of scatter
        </text>
        {/* Tube (near) and detector (far) */}
        <rect
          x={tube.x}
          y={tube.y}
          width={tube.width}
          height={tube.height}
          rx="3"
          fill="#3a2f1d"
          stroke="#e9b66e"
        />
        <text x={tube.x + tube.width + 6} y={tube.y + 15} fill="#f0cf9c" fontSize="10">
          X-ray tube
        </text>
        <rect
          x={detector.x}
          y={detector.y}
          width={detector.width}
          height={detector.height}
          rx="3"
          fill="#18343b"
          stroke="#77dccf"
        />
        <text x={detector.x + detector.width + 6} y={detector.y + 14} fill="#b8efe7" fontSize="10">
          Detector
        </text>
        {/* Primary beam: tube to detector, across the patient */}
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="#e9b66e" />
          </marker>
        </defs>
        <line
          x1={beamX}
          y1={tube.y}
          x2={beamX}
          y2={detector.y + detector.height + 2}
          stroke="#e9b66e"
          strokeWidth="2"
          markerEnd={`url(#${arrowId})`}
        />
        <text x={beamX + 6} y={table.y - 6} fill="#f0cf9c" fontSize="10">
          primary beam
        </text>
        {/* The same distance from the table for every position */}
        <line
          x1={table.x}
          y1={nearRail}
          x2={table.x + table.width}
          y2={nearRail}
          stroke="#5f7c84"
          strokeDasharray="3 4"
        />
        <line
          x1={table.x}
          y1={farRail}
          x2={table.x + table.width}
          y2={farRail}
          stroke="#5f7c84"
          strokeDasharray="3 4"
        />
        {positions.map((position) => {
          const y = standingPositionY(position.side)
          return (
            <g key={position.id} data-standing-position={position.id} data-side={position.side}>
              <circle
                cx={position.x}
                cy={y}
                r="11"
                fill="#0d1b20"
                stroke="#e2eef0"
                strokeWidth="1.5"
              />
              <text
                x={position.x}
                y={y + 4}
                textAnchor="middle"
                fill="#e2eef0"
                fontSize="12"
                fontWeight="700"
              >
                {position.id}
              </text>
            </g>
          )
        })}
      </svg>
      <ul className={styles.note} data-standing-legend>
        {positions.map((position) => (
          <li key={position.id} data-standing-legend-entry={position.id}>
            <strong>{position.id}</strong> · {position.text}
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        The dashed lines are the same distance from the table on both sides. The plan shows sides
        and positions only; the room survey and the radiation safety officer set verified positions.
      </p>
      {revealed ? (
        <dl className={styles.readouts} data-case-figure-readouts>
          <dt>What the course teaches about the sides</dt>
          <dd>
            In lateral projections, positions on the detector side often receive less than the
            beam-entrance (tube) side. This plan is not a scatter measurement.
          </dd>
        </dl>
      ) : null}
    </figure>
  )
}
