'use client'
import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { fieldGeometry, type SuiteFrame } from '../suiteModel'
import { Quad } from '../SceneGeometry'
import { FIELD_CONTEXT, projectToDetector } from '../../../lib/physics'

export function FieldView({
  frame,
  fieldPercent,
  crop,
}: {
  frame: SuiteFrame
  fieldPercent: number
  crop: boolean
}) {
  const model = useMemo(() => fieldGeometry(frame, fieldPercent, crop), [frame, fieldPercent, crop])
  return (
    <group>
      <Quad points={model.irradiated} color="#efbc61" opacity={0.14} />
      <Line points={[...model.irradiated, model.irradiated[0]]} color="#efbc61" lineWidth={1.5} />
      <Line points={[...model.blades, model.blades[0]]} color="#d3e0e2" lineWidth={5} />
      {model.masks.map((points, i) => (
        <Quad key={i} points={points} color="#04090d" />
      ))}
    </group>
  )
}

export function FieldMask({
  frame,
  fieldPercent,
  crop,
}: {
  frame: SuiteFrame
  fieldPercent: number
  crop: boolean
}) {
  const { image } = fieldGeometry(frame, fieldPercent, crop)
  const ratio = 512 / frame.geometry.field
  const left = 256 + image.left * ratio
  const top = 256 - (image.bottom + image.side) * ratio
  const size = image.side * ratio
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      data-field-mask
      data-physical-field={crop ? 100 : fieldPercent}
    >
      <path
        d={`M0 0H512V512H0Z M${left} ${top}v${size}h${size}v-${size}Z`}
        fill="#04090d"
        fillRule="evenodd"
      />
      <rect
        x={left}
        y={top}
        width={size}
        height={size}
        fill="none"
        stroke={crop ? '#a6bdc8' : '#e7bc76'}
        strokeWidth="1.5"
        strokeDasharray={crop ? '5 4' : undefined}
      />
    </svg>
  )
}

export function FieldContextOverlay({ orbit, tilt }: { orbit: number; tilt: number }) {
  const points = FIELD_CONTEXT.map(({ point }) => {
    const [u, v] = projectToDetector(point, orbit, tilt)
    return [256 + (u * 512) / 640, 256 - (v * 512) / 640]
  })
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-label="Two modeled context landmarks and the dashed planned tool excursion"
      data-field-context
    >
      <line
        x1={points[2][0]}
        y1={points[2][1]}
        x2={points[3][0]}
        y2={points[3][1]}
        stroke="#77dccf"
        strokeWidth="3"
        strokeDasharray="6 4"
      />
      {points.slice(0, 2).map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x - 6} ${y}h12M${x} ${y - 6}v12`} stroke="#aeeae3" strokeWidth="2" />
          <text x={x - 4} y={y - 10} fill="#d8fffa" fontSize="13">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}
