'use client'

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { HEART_GREAT_VESSELS_MODEL_URL, IABP_AORTA_MODEL_URL } from '../content/paths'

export const CARDIAC_DRACO_PATH = '/draco/'

function StaticCardiacAsset({ url }: { url: string }) {
  const source = useGLTF(url, CARDIAC_DRACO_PATH)
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
          next.metalness = Math.min(next.metalness, 0.08)
          next.roughness = Math.max(next.roughness, 0.5)
          next.emissiveIntensity = 0
        }
        return next
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material)
    })
    return clone
  }, [source.scene])

  useEffect(
    () => () => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      })
    },
    [root],
  )

  return <primitive object={root} dispose={null} />
}

export function HeartGreatVesselsModel() {
  return <StaticCardiacAsset url={HEART_GREAT_VESSELS_MODEL_URL} />
}

export function IabpAortaModel() {
  return <StaticCardiacAsset url={IABP_AORTA_MODEL_URL} />
}
