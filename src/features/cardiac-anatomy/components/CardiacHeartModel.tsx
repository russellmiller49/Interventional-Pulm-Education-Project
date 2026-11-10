'use client'

import { useEffect, useMemo } from 'react'
import { Html, useGLTF } from '@react-three/drei'
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
  /**
   * Mesh names to light (`CT_RA_Cavity`, `CT_Aorta`, …): the named structures brighten and turn
   * more solid and the rest dim, until the list is empty again. Display only; the heart beats on.
   */
  highlightMeshNames?: readonly string[]
  /**
   * Name labels pinned to structures: each sits at the centre of the named mesh and turns with
   * the model. They are DOM text over the canvas, so they stay sharp and can be styled by the
   * caller through `labelClassName`. Absent or empty, nothing is drawn.
   */
  labels?: readonly { readonly meshName: string; readonly text: string }[]
  labelClassName?: string
  /**
   * How far each label is pushed out from the middle of the labelled structures, as a multiple of
   * its own distance from that middle. The chambers of a heart overlap from any one side, so at 1
   * the labels sit on top of each other; above 1 they fan out toward the edge of their structure.
   */
  labelSpread?: number
}

const HIGHLIGHT_COLOR = new THREE.Color('#ffd166')

export function CardiacHeartModel({
  heartRateBpm,
  aorticValveOpening = true,
  deviceEmphasis = false,
  paused = false,
  reducedMotion = false,
  highlightMeshNames,
  labels,
  labelClassName,
  labelSpread = 1,
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
  /*
   * Every mesh owns its materials (cloned above), so a structure can be lit without touching its
   * neighbours. Each material remembers the look it was built with and returns to it.
   */
  const highlightKey = (highlightMeshNames ?? []).join('|')
  useEffect(() => {
    const wanted = new Set(highlightKey ? highlightKey.split('|') : [])
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue
        const base = (material.userData.base ??= {
          opacity: material.opacity,
          emissive: material.emissive.clone(),
          emissiveIntensity: material.emissiveIntensity,
        }) as { opacity: number; emissive: THREE.Color; emissiveIntensity: number }
        if (wanted.size === 0) {
          material.opacity = base.opacity
          material.emissive.copy(base.emissive)
          material.emissiveIntensity = base.emissiveIntensity
        } else if (wanted.has(object.name)) {
          material.opacity = Math.max(base.opacity, 0.78)
          material.emissive.copy(HIGHLIGHT_COLOR)
          material.emissiveIntensity = 0.6
        } else {
          material.opacity = base.opacity * 0.55
          material.emissive.copy(base.emissive)
          material.emissiveIntensity = base.emissiveIntensity
        }
      }
    })
  }, [highlightKey, root])
  const labelKey = (labels ?? []).map((label) => `${label.meshName}=${label.text}`).join('|')
  const pins = useMemo(() => {
    if (!labelKey) return []
    root.updateMatrixWorld(true)
    const box = new THREE.Box3()
    const centres = labelKey.split('|').flatMap((entry) => {
      const [meshName, text] = entry.split('=')
      const mesh = root.getObjectByName(meshName)
      return mesh
        ? [{ meshName, text, centre: box.setFromObject(mesh).getCenter(new THREE.Vector3()) }]
        : []
    })
    const middle = centres
      .reduce((sum, entry) => sum.add(entry.centre), new THREE.Vector3())
      .divideScalar(Math.max(1, centres.length))
    return centres.map(({ meshName, text, centre }) => {
      const spread = centre.clone().sub(middle).multiplyScalar(labelSpread).add(middle)
      return { meshName, text, position: [spread.x, spread.y, spread.z] as const }
    })
  }, [labelKey, labelSpread, root])
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
      {pins.map((pin) => (
        <Html
          key={pin.meshName}
          position={pin.position}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className={labelClassName} data-heart-label={pin.meshName}>
            {pin.text}
          </span>
        </Html>
      ))}
    </group>
  )
}

useGLTF.preload(REALISTIC_HEART_MODEL_URL, '/draco/')
