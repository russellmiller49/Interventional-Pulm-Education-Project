'use client'

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createBronchoscopyMaterial } from '@/lib/airway-anatomy/airway-render'
import type { Vec3 } from '../geometry/coordinates'
import { SCOPE_FOV_DEG } from '../geometry/route-stations'
import styles from './nav-bench.module.css'

/**
 * The virtual bronchoscope: the airway surface of this CT seen from inside, from a pose the bench
 * supplies. It draws nothing of its own on the picture; opening numbers and the patient-direction
 * letters are laid over it by `ScopeView` from the projections reported here.
 */
export interface ScopeOpening {
  id: string
  /** Candidate anchors just inside the daughter, patient space, best first. */
  anchors: Vec3[]
}
export interface ProjectedOpening {
  id: string
  /** 0–100 across the square view. */
  x: number
  y: number
  /** False when no candidate anchor is in line of sight; the position is then the first anchor's. */
  seen: boolean
}

const SURFACE_URL = '/branch-tracing/preview-v1/airway.glb'
const SURFACE_SHA256 = '24edef81dd18f10ea2c45b548a2410c54b9b5c5685e4fe221997b0534f3577f9'

async function loadSurface(signal: AbortSignal) {
  const res = await fetch(SURFACE_URL, { signal })
  if (!res.ok) throw new Error('The airway surface could not be loaded.')
  const bytes = await res.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
  // The route geometry was fitted to this exact surface; a different file would put the scope
  // through a wall.
  if (hash !== SURFACE_SHA256)
    throw new Error('The airway surface on this server does not match the route geometry.')
  const draco = new DRACOLoader().setDecoderPath('/fluoroview/draco/')
  try {
    const gltf = await new GLTFLoader()
      .setDRACOLoader(draco)
      .parseAsync(bytes, '/branch-tracing/preview-v1/')
    gltf.scene.updateMatrixWorld(true)
    const source = gltf.scene.getObjectByName('Complete_airway')
    let geometry: THREE.BufferGeometry | null = null
    if (source instanceof THREE.Mesh) {
      const derived: THREE.BufferGeometry = source.geometry.clone().applyMatrix4(source.matrixWorld)
      // The case-level transform into LPS millimetres, as the anatomy viewers apply it.
      derived.scale(1000, 1000, 1000).rotateX(Math.PI / 2)
      derived.deleteAttribute('normal')
      geometry = mergeVertices(derived, 0.001)
      derived.dispose()
      geometry.computeVertexNormals()
      geometry.computeBoundingBox()
    }
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((m) => m.dispose())
      }
    })
    if (!geometry) throw new Error('The airway surface file is missing its mesh.')
    if (signal.aborted) {
      geometry.dispose()
      throw new Error('Aborted')
    }
    return geometry
  } finally {
    draco.dispose()
  }
}

class ViewBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p className={styles.scopeNotice} role="alert">
        The scope view could not be drawn. The CT and the task still work.{' '}
        <button
          onClick={() => {
            this.setState({ failed: false })
            this.props.onRetry()
          }}
        >
          Retry the scope view
        </button>
      </p>
    ) : (
      this.props.children
    )
  }
}

function ScopeCamera({ position, direction, up }: { position: Vec3; direction: Vec3; up: Vec3 }) {
  const { camera, invalidate } = useThree()
  useEffect(() => {
    const forward = new THREE.Vector3(...direction).normalize()
    camera.position.set(...position)
    camera.up.set(...up)
    camera.lookAt(new THREE.Vector3(...position).add(forward))
    camera.updateMatrixWorld()
    invalidate()
  }, [camera, invalidate, position, direction, up])
  return null
}

/**
 * Projects each opening's anchors with the camera exactly as rendered and tests line of sight
 * against the airway surface, so a number sits on an opening and never on a wall.
 */
