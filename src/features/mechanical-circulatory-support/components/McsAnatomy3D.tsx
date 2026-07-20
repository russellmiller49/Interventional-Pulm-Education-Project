'use client'

import { lazy, Suspense, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas, type RootState } from '@react-three/fiber'
import { RotateCcw } from 'lucide-react'
import * as THREE from 'three'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { CardiacHeartModel } from '@/features/cardiac-anatomy/components/CardiacHeartModel'
import {
  HeartGreatVesselsModel,
  IabpAortaModel,
} from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import {
  useReducedMotionPreference,
  useWebGLSupport,
} from '@/features/cardiac-anatomy/components/useCardiac3DSupport'
import { CARDIAC_RIG, MCS_DEVICE_ANATOMY } from '@/features/cardiac-anatomy/content/paths'

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
  const anatomy = MCS_DEVICE_ANATOMY[state.deviceKind]
  const sceneId = state.deviceKind === 'iabp' ? 'iabp' : 'heart'
  const camera = CARDIAC_RIG.cameras[sceneId]
  const flowLabel =
    state.deviceKind === 'iabp'
      ? 'Counterpulsation changes timing and impedance; net device flow is zero.'
      : `${state.metrics.deviceFlowLMin.toFixed(1)} L/min LV-to-aorta device flow.`

  return (
    <section className={styles.anatomyCard} aria-label="Animated mechanical-support anatomy">
      <header>
        <span className={styles.monitorLabel}>3D ANATOMY + MECHANISM</span>
        <strong>{anatomy.title}</strong>
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
              key={`${epoch}-${viewEpoch}-${sceneId}`}
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
                      reducedMotion={reducedMotion}
                    />
                    <HeartGreatVesselsModel />
                    {state.deviceKind === 'impella' ? (
                      <ImpellaModel state={state} reducedMotion={reducedMotion} />
                    ) : (
                      <LvadModel state={state} reducedMotion={reducedMotion} />
                    )}
                  </>
                )}
              </Suspense>
              <OrbitControls
                enablePan={false}
                minDistance={camera.minDistance}
                maxDistance={camera.maxDistance}
                target={camera.target}
              />
            </Canvas>
          </CanvasErrorBoundary>
        )}
        <div className={styles.anatomyOrientation}>
          <span>{sceneId === 'iabp' ? 'Open anterior aorta' : 'Anterior heart cutaway'}</span>
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
        </div>
        <div className={styles.anatomyHud}>
          <strong>{state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min effective</strong>
          <span>{anatomy.location}</span>
          <span>{flowLabel}</span>
        </div>
      </div>
      <div className={styles.anatomyTextEquivalent} role="status">
        <strong>Text equivalent</strong>
        <span>{anatomy.location}</span>
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
          The cutaway anatomy and clinically scaled device facsimiles are educational. They are not
          implantation, catheter-depth, sizing, or positioning guidance.
        </span>
      </div>
    </section>
  )
}
