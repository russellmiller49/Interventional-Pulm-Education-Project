'use client'

import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import {
  Color,
  DoubleSide,
  MeshStandardMaterial,
  type Material,
  type Mesh,
  type Object3D,
} from 'three'

import type {
  StentExample,
  StentModelAsset,
} from '@/features/airway-stent-mechanics/content/stentExamples'
import type { StentExamplePose } from '@/features/airway-stent-mechanics/engine/exampleAnimations'

const DRACO_PATH = '/draco/'

function forEachMaterial(mesh: Mesh, callback: (material: Material) => void) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  materials.forEach(callback)
}

function cloneScene(source: Object3D) {
  const cloned = source.clone(true)
  cloned.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone()
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.updateMorphTargets()
    forEachMaterial(mesh, (material) => {
      material.userData.baseOpacity = 'opacity' in material ? material.opacity : 1
    })
  })
  return cloned
}

function disposeClonedMaterials(scene: Object3D) {
  scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    forEachMaterial(mesh, (material) => material.dispose())
  })
}

function applyMorphWeights(scene: Object3D, weights: Record<string, number>) {
  scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return
    for (const [name, value] of Object.entries(weights)) {
      const index = mesh.morphTargetDictionary[name]
      if (typeof index === 'number') mesh.morphTargetInfluences[index] = value
    }
  })
}

function applyOpacity(scene: Object3D, opacity: number, tint?: string) {
  scene.visible = opacity > 0.015
  scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    forEachMaterial(mesh, (material) => {
      if (!('opacity' in material)) return
      const baseOpacity = Number(material.userData.baseOpacity ?? 1)
      material.transparent = opacity < 0.995 || baseOpacity < 0.995
      material.opacity = baseOpacity * opacity
      material.depthWrite = opacity > 0.94
      if (tint && material instanceof MeshStandardMaterial) {
        material.color.lerp(new Color(tint), 0.34)
      }
      material.needsUpdate = true
    })
  })
}

function LoadedModel({
  asset,
  morphs,
  opacity = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  tint,
}: {
  asset: StentModelAsset
  morphs: Record<string, number>
  opacity?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  tint?: string
}) {
  const gltf = useGLTF(asset.url, DRACO_PATH)
  const scene = useMemo(() => cloneScene(gltf.scene), [gltf.scene])

  useEffect(() => () => disposeClonedMaterials(scene), [scene])

  useEffect(() => {
    applyMorphWeights(scene, morphs)
    applyOpacity(scene, opacity, tint)
  }, [morphs, opacity, scene, tint])

  return (
    <primitive
      object={scene}
      position={position}
      rotation={rotation}
      scale={scale}
      dispose={null}
    />
  )
}

function PhantomMaterial() {
  return (
    <meshPhysicalMaterial
      color="#d99991"
      depthWrite={false}
      opacity={0.2}
      roughness={0.72}
      side={DoubleSide}
      transparent
    />
  )
}

function AirwayPhantom() {
  return (
    <group>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.58, 0.58, 2.6, 40, 1, true]} />
        <PhantomMaterial />
      </mesh>
      <mesh position={[-0.63, -0.94, 0]} rotation={[0, 0, -0.62]}>
        <cylinderGeometry args={[0.46, 0.5, 2.05, 40, 1, true]} />
        <PhantomMaterial />
      </mesh>
      <mesh position={[0.68, -0.9, 0]} rotation={[0, 0, 0.68]}>
        <cylinderGeometry args={[0.42, 0.48, 2.05, 40, 1, true]} />
        <PhantomMaterial />
      </mesh>
    </group>
  )
}

function Marker({
  number,
  position,
  intensity,
}: {
  number: number
  position: [number, number, number]
  intensity: number
}) {
  if (intensity <= 0.01) return null
  return (
    <group position={position} scale={0.7 + intensity * 0.3}>
      <mesh>
        <sphereGeometry args={[0.13, 20, 14]} />
        <meshBasicMaterial color="#fb7185" opacity={0.35 + intensity * 0.6} transparent />
      </mesh>
      <Html center distanceFactor={9} style={{ opacity: intensity }}>
        <span className="pointer-events-none flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-rose-500 text-[11px] font-bold text-white shadow-lg">
          {number}
        </span>
      </Html>
    </group>
  )
}

