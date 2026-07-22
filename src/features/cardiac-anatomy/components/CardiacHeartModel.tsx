'use client'

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { REALISTIC_HEART_MODEL_URL, REALISTIC_HEART_TRANSFORM } from '../content/paths'

interface CardiacHeartModelProps {
  heartRateBpm: number
  aorticValveOpening?: boolean
  deviceEmphasis?: boolean | 'lvad'
  paused?: boolean
  reducedMotion?: boolean
}

export function CardiacHeartModel({
  heartRateBpm,
  aorticValveOpening = true,
  deviceEmphasis = false,
  paused = false,
  reducedMotion = false,
}: CardiacHeartModelProps) {
  const emphasisEnabled = Boolean(deviceEmphasis)
  const lvadEmphasis = deviceEmphasis === 'lvad'
  const source = useGLTF(REALISTIC_HEART_MODEL_URL, '/draco/')
  const root = useMemo(() => {
    const clone = SkeletonUtils.clone(source.scene) as THREE.Group
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = false
      const isChamber = object.name.includes('_Cavity')
      const isAorticValve = object.name.includes('Valve_Aortic')
      const isMyocardium = object.name.includes('Myocardium')
      const isOutflowTract = object.name.includes('LVOT')
      const isVessel =
        object.name.includes('Aorta') ||
        object.name.includes('Pulmonary') ||
        object.name === 'CT_SVC' ||
        object.name === 'CT_IVC'
      object.renderOrder = emphasisEnabled
        ? isAorticValve
          ? 14
          : isVessel
            ? 13
            : isChamber || isMyocardium || isOutflowTract
              ? 12
              : 11
        : isAorticValve
          ? 6
          : isVessel
            ? 5
            : isChamber
              ? 4
              : 3
      const cloneMaterial = (material: THREE.Material) => {
        const next = material.clone()
        if (next instanceof THREE.MeshStandardMaterial) {
          next.metalness = 0
          next.roughness = Math.max(0.48, next.roughness)
          next.emissiveIntensity = emphasisEnabled ? 0.025 : 0.04
          if (emphasisEnabled) {
            const windowOpacity = lvadEmphasis
              ? isAorticValve
                ? 0.5
                : isVessel
                  ? 0.32
                  : isMyocardium || isOutflowTract
                    ? 0.23
                    : isChamber
                      ? 0.18
                      : 0.25
              : isAorticValve
                ? 0.34
                : isVessel
                  ? 0.22
                  : isMyocardium || isOutflowTract
                    ? 0.16
                    : isChamber
                      ? 0.13
                      : 0.18
            next.opacity = Math.min(next.opacity, windowOpacity)
            next.transparent = true
            next.depthWrite = false
            next.side = THREE.DoubleSide
          }
          if (next.opacity < 1) {
            next.transparent = true
            next.depthWrite = false
            next.side = THREE.DoubleSide
          }
        }
        return next
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material)
    })
    return clone
  }, [emphasisEnabled, lvadEmphasis, source.scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root])
  const clip = source.animations.find((animation) => animation.name === 'CardiacCycle')
  const playableClip = useMemo(() => {
    if (!clip || aorticValveOpening) return clip
    return new THREE.AnimationClip(
      `${clip.name}_ClosedAorticValve`,
      clip.duration,
      clip.tracks.filter((track) => !track.name.includes('CT_Valve_Aortic_')),
    )
  }, [aorticValveOpening, clip])

  useEffect(() => {
    if (!playableClip) return
    if (!aorticValveOpening) {
      root.traverse((object) => {
        if (
          !(object instanceof THREE.Mesh) ||
          !object.name.includes('CT_Valve_Aortic_') ||
          !object.morphTargetInfluences
        ) {
          return
        }
        object.morphTargetInfluences.fill(0)
      })
    }
    const action = mixer.clipAction(playableClip, root)
    action.reset().play()
    if (reducedMotion) {
      action.paused = true
      mixer.setTime(playableClip.duration * 0.12)
    }
    return () => {
      action.stop()
      mixer.uncacheAction(playableClip, root)
    }
  }, [aorticValveOpening, mixer, playableClip, reducedMotion, root])

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
    if (!playableClip || paused || reducedMotion) return
    const cyclesPerSecond = THREE.MathUtils.clamp(heartRateBpm, 25, 220) / 60
    mixer.update(delta * playableClip.duration * cyclesPerSecond)
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

useGLTF.preload(REALISTIC_HEART_MODEL_URL, '/draco/')
