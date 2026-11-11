'use client'

import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import type { Vec3 } from '../geometry/coordinates'
import { cameraBasis, projectDirection } from '../geometry/reference-frames'
import { MATCH_AXIS_THRESHOLD } from '../engine/orientation-match'
import { lookKind } from '../geometry/route-stations'
import type { ProjectedOpening, ScopeOpening } from './ScopeCanvas'
import styles from './nav-bench.module.css'

const ScopeCanvas = dynamic(() => import('./ScopeCanvas').then((m) => m.ScopeCanvas), {
  ssr: false,
  loading: () => (
    <p className={styles.scopeNotice} role="status">
      Loading the scope view…
    </p>
  ),
})

export type OpeningTone = 'plain' | 'active' | 'done' | 'chosen' | 'declined'
export interface ScopeOpeningLabel extends ScopeOpening {
  /** The number shown on the opening. */
  text: string
  /** The airway's code, shown beside the number once the bench may name it. */
  caption?: string
  tone: OpeningTone
  ariaLabel: string
  /**
   * Set while this opening can be chosen: a click on its number takes it. The picture is one
   * image to a screen reader, so the task card's own buttons stay the keyboard's way to choose.
   */
  onPick?: () => void
  /** This opening is the one pointed at in another pane: lit here too. */
  hot?: boolean
  /** The pointer came onto, or left, this opening's number. */
  onHover?: (on: boolean) => void
  /**
   * Not an opening: where the lesion lies from the scope, beyond the airway wall. Drawn as a
   * dashed ring with its name, never as something the scope sees.
   */
  lesion?: boolean
}

/** The patient directions that lie across the scope's view, with where each sits on its rim. */
export interface CompassLetter {
  letter: string
  name: string
  /** 0–100 in the square view. */
  x: number
  y: number
}
const COMPASS_AXES: { positive: [string, string]; negative: [string, string]; vector: Vec3 }[] = [
  { positive: ['L', 'patient’s left'], negative: ['R', 'patient’s right'], vector: [1, 0, 0] },
  { positive: ['P', 'posterior'], negative: ['A', 'anterior'], vector: [0, 1, 0] },
  {
    positive: ['Head', 'toward the head'],
    negative: ['Feet', 'toward the feet'],
    vector: [0, 0, 1],
  },
]
/** How far from the centre of the view the letters sit, in view units. */
const COMPASS_RADIUS = 43
/** Letters nearer than this are moved apart along the rim. */
const COMPASS_CLEARANCE = 9

/**
 * The map's own words, past the segmental ostium: medial and lateral by the lung the route is in,
 * abbreviated so that L never means both left and lateral.
 */
function segmentalAxes(side: 'right' | 'left') {
  const medial: [string, string] = ['Med', 'medial'],
    lateral: [string, string] = ['Lat', 'lateral']
  return [
    {
      positive: side === 'right' ? medial : lateral,
      negative: side === 'right' ? lateral : medial,
      vector: [1, 0, 0] as Vec3,
    },
    {
      positive: ['Post', 'posterior'] as [string, string],
      negative: ['Ant', 'anterior'] as [string, string],
      vector: [0, 1, 0] as Vec3,
    },
    {
      positive: ['Sup', 'superior'] as [string, string],
      negative: ['Inf', 'inferior'] as [string, string],
      vector: [0, 0, 1] as Vec3,
    },
  ]
}

export function compassLetters(
  direction: Vec3,
  up: Vec3,
  level: boolean,
  segmental?: 'right' | 'left',
): CompassLetter[] {
  const basis = cameraBasis(direction, up)
  const letters: CompassLetter[] = []
  for (const axis of segmental ? segmentalAxes(segmental) : COMPASS_AXES) {
    const [x, y] = projectDirection(basis, axis.vector)
    const length = Math.hypot(x, y)
    // An axis that runs along the line of sight has no side on this screen.
    if (length < MATCH_AXIS_THRESHOLD) continue
    // Head and feet are shown only when the scope looks along the slice: looking down or up an
    // airway they are the direction of travel, not a side.
    if (axis.vector[2] && !level) continue
    const place = (sign: number, [letter, name]: [string, string]) =>
      letters.push({
        letter,
        name,
        x: 50 + (sign * x * COMPASS_RADIUS) / length,
        y: 50 + (sign * y * COMPASS_RADIUS) / length,
      })
    place(1, axis.positive)
    place(-1, axis.negative)
  }
  // Two directions that fall on the same part of the rim are set one above the other.
  for (let i = 0; i < letters.length; i++)
    for (let j = i + 1; j < letters.length; j++) {
      const a = letters[i],
        b = letters[j]
      if (Math.hypot(a.x - b.x, a.y - b.y) >= COMPASS_CLEARANCE) continue
      // Slide each along the rim, away from the other.
      const tangent = [-(a.y - 50), a.x - 50]
      const length = Math.hypot(tangent[0], tangent[1]) || 1
      const side = (b.x - a.x) * tangent[0] + (b.y - a.y) * tangent[1] >= 0 ? 1 : -1
      const shift = COMPASS_CLEARANCE / 2
      a.x -= (side * tangent[0] * shift) / length
      a.y -= (side * tangent[1] * shift) / length
      b.x += (side * tangent[0] * shift) / length
      b.y += (side * tangent[1] * shift) / length
    }
  return letters
}

