'use client'
import {
  LESION_RADIUS,
  SHAFT_RADIUS,
  SLICE_THICKNESS,
  sphereSliceRadius,
  WINDOW_RADIUS,
  type Point3,
} from '../lib/physics'
import styles from '../imaging.module.css'
import { CTSlice } from './CTSlice'
export { Projection } from './ProjectionView'

export { DTSImage } from './DTSView'

export function MPR({
  plane,
  position,
  tip,
  slab,
}: {
  plane: 'Axial' | 'Coronal' | 'Sagittal'
  position: number
  tip: Point3
  slab: boolean
}) {
  const [x, y, z] = tip
  const radius = slab ? LESION_RADIUS : sphereSliceRadius(position, LESION_RADIUS, SLICE_THICKNESS)
  const scale = 4.1,
    c = 110
  const orient =
    plane === 'Axial' ? 'R ← → L · A ↑' : plane === 'Coronal' ? 'R ← → L · S ↑' : 'A ← → P · S ↑'
  const section = plane === 'Axial' ? z : plane === 'Coronal' ? y : x
  const toolY = plane === 'Axial' ? y : z
  const intervalVisible = (start: number, end: number) =>
    slab || (position + SLICE_THICKNESS / 2 > start && position - SLICE_THICKNESS / 2 < end)
  const shaftRadius = slab
    ? SHAFT_RADIUS
    : sphereSliceRadius(section - position, SHAFT_RADIUS, SLICE_THICKNESS)
  const windowRadius = slab
    ? WINDOW_RADIUS
    : sphereSliceRadius(section - position, WINDOW_RADIUS, SLICE_THICKNESS)
  const shaftVisible = plane === 'Sagittal' ? intervalVisible(x - 45, x) : shaftRadius > 0
  const windowVisible = plane === 'Sagittal' ? intervalVisible(x - 14, x - 6) : windowRadius > 0
  return (
    <div className={styles.mprFrame}>
      <CTSlice plane={plane} position={position} slab={slab} />
      <svg
        viewBox="0 0 220 225"
        className={styles.mprImage}
        role="img"
        aria-label={
          plane +
          ' CT context with analytic teaching ' +
          (slab ? 'slab' : 'slice at ' + position + ' millimeters') +
          '. ' +
          (radius ? 'Target cross-section visible. ' : 'Target not intersected. ') +
          (shaftVisible || windowVisible
            ? 'Tool section visible.'
            : 'Tool is outside this thin section.')
        }
      >
        <rect width="220" height="30" fill="#071118" opacity=".85" />
        <rect y="195" width="220" height="30" fill="#071118" opacity=".85" />
        <text x="12" y="21" fill="#d7e4e8" fontSize="12">
          {plane}
          {slab ? ' slab' : ' · ' + position + ' mm'}
        </text>
        <line x1={c} y1="36" x2={c} y2="192" stroke="#46606c" strokeDasharray="3 4" />
        <line x1="15" y1={c} x2="204" y2={c} stroke="#46606c" strokeDasharray="3 4" />
        {radius > 0 && (
          <circle
            cx={c}
            cy={c}
            r={radius * scale}
            fill="#c2c7c2"
            fillOpacity="0.85"
            stroke="#eebb79"
          />
        )}
        {plane !== 'Sagittal' && (
          <g>
            {shaftVisible && (
              <line
                x1={c + (x - 45) * scale}
                y1={c - toolY * scale}
                x2={c + x * scale}
                y2={c - toolY * scale}
                stroke="#d6e9f1"
                strokeWidth={shaftRadius * 2 * scale}
              />
            )}
            {windowVisible && (
              <line
                x1={c + (x - 14) * scale}
                y1={c - toolY * scale}
                x2={c + (x - 6) * scale}
                y2={c - toolY * scale}
                stroke="#7de3d1"
                strokeWidth={windowRadius * 2 * scale}
              />
            )}
          </g>
        )}
        {plane === 'Sagittal' && (shaftVisible || windowVisible) && (
          <circle
            cx={c - y * scale}
            cy={c - z * scale}
            r={(windowVisible ? WINDOW_RADIUS : SHAFT_RADIUS) * scale}
            fill={windowVisible ? '#7de3d1' : '#d6e9f1'}
          />
        )}
        <path d="M16 183 V188 H57 V183" stroke="#aec6cf" fill="none" />
        <text x="17" y="179" fill="#bacdd5" fontSize="8">
          10 mm
        </text>
        <text x="12" y="210" fill="#bacdd5" fontSize="10">
          {orient}
        </text>
      </svg>
    </div>
  )
}
