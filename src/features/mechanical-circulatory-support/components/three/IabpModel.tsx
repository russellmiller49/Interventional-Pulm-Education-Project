'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { CARDIAC_DRACO_PATH } from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import { CardiacPath } from '@/features/cardiac-anatomy/components/CardiacPath'
import { CARDIAC_RIG, IABP_BALLOON_MODEL_URL } from '@/features/cardiac-anatomy/content/paths'

import {
  deriveIabpCycleState,
  nextIabpBalloonMorph,
  type IabpDeviceState,
  type McsSimulationState,
} from '../../engine'

type MorphMesh = THREE.Mesh & { morphTargetInfluences: number[] }

export default function IabpModel({
  state,
  reducedMotion,
}: {
  state: McsSimulationState
  reducedMotion: boolean
}) {
  const source = useGLTF(IABP_BALLOON_MODEL_URL, CARDIAC_DRACO_PATH)
  const balloonRef = useRef<MorphMesh | null>(null)
  const { root, morphMesh } = useMemo(() => {
    const clone = SkeletonUtils.clone(source.scene) as THREE.Group
    let balloonMesh: MorphMesh | null = null
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.frustumCulled = false
      const cloneMaterial = (material: THREE.Material) => {
        const next = material.clone()
        if (next instanceof THREE.MeshStandardMaterial) {
          next.emissiveIntensity = 0
          next.roughness = object.name === 'IABP_Balloon' ? 0.2 : 0.34
        }
        return next
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material)
      if (object.name === 'IABP_Balloon' && object.morphTargetInfluences) {
        balloonMesh = object as MorphMesh
      }
    })
    return { root: clone, morphMesh: balloonMesh as MorphMesh | null }
  }, [source.scene])
  const device = state.device as IabpDeviceState

  useEffect(() => {
    balloonRef.current = morphMesh
    return () => {
      balloonRef.current = null
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      })
    }
  }, [morphMesh, root])

  useFrame(() => {
    const balloon = balloonRef.current
    if (!balloon) return
    const cycle = deriveIabpCycleState(state.timeSeconds, state.patient.heartRateBpm, device)
    balloon.morphTargetInfluences[0] = nextIabpBalloonMorph(
      balloon.morphTargetInfluences[0] ?? 0,
      cycle.inflated,
      reducedMotion,
    )
  })

  return (
    <group>
      <CardiacPath
        points={CARDIAC_RIG.iabp.catheterRoute}
        radius={0.014}
        color="#c9d2d2"
        emissiveIntensity={0.02}
        radialSegments={12}
      />
      <group
        position={CARDIAC_RIG.iabp.balloonCenter}
        rotation={CARDIAC_RIG.iabp.balloonRotation}
        scale={CARDIAC_RIG.iabp.balloonScale}
      >
        <primitive object={root} dispose={null} />
      </group>
    </group>
  )
}
