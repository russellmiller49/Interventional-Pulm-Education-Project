'use client'

import {
  lazy,
  Suspense,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas, type RootState, useThree } from '@react-three/fiber'
import { RotateCcw } from 'lucide-react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { CardiacHeartModel } from '@/features/cardiac-anatomy/components/CardiacHeartModel'
import { IabpAortaModel } from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import {
  useReducedMotionPreference,
  useWebGLSupport,
} from '@/features/cardiac-anatomy/components/useCardiac3DSupport'
import {
  CARDIAC_RIG,
  MCS_DEVICE_ANATOMY,
  type CardiacCameraPreset,
} from '@/features/cardiac-anatomy/content/paths'

import type { McsSimulationState } from '../engine'
import {
  fitCardiacCameraToViewport,
  MCS_HEART_CAMERA_FIT,
  MCS_LVAD_CAMERA_FIT,
  MCS_LVAD_CAMERA_Y_SHIFT,
  type CameraFitExtent,
} from './cardiacCameraFit'
import styles from './mechanical-circulatory-support.module.css'

const IabpModel = lazy(() => import('./three/IabpModel'))
const ImpellaModel = lazy(() => import('./three/ImpellaModel'))
const LvadModel = lazy(() => import('./three/LvadModel'))

const ORBIT_MOUSE_BUTTONS = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE,
} as const

const ORBIT_TOUCHES = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_ROTATE,
} as const

function setupRenderer({ gl, scene }: RootState, onLost: () => void) {
  scene.background = new THREE.Color('#07171e')
  gl.domElement.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault()
      onLost()
    },
    { once: true },
  )
}