function ExampleMarkers({ example, intensity }: { example: StentExample; intensity: number }) {
  const positions: Record<string, Array<[number, number, number]>> = {
    deployment: [
      [0.04, 0.38, 0.52],
      [0.62, 0.02, 0.18],
      [-0.48, 0.05, 0.1],
    ],
    architecture: [
      [0.28, 0.55, 0.25],
      [-0.28, 0.02, 0.34],
      [0.18, -1.28, 0.14],
    ],
    cover: [
      [-0.34, 0.45, 0.3],
      [0.34, -0.05, 0.32],
      [0.16, 1.72, 0.1],
    ],
    bend: [
      [-0.38, 0.08, 0.2],
      [0.55, 0.35, 0.12],
      [0.56, 1.66, 0.04],
    ],
    fatigue: [
      [0.3, 0.16, 0.32],
      [0.54, 0.76, 0.12],
      [0.18, 1.7, 0.08],
    ],
    'y-anchoring': [
      [0, 1.52, 0.18],
      [0, -0.42, 0.32],
      [0.92, -1.25, 0.1],
    ],
  }
  return (
    <group>
      {positions[example.sceneKind].map((position, index) => (
        <Marker
          key={`${example.id}-${index}`}
          number={index + 1}
          position={position}
          intensity={intensity}
        />
      ))}
    </group>
  )
}

function ModelLoading() {
  return (
    <Html center>
      <div className="w-44 rounded-2xl border border-slate-600 bg-slate-950/90 px-4 py-3 text-center text-xs text-slate-200 shadow-xl">
        Loading optimized model…
      </div>
    </Html>
  )
}

export function StentExampleScene({
  asset,
  airwayAsset,
  example,
  pairedAsset,
  pose,
  revealed,
}: {
  asset: StentModelAsset
  airwayAsset: StentModelAsset
  example: StentExample
  pairedAsset?: StentModelAsset
  pose: StentExamplePose
  revealed: boolean
}) {
  const stentMorphs = useMemo(
    () => ({
      RadialCompression: pose.radialCompression,
      Ovalization: pose.ovalization,
      Bend: pose.bend,
    }),
    [pose.bend, pose.ovalization, pose.radialCompression],
  )
  const airwayMorphs = useMemo(
    () => ({
      StenosisRelief: pose.stenosisRelief,
      CoughOvalization: pose.airwayCoughOvalization,
    }),
    [pose.airwayCoughOvalization, pose.stenosisRelief],
  )
  const contentScale =
    example.sceneKind === 'deployment' ? 0.84 : example.sceneKind === 'y-anchoring' ? 0.8 : 1

  return (
    <>
      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#e0f2fe', '#172033', 1.2]} />
      <directionalLight position={[4, 6, 7]} intensity={2.2} color="#e0f2fe" />
      <directionalLight position={[-4, 1, 2]} intensity={0.9} color="#38bdf8" />
      <pointLight position={[0, -3, 3]} intensity={0.65} color="#fb7185" />

      <group scale={contentScale}>
        {example.sceneKind === 'deployment' ? (
          <group>
            <LoadedModel asset={airwayAsset} morphs={airwayMorphs} opacity={0.66} scale={2.25} />
            <LoadedModel
              asset={asset}
              morphs={stentMorphs}
              position={[0.02, pose.stentOffsetY - 0.08, 0.04]}
              rotation={[0, 0, pose.stentRotationZ]}
              scale={1.12}
            />
          </group>
        ) : null}

        {example.sceneKind === 'cover' && pairedAsset ? (
          <group>
            <LoadedModel
              asset={asset}
              morphs={stentMorphs}
              opacity={pose.uncoveredOpacity}
              scale={2.08}
            />
            <LoadedModel
              asset={pairedAsset}
              morphs={stentMorphs}
              opacity={pose.coveredOpacity}
              scale={2.08}
            />
          </group>
        ) : null}

        {example.sceneKind === 'y-anchoring' ? (
          <group>
            <AirwayPhantom />
            <LoadedModel
              asset={asset}
              morphs={stentMorphs}
              position={[0, pose.stentOffsetY - 0.08, 0]}
              rotation={[0, 0, pose.stentRotationZ]}
              scale={1.7}
            />
          </group>
        ) : null}

        {['architecture', 'bend', 'fatigue'].includes(example.sceneKind) ? (
          <LoadedModel
            asset={asset}
            morphs={stentMorphs}
            position={[0, pose.stentOffsetY, 0]}
            rotation={[0, 0, pose.stentRotationZ]}
            scale={2.08}
          />
        ) : null}

        {revealed ? (
          <ExampleMarkers example={example} intensity={pose.annotationIntensity} />
        ) : null}
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4.8}
        maxDistance={11}
        minPolarAngle={0.25}
        maxPolarAngle={2.9}
        target={[0, 0, 0]}
      />
    </>
  )
}

export { ModelLoading }
