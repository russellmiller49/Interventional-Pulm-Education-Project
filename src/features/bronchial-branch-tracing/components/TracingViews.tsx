'use client'

import { useId, useMemo, useState } from 'react'
import { childrenOf, openingPosition, OPENING_POSITIONS, viewConvention } from '../content/phantoms'
import type { Exercise, Phantom } from '../content/types'
import type { OpeningMap } from '../engine/session'
import {
  displayPoint,
  DISPLAY_PRESETS,
  type DisplayPreset,
  type Vec3,
} from '../geometry/coordinates'
import styles from './branch-tracing.module.css'

function samplePoints(points: Vec3[]): Vec3[] {
  return points.slice(1).flatMap((end, index) => {
    const start = points[index]
    const count = Math.ceil(Math.hypot(...end.map((v, i) => v - start[i])) * 2)
    return Array.from(
      { length: count + 1 },
      (_, n) => start.map((v, i) => v + ((end[i] - v) * n) / count) as Vec3,
    )
  })
}
export function AxialStack({
  exercise,
  onSelect,
  selected,
}: {
  exercise: Exercise
  onSelect?: (id: string) => void
  selected?: string | null
}) {
  const [slice, setSlice] = useState(exercise.phantom.initialSlice)
  const [preset, setPreset] = useState<DisplayPreset>('standard')
  const [zoom, setZoom] = useState(1)
  const phantom = exercise.phantom
  const sampled = useMemo(
    () => phantom.branches.map((b) => ({ ...b, samples: samplePoints(b.points) })),
    [phantom],
  )
  const axes = [
    { text: 'R', x: -36, y: 0 },
    { text: 'L', x: 36, y: 0 },
    { text: 'A', x: 0, y: -36 },
    { text: 'P', x: 0, y: 36 },
  ]
  const visible = sampled.map((b) => ({
    ...b,
    samples: b.samples.filter((p) => Math.abs(p[2] - slice) < b.radius),
  }))
  return (
    <section className={styles.view} aria-label="Axial tracing stack">
      <div className={styles.viewHeading}>
        <h2>Axial tracing stack</h2>
        <span>Synthetic airway</span>
      </div>
      <p className={styles.small}>{viewConvention(phantom)}</p>
      <svg
        className={styles.ct}
        viewBox="-40 -40 80 80"
        role={onSelect ? 'group' : 'img'}
        aria-label={`Axial phantom at ${slice} mm superior to its origin; ${DISPLAY_PRESETS[preset]}. R, L, A and P mark patient directions.`}
      >
        <defs>
          <clipPath id={`clip-${exercise.id}`}>
            <rect x="-39" y="-39" width="78" height="78" rx="3" />
          </clipPath>
        </defs>
        <rect x="-40" y="-40" width="80" height="80" fill="#080c12" />
        <g clipPath={`url(#clip-${exercise.id})`}>
          <circle r="33" fill="#50555a" />
          <circle r="30" fill="#34383d" />
          <g transform={`scale(${zoom})`}>
            {visible.map((b) => (
              <g
                key={b.id}
                role={onSelect && b.parentId ? 'button' : undefined}
                tabIndex={onSelect && b.parentId && b.samples.length ? 0 : undefined}
                aria-label={onSelect && b.parentId ? `Select lumen ${b.label}` : undefined}
                onClick={() => b.parentId && onSelect?.(b.id)}
                onKeyDown={(e) => {
                  if (b.parentId && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onSelect?.(b.id)
                  }
                }}
              >
                {b.samples.map((p, i) => {
                  const [x, y] = displayPoint([-p[0], -p[1]], preset)
                  const r = Math.sqrt(b.radius ** 2 - (p[2] - slice) ** 2)
                  return <circle key={i} cx={x} cy={y} r={r} fill="#07090d" />
                })}
                {b.parentId &&
                  b.samples.length > 0 &&
                  (() => {
                    const p = b.samples[Math.floor(b.samples.length * 0.8)]
                    const [x, y] = displayPoint([-p[0], -p[1]], preset)
                    return (
                      <g>
                        <circle
                          cx={x}
                          cy={y}
                          r="2.8"
                          fill={selected === b.id ? '#a5e9e7' : '#e8eced'}
                        />
                        <text
                          x={x}
                          y={y + 1.1}
                          fill="#102b32"
                          textAnchor="middle"
                          fontSize="3.1"
                          fontWeight="700"
                        >
                          {b.label}
                        </text>
                      </g>
                    )
                  })()}
              </g>
            ))}
          </g>
        </g>
        {axes.map((a) => {
          const [x, y] = displayPoint([a.x, a.y], preset)
          return (
            <text key={a.text} x={x} y={y + 1.2} fill="#e2e8e8" fontSize="3.5" textAnchor="middle">
              {a.text}
            </text>
          )
        })}
      </svg>
      <div className={styles.sliceControl}>
        <button
          aria-label="Previous axial plane"
          onClick={() => setSlice((s) => Math.max(phantom.sliceRange[0], s - 1))}
        >
          −
        </button>
        <label>
          Axial level: {slice} mm
          <input
            aria-label="Axial level"
            type="range"
            min={phantom.sliceRange[0]}
            max={phantom.sliceRange[1]}
            value={slice}
            onChange={(e) => setSlice(Number(e.target.value))}
          />
        </label>
        <button
          aria-label="Next axial plane"
          onClick={() => setSlice((s) => Math.min(phantom.sliceRange[1], s + 1))}
        >
          +
        </button>
      </div>
      <p className={styles.small}>
        Lower values are caudal; higher values are cranial. The origin and millimeters are authored
        for this phantom.
      </p>
      <details className={styles.options}>
        <summary>Display and text description</summary>
        <label>
          CT display
          <select value={preset} onChange={(e) => setPreset(e.target.value as DisplayPreset)}>
            {Object.entries(DISPLAY_PRESETS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zoom
          <input
            aria-label="Phantom zoom"
            type="range"
            min="1"
            max="2"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <p>
          The display preset changes only the screen. Patient axes and stored branch geometry remain
          fixed.
        </p>
        <p>
          Visible lumen at this level:{' '}
          {visible
            .filter((b) => b.samples.length)
            .map((b) => b.label)
            .join(', ') || 'none'}
          . Each label marks the same branch throughout the stack.
        </p>
        <ul>
          {childrenOf(phantom).map((b) => (
            <li key={b.id}>
              Branch {b.label}:{' '}
              {b.points
                .map((p) => `${p[0]} mm right, ${p[1]} mm anterior, ${p[2]} mm superior`)
                .join(' → ')}
              .
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

export function OpeningSketch({
  phantom,
  openings,
  reference = false,
}: {
  phantom: Phantom
  openings: OpeningMap
  reference?: boolean
}) {
  const gradientId = useId()
  return (
    <svg
      className={styles.sketch}
      viewBox="0 0 240 240"
      role="img"
      aria-label={
        reference
          ? 'Reference schematic opening arrangement for the stated camera pose'
          : 'Your opening arrangement'
      }
    >
      <defs>
        <radialGradient id={gradientId}>
          <stop stopColor="#7b494a" />
          <stop offset="0.85" stopColor="#d6a59b" />
          <stop offset="1" stopColor="#805357" />
        </radialGradient>
      </defs>
      <circle
        cx="120"
        cy="120"
        r="105"
        fill={reference ? `url(#${gradientId})` : '#0f252d'}
        stroke="#789a9f"
      />
      {OPENING_POSITIONS.map((position, i) => {
        const angle = (i * Math.PI) / 4
        return (
          <text
            key={position}
            x={120 + 94 * Math.sin(angle)}
            y={124 - 94 * Math.cos(angle)}
            textAnchor="middle"
            fontSize="11"
            fill={reference ? '#21191c' : '#a8bbbe'}
          >
            {position}
          </text>
        )
      })}
      {childrenOf(phantom).map((b) => {
        const position = reference ? openingPosition(phantom, b) : openings[b.id]
        if (!position) return null
        const angle = (OPENING_POSITIONS.indexOf(position) * Math.PI) / 4
        const x = 120 + 52 * Math.sin(angle),
          y = 120 - 52 * Math.cos(angle)
        return (
          <g key={b.id}>
            <ellipse
              cx={x}
              cy={y}
              rx="24"
              ry="22"
              fill="#081016"
              stroke={reference ? '#e0b9af' : '#a5e9e7'}
              strokeWidth="3"
            />
            <text x={x} y={y + 5} textAnchor="middle" fill="#eef4f4" fontSize="15">
              {b.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ExteriorSketch({ phantom }: { phantom: Phantom }) {
  const [azimuth, setAzimuth] = useState(25)
  const radians = (azimuth * Math.PI) / 180
  const project = (p: Vec3) => [
    120 + (p[0] * Math.cos(radians) + p[1] * Math.sin(radians)) * 2.2,
    120 - p[2] * 2.2 + (p[1] * Math.cos(radians) - p[0] * Math.sin(radians)) * 0.7,
  ]
  return (
    <div>
      <svg
        className={styles.sketch}
        viewBox="0 0 240 240"
        role="img"
        aria-label="Rotatable exterior schematic of the same airway phantom"
      >
        {phantom.branches.map((b) => (
          <g key={b.id}>
            <polyline
              points={b.points.map((p) => project(p).join(',')).join(' ')}
              fill="none"
              stroke="#b67e77"
              strokeWidth={b.radius * 3.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={b.points.map((p) => project(p).join(',')).join(' ')}
              fill="none"
              stroke="#e5b8a8"
              strokeWidth={b.radius * 1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {b.parentId && (
              <text
                x={project(b.points.at(-1)!)[0]}
                y={project(b.points.at(-1)!)[1]}
                textAnchor="middle"
                fill="#fff"
                fontSize="14"
              >
                {b.label}
              </text>
            )}
          </g>
        ))}
        <text x="15" y="24" fill="#a8bbbe" fontSize="12">
          Cranial ↑
        </text>
      </svg>
      <label>
        Rotate exterior view
        <input
          aria-label="Rotate exterior view"
          type="range"
          min="-180"
          max="180"
          value={azimuth}
          onChange={(e) => setAzimuth(Number(e.target.value))}
        />
      </label>
    </div>
  )
}
export function ReferenceComparison({ exercise }: { exercise: Exercise }) {
  const [view, setView] = useState<'opening' | 'exterior'>('opening')
  return (
    <section className={styles.view}>
      <h2>Reference comparison</h2>
      <div className={styles.tabs} role="group" aria-label="Reference view">
        <button aria-pressed={view === 'opening'} onClick={() => setView('opening')}>
          Parent view
        </button>
        <button aria-pressed={view === 'exterior'} onClick={() => setView('exterior')}>
          Exterior
        </button>
      </div>
      {view === 'opening' ? (
        <OpeningSketch phantom={exercise.phantom} openings={{}} reference />
      ) : (
        <ExteriorSketch phantom={exercise.phantom} />
      )}
      <p className={styles.small}>
        Schematic geometry · reference roll {exercise.phantom.camera.roll}°. Opening directions are
        authored from this phantom. This is not a bronchoscopic recording or a model of mucosal
        appearance.
      </p>
    </section>
  )
}
