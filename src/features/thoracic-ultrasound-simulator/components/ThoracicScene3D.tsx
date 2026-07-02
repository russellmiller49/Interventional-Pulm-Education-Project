'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import type {
  LabelBounds,
  ProbeStateKey,
  ThoracicCaseManifest,
  ThoracicProbeState,
  ThoracicStructureLabelDef,
  StructureCategory,
} from '../types'
import {
  beamDirection,
  needleEndpoint,
  probeOrigin,
  projectBeamToWorld,
} from '../engine/sectorGeometry'
import { structureForMeshName } from '../loader/meshNaming'
import type { ProbeStore } from '../state/probeStore'
import { useProbeState } from '../state/probeStore'
import { activeProbePreset } from './ThoracicProbeControls'
import { HandoffContent } from '@/i18n/handoff'

const degreesToRadians = Math.PI / 180
const FAN_SEGMENTS = 24

interface ThoracicScene3DProps {
  manifest: ThoracicCaseManifest
  store: ProbeStore
  needleUnsafe: boolean
}

let webglDetectionCache: boolean | null = null

function detectWebGL() {
  if (webglDetectionCache !== null) {
    return webglDetectionCache
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }
  try {
    const canvas = document.createElement('canvas')
    webglDetectionCache = Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') ?? canvas.getContext('webgl')),
    )
  } catch {
    webglDetectionCache = false
  }
  return webglDetectionCache
}

const subscribeNever = () => () => {}

function volumeCenterAndRadius(manifest: ThoracicCaseManifest) {
  const { sizeXyz, spacingXyzMm, originLpsMm } = manifest.primaryLabelVolume.geometry
  const extent = [
    sizeXyz[0] * spacingXyzMm[0],
    sizeXyz[1] * spacingXyzMm[1],
    sizeXyz[2] * spacingXyzMm[2],
  ]
  const center: [number, number, number] = [
    originLpsMm[0] + extent[0] / 2,
    originLpsMm[1] + extent[1] / 2,
    originLpsMm[2] + extent[2] / 2,
  ]
  const radius = Math.hypot(extent[0], extent[1], extent[2]) / 2
  return { center, radius }
}

