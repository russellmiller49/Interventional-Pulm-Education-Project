'use client'

import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import {
  LEGEND_LOBES,
  LOBE_LABELS,
  getNode,
  glbNodeToAirwayId,
  lobeColor,
  resolveHighlightIds,
} from '@/lib/airway-anatomy-lesson/airway-graph'
import { cn } from '@/lib/cn'

import { CanvasErrorBoundary } from './CanvasErrorBoundary'

const MODEL_URL = '/fluoroview/airway_segments_new.glb'
const DRACO_PATH = '/fluoroview/draco/'
// The GLB is authored in LPS millimetres (superior along +Z). Rotate so the
// trachea points up and the tree faces the camera anteriorly.
const MODEL_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]
// Longest model dimension is normalized to this many world units so a static
// camera frames it regardless of the source millimetre scale.
const TARGET_SIZE = 2.2

interface Airway3DModelProps {
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}

useGLTF.preload(MODEL_URL, DRACO_PATH)

function AirwaySegments({
  selectedId,
  onSelect,
  onHover,
  hoveredId,
}: {
  selectedId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  hoveredId: string | null
}) {
  const gltf = useGLTF(MODEL_URL, DRACO_PATH)

  // Tag each mesh with its airway id, recolor by lobe, hide untagged duplicates,
  // and normalize the LPS-coordinate model (recenter + scale to a fixed size) so
  // a static camera always frames it — no camera mutation, no controls race.
  // Traversing gltf.scene inside the effect (rather than a memoized array) keeps
  // the imperative three.js mutation local to the loaded object.
  useEffect(() => {
    let taggedCount = 0
    const allMeshes: THREE.Mesh[] = []
    const walk = (obj: THREE.Object3D, inheritedId: string | undefined) => {
      const mappedId = glbNodeToAirwayId(obj.name) ?? inheritedId
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        allMeshes.push(mesh)
        const node = mappedId ? getNode(mappedId) : undefined
        if (node) {
          const base = new THREE.Color(lobeColor(node.lobe))
          const material = (
            Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
          ).clone() as THREE.MeshStandardMaterial
          material.transparent = true
          material.opacity = 0.92
          material.color = base.clone()
          material.emissive = new THREE.Color(0x000000)
          material.roughness = 0.55
          material.metalness = 0.05
          mesh.material = material
          mesh.userData.airwayId = mappedId
          mesh.userData.baseColor = base
          mesh.visible = true
          taggedCount += 1
        } else {
          mesh.visible = false
        }
      }
      obj.children.forEach((child) => walk(child, mappedId))
    }
    walk(gltf.scene, undefined)

    // Safety net: if the asset's node names ever change so nothing maps, show
    // the whole model in a neutral tint rather than a blank canvas.
    if (taggedCount === 0) {
      for (const mesh of allMeshes) {
        const material = (
          Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        ).clone() as THREE.MeshStandardMaterial
        material.transparent = true
        material.opacity = 0.9
        material.color = new THREE.Color('#8fa3bf')
        material.emissive = new THREE.Color(0x000000)
        mesh.material = material
        mesh.visible = true
      }
    }

    // Reset transform first so the normalization is idempotent under React
    // strict-mode double-invocation, then fit the model into a ~2-unit box
    // centered at the origin.
    gltf.scene.position.set(0, 0, 0)
    gltf.scene.scale.set(1, 1, 1)
    const box = new THREE.Box3().setFromObject(gltf.scene)
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z) || 1
      const scale = TARGET_SIZE / maxDim
      gltf.scene.scale.setScalar(scale)
      gltf.scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
    }
  }, [gltf.scene])

  // Apply selection / hover styling by traversing the tagged scene.
  useEffect(() => {
    const highlight = selectedId ? resolveHighlightIds(selectedId) : null
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const airwayId = (mesh.userData as { airwayId?: string }).airwayId
      const base = (mesh.userData as { baseColor?: THREE.Color }).baseColor
      if (!airwayId || !base) return
      const material = mesh.material as THREE.MeshStandardMaterial
      const isSelected = highlight?.has(airwayId) ?? false
      const isHovered = hoveredId === airwayId
      material.color.copy(base)
      if (highlight && !isSelected && !isHovered) {
        material.opacity = 0.1
        material.emissive.setHex(0x000000)
      } else {
        material.opacity = isSelected || isHovered ? 1 : 0.92
        if (isSelected || isHovered) {
          material.emissive.copy(base).multiplyScalar(0.55)
        } else {
          material.emissive.setHex(0x000000)
        }
      }
    })
  }, [gltf.scene, selectedId, hoveredId])

  return (
    <group rotation={MODEL_ROTATION}>
      <primitive
        object={gltf.scene}
        onPointerMove={(event: { object: THREE.Object3D; stopPropagation: () => void }) => {
          event.stopPropagation()
          const id = (event.object.userData as { airwayId?: string }).airwayId
          if (id) onHover(id)
        }}
        onPointerOut={() => onHover(null)}
        onClick={(event: { object: THREE.Object3D; stopPropagation: () => void }) => {
          event.stopPropagation()
          const id = (event.object.userData as { airwayId?: string }).airwayId
          if (id) onSelect(id)
        }}
      />
    </group>
  )
}

export function Airway3DModel({ selectedId, onSelect, className }: Airway3DModelProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const labelId = hoveredId ?? selectedId
  const labelNode = labelId ? getNode(labelId) : undefined

  return (
    <div
      className={cn(
        'relative h-[440px] w-full overflow-hidden rounded-2xl border border-border/70 bg-slate-950',
        className,
      )}
    >
      <CanvasErrorBoundary
        fallback={
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-slate-400">
            The 3D model could not be displayed here. Use the labeled tree diagram and detail panel
            to explore the segmental anatomy.
          </div>
        }
      >
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0.4, 3.4], fov: 35, near: 0.01, far: 100 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={[0x070b12]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[300, 400, 500]} intensity={1.1} />
          <directionalLight position={[-300, -200, -300]} intensity={0.4} color={0x9bb8ff} />
          <Suspense fallback={null}>
            <AirwaySegments
              selectedId={selectedId}
              onSelect={onSelect}
              hoveredId={hoveredId}
              onHover={setHoveredId}
            />
          </Suspense>
          <OrbitControls makeDefault enablePan enableZoom enableRotate />
        </Canvas>
      </CanvasErrorBoundary>

      {/* Hover / selection label */}
      {labelNode && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-lg bg-black/70 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: lobeColor(labelNode.lobe) }}
              aria-hidden
            />
            <span className="text-sm font-semibold text-white">{labelNode.fullName}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1">
        {LEGEND_LOBES.map((lobe) => (
          <span key={lobe} className="flex items-center gap-1.5">
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: lobeColor(lobe) }}
              aria-hidden
            />
            <span className="text-[10px] font-medium text-slate-300">{LOBE_LABELS[lobe]}</span>
          </span>
        ))}
      </div>

      <span className="pointer-events-none absolute right-3 top-3 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
        Drag to rotate · scroll to zoom
      </span>
    </div>
  )
}
