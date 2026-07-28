'use client'

import { Suspense, useRef, useState } from 'react'
import { Line, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, type RootState } from '@react-three/fiber'
import { RotateCcw } from 'lucide-react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { CardiacHeartModel } from '@/features/cardiac-anatomy/components/CardiacHeartModel'
import {
  ProgressiveSplineTube,
  SplineFollower,
  useTrajectoryPlayback,
} from '@/features/cardiac-anatomy/components/CardiacTrajectory'
import {
  useReducedMotionPreference,
  useWebGLSupport,
} from '@/features/cardiac-anatomy/components/useCardiac3DSupport'
import {
  PAC_POSITION_ANATOMY,
  PAC_ROUTE,
  PAC_ROUTE_PROGRESS,
  PHLEBOSTATIC_AXIS_Y,
  TRANSDUCER_LEVEL_WORLD_UNITS_PER_CM,
  TRANSDUCER_X,
  CARDIAC_RIG,
} from '@/features/cardiac-anatomy/content/paths'

import {
  PAC_CATHETER_FULL_ROUTE_DURATION_SECONDS,
  type HemodynamicSimulationState,
} from '../engine'
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
          [-1.75, PHLEBOSTATIC_AXIS_Y, 1.64],
          [1.82, PHLEBOSTATIC_AXIS_Y, 1.64],
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
        points={[PAC_ROUTE[0], [1.64, 1.78, 1.2], [TRANSDUCER_X, y, 1.68]]}
        color="#c7dde0"
        lineWidth={1.5}
        opacity={0.82}
        transparent
      />
      <group ref={marker} position={[TRANSDUCER_X, y, 1.72]}>
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

const BALLOON_DEFLATED_COLOR = new THREE.Color('#d6d4c5')
const BALLOON_INFLATED_COLOR = new THREE.Color('#e9d7a1')

export function isPacBalloonVisuallyInflated(
  catheter: HemodynamicSimulationState['catheter'],
): boolean {
  return catheter.position === 'wedge' || catheter.balloonInflated || catheter.floatBalloonInflated
}

