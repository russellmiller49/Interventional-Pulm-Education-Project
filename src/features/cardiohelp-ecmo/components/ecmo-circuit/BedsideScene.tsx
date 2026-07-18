'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clone, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import type { EcmoSimulationState, SimulationAction } from '../../engine'
import {
  bloodColor,
  CAMERA_TARGET,
  CONSOLE_ASSET,
  FLOOR_Y,
  PALETTE,
  PATIENT_ASSET,
  PATIENT_POSITION,
  PATIENT_SCALE,
  SENSOR_ASSET,
  TUBE_RADII,
} from './constants'
import { buildCircuitLayout } from './layout'
import { FlowTube } from './FlowTube'
import { StaticFlowArrows } from './StaticFlowArrows'
import { PatientAccessSite } from './PatientAccessSite'
import { HlsModule } from './HlsModule'
import { InteractiveClamp } from './InteractiveClamp'
import { SceneLabels } from './SceneLabels'

const CONSOLE_POSITION = new THREE.Vector3(1.52, 0, 0.56)
const SWEEP_TINT = new THREE.Color(PALETTE.sweepGas)

/** Clone a GLB grounded so its bounding-box bottom rests on the floor. */
function GroundedAsset({
  url,
  x,
  z,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  url: string
  x: number
  z: number
  rotation?: [number, number, number]
  scale?: number
}) {
  const { scene } = useGLTF(url)
  const restY = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(scene)
    return FLOOR_Y - bounds.min.y * scale
  }, [scale, scene])
  return (
    <group position={[x, restY, z]} rotation={rotation} scale={scale}>
      <Clone object={scene} castShadow receiveShadow />
    </group>
  )
}

function ContactShadow({
  position,
  radius,
  opacity,
}: {
  position: [number, number, number]
  radius: number
  opacity: number
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 6, 64, 64, 64)
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, 128, 128)
    }
    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.colorSpace = THREE.SRGBColorSpace
    return canvasTexture
  }, [])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

export interface BedsideSceneProps {
  state: EcmoSimulationState
  dispatch: (action: SimulationAction) => void
  controlsEnabled: boolean
  reduceMotion: boolean
  labelsVisible: boolean
}

