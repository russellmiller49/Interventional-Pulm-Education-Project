'use client'

import { Suspense, useRef, useSyncExternalStore } from 'react'
import { Clone, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'

import type { EcmoSimulationState, SimulationAction } from '../engine'
import styles from './cardiohelp-ecmo.module.css'

const ASSET_ROOT = '/models/cardiohelp-ecmo'
const PATIENT_ASSET = `${ASSET_ROOT}/patient-femoral-access.glb`
const CONSOLE_ASSET = `${ASSET_ROOT}/cardiohelp-console.glb`
const OXYGENATOR_ASSET = `${ASSET_ROOT}/oxygenator.glb`
const CLAMP_ASSET = `${ASSET_ROOT}/circuit-clamp.glb`
const SENSOR_ASSET = `${ASSET_ROOT}/hls-sensor-connector.glb`

const PATIENT_POSITION: [number, number, number] = [-1.35, -0.405, -0.3]
const PATIENT_SCALE = 0.92

function patientWorldPoint(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(
    PATIENT_POSITION[0] + x * PATIENT_SCALE,
    PATIENT_POSITION[1] + y * PATIENT_SCALE,
    PATIENT_POSITION[2] + z * PATIENT_SCALE,
  )
}

const DRAINAGE_INSERTION = patientWorldPoint(-0.135, 0.27, 0.09)
const RETURN_INSERTION = patientWorldPoint(0.135, 0.27, 0.09)
const DRAINAGE_HUB = new THREE.Vector3(-0.73, -0.08, 0.08)
const RETURN_HUB = new THREE.Vector3(-0.71, -0.1, -0.13)

const DRAINAGE_CANNULA_CURVE = new THREE.CatmullRomCurve3([
  DRAINAGE_INSERTION,
  new THREE.Vector3(-1.34, -0.09, -0.11),
  new THREE.Vector3(-1.05, -0.04, 0.03),
  DRAINAGE_HUB,
])
const RETURN_CANNULA_CURVE = new THREE.CatmullRomCurve3([
  RETURN_HUB,
  new THREE.Vector3(-0.92, -0.08, -0.08),
  new THREE.Vector3(-1.08, -0.1, -0.15),
  RETURN_INSERTION,
])
const DRAINAGE_CURVE = new THREE.CatmullRomCurve3([
  DRAINAGE_HUB,
  new THREE.Vector3(-0.59, 0.04, 0.31),
  new THREE.Vector3(-0.34, 0.14, 0.5),
  new THREE.Vector3(-0.08, 0.03, 0.35),
  new THREE.Vector3(0.12, -0.03, 0.24),
])
const POST_PUMP_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.32, 0.0, 0.24),
  new THREE.Vector3(0.48, 0.2, 0.31),
  new THREE.Vector3(0.58, 0.42, 0.43),
  new THREE.Vector3(0.75, 0.46, 0.5),
])
const RETURN_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(1.02, 0.4, 0.46),
  new THREE.Vector3(1.34, 0.17, 0.14),
  new THREE.Vector3(1.25, -0.08, -0.22),
  new THREE.Vector3(0.48, -0.02, -0.57),
  new THREE.Vector3(-0.18, 0.02, -0.42),
  new THREE.Vector3(-0.5, -0.04, -0.27),
  RETURN_HUB,
])
const SWEEP_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(1.26, -0.46, 0.62),
  new THREE.Vector3(1.05, -0.25, 0.62),
  new THREE.Vector3(0.92, 0.02, 0.56),
  new THREE.Vector3(0.9, 0.28, 0.51),
])

interface EcmoCircuit3DProps {
  state: EcmoSimulationState
  dispatch: (action: SimulationAction) => void
  controlsEnabled: boolean
}

let webglDetectionCache: boolean | null = null

function detectWebGL(): boolean {
  if (webglDetectionCache !== null) return webglDetectionCache
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
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

function reducedMotionRequested(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}

function SceneAsset({
  url,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  url: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}) {
  const { scene } = useGLTF(url)
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Clone object={scene} castShadow receiveShadow />
    </group>
  )
}

