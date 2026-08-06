'use client'

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useGLTF, useProgress } from '@react-three/drei'
import { Canvas, type RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three-stdlib'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'

import type { EcmoSimulationState, GuidedControlId, SimulationAction } from '../engine'
import {
  CAMERA_FOV,
  CAMERA_POSITION,
  CLAMP_ASSET,
  CONSOLE_ASSET,
  OXYGENATOR_ASSET,
  PATIENT_ASSET,
  SENSOR_ASSET,
} from './ecmo-circuit/constants'
import { BedsideScene } from './ecmo-circuit/BedsideScene'
import { WebGLContextGuard } from './ecmo-circuit/WebGLContextGuard'
import styles from './cardiohelp-ecmo.module.css'

useGLTF.preload(PATIENT_ASSET)
useGLTF.preload(CONSOLE_ASSET)
useGLTF.preload(OXYGENATOR_ASSET)
useGLTF.preload(CLAMP_ASSET)
useGLTF.preload(SENSOR_ASSET)

interface EcmoCircuit3DProps {
  state: EcmoSimulationState
  dispatch: (action: SimulationAction) => void
  controlsEnabled: boolean
  guidedControlId?: GuidedControlId | null
}

// three-stdlib ships RoomEnvironment untyped as a constructor in this version.
const RoomEnvironmentScene = RoomEnvironment as unknown as new () => THREE.Scene

/** One-time PMREM room environment: zero network payload, gives the PVC
 * clearcoat its speculars. Deliberate, called-out deviation from the repo's
 * manual-rig-only house style. Runs in onCreated (once per canvas mount);
 * the generated texture's GPU lifetime ends with the canvas context. */
function applyRoomEnvironment({ gl, scene }: RootState) {
  const pmrem = new THREE.PMREMGenerator(gl)
  scene.environment = pmrem.fromScene(new RoomEnvironmentScene()).texture
  scene.environmentIntensity = 0.35
  pmrem.dispose()
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

function createMediaQueryStore(query: string, serverValue: boolean) {
  const matches = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  const subscribe = (onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
    const mediaQuery = window.matchMedia(query)
    mediaQuery.addEventListener?.('change', onChange)
    return () => mediaQuery.removeEventListener?.('change', onChange)
  }
  return { matches, subscribe, serverValue }
}

const reducedMotionStore = createMediaQueryStore('(prefers-reduced-motion: reduce)', true)
const compactViewportStore = createMediaQueryStore('(max-width: 768px)', false)

function ClampControl({
  limb,
  closed,
  disabled,
  guidedHelp,
  onToggle,
}: {
  limb: 'Drainage' | 'Return'
  closed: boolean
  disabled: boolean
  guidedHelp: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      id={limb === 'Drainage' ? 'cardiohelp-clamp-drainage' : 'cardiohelp-clamp-return'}
      className={styles.clampControl}
      data-closed={closed}
      data-guided-help={guidedHelp}
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

export function EcmoCircuit3D({
  state,
  dispatch,
  controlsEnabled,
  guidedControlId = null,
}: EcmoCircuit3DProps) {
  const webglReady = useSyncExternalStore(subscribeNever, detectWebGL, () => false)
  const reduceMotion = useSyncExternalStore(
    reducedMotionStore.subscribe,
    reducedMotionStore.matches,
    () => reducedMotionStore.serverValue,
  )
  const compactViewport = useSyncExternalStore(
    compactViewportStore.subscribe,
    compactViewportStore.matches,
    () => compactViewportStore.serverValue,
  )
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportVisible, setViewportVisible] = useState(true)
  const [contextLost, setContextLost] = useState(false)
  const [canvasEpoch, setCanvasEpoch] = useState(0)
  const [labelsOn, setLabelsOn] = useState(true)
  const { active: assetsLoading, progress: assetProgress } = useProgress()
  const closedClampCount =
    Number(state.circuit.drainageClampClosed) + Number(state.circuit.returnClampClosed)
  const clampControlsEnabled = controlsEnabled && state.scenario.prediction.committed
  const flowState =
    closedClampCount > 0 ? 'ISOLATED' : state.device.pumpRunning ? 'FLOWING' : 'PUMP STOPPED'
  const isVa = state.supportMode === 'va'
  const drainageChattering = state.device.pumpRunning && state.circuit.drainageChatter

  useEffect(() => {
    const node = viewportRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      setViewportVisible(entries.some((entry) => entry.isIntersecting))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [webglReady])

  return (
    <div className={styles.circuit3dShell}>
      <div ref={viewportRef} className={styles.circuit3dViewport} aria-hidden="true">
        {webglReady && contextLost ? (
          <div className={styles.circuit3dFallback}>
            The 3D view paused after a graphics interruption. The clamp controls below remain fully
            functional.
            <button
              type="button"
              className={styles.circuit3dReload}
              onClick={() => {
                setContextLost(false)
                setCanvasEpoch((epoch) => epoch + 1)
              }}
            >
              Reload 3D view
            </button>
          </div>
        ) : webglReady ? (
          <CanvasErrorBoundary
            fallback={
              <div className={styles.circuit3dFallback}>
                The bedside 3D view could not load. The diagnostic circuit map and clamp controls
                remain available.
              </div>
            }
          >
            <Canvas
              key={canvasEpoch}
              shadows
              dpr={[1, 1.7]}
              frameloop={viewportVisible ? 'always' : 'never'}
              camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV, near: 0.05, far: 50 }}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
              onCreated={applyRoomEnvironment}
            >
              <WebGLContextGuard onContextLost={() => setContextLost(true)} />
              <Suspense fallback={null}>
                <BedsideScene
                  state={state}
                  dispatch={dispatch}
                  controlsEnabled={clampControlsEnabled}
                  reduceMotion={reduceMotion}
                  labelsVisible={!compactViewport && labelsOn}
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
        {webglReady && !contextLost && assetsLoading ? (
          <div className={styles.circuit3dLoading} role="presentation">
            Loading bedside models… {Math.round(assetProgress)}%
          </div>
        ) : null}
        <div className={styles.circuit3dHud}>
          <span data-state={flowState}>{flowState}</span>
          <span data-mode={state.supportMode}>{state.supportMode.toUpperCase()}</span>
          {drainageChattering ? <span data-state="CHATTER">DRAINAGE CHATTER</span> : null}
          <strong>{state.circuit.bloodFlow.toFixed(2)} L/min</strong>
          <small>Drag to orbit · scroll to zoom · select a clamp or use the controls below</small>
        </div>
        {compactViewport ? (
          <div className={styles.circuit3dLabels} aria-hidden="true">
            <span>
              {isVa ? 'Femoral V-A cannulation + distal perfusion' : 'Femoral V-V cannulation'}
            </span>
            <span>HLS module · pump + oxygenator</span>
            <span>Flow / bubble sensor</span>
            <span>Near-patient clamps</span>
          </div>
        ) : null}
      </div>
      {/*
        Outside the viewport on purpose. Everything inside that div is `aria-hidden`, including the
        HUD chip that names the chatter, so without this line a screen-reader user would have no way
        to know the limb is juddering — and neither would anyone whose browser cannot run WebGL.
      */}
      {drainageChattering ? (
        <p className={styles.circuit3dSceneStatus} role="status" data-alert="true">
          <strong>Drainage chatter.</strong> The drainage limb is repeatedly being drawn shut and
          springing open: it judders in the bedside view and is marked on the pressure-zone map.
          Displayed pVen and flow are unchanged by this cue.
        </p>
      ) : null}
      {webglReady && !contextLost && !compactViewport ? (
        <button
          type="button"
          className={styles.circuit3dLabelsToggle}
          aria-pressed={labelsOn}
          onClick={() => setLabelsOn((current) => !current)}
        >
          {labelsOn ? 'Hide labels' : 'Show labels'}
        </button>
      ) : null}

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
            guidedHelp={guidedControlId === 'cardiohelp-clamp-drainage'}
            onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage' })}
          />
          <ClampControl
            limb="Return"
            closed={state.circuit.returnClampClosed}
            disabled={!clampControlsEnabled}
            guidedHelp={guidedControlId === 'cardiohelp-clamp-return'}
            onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return' })}
          />
          {/*
            Resumption after an air event, as one bounded act.
            Deliberately not the console reset and deliberately not a clamp: this module does not
            teach where clamp opening, pump restart and console reset fall relative to one another,
            because that choreography is device- and program-specific. The button says what it
            stands for, and the helper text says it is a simulation abstraction.
          */}
          <button
            type="button"
            id="cardiohelp-resume-support"
            className={styles.clampControl}
            data-guided-help={guidedControlId === 'cardiohelp-resume-support'}
            disabled={!clampControlsEnabled || !state.circuit.bubbleResetRequired}
            onClick={() => dispatch({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' })}
          >
            <span aria-hidden="true" className={styles.clampControlIcon}>
              ▶
            </span>
            <span>
              <strong>Resume support per current IFU and approved local protocol</strong>
              <small>
                A bounded simulation abstraction. It stands in for the device- and program-specific
                resumption sequence and does not reproduce or teach that sequence.
              </small>
            </span>
          </button>
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