export function ThoracicScene3D({ manifest, store, needleUnsafe }: ThoracicScene3DProps) {
  // useSyncExternalStore keeps the server snapshot (false → SVG surface map)
  // distinct from the client detection without hydration drift; jsdom stays on
  // the fallback path permanently.
  const webglReady = useSyncExternalStore(subscribeNever, detectWebGL, () => false)

  const probe = useProbeState(store)
  const preset = activeProbePreset(manifest)
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [availableLabels, setAvailableLabels] = useState<string[]>([])

  const toggleStructures = useMemo(
    () => manifest.structures.filter((structure) => availableLabels.includes(structure.label)),
    [manifest.structures, availableLabels],
  )

  const clampToRanges = useCallback(
    (partial: Partial<ThoracicProbeState>): Partial<ThoracicProbeState> => {
      const clamped: Partial<ThoracicProbeState> = {}
      for (const [key, value] of Object.entries(partial) as [ProbeStateKey, number][]) {
        const range = preset.ranges[key]
        clamped[key] = range ? Math.min(range.max, Math.max(range.min, value)) : value
      }
      return clamped
    },
    [preset],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const current = store.getState()
      const move = event.shiftKey ? null : 2
      let partial: Partial<ThoracicProbeState> | null = null

      switch (event.key) {
        case 'ArrowLeft':
          partial = move
            ? { lateralMm: current.lateralMm - move }
            : { rotationDeg: current.rotationDeg - 1 }
          break
        case 'ArrowRight':
          partial = move
            ? { lateralMm: current.lateralMm + move }
            : { rotationDeg: current.rotationDeg + 1 }
          break
        case 'ArrowUp':
          partial = move
            ? { craniocaudalMm: current.craniocaudalMm + move }
            : { tiltDeg: current.tiltDeg + 1 }
          break
        case 'ArrowDown':
          partial = move
            ? { craniocaudalMm: current.craniocaudalMm - move }
            : { tiltDeg: current.tiltDeg - 1 }
          break
        default:
          return
      }

      event.preventDefault()
      store.setState(clampToRanges(partial))
    },
    [store, clampToRanges],
  )

  const pathColor = needleUnsafe ? '#f59e0b' : '#10b981'

  return (
    <HandoffContent>
      {
        <article className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border/80 px-5 py-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">3D scan view</h3>
              <p className="text-sm text-muted-foreground">
                Case model with probe pose, scan sector, and guide line
              </p>
            </div>
            <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
              <LegendSwatch color="#2563eb" label="Fluid" />
              <LegendSwatch color="#38bdf8" label="Scan sector" />
              <LegendSwatch color={pathColor} label="Path" />
            </div>
          </div>

          <div
            aria-label="3D probe positioning view. Use arrow keys to slide the probe; hold Shift to tilt and rotate."
            className="bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            onKeyDown={handleKeyDown}
            role="application"
            tabIndex={0}
          >
            {webglReady ? (
              <div className="h-[32rem] w-full">
                <Canvas
                  camera={{ position: [0, 0, 0], up: [0, 0, 1], near: 1, far: 6000, fov: 42 }}
                  dpr={[1, 2]}
                >
                  <Suspense fallback={null}>
                    <SceneContent
                      manifest={manifest}
                      store={store}
                      needleUnsafe={needleUnsafe}
                      visibility={visibility}
                      clampToRanges={clampToRanges}
                      onStructuresResolved={setAvailableLabels}
                    />
                  </Suspense>
                </Canvas>
              </div>
            ) : (
              <div className="px-3 py-4">
                <SurfaceMapFallback manifest={manifest} probe={probe} pathColor={pathColor} />
              </div>
            )}
          </div>

          {webglReady && toggleStructures.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-border/80 px-5 py-3">
              {toggleStructures.map((structure) => (
                <label
                  key={structure.label}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    checked={visibility[structure.label] ?? true}
                    onChange={(event) =>
                      setVisibility((previous) => ({
                        ...previous,
                        [structure.label]: event.target.checked,
                      }))
                    }
                    className="accent-sky-600"
                  />
                  {structure.color ? (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: structure.color }}
                    />
                  ) : null}
                  {structure.displayName}
                </label>
              ))}
            </div>
          ) : null}
        </article>
      }
    </HandoffContent>
  )
}

interface SceneContentProps {
  manifest: ThoracicCaseManifest
  store: ProbeStore
  needleUnsafe: boolean
  visibility: Record<string, boolean>
  clampToRanges: (partial: Partial<ThoracicProbeState>) => Partial<ThoracicProbeState>
  onStructuresResolved: (labels: string[]) => void
}