function PacBalloonVisual({
  balloonInflated,
  reducedMotion,
}: {
  balloonInflated: boolean
  reducedMotion: boolean
}) {
  const balloon = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshPhysicalMaterial>(null)

  useFrame((_, delta) => {
    if (!balloon.current || !material.current) return
    const radius = balloonInflated
      ? CARDIAC_RIG.pac.balloonRadius.inflated
      : CARDIAC_RIG.pac.balloonRadius.deflated
    const nextScale: [number, number, number] = balloonInflated
      ? [radius * 0.9, radius * 1.15, radius * 0.9]
      : [radius * 0.78, radius * 1.5, radius * 0.78]
    if (reducedMotion) {
      balloon.current.scale.set(...nextScale)
      material.current.color.copy(balloonInflated ? BALLOON_INFLATED_COLOR : BALLOON_DEFLATED_COLOR)
      material.current.opacity = balloonInflated ? 0.58 : 0.9
      material.current.emissiveIntensity = balloonInflated ? 0.36 : 0.08
      return
    }
    const damping = 18

    balloon.current.scale.set(
      THREE.MathUtils.damp(balloon.current.scale.x, nextScale[0], damping, delta),
      THREE.MathUtils.damp(balloon.current.scale.y, nextScale[1], damping, delta),
      THREE.MathUtils.damp(balloon.current.scale.z, nextScale[2], damping, delta),
    )
    material.current.color.lerp(
      balloonInflated ? BALLOON_INFLATED_COLOR : BALLOON_DEFLATED_COLOR,
      1 - Math.exp(-damping * Math.min(delta, 0.1)),
    )
    material.current.opacity = THREE.MathUtils.damp(
      material.current.opacity,
      balloonInflated ? 0.58 : 0.9,
      damping,
      delta,
    )
    material.current.emissiveIntensity = THREE.MathUtils.damp(
      material.current.emissiveIntensity,
      balloonInflated ? 0.36 : 0.08,
      damping,
      delta,
    )
  })

  const deflatedRadius = CARDIAC_RIG.pac.balloonRadius.deflated
  const inflatedRadius = CARDIAC_RIG.pac.balloonRadius.inflated

  return (
    <group>
      {balloonInflated ? (
        <mesh renderOrder={33} scale={[inflatedRadius, inflatedRadius * 1.26, inflatedRadius]}>
          <sphereGeometry args={[1, 22, 16]} />
          <meshBasicMaterial
            color="#ffd166"
            depthTest={false}
            depthWrite={false}
            opacity={0.2}
            side={THREE.BackSide}
            transparent
          />
        </mesh>
      ) : null}
      <mesh
        ref={balloon}
        renderOrder={34}
        scale={[deflatedRadius * 0.78, deflatedRadius * 1.5, deflatedRadius * 0.78]}
      >
        <sphereGeometry args={[1, 22, 16]} />
        <meshPhysicalMaterial
          ref={material}
          color="#d6d4c5"
          depthTest={false}
          depthWrite={false}
          emissive="#d8b75a"
          emissiveIntensity={0.08}
          opacity={0.9}
          roughness={0.22}
          thickness={0.12}
          transparent
        />
      </mesh>
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
  const confirmedPosition = state.catheter.position === 'wedge' ? 'pa' : state.catheter.position
  const requestedPosition = state.catheter.targetPosition ?? confirmedPosition
  const routePosition = requestedPosition === 'wedge' ? 'pa' : requestedPosition
  const targetFraction = PAC_ROUTE_PROGRESS[routePosition]
  const trajectoryReducedMotion = reducedMotion && state.catheter.targetPosition === null
  const renderedFraction = useTrajectoryPlayback({
    targetProgress: targetFraction,
    replayKey: 0,
    durationSeconds: PAC_CATHETER_FULL_ROUTE_DURATION_SECONDS,
    reducedMotion: trajectoryReducedMotion,
    paused: state.paused,
    initialProgress: PAC_ROUTE_PROGRESS[confirmedPosition],
    snapToTarget: state.catheter.targetPosition === null,
  })
  const fastFlushActive =
    state.measurementSystem.fastFlushActiveUntil !== null &&
    state.measurementSystem.fastFlushActiveUntil > state.timeSeconds

  return (
    <group>
      <ProgressiveSplineTube
        points={PAC_ROUTE}
        progress={renderedFraction}
        radius={CARDIAC_RIG.pac.radius}
        color="#e8bd4d"
        depthTest={false}
        emissiveIntensity={0.08}
        radialSegments={12}
        renderOrder={31}
      />
      <SplineFollower
        points={PAC_ROUTE}
        progress={renderedFraction}
        lateralMotion={targetFraction >= PAC_ROUTE_PROGRESS.ra ? 0.012 : 0.004}
        reducedMotion={reducedMotion}
        renderOrder={32}
      >
        <PacBalloonVisual
          balloonInflated={isPacBalloonVisuallyInflated(state.catheter)}
          reducedMotion={reducedMotion}
        />
        <mesh position={[0, -0.075, 0]} renderOrder={32}>
          <cylinderGeometry args={[0.025, 0.025, 0.12, 12]} />
          <meshStandardMaterial
            color="#d6d8d3"
            depthTest={false}
            depthWrite={false}
            metalness={0.25}
            roughness={0.3}
          />
        </mesh>
      </SplineFollower>
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
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const camera = CARDIAC_RIG.cameras.heart
  const confirmedAnatomy = PAC_POSITION_ANATOMY[state.catheter.position]
  const targetAnatomy = state.catheter.targetPosition
    ? PAC_POSITION_ANATOMY[state.catheter.targetPosition]
    : null
  const level = state.measurementSystem.transducerLevelCm
  const levelLabel =
    level === 0
      ? 'at axis'
      : `${Math.abs(level).toFixed(0)} cm ${level > 0 ? 'above' : 'below'} axis`
  const balloonVisuallyInflated = isPacBalloonVisuallyInflated(state.catheter)
  const balloonLabel =
    state.catheter.position === 'wedge'
      ? 'INFLATED for brief PA occlusion'
      : state.catheter.floatBalloonInflated
        ? 'INFLATED for flow-directed advancement'
        : state.catheter.balloonInflated
          ? 'INFLATED'
          : 'deflated'

  function adjustView({
    azimuth = 0,
    polar = 0,
    distanceScale = 1,
  }: {
    azimuth?: number
    polar?: number
    distanceScale?: number
  }) {
    const controls = controlsRef.current
    if (!controls) return
    const offset = controls.object.position.clone().sub(controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    spherical.theta += azimuth
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + polar, 0.25, Math.PI - 0.25)
    spherical.radius = THREE.MathUtils.clamp(
      spherical.radius * distanceScale,
      camera.minDistance,
      camera.maxDistance,
    )
    controls.object.position.copy(controls.target).add(offset.setFromSpherical(spherical))
    controls.object.lookAt(controls.target)
    controls.update()
  }

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
            key={epoch}
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
              <PacCatheterOverlay state={state} reducedMotion={reducedMotion} />
            </Suspense>
            <OrbitControls
              ref={controlsRef}
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
        <div
          className={styles.physiologyKeyboardControls}
          role="group"
          aria-label="Keyboard-accessible 3D view controls"
        >
          <button
            type="button"
            aria-label="Rotate 3D anatomy view left"
            disabled={!webglReady || contextLost}
            onClick={() => adjustView({ azimuth: -Math.PI / 10 })}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Rotate 3D anatomy view right"
            disabled={!webglReady || contextLost}
            onClick={() => adjustView({ azimuth: Math.PI / 10 })}
          >
            →
          </button>
          <button
            type="button"
            aria-label="Tilt 3D anatomy view up"
            disabled={!webglReady || contextLost}
            onClick={() => adjustView({ polar: -Math.PI / 12 })}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Tilt 3D anatomy view down"
            disabled={!webglReady || contextLost}
            onClick={() => adjustView({ polar: Math.PI / 12 })}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="Zoom 3D anatomy view in"
            disabled={!webglReady || contextLost}
            onClick={() => adjustView({ distanceScale: 0.85 })}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom 3D anatomy view out"
            disabled={!webglReady || contextLost}
            onClick={() => adjustView({ distanceScale: 1.18 })}
          >
            −
          </button>
        </div>
        <button
          type="button"
          aria-label="Reset 3D hemodynamic anatomy view"
          disabled={!webglReady || contextLost}
          onClick={() => controlsRef.current?.reset()}
        >
          <RotateCcw aria-hidden="true" /> Reset view
        </button>
      </div>
      <div className={styles.physiologyAnatomyHud}>
        <strong>
          TIP · {confirmedAnatomy.shortLabel}
          {targetAnatomy ? ` → ${targetAnatomy.shortLabel}` : ''}
        </strong>
        {targetAnatomy ? (
          <span>Advancing · waveform remains {confirmedAnatomy.shortLabel}</span>
        ) : null}
        <span
          className={styles.physiologyBalloonStatus}
          data-inflated={balloonVisuallyInflated || undefined}
        >
          Balloon · {balloonLabel}
        </span>
        <span>Pressure transducer · {levelLabel}</span>
        <span>Yellow = PAC course · dashed teal = phlebostatic reference</span>
      </div>
    </div>
  )
}