function OpeningProjector({
  openings,
  geometry,
  position,
  direction,
  up,
  onProject,
}: {
  openings: ScopeOpening[]
  geometry: THREE.BufferGeometry
  position: Vec3
  direction: Vec3
  up: Vec3
  onProject: (results: ProjectedOpening[]) => void
}) {
  const { camera } = useThree()
  // The camera sits inside a surface drawn on its back side, so both faces must stop a ray.
  const probe = useMemo(
    () => new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
    [geometry],
  )
  useEffect(() => () => (probe.material as THREE.Material).dispose(), [probe])
  useEffect(() => {
    camera.updateMatrixWorld()
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix()
    const origin = camera.position.clone()
    const forward = new THREE.Vector3(...direction).normalize()
    const raycaster = new THREE.Raycaster()
    const project = (anchor: Vec3) => {
      const point = new THREE.Vector3(...anchor)
      const ndc = point.clone().project(camera)
      const toPoint = point.clone().sub(origin)
      const distance = toPoint.length()
      const x = ((ndc.x + 1) / 2) * 100
      const y = ((1 - ndc.y) / 2) * 100
      const inView =
        toPoint.dot(forward) > 0.1 && ndc.z < 1 && x >= 16 && x <= 84 && y >= 16 && y <= 84
      if (!inView) return { x, y, seen: false }
      raycaster.set(origin, toPoint.normalize())
      raycaster.far = distance
      const blocked = raycaster
        .intersectObject(probe, false)
        .some((hit) => hit.distance < distance - 0.5)
      return { x, y, seen: !blocked }
    }
    onProject(
      openings.map((opening) => {
        const tried = opening.anchors.map(project)
        const hit = tried.find((entry) => entry.seen) ?? tried[0]
        return {
          id: opening.id,
          x: Math.max(14, Math.min(86, hit?.x ?? 50)),
          y: Math.max(14, Math.min(86, hit?.y ?? 50)),
          seen: Boolean(hit?.seen),
        }
      }),
    )
  }, [camera, openings, position, direction, up, probe, onProject])
  return null
}

function Surface({ geometry }: { geometry: THREE.BufferGeometry }) {
  const material = useMemo(() => createBronchoscopyMaterial(), [])
  useEffect(() => () => material.dispose(), [material])
  return <mesh geometry={geometry} material={material} dispose={null} />
}

export function ScopeCanvas({
  position,
  direction,
  up,
  openings,
  onProject,
  onReady,
}: {
  position: Vec3
  direction: Vec3
  up: Vec3
  /** Openings to place in the view. Pass none while the scope is moving. */
  openings: ScopeOpening[]
  onProject: (results: ProjectedOpening[]) => void
  onReady?: (ready: boolean) => void
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let owned: THREE.BufferGeometry | null = null
    loadSurface(controller.signal)
      .then((loaded) => {
        owned = loaded
        setGeometry(loaded)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => {
      controller.abort()
      owned?.dispose()
    }
  }, [retry])
  const ready = Boolean(geometry) && !error && !contextLost
  useEffect(() => {
    onReady?.(ready)
  }, [ready, onReady])
  function reload() {
    setError('')
    setGeometry(null)
    setContextLost(false)
    setRetry((value) => value + 1)
  }
  if (error)
    return (
      <p className={styles.scopeNotice} role="alert">
        {error} The CT and the task still work.{' '}
        <button onClick={reload}>Retry the scope view</button>
      </p>
    )
  if (!geometry)
    return (
      <p className={styles.scopeNotice} role="status">
        Loading the airway surface…
      </p>
    )
  if (contextLost)
    return (
      <p className={styles.scopeNotice} role="alert">
        The 3D view was lost. The CT and the task still work.{' '}
        <button onClick={reload}>Reload the scope view</button>
      </p>
    )
  return (
    <ViewBoundary onRetry={reload}>
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 0, 0], up: [0, 0, 1], fov: SCOPE_FOV_DEG, near: 0.1, far: 2000 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.domElement.setAttribute('aria-label', 'Virtual bronchoscope view of the airway')
          gl.domElement.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault()
              setContextLost(true)
            },
            { once: true },
          )
        }}
      >
        <color attach="background" args={['#081118']} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[200, -400, 200]} intensity={2} />
        <Surface geometry={geometry} />
        <ScopeCamera position={position} direction={direction} up={up} />
        {openings.length > 0 && (
          <OpeningProjector
            openings={openings}
            geometry={geometry}
            position={position}
            direction={direction}
            up={up}
            onProject={onProject}
          />
        )}
      </Canvas>
    </ViewBoundary>
  )
}
