'use client'

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createBronchoscopyMaterial } from '@/lib/airway-anatomy/airway-render'
import type { Vec3 } from '../geometry/coordinates'
import { PREVIEW_CT } from '../geometry/clinical-preview'
import styles from './branch-tracing.module.css'

const SURFACE_URL = '/branch-tracing/preview-v1/airway.glb'
async function loadSurface(signal: AbortSignal) {
  const res = await fetch(SURFACE_URL, { signal })
  if (!res.ok) throw new Error('Airway surface could not be loaded.')
  const bytes = await res.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
  if (hash !== '24edef81dd18f10ea2c45b548a2410c54b9b5c5685e4fe221997b0534f3577f9')
    throw new Error(
      'The source airway version changed. CT exploration remains available; the surface needs a correspondence review.',
    )
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
      // Same documented case-level transform as the existing FluoroView viewer.
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
    if (!geometry) throw new Error('The expected complete airway mesh is missing.')
    if (signal.aborted) {
      geometry.dispose()
      throw new Error('Aborted')
    }
    return geometry
  } finally {
    draco.dispose()
  }
}

class ViewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p className={styles.notice} role="alert">
        3D rendering is unavailable. The CT stack and route controls remain usable. Close and reopen
        this explorer to retry.
      </p>
    ) : (
      this.props.children
    )
  }
}

function ScopeCamera({
  position,
  direction,
  roll,
}: {
  position: Vec3
  direction: Vec3
  roll: number
}) {
  const { camera, invalidate } = useThree()
  useEffect(() => {
    const forward = new THREE.Vector3(...direction).normalize()
    const up = Math.abs(forward.z) > 0.9 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, 1)
    up.applyAxisAngle(forward, (-roll * Math.PI) / 180)
    camera.position.set(...position)
    camera.up.copy(up)
    camera.lookAt(new THREE.Vector3(...position).add(forward))
    camera.updateMatrixWorld()
    invalidate()
  }, [camera, invalidate, position, direction, roll])
  return null
}
function Surface({
  geometry,
  inside,
  opacity,
}: {
  geometry: THREE.BufferGeometry
  inside: boolean
  opacity: number
}) {
  const material = useMemo(
    () =>
      inside
        ? createBronchoscopyMaterial()
        : new THREE.MeshStandardMaterial({
            color: '#e5b0a1',
            roughness: 0.65,
            side: THREE.DoubleSide,
            transparent: true,
            opacity,
          }),
    [inside, opacity],
  )
  useEffect(() => () => material.dispose(), [material])
  return <mesh geometry={geometry} material={material} dispose={null} />
}
function Plane({ slice }: { slice: number }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let current = true,
      loaded: THREE.Texture | null = null
    new THREE.TextureLoader().load(
      `/branch-tracing/preview-v1/axial/${String(slice).padStart(3, '0')}.png`,
      (t) => {
        loaded = t
        t.colorSpace = THREE.SRGBColorSpace
        if (current) setTexture(t)
        else t.dispose()
      },
      undefined,
      () => {},
    )
    return () => {
      current = false
      loaded?.dispose()
    }
  }, [slice])
  const z = PREVIEW_CT.origin[2] + slice * PREVIEW_CT.spacing[2]
  // LPS +Y is posterior. Texture top is anterior, so flip the plane's Y UV via rotation.
  return (
    <mesh
      position={[
        PREVIEW_CT.origin[0] + (255 * PREVIEW_CT.spacing[0]) / 2,
        PREVIEW_CT.origin[1] + (255 * PREVIEW_CT.spacing[1]) / 2,
        z,
      ]}
      rotation={[Math.PI, 0, 0]}
    >
      <planeGeometry args={[256 * PREVIEW_CT.spacing[0], 256 * PREVIEW_CT.spacing[1]]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </mesh>
  )
}

export function ClinicalAirwayView({
  position,
  direction,
  roll,
  slice,
}: {
  position: Vec3
  direction: Vec3
  roll: number
  slice: number
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'exterior' | 'scope'>('exterior')
  const [opacity, setOpacity] = useState(0.65)
  const [retry, setRetry] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let owned: THREE.BufferGeometry | null = null
    loadSurface(controller.signal)
      .then((g) => {
        owned = g
        setGeometry(g)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => {
      controller.abort()
      owned?.dispose()
    }
  }, [retry])
  function retrySurface() {
    setError('')
    setGeometry(null)
    setContextLost(false)
    setRetry((v) => v + 1)
  }
  return (
    <section className={styles.view}>
      <h2>
        {view === 'scope' ? 'CT-derived virtual bronchoscopy' : 'Exterior airway and CT plane'}
      </h2>
      <div className={styles.tabs} role="group" aria-label="Clinical airway view">
        <button aria-pressed={view === 'exterior'} onClick={() => setView('exterior')}>
          Exterior 3D
        </button>
        <button aria-pressed={view === 'scope'} onClick={() => setView('scope')}>
          Virtual bronchoscopy
        </button>
      </div>
      {error ? (
        <p role="alert">
          {error} <button onClick={retrySurface}>Retry surface</button>
        </p>
      ) : !geometry ? (
        <p role="status">Loading the existing airway surface…</p>
      ) : contextLost ? (
        <p role="alert">
          3D context was lost. <button onClick={retrySurface}>Reload 3D view</button>
        </p>
      ) : (
        <ViewBoundary>
          <div className={styles.clinicalCanvas}>
            <Canvas
              key={view}
              frameloop="demand"
              camera={{
                position: [400, -580, 90],
                up: [0, 0, 1],
                fov: view === 'scope' ? 80 : 45,
                near: 0.1,
                far: 2000,
              }}
              gl={{ antialias: true, preserveDrawingBuffer: true }}
              onCreated={({ gl }) => {
                gl.domElement.setAttribute(
                  'aria-label',
                  view === 'scope'
                    ? 'CT-derived virtual airway view'
                    : 'Exterior airway surface with selected CT plane',
                )
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
              <Surface geometry={geometry} inside={view === 'scope'} opacity={opacity} />
              {view === 'scope' ? (
                <ScopeCamera position={position} direction={direction} roll={roll} />
              ) : (
                <>
                  <Plane slice={slice} />
                  <mesh position={position}>
                    <sphereGeometry args={[3, 12, 12]} />
                    <meshBasicMaterial color="#f1d394" />
                  </mesh>
                  <OrbitControls target={[-5, -170, -190]} makeDefault />
                </>
              )}
            </Canvas>
          </div>
        </ViewBoundary>
      )}
      {view === 'exterior' && (
        <label>
          Airway opacity
          <input
            aria-label="Airway opacity"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </label>
      )}
      <p className={styles.small}>
        {view === 'scope'
          ? 'Virtual surface appearance. Camera poses are geometric previews and have not been approved as scored clinical checkpoints. Roll zero uses projected patient superior, or anterior near a vertical airway.'
          : 'Drag to orbit; scroll to zoom. The plane follows your CT slice; the marker follows your chosen route.'}{' '}
        No mucosal video or device-passage claim.
      </p>
    </section>
  )
}
