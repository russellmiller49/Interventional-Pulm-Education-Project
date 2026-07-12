'use client'

import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { CatmullRomCurve3, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import type { Group } from 'three'

import type { AssemblyPartDefinition } from '@/features/rigid-bronchoscopy/content/assemblyParts'
import type { AssemblyPathwaySegment } from '@/features/rigid-bronchoscopy/content/assemblyPathways'
import { RIGID_V2_ASSET_SCALE_WORLD_UNITS_PER_METER } from '@/features/rigid-bronchoscopy/content/rigidAssetManifest'

type PositionTuple = readonly [number, number, number]

export function MovingInstrumentAlongPath({
  part,
  playing,
  reducedMotion,
  resetVersion,
  segment,
}: {
  part: AssemblyPartDefinition
  playing: boolean
  reducedMotion: boolean
  resetVersion: number
  segment: AssemblyPathwaySegment
}) {
  const { scene } = useGLTF(part.individualAssetPath)
  const group = useRef<Group>(null)
  const insertionPhase = useRef(reducedMotion ? 0.96 : 0.06)
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        segment.points.map(([x, y, z]) => new Vector3(x, y, z)),
        false,
        'centripetal',
      ),
    [segment.points],
  )
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      child.material = materials.map((material) => {
        const next = material.clone()
        if (next instanceof MeshStandardMaterial) {
          next.metalness = Math.min(next.metalness, 0.9)
          next.roughness = Math.max(next.roughness, 0.2)
          next.emissive.copy(next.color).multiplyScalar(0.025)
        }
        next.needsUpdate = true
        return next
      })
    })
    return clone
  }, [scene])
  const shaftLengthWorld =
    ((part.workingLengthMm ?? 450) / 1000) * RIGID_V2_ASSET_SCALE_WORLD_UNITS_PER_METER

  useEffect(() => {
    insertionPhase.current = reducedMotion ? 0.96 : 0.06
  }, [reducedMotion, resetVersion, segment.id])

  useFrame((_, delta) => {
    if (playing && !reducedMotion) {
      insertionPhase.current = (insertionPhase.current + delta * segment.speed * 0.7) % 1
    }
    const tipProgress = 0.04 + insertionPhase.current * 0.92
    const tip = curve.getPointAt(tipProgress)
    const tangent = curve.getTangentAt(tipProgress).normalize()
    const origin = tip.clone().addScaledVector(tangent, -shaftLengthWorld)
    const orientation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), tangent)
    group.current?.position.copy(origin)
    group.current?.quaternion.copy(orientation)
  })

  return (
    <group ref={group} scale={RIGID_V2_ASSET_SCALE_WORLD_UNITS_PER_METER}>
      <primitive object={model} />
    </group>
  )
}

export function AnimatedPathwaySegment({
  playing,
  reducedMotion,
  resetVersion,
  segment,
  showParticles = true,
}: {
  playing: boolean
  reducedMotion: boolean
  resetVersion: number
  segment: AssemblyPathwaySegment
  showParticles?: boolean
}) {
  const phase = useRef(0)
  const burstPhase = useRef(0)
  const particles = useRef<Mesh[]>([])
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        segment.points.map(([x, y, z]) => new Vector3(x, y, z)),
        false,
        'centripetal',
      ),
    [segment.points],
  )

  useEffect(() => {
    phase.current = 0
    burstPhase.current = 0
  }, [resetVersion, segment.id])

  useFrame((_, delta) => {
    if (playing && !reducedMotion) {
      phase.current = (phase.current + delta * segment.speed) % 1
      burstPhase.current += delta
    }
    const burstVisible =
      !playing ||
      reducedMotion ||
      !segment.burstFrequencyHz ||
      (burstPhase.current * segment.burstFrequencyHz) % 1 < (segment.burstDutyCycle ?? 0.5)
    particles.current.forEach((particle, index) => {
      const offset = (index / Math.max(segment.particleCount - 1, 1)) * (segment.particleSpan ?? 1)
      const rawProgress = (phase.current + offset) % 1
      const progress = segment.reverse ? 1 - rawProgress : rawProgress
      curve.getPointAt(progress, particle.position)
      particle.visible = burstVisible
    })
  })

  return (
    <>
      <mesh renderOrder={3}>
        <tubeGeometry args={[curve, 72, segment.radius, 10, false]} />
        <meshBasicMaterial
          color={segment.color}
          depthTest
          depthWrite={false}
          opacity={0.46}
          toneMapped={false}
          transparent
        />
      </mesh>
      {showParticles
        ? Array.from({ length: segment.particleCount }, (_, index) => (
            <mesh
              key={`${segment.id}-particle-${index}`}
              ref={(mesh) => {
                if (mesh) particles.current[index] = mesh
              }}
              renderOrder={4}
            >
              <sphereGeometry args={[segment.particleRadius, 14, 10]} />
              <meshBasicMaterial
                color={segment.particleColor}
                depthTest
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))
        : null}
    </>
  )
}

export function DistalObstructionMarker({
  ballValveOpen = false,
  obstructionState = 'fixed-complete',
  playing,
  position,
  reducedMotion,
}: {
  ballValveOpen?: boolean
  obstructionState?: 'fixed-complete' | 'ball-valve'
  playing: boolean
  position: PositionTuple
  reducedMotion: boolean
}) {
  const halo = useRef<Mesh>(null)
  const valve = useRef<Mesh>(null)
  const phase = useRef(0)

  useFrame((_, delta) => {
    if (playing && !reducedMotion) phase.current += delta * 3.2
    const scale = reducedMotion ? 1 : 1 + Math.sin(phase.current) * 0.16
    halo.current?.scale.setScalar(scale)
    if (valve.current) {
      const targetRotation = obstructionState === 'ball-valve' && ballValveOpen ? Math.PI * 0.34 : 0
      valve.current.rotation.x += (targetRotation - valve.current.rotation.x) * 0.14
    }
  })

  return (
    <group position={position}>
      <group rotation={[0, 0, Math.PI / 2]}>
        <mesh ref={valve} renderOrder={5}>
          <cylinderGeometry
            args={[
              obstructionState === 'ball-valve' ? 0.09 : 0.105,
              obstructionState === 'ball-valve' ? 0.09 : 0.105,
              0.025,
              32,
            ]}
          />
          <meshBasicMaterial
            color="#fb7185"
            depthTest
            depthWrite={false}
            opacity={0.82}
            toneMapped={false}
            transparent
          />
        </mesh>
      </group>
      <mesh ref={halo} renderOrder={4}>
        <sphereGeometry args={[0.18, 20, 14]} />
        <meshBasicMaterial
          color="#f59e0b"
          depthTest
          depthWrite={false}
          opacity={0.42}
          toneMapped={false}
          transparent
          wireframe
        />
      </mesh>
    </group>
  )
}