export function BedsideScene({
  state,
  dispatch,
  controlsEnabled,
  reduceMotion,
  labelsVisible,
}: BedsideSceneProps) {
  const layout = useMemo(() => buildCircuitLayout(state.supportMode), [state.supportMode])
  const [orbiting, setOrbiting] = useState(false)
  const patient = useGLTF(PATIENT_ASSET)
  const sensor = useGLTF(SENSOR_ASSET)
  const sensorAlignment = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), layout.sensorTangent),
    [layout.sensorTangent],
  )

  const bloodMoving = state.device.pumpRunning && Math.abs(state.circuit.bloodFlow) > 0.05
  const gasMoving = state.gas.sourceConnected && state.gas.sweepLpm > 0
  const flowTarget = bloodMoving ? 1 : 0
  const flowDirection: 1 | -1 = state.circuit.bloodFlow < 0 ? -1 : 1
  const flowSpeed = 0.1 + Math.min(Math.abs(state.circuit.bloodFlow) / 8, 1) * 0.25
  const drainageTint = useMemo(() => bloodColor(state.circuit.svo2 / 100), [state.circuit.svo2])
  const returnTint = useMemo(
    () => bloodColor(state.circuit.postOxygenatorSaturation / 100),
    [state.circuit.postOxygenatorSaturation],
  )
  const drainageCollapse = state.device.pumpRunning && state.circuit.pVen <= -300 ? 1 : 0

  return (
    <>
      <color attach="background" args={[PALETTE.background]} />
      <fog attach="fog" args={[PALETTE.background, 5.8, 9]} />
      <ambientLight intensity={0.25} />
      <hemisphereLight args={['#b5e6e8', '#0c191c', 0.45]} />
      <directionalLight
        castShadow
        color="#eaffff"
        intensity={1.6}
        position={[3.5, 5, 4]}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight color="#9fb4ff" intensity={0.4} position={[-4, 2.5, -3]} />
      <directionalLight color="#71e1e5" intensity={0.5} position={[-2, 3, 5]} />

      {/* Bed and patient */}
      <mesh position={[-1.35, -0.67, -0.3]} receiveShadow castShadow>
        <boxGeometry args={[1.22, 0.12, 2.08]} />
        <meshStandardMaterial color={PALETTE.bedFrame} roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[-1.35, -0.56, -0.3]} receiveShadow castShadow>
        <boxGeometry args={[1.08, 0.13, 1.98]} />
        <meshStandardMaterial color={PALETTE.mattress} roughness={0.88} />
      </mesh>
      <group position={PATIENT_POSITION} scale={PATIENT_SCALE}>
        <Clone object={patient.scene} castShadow receiveShadow />
      </group>
      <PatientAccessSite layout={layout} />

      {/* Equipment */}
      <GroundedAsset
        url={CONSOLE_ASSET}
        x={CONSOLE_POSITION.x}
        z={CONSOLE_POSITION.z}
        rotation={[0, -0.35, 0]}
      />
      <HlsModule
        layout={layout}
        running={state.device.pumpRunning}
        rpm={state.device.rpmSetpoint}
        animate={!reduceMotion}
        consolePosition={CONSOLE_POSITION}
      />
      <group position={layout.sensorPosition} quaternion={sensorAlignment} scale={0.85}>
        <Clone object={sensor.scene} castShadow receiveShadow />
      </group>

      {/* Circuit limbs */}
      <FlowTube
        curve={layout.drainageLine}
        wallRadius={TUBE_RADII.circuitWall}
        coreRadius={TUBE_RADII.circuitCore}
        tint={drainageTint}
        flowTarget={flowTarget}
        speed={flowSpeed}
        direction={flowDirection}
        pinchTarget={state.circuit.drainageClampClosed ? 1 : 0}
        pinchU={layout.drainageClampU}
        collapseTarget={drainageCollapse}
        reduceMotion={reduceMotion}
        cacheKey="drainage-line"
      />
      <FlowTube
        curve={layout.returnLine}
        wallRadius={TUBE_RADII.circuitWall}
        coreRadius={TUBE_RADII.circuitCore}
        tint={returnTint}
        flowTarget={flowTarget}
        speed={flowSpeed}
        direction={flowDirection}
        pinchTarget={state.circuit.returnClampClosed ? 1 : 0}
        pinchU={layout.returnClampU}
        reduceMotion={reduceMotion}
        cacheKey="return-line"
      />
      <FlowTube
        curve={layout.sweepLine}
        wallRadius={TUBE_RADII.sweepWall}
        coreRadius={TUBE_RADII.sweepCore}
        tint={SWEEP_TINT}
        flowTarget={gasMoving ? 1 : 0}
        speed={0.13 + state.gas.sweepLpm / 80}
        direction={1}
        pinchTarget={0}
        pinchU={0.5}
        reduceMotion={reduceMotion}
        cacheKey="sweep-line"
      />
      {reduceMotion ? (
        <>
          <StaticFlowArrows
            curve={layout.drainageLine}
            tint={drainageTint}
            visible={bloodMoving}
            direction={flowDirection}
          />
          <StaticFlowArrows
            curve={layout.returnLine}
            tint={returnTint}
            visible={bloodMoving}
            direction={flowDirection}
          />
        </>
      ) : null}

      <InteractiveClamp
        limb="drainage"
        curve={layout.drainageLine}
        curvePosition={layout.drainageClampU}
        closed={state.circuit.drainageClampClosed}
        controlsEnabled={controlsEnabled}
        reduceMotion={reduceMotion}
        onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage' })}
      />
      <InteractiveClamp
        limb="return"
        curve={layout.returnLine}
        curvePosition={layout.returnClampU}
        closed={state.circuit.returnClampClosed}
        controlsEnabled={controlsEnabled}
        reduceMotion={reduceMotion}
        onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return' })}
      />

      <SceneLabels layout={layout} visible={labelsVisible} dimmed={orbiting} />

      {/* Floor + soft contact shadows */}
      <mesh position={[0, FLOOR_Y, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.6, 4.2]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.92} />
      </mesh>
      <gridHelper args={[5.5, 22, '#1f555d', '#102f35']} position={[0, FLOOR_Y + 0.008, 0]} />
      <ContactShadow position={[-1.35, FLOOR_Y + 0.012, -0.3]} radius={1.35} opacity={0.55} />
      <ContactShadow position={[1.52, FLOOR_Y + 0.012, 0.56]} radius={0.65} opacity={0.5} />
      <ContactShadow
        position={[layout.hlsModulePosition.x, FLOOR_Y + 0.012, layout.hlsModulePosition.z]}
        radius={0.5}
        opacity={0.45}
      />

      <OrbitControls
        makeDefault
        target={CAMERA_TARGET}
        enablePan={false}
        minDistance={4.1}
        maxDistance={7.2}
        minPolarAngle={0.65}
        maxPolarAngle={1.38}
        onStart={() => setOrbiting(true)}
        onEnd={() => setOrbiting(false)}
      />
    </>
  )
}
