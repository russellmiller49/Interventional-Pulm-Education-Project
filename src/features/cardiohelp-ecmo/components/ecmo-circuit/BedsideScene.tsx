'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clone, OrbitControls, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import type { EcmoSimulationState, SimulationAction } from '../../engine'
import {
  BLENDER_ASSET,
  BLENDER_MODEL_BOUNDS,
  BLENDER_PLACEMENT,
  bloodColor,
  CAMERA_TARGET,
  CONSOLE_ASSET,
  CONSOLE_MODEL_BOUNDS,
  CONSOLE_PLACEMENT,
  FLOOR_Y,
  PALETTE,
  PATIENT_ASSET,
  PATIENT_POSITION,
  PATIENT_SCALE,
  SENSOR_ASSET,
  TUBE_RADII,
} from './constants'
import { drainageChatterActive } from './chatter'
import { applyBedsidePanFrameRules, lockBedsidePanOnNewInstance } from './panning'
import { groundAsset, type AssetPlacement, type ModelBounds } from './grounding'
import { buildCircuitLayout } from './layout'
import { FlowTube } from './FlowTube'
import { StaticFlowArrows } from './StaticFlowArrows'
import { PatientAccessSite } from './PatientAccessSite'
import { HlsModule } from './HlsModule'
import { InteractiveClamp } from './InteractiveClamp'
import { SceneLabels } from './SceneLabels'

const SWEEP_TINT = new THREE.Color(PALETTE.sweepGas)

/**
 * Clone a GLB so the *transformed* asset rests on the floor.
 *
 * The bounding box is taken after the rotation and scale are applied, not before. Grounding on the
 * unrotated box only ever worked for a yaw; the console needs a roll to stand on its base, and a
 * rolled asset placed by its unrotated `min.y` sinks through the floor or hovers above it.
 *
 * `bounds` is the model-local box, authored in constants rather than measured from the loaded GLB,
 * so the label layout and the offline harness ground the asset the same way this does without
 * having to load it.
 */
