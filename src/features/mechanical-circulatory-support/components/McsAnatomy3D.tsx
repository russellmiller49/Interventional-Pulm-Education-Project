'use client'

import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
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
import styles from './mechanical-circulatory-support.module.css'

const IabpModel = lazy(() => import('./three/IabpModel'))
const ImpellaModel = lazy(() => import('./three/ImpellaModel'))
const LvadModel = lazy(() => import('./three/LvadModel'))

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
  resetKey,
}: {
  cameraPreset: CardiacCameraPreset
  resetKey: number
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const getThree = useThree((root) => root.get)

  useLayoutEffect(() => {
    const threeCamera = getThree().camera
    threeCamera.position.set(...cameraPreset.position)
    if (threeCamera instanceof THREE.PerspectiveCamera) {
      threeCamera.fov = cameraPreset.fov
      threeCamera.near = 0.1
      threeCamera.far = 50
      threeCamera.updateProjectionMatrix()
    }

    const controls = controlsRef.current
    if (controls) {
      controls.target.set(...cameraPreset.target)
      controls.minDistance = cameraPreset.minDistance
      controls.maxDistance = cameraPreset.maxDistance
      controls.update()
      controls.saveState()
    } else {
      threeCamera.lookAt(...cameraPreset.target)
    }
  }, [cameraPreset, getThree, resetKey])

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={cameraPreset.minDistance}
      maxDistance={cameraPreset.maxDistance}
      target={cameraPreset.target}
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
  const anatomy = MCS_DEVICE_ANATOMY[state.deviceKind]
  const sceneId = state.deviceKind === 'iabp' ? 'iabp' : 'heart'
  const camera = CARDIAC_RIG.cameras[sceneId]
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
  const flowLabel =
    state.deviceKind === 'iabp'
      ? 'Counterpulsation changes timing and impedance; net device flow is zero.'
      : impella
        ? `${state.metrics.leftDeviceFlowLMin.toFixed(1)} L/min left pump · ${state.metrics.rightDeviceFlowLMin.toFixed(1)} L/min RP. RP flow is not added directly to systemic output.`
        : `${state.metrics.deviceFlowLMin.toFixed(1)} L/min LV-to-aorta device flow.`

  return (
    <section className={styles.anatomyCard} aria-label="Animated mechanical-support anatomy">
      <header>
        <span className={styles.monitorLabel}>3D ANATOMY + MECHANISM</span>
        <strong>{impellaTitle}</strong>
      </header>
      <div className={styles.anatomyViewport}>
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
                      deviceEmphasis={state.device.kind === 'impella'}
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
              <ManagedOrbitControls cameraPreset={camera} resetKey={viewEpoch} />
            </Canvas>
          </CanvasErrorBoundary>
        )}
        <div className={styles.anatomyOrientation}>
          <span>
            {sceneId === 'iabp' ? 'Open anterior aorta' : 'Transparent anterior CT heart'}
          </span>
          <span>
            {sceneId === 'iabp' ? 'Subclavian-to-renal window' : 'Patient right is viewer left'}
          </span>
          <button
            type="button"
            aria-label="Reset 3D anatomy view"
            onClick={() => setViewEpoch((value) => value + 1)}
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
        <div className={styles.anatomyHud}>
          <strong>{state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min effective</strong>
          <span>{impellaLocation}</span>
          <span>{flowLabel}</span>
          {sceneId === 'heart' ? (
            <span>
              CT morphology: aortic cusps segmented; other valve locations are proxies—mitral
              chordal clearance cannot be assessed.
            </span>
          ) : null}
          {state.device.kind === 'impella' ? (
            <span>
              Path boundary: peripheral access is outside this CT. CP/5.5 use the CT aortic
              centerline and segmented aortic cusps; RP uses CT IVC, RA, RV, and PA centerlines with
              reviewed tricuspid/pulmonic route gates only.
            </span>
          ) : null}
        </div>
      </div>
      <div className={styles.anatomyTextEquivalent} role="status">
        <strong>Text equivalent</strong>
        <span>{impellaLocation}</span>
        <span>
          {revealCausality
            ? state.causalExplanation
            : 'Causal coaching is withheld during Assess; use the visible loading, flow, valve, waveform, and alarm signals.'}
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
          <span>
            Path provenance: imaged vessel segments are centerline-derived and peripheral access is
            an explicit authored boundary. Only the aortic cusps have segmented valve morphology;
            tricuspid and pulmonic points are route/orifice proxies.
          </span>
        ) : null}
      </div>
    </section>
  )
}
