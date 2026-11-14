'use client'
import { useContext, useId } from 'react'
import { ImagePolarityContext } from '../../lib/displayPolarity'
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
  // The nodule is denser than the lung around it: lighter on a bone-bright image, darker on a
  // bone-dark one. The lesion contour and the tool carry a dark edge so they read on light lung.
  const boneDark = useContext(ImagePolarityContext) === 'bone-dark'
  const fillStops = boneDark ? ['#1c2628', '#2a3537', '#36413f'] : ['#e9ecdf', '#cad0c6', '#becac4']
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
          <stop offset="0" stopColor={fillStops[0]} stopOpacity={boneDark ? '.45' : '.7'} />
          <stop offset=".8" stopColor={fillStops[1]} stopOpacity={boneDark ? '.22' : '.35'} />
          <stop offset="1" stopColor={fillStops[2]} stopOpacity="0" />
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
          {boneDark && (
            <circle
              cx={target[0]}
              cy={target[1]}
              r={radius + 5}
              fill="none"
              stroke="#04141a"
              strokeOpacity="0.6"
              strokeWidth="2.5"
            />
          )}
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
            stroke="#04141a"
            strokeOpacity="0.7"
            strokeWidth="5"
            strokeLinecap="round"
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
        </g>
      )}
    </svg>
  )
}
