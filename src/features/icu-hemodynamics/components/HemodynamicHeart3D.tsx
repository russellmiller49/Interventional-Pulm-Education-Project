'use client'

import { Suspense, useMemo, useRef, useState } from 'react'
import { Line, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, type RootState } from '@react-three/fiber'
import { RotateCcw } from 'lucide-react'
import * as THREE from 'three'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { CardiacHeartModel } from '@/features/cardiac-anatomy/components/CardiacHeartModel'
import { CardiacPath } from '@/features/cardiac-anatomy/components/CardiacPath'
import { HeartGreatVesselsModel } from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import {
  useReducedMotionPreference,
  useWebGLSupport,
} from '@/features/cardiac-anatomy/components/useCardiac3DSupport'
import {
  PAC_POSITION_ANATOMY,
  PAC_ROUTE,
  PAC_ROUTE_ENDPOINT_INDEX,
  PHLEBOSTATIC_AXIS_Y,
  TRANSDUCER_LEVEL_WORLD_UNITS_PER_CM,
  TRANSDUCER_X,
  CARDIAC_RIG,
} from '@/features/cardiac-anatomy/content/paths'

import type { HemodynamicSimulationState } from '../engine'
import styles from './icu-hemodynamics.module.css'

function setupRenderer({ gl, scene }: RootState, onLost: () => void) {
  scene.background = new THREE.Color('#071c26')
  gl.domElement.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault()
      onLost()
    },
    { once: true },
  )
}

function Transducer({
  levelCm,
  zeroed,
  fastFlushActive,
  reducedMotion,
}: {
  levelCm: number
  zeroed: boolean
  fastFlushActive: boolean
  reducedMotion: boolean
}) {
  const marker = useRef<THREE.Group>(null)
  const y = PHLEBOSTATIC_AXIS_Y + levelCm * TRANSDUCER_LEVEL_WORLD_UNITS_PER_CM

  useFrame(({ clock }) => {
    if (!marker.current) return
    const pulse =
      fastFlushActive && !reducedMotion ? 1 + Math.sin(clock.elapsedTime * 18) * 0.12 : 1
    marker.current.scale.setScalar(pulse)
  })

  return (
    <group>
      <Line
        points={[
          [-1.25, PHLEBOSTATIC_AXIS_Y, 0.69],
          [1.32, PHLEBOSTATIC_AXIS_Y, 0.69],
        ]}
        color="#7edbd2"
        dashScale={16}
        dashSize={0.45}
        dashed
        gapSize={0.3}
        lineWidth={1.2}
        opacity={0.7}
        transparent
      />
      <Line
        points={[
          [PAC_ROUTE[0][0], PAC_ROUTE[0][1], 0.64],
          [1.12, 1.78, 0.68],
          [TRANSDUCER_X, y, 0.7],
        ]}
        color="#c7dde0"
        lineWidth={1.5}
        opacity={0.82}
        transparent
      />
      <group ref={marker} position={[TRANSDUCER_X, y, 0.72]}>
        <mesh>
          <boxGeometry args={[0.25, 0.16, 0.12]} />
          <meshStandardMaterial
            color={zeroed ? '#78ddc9' : '#f0b85f'}
            emissive={zeroed ? '#2eaa9b' : '#c57d24'}
            emissiveIntensity={0.48}
            metalness={0.22}
            roughness={0.32}
          />
        </mesh>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.16, 12]} />
          <meshStandardMaterial color="#dce7e8" metalness={0.3} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function PacCatheterOverlay({
  state,
  reducedMotion,
}: {
  state: HemodynamicSimulationState
  reducedMotion: boolean
}) {
  const tip = useRef<THREE.Group>(null)
  const targetFraction =
    PAC_ROUTE_ENDPOINT_INDEX[state.catheter.position] / Math.max(1, PAC_ROUTE.length - 1)
  const renderedFraction = useRef(targetFraction)
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        PAC_ROUTE.map((point) => new THREE.Vector3(...point)),
        false,
        'centripetal',
      ),
    [],
  )
  const fastFlushActive =
    state.measurementSystem.fastFlushActiveUntil !== null &&
    state.measurementSystem.fastFlushActiveUntil > state.timeSeconds

  useFrame(() => {
    renderedFraction.current = reducedMotion
      ? targetFraction
      : THREE.MathUtils.lerp(renderedFraction.current, targetFraction, 0.15)
    tip.current?.position.copy(
      curve.getPoint(THREE.MathUtils.clamp(renderedFraction.current, 0, 1)),
    )
  })

  return (
    <group>
      <CardiacPath
        points={PAC_ROUTE}
        radius={CARDIAC_RIG.pac.radius}
        color="#e8bd4d"
        emissiveIntensity={0.08}
        radialSegments={12}
        visibleFraction={targetFraction}
        reducedMotion={reducedMotion}
      />
      <group ref={tip}>
        <mesh>
          <sphereGeometry
            args={[
              state.catheter.balloonInflated
                ? CARDIAC_RIG.pac.balloonRadius.inflated
                : CARDIAC_RIG.pac.balloonRadius.deflated,
              18,
              14,
            ]}
          />
          <meshPhysicalMaterial
            color={state.catheter.balloonInflated ? '#e9d7a1' : '#d6d4c5'}
            emissive="#d8b75a"
            emissiveIntensity={0.08}
            opacity={state.catheter.balloonInflated ? 0.58 : 0.9}
            roughness={0.22}
            thickness={0.12}
            transparent
          />
        </mesh>
        <mesh position={[0.035, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.075, 12]} />
          <meshStandardMaterial color="#d6d8d3" metalness={0.25} roughness={0.3} />
        </mesh>
      </group>
      <Transducer
        levelCm={state.measurementSystem.transducerLevelCm}
        zeroed={state.measurementSystem.zeroed}
        fastFlushActive={fastFlushActive}
        reducedMotion={reducedMotion}
      />
    </group>
  )
}