function FlowMarkers({
  curve,
  color,
  moving,
  speed,
  count = 6,
}: {
  curve: THREE.CatmullRomCurve3
  color: string
  moving: boolean
  speed: number
  count?: number
}) {
  const markers = useRef<Array<THREE.Mesh | null>>([])
  const progress = useRef(0)

  useFrame((_, delta) => {
    if (moving) progress.current = (progress.current + delta * speed) % 1
    markers.current.forEach((marker, index) => {
      if (!marker) return
      const position = curve.getPointAt((progress.current + index / count) % 1)
      marker.position.copy(position)
    })
  })

  return (
    <group visible={moving}>
      {Array.from({ length: count }, (_, index) => (
        <mesh
          key={index}
          ref={(marker) => {
            markers.current[index] = marker
          }}
          position={curve.getPointAt(index / count)}
        >
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
        </mesh>
      ))}
    </group>
  )
}

function CircuitTube({
  curve,
  color,
  moving,
  speed,
  radius = 0.038,
}: {
  curve: THREE.CatmullRomCurve3
  color: string
  moving: boolean
  speed: number
  radius?: number
}) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 72, radius, 12, false]} />
        <meshPhysicalMaterial
          color="#c9dadd"
          transparent
          opacity={0.34}
          roughness={0.18}
          metalness={0.02}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 72, radius * 0.63, 10, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={moving ? 0.23 : 0.04}
          transparent
          opacity={0.76}
        />
      </mesh>
      <FlowMarkers curve={curve} color={color} moving={moving} speed={speed} />
    </group>
  )
}

function CannulaSegment({
  curve,
  color,
  moving,
  speed,
}: {
  curve: THREE.CatmullRomCurve3
  color: string
  moving: boolean
  speed: number
}) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 48, 0.032, 14, false]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.42}
          roughness={0.22}
          metalness={0.01}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 48, 0.019, 12, false]} />
        <meshStandardMaterial color={color} roughness={0.38} />
      </mesh>
      <FlowMarkers curve={curve} color={color} moving={moving} speed={speed} count={3} />
    </group>
  )
}

function AccessDressing({
  position,
  color,
  site,
}: {
  position: THREE.Vector3
  color: string
  site: 'drainage' | 'return'
}) {
  return (
    <group position={position} userData={{ site }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <circleGeometry args={[0.105, 32]} />
        <meshPhysicalMaterial
          color="#dcece8"
          transparent
          opacity={0.46}
          roughness={0.3}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <torusGeometry args={[0.034, 0.008, 10, 32]} />
        <meshStandardMaterial color={color} roughness={0.36} />
      </mesh>
      <mesh position={[-0.062, 0.008, 0]}>
        <boxGeometry args={[0.065, 0.012, 0.038]} />
        <meshStandardMaterial color="#e8efeb" roughness={0.68} />
      </mesh>
      <mesh position={[0.062, 0.008, 0]}>
        <boxGeometry args={[0.065, 0.012, 0.038]} />
        <meshStandardMaterial color="#e8efeb" roughness={0.68} />
      </mesh>
    </group>
  )
}

function ConnectorHub({
  curve,
  curvePosition,
  color,
}: {
  curve: THREE.CatmullRomCurve3
  curvePosition: number
  color: string
}) {
  const point = curve.getPointAt(curvePosition)
  const tangent = curve.getTangentAt(curvePosition).normalize()
  const alignment = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent)

  return (
    <group position={point} quaternion={alignment}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.047, 0.047, 0.14, 24]} />
        <meshPhysicalMaterial
          color="#d8e5e5"
          transparent
          opacity={0.82}
          roughness={0.24}
          metalness={0.04}
        />
      </mesh>
      <mesh position={[-0.065, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.059, 0.059, 0.022, 24]} />
        <meshStandardMaterial color="#eef3ef" roughness={0.42} />
      </mesh>
      <mesh position={[0.055, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.052, 0.052, 0.026, 24]} />
        <meshStandardMaterial color={color} roughness={0.32} />
      </mesh>
    </group>
  )
}

