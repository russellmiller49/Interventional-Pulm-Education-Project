'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Eye, EyeOff, RotateCcw } from 'lucide-react'
import * as THREE from 'three'

import type { IcuSimulationState, IcuTherapyId } from '../engine'
import styles from './icu-simulation.module.css'

const devicePositions: Readonly<Record<IcuTherapyId, [number, number, number]>> = {
  ventilator: [-2.55, 1.05, -0.2],
  ecmo: [2.65, 0.9, 0.3],
  mcs: [2.15, 1.35, -1.05],
  crrt: [3.15, 1.15, -1.25],
}

function statusColor(status: 'off' | 'ready' | 'running') {
  if (status === 'running') return '#51d99b'
  if (status === 'ready') return '#f0bc5a'
  return '#6f858a'
}

function DeviceTower({
  id,
  label,
  status,
}: {
  id: IcuTherapyId
  label: string
  status: 'off' | 'ready' | 'running'
}) {
  const [x, y, z] = devicePositions[id]
  const color = statusColor(status)
  return (
    <group position={[x, y, z]}>
      <RoundedBox args={[0.72, 1.45, 0.48]} radius={0.08} smoothness={3}>
        <meshStandardMaterial color="#dbe5e4" metalness={0.2} roughness={0.55} />
      </RoundedBox>
      <mesh position={[0, 0.28, 0.255]}>
        <planeGeometry args={[0.51, 0.42]} />
        <meshStandardMaterial color="#092630" emissive="#0d7780" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.41, 0.27]}>
        <circleGeometry args={[0.055, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.75} />
      </mesh>
      <mesh position={[-0.24, -0.84, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.35, 12]} />
        <meshStandardMaterial color="#718287" metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0.24, -0.84, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.35, 12]} />
        <meshStandardMaterial color="#718287" metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, -1.02, 0]}>
        <boxGeometry args={[0.82, 0.12, 0.58]} />
        <meshStandardMaterial color="#89999c" metalness={0.35} roughness={0.42} />
      </mesh>
      <group name={label} />
    </group>
  )
}

function Patient({
  heartRateBpm,
  reducedMotion,
}: {
  heartRateBpm: number
  reducedMotion: boolean
}) {
  const torso = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!torso.current || reducedMotion) return
    const frequency = THREE.MathUtils.clamp(heartRateBpm / 60, 0.5, 2.4)
    torso.current.scale.y = 1 + Math.sin(clock.elapsedTime * Math.PI * 2 * frequency) * 0.008
  })

  return (
    <group position={[0, 1.11, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={torso} scale={[0.72, 1.1, 0.34]}>
        <capsuleGeometry args={[0.62, 1.25, 8, 20]} />
        <meshStandardMaterial color="#c99878" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <sphereGeometry args={[0.43, 24, 16]} />
        <meshStandardMaterial color="#c99878" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.23, 0.41]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.025, 10, 28, Math.PI]} />
        <meshStandardMaterial color="#dce6e5" />
      </mesh>
    </group>
  )
}

