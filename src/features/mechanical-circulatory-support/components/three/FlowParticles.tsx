'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function FlowParticles({
  points,
  flow,
  color,
  paused,
}: {
  points: readonly (readonly [number, number, number])[]
  flow: number
  color: string
  paused: boolean
}) {
  const refs = useRef<Array<THREE.Mesh | null>>([])
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))),
    [points],
  )
  useFrame(({ clock }) => {
    refs.current.forEach((particle, index) => {
      if (!particle) return
      const speed = paused ? 0 : Math.max(0.08, flow * 0.055)
      const offset = (clock.elapsedTime * speed + index / refs.current.length) % 1
      particle.position.copy(curve.getPoint(offset))
      particle.visible = flow > 0.05
    })
  })
  return (
    <group>
      {Array.from({ length: 10 }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
        >
          <sphereGeometry args={[0.026, 10, 10]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.28}
            roughness={0.42}
          />
        </mesh>
      ))}
    </group>
  )
}
