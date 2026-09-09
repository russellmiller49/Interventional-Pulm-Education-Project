'use client'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import { radians } from '../../lib/physics'
import { coneFrustum, type SuiteFrame } from './suiteModel'
import type { SuiteVariant } from './types'

export function BeamCone({ frame, fieldPercent }: { frame: SuiteFrame; fieldPercent: number }) {
  const geometry = useMemo(() => {
    const cone = coneFrustum(frame, fieldPercent)
    const points = cone.corners.flatMap((corner, i) => [
      ...cone.source,
      ...corner,
      ...cone.corners[(i + 1) % 4],
    ])
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(points, 3))
    g.computeVertexNormals()
    return g
  }, [frame, fieldPercent])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#e3ba74"
        side={DoubleSide}
        transparent
        opacity={0.065}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
export function ParametricCarm({
  frame,
  variant,
  lit,
}: {
  frame: SuiteFrame
  variant: SuiteVariant
  lit: boolean
}) {
  const { sod, sid, field } = frame.geometry
  return (
    <group position={frame.iso}>
      <group rotation={[0, 0, radians(frame.orbit)]}>
        <group rotation={[radians(frame.tilt), 0, 0]}>
          <mesh position={[0, sid / 2 - sod, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[sid / 2, field * 0.025, 12, 72, Math.PI]} />
            <meshStandardMaterial color="#9baeb7" metalness={0.38} roughness={0.5} />
          </mesh>
          <mesh position={[0, -sod - field * 0.055, 0]}>
            <boxGeometry args={[field * 0.2, field * 0.11, field * 0.18]} />
            <meshStandardMaterial color="#c0c9ca" metalness={0.25} roughness={0.55} />
          </mesh>
          <mesh position={[0, -sod, 0]}>
            <sphereGeometry args={[field * 0.012, 16, 12]} />
            <meshStandardMaterial
              color="#ffe2a2"
              emissive="#efbc61"
              emissiveIntensity={lit ? 2 : 0.45}
            />
          </mesh>
          <mesh position={[0, sid - sod + field * 0.027, 0]}>
            <boxGeometry args={[field * 1.035, field * 0.05, field * 1.035]} />
            <meshStandardMaterial color="#506b78" metalness={0.2} roughness={0.65} />
          </mesh>
          {[-1, 1].map((sign) => (
            <group key={sign}>
              <mesh position={[sign * field * 0.065, -sod + field * 0.035, 0]}>
                <boxGeometry args={[field * 0.035, field * 0.035, field * 0.13]} />
                <meshStandardMaterial color="#59696c" />
              </mesh>
              <mesh position={[0, -sod + field * 0.035, sign * field * 0.065]}>
                <boxGeometry args={[field * 0.1, field * 0.035, field * 0.035]} />
                <meshStandardMaterial color="#59696c" />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      <mesh position={[-sid * 0.52, -field * 0.48, 0]}>
        <boxGeometry
          args={
            variant === 'mobile'
              ? [field * 0.55, field * 0.55, field * 0.45]
              : [field * 0.22, field * 0.9, field * 0.25]
          }
        />
        <meshStandardMaterial color={variant === 'mobile' ? '#80929a' : '#667e8b'} />
      </mesh>
    </group>
  )
}