function PatientFemoralAccess({
  returnColor,
  moving,
  speed,
}: {
  returnColor: string
  moving: boolean
  speed: number
}) {
  return (
    <group>
      <SceneAsset url={PATIENT_ASSET} position={PATIENT_POSITION} scale={PATIENT_SCALE} />
      <AccessDressing position={DRAINAGE_INSERTION} color="#5c7897" site="drainage" />
      <AccessDressing position={RETURN_INSERTION} color={returnColor} site="return" />
      <CannulaSegment
        curve={DRAINAGE_CANNULA_CURVE}
        color="#672f48"
        moving={moving}
        speed={speed}
      />
      <CannulaSegment
        curve={RETURN_CANNULA_CURVE}
        color={returnColor}
        moving={moving}
        speed={speed}
      />
      <ConnectorHub curve={DRAINAGE_CANNULA_CURVE} curvePosition={1} color="#5c7897" />
      <ConnectorHub curve={RETURN_CANNULA_CURVE} curvePosition={0} color={returnColor} />
    </group>
  )
}

function Pump({ running, rpm, animate }: { running: boolean; rpm: number; animate: boolean }) {
  const rotor = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (running && animate && rotor.current)
      rotor.current.rotation.z -= delta * Math.max(1.5, rpm / 420)
  })

  return (
    <group position={[0.22, 0.0, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.1, 40]} />
        <meshPhysicalMaterial color="#d8e5e6" roughness={0.2} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.058, 0]}>
        <cylinderGeometry args={[0.145, 0.145, 0.018, 40]} />
        <meshStandardMaterial color="#4f6f75" roughness={0.35} />
      </mesh>
      <group ref={rotor} position={[0, 0.073, 0]}>
        {Array.from({ length: 5 }, (_, index) => (
          <mesh key={index} rotation={[0, 0, (index / 5) * Math.PI * 2]} position={[0.065, 0, 0]}>
            <boxGeometry args={[0.1, 0.018, 0.035]} />
            <meshStandardMaterial
              color={running ? '#71e1e5' : '#5f7478'}
              emissive={running ? '#277e84' : '#000000'}
              emissiveIntensity={0.7}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function InteractiveClamp({
  limb,
  curve,
  curvePosition,
  closed,
  controlsEnabled,
  reduceMotion,
  onToggle,
}: {
  limb: 'drainage' | 'return'
  curve: THREE.CatmullRomCurve3
  curvePosition: number
  closed: boolean
  controlsEnabled: boolean
  reduceMotion: boolean
  onToggle: () => void
}) {
  const { scene } = useGLTF(CLAMP_ASSET)
  const instrument = useRef<THREE.Group>(null)
  const point = curve.getPointAt(curvePosition)
  const tangent = curve.getTangentAt(curvePosition).normalize()
  const alignment = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent)

  useFrame((_, delta) => {
    if (!instrument.current) return
    const targetTilt = closed ? 0 : -0.72
    if (reduceMotion) {
      instrument.current.rotation.x = targetTilt
      instrument.current.position.y = closed ? 0.015 : 0.075
      return
    }
    instrument.current.rotation.x = THREE.MathUtils.damp(
      instrument.current.rotation.x,
      targetTilt,
      9,
      delta,
    )
    instrument.current.position.y = THREE.MathUtils.damp(
      instrument.current.position.y,
      closed ? 0.015 : 0.075,
      9,
      delta,
    )
  })

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    if (controlsEnabled) onToggle()
  }

  return (
    <group position={point} quaternion={alignment}>
      <group
        ref={instrument}
        position={[0.076, closed ? 0.015 : 0.075, 0]}
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation()
          if (controlsEnabled) document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      >
        <Clone object={scene} castShadow receiveShadow />
      </group>
      {closed ? (
        <group>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.018, 0.058, 0.085]} />
            <meshStandardMaterial color="#ff5f59" emissive="#9b191c" emissiveIntensity={0.8} />
          </mesh>
          <pointLight color="#ff645f" intensity={0.55} distance={0.45} />
        </group>
      ) : null}
      <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.065, 0.005, 8, 32]} />
        <meshBasicMaterial color={closed ? '#ff6b73' : '#76d69b'} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.09, 0]} visible={false} onClick={handleClick}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      <group userData={{ limb }} />
    </group>
  )
}

