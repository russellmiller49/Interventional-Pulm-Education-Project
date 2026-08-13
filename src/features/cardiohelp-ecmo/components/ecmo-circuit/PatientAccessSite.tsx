'use client'

import { useMemo } from 'react'
import * as THREE from 'three'

import { PALETTE, TUBE_RADII } from './constants'
import type { AccessSite, CircuitLayout } from './layout'
import { buildFlowTubeGeometry } from './tubeGeometry'

function AccessDressing({ site }: { site: AccessSite }) {
  const ringColor = PALETTE[site.ringColorKey]
  return (
    <group position={site.position} userData={{ site: site.site }}>
      {/* Film radius fits inside the drape's access window (r ≈ 0.082 local);
          the old 0.105 disc clipped through the window's raised rim. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <circleGeometry args={[0.078, 32]} />
        <meshPhysicalMaterial
          color={PALETTE.dressingFilm}
          transparent
          opacity={0.45}
          roughness={0.3}
          clearcoat={0.35}
          clearcoatRoughness={0.4}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <torusGeometry args={[0.034, 0.008, 10, 32]} />
        <meshStandardMaterial color={ringColor} roughness={0.36} />
      </mesh>
      <mesh position={[-0.062, 0.008, 0]}>
        <boxGeometry args={[0.065, 0.012, 0.038]} />
        <meshStandardMaterial color="#e8efeb" roughness={0.68} />
      </mesh>
      <mesh position={[0.062, 0.008, 0]}>
        <boxGeometry args={[0.065, 0.012, 0.038]} />
        <meshStandardMaterial color="#e8efeb" roughness={0.68} />
      </mesh>
    </group>
  )
}

function CannulaShaft({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geometry = useMemo(() => buildFlowTubeGeometry(curve, TUBE_RADII.cannulaWall, 14), [curve])
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color={PALETTE.cannulaShaft}
        transparent
        opacity={0.85}
        roughness={0.3}
        metalness={0}
        clearcoat={0.4}
        clearcoatRoughness={0.35}
      />
    </mesh>
  )
}

function ConnectorHub({
  curve,
  curvePosition,
  color,
}: {
  curve: THREE.CatmullRomCurve3
  curvePosition: number
  color: string
}) {
  const { point, alignment } = useMemo(() => {
    const hubPoint = curve.getPointAt(curvePosition)
    const tangent = curve.getTangentAt(curvePosition).normalize()
    return {
      point: hubPoint,
      alignment: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent),
    }
  }, [curve, curvePosition])

  return (
    <group position={point} quaternion={alignment}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.047, 0.047, 0.14, 24]} />
        <meshPhysicalMaterial
          color="#d8e5e5"
          transparent
          opacity={0.82}
          roughness={0.24}
          metalness={0.04}
          clearcoat={0.5}
          clearcoatRoughness={0.3}
        />
      </mesh>
      <mesh position={[-0.065, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.059, 0.059, 0.022, 24]} />
        <meshStandardMaterial color="#eef3ef" roughness={0.42} />
      </mesh>
      <mesh position={[0.055, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.052, 0.052, 0.026, 24]} />
        <meshStandardMaterial color={color} roughness={0.32} />
      </mesh>
    </group>
  )
}

function DistalPerfusionCatheter({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geometry = useMemo(() => buildFlowTubeGeometry(curve, TUBE_RADII.dpc, 10), [curve])
  return (
    <group>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color={PALETTE.dpcLine} roughness={0.4} />
      </mesh>
      <mesh position={curve.getPointAt(0)}>
        <sphereGeometry args={[0.014, 12, 12]} />
        <meshStandardMaterial color={PALETTE.returnArteryRing} roughness={0.4} />
      </mesh>
    </group>
  )
}

export function PatientAccessSite({ layout }: { layout: CircuitLayout }) {
  const drainageRing = PALETTE[layout.drainageSite.ringColorKey]
  const returnRing = PALETTE[layout.returnSite.ringColorKey]
  return (
    <group>
      <AccessDressing site={layout.drainageSite} />
      <AccessDressing site={layout.returnSite} />
      <CannulaShaft curve={layout.drainageCannula} />
      <CannulaShaft curve={layout.returnCannula} />
      <ConnectorHub curve={layout.drainageCannula} curvePosition={1} color={drainageRing} />
      <ConnectorHub curve={layout.returnCannula} curvePosition={0} color={returnRing} />
      {layout.dpc ? <DistalPerfusionCatheter curve={layout.dpc} /> : null}
    </group>
  )
}