function ManagedOrbitControls({
  cameraPreset,
  fitExtent,
  resetKey,
  onCameraChange,
  onInteractionEnd,
  onInteractionStart,
}: {
  cameraPreset: CardiacCameraPreset
  fitExtent?: CameraFitExtent
  resetKey: number
  onCameraChange: (position: readonly number[]) => void
  onInteractionEnd: () => void
  onInteractionStart: () => void
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const getThree = useThree((root) => root.get)
  const rendererElement = useThree((root) => root.gl.domElement)
  const viewportWidth = useThree((root) => root.size.width)
  const viewportHeight = useThree((root) => root.size.height)
  const fittedCameraPreset = useMemo(
    () =>
      fitExtent
        ? fitCardiacCameraToViewport(
            cameraPreset,
            { width: viewportWidth, height: viewportHeight },
            fitExtent,
          )
        : cameraPreset,
    [cameraPreset, fitExtent, viewportHeight, viewportWidth],
  )

  useLayoutEffect(() => {
    const threeCamera = getThree().camera
    threeCamera.position.set(...fittedCameraPreset.position)
    if (threeCamera instanceof THREE.PerspectiveCamera) {
      threeCamera.fov = fittedCameraPreset.fov
      threeCamera.near = 0.1
      threeCamera.far = 50
      threeCamera.updateProjectionMatrix()
    }

    const controls = controlsRef.current
    if (controls) {
      controls.target.set(...fittedCameraPreset.target)
      controls.minDistance = fittedCameraPreset.minDistance
      controls.maxDistance = fittedCameraPreset.maxDistance
      controls.update()
      controls.saveState()
    } else {
      threeCamera.lookAt(...fittedCameraPreset.target)
    }
    onCameraChange(threeCamera.position.toArray())
  }, [fittedCameraPreset, getThree, onCameraChange, resetKey])

  return (
    <OrbitControls
      ref={controlsRef}
      domElement={rendererElement}
      enableDamping
      enablePan={false}
      enableRotate
      enableZoom
      dampingFactor={0.08}
      minDistance={fittedCameraPreset.minDistance}
      maxDistance={fittedCameraPreset.maxDistance}
      mouseButtons={ORBIT_MOUSE_BUTTONS}
      rotateSpeed={0.85}
      target={fittedCameraPreset.target}
      touches={ORBIT_TOUCHES}
      zoomSpeed={0.8}
      onChange={() => onCameraChange(getThree().camera.position.toArray())}
      onEnd={onInteractionEnd}
      onStart={onInteractionStart}
    />
  )
}

export function McsAnatomy3D({
  state,
  revealCausality = true,
}: {
  state: McsSimulationState
  revealCausality?: boolean
}) {
  const webglReady = useWebGLSupport()
  const reducedMotion = useReducedMotionPreference()
  const [contextLost, setContextLost] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [viewEpoch, setViewEpoch] = useState(0)
  const [placementReplayKey, setPlacementReplayKey] = useState(0)
  const [isOrbiting, setIsOrbiting] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const interactionHintId = useId()
  const anatomy = MCS_DEVICE_ANATOMY[state.deviceKind]
  const sceneId = state.deviceKind === 'iabp' ? 'iabp' : 'heart'
  const camera = useMemo<CardiacCameraPreset>(() => {
    const preset = CARDIAC_RIG.cameras[sceneId]
    if (state.deviceKind !== 'lvad') return preset
    return {
      ...preset,
      position: [
        preset.position[0],
        preset.position[1] + MCS_LVAD_CAMERA_Y_SHIFT,
        preset.position[2],
      ],
      target: [preset.target[0], preset.target[1] + MCS_LVAD_CAMERA_Y_SHIFT, preset.target[2]],
    }
  }, [sceneId, state.deviceKind])
  const cameraFitExtent =
    state.deviceKind === 'lvad'
      ? MCS_LVAD_CAMERA_FIT
      : sceneId === 'heart'
        ? MCS_HEART_CAMERA_FIT
        : undefined
  const impella = state.device.kind === 'impella' ? state.device : null
  const impellaTitle = impella
    ? impella.left.enabled && impella.right.enabled
      ? `${impella.left.variant === '55' ? 'Impella 5.5' : 'Impella CP'} + RP biventricular support`
      : impella.left.enabled
        ? `${impella.left.variant === '55' ? 'Impella 5.5' : 'Impella CP'} LV-to-aorta support`
        : impella.right.enabled
          ? 'Impella RP caval-to-pulmonary support'
          : 'Impella support off'
    : anatomy.title
  const impellaLocation = impella
    ? [
        impella.left.enabled
          ? `${impella.left.variant === '55' ? '5.5' : 'CP'} inlet in the LV with outlet in the ascending aorta.`
          : null,
        impella.right.enabled
          ? 'RP inlet in the IVC with outlet in the pulmonary artery; tricuspid and pulmonic crossings use route gates, not segmented leaflet morphology.'
          : null,
      ]
        .filter(Boolean)
        .join(' ')
    : anatomy.location
  const placementSummary =
    state.deviceKind === 'iabp'
      ? 'IABP · descending thoracic aorta'
      : impella
        ? impella.left.enabled && impella.right.enabled
          ? `${impella.left.variant === '55' ? '5.5' : 'CP'} + RP · LV→aorta and IVC→PA`
          : impella.left.enabled
            ? `${impella.left.variant === '55' ? '5.5' : 'CP'} · LV inlet → ascending aorta`
            : impella.right.enabled
              ? 'RP · IVC inlet → pulmonary artery'
              : 'Impella support off'
        : 'LVAD · apical inflow → ascending-aortic outflow'
  const publishCameraPosition = useCallback((position: readonly number[]) => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.dataset.cameraPosition = position.map((coordinate) => coordinate.toFixed(4)).join(',')
  }, [])
  const handleOrbitStart = useCallback(() => setIsOrbiting(true), [])
  const handleOrbitEnd = useCallback(() => {
    setIsOrbiting(false)
    setHasInteracted(true)
  }, [])

  return (
    <section className={styles.anatomyCard} aria-label="Animated mechanical-support anatomy">
      <header>
        <span className={styles.monitorLabel}>3D ANATOMY + MECHANISM</span>
        <strong>{impellaTitle}</strong>
      </header>
      <div className={styles.anatomyToolbar}>
        <div className={styles.anatomyOrientation}>
          <span>
            {sceneId === 'iabp' ? 'Open anterior aorta' : 'Transparent anterior CT heart'}
          </span>
          <span>
            {sceneId === 'iabp' ? 'Subclavian-to-renal window' : 'Patient right is viewer left'}
          </span>
        </div>
        <div className={styles.anatomyToolRow}>
          <span id={interactionHintId} className={styles.anatomyInteractionHint}>
            {isOrbiting
              ? 'Rotating view…'
              : hasInteracted
                ? 'View rotated · drag again or reset'
                : 'Drag to rotate · scroll or pinch to zoom'}
          </span>
          <div className={styles.anatomyActions}>
            <button
              type="button"
              aria-label="Reset 3D anatomy view"
              onClick={() => {
                setHasInteracted(false)
                setViewEpoch((value) => value + 1)
              }}
            >
              <RotateCcw aria-hidden="true" /> Reset view
            </button>
            {state.device.kind === 'impella' &&
            (state.device.left.enabled || state.device.right.enabled) ? (
              <button
                type="button"
                aria-label="Replay active Impella advancement trajectories"
                onClick={() => setPlacementReplayKey((value) => value + 1)}
              >
                Replay placement
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={styles.anatomyViewport}
        role="group"
        aria-label="Interactive 3D mechanical-support anatomy"
        aria-describedby={interactionHintId}
        data-testid="mcs-anatomy-viewport"
        data-orbit-interacted={hasInteracted}
        data-orbiting={isOrbiting}
      >
        {!webglReady || contextLost ? (
          <div className={styles.webglFallback}>
            <strong>
              {contextLost ? 'The 3D context was interrupted.' : 'WebGL is unavailable.'}
            </strong>
            <span>
              The numerical monitor, controls, and causal explanation remain fully functional.
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
              <div className={styles.webglFallback}>
                The explanatory 3D view could not load. Use the synchronized monitor and text
                interpretation.
              </div>
            }
          >
            <Canvas
              key={epoch}
              dpr={[1, 1.55]}
              shadows
              camera={{ position: camera.position, fov: camera.fov, near: 0.1, far: 50 }}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
              onCreated={(root) => setupRenderer(root, () => setContextLost(true))}
            >
              <ambientLight intensity={1.25} />
              <directionalLight position={[4, 6, 6]} intensity={2.35} castShadow />
              <directionalLight position={[-4, 1, 3]} intensity={0.75} color="#8ddbd5" />
              <pointLight position={[0, -1, 4]} intensity={0.75} color="#ffd8cf" />
              <Suspense fallback={null}>
                {state.deviceKind === 'iabp' ? (
                  <>
                    <IabpAortaModel />
                    <IabpModel state={state} reducedMotion={reducedMotion} />
                  </>
                ) : (
                  <>
                    <CardiacHeartModel
                      heartRateBpm={state.patient.heartRateBpm}
                      aorticValveOpening={state.metrics.aorticValveOpening}
                      deviceEmphasis={state.device.kind === 'lvad' ? 'lvad' : true}
                      reducedMotion={reducedMotion}
                    />
                    {state.device.kind === 'impella' ? (
                      <>
                        {state.device.left.enabled ? (
                          <ImpellaModel
                            side="left"
                            state={state}
                            reducedMotion={reducedMotion}
                            replayKey={placementReplayKey}
                          />
                        ) : null}
                        {state.device.right.enabled ? (
                          <ImpellaModel
                            side="right"
                            state={state}
                            reducedMotion={reducedMotion}
                            replayKey={placementReplayKey}
                          />
                        ) : null}
                      </>
                    ) : (
                      <LvadModel state={state} reducedMotion={reducedMotion} />
                    )}
                  </>
                )}
              </Suspense>
              <ManagedOrbitControls
                cameraPreset={camera}
                fitExtent={cameraFitExtent}
                resetKey={viewEpoch}
                onCameraChange={publishCameraPosition}
                onInteractionEnd={handleOrbitEnd}
                onInteractionStart={handleOrbitStart}
              />
            </Canvas>
          </CanvasErrorBoundary>
        )}
        <div className={styles.anatomyFlowChip}>
          <strong>{state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min effective</strong>
          <span>{placementSummary}</span>
        </div>
      </div>
      <div className={styles.anatomyTextEquivalent} role="status">
        <strong>Text equivalent</strong>
        <span>{impellaLocation}</span>
        <span>
          {revealCausality
            ? state.causalExplanation
            : 'Use the visible loading, flow, valve, waveform, and alarm signals to build the causal chain.'}
        </span>
        <span>
          LVEDV {state.metrics.lvedvMl} mL · aortic valve{' '}
          {state.metrics.aorticValveOpening ? 'opening' : 'not opening'} · recirculation{' '}
          {state.metrics.recirculatingFlowLMin.toFixed(1)} L/min.
        </span>
        <span>
          The transparent anatomy and illustrative device facsimiles are educational. They are not
          implantation, catheter-depth, sizing, or positioning guidance.
        </span>
        {sceneId === 'heart' ? (
          <span>
            CT morphology: aortic cusps are segmented; the other valve locations are proxies, so
            mitral chordal clearance cannot be assessed.
          </span>
        ) : null}
        {state.device.kind === 'impella' ? (
          <>
            <span>
              When a pump is running, red particles converge into its inlet, travel through the
              cannula, and accelerate outward from its outlet.
            </span>
            <span>
              Path provenance: imaged vessel segments are centerline-derived and peripheral access
              is an explicit authored boundary. Only the aortic cusps have segmented valve
              morphology; tricuspid and pulmonic points are route/orifice proxies.
            </span>
          </>
        ) : null}
      </div>
    </section>
  )
}
