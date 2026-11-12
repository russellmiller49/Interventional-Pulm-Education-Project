'use client'
import { useMemo } from 'react'
import {
  AIRWAY_BRANCHES,
  AIRWAY_LOBE_KEYS,
  lobeOfSegments,
  type AirwayBranchKey,
} from '../../content/airwayNames'
import {
  AIRWAY_LOBE_COLORS,
  AIRWAY_SEGMENTS_BY_LOBE,
  AIRWAY_TREE,
  airwayColor,
  airwayLabelAnchor,
  airwayLegend,
  airwayStem,
  isAirwayLobeShow,
  lesionOutlineRadius,
  type AirwayShow,
} from '../../lib/airwayTree'
import {
  DEFAULT_GEOMETRY,
  LESION_CENTER,
  magnificationAt,
  type ImagingGeometry,
  type Point3,
} from '../../lib/physics'
import { add, dot, rayThrough, subtract, suiteFrame, type SuiteFrame } from './suiteModel'

/**
 * The bronchial tree of the course CT drawn on the projection, through the same cone geometry as
 * the image under it.
 *
 * Fluoroscopy does not show a bronchus beyond the central airways: air in a bronchus has no
 * contrast against the air in the lung round it. This drawing comes from the CT, the way a
 * registered overlay would, and the legend under the image says so. `show` is the learner's
 * choice: the whole tree coloured by lobe, one lobe with a colour and a name per segment, or the
 * segmental bronchi that cross the nodule's outline on the frontal image.
 */
const VIEW = 512
/** The length of bronchus drawn as its stem; the readout measures the same two centimetres. */
export const AIRWAY_STEM_MM = 20

function screenOf(frame: SuiteFrame, point: Point3): [number, number] {
  const [u, v] = rayThrough(frame, point).uv
  return [
    VIEW / 2 + (u / frame.geometry.field) * VIEW,
    VIEW / 2 - (v / frame.geometry.field) * VIEW,
  ]
}

interface Stroke {
  readonly key: AirwayBranchKey
  readonly color: string
  readonly width: number
  readonly dim: boolean
  d: string
}

export interface AirwayLabel {
  readonly key: string
  readonly text: string
  readonly color: string
  x: number
  y: number
}

/** Type size in image units: the monitor is often drawn at half this size on screen. */
const LABEL_SIZE = 21

/** The labels a setting draws, in image coordinates, nudged apart where two would overprint. */
export function airwayLabels(frame: SuiteFrame, show: AirwayShow, offset: Point3): AirwayLabel[] {
  if (show === 'off') return []
  const at = (point: Point3) => screenOf(frame, add(point, offset))
  const labels: AirwayLabel[] = []
  /** `distance` further from `from`, so a name sits beyond the bronchi it names, not on them. */
  const beyond = (point: [number, number], from: [number, number], distance: number) => {
    const dx = point[0] - from[0],
      dy = point[1] - from[1]
    const length = Math.hypot(dx, dy) || 1
    return [point[0] + (dx / length) * distance, point[1] + (dy / length) * distance]
  }
  if (show === 'all') {
    const carina = at(airwayLabelAnchor('trachea'))
    const [tx, ty] = carina
    labels.push({ key: 'trachea', text: 'Trachea', color: '#f3f7f4', x: tx - 52, y: ty })
    for (const [key, dx, dy] of [
      ['RMB', -6, -16],
      ['LMB', 8, -16],
      ['BI', 30, 10],
    ] as const) {
      const [x, y] = at(airwayLabelAnchor(key))
      labels.push({ key, text: AIRWAY_BRANCHES[key].short, color: '#f3f7f4', x: x + dx, y: y + dy })
    }
    const hilum = at(airwayLabelAnchor('RMB'))
    const centre: [number, number] = [VIEW / 2, hilum[1]]
    for (const lobe of AIRWAY_LOBE_KEYS) {
      // A lobe is named out in its own lung, beyond where its segmental bronchi end.
      const ends = AIRWAY_SEGMENTS_BY_LOBE[lobe].map((segment) => at(airwayLabelAnchor(segment)))
      const middle: [number, number] = [
        ends.reduce((sum, end) => sum + end[0], 0) / ends.length,
        ends.reduce((sum, end) => sum + end[1], 0) / ends.length,
      ]
      const [x, y] = beyond(middle, centre, 26)
      labels.push({ key: lobe, text: lobe, color: AIRWAY_LOBE_COLORS[lobe], x, y })
    }
  } else {
    for (const entry of airwayLegend(show)) {
      const key = entry.key as AirwayBranchKey
      // Each name sits beyond the far end of its bronchus, on the line from where its lobe begins.
      const parent = isAirwayLobeShow(show) ? `${show}-bronchus` : lobeOfSegments([key])
      const origin = at(airwayLabelAnchor(parent as AirwayBranchKey))
      const end = at(airwayLabelAnchor(key))
      const [x, y] = beyond(end, origin, 16)
      labels.push({ key: entry.key, text: entry.label, color: entry.color, x, y })
    }
  }
  if (show === 'lesion') {
    // These bronchi end at the nodule, so their names would sit on it. Each is moved straight out
    // from the nodule until it is clear of the outline the learner is reading.
    const [cx, cy] = at(LESION_CENTER)
    const clear = lesionRing(frame).radius + LABEL_SIZE * 2
    for (const label of labels) {
      const dx = label.x - cx,
        dy = label.y - cy
      const from = Math.hypot(dx, dy)
      if (from >= clear) continue
      // A name exactly on the centre has no direction of its own: it goes out to the side.
      const [ux, uy] = from > 1 ? [dx / from, dy / from] : [1, 0]
      label.x = cx + ux * clear
      label.y = cy + uy * clear
    }
  }
  // Keep every label on the image, then separate any two that would sit on one another.
  const halfWidth = (label: AirwayLabel) => (label.text.length * LABEL_SIZE * 0.56) / 2
  for (const label of labels) {
    label.x = Math.min(VIEW - halfWidth(label) - 4, Math.max(halfWidth(label) + 4, label.x))
    label.y = Math.min(VIEW - 8, Math.max(LABEL_SIZE, label.y))
  }
  labels.sort((a, b) => a.y - b.y)
  for (let i = 1; i < labels.length; i++)
    for (let j = 0; j < i; j++)
      if (
        Math.abs(labels[i].x - labels[j].x) < halfWidth(labels[i]) + halfWidth(labels[j]) + 4 &&
        Math.abs(labels[i].y - labels[j].y) < LABEL_SIZE + 2
      )
        labels[i].y = labels[j].y + LABEL_SIZE + 2
  return labels
}

