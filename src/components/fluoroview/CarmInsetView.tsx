'use client'

import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import type { CArmManifest } from '@fluoroview/types'

interface CarmInsetViewProps {
  raoLao: number
  cranialCaudal: number
  cArm: CArmManifest
  airwayGlbUri?: string
  dracoBaseUrl?: string
  className?: string
}

function GantryGlb({
  glbUri,
  raoLao,
  cranialCaudal,
  dracoBaseUrl,
}: {
  glbUri: string
  raoLao: number
  cranialCaudal: number
  dracoBaseUrl?: string
}) {
  const gltf = useGLTF(glbUri, dracoBaseUrl)
  const { scene, center, scale } = useMemo(() => {
    const cloned = gltf.scene.clone(true)
    const box = new THREE.Box3().setFromObject(cloned)
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)
    const scale = 520 / Math.max(size.x, size.y, size.z, 1)
    return { scene: cloned, center, scale }
  }, [gltf.scene])

  return (
    <group
      rotation={[THREE.MathUtils.degToRad(cranialCaudal), THREE.MathUtils.degToRad(raoLao), 0]}
      scale={scale}
      position={[-center.x * scale, -center.y * scale, -center.z * scale]}
    >
      <primitive object={scene} />
    </group>
  )
}

function SchematicGantry({ raoLao, cranialCaudal }: { raoLao: number; cranialCaudal: number }) {
  return (
    <group
      rotation={[THREE.MathUtils.degToRad(cranialCaudal), THREE.MathUtils.degToRad(raoLao), 0]}
    >
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[210, 16, 18, 72, Math.PI * 1.35]} />
        <meshStandardMaterial color="#d6e4f0" metalness={0.45} roughness={0.38} />
      </mesh>
      <mesh position={[0, -235, 0]}>
        <sphereGeometry args={[24, 24, 18]} />
        <meshStandardMaterial color="#fde68a" emissive="#facc15" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 235, 0]}>
        <boxGeometry args={[170, 18, 120]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[120, 430, 4, 1, true]} />
        <meshBasicMaterial
          color="#fde047"
          transparent
          opacity={0.16}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function DetectorPlane({ raoLao, cranialCaudal }: { raoLao: number; cranialCaudal: number }) {
  return (
    <mesh
      position={[0, 250, 0]}
      rotation={[THREE.MathUtils.degToRad(cranialCaudal), THREE.MathUtils.degToRad(raoLao), 0]}
    >
      <planeGeometry args={[180, 130]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function CarmInsetView({
  raoLao,
  cranialCaudal,
  cArm,
  dracoBaseUrl,
  className,
}: CarmInsetViewProps) {
  const sad = cArm.sadMm ?? cArm.sad ?? 600
  const sid = cArm.sidMm ?? cArm.sid ?? 1200
  void sad
  void sid

  return (
    <div
      className={
        className ??
        'pointer-events-none absolute bottom-3 right-3 h-48 w-48 overflow-hidden rounded-lg border border-white/15 bg-slate-950/70 shadow-lg backdrop-blur-sm'
      }
      aria-label="C-arm gantry orientation"
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [620, 520, 720], fov: 32, near: 1, far: 4000 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.62} />
        <directionalLight position={[700, 900, 500]} intensity={1.05} />
        <directionalLight position={[-500, -400, 250]} intensity={0.38} color={0xcfe4ff} />
        <Suspense fallback={<SchematicGantry raoLao={raoLao} cranialCaudal={cranialCaudal} />}>
          {cArm.gantryGlbUri ? (
            <GantryGlb
              glbUri={cArm.gantryGlbUri}
              raoLao={raoLao}
              cranialCaudal={cranialCaudal}
              dracoBaseUrl={dracoBaseUrl}
            />
          ) : (
            <SchematicGantry raoLao={raoLao} cranialCaudal={cranialCaudal} />
          )}
          <DetectorPlane raoLao={raoLao} cranialCaudal={cranialCaudal} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-200">
        C-arm
      </div>
    </div>
  )
}