function SceneContent({
  manifest,
  store,
  needleUnsafe,
  visibility,
  clampToRanges,
  onStructuresResolved,
}: SceneContentProps) {
  const caseGltf = useGLTF(manifest.meshUrl)
  const { center, radius } = useMemo(() => volumeCenterAndRadius(manifest), [manifest])
  const [dragging, setDragging] = useState(false)
  const probeGroupRef = useRef<THREE.Group>(null)
  const meshesByLabelRef = useRef<Map<string, THREE.Mesh[]>>(new Map())

  const caseScene = useMemo(() => caseGltf.scene, [caseGltf.scene])

  // Classify GLB meshes against the manifest's structure vocabulary once per
  // load: claimed meshes become toggleable, unclaimed meshes are hidden to keep
  // the teaching scene focused, and chest-wall layers turn translucent so the
  // probe and interior structures stay visible.
  useEffect(() => {
    const claimed = new Map<string, THREE.Mesh[]>()

    normalizeCaseSceneToLpsMm(caseScene)

    caseScene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) {
        return
      }

      const structure = structureForMeshName(mesh.name, manifest.structures)
      if (!structure) {
        mesh.visible = false
        return
      }

      const meshes = claimed.get(structure.label) ?? []
      meshes.push(mesh)
      claimed.set(structure.label, meshes)

      applyStructureMaterial(mesh, structure)
    })

    meshesByLabelRef.current = claimed
    onStructuresResolved(Array.from(claimed.keys()))
  }, [caseScene, manifest.structures, onStructuresResolved])

  const fan = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((FAN_SEGMENTS + 2) * 3), 3),
    )
    const indices: number[] = []
    for (let segment = 0; segment < FAN_SEGMENTS; segment += 1) {
      indices.push(0, segment + 1, segment + 2)
    }
    geometry.setIndex(indices)
    const material = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    return new THREE.Mesh(geometry, material)
  }, [])

  const guideLine = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#10b981' }))
  }, [])

  useEffect(() => {
    ;(guideLine.material as THREE.LineBasicMaterial).color.set(needleUnsafe ? '#f59e0b' : '#10b981')
  }, [guideLine, needleUnsafe])

  useEffect(() => {
    return () => {
      fan.geometry.dispose()
      ;(fan.material as THREE.Material).dispose()
      guideLine.geometry.dispose()
      ;(guideLine.material as THREE.Material).dispose()
    }
  }, [fan, guideLine])

  const basisTemps = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      xAxis: new THREE.Vector3(),
      yAxis: new THREE.Vector3(),
      zAxis: new THREE.Vector3(),
    }),
    [],
  )

  // The scene reads the store imperatively every frame: dragging updates the
  // probe mesh, fan, and guide line without re-rendering the React tree.
  useFrame(() => {
    meshesByLabelRef.current.forEach((meshes, label) => {
      const visible = visibility[label] ?? true
      meshes.forEach((mesh) => {
        mesh.visible = visible
      })
    })

    const probe = store.getState()
    const origin = probeOrigin(probe)
    const maxDepthMm = probe.depthCm * 10

    const probeGroup = probeGroupRef.current
    if (probeGroup) {
      probeGroup.position.set(origin[0], origin[1], origin[2])
      const depth = beamDirection(probe, 0)
      const markerRad = probe.rotationDeg * degreesToRadians
      const { matrix, xAxis, yAxis, zAxis } = basisTemps
      yAxis.set(-depth[0], -depth[1], -depth[2])
      xAxis.set(Math.cos(markerRad), 0, Math.sin(markerRad))
      zAxis.crossVectors(xAxis, yAxis).normalize()
      xAxis.crossVectors(yAxis, zAxis).normalize()
      matrix.makeBasis(xAxis, yAxis, zAxis)
      probeGroup.quaternion.setFromRotationMatrix(matrix)
    }

    const fanPositions = fan.geometry.getAttribute('position') as THREE.BufferAttribute
    fanPositions.setXYZ(0, origin[0], origin[1], origin[2])
    for (let segment = 0; segment <= FAN_SEGMENTS; segment += 1) {
      const angle = probe.sectorAngleDeg * (segment / FAN_SEGMENTS - 0.5)
      const point = projectBeamToWorld(probe, angle, maxDepthMm)
      fanPositions.setXYZ(segment + 1, point[0], point[1], point[2])
    }
    fanPositions.needsUpdate = true
    fan.geometry.computeBoundingSphere()

    const guidePositions = guideLine.geometry.getAttribute('position') as THREE.BufferAttribute
    const guideEnd = needleEndpoint(probe, maxDepthMm)
    guidePositions.setXYZ(0, origin[0], origin[1], origin[2])
    guidePositions.setXYZ(1, guideEnd[0], guideEnd[1], guideEnd[2])
    guidePositions.needsUpdate = true
    guideLine.geometry.computeBoundingSphere()
  })

  const isSurfaceMesh = useCallback(
    (object: THREE.Object3D) => {
      const structure = structureForMeshName(object.name, manifest.structures)
      return structure?.label === 'skin'
    },
    [manifest.structures],
  )

  const moveProbeToPoint = useCallback(
    (point: THREE.Vector3) => {
      store.setState(
        clampToRanges({
          lateralMm: point.x,
          posteriorMm: point.y,
          craniocaudalMm: point.z,
        }),
      )
    },
    [store, clampToRanges],
  )

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!isSurfaceMesh(event.object)) {
        return
      }
      event.stopPropagation()
      setDragging(true)
      moveProbeToPoint(event.point)
    },
    [isSurfaceMesh, moveProbeToPoint],
  )

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!dragging || !isSurfaceMesh(event.object)) {
        return
      }
      event.stopPropagation()
      moveProbeToPoint(event.point)
    },
    [dragging, isSurfaceMesh, moveProbeToPoint],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(false)
    store.flushSync()
  }, [store])

  const cameraPosition = useMemo<[number, number, number]>(
    () => [center[0] + radius * 0.9, center[1] + radius * 1.5, center[2] + radius * 0.4],
    [center, radius],
  )

  return (
    <group>
      <SceneCamera position={cameraPosition} target={center} />
      <hemisphereLight args={['#e2e8f0', '#1e293b', 0.9]} />
      <directionalLight
        intensity={1.1}
        position={[center[0] + radius, center[1] + radius, center[2] + radius]}
      />
      <ambientLight intensity={0.35} />

      <primitive
        object={caseScene}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <group ref={probeGroupRef}>
        {manifest.probeModelUrl ? (
          <ProbeModel url={manifest.probeModelUrl} />
        ) : (
          <mesh position={[0, 16, 0]}>
            <boxGeometry args={[14, 32, 9]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
        )}
      </group>

      <primitive object={fan} />
      <primitive object={guideLine} />

      <OrbitControls
        enabled={!dragging}
        enablePan
        makeDefault
        target={new THREE.Vector3(center[0], center[1], center[2])}
      />
    </group>
  )
}

