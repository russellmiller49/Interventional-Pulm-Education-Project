'use client'

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { CARDIAC_DRACO_PATH } from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import { CardiacPath } from '@/features/cardiac-anatomy/components/CardiacPath'
import { CARDIAC_RIG, LVAD_MODEL_URL } from '@/features/cardiac-anatomy/content/paths'

import type { LvadDeviceState, McsSimulationState } from '../../engine'
import { FlowParticles } from './FlowParticles'

export default function LvadModel({
  state,
  reducedMotion,
}: {
  state: McsSimulationState
  reducedMotion: boolean
}) {
  const source = useGLTF(LVAD_MODEL_URL, CARDIAC_DRACO_PATH)
  const device = state.device as LvadDeviceState
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
          next.metalness = Math.max(0.42, next.metalness)
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
  const flowRoute = useMemo(
    () => [...CARDIAC_RIG.lvad.inflowRoute, ...CARDIAC_RIG.lvad.outflowRoute.slice(1)],
    [],
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

  const transform = CARDIAC_RIG.lvad.modelTransform
  const activelyPumping = device.running && device.powerConnected && !device.controllerFault

  return (
    <group>
      <CardiacPath
        points={CARDIAC_RIG.lvad.inflowRoute}
        radius={0.05}
        color="#aeb5b3"
        emissiveIntensity={0.015}
        radialSegments={14}
      />
      <CardiacPath
        points={CARDIAC_RIG.lvad.outflowRoute}
        radius={0.045}
        color="#aeb5b3"
        emissiveIntensity={0.015}
        radialSegments={14}
      />
      <group position={transform.position} rotation={transform.rotation} scale={transform.scale}>
        <primitive object={model} dispose={null} />
      </group>
      <FlowParticles
        points={flowRoute}
        flow={activelyPumping ? state.metrics.deviceFlowLMin : 0}
        color="#f2a5ad"
        paused={reducedMotion}
      />
    </group>
  )
}
