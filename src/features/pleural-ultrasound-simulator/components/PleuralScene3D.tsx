'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { Bounds, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import type { PleuralProbeState, PleuralSimulatorCase } from '../types'
import { beamDirection, probeOrigin } from '../engine/sectorGeometry'
import { NeedlePathOverlay } from './NeedlePathOverlay'

interface PleuralScene3DProps {
  caseData: PleuralSimulatorCase
  probe: PleuralProbeState
  needleUnsafe: boolean
}

export function PleuralScene3D({ caseData, probe, needleUnsafe }: PleuralScene3DProps) {
  return (
    <article className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/80 px-5 py-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Patient-space model</h3>
          <p className="text-sm text-muted-foreground">
            Probe pose, fluid pocket, diaphragm, and organs
          </p>
        </div>
        <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
          <LegendSwatch color="#2563eb" label="Fluid" />
          <LegendSwatch color="#f59e0b" label="Path" />
        </div>
      </div>

      <div className="h-[32rem] bg-slate-950">
        <Canvas dpr={[1, 1.75]}>
          <PerspectiveCamera makeDefault position={[0, -820, -310]} near={0.1} far={5000} />
          <ambientLight intensity={0.65} />
          <directionalLight position={[260, -520, 220]} intensity={1.6} />
          <directionalLight position={[-260, 120, -620]} intensity={0.75} />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.12}>
              <group>
                <PleuralModel meshUrl={caseData.meshUrl} />
                <ProbeMarker probe={probe} probeModelUrl={caseData.probeModelUrl} />
                <NeedlePathOverlay probe={probe} unsafe={needleUnsafe} />
              </group>
            </Bounds>
          </Suspense>
          <OrbitControls
            enablePan
            makeDefault
            target={[0, -150, -340]}
            minDistance={160}
            maxDistance={980}
          />
        </Canvas>
      </div>
    </article>
  )
}

function PleuralModel({ meshUrl }: { meshUrl: string }) {
  const gltf = useGLTF(meshUrl)

  useEffect(() => {
    const slicerRoot = gltf.scene.children.find((child) => child.name.includes('_Models'))
    if (slicerRoot) {
      slicerRoot.scale.set(1, 1, 1)
      slicerRoot.rotation.set(0, 0, 0)
      slicerRoot.quaternion.identity()
      slicerRoot.updateMatrixWorld(true)
    }

    gltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) {
        return
      }

      const name = mesh.name.toLowerCase()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          continue
        }

        material.roughness = 0.72
        material.metalness = 0.02
        material.side = THREE.DoubleSide

        if (name.includes('pleural effusion')) {
          material.color.set('#2563eb')
          material.transparent = true
          material.opacity = 0.72
          material.depthWrite = false
        } else if (name.includes('skin')) {
          material.color.set('#f0b28d')
          material.transparent = true
          material.opacity = 0.2
          material.depthWrite = false
        } else if (name.includes('diaphragm')) {
          material.color.set('#f59e0b')
          material.transparent = true
          material.opacity = 0.64
        } else if (name.includes('lung')) {
          material.color.set('#d8a987')
          material.transparent = true
          material.opacity = 0.44
          material.depthWrite = false
        } else if (name.includes('bone')) {
          material.color.set('#f8fafc')
          material.transparent = true
          material.opacity = 0.72
        } else if (name.includes('liver') || name.includes('spleen')) {
          material.color.set(name.includes('liver') ? '#b45309' : '#7c3aed')
          material.transparent = true
          material.opacity = 0.62
        } else {
          material.transparent = true
          material.opacity = 0.16
          material.depthWrite = false
        }
      }
    })
  }, [gltf.scene])

  return <primitive object={gltf.scene} />
}

function ProbeMarker({
  probe,
  probeModelUrl,
}: {
  probe: PleuralProbeState
  probeModelUrl?: string
}) {
  if (probeModelUrl) {
    return <UltrasoundProbeModel probe={probe} probeModelUrl={probeModelUrl} />
  }

  return <FallbackProbeMarker probe={probe} />
}

function UltrasoundProbeModel({
  probe,
  probeModelUrl,
}: {
  probe: PleuralProbeState
  probeModelUrl: string
}) {
  const gltf = useGLTF(probeModelUrl)
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const origin = probeOrigin(probe)

  const quaternion = useMemo(() => {
    const centralBeam = beamDirection(probe, 0)
    const displayAxis = new THREE.Vector3(
      centralBeam[0],
      centralBeam[1],
      centralBeam[2],
    ).normalize()

    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), displayAxis)
  }, [probe])

  useEffect(() => {
    model.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) {
        return
      }

      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.renderOrder = 20
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          continue
        }

        material.roughness = 0.58
        material.metalness = 0.08
        material.depthTest = false
        material.color.lerp(new THREE.Color('#e5e7eb'), 0.32)
      }
    })
  }, [model])

  return (
    <group position={origin} quaternion={quaternion}>
      <mesh position={[0, -2.5, 0]}>
        <boxGeometry args={[34, 4, 13]} />
        <meshStandardMaterial color="#111827" roughness={0.4} depthTest={false} />
      </mesh>
      <group position={[0, -68, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={70}>
        <primitive object={model} />
      </group>
    </group>
  )
}

function FallbackProbeMarker({ probe }: { probe: PleuralProbeState }) {
  const origin = probeOrigin(probe)
  const unsafeColor = '#0f172a'

  return (
    <group position={origin}>
      <mesh>
        <boxGeometry args={[42, 7, 20]} />
        <meshStandardMaterial color={unsafeColor} roughness={0.45} />
      </mesh>
      <mesh position={[0, -7, 0]}>
        <coneGeometry args={[8, 20, 24]} />
        <meshStandardMaterial color="#38bdf8" emissive="#075985" emissiveIntensity={0.2} />
      </mesh>
    </group>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