/** Positions the default camera once per case (declarative camera props are ignored after mount). */
function SceneCamera({
  position,
  target,
}: {
  position: [number, number, number]
  target: [number, number, number]
}) {
  useFrame(({ camera }) => {
    if (!camera.userData.thoracicPlaced) {
      camera.position.set(position[0], position[1], position[2])
      camera.up.set(0, 0, 1)
      camera.lookAt(target[0], target[1], target[2])
      camera.updateProjectionMatrix()
      camera.userData.thoracicPlaced = true
    }
  })
  return null
}

function normalizeCaseSceneToLpsMm(scene: THREE.Group | THREE.Scene) {
  for (const child of scene.children) {
    if (!hasMeshDescendant(child)) {
      continue
    }

    const maxScale = Math.max(
      Math.abs(child.scale.x),
      Math.abs(child.scale.y),
      Math.abs(child.scale.z),
    )
    const isMeterScaledExportRoot = maxScale > 0 && maxScale < 0.01

    if (!isMeterScaledExportRoot) {
      continue
    }

    // Slicer GLB exports can wrap millimetre LPS vertices in a transform that
    // converts them to glTF metres/Y-up. The simulator already uses LPS
    // millimetres for the probe, fan, labelmap, and case bounds, so remove that
    // export wrapper and render the actual segment surfaces in simulator space.
    child.position.set(0, 0, 0)
    child.quaternion.identity()
    child.scale.set(1, 1, 1)
    child.updateMatrixWorld(true)
  }

  scene.updateMatrixWorld(true)
}

function hasMeshDescendant(object: THREE.Object3D): boolean {
  let found = false
  object.traverse((candidate) => {
    if ((candidate as THREE.Mesh).isMesh) {
      found = true
    }
  })
  return found
}

function ProbeModel({ url }: { url: string }) {
  const gltf = useGLTF(url)
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  return <primitive object={model} position={[0, 6, 0]} scale={30} />
}

function structureOpacity(structure: ThoracicStructureLabelDef) {
  if (structure.label === 'skin') return 0.18
  if (structure.category === 'fluid') return 0.74
  if (structure.category === 'lung') return 0.3
  if (structure.category === 'chest-wall' && structure.label !== 'rib') return 0.42
  if (structure.label === 'rib') return 0.78
  return 0.82
}

function structureRenderOrder(category: StructureCategory) {
  switch (category) {
    case 'fluid':
      return 30
    case 'lung':
      return 25
    case 'diaphragm':
    case 'solid-organ':
      return 20
    case 'chest-wall':
      return 10
    default:
      return 0
  }
}

