'use client'

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  createCArm,
  createSamplingModel,
  createShield,
  createStaff,
  createSupport,
  createTable,
  createThorax,
  disposeModel,
} from '../lib/models'
import { LESION_CENTER, radians } from '../lib/physics'
import styles from '../imaging.module.css'

interface SceneProps {
  orbit?: number
  tilt?: number
  depth?: number
  kind?: 'fixed' | 'mobile'
  staffDistance?: number
  shield?: boolean
  safety?: boolean
  compact?: boolean
  centerTarget?: boolean
  offsetX?: number
  offsetDepth?: number
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className={styles.sceneFallback}>
        The 3D view is unavailable. The linked diagram, controls and text results below provide the
        teaching activity.
      </div>
    ) : (
      this.props.children
    )
  }
}
function Viewpoint({ view, safety }: { view: number; safety: boolean }) {
  const { camera, invalidate } = useThree()
  useEffect(() => {
    const positions = [
      [330, 240, 340],
      [0, 380, 1],
      [400, 30, 0],
      [0, 35, 440],
    ]
    const p = positions[view % positions.length]
    camera.position.set(
      p[0] * (safety ? 1.3 : 1),
      p[1] * (safety ? 1.3 : 1),
      p[2] * (safety ? 1.3 : 1),
    )
    camera.lookAt(safety ? 35 : 0, 0, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, view, safety])
  return null
}
function Objects({
  orbit = 0,
  tilt = 0,
  depth = 18,
  kind = 'mobile',
  staffDistance = 1.6,
  shield = false,
  safety = false,
  centerTarget = false,
  offsetX = 0,
  offsetDepth = 0,
}: SceneProps) {
  const torso = useMemo(() => createThorax(), [])
  const arm = useMemo(() => createCArm(), [])
  const table = useMemo(() => createTable(), [])
  const support = useMemo(() => createSupport(kind), [kind])
  const staff = useMemo(() => createStaff(staffDistance), [staffDistance])
  const barrier = useMemo(() => createShield(), [])
  useEffect(() => () => disposeModel(torso), [torso])
  useEffect(() => () => disposeModel(arm), [arm])
  useEffect(() => () => disposeModel(table), [table])
  useEffect(() => () => disposeModel(support), [support])
  useEffect(() => () => disposeModel(staff), [staff])
  useEffect(() => () => disposeModel(barrier), [barrier])
  const [x, , z] = LESION_CENTER
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[160, 270, 220]} intensity={2.5} />
      <directionalLight position={[-180, 80, -160]} intensity={1.2} color="#91cbd3" />
      <group position={centerTarget ? [-35 + offsetX, offsetDepth, 5] : [0, 0, 0]}>
        <primitive object={torso} />
      </group>
      <primitive object={table} />
      <group rotation={[0, 0, radians(orbit)]}>
        <group rotation={[radians(tilt), 0, 0]}>
          <primitive object={arm} />
          <Html position={[0, -150, 20]} center>
            <span className={styles.modelLabel}>X-ray source</span>
          </Html>
          <Html position={[0, 151, 0]} center>
            <span className={styles.modelLabel}>Detector</span>
          </Html>
        </group>
      </group>
      <primitive object={support} />
      <group position={centerTarget ? [-35 + offsetX, offsetDepth, 5] : [0, 0, 0]}>
        <mesh position={[x - 30, depth, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.2, 1.2, 60, 10]} />
          <meshStandardMaterial color="#d9f4ff" metalness={0.65} roughness={0.2} />
        </mesh>
        <mesh position={[x, depth, z]}>
          <sphereGeometry args={[2, 12, 12]} />
          <meshStandardMaterial color="#c7f1ff" emissive="#649bba" emissiveIntensity={0.3} />
        </mesh>
        <Html position={[x + 16, 3, z]}>
          <span className={styles.modelLabel}>Target</span>
        </Html>
        <Html position={[72, 0, 74]}>
          <span className={styles.modelLabel}>L</span>
        </Html>
      </group>
      {safety && (
        <>
          <primitive object={staff} />
          {shield && <primitive object={barrier} />}
          <Html position={[staffDistance * 100, 32, 0]} center>
            <span className={styles.modelLabel}>Staff</span>
          </Html>
        </>
      )}
    </>
  )
}
export default function Scene3D(props: SceneProps) {
  const [view, setView] = useState(0)
  return (
    <div className={styles.sceneWrap}>
      <div
        className={props.compact ? styles.sceneCompact : styles.scene}
        role="img"
        aria-label="Authored 3D model: supine thorax with airways, target, sampling tool, table, C-arm source and detector. The view and text below describe the teaching geometry."
      >
        <SceneBoundary>
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [330, 240, 340], fov: 43, near: 1, far: 2500 }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => gl.setClearColor(new THREE.Color('#102936'))}
            fallback={
              <div className={styles.sceneFallback}>
                3D needs WebGL. Use the diagram and text result for this activity.
              </div>
            }
          >
            <Objects {...props} />
            <Viewpoint view={view} safety={Boolean(props.safety)} />
            <OrbitControls
              key={view + ':' + Boolean(props.safety)}
              target={[props.safety ? 35 : 0, 0, 0]}
              enablePan={false}
              enableDamping={false}
              minDistance={250}
              maxDistance={1000}
            />
          </Canvas>
        </SceneBoundary>
      </div>
      <div className={styles.sceneToolbar}>
        <span>Drag to orbit · scroll to zoom</span>
        <div aria-label="3D camera views" className={styles.buttonRow}>
          {['Perspective', 'Anterior', 'Side', 'Head'].map((label, i) => (
            <button
              key={label}
              type="button"
              aria-pressed={view % 4 === i}
              onClick={() => setView(i + (Math.floor(view / 4) + 1) * 4)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SamplingObjects({ tip }: { tip: [number, number, number] }) {
  const [x, y, z] = tip
  const model = useMemo(() => createSamplingModel([x, y, z]), [x, y, z])
  useEffect(() => () => disposeModel(model), [model])
  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[40, 60, 50]} intensity={2.4} />
      <primitive object={model} />
      <Html position={[0, -11, 0]} center>
        <span className={styles.modelLabel}>Target sphere</span>
      </Html>
      <Html position={[x - 10, y + 3, z]} center>
        <span className={styles.modelLabel}>Sampling window</span>
      </Html>
      <Html position={[x + 3, y, z]}>
        <span className={styles.modelLabel}>Tip</span>
      </Html>
    </>
  )
}
export function SamplingScene3D({ tip }: { tip: [number, number, number] }) {
  const [view, setView] = useState(0)
  const positions: [number, number, number][] = [
    [33, 28, 36],
    [0, 58, 0.01],
    [58, 0, 0.01],
    [0, 0, 58],
  ]
  return (
    <div className={styles.sceneWrap}>
      <div
        className={styles.sceneCompact}
        role="img"
        aria-label="3D teaching sphere and fictional needle. The thick sampling-window segment is distinct from the tip. Linked slices below provide the same geometry."
      >
        <SceneBoundary>
          <Canvas
            key={view}
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: positions[view % 4], fov: 36, near: 0.1, far: 500 }}
            gl={{ antialias: true }}
            onCreated={({ gl }) => gl.setClearColor('#102936')}
            fallback={
              <div className={styles.sceneFallback}>
                Use the linked analytic slices and text explanation below.
              </div>
            }
          >
            <SamplingObjects tip={tip} />
            <OrbitControls
              target={[0, 0, 0]}
              enablePan={false}
              enableDamping={false}
              minDistance={35}
              maxDistance={160}
            />
          </Canvas>
        </SceneBoundary>
      </div>
      <div className={styles.sceneToolbar}>
        <span>Same authored geometry as the linked slices</span>
        <div className={styles.buttonRow} aria-label="Sampling model views">
          {['Perspective', 'Anterior', 'Side', 'Head'].map((label, i) => (
            <button
              key={label}
              type="button"
              aria-pressed={view % 4 === i}
              onClick={() => setView(i + (Math.floor(view / 4) + 1) * 4)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
