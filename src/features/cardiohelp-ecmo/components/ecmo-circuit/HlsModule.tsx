'use client'

import { useMemo, useRef } from 'react'
import { Clone, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { OXYGENATOR_ASSET, PALETTE } from './constants'
import type { CircuitLayout } from './layout'

// The CARDIOHELP disposable is an integrated HLS module: the centrifugal pump
// head sits directly beneath the membrane oxygenator on a console holder arm —
// not two separate devices. The oxygenator GLB rides on a procedural pump head.

function PumpHead({ running, rpm, animate }: { running: boolean; rpm: number; animate: boolean }) {
  const rotor = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (running && animate && rotor.current)
      rotor.current.rotation.y -= delta * Math.max(1.5, rpm / 420)
  })

  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.19, 0.16, 40]} />
        <meshPhysicalMaterial
          color={PALETTE.pumpHousing}
          roughness={0.22}
          metalness={0.04}
          clearcoat={0.7}
          clearcoatRoughness={0.3}
        />
      </mesh>
      <mesh position={[0, -0.04, 0.135]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.012, 32]} />
        <meshPhysicalMaterial
          color="#20343a"
          roughness={0.12}
          metalness={0.1}
          clearcoat={0.8}
          clearcoatRoughness={0.15}
          transparent
          opacity={0.86}
        />
      </mesh>
      <group ref={rotor} position={[0, -0.04, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        {Array.from({ length: 5 }, (_, index) => (
          <mesh key={index} rotation={[0, (index / 5) * Math.PI * 2, 0]} position={[0.05, 0, 0]}>
            <boxGeometry args={[0.08, 0.014, 0.03]} />
            <meshStandardMaterial
              color={running ? PALETTE.rotorRunning : PALETTE.rotorStopped}
              emissive={running ? '#277e84' : '#000000'}
              emissiveIntensity={0.7}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.1, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.08, 18]} />
        <meshPhysicalMaterial color="#d8e5e5" roughness={0.25} clearcoat={0.4} />
      </mesh>
    </group>
  )
}

export function HlsModule({
  layout,
  running,
  rpm,
  animate,
  consolePosition,
}: {
  layout: CircuitLayout
  running: boolean
  rpm: number
  animate: boolean
  consolePosition: THREE.Vector3
}) {
  const { scene } = useGLTF(OXYGENATOR_ASSET)
  const holder = useMemo(() => {
    const from = layout.hlsModulePosition.clone().add(new THREE.Vector3(0.08, 0.05, 0))
    const to = consolePosition.clone().add(new THREE.Vector3(-0.18, 0.35, -0.05))
    const mid = from.clone().lerp(to, 0.5)
    const span = to.clone().sub(from)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      span.clone().normalize(),
    )
    return { mid, length: span.length(), quaternion }
  }, [consolePosition, layout.hlsModulePosition])

  return (
    <group>
      <group position={layout.hlsModulePosition}>
        <group position={[0, 0.2, 0]} rotation={[0.02, -0.55, 0]}>
          <Clone object={scene} castShadow receiveShadow />
        </group>
        <group position={[0, -0.16, 0]}>
          <PumpHead running={running} rpm={rpm} animate={animate} />
        </group>
      </group>
      <mesh position={holder.mid} quaternion={holder.quaternion} castShadow>
        <cylinderGeometry args={[0.02, 0.02, holder.length, 12]} />
        <meshStandardMaterial color={PALETTE.holderArm} roughness={0.4} metalness={0.35} />
      </mesh>
    </group>
  )
}
