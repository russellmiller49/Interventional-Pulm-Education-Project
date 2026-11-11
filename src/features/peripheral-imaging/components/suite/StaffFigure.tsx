'use client'
import { useEffect, useMemo } from 'react'
import type { BufferGeometry } from 'three'
import type { Point3 } from '../../lib/physics'
import { limbGeometry, loftGeometry, resampleRows, sectionRing, type LimbPoint } from './loft'

/**
 * A member of staff in a lead apron and thyroid collar, standing on the floor and facing the
 * patient. An authored figure for scale and position; it carries no dose information itself.
 *
 * Its own frame: y up from the floor, x across the shoulders, z toward what it faces. Millimetres.
 */

/** Height, half-depth front to back, half-width across. Hem to neck. */
const APRON: readonly (readonly number[])[] = [
  [520, 122, 214],
  [640, 126, 216],
  [820, 126, 208],
  [1000, 116, 192],
  [1180, 128, 210],
  [1330, 124, 226],
  [1400, 104, 218],
  [1445, 78, 150],
  [1475, 58, 76],
]

const leg = (side: 1 | -1): LimbPoint[] => [
  { at: [side * 88, 900, 0], radius: 80 },
  { at: [side * 88, 500, 8], radius: 58 },
  { at: [side * 88, 110, 0], radius: 42 },
]
const armPoints = (side: 1 | -1): LimbPoint[] => [
  { at: [side * 236, 1385, 0], radius: 56 },
  { at: [side * 262, 1140, 30], radius: 46 },
  { at: [side * 232, 1010, 210], radius: 36 },
  { at: [side * 200, 990, 300], radius: 34 },
]

function useGeometry(build: () => BufferGeometry): BufferGeometry {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(build, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

const SCRUBS = '#5b8aa3'
const LEAD = '#2f6f7c'
const SKIN = '#d6b598'

export function StaffFigure({ position, facing }: { position: Point3; facing: Point3 }) {
  const apron = useGeometry(() =>
    loftGeometry(
      resampleRows(APRON, 4).map(([y, halfDepth, halfWidth]) =>
        sectionRing((across, up) => [up, y, across], halfDepth, -halfWidth, halfWidth, {
          segments: 36,
          squareness: 2.6,
        }),
      ),
    ),
  )
  const legs = [
    useGeometry(() => limbGeometry(leg(1), { front: [0, 0, 1] })),
    useGeometry(() => limbGeometry(leg(-1), { front: [0, 0, 1] })),
  ]
  const arms = [
    useGeometry(() => limbGeometry(armPoints(1), { front: [0, 0, 1] })),
    useGeometry(() => limbGeometry(armPoints(-1), { front: [0, 0, 1] })),
  ]
  const turn = Math.atan2(facing[0] - position[0], facing[2] - position[2])
  return (
    <group position={position} rotation={[0, turn, 0]} name="staff-figure">
      {legs.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color={SCRUBS} roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 88, 38, 55]} scale={[50, 38, 125]}>
          <sphereGeometry args={[1, 18, 12]} />
          <meshStandardMaterial color="#27373f" roughness={0.8} />
        </mesh>
      ))}
      {arms.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color={SCRUBS} roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 192, 985, 340]} scale={[36, 30, 48]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.8} />
        </mesh>
      ))}
      <mesh geometry={apron} name="lead-apron">
        <meshStandardMaterial color={LEAD} roughness={0.75} metalness={0.05} />
      </mesh>
      {/* Thyroid collar. */}
      <mesh position={[0, 1492, 6]}>
        <cylinderGeometry args={[70, 76, 62, 28]} />
        <meshStandardMaterial color="#245a66" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1612, 8]} scale={[86, 108, 98]}>
        <sphereGeometry args={[1, 28, 20]} />
        <meshStandardMaterial color={SKIN} roughness={0.8} />
      </mesh>
      {/* Surgical cap. */}
      <mesh position={[0, 1640, -2]} scale={[90, 96, 104]}>
        <sphereGeometry args={[1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color={SCRUBS} roughness={0.9} />
      </mesh>
    </group>
  )
}
