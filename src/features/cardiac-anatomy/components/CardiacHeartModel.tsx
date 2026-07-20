'use client'

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { REALISTIC_HEART_MODEL_URL, REALISTIC_HEART_TRANSFORM } from '../content/paths'

interface CardiacHeartModelProps {
  heartRateBpm: number
  paused?: boolean
  reducedMotion?: boolean
}

export function CardiacHeartModel({
  heartRateBpm,
  paused = false,
  reducedMotion = false,
}: CardiacHeartModelProps) {
  const source = useGLTF(REALISTIC_HEART_MODEL_URL)
  const root = useMemo(() => {
    const clone = SkeletonUtils.clone(source.scene) as THREE.Group
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = false
      const cloneMaterial = (material: THREE.Material) => {
        const next = material.clone()
        if (next instanceof THREE.MeshStandardMaterial) {
          next.metalness = 0
          next.roughness = Math.max(0.48, next.roughness)
          next.emissiveIntensity = 0.62
        }
        return next
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material)
    })
    return clone
  }, [source.scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root])
  const clip = source.animations[0]

  useEffect(() => {
    if (!clip) return
    const action = mixer.clipAction(clip, root)
    action.reset().play()
    if (reducedMotion) {
      action.paused = true
      mixer.setTime(clip.duration * 0.12)
    }
    return () => {
      action.stop()
      mixer.uncacheAction(clip, root)
    }
  }, [clip, mixer, reducedMotion, root])

  useEffect(
    () => () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(root)
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      })
    },
    [mixer, root],
  )

  useFrame((_, delta) => {
    if (!clip || paused || reducedMotion) return
    const cyclesPerSecond = THREE.MathUtils.clamp(heartRateBpm, 25, 220) / 60
    mixer.update(delta * clip.duration * cyclesPerSecond)
  })

  return (
    <group
      position={REALISTIC_HEART_TRANSFORM.position}
      rotation={REALISTIC_HEART_TRANSFORM.rotation}
      scale={REALISTIC_HEART_TRANSFORM.scale}
    >
      <primitive object={root} dispose={null} />
    </group>
  )
}