function GroundedAsset({
  url,
  bounds,
  placement,
}: {
  url: string
  bounds: ModelBounds
  placement: AssetPlacement
}) {
  const { scene } = useGLTF(url)
  const origin = useMemo(() => groundAsset(bounds, placement, FLOOR_Y).origin, [bounds, placement])
  return (
    <group position={origin} rotation={placement.rotation} scale={placement.scale}>
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
  /** Scene label ids the current teaching step is standing at. */
  emphasisSceneLabelIds?: readonly string[] | null
}

export function BedsideScene({
  state,
  dispatch,
  controlsEnabled,
  reduceMotion,
  labelsVisible,
  emphasisSceneLabelIds = null,
}: BedsideSceneProps) {
  const layout = useMemo(() => buildCircuitLayout(state.supportMode), [state.supportMode])
  const [orbiting, setOrbiting] = useState(false)
  const controls = useRef<OrbitControlsImpl>(null)
  const interacting = useRef(false)

  /*
   * Pan unlocks with zoom, and the target stays fenced to the scene.
   *
   * `applyBedsidePanFrameRules` is the single owner of `enablePan`. It is mutated directly on the
   * controls instance rather than through state or a prop: the distance changes every zoom frame,
   * a React round-trip per frame would buy nothing, and the JSX passing `enablePan={false}` beside
   * this write was a second authority over the same field — R3F v9 only re-applies props whose JSX
   * value changed, so the constant never actually fought the frame rule, but nothing said so where
   * the conflict sat. The prop is gone; the instance starts locked in `attachControls` and the
   * frame rule decides everything after.
   */
  useFrame((_, delta) => {
    const instance = controls.current
    if (!instance) return
    applyBedsidePanFrameRules(instance, delta, reduceMotion, interacting.current)
  })

  /*
   * Locked before the first frame runs — once per instance, in `lockBedsidePanOnNewInstance`.
   *
   * Not inline: a callback ref re-runs on every commit whose identity changed, and this scene
   * re-renders with every simulation tick, so an unconditional `enablePan = false` here re-locked
   * the pan between frames — the split-authority defect again, from the other side. The helper
   * keys the lock to the instance, so the frame rule stays the only writer after mount.
   */
  const lockedControls = useRef<OrbitControlsImpl | null>(null)
  const attachControls = (instance: OrbitControlsImpl | null) => {
    controls.current = instance
    lockBedsidePanOnNewInstance(lockedControls, instance)
  }
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
  // The drainage limb carries venous-line blood, which under VV recirculation is brighter than the
  // systemic mixed-venous estimate. Tinting from the estimate would hide exactly that sign.
  const drainageTint = useMemo(
    () => bloodColor(state.circuit.preOxygenatorSaturation / 100),
    [state.circuit.preOxygenatorSaturation],
  )
  const returnTint = useMemo(
    () => bloodColor(state.circuit.postOxygenatorSaturation / 100),
    [state.circuit.postOxygenatorSaturation],
  )
  /*
   * Driven by the engine's own chatter flag, not by a second pressure threshold of this view's own.
   *
   * The previous rule here was `pVen.displayed <= -300`, which no authored drainage scenario ever
   * reaches — the preload sweep bottoms out near -143 mmHg — and the one state that does reach -350
   * is a closed clamp, whose narrow pinch then wins the `collapse > pinch` race in FlowTube. So the
   * bedside scene showed nothing at all while the lesson text, the pressure-zone map and the engine
   * all said the drainage line was juddering. `drainageChatter` already carries "past drainage
   * capacity and pVen < -75"; a view has no business deriving a competing one.
   */
  const drainageChattering = drainageChatterActive(state)
  const drainageCollapse = drainageChattering ? 1 : 0

  return (
    <>
      <color attach="background" args={[PALETTE.background]} />
      {/* Fog opens at 6.6 so the patient (≈6.3 m from the default camera) sits
          in front of the band instead of dimmed inside it. */}
      <fog attach="fog" args={[PALETTE.background, 6.6, 10]} />
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
        bounds={CONSOLE_MODEL_BOUNDS}
        placement={CONSOLE_PLACEMENT}
      />
      <GroundedAsset
        url={BLENDER_ASSET}
        bounds={BLENDER_MODEL_BOUNDS}
        placement={BLENDER_PLACEMENT}
      />
      <HlsModule
        layout={layout}
        running={state.device.pumpRunning}
        rpm={state.device.rpmSetpoint}
        animate={!reduceMotion}
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
        chatter={drainageChattering}
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

      <SceneLabels
        emphasisIds={emphasisSceneLabelIds}
        layout={layout}
        visible={labelsVisible}
        dimmed={orbiting}
      />

      {/* Floor + soft contact shadows */}
      <mesh position={[0, FLOOR_Y, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.6, 4.2]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.92} />
      </mesh>
      <gridHelper args={[5.5, 22, '#1f555d', '#102f35']} position={[0, FLOOR_Y + 0.008, 0]} />
      <ContactShadow position={[-1.35, FLOOR_Y + 0.012, -0.3]} radius={1.35} opacity={0.55} />
      <ContactShadow
        position={[layout.consoleOrigin.x, FLOOR_Y + 0.012, layout.consoleOrigin.z]}
        radius={0.65}
        opacity={0.5}
      />
      <ContactShadow
        position={[layout.hlsModulePosition.x, FLOOR_Y + 0.012, layout.hlsModulePosition.z]}
        radius={0.5}
        opacity={0.45}
      />
      <ContactShadow
        position={[BLENDER_PLACEMENT.x, FLOOR_Y + 0.012, BLENDER_PLACEMENT.z]}
        radius={0.3}
        opacity={0.4}
      />

      <OrbitControls
        ref={attachControls}
        makeDefault
        target={CAMERA_TARGET}
        minDistance={4.1}
        maxDistance={7.2}
        minPolarAngle={0.65}
        maxPolarAngle={1.38}
        onStart={() => {
          interacting.current = true
          setOrbiting(true)
        }}
        onEnd={() => {
          interacting.current = false
          setOrbiting(false)
        }}
      />
    </>
  )
}
