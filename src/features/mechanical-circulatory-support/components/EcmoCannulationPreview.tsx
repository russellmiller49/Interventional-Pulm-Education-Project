'use client'

import { Suspense, useEffect, useState } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas, type RootState } from '@react-three/fiber'
import { RotateCcw } from 'lucide-react'
import * as THREE from 'three'

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
import { CARDIAC_RIG, ECMO_CANNULATION_ROUTES } from '@/features/cardiac-anatomy/content/paths'

import styles from './mechanical-circulatory-support.module.css'
import { FlowParticles } from './three/FlowParticles'

type CannulationMode = 'vv' | 'va'
type CannulaRole = 'drainage' | 'return'

const MODE_COPY = {
  vv: {
    tab: 'VV ECMO',
    title: 'Dual-site venovenous cannulation',
    summary:
      'Femoral venous drainage advances through the IVC to the IVC–right-atrial junction while jugular return advances through the SVC into the right atrium.',
    drainage: 'Femoral vein → IVC drainage near the IVC–right-atrial junction',
    return: 'Internal jugular vein → SVC → right atrial return',
  },
  va: {
    tab: 'Peripheral VA ECMO',
    title: 'Peripheral venoarterial cannulation',
    summary:
      'Venous drainage reaches a common long-cannula SVC–right-atrial target. The arterial line is schematic to the lower CT boundary; retrograde aortic flow is shown separately.',
    drainage: 'Femoral vein → IVC → SVC/RA target (cannula- and imaging-dependent)',
    return: 'Schematic femoral/iliac course → first imaged distal-aortic boundary',
  },
} as const satisfies Record<
  CannulationMode,
  { tab: string; title: string; summary: string; drainage: string; return: string }
>

const ROUTE_STYLE = {
  drainage: { color: '#6f9cff', radius: 0.092 },
  vvReturn: { color: '#6ee7e0', radius: 0.076 },
  vaReturn: { color: '#ff806f', radius: 0.045 },
} as const

function setupRenderer({ gl, scene }: RootState, onContextLost: () => void) {
  scene.background = new THREE.Color('#07171e')
  gl.domElement.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault()
      onContextLost()
    },
    { once: true },
  )
}

