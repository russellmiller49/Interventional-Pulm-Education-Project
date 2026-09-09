'use client'
import { useId } from 'react'
import { DEFAULT_GEOMETRY, type Point3, type ImagingGeometry } from '../../lib/physics'
import { projectionMarkers, suiteFrame } from './suiteModel'

/** Same projection and SVG coordinates as the existing ProjectionView overlay. */
export function ProjectionOverlays({
  orbit,
  tilt,
  depth,
  geometry = DEFAULT_GEOMETRY,
  showCurrent = true,
  targetFill = true,
  offset,
  toolFollows = true,
  showTool = true,
}: {
  orbit: number
  tilt: number
  depth: number
  geometry?: ImagingGeometry
  showCurrent?: boolean
  targetFill?: boolean
  offset?: Point3
  toolFollows?: boolean
  showTool?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const markers = projectionMarkers(suiteFrame(orbit, tilt, geometry), depth, offset, toolFollows)
  const screen = ([u, v]: readonly number[]) => [
    256 + (u / geometry.field) * 512,
    256 - (v / geometry.field) * 512,
  ]
  const target = screen(markers.targetRay.uv),
    tip = screen(markers.tipRay.uv),
    start = screen(markers.startRay.uv)
  const radius = (markers.radius / geometry.field) * 512
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" data-projection-overlay>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#e9ecdf" stopOpacity=".7" />
          <stop offset=".8" stopColor="#cad0c6" stopOpacity=".35" />
          <stop offset="1" stopColor="#becac4" stopOpacity="0" />
        </radialGradient>
      </defs>
      {showCurrent && (
        <>
          <circle
            cx={target[0]}
            cy={target[1]}
            r={radius}
            fill={targetFill ? `url(#${id})` : 'none'}
          />
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
        </>
      )}
      {showTool && (
        <g>
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
        </g>
      )}
    </svg>
  )
}
