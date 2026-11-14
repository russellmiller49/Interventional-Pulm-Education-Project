'use client'
import { useMemo } from 'react'
import { DEFAULT_GEOMETRY, type ImagingGeometry, type Point3 } from '../../lib/physics'
import { add, rayThrough, suiteFrame } from './suiteModel'

/**
 * A catheter lying in the airways, drawn on the projection through the same cone geometry as the
 * image under it: a white line from the trachea to its tip, and a mark on the tip.
 *
 * Only the catheter is drawn. Which bronchus it is in is for the learner to work out, so nothing
 * here names it or says how deep it lies.
 */
const VIEW = 512

export function CatheterOverlay({
  orbit,
  tilt,
  geometry = DEFAULT_GEOMETRY,
  path,
  offset = [0, 0, 0],
}: {
  orbit: number
  tilt: number
  geometry?: ImagingGeometry
  path: readonly Point3[]
  offset?: Point3
}) {
  const drawing = useMemo(() => {
    const frame = suiteFrame(orbit, tilt, geometry)
    const points = path.map((point) => {
      const [u, v] = rayThrough(frame, add(point, offset)).uv
      return [VIEW / 2 + (u / geometry.field) * VIEW, VIEW / 2 - (v / geometry.field) * VIEW]
    })
    return {
      d: points
        .map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`)
        .join(''),
      tip: points[points.length - 1],
    }
  }, [orbit, tilt, geometry, path, offset])
  if (path.length < 2) return null
  const [x, y] = drawing.tip
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" data-catheter-overlay>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={drawing.d} stroke="#04141a" strokeWidth="5" strokeOpacity="0.7" />
        <path d={drawing.d} stroke="#f5f7f1" strokeWidth="2.5" />
        <circle
          data-catheter-tip
          data-tip-x={x.toFixed(1)}
          data-tip-y={y.toFixed(1)}
          cx={x}
          cy={y}
          r="4"
          fill="#f5f7f1"
          stroke="#04141a"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  )
}