function BedsideGeometry({
  state,
  reducedMotion,
}: {
  state: IcuSimulationState
  reducedMotion: boolean
}) {
  return (
    <>
      <color attach="background" args={['#061d28']} />
      <fog attach="fog" args={['#061d28', 7, 14]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[4, 7, 5]} intensity={2.2} castShadow />
      <directionalLight position={[-4, 3, 3]} intensity={0.8} color="#76dcd2" />
      <pointLight position={[0, 3.5, 2]} intensity={0.6} color="#ffe1cc" />

      <group rotation={[0, -0.1, 0]}>
        <RoundedBox args={[4.6, 0.45, 2.2]} radius={0.18} smoothness={3} position={[0, 0.38, 0]}>
          <meshStandardMaterial color="#dce5e3" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[4.85, 0.16, 2.38]} radius={0.09} smoothness={3} position={[0, 0.62, 0]}>
          <meshStandardMaterial color="#f2f5f0" roughness={0.75} />
        </RoundedBox>
        <mesh position={[0, 0.62, -1.16]}>
          <boxGeometry args={[4.75, 0.63, 0.1]} />
          <meshStandardMaterial color="#9aa9a8" metalness={0.1} />
        </mesh>
        <Patient
          heartRateBpm={state.patient.hemodynamics.heartRateBpm}
          reducedMotion={reducedMotion}
        />
      </group>

      <DeviceTower id="ventilator" label="Ventilator" status={state.devices.ventilator.status} />
      <DeviceTower id="ecmo" label="ECMO" status={state.devices.ecmo.status} />
      <DeviceTower
        id="mcs"
        label="Mechanical circulatory support"
        status={state.devices.mcs.status}
      />
      <DeviceTower id="crrt" label="CRRT" status={state.devices.crrt.status} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#0b2c36" roughness={0.94} />
      </mesh>
      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        enablePan={false}
        minDistance={6.2}
        maxDistance={10}
        minPolarAngle={0.68}
        maxPolarAngle={1.35}
        target={[0.15, 0.9, 0]}
      />
    </>
  )
}

function sceneSummary(state: IcuSimulationState): string {
  const running = [
    state.devices.ventilator.status === 'running' ? 'ventilator' : null,
    state.devices.ecmo.status === 'running'
      ? `${state.devices.ecmo.mode.toUpperCase()} ECMO`
      : null,
    state.devices.mcs.status === 'running' ? state.devices.mcs.device.replaceAll('-', ' ') : null,
    state.devices.crrt.status === 'running' ? 'CRRT' : null,
  ].filter(Boolean)

  return running.length === 0
    ? 'Focused bedside overview. No advanced support device is currently running.'
    : `Focused bedside overview. Active support: ${running.join(', ')}.`
}

export function IcuBedsideScene({ state }: { state: IcuSimulationState }) {
  const [showVisual, setShowVisual] = useState(true)
  const [sceneKey, setSceneKey] = useState(0)
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const summary = useMemo(() => sceneSummary(state), [state])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    setReducedMotion(media?.matches ?? false)
    try {
      const canvas = document.createElement('canvas')
      setWebglAvailable(Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')))
    } catch {
      setWebglAvailable(false)
    }
  }, [])

  return (
    <section className={styles.bedsideScene} aria-labelledby="bedside-scene-title">
      <header>
        <div>
          <span className={styles.panelKicker}>Spatial overview</span>
          <h2 id="bedside-scene-title">Focused bedside</h2>
        </div>
        <button
          type="button"
          aria-pressed={showVisual}
          onClick={() => setShowVisual((value) => !value)}
        >
          {showVisual ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {showVisual ? 'Hide 3D' : 'Show 3D'}
        </button>
      </header>

      <p className={styles.sceneTextEquivalent}>{summary}</p>

      {showVisual && webglAvailable ? (
        <div className={styles.sceneViewport} aria-hidden="true">
          <Canvas
            key={sceneKey}
            dpr={[1, 1.5]}
            shadows
            camera={{ position: [6.6, 4.4, 7.1], fov: 38, near: 0.1, far: 30 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            <BedsideGeometry state={state} reducedMotion={reducedMotion} />
          </Canvas>
          <div className={styles.sceneLegend}>
            <span>Focused orbit only</span>
            <span>No procedural placement</span>
          </div>
          <button
            type="button"
            className={styles.sceneReset}
            onClick={() => setSceneKey((value) => value + 1)}
            aria-label="Reset bedside view"
          >
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
      ) : showVisual && webglAvailable === null ? (
        <div className={styles.sceneFallback}>Checking 3D support…</div>
      ) : showVisual ? (
        <div className={styles.sceneFallback} role="status">
          WebGL is unavailable. The patient summary and all simulator controls remain available.
        </div>
      ) : null}
    </section>
  )
}