function applyStructureMaterial(mesh: THREE.Mesh, structure: ThoracicStructureLabelDef) {
  const color = new THREE.Color(structure.color ?? '#94a3b8')
  const opacity = structureOpacity(structure)
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.12),
    metalness: 0,
    opacity,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    depthWrite: opacity >= 0.78,
  })

  mesh.material = material
  mesh.renderOrder = structureRenderOrder(structure.category)
}

/* ------------------------------------------------------------------ */
/* SVG surface-map fallback (no WebGL): projected structure footprints */
/* ------------------------------------------------------------------ */

const viewBox = {
  width: 720,
  height: 430,
  padX: 58,
  padY: 48,
}

interface SurfaceMapFallbackProps {
  manifest: ThoracicCaseManifest
  probe: ThoracicProbeState
  pathColor: string
}

function SurfaceMapFallback({ manifest, probe, pathColor }: SurfaceMapFallbackProps) {
  const map = useMemo(() => buildMapProjection(manifest), [manifest])
  const probePoint = map.point(probe.lateralMm, probe.craniocaudalMm)
  const fanLength = Math.min(168, Math.max(90, probe.depthCm * 9))
  const fanHalfWidth = Math.min(108, Math.max(42, probe.sectorAngleDeg * 1.15))
  const rotationOffset = Math.max(-54, Math.min(54, probe.rotationDeg * 2.4))
  const fanTip = {
    x: probePoint.x + rotationOffset,
    y: Math.min(viewBox.height - viewBox.padY * 0.55, probePoint.y + fanLength),
  }
  const fanLeft = {
    x: Math.max(viewBox.padX * 0.35, fanTip.x - fanHalfWidth),
    y: fanTip.y,
  }
  const fanRight = {
    x: Math.min(viewBox.width - viewBox.padX * 0.35, fanTip.x + fanHalfWidth),
    y: fanTip.y,
  }

  return (
    <HandoffContent>
      {
        <svg
          aria-label="Projected access window map"
          className="h-[32rem] w-full"
          role="img"
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        >
          <defs>
            <linearGradient id="thoracic-map-skin" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#7f1d1d" stopOpacity="0.34" />
              <stop offset="50%" stopColor="#78350f" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#451a03" stopOpacity="0.16" />
            </linearGradient>
            <radialGradient id="thoracic-map-fluid" cx="50%" cy="48%" r="64%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.84" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.42" />
            </radialGradient>
            <filter id="thoracic-map-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="10"
                floodColor="#020617"
                floodOpacity="0.35"
                stdDeviation="8"
              />
            </filter>
          </defs>

          <rect width={viewBox.width} height={viewBox.height} rx="18" fill="#020617" />
          <rect
            x={viewBox.padX - 22}
            y={viewBox.padY - 20}
            width={viewBox.width - viewBox.padX * 2 + 44}
            height={viewBox.height - viewBox.padY * 2 + 40}
            rx="28"
            fill="url(#thoracic-map-skin)"
            stroke="#7c2d12"
            strokeOpacity="0.46"
          />

          {map.ribBands.map((band) => (
            <path
              key={band.key}
              d={band.path}
              fill="none"
              stroke="#e5e7eb"
              strokeLinecap="round"
              strokeOpacity={band.major ? 0.44 : 0.24}
              strokeWidth={band.major ? 7 : 4}
            />
          ))}

          {map.diaphragm ? (
            <path
              d={map.diaphragm.path}
              fill="none"
              stroke="#f59e0b"
              strokeDasharray="10 8"
              strokeLinecap="round"
              strokeOpacity="0.62"
              strokeWidth="6"
            />
          ) : null}

          {map.solidOrgans.map((organ) => (
            <ellipse
              key={organ.key}
              cx={organ.cx}
              cy={organ.cy}
              fill={organ.fill}
              filter="url(#thoracic-map-soft-shadow)"
              opacity="0.32"
              rx={organ.rx}
              ry={organ.ry}
              stroke={organ.stroke}
              strokeOpacity="0.32"
              strokeWidth="2"
            />
          ))}

          {map.fluid ? (
            <ellipse
              cx={map.fluid.cx}
              cy={map.fluid.cy}
              fill="url(#thoracic-map-fluid)"
              filter="url(#thoracic-map-soft-shadow)"
              rx={map.fluid.rx}
              ry={map.fluid.ry}
              stroke="#bfdbfe"
              strokeOpacity="0.72"
              strokeWidth="3"
            />
          ) : null}

          <path
            d={`M ${probePoint.x.toFixed(1)} ${probePoint.y.toFixed(1)} L ${fanLeft.x.toFixed(1)} ${fanLeft.y.toFixed(1)} L ${fanRight.x.toFixed(1)} ${fanRight.y.toFixed(1)} Z`}
            fill="#38bdf8"
            opacity="0.12"
            stroke="#38bdf8"
            strokeDasharray="8 8"
            strokeOpacity="0.44"
            strokeWidth="2"
          />
          <line
            stroke={pathColor}
            strokeLinecap="round"
            strokeWidth="4"
            x1={probePoint.x}
            x2={fanTip.x}
            y1={probePoint.y - 18}
            y2={fanTip.y}
          />
          <g transform={`translate(${probePoint.x} ${probePoint.y - 25})`}>
            <rect
              fill="#e5e7eb"
              height="30"
              opacity="0.94"
              rx="8"
              stroke="#f8fafc"
              strokeOpacity="0.62"
              strokeWidth="2"
              width="74"
              x="-37"
              y="-15"
            />
            <rect fill="#111827" height="6" opacity="0.82" rx="3" width="42" x="-21" y="13" />
          </g>

          <MapLabel anchor="start" text="cranial" x={viewBox.padX - 14} y={28} />
          <MapLabel anchor="start" text="caudal" x={viewBox.padX - 14} y={viewBox.height - 18} />
          <MapLabel
            anchor="end"
            text={pathColor === '#f59e0b' ? 'hazard path' : 'teaching window'}
            x={viewBox.width - 34}
            y={34}
          />
        </svg>
      }
    </HandoffContent>
  )
}