/** The nodule's outline in image units, as the projection overlay draws it. */
function lesionRing(frame: SuiteFrame) {
  return {
    radius: (lesionOutlineRadius(frame.orbit, frame.tilt) / frame.geometry.field) * VIEW + 5,
  }
}

export function AirwayOverlay({
  orbit,
  tilt,
  geometry = DEFAULT_GEOMETRY,
  show,
  names = true,
  offset = [0, 0, 0],
}: {
  orbit: number
  tilt: number
  geometry?: ImagingGeometry
  show: AirwayShow
  /** Print the names beside the bronchi. Off, the colours are still there to be named. */
  names?: boolean
  offset?: Point3
}) {
  const drawing = useMemo(() => {
    if (show === 'off') return null
    const frame = suiteFrame(orbit, tilt, geometry)
    const strokes = new Map<string, Stroke>()
    for (const branch of AIRWAY_TREE) {
      const color = airwayColor(branch, show)
      const middle = add(branch.points[Math.floor(branch.points.length / 2)], offset)
      const magnification = magnificationAt(
        dot(subtract(middle, frame.iso), frame.normal),
        frame.geometry,
      )
      // The drawn width is the lumen's, to scale; hairlines are kept visible.
      const width =
        Math.round(
          Math.max(1.1, ((2 * branch.radiusMm * magnification) / geometry.field) * VIEW) * 2,
        ) / 2
      const id = `${branch.key}:${width}`
      let stroke = strokes.get(id)
      if (!stroke)
        strokes.set(
          id,
          (stroke = { key: branch.key, color: color ?? '#c9d6d2', width, dim: !color, d: '' }),
        )
      stroke.d += branch.points
        .map((point, index) => {
          const [x, y] = screenOf(frame, add(point, offset))
          return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join('')
    }
    // With one lobe drawn, the first two centimetres of each segmental bronchus are drawn heavier:
    // that is the stem whose length the image shows or hides, and what the readout measures.
    const stems = !isAirwayLobeShow(show)
      ? []
      : airwayLegend(show).map((entry) => {
          const points = airwayStem(entry.key as AirwayBranchKey, AIRWAY_STEM_MM).map((point) =>
            screenOf(frame, add(point, offset)),
          )
          return {
            key: entry.key,
            color: entry.color,
            origin: points[0],
            d: points
              .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
              .join(''),
          }
        })
    return {
      strokes: [...strokes.values()].sort((a, b) => Number(b.dim) - Number(a.dim)),
      stems,
      // With the bronchi over the nodule drawn, the outline is redrawn above them: what crosses it
      // is the thing being read.
      ring:
        show === 'lesion'
          ? { centre: screenOf(frame, add(LESION_CENTER, offset)), ...lesionRing(frame) }
          : null,
      labels: names ? airwayLabels(frame, show, offset) : [],
    }
  }, [orbit, tilt, geometry, show, names, offset])
  if (!drawing) return null
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      aria-hidden="true"
      data-airway-overlay
      data-airway-show={show}
      data-airway-names={names}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {drawing.strokes.map((stroke) => (
          <path
            key={`${stroke.key}:${stroke.width}`}
            data-airway-key={stroke.key}
            data-airway-dim={stroke.dim || undefined}
            d={stroke.d}
            stroke={stroke.color}
            strokeWidth={stroke.dim ? Math.min(stroke.width, 2.5) : stroke.width}
            strokeOpacity={
              stroke.dim ? 0.22 : show === 'all' ? 0.62 : show === 'lesion' ? 0.8 : 0.5
            }
          />
        ))}
        {drawing.ring && (
          <g data-airway-lesion-ring>
            <circle
              cx={drawing.ring.centre[0]}
              cy={drawing.ring.centre[1]}
              r={drawing.ring.radius}
              stroke="#04141a"
              strokeWidth="4.5"
            />
            <circle
              cx={drawing.ring.centre[0]}
              cy={drawing.ring.centre[1]}
              r={drawing.ring.radius}
              stroke="#eec482"
              strokeWidth="2"
            />
          </g>
        )}
        {drawing.stems.map((stem) => (
          <g key={stem.key} data-airway-stem={stem.key}>
            <path d={stem.d} stroke="#04141a" strokeWidth="8.5" />
            <path d={stem.d} stroke={stem.color} strokeWidth="5.5" />
            <circle
              cx={stem.origin[0]}
              cy={stem.origin[1]}
              r="4.5"
              fill="#f3f7f4"
              stroke="#04141a"
            />
          </g>
        ))}
      </g>
      {drawing.labels.map((label) => (
        <text
          key={label.key}
          data-airway-label={label.key}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          fontSize={LABEL_SIZE}
          fontWeight="600"
          fill={label.color}
          stroke="#04141a"
          strokeWidth="4.5"
          paintOrder="stroke"
        >
          {label.text}
        </text>
      ))}
    </svg>
  )
}
