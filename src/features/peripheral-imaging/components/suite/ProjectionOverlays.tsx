'use client'

import { useId } from 'react'
import {
  DETECTOR_FIELD,
  DETECTOR_DISTANCE,
  SOURCE_DISTANCE,
  LESION_CENTER,
  LESION_RADIUS,
  beamDirection,
  projectToDetector,
  toolTipForDepth,
  type Point3,
} from '../../lib/physics'

/** Same projection and SVG coordinates as the existing ProjectionView overlay. */
export function ProjectionOverlays({
  orbit,
  tilt,
  depth,
}: {
  orbit: number
  tilt: number
  depth: number
}) {
  const id = useId().replace(/:/g, '')
  const screen = (p: Point3) => {
    const [u, v] = projectToDetector(p, orbit, tilt)
    return [256 + (u / DETECTOR_FIELD) * 512, 256 - (v / DETECTOR_FIELD) * 512]
  }
  const target = screen(LESION_CENTER),
    tipWorld = toolTipForDepth(depth),
    tip = screen(tipWorld)
  const start = screen([tipWorld[0] - 65, tipWorld[1], tipWorld[2]])
  const normal = beamDirection(orbit, tilt)
  const radius =
    (((LESION_RADIUS * DETECTOR_DISTANCE) /
      (SOURCE_DISTANCE + LESION_CENTER.reduce((sum, n, i) => sum + n * normal[i], 0))) *
      512) /
    DETECTOR_FIELD
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" data-projection-overlay>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#e9ecdf" stopOpacity=".7" />
          <stop offset=".8" stopColor="#cad0c6" stopOpacity=".35" />
          <stop offset="1" stopColor="#becac4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={target[0]} cy={target[1]} r={radius} fill={`url(#${id})`} />
      <circle
        data-target-overlay
        cx={target[0]}
        cy={target[1]}
        r={radius + 5}
        fill="none"
        stroke="#eec482"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <line
        x1={start[0]}
        y1={start[1]}
        x2={tip[0]}
        y2={tip[1]}
        stroke="#f5f7f1"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        data-tip-overlay
        d={`M${tip[0] - 3},${tip[1] - 3}l6,6m-6,0l6,-6`}
        stroke="#fff"
        strokeWidth="1.25"
      />
    </svg>
  )
}