function CannulaTip({ color, role }: { color: string; role: CannulaRole }) {
  const radius = role === 'drainage' ? 0.105 : 0.088
  const length = role === 'drainage' ? 0.34 : 0.29

  return (
    <group>
      <mesh position={[0, -length / 2, 0]} castShadow renderOrder={31}>
        <cylinderGeometry args={[radius, radius * 0.9, length, 18]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.16}
          metalness={0.16}
          roughness={0.28}
        />
      </mesh>
      <mesh position={[0, 0.012, 0]} castShadow renderOrder={32}>
        <sphereGeometry args={[radius * 0.92, 18, 12]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          metalness={0.1}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, -length * 0.76, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={33}>
        <torusGeometry args={[radius * 1.03, 0.012, 8, 24]} />
        <meshStandardMaterial color="#f2f5f1" emissive="#f2f5f1" emissiveIntensity={0.08} />
      </mesh>
      {role === 'drainage' ? (
        <mesh position={[0, -length * 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={33}>
          <torusGeometry args={[radius * 1.03, 0.009, 8, 24]} />
          <meshStandardMaterial color="#172f3b" roughness={0.4} />
        </mesh>
      ) : null}
    </group>
  )
}

function SchematicArterialBoundary({ color }: { color: string }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={33}>
        <torusGeometry args={[0.11, 0.025, 10, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.28}
          roughness={0.32}
        />
      </mesh>
      <mesh position={[0, -0.13, 0]} renderOrder={33}>
        <coneGeometry args={[0.075, 0.2, 18]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.22}
          roughness={0.32}
        />
      </mesh>
    </group>
  )
}

function CannulationScene({
  mode,
  replayKey,
  reducedMotion,
}: {
  mode: CannulationMode
  replayKey: number
  reducedMotion: boolean
}) {
  const drainageRoute =
    mode === 'vv'
      ? ECMO_CANNULATION_ROUTES.vv.femoralVenousDrainage.points
      : ECMO_CANNULATION_ROUTES.va.femoralVenousDrainage.points
  const returnRoute =
    mode === 'vv'
      ? ECMO_CANNULATION_ROUTES.vv.jugularVenousReturn.points
      : ECMO_CANNULATION_ROUTES.va.femoralArterialReturn.points
  const returnStyle = mode === 'vv' ? ROUTE_STYLE.vvReturn : ROUTE_STYLE.vaReturn
  const drainageProgress = useTrajectoryPlayback({
    targetProgress: 1,
    replayKey,
    durationSeconds: 5.4,
    reducedMotion,
  })
  const returnProgress = useTrajectoryPlayback({
    targetProgress: 1,
    replayKey,
    durationSeconds: mode === 'vv' ? 6.2 : 4.8,
    reducedMotion,
  })

  return (
    <>
      <CardiacHeartModel heartRateBpm={72} reducedMotion={reducedMotion} />
      <ProgressiveSplineTube
        points={drainageRoute}
        progress={drainageProgress}
        radius={ROUTE_STYLE.drainage.radius}
        color={ROUTE_STYLE.drainage.color}
        emissiveIntensity={0.12}
        radialSegments={12}
      />
      <SplineFollower
        points={drainageRoute}
        progress={drainageProgress}
        reducedMotion={reducedMotion}
      >
        <CannulaTip color={ROUTE_STYLE.drainage.color} role="drainage" />
      </SplineFollower>
      <ProgressiveSplineTube
        points={returnRoute}
        progress={returnProgress}
        radius={returnStyle.radius}
        color={returnStyle.color}
        emissiveIntensity={0.14}
        opacity={mode === 'va' ? 0.72 : 1}
        radialSegments={12}
      />
      <SplineFollower points={returnRoute} progress={returnProgress} reducedMotion={reducedMotion}>
        {mode === 'vv' ? (
          <CannulaTip color={returnStyle.color} role="return" />
        ) : (
          <SchematicArterialBoundary color={returnStyle.color} />
        )}
      </SplineFollower>
      {mode === 'va' ? (
        <FlowParticles
          points={ECMO_CANNULATION_ROUTES.va.retrogradeAorticFlow.points}
          flow={4.5}
          color="#ff8b78"
          paused={reducedMotion}
          revealProgress={returnProgress}
          revealAt={0.98}
        />
      ) : null}
    </>
  )
}

export function EcmoCannulationPreview() {
  const webglReady = useWebGLSupport()
  const reducedMotion = useReducedMotionPreference()
  const [mode, setMode] = useState<CannulationMode>('vv')
  const [replayKey, setReplayKey] = useState(0)
  const [viewEpoch, setViewEpoch] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const [announcement, setAnnouncement] = useState(
    'VV ECMO selected. Femoral drainage and jugular return advancement are shown.',
  )
  const camera = CARDIAC_RIG.cameras.heart
  const copy = MODE_COPY[mode]

  useEffect(() => {
    const longestRouteSeconds = mode === 'vv' ? 6.2 : 5.4
    const completionTimer = window.setTimeout(
      () =>
        setAnnouncement(
          reducedMotion
            ? `${copy.tab} selected. Final cannula positions are shown.`
            : `${copy.tab} cannula advancement complete.`,
        ),
      reducedMotion ? 0 : (longestRouteSeconds + 0.15) * 1_000,
    )

    return () => window.clearTimeout(completionTimer)
  }, [copy.tab, mode, reducedMotion, replayKey])

  const chooseMode = (nextMode: CannulationMode) => {
    setMode(nextMode)
    setReplayKey((value) => value + 1)
    setAnnouncement(
      reducedMotion
        ? `${MODE_COPY[nextMode].tab} selected. Final cannula positions are shown because reduced motion is enabled.`
        : `${MODE_COPY[nextMode].tab} selected. Cannula advancement is replaying.`,
    )
  }

  const replay = () => {
    setReplayKey((value) => value + 1)
    setAnnouncement(
      reducedMotion
        ? `${copy.tab} final cannula positions remain visible because reduced motion is enabled.`
        : `Replaying ${copy.tab} cannula advancement.`,
    )
  }

  return (
    <section
      className={styles.ecmoCannulationPreview}
      aria-labelledby="ecmo-cannulation-preview-heading"
    >
      <div className={styles.sectionHeading}>
        <span className={styles.kicker}>CT-ALIGNED CANNULATION PREVIEW</span>
        <h2 id="ecmo-cannulation-preview-heading">Follow each ECMO route through the CT field</h2>
        <p>
          Compare dual-site VV and peripheral VA configurations on the same cardiac coordinate
          frame. The animation teaches route relationships, not access technique or insertion depth.
        </p>
      </div>

      <div className={styles.ecmoCannulationGrid}>
        <div className={styles.ecmoCannulationControls}>
          <div
            className={styles.ecmoCannulationTabs}
            role="group"
            aria-label="Choose ECMO cannulation configuration"
          >
            {(Object.keys(MODE_COPY) as CannulationMode[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={mode === candidate}
                onClick={() => chooseMode(candidate)}
              >
                {MODE_COPY[candidate].tab}
              </button>
            ))}
          </div>

          <div className={styles.ecmoCannulationExplanation}>
            <span>SELECTED CONFIGURATION</span>
            <h3>{copy.title}</h3>
            <p>{copy.summary}</p>
            <dl>
              <div>
                <dt>Drainage cannula</dt>
                <dd>{copy.drainage}</dd>
              </div>
              <div>
                <dt>Return cannula</dt>
                <dd>{copy.return}</dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            className={styles.ecmoCannulationReplay}
            onClick={replay}
            aria-label={`Replay ${copy.tab} cannula advancement`}
          >
            <RotateCcw aria-hidden="true" /> Replay cannula advancement
          </button>
          {reducedMotion ? (
            <p className={styles.ecmoCannulationMotionNote} role="note">
              Reduced motion is enabled; the final cannula positions are shown without travel
              animation.
            </p>
          ) : null}
        </div>

        <div className={styles.ecmoCannulationViewport}>
          {!webglReady || contextLost ? (
            <div className={styles.ecmoCannulationFallback} role="status">
              <strong>
                {contextLost ? 'The 3D context was interrupted.' : 'The 3D preview is unavailable.'}
              </strong>
              <span>{copy.summary}</span>
              {contextLost ? (
                <button
                  type="button"
                  onClick={() => {
                    setContextLost(false)
                    setViewEpoch((value) => value + 1)
                  }}
                >
                  Reload 3D preview
                </button>
              ) : null}
            </div>
          ) : (
            <CanvasErrorBoundary
              fallback={
                <div className={styles.ecmoCannulationFallback} role="status">
                  <strong>The explanatory 3D view could not load.</strong>
                  <span>{copy.summary}</span>
                </div>
              }
            >
              <Canvas
                key={viewEpoch}
                aria-hidden="true"
                dpr={[1, 1.5]}
                shadows
                camera={{ position: camera.position, fov: camera.fov, near: 0.1, far: 50 }}
                gl={{ antialias: true, powerPreference: 'high-performance' }}
                onCreated={(root) => setupRenderer(root, () => setContextLost(true))}
              >
                <ambientLight intensity={1.3} />
                <directionalLight position={[4, 6, 6]} intensity={2.4} castShadow />
                <directionalLight position={[-4, 1, 3]} intensity={0.8} color="#8ddbd5" />
                <pointLight position={[0, -1, 4]} intensity={0.75} color="#ffd8cf" />
                <Suspense fallback={null}>
                  <CannulationScene
                    mode={mode}
                    replayKey={replayKey}
                    reducedMotion={reducedMotion}
                  />
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
          <div className={styles.ecmoCannulationOrientation} aria-hidden="true">
            <span>Anterior CT heart</span>
            <span>Patient right is viewer left</span>
          </div>
        </div>
      </div>

      <div className={styles.ecmoCannulationLegend} aria-label="Cannula role legend">
        <span>
          <i data-route="drainage" aria-hidden="true" /> Larger drainage cannula
        </span>
        <span>
          <i data-route={mode === 'vv' ? 'vv-return' : 'va-return'} aria-hidden="true" />{' '}
          {mode === 'vv' ? 'Smaller venous return cannula' : 'Schematic arterial return boundary'}
        </span>
        {mode === 'va' ? (
          <span>
            <i data-route="va-flow" aria-hidden="true" /> Retrograde aortic return flow
          </span>
        ) : null}
      </div>

      <aside className={styles.ecmoCannulationCoverageNote} role="note">
        <strong>CT coverage boundary</strong>
        <span>
          The source CT provides central SVC, IVC, right-heart, and aortic anatomy. Iliac and
          femoral vessels—and the peripheral access portions of these routes—are outside the CT
          field. The VA arterial approach below the CT boundary is explicitly schematic, and the
          jugular route begins at the imaged SVC rather than at a skin access site. Its right-atrial
          return endpoint is an authored continuation from the SVC/RA centerlines. The segmented
          aortic cusps are shown; mitral, tricuspid, and pulmonic data mark orifice locations only,
          not leaflet morphology.
        </span>
      </aside>

      <p className={styles.ecmoCannulationTextEquivalent} role="status" aria-live="polite">
        <strong>Text equivalent:</strong> {announcement} {copy.summary} This educational rendering
        does not provide cannula size, insertion depth, access-site, or patient-specific placement
        guidance.
      </p>
    </section>
  )
}