function BedsideScene({
  state,
  dispatch,
  controlsEnabled,
  reduceMotion,
}: EcmoCircuit3DProps & { reduceMotion: boolean }) {
  const bloodMoving =
    !reduceMotion && state.device.pumpRunning && Math.abs(state.circuit.bloodFlow) > 0.05
  const gasMoving = !reduceMotion && state.gas.sourceConnected && state.gas.sweepLpm > 0
  const flowSpeed = 0.1 + Math.min(Math.abs(state.circuit.bloodFlow) / 8, 1) * 0.2
  const returnColor = state.supportMode === 'va' ? '#ff4353' : '#d85b6b'

  return (
    <>
      <color attach="background" args={['#061317']} />
      <fog attach="fog" args={['#061317', 5.8, 9]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#b5e6e8', '#132124', 0.75]} />
      <directionalLight
        castShadow
        color="#e8ffff"
        intensity={2.1}
        position={[3.5, 5, 4]}
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight color="#9fa6ff" intensity={0.65} position={[-4, 2, -3]} />

      <mesh position={[-1.35, -0.67, -0.3]} receiveShadow castShadow>
        <boxGeometry args={[1.22, 0.12, 2.08]} />
        <meshStandardMaterial color="#17353b" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[-1.35, -0.56, -0.3]} receiveShadow castShadow>
        <boxGeometry args={[1.08, 0.13, 1.98]} />
        <meshStandardMaterial color="#afc9c7" roughness={0.88} />
      </mesh>
      <PatientFemoralAccess returnColor={returnColor} moving={bloodMoving} speed={flowSpeed} />
      <SceneAsset url={CONSOLE_ASSET} position={[1.52, -0.06, 0.56]} rotation={[0, -0.35, 0]} />
      <SceneAsset
        url={OXYGENATOR_ASSET}
        position={[0.87, 0.38, 0.5]}
        rotation={[0.08, -0.62, -0.08]}
      />
      <SceneAsset
        url={SENSOR_ASSET}
        position={[1.29, 0.05, -0.06]}
        rotation={[Math.PI / 2, 0, -0.45]}
        scale={0.85}
      />

      <CircuitTube curve={DRAINAGE_CURVE} color="#743348" moving={bloodMoving} speed={flowSpeed} />
      <CircuitTube curve={POST_PUMP_CURVE} color="#a94455" moving={bloodMoving} speed={flowSpeed} />
      <CircuitTube
        curve={RETURN_CURVE}
        color={returnColor}
        moving={bloodMoving}
        speed={flowSpeed}
      />
      <CircuitTube
        curve={SWEEP_CURVE}
        color="#5ed8df"
        moving={gasMoving}
        speed={0.13 + state.gas.sweepLpm / 80}
        radius={0.022}
      />
      <Pump
        running={state.device.pumpRunning}
        rpm={state.device.rpmSetpoint}
        animate={!reduceMotion}
      />
      <InteractiveClamp
        limb="drainage"
        curve={DRAINAGE_CURVE}
        curvePosition={0.47}
        closed={state.circuit.drainageClampClosed}
        controlsEnabled={controlsEnabled}
        reduceMotion={reduceMotion}
        onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage' })}
      />
      <InteractiveClamp
        limb="return"
        curve={RETURN_CURVE}
        curvePosition={0.42}
        closed={state.circuit.returnClampClosed}
        controlsEnabled={controlsEnabled}
        reduceMotion={reduceMotion}
        onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return' })}
      />

      <mesh position={[0, -0.72, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.6, 4.2]} />
        <meshStandardMaterial color="#081b20" roughness={0.92} />
      </mesh>
      <gridHelper args={[5.5, 22, '#1f555d', '#102f35']} position={[0, -0.712, 0]} />
      <OrbitControls
        makeDefault
        target={[0, -0.05, 0.05]}
        enablePan={false}
        minDistance={4.1}
        maxDistance={7.2}
        minPolarAngle={0.65}
        maxPolarAngle={1.38}
      />
    </>
  )
}

