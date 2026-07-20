'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import type { CardiacPoint3 } from '../content/paths'

interface CardiacPathProps {
  points: readonly CardiacPoint3[]
  radius: number
  color: string
  opacity?: number
  emissiveIntensity?: number
  radialSegments?: number
  tubularSegments?: number
  visibleFraction?: number
  reducedMotion?: boolean
}

export function CardiacPath({
  points,
  radius,
  color,
  opacity = 1,
  emissiveIntensity = 0.45,
  radialSegments = 10,
  tubularSegments,
  visibleFraction = 1,
  reducedMotion = false,
}: CardiacPathProps) {
  const renderedFraction = useRef(visibleFraction)
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((point) => new THREE.Vector3(...point)),
      false,
      'centripetal',
    )
    return new THREE.TubeGeometry(
      curve,
      tubularSegments ?? Math.max(28, points.length * 12),
      radius,
      radialSegments,
      false,
    )
  }, [points, radialSegments, radius, tubularSegments])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const target = THREE.MathUtils.clamp(visibleFraction, 0, 1)
    renderedFraction.current = reducedMotion
      ? target
      : THREE.MathUtils.lerp(renderedFraction.current, target, 0.16)
    const indexCount = geometry.index?.count ?? 0
    const visibleIndexCount = Math.floor((indexCount * renderedFraction.current) / 3) * 3
    geometry.setDrawRange(0, visibleIndexCount)
  })

  return (
    <mesh geometry={geometry} castShadow frustumCulled={false}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        metalness={0.08}
        opacity={opacity}
        roughness={0.38}
        transparent={opacity < 1}
      />
    </mesh>
  )
}