export function ScopeView({
  position,
  direction,
  up,
  openings,
  moving,
  caption,
  phase,
  segmental,
  onReady,
  falloffMm,
}: {
  position: Vec3
  direction: Vec3
  up: Vec3
  openings: ScopeOpeningLabel[]
  moving: boolean
  caption: string
  phase: string
  /** Past the segmental ostium: the rim in the map's words, for this lung. */
  segmental?: 'right' | 'left'
  /** Told when the airway surface is drawn, and when it is lost. */
  onReady?: (ready: boolean) => void
  /** How far the scope's light carries here, in millimetres. */
  falloffMm?: number
}) {
  const [projected, setProjected] = useState<ProjectedOpening[]>([])
  const [ready, setReady] = useState(false)
  const reportReady = useCallback(
    (value: boolean) => {
      setReady(value)
      onReady?.(value)
    },
    [onReady],
  )
  // The canvas re-projects whenever this list changes identity, so it is rebuilt only when the
  // anchors themselves change, not on every render of the bench.
  const anchorKey = JSON.stringify(
    moving ? [] : openings.map(({ id, anchors: list }) => ({ id, anchors: list })),
  )
  const anchors = useMemo(() => JSON.parse(anchorKey) as ScopeOpening[], [anchorKey])
  const onProject = useCallback((results: ProjectedOpening[]) => setProjected(results), [])
  const compass = useMemo(
    () => compassLetters(direction, up, lookKind(direction) === 'level', segmental),
    [direction, up, segmental],
  )
  const placed = moving
    ? []
    : openings.flatMap((opening) => {
        const at = projected.find((p) => p.id === opening.id)
        return at ? [{ ...opening, ...at }] : []
      })
  return (
    <div
      className={styles.scopeSquare}
      data-scope-view
      data-scope-ready={ready}
      data-nav-phase={phase}
      data-scope-pose={`${position.map((v) => v.toFixed(2)).join(',')};${direction
        .map((v) => v.toFixed(3))
        .join(',')}`}
      data-scope-moving={moving || undefined}
    >
      <ScopeCanvas
        position={position}
        direction={direction}
        up={up}
        openings={anchors}
        onProject={onProject}
        onReady={reportReady}
        falloffMm={falloffMm}
      />
      <svg
        className={styles.scopeOverlay}
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${caption} ${
          compass.length
            ? `Patient directions in this view: ${compass
                .map((c) => `${c.name} ${sideWord(c.x, c.y)}`)
                .join(', ')}.`
            : ''
        }`}
      >
        {compass.map((entry) => (
          <text
            key={entry.letter}
            x={entry.x}
            y={entry.y}
            className={styles.compassLetter}
            textAnchor="middle"
            dominantBaseline="central"
            data-compass={entry.letter}
            data-compass-side={sideWord(entry.x, entry.y)}
          >
            {entry.letter}
          </text>
        ))}
        {ready &&
          placed.map((opening) =>
            opening.lesion ? (
              <g key={opening.id} data-scope-lesion aria-label={opening.ariaLabel}>
                <circle cx={opening.x} cy={opening.y} r="9" className={styles.scopeLesionRing} />
                <text
                  x={opening.x}
                  y={opening.y}
                  className={styles.scopeLesionName}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {opening.text}
                </text>
                {opening.caption && (
                  <text
                    x={opening.x}
                    y={opening.y + 12.4}
                    className={styles.scopeLesionNote}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {opening.caption}
                  </text>
                )}
              </g>
            ) : (
              <g
                key={opening.id}
                data-scope-opening={opening.text}
                data-opening-tone={opening.tone}
                data-opening-seen={opening.seen}
                data-opening-pick={opening.onPick ? true : undefined}
                data-opening-hot={opening.hot || undefined}
                className={
                  opening.onPick
                    ? styles.openingPick
                    : opening.onHover
                      ? styles.openingLive
                      : undefined
                }
                onClick={opening.onPick}
                onPointerEnter={opening.onHover ? () => opening.onHover!(true) : undefined}
                onPointerLeave={opening.onHover ? () => opening.onHover!(false) : undefined}
                aria-label={opening.ariaLabel}
              >
                {/* A wider target than the badge: an opening is chosen with one click on it. */}
                {opening.onPick && (
                  <circle cx={opening.x} cy={opening.y} r="7.5" className={styles.openingHit} />
                )}
                <circle
                  cx={opening.x}
                  cy={opening.y}
                  r="4.6"
                  className={styles.openingBadge}
                  strokeDasharray={opening.seen ? undefined : '1.2 1'}
                />
                <text
                  x={opening.x}
                  y={opening.y}
                  className={styles.openingNumber}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {opening.text}
                </text>
                {opening.caption && (
                  <text
                    x={opening.x}
                    y={opening.y + 8.2}
                    className={styles.openingCaption}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {opening.caption}
                  </text>
                )}
              </g>
            ),
          )}
      </svg>
    </div>
  )
}

/** "at the top", "on the right": where a rim position sits, in words. */
export function sideWord(x: number, y: number) {
  const dx = x - 50,
    dy = y - 50
  if (Math.abs(dx) >= Math.abs(dy) * 2) return dx > 0 ? 'on the right' : 'on the left'
  if (Math.abs(dy) >= Math.abs(dx) * 2) return dy > 0 ? 'at the bottom' : 'at the top'
  return `${dy > 0 ? 'lower' : 'upper'} ${dx > 0 ? 'right' : 'left'}`
}
