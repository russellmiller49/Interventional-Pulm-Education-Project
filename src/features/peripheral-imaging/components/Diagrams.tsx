'use client'
import { useId } from 'react'
import {
  dtsShift,
  LESION_CENTER,
  LESION_RADIUS,
  projectPoint,
  SHAFT_RADIUS,
  SLICE_THICKNESS,
  sphereSliceRadius,
  WINDOW_RADIUS,
  type Point3,
} from '../lib/physics'
import styles from '../imaging.module.css'

export function Projection({
  orbit,
  tilt,
  depth,
  field = 100,
  crop = false,
  zoom = 1,
}: {
  orbit: number
  tilt: number
  depth: number
  field?: number
  crop?: boolean
  zoom?: number
}) {
  const clip = useId().replace(/:/g, '')
  const project = (p: Point3) => {
    const [u, v] = projectPoint(p, orbit, tilt)
    return [210 + u * 1.7, 168 - v * 1.7]
  }
  const target = project(LESION_CENTER),
    tip = project([35, depth, -5]),
    start = project([-25, depth, -5])
  const width = (370 * field) / 100,
    height = (276 * field) / 100
  // Shutters centered on the target; mask position is independently bounded to detector area.
  const x = Math.min(395 - width, Math.max(25, target[0] - width / 2)),
    y = Math.min(300 - height, Math.max(24, target[1] - height / 2))
  return (
    <svg
      viewBox="0 0 420 350"
      className={styles.projection}
      role="img"
      aria-label={
        'Parallel-ray teaching projection at ' +
        orbit +
        ' degrees obliquity and ' +
        tilt +
        ' degrees tilt. Target and tool projected positions change with viewing angle.'
      }
    >
      <defs>
        <clipPath id={clip}>
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
        <radialGradient id={clip + 'lung'}>
          <stop offset="0%" stopColor="#536671" />
          <stop offset="100%" stopColor="#263a46" />
        </radialGradient>
      </defs>
      <rect width="420" height="350" fill="#10222e" />
      <text x="18" y="18" fill="#c0d0d9" fontSize="10">
        TEACHING PROJECTION · NO CLINICAL GRAYSCALE
      </text>
      <g clipPath={'url(#' + clip + ')'}>
        <g
          transform={
            'translate(' + 210 * (1 - zoom) + ' ' + 168 * (1 - zoom) + ') scale(' + zoom + ')'
          }
        >
          <ellipse cx="210" cy="174" rx="126" ry="141" fill="#536570" />
          <ellipse cx="154" cy="165" rx="51" ry="110" fill={'url(#' + clip + 'lung)'} />
          <ellipse cx="268" cy="165" rx="51" ry="110" fill={'url(#' + clip + 'lung)'} />
          <path
            d="M207 39 V126 M207 108 L160 170 L147 229 M210 111 L254 173 L270 242"
            fill="none"
            stroke="#75858b"
            strokeWidth="5"
          />
          {Array.from({ length: 7 }, (_, i) => (
            <path
              key={i}
              d={'M95 ' + (65 + i * 31) + ' Q210 ' + (115 + i * 28) + ' 326 ' + (64 + i * 31)}
              fill="none"
              stroke="#a4acaa"
              strokeWidth="4"
              opacity="0.29"
            />
          ))}
          <ellipse cx="195" cy="201" rx="43" ry="64" fill="#75888d" opacity="0.32" />
          <circle cx={target[0]} cy={target[1]} r="15.3" fill="#dfb36d" opacity="0.85" />
          <line
            x1={start[0]}
            y1={start[1]}
            x2={tip[0]}
            y2={tip[1]}
            stroke="#e7f4fa"
            strokeWidth="3"
          />
          <path
            d={'M' + (tip[0] - 3) + ',' + (tip[1] - 3) + ' l6,6 m-6,0 l6,-6'}
            stroke="#e7f4fa"
            strokeWidth="2"
          />
        </g>
      </g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke={crop ? '#aec0cc' : '#f2c36b'}
        strokeDasharray={crop ? '5 4' : undefined}
        strokeWidth="2"
      />
      <text x="27" y="335" fill="#cad8dd" fontSize="11">
        L: patient left · target: amber circle · tool: white line/cross
      </text>
    </svg>
  )
}

export function DTSImage({ sweep, plane }: { sweep: number; plane: number }) {
  const objects = [
    { x: 255, y: 150, depth: 0, r: 14, name: 'Lesion' },
    { x: 185, y: 160, depth: -18, r: 3, name: 'Tool' },
    { x: 256, y: 148, depth: 25, r: 9, name: 'Rib' },
  ]
  return (
    <svg
      viewBox="0 0 420 300"
      className={styles.projection}
      role="img"
      aria-label={
        'Illustrative shift-and-add image focused at depth ' +
        plane +
        ' millimeters with a ' +
        sweep +
        ' degree sweep. In-plane structures reinforce; other structures spread across the image.'
      }
    >
      <rect width="420" height="300" fill="#112834" />
      <text x="17" y="24" fill="#d3dfe4" fontSize="11">
        SHIFT-AND-ADD ILLUSTRATION · NOT A CLINICAL RECONSTRUCTION
      </text>
      {[...Array(13)].map((_, i) => {
        const angle = -sweep / 2 + (sweep * i) / 12
        return (
          <g key={i} opacity="0.075">
            {objects.map((object) => {
              const x = object.x + dtsShift(object.depth, plane, angle) * 3.5
              return object.name === 'Rib' ? (
                <rect
                  key={object.name}
                  x={x - 7}
                  y="70"
                  width="14"
                  height="150"
                  rx="6"
                  fill="#f4e1be"
                />
              ) : object.name === 'Tool' ? (
                <rect
                  key={object.name}
                  x={x - 50}
                  y={object.y - 2}
                  width="77"
                  height="4"
                  fill="#bde9ff"
                />
              ) : (
                <circle key={object.name} cx={x} cy={object.y} r={object.r} fill="#ffbd75" />
              )
            })}
          </g>
        )
      })}
      <text x="20" y="273" fill="#bdcfda" fontSize="11">
        Authored depths: tool −18 mm · lesion 0 mm · rib +25 mm
      </text>
    </svg>
  )
}

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
    <svg
      viewBox="0 0 220 225"
      className={styles.mprImage}
      role="img"
      aria-label={
        plane +
        ' analytic teaching ' +
        (slab ? 'slab' : 'slice at ' + position + ' millimeters') +
        '. ' +
        (radius ? 'Target cross-section visible. ' : 'Target not intersected. ') +
        (shaftVisible || windowVisible
          ? 'Tool section visible.'
          : 'Tool is outside this thin section.')
      }
    >
      <rect width="220" height="225" rx="8" fill="#122633" />
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
          fill="#a97638"
          fillOpacity="0.7"
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
  )
}
