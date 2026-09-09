'use client'
import { DEFAULT_GEOMETRY, type ImagingGeometry } from '../../lib/physics'
import type { SuiteLayer } from './types'
import { add, chainStopAnchors, suiteFrame } from './suiteModel'

export function Room({
  layers,
  geometry = DEFAULT_GEOMETRY,
}: {
  layers: readonly SuiteLayer[]
  geometry?: ImagingGeometry
}) {
  const f = geometry.field
  const anchors = chainStopAnchors(suiteFrame(0, 0, geometry))
  return (
    <group>
      <mesh position={[0, -geometry.sod - f * 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[f * 5, f * 5]} />
        <meshStandardMaterial color="#192c36" roughness={1} />
      </mesh>
      {layers.includes('table') && (
        <group>
          <mesh position={[0, -f * 0.26, 0]}>
            <boxGeometry args={[f * 0.7, f * 0.045, f * 2.3]} />
            <meshStandardMaterial color="#78909a" roughness={0.75} />
          </mesh>
          <mesh position={[0, -f * 0.53, -f * 0.6]}>
            <boxGeometry args={[f * 0.28, f * 0.5, f * 0.45]} />
            <meshStandardMaterial color="#415b68" />
          </mesh>
        </group>
      )}
      {layers.includes('monitor') && (
        <group>
          <mesh position={add(anchors.reconstruction, [0, -f * 0.15, 0])}>
            <boxGeometry args={[f * 0.32, f * 0.7, f * 0.3]} />
            <meshStandardMaterial color="#344f5d" />
          </mesh>
          <mesh position={add(anchors.reconstruction, [0, f * 0.3, 0])}>
            <boxGeometry args={[f * 0.4, f * 0.32, f * 0.065]} />
            <meshStandardMaterial color="#293e4a" emissive="#294455" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={anchors.display}>
            <boxGeometry args={[f * 0.43, f * 0.34, f * 0.05]} />
            <meshStandardMaterial color="#2a5460" emissive="#1b3e47" emissiveIntensity={0.45} />
          </mesh>
        </group>
      )}
      {layers.includes('fieldGenerator') && (
        <mesh position={[0, -f * 0.29, 0]}>
          <boxGeometry args={[f * 0.58, f * 0.018, f * 0.5]} />
          <meshStandardMaterial color="#648d90" />
        </mesh>
      )}
    </group>
  )
}