export function HemodynamicHeart3D({ state }: { state: HemodynamicSimulationState }) {
  const webglReady = useWebGLSupport()
  const reducedMotion = useReducedMotionPreference()
  const [contextLost, setContextLost] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [viewEpoch, setViewEpoch] = useState(0)
  const camera = CARDIAC_RIG.cameras.heart
  const anatomy = PAC_POSITION_ANATOMY[state.catheter.position]
  const level = state.measurementSystem.transducerLevelCm
  const levelLabel =
    level === 0
      ? 'at axis'
      : `${Math.abs(level).toFixed(0)} cm ${level > 0 ? 'above' : 'below'} axis`

  return (
    <div className={styles.physiologyViewport}>
      {!webglReady || contextLost ? (
        <div className={styles.physiologyWebglFallback}>
          <strong>
            {contextLost ? 'The 3D context was interrupted.' : 'WebGL is unavailable.'}
          </strong>
          <span>
            The catheter-position text, waveforms, measurements, and controls remain available.
          </span>
          {contextLost ? (
            <button
              type="button"
              onClick={() => {
                setContextLost(false)
                setEpoch((value) => value + 1)
              }}
            >
              Reload 3D view
            </button>
          ) : null}
        </div>
      ) : (
        <CanvasErrorBoundary
          fallback={
            <div className={styles.physiologyWebglFallback}>
              The explanatory 3D anatomy could not load. Use the synchronized waveform and text
              description.
            </div>
          }
        >
          <Canvas
            key={`${epoch}-${viewEpoch}`}
            dpr={[1, 1.5]}
            shadows
            camera={{ position: camera.position, fov: camera.fov, near: 0.1, far: 50 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            onCreated={(root) => setupRenderer(root, () => setContextLost(true))}
          >
            <ambientLight intensity={1.3} />
            <directionalLight position={[4, 6, 6]} intensity={2.3} castShadow />
            <directionalLight position={[-4, 1, 3]} intensity={0.72} color="#8ddbd5" />
            <pointLight position={[0, -1, 4]} intensity={0.75} color="#ffd9cf" />
            <Suspense fallback={null}>
              <CardiacHeartModel
                heartRateBpm={state.parameters.heartRateBpm}
                paused={state.paused}
                reducedMotion={reducedMotion}
              />
              <HeartGreatVesselsModel />
              <PacCatheterOverlay state={state} reducedMotion={reducedMotion} />
            </Suspense>
            <OrbitControls
              enablePan={false}
              maxDistance={camera.maxDistance}
              minDistance={camera.minDistance}
              target={camera.target}
            />
          </Canvas>
        </CanvasErrorBoundary>
      )}
      <div className={styles.physiologyOrientation}>
        <span>Anterior heart + distal PA</span>
        <span>Patient right is viewer left</span>
        <button
          type="button"
          aria-label="Reset 3D hemodynamic anatomy view"
          onClick={() => setViewEpoch((value) => value + 1)}
        >
          <RotateCcw aria-hidden="true" /> Reset view
        </button>
      </div>
      <div className={styles.physiologyAnatomyHud}>
        <strong>TIP · {anatomy.shortLabel}</strong>
        <span>Pressure transducer · {levelLabel}</span>
        <span>Yellow = PAC course · dashed teal = phlebostatic reference</span>
      </div>
    </div>
  )
}