type BoundsRange = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function structureBounds(
  manifest: ThoracicCaseManifest,
  predicate: (structure: ThoracicStructureLabelDef) => boolean,
) {
  return manifest.structures.filter((structure) => predicate(structure) && structure.boundsLpsMm)
}

function buildMapProjection(manifest: ThoracicCaseManifest) {
  const withBounds = manifest.structures.filter((structure) => structure.boundsLpsMm)
  const range = buildRange(withBounds.map((structure) => structure.boundsLpsMm))

  function x(lateralMm: number) {
    return (
      viewBox.padX +
      ((lateralMm - range.minX) / Math.max(1, range.maxX - range.minX)) *
        (viewBox.width - viewBox.padX * 2)
    )
  }

  function y(craniocaudalMm: number) {
    return (
      viewBox.padY +
      ((range.maxZ - craniocaudalMm) / Math.max(1, range.maxZ - range.minZ)) *
        (viewBox.height - viewBox.padY * 2)
    )
  }

  function point(lateralMm: number, craniocaudalMm: number) {
    return {
      x: clamp(x(lateralMm), 26, viewBox.width - 26),
      y: clamp(y(craniocaudalMm), 34, viewBox.height - 26),
    }
  }

  function oval(labelBounds: LabelBounds | undefined, minRadius = 18) {
    if (!labelBounds) return null

    const centerX = (labelBounds.min[0] + labelBounds.max[0]) / 2
    const centerZ = (labelBounds.min[2] + labelBounds.max[2]) / 2
    const left = x(labelBounds.min[0])
    const right = x(labelBounds.max[0])
    const top = y(labelBounds.max[2])
    const bottom = y(labelBounds.min[2])
    const center = point(centerX, centerZ)

    return {
      cx: center.x,
      cy: center.y,
      rx: Math.max(minRadius, Math.abs(right - left) / 2),
      ry: Math.max(minRadius, Math.abs(bottom - top) / 2),
    }
  }

  const ribStructure = structureBounds(manifest, (structure) => structure.label === 'rib')[0]
  const diaphragmStructure = structureBounds(
    manifest,
    (structure) => structure.label === 'diaphragm',
  )[0]
  const fluidStructure = structureBounds(manifest, (structure) => structure.category === 'fluid')[0]
  const solidOrganStructures = structureBounds(
    manifest,
    (structure) => structure.category === 'solid-organ',
  )

  const solidOrganPalette: Record<string, { fill: string; stroke: string }> = {
    liver: { fill: '#b45309', stroke: '#f59e0b' },
    spleen: { fill: '#7c3aed', stroke: '#c4b5fd' },
  }

  return {
    point,
    ribBands: buildRibBands(ribStructure?.boundsLpsMm, x, y),
    diaphragm: buildDiaphragmPath(diaphragmStructure?.boundsLpsMm, x, y),
    fluid: oval(fluidStructure?.boundsLpsMm, 28),
    solidOrgans: solidOrganStructures.flatMap((structure) => {
      const shape = oval(structure.boundsLpsMm, 22)
      if (!shape) return []
      const palette = solidOrganPalette[structure.label] ?? {
        fill: structure.color ?? '#78716c',
        stroke: structure.color ?? '#a8a29e',
      }
      return [{ key: structure.label, ...shape, ...palette }]
    }),
  }
}

