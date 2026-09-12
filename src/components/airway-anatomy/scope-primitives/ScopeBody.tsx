'use client'

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { HandoffContent } from '@/i18n/handoff'
import { add, scale, subtract } from '@/lib/airway-anatomy/geometry'
import { buildScopePathLps } from '@/lib/airway-anatomy/scope-state'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import type { AirwayGraph, ScopePoseSnapshot, Vec3 } from '@/lib/airway-anatomy/types'

/** Bronchoscope rendered as an insertion tube from the tracheal inlet to the tip. */
export function ScopeBody({ graph, pose }: { graph: AirwayGraph; pose: ScopePoseSnapshot }) {
  const pathLps = useMemo(
    () => pose.shaftPathLps ?? buildScopePathLps(graph, pose.edgeId, pose.distanceMm),
    [graph, pose.edgeId, pose.distanceMm, pose.shaftPathLps],
  )

  const tubeGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    let lastKept: Vec3 | null = null
    for (const point of pathLps) {
      if (
        !lastKept ||
        Math.hypot(point[0] - lastKept[0], point[1] - lastKept[1], point[2] - lastKept[2]) >= 2
      ) {
        points.push(new THREE.Vector3(...point))
        lastKept = point
      }
    }
    const tail = pathLps[pathLps.length - 1]
    if (tail && lastKept && lastKept !== tail) {
      points.push(new THREE.Vector3(...tail))
    }
    if (points.length < 2) return null
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
    const segments = Math.min(400, Math.max(24, Math.round(curve.getLength() / 1.5)))
    return new THREE.TubeGeometry(curve, segments, 1.9, 12, false)
  }, [pathLps])

  useEffect(() => () => tubeGeometry?.dispose(), [tubeGeometry])

  const tangent = useMemo(
    () => new THREE.Vector3(...pose.tangentLps).normalize(),
    [pose.tangentLps],
  )
  const tipQuaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent),
    [tangent],
  )
  const viewForward = useMemo(() => scopeOpticalFrame(pose).forward, [pose])
  const beamQuaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(...viewForward).negate(),
      ),
    [viewForward],
  )

  const beamLength = 16
  const tipSegmentPosition = subtract(pose.tipLps, scale(pose.tangentLps, 3.2))
  const beamPosition = add(pose.tipLps, scale(viewForward, beamLength / 2))

  return (
    <HandoffContent>
      {
        <group>
          {tubeGeometry && (
            <mesh geometry={tubeGeometry}>
              <meshStandardMaterial
                color="#3f4754"
                roughness={0.35}
                metalness={0.35}
                emissive="#1e293b"
                emissiveIntensity={0.5}
              />
            </mesh>
          )}
          <mesh position={tipSegmentPosition} quaternion={tipQuaternion}>
            <cylinderGeometry args={[2.1, 2.1, 7, 16]} />
            <meshStandardMaterial
              color="#9ca3af"
              roughness={0.28}
              metalness={0.6}
              emissive="#475569"
              emissiveIntensity={0.4}
            />
          </mesh>
          <mesh position={pose.tipLps}>
            <sphereGeometry args={[1.5, 16, 16]} />
            <meshStandardMaterial color="#eff6ff" emissive="#bfdbfe" emissiveIntensity={2.2} />
          </mesh>
          <mesh position={beamPosition} quaternion={beamQuaternion}>
            <coneGeometry args={[6.5, beamLength, 20, 1, true]} />
            <meshBasicMaterial
              color="#bfdbfe"
              transparent
              opacity={0.15}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <pointLight
            position={pose.tipLps}
            intensity={5}
            distance={34}
            decay={1.4}
            color="#cfe3ff"
          />
        </group>
      }
    </HandoffContent>
  )
}

export function Polyline({
  points,
  color,
  opacity,
}: {
  points: Vec3[]
  color: string
  opacity: number
}) {
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setFromPoints(points.map((point) => new THREE.Vector3(...point)))
    return next
  }, [points])
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    [color, opacity],
  )
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  if (points.length < 2) return <HandoffContent>{null}</HandoffContent>
  return <HandoffContent>{<primitive object={line} />}</HandoffContent>
}
