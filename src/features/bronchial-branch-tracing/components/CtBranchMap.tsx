'use client'

import type { CtTrace, CtBranchChoice } from '../content/ct-types'
import { parentMap } from '../geometry/parent-map'
import styles from './branch-tracing.module.css'

export function CtParentMap({
  trace,
  active = 0,
  labels = true,
  ctLabels,
  choice = null,
  onChoose,
}: {
  trace: CtTrace
  active?: number
  labels?: boolean
  ctLabels?: string[]
  choice?: CtBranchChoice | null
  onChoose?: (value: CtBranchChoice) => void
}) {
  const map = parentMap(trace, active)
  if (!map) return null
  return (
    <figure className={styles.parentMap}>
      <figcaption>
        Looking distally from <strong>{map.parent}</strong> · fixed parent view
      </figcaption>
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Model direction schematic from ${map.parent}. Numbered daughters and projected patient R, A and S directions.`}
      >
        <circle cx="100" cy="100" r="82" fill="#07151b" stroke="#69838d" />
        {map.axes.map((a) => (
          <g key={a.label}>
            <path
              d={`M100 100 L${100 + a.point[0] * 85} ${100 + a.point[1] * 85}`}
              stroke="#536b73"
              strokeDasharray="2 3"
            />
            <text
              x={100 + a.point[0] * 92}
              y={100 + a.point[1] * 92}
              textAnchor="middle"
              fill="#a8bec8"
              fontSize="10"
            >
              {a.label}
            </text>
          </g>
        ))}
        {map.points.map((p) => (
          <g key={p.edgeId}>
            <path
              d={`M100 100 L${p.x} ${p.y}`}
              stroke={choice === p.edgeId ? '#81f1ed' : '#849da7'}
              strokeWidth={choice === p.edgeId ? 3 : 1}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="14"
              fill="#142f39"
              stroke={choice === p.edgeId ? '#81f1ed' : '#f6c66c'}
              strokeWidth="2"
            />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fill="white" fontSize="12">
              {p.number}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.mapChoices}>
        {map.points.map((p) =>
          onChoose ? (
            <button key={p.edgeId} onClick={() => onChoose(p.edgeId)}>
              Opening {p.number}
            </button>
          ) : (
            <p key={p.edgeId}>
              {p.number}
              {labels ? ` · ${ctLabels?.[p.sourceIndex] ?? p.label}` : ''}
              {choice === p.edgeId ? ' · your continuation' : ''}
            </p>
          ),
        )}
        {onChoose && <button onClick={() => onChoose('unresolved')}>Opening unresolved</button>}
      </div>
      <p className={styles.small}>
        R: patient right · A: anterior · S: superior. Projected model directions, not measured
        opening shapes. CT display rotation does not rotate this view.
      </p>
    </figure>
  )
}

export function CtProgressiveMap({
  trace,
  recorded,
  branches,
}: {
  trace: CtTrace
  recorded: boolean[]
  branches: (CtBranchChoice | null)[]
}) {
  return (
    <details className={styles.progressiveMap}>
      <summary>Your route map · {recorded.filter(Boolean).length} recorded stops</summary>
      <p>
        Each recorded division retains its siblings and your chosen continuation. Junctions follow
        the model route even if your choice differs.
      </p>
      {trace.checkpoints.map((p, i) =>
        recorded[i] && p.decision ? (
          <CtParentMap key={p.id} trace={trace} active={i} choice={branches[i]} />
        ) : null,
      )}
    </details>
  )
}
