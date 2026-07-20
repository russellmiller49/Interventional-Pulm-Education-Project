'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { CARDIAC_DRACO_PATH } from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import { CardiacPath } from '@/features/cardiac-anatomy/components/CardiacPath'
import { CARDIAC_RIG, IMPELLA_CP_MODEL_URL } from '@/features/cardiac-anatomy/content/paths'

import type { ImpellaDeviceState, McsSimulationState } from '../../engine'
import { FlowParticles } from './FlowParticles'

export default function ImpellaModel({
  state,
  reducedMotion,
}: {
  state: McsSimulationState
  reducedMotion: boolean
}) {
  const source = useGLTF(IMPELLA_CP_MODEL_URL, CARDIAC_DRACO_PATH)
  const poseGroup = useRef<THREE.Group>(null)
  const device = state.device as ImpellaDeviceState
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(source.scene) as THREE.Group
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = false
      const cloneMaterial = (material: THREE.Material) => {
        const next = material.clone()
        if (next instanceof THREE.MeshStandardMaterial) {
          next.emissive.setRGB(0, 0, 0)
          next.emissiveIntensity = 0
          next.metalness = Math.min(0.42, Math.max(0.12, next.metalness))
          next.roughness = Math.max(0.28, next.roughness)
        }
        return next
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material)
    })
    return clone
  }, [source.scene])
  const targetOffset = useMemo(
    () => new THREE.Vector3(...CARDIAC_RIG.impella.positionOffsets[device.position]),
    [device.position],
  )

  useEffect(
    () => () => {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      })
    },
    [model],
  )

  useFrame(() => {
    if (!poseGroup.current) return
    if (reducedMotion) poseGroup.current.position.copy(targetOffset)
    else poseGroup.current.position.lerp(targetOffset, 0.12)
  })

  const transform = CARDIAC_RIG.impella.modelTransform

  return (
    <group>
      <CardiacPath
        points={CARDIAC_RIG.impella.shaftRoute}
        radius={0.012}
        color="#c4cdce"
        emissiveIntensity={0.01}
        radialSegments={10}
      />
      <group ref={poseGroup}>
        <group position={transform.position} rotation={transform.rotation} scale={transform.scale}>
          <primitive object={model} dispose={null} />
        </group>
      </group>
      <FlowParticles
        points={CARDIAC_RIG.impella.flowRoute}
        flow={device.running ? state.metrics.deviceFlowLMin : 0}
        color="#b6eef0"
        paused={reducedMotion}
      />
    </group>
  )
}
