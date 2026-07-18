'use client'

import { useMemo } from 'react'
import * as THREE from 'three'

// Reduced-motion replacement for the animated dash: a handful of static
// direction cones along the limb, visible only while flow is present.

const ARROW_COUNT = 6

export function StaticFlowArrows({
  curve,
  tint,
  visible,
  direction,
}: {
  curve: THREE.CatmullRomCurve3
  tint: THREE.Color
  visible: boolean
  direction: 1 | -1
}) {
  const transforms = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    return Array.from({ length: ARROW_COUNT }, (_, index) => {
      const u = (index + 0.5) / ARROW_COUNT
      const position = curve.getPointAt(u)
      const tangent = curve.getTangentAt(u).normalize().multiplyScalar(direction)
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, tangent)
      return { position, quaternion }
    })
  }, [curve, direction])

  return (
    <group visible={visible}>
      {transforms.map((transform, index) => (
        <mesh key={index} position={transform.position} quaternion={transform.quaternion}>
          <coneGeometry args={[0.02, 0.05, 8]} />
          <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  )
}
