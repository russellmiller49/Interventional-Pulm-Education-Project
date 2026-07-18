'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clone, Html, useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

import { CLAMP_ASSET } from './constants'
import styles from '../cardiohelp-ecmo.module.css'

// The interactive tubing clamp: GLB instrument aligned to the limb at its
// station, damped jaw close synchronized with the tube's shader pinch (the
// parent drives both from one value), hover emissive affordance, and a small
// in-scene "FLOW ISOLATED" chip when closed. The DOM ClampControl buttons in
// the shell remain the canonical accessible control.

export function InteractiveClamp({
  limb,
  curve,
  curvePosition,
  closed,
  controlsEnabled,
  reduceMotion,
  onToggle,
}: {
  limb: 'drainage' | 'return'
  curve: THREE.CatmullRomCurve3
  curvePosition: number
  closed: boolean
  controlsEnabled: boolean
  reduceMotion: boolean
  onToggle: () => void
}) {
  const { scene } = useGLTF(CLAMP_ASSET)
  const instrument = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const hoverMaterials = useRef<THREE.MeshStandardMaterial[]>([])

  const { point, alignment } = useMemo(() => {
    const stationPoint = curve.getPointAt(curvePosition)
    const tangent = curve.getTangentAt(curvePosition).normalize()
    return {
      point: stationPoint,
      alignment: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent),
    }
  }, [curve, curvePosition])

  useFrame((_, delta) => {
    if (!instrument.current) return
    const targetTilt = closed ? 0 : -0.72
    const targetHeight = closed ? 0.012 : 0.075
    if (reduceMotion) {
      instrument.current.rotation.x = targetTilt
      instrument.current.position.y = targetHeight
      return
    }
    instrument.current.rotation.x = THREE.MathUtils.damp(
      instrument.current.rotation.x,
      targetTilt,
      9,
      delta,
    )
    instrument.current.position.y = THREE.MathUtils.damp(
      instrument.current.position.y,
      targetHeight,
      9,
      delta,
    )
  })

  useEffect(() => {
    for (const material of hoverMaterials.current) {
      material.emissive.set(hovered && controlsEnabled ? '#71e1e5' : '#000000')
      material.emissiveIntensity = hovered && controlsEnabled ? 0.35 : 0
    }
    document.body.style.cursor = hovered && controlsEnabled ? 'pointer' : ''
  }, [controlsEnabled, hovered])

  useEffect(
    () => () => {
      document.body.style.cursor = ''
    },
    [],
  )

  function collectHoverMaterials(root: THREE.Object3D) {
    const collected: THREE.MeshStandardMaterial[] = []
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) collected.push(material)
        }
      }
    })
    hoverMaterials.current = collected
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if (controlsEnabled) onToggle()
  }

  return (
    <group position={point} quaternion={alignment}>
      <group
        ref={(node) => {
          instrument.current = node
          if (node) collectHoverMaterials(node)
        }}
        position={[0.076, closed ? 0.012 : 0.075, 0]}
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <Clone object={scene} castShadow receiveShadow />
      </group>
      {closed ? (
        <>
          <Html
            center
            position={[0, 0.16, 0]}
            zIndexRange={[50, 0]}
            wrapperClass={styles.sceneHtml}
          >
            <span className={styles.circuit3dSceneChip} data-limb={limb}>
              FLOW ISOLATED
            </span>
          </Html>
          <pointLight color="#ff645f" intensity={0.55} distance={0.35} />
        </>
      ) : null}
      <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.065, 0.005, 8, 32]} />
        <meshBasicMaterial color={closed ? '#ff6b73' : '#76d69b'} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.07, 0]} visible={false} onClick={handleClick}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}