function buildRange(items: Array<LabelBounds | undefined>): BoundsRange {
  const present = items.filter((item): item is LabelBounds => Boolean(item))
  const minX = Math.min(...present.map((item) => item.min[0]))
  const maxX = Math.max(...present.map((item) => item.max[0]))
  const minZ = Math.min(...present.map((item) => item.min[2]))
  const maxZ = Math.max(...present.map((item) => item.max[2]))
  const xPad = Math.max(24, (maxX - minX) * 0.08)
  const zPad = Math.max(24, (maxZ - minZ) * 0.08)

  return {
    minX: minX - xPad,
    maxX: maxX + xPad,
    minZ: minZ - zPad,
    maxZ: maxZ + zPad,
  }
}

function buildRibBands(
  ribBounds: LabelBounds | undefined,
  x: (value: number) => number,
  y: (value: number) => number,
) {
  if (!ribBounds) return []

  const count = 7
  const x1 = x(ribBounds.min[0])
  const x2 = x(ribBounds.max[0])
  const zMin = ribBounds.min[2]
  const zMax = ribBounds.max[2]

  return Array.from({ length: count }, (_, index) => {
    const fraction = index / (count - 1)
    const z = zMin + (zMax - zMin) * fraction
    const yCenter = y(z)
    const sway = index % 2 === 0 ? 18 : -14
    return {
      key: `rib-${index}`,
      major: index % 2 === 0,
      path: `M ${x1.toFixed(1)} ${yCenter.toFixed(1)} C ${(x1 + 150).toFixed(1)} ${(yCenter - 20).toFixed(1)}, ${(x2 - 150).toFixed(1)} ${(yCenter + sway).toFixed(1)}, ${x2.toFixed(1)} ${(yCenter - 6).toFixed(1)}`,
    }
  })
}

function buildDiaphragmPath(
  diaphragmBounds: LabelBounds | undefined,
  x: (value: number) => number,
  y: (value: number) => number,
) {
  if (!diaphragmBounds) return null

  const x1 = x(diaphragmBounds.min[0])
  const x2 = x(diaphragmBounds.max[0])
  const yCenter = y((diaphragmBounds.min[2] + diaphragmBounds.max[2]) / 2)
  const controlY = yCenter - 28

  return {
    path: `M ${x1.toFixed(1)} ${yCenter.toFixed(1)} C ${(x1 + 130).toFixed(1)} ${controlY.toFixed(1)}, ${(x2 - 130).toFixed(1)} ${(controlY + 16).toFixed(1)}, ${x2.toFixed(1)} ${(yCenter + 10).toFixed(1)}`,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <HandoffContent>
      {
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
      }
    </HandoffContent>
  )
}

function MapLabel({
  anchor,
  text,
  x,
  y,
}: {
  anchor: 'end' | 'start'
  text: string
  x: number
  y: number
}) {
  return (
    <HandoffContent>
      {
        <text
          fill="#cbd5e1"
          fontSize="13"
          fontWeight="700"
          letterSpacing="0"
          opacity="0.74"
          textAnchor={anchor}
          x={x}
          y={y}
        >
          {text}
        </text>
      }
    </HandoffContent>
  )
}