function ClampControl({
  limb,
  closed,
  disabled,
  onToggle,
}: {
  limb: 'Drainage' | 'Return'
  closed: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={styles.clampControl}
      data-closed={closed}
      aria-pressed={closed}
      disabled={disabled}
      onClick={onToggle}
    >
      <span aria-hidden="true" className={styles.clampControlIcon}>
        {closed ? '×' : '↔'}
      </span>
      <span>
        <strong>{limb} clamp</strong>
        <small>{closed ? 'Closed · no forward flow' : 'Open · flow path available'}</small>
      </span>
    </button>
  )
}

export function EcmoCircuit3D({ state, dispatch, controlsEnabled }: EcmoCircuit3DProps) {
  const webglReady = useSyncExternalStore(subscribeNever, detectWebGL, () => false)
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionRequested,
    () => true,
  )
  const closedClampCount =
    Number(state.circuit.drainageClampClosed) + Number(state.circuit.returnClampClosed)
  const clampControlsEnabled = controlsEnabled && state.scenario.prediction.committed
  const flowState =
    closedClampCount > 0 ? 'ISOLATED' : state.device.pumpRunning ? 'FLOWING' : 'PUMP STOPPED'

  return (
    <div className={styles.circuit3dShell}>
      <div className={styles.circuit3dViewport} aria-hidden="true">
        {webglReady ? (
          <CanvasErrorBoundary
            fallback={
              <div className={styles.circuit3dFallback}>
                The bedside 3D view could not load. The diagnostic circuit map and clamp controls
                remain available.
              </div>
            }
          >
            <Canvas
              shadows
              dpr={[1, 1.7]}
              camera={{ position: [4.4, 2.75, 5.25], fov: 36, near: 0.05, far: 50 }}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
            >
              <Suspense fallback={null}>
                <BedsideScene
                  state={state}
                  dispatch={dispatch}
                  controlsEnabled={clampControlsEnabled}
                  reduceMotion={reduceMotion}
                />
              </Suspense>
            </Canvas>
          </CanvasErrorBoundary>
        ) : (
          <div className={styles.circuit3dFallback}>
            WebGL is unavailable. Use the diagnostic circuit map below; the accessible clamp
            controls remain fully functional.
          </div>
        )}
        <div className={styles.circuit3dHud}>
          <span data-state={flowState}>{flowState}</span>
          <strong>{state.circuit.bloodFlow.toFixed(2)} L/min</strong>
          <small>Drag to orbit · scroll to zoom · select a clamp or use the controls below</small>
        </div>
        <div className={styles.circuit3dLabels} aria-hidden="true">
          <span>Patient + femoral cannulas</span>
          <span>Centrifugal pump</span>
          <span>Membrane oxygenator</span>
          <span>Flow / bubble sensor</span>
        </div>
      </div>

      <div className={styles.clampControlPanel} aria-label="Circuit isolation clamps">
        <div>
          <span className={styles.kicker}>Interactive flow isolation</span>
          <h3>Bedside circuit clamps</h3>
          <p>
            Closing either modeled limb immediately interrupts forward circuit flow. Use clamp
            isolation only when the learning scenario calls for it; a running pump against an
            occluded limb can create hazardous pressure conditions.
          </p>
        </div>
        <div className={styles.clampControlGrid}>
          <ClampControl
            limb="Drainage"
            closed={state.circuit.drainageClampClosed}
            disabled={!clampControlsEnabled}
            onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage' })}
          />
          <ClampControl
            limb="Return"
            closed={state.circuit.returnClampClosed}
            disabled={!clampControlsEnabled}
            onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return' })}
          />
        </div>
        <div
          className={styles.clampStatus}
          role="status"
          aria-live="polite"
          data-alert={closedClampCount > 0}
        >
          <strong>{flowState}</strong>
          <span>
            {!clampControlsEnabled
              ? 'Commit the scenario prediction before using circuit isolation controls.'
              : closedClampCount === 0
                ? 'Both circuit clamps are open.'
                : `${closedClampCount} clamp${closedClampCount === 1 ? '' : 's'} closed; modeled forward flow is stopped.`}
          </span>
        </div>
      </div>
    </div>
  )
}
