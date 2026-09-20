'use client'
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Anatomy } from './Anatomy'
import { Room, ROOM_BACKGROUND, roomBounds } from './Room'
import { ParametricCarm, BeamCone } from './ParametricCarm'
import { DetectorImage } from './DetectorImage'
import { Monitor } from './Monitor'
import type { DrrTextureSource } from './drrTextureSource'
import { CameraRig, type CameraCommand } from './CameraRig'
import { SceneLabels } from './SceneLabels'
import { ChainPins } from './ChainPins'
import { ChainAnswerFieldset } from './ChainAnswerFieldset'
import { WebGLContextGuard } from './WebGLContextGuard'
import { LabDock, LabGoals } from './LabDock'
import { ConeBeamView, ConeBeamPanels, useCbctAcquisition } from './views/ConeBeamView'
import {
  TomosynthesisView,
  TomosynthesisMonitor,
  TomosynthesisPanels,
  useTomosynthesis,
} from './views/TomosynthesisView'
import { dtsArc } from './dtsModel'
import { SamplingView, SamplingPanels } from './views/SamplingView'
import { RegistrationView, RegistrationOverlay, RegistrationPanels } from './views/RegistrationView'
import { registration } from './registrationModel'
import { StaffView, StaffPanels } from './views/StaffView'
import { staff } from './staffModel'
import { DoseView, DosePanels } from './views/DoseView'
import { dosePlanes } from './doseModel'
import { TimeView, TimeOverlay, TimeSamples } from './views/TimeView'
import { useSuitePlayback, SuiteClock } from './useSuitePlayback'
import { ProjectionOverlays } from './ProjectionOverlays'
import { FieldView, FieldMask, FieldContextOverlay } from './views/FieldView'
import { ProjectionView3D, projectionObjectLabels } from './views/ProjectionView3D'
import { RayTrace, SignalReadout } from './views/SignalView'
import { loadAnatomyVolume } from '../../lib/anatomy'
import { rayProfile } from '../../lib/rayProfile'
import { labControl, labNumber } from '../../engine/labMetrics'
import { LESION_CENTER, clamp, type Point3 } from '../../lib/physics'
import { resolveSuiteInputs } from './suiteViewSpec'
import { rayThrough, suiteFrame, temporal, cbctOrbitSamples, roomMonitorOffset } from './suiteModel'
import { SuiteFallback } from './SuiteFallback'
import type { ImagingSuitePaneProps, SuiteCamera } from './types'
import styles from './suite-scene.module.css'

/**
 * What each camera preset is for. Report 2.5 (fellow walkthrough, PDF p.18/p.25): the buttons
 * answered a click without saying what the view was meant to show, and two of them — the view from
 * above, where the detector covers the chest at 0°, and the beam's eye — read as broken. Every
 * preset is kept; each now says what it shows, including what is in the way.
 */
const CAMERA_PURPOSE: Record<'suite' | 'beam' | 'anterior' | 'side' | 'head' | 'target', string> = {
  suite:
    'Suite: the whole C-arm, table and patient, to see where each component of image formation sits.',
  beam: 'Beam view: from the X-ray tube, looking along the beam to the detector. Everything the beam crosses lines up, which is why a projection superimposes it.',
  anterior:
    'Anterior: looking down on the patient from the front. At 0° the detector is nearest you and covers the chest; the tube is beneath the table. Rotate the C-arm and the detector moves off the chest.',
  side: 'Side: from beside the table. The tube is below, the detector above, and the depth between the tool and the target, which a frontal image collapses, is visible.',
  head: 'Head: from the head of the table, to see how far the C-arm has rotated around the patient.',
  target: 'Target: close on the authored target and the tool tip.',
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
const motionSubscribe = (fn: () => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', fn)
  return () => media.removeEventListener('change', fn)
}
const motionSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** Mark ready only after a rendered frame, not merely successful context creation. */
function FrameReady({ ready }: { ready: () => void }) {
  const { gl } = useThree()
  const drawn = useRef(false)
  useFrame(() => {
    if (drawn.current) return
    drawn.current = true
    requestAnimationFrame(() => {
      gl.domElement.dataset.threeState = 'ready'
      ready()
    })
  })
  return null
}

export default function SuiteScene(props: ImagingSuitePaneProps) {
  const { view, onRepresentationReady } = props
  const isRoom = view.mode === 'room'
  const showChain =
    !props.independent &&
    (!props.presentation || view.sectionId === 'chain-walk') &&
    (!isRoom || view.layers.includes('labels') || Boolean(props.chainAnswer))
  const [projectionReady, setProjectionReady] = useState(false)
  const [source, setSource] = useState<DrrTextureSource | null>(null)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    if (!source) return
    const update = () => setProjectionReady(source.state === 'ready')
    update()
    return source.subscribe(update)
  }, [source])
  const reducedMotion = useSyncExternalStore(motionSubscribe, motionSnapshot, () => true)
  const [steppedOrbit, setSteppedOrbit] = useState(0)
  const [registeredSensor, setRegisteredSensor] = useState<Point3 | null>(null)
  const isRegistration = view.mode === 'navigation' || view.mode === 'augmented'
  const inputs = useMemo(() => {
    const resolved = resolveSuiteInputs(view, props.lab.values)
    return {
      ...resolved,
      orbit: resolved.orbit + steppedOrbit,
      toolFollowsAnatomy: isRegistration ? false : resolved.toolFollowsAnatomy,
    }
  }, [view, props.lab.values, steppedOrbit, isRegistration])
  const registered = useMemo(
    () => (isRegistration ? registration(inputs) : null),
    [isRegistration, inputs],
  )
  const staffModel = useMemo(
    () => (view.mode === 'staff' ? staff(inputs) : null),
    [view.mode, inputs],
  )
  const cbct = useCbctAcquisition(props, inputs, source, reducedMotion, visible)
  const isCbct = view.mode === 'cbct'
  const dts = useTomosynthesis(
    view,
    inputs,
    props.controlsEnabled && props.presentation !== 'multiplanar',
    visible,
    reducedMotion,
  )
  const sceneOrbit = isCbct ? cbct.angle : dts.active ? dts.angle : inputs.orbit
  const sceneGeometry = isCbct ? cbct.setup.geometry : inputs.geometry
  const monitorOffset = useMemo(
    () => (isRoom ? roomMonitorOffset(sceneGeometry) : undefined),
    [isRoom, sceneGeometry],
  )
  const translation = isCbct ? cbct.setup.offset : registered?.currentOffset
  const overviewBounds = useMemo(
    () =>
      isCbct
        ? cbctOrbitSamples(inputs.orbitSpanDeg, 25).flatMap((angle) => {
            const f = suiteFrame(angle, 0, sceneGeometry)
            return [f.source, ...f.corners]
          })
        : dts.active
          ? dtsArc(inputs.sweepDeg, inputs.geometry).flatMap(({ angle }) => {
              const f = suiteFrame(angle, 0, sceneGeometry)
              return [f.source, ...f.corners]
            })
          : isRoom
            ? roomBounds(suiteFrame(sceneOrbit, inputs.tilt, sceneGeometry))
            : staffModel
              ? [
                  ...staffModel.rings.flatMap((ring) =>
                    ring.segments.flatMap((segment) => segment.points),
                  ),
                  staffModel.position,
                ]
              : undefined,
    [
      isCbct,
      isRoom,
      dts.active,
      inputs.orbitSpanDeg,
      inputs.sweepDeg,
      inputs.geometry,
      sceneGeometry,
      sceneOrbit,
      inputs.tilt,
      staffModel,
    ],
  )
  const frame = useMemo(
    () => suiteFrame(sceneOrbit, inputs.tilt, sceneGeometry),
    [sceneOrbit, inputs.tilt, sceneGeometry],
  )
  const detectorFrame = useMemo(
    () => ({ center: frame.detectorCenter, u: frame.u, v: frame.v, field: frame.geometry.field }),
    [frame],
  )
  const pose = useMemo(
    () => ({
      orbit: sceneOrbit,
      tilt: inputs.tilt,
      geometry: sceneGeometry,
      anatomyTranslation: translation,
    }),
    [sceneOrbit, inputs.tilt, sceneGeometry, translation],
  )
  const [volume, setVolume] = useState<Uint8Array | null>(null)
  const [profileFailed, setProfileFailed] = useState(false)
  useEffect(() => {
    if (!['signal', 'sampling', 'dose'].includes(view.mode)) return
    let active = true
    void loadAnatomyVolume()
      .then((data) => {
        if (active) setVolume(data)
      })
      .catch(() => {
        if (active) setProfileFailed(true)
      })
    return () => {
      active = false
    }
  }, [view.mode])
  const profile = useMemo(
    () =>
      ['signal', 'dose'].includes(view.mode) && volume
        ? rayProfile(
            volume,
            frame.source,
            view.mode === 'dose' ? frame.detectorCenter : rayThrough(frame, LESION_CENTER).hit,
          )
        : null,
    [view.mode, volume, frame],
  )
  const dose = useMemo(
    () => (view.mode === 'dose' ? dosePlanes(inputs, profile) : null),
    [view.mode, inputs, profile],
  )
  const [cameraOverride, setCameraOverride] = useState<{
    requested: SuiteCamera
    value: SuiteCamera
  } | null>(null)
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null)
  const moveCamera = useCallback(
    (kind: CameraCommand['kind']) =>
      setCameraCommand((previous) => ({ kind, nonce: (previous?.nonce ?? 0) + 1 })),
    [],
  )
  const [contextLost, setContextLost] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [attemptEpoch, setAttemptEpoch] = useState(0)
  const [geometryOpen, setGeometryOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const portal = useRef<HTMLDivElement>(null)
  const displays = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = displays.current
    if (!node) return
    const update = () => {
      const offset =
        getComputedStyle(node).position === 'sticky' ? node.getBoundingClientRect().height + 8 : 0
      node.parentElement?.style.setProperty('--suite-sticky-offset', `${offset}px`)
    }
    const observer = new ResizeObserver(update)
    observer.observe(node)
    update()
    return () => observer.disconnect()
  }, [])
  const playback = useSuitePlayback(view, props.controlsEnabled && !isRoom, visible, reducedMotion)
  const timeModel = temporal({ ...inputs, phase: playback.phase })
  const displayCamera =
    cameraOverride?.requested === view.camera ? cameraOverride.value : view.camera
  const onCamera = useCallback(
    (next: SuiteCamera) => setCameraOverride({ requested: view.camera, value: next }),
    [view.camera],
  )
  const onReady = useCallback(() => setReady(true), [])
  const onLost = useCallback(() => {
    setReady(false)
    setContextLost(true)
  }, [])
  useEffect(() => {
    const node = displays.current
    if (!node) return
    let intersecting = true
    const update = () => setVisible(intersecting && !document.hidden)
    const observer = new IntersectionObserver((entries) => {
      intersecting = entries.some((e) => e.isIntersecting)
      update()
    })
    observer.observe(node)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  const fallback = (
    <div data-suite-failure>
      <SuiteFallback {...props} />
    </div>
  )
  const drrMode = [
    'projection',
    'signal',
    'field',
    'time',
    'cbct',
    'navigation',
    'augmented',
  ].includes(view.mode)
  const running = isCbct ? cbct.busy : dts.active ? dts.running : playback.running
  const representationReady =
    (props.independent || props.presentation === 'multiplanar' || (ready && !contextLost)) &&
    (drrMode
      ? projectionReady
      : view.mode === 'sampling'
        ? !!volume
        : dts.active
          ? !!dts.images && !dts.failed && dts.count > 0
          : true)
  useEffect(() => {
    onRepresentationReady?.(representationReady)
  }, [onRepresentationReady, representationReady])
  const imageFirst =
    props.presentation === 'comparison' ||
    (['projection', 'signal', 'field', 'time', 'sampling', 'dts', 'dts-prior'].includes(
      view.mode,
    ) &&
      view.sectionId !== 'chain-walk')
  // Report 2.3: the component walk keeps its one control and its projections directly under the
  // 3D highlight, in a compact row, so the text for the current component can sit beside the scene.
  const walkLayout =
    view.sectionId === 'chain-walk' && props.presentation === 'acquisition' && !props.independent
  const dockNearImage = imageFirst || walkLayout
  const objectLabels = useMemo(
    () =>
      view.layers.includes('labels') && drrMode && !['time', 'navigation'].includes(view.mode)
        ? projectionObjectLabels(frame, inputs, translation)
        : [],
    [view.layers, view.mode, drrMode, frame, inputs, translation],
  )
  const stepPurposeId = useId()
  const stepPurpose =
    view.mode === 'sampling'
      ? 'Move to the next axial slice'
      : dts.active
        ? 'Add the next projection of the sweep'
        : isCbct
          ? 'Advance the spin by one position'
          : view.mode === 'time'
            ? 'Advance by one pulse'
            : 'Rotate the C-arm by one degree'
  const fieldVisible =
    view.mode === 'field' || view.sectionId === 'two-dimensional' || view.sectionId === 'good-image'
  const controlDock = (
    <LabDock
      {...props}
      controlsEnabled={props.controlsEnabled && representationReady}
      disabledControls={
        isCbct && (cbct.sourceState !== 'ready' || cbct.busy) ? new Set(['captured']) : undefined
      }
      onLabChange={(patch) =>
        isCbct && patch.captured === true ? void cbct.run(true) : props.onLabChange(patch)
      }
      onLabReset={() => {
        setSteppedOrbit(0)
        playback.reset()
        cbct.reset()
        dts.reset()
        setAttemptEpoch((n) => n + 1)
        props.onLabReset()
      }}
    />
  )
  return (
    <SceneBoundary fallback={fallback}>
      <div
        className={styles.pane}
        data-suite-scene
        data-task-presentation={props.presentation}
        data-volume-captured={props.lab.values.captured === true ? 'true' : undefined}
        data-suite-mode={view.mode}
        data-suite-camera={displayCamera}
        data-walk-layout={walkLayout ? 'true' : undefined}
        data-suite-state={contextLost ? 'failed' : ready ? 'ready' : 'fallback'}
        data-lit={view.litStop ?? ''}
        data-suite-anim={running ? 'running' : 'idle'}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
      >
        {showChain && (
          <p className={styles.caption} data-chain-caption>
            {props.chainCaption}
          </p>
        )}
        {view.litStop && view.stopSentence && view.stopSentence !== props.chainCaption && (
          <p className={styles.stopSentence} data-stop-sentence>
            {view.stopSentence}
          </p>
        )}
        {!props.controlsEnabled && (
          <p role="status" className={styles.reason}>
            {props.lockedReason ?? props.pausedReason ?? 'Controls unavailable'}
          </p>
        )}
        <div
          ref={displays}
          className={styles.displays}
          data-image-first={imageFirst ? 'true' : undefined}
          data-independent={props.independent ? 'true' : undefined}
          data-monitor-layout={isRoom ? 'hidden' : view.monitor}
        >
          <div
            className={styles.scenePanel}
            hidden={props.independent || (props.presentation === 'multiplanar' && !geometryOpen)}
          >
            {!props.independent && (
              <>
                <div className={styles.sceneHeader}>
                  <span>
                    {isRoom ? 'The imaging suite at rest' : 'CT-derived anatomy · image formation'}
                  </span>
                  <span>Authored teaching model</span>
                </div>
                <div className={styles.viewport} ref={viewport} data-suite-viewport>
                  {contextLost ? (
                    <div className={styles.contextLost} role="status">
                      The 3D view paused after a graphics interruption.
                      <button
                        type="button"
                        onClick={() => {
                          setContextLost(false)
                          setEpoch((n) => n + 1)
                        }}
                      >
                        Restore 3D view
                      </button>
                    </div>
                  ) : (
                    <div
                      role="img"
                      aria-label={
                        isRoom
                          ? 'Imaging suite at rest with a gantry, table, CT-derived thorax and monitor boom'
                          : 'CT-derived thorax with a source, cone, detector and authored target and tool'
                      }
                      className={styles.canvasHost}
                    >
                      <Canvas
                        key={epoch}
                        frameloop={
                          !ready || visible ? (running && visible ? 'always' : 'demand') : 'never'
                        }
                        dpr={[1, 1.5]}
                        camera={{ fov: 42, near: 1, far: 12000 }}
                        gl={{ antialias: true, preserveDrawingBuffer: true }}
                        onCreated={({ gl }) =>
                          gl.setClearColor(isRoom ? ROOM_BACKGROUND : '#11232d')
                        }
                        fallback={
                          <p>
                            {isRoom
                              ? 'The 3D canvas is unavailable.'
                              : 'The 3D canvas is unavailable. The controls and text readouts remain available.'}
                          </p>
                        }
                      >
                        {playback.running && <SuiteClock tick={playback.tick} />}
                        {dts.running && <SuiteClock tick={dts.tick} />}
                        <WebGLContextGuard onContextLost={onLost} />
                        <ambientLight intensity={0.8} />
                        <directionalLight position={[400, 600, 500]} intensity={2} />
                        <directionalLight
                          position={[-400, 100, -300]}
                          intensity={0.5}
                          color="#9ab9cf"
                        />
                        <Suspense fallback={null}>
                          <Anatomy
                            layers={view.layers}
                            offset={translation}
                            contextOpacity={view.mode === 'sampling' ? 0.12 : 1}
                            room={isRoom}
                          />
                          <Room
                            layers={view.layers}
                            geometry={inputs.geometry}
                            floorSpan={staffModel ? 8000 : undefined}
                            atRest={isRoom}
                          />
                          {view.layers.includes('gantry') && (
                            <ParametricCarm
                              frame={frame}
                              variant={inputs.variant}
                              atRest={isRoom}
                              lit={
                                view.mode === 'time'
                                  ? timeModel.pulseIsOn
                                  : view.litStop === 'source'
                              }
                              shutters={!['field', 'dose'].includes(view.mode)}
                            />
                          )}
                          {view.layers.includes('cone') && (
                            <BeamCone
                              frame={frame}
                              fieldPercent={dose ? dose.fieldPercent : inputs.fieldPercent}
                              target={dose ? frame.iso : undefined}
                              opacity={isRoom ? 0.14 : undefined}
                            />
                          )}
                          {view.layers.includes('gantry') && (
                            <DetectorImage frame={detectorFrame} source={source} />
                          )}
                          {drrMode && !['time', 'navigation'].includes(view.mode) && (
                            <ProjectionView3D
                              frame={frame}
                              inputs={inputs}
                              offset={translation}
                              ray={view.layers.includes('ray')}
                            />
                          )}
                          {view.mode === 'time' && (
                            <TimeView
                              frame={frame}
                              model={timeModel}
                              portal={portal as RefObject<HTMLDivElement>}
                              labels={view.layers.includes('labels')}
                            />
                          )}
                          {isCbct && <ConeBeamView acquisition={cbct} inputs={inputs} />}
                          {dts.active && (
                            <TomosynthesisView
                              model={dts}
                              inputs={inputs}
                              prior={view.mode === 'dts-prior'}
                            />
                          )}
                          {view.mode === 'sampling' && !props.independent && (
                            <SamplingView
                              inputs={inputs}
                              volume={volume}
                              planes={view.layers.includes('planes')}
                              portal={portal as RefObject<HTMLDivElement>}
                              labels={view.layers.includes('labels')}
                            />
                          )}
                          {isRegistration && (
                            <RegistrationView
                              inputs={inputs}
                              augmented={view.mode === 'augmented'}
                              portal={portal as RefObject<HTMLDivElement>}
                              labels={view.layers.includes('labels')}
                              onSensor={setRegisteredSensor}
                            />
                          )}
                          {view.mode === 'staff' && (
                            <StaffView inputs={inputs} layers={view.layers} />
                          )}
                          {view.mode === 'dose' && view.layers.includes('planes') && (
                            <DoseView inputs={inputs} profile={profile} />
                          )}
                          {fieldVisible && (
                            <FieldView
                              frame={frame}
                              fieldPercent={inputs.fieldPercent}
                              crop={false}
                            />
                          )}
                          {view.mode === 'signal' && view.layers.includes('ray') && (
                            <RayTrace profile={profile} />
                          )}
                          {showChain && (
                            <ChainPins
                              objectLabels={objectLabels}
                              frame={frame}
                              portal={portal as RefObject<HTMLDivElement>}
                              lit={view.litStop}
                              answer={props.chainAnswer}
                              onCamera={onCamera}
                              monitorOffset={monitorOffset}
                            />
                          )}
                          {!showChain && objectLabels.length > 0 && (
                            <SceneLabels
                              portal={portal as RefObject<HTMLDivElement>}
                              labels={objectLabels}
                            />
                          )}
                          <FrameReady ready={onReady} />
                        </Suspense>
                        <CameraRig
                          view={displayCamera}
                          frame={frame}
                          enabled={props.controlsEnabled}
                          labelled={showChain}
                          roomComposition={isRoom}
                          monitorOffset={monitorOffset}
                          overviewBounds={overviewBounds}
                          focus={isCbct ? cbct.setup.target : undefined}
                          closeupDistance={
                            view.mode === 'sampling' ? 120 : isRegistration ? 180 : undefined
                          }
                          command={cameraCommand}
                        />
                      </Canvas>
                    </div>
                  )}
                  <div
                    ref={portal}
                    className={styles.overlay}
                    data-chain-map
                    role={showChain ? 'group' : undefined}
                    aria-label={showChain ? 'Image formation' : undefined}
                  />
                </div>
                {!isRoom && (
                  <div className={styles.toolbar} aria-label="3D camera views">
                    <button
                      type="button"
                      disabled={
                        !props.controlsEnabled ||
                        (!view.lab && !dts.active) ||
                        (!view.bindings.some((b) => b.input === 'orbit') &&
                          ![
                            'field',
                            'time',
                            'cbct',
                            'dts',
                            'dts-prior',
                            'sampling',
                            'navigation',
                            'augmented',
                            'dose',
                          ].includes(view.mode))
                      }
                      onClick={() => {
                        if (view.mode === 'sampling' && view.lab) {
                          const control = labControl(view.lab, 'axial')
                          props.onLabChange({
                            slab: false,
                            axial:
                              inputs.axial >= (control?.max ?? 20)
                                ? (control?.min ?? -20)
                                : inputs.axial + (control?.step ?? 1),
                          })
                          return
                        }
                        if (dts.active) {
                          dts.step()
                          return
                        }
                        if (isCbct) {
                          cbct.step()
                          return
                        }
                        if (view.mode === 'time') {
                          playback.step(1 / inputs.pulseRate)
                          return
                        }
                        const binding = view.bindings.find((b) => b.input === 'orbit')
                        if (!binding || !view.lab) {
                          setSteppedOrbit((n) => n + 1)
                          return
                        }
                        const control = labControl(view.lab, binding.control)
                        const value = labNumber(
                          view.lab,
                          props.lab.values,
                          binding.control,
                          view.sectionId,
                        )
                        props.onLabChange({
                          [binding.control]: clamp(
                            value + 1,
                            control?.min ?? -Infinity,
                            control?.max ?? Infinity,
                          ),
                        })
                      }}
                      title={stepPurpose}
                      // The name stays "Step"; what a step does here is its description.
                      aria-describedby={stepPurposeId}
                      data-scene-step
                    >
                      Step
                    </button>
                    <span id={stepPurposeId} hidden>
                      {stepPurpose}
                    </span>
                    {view.animation && !isCbct && (
                      <button
                        type="button"
                        disabled={!props.controlsEnabled || reducedMotion}
                        onClick={dts.active ? dts.play : playback.toggle}
                      >
                        {running ? 'Pause' : 'Play'}
                      </button>
                    )}
                    {(['suite', 'beam', 'anterior', 'side', 'head', 'target'] as const).map((v) => (
                      <button
                        type="button"
                        key={v}
                        aria-pressed={displayCamera === v}
                        onClick={() => onCamera(v)}
                      >
                        {v === 'suite'
                          ? 'Suite'
                          : v === 'beam'
                            ? 'Beam view'
                            : v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                    <span
                      className={styles.cameraMoves}
                      role="group"
                      aria-label="Move the 3D camera"
                      data-camera-moves
                    >
                      {(
                        [
                          ['rotate-left', '◀', 'Rotate the view left'],
                          ['rotate-right', '▶', 'Rotate the view right'],
                          ['zoom-in', '+', 'Zoom the view in'],
                          ['zoom-out', '−', 'Zoom the view out'],
                        ] as const
                      ).map(([kind, glyph, name]) => (
                        <button
                          type="button"
                          key={kind}
                          aria-label={name}
                          title={name}
                          disabled={!props.controlsEnabled}
                          data-camera-move={kind}
                          onClick={() => moveCamera(kind)}
                        >
                          <span aria-hidden="true">{glyph}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={!props.controlsEnabled}
                        data-camera-move="reset"
                        onClick={() => moveCamera('reset')}
                      >
                        Reset view
                      </button>
                    </span>
                    {displayCamera in CAMERA_PURPOSE && (
                      <p className={styles.cameraPurpose} data-camera-purpose={displayCamera}>
                        {CAMERA_PURPOSE[displayCamera as keyof typeof CAMERA_PURPOSE]} Drag to
                        rotate; the mouse wheel scrolls the page.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {drrMode && (
            <section className={styles.monitorPanel} hidden={view.monitor === 'hidden'}>
              <div className={styles.sceneHeader}>CT-derived projection</div>
              <Monitor
                key={attemptEpoch}
                viewMemory={props.viewMemory}
                captureEnabled={props.controlsEnabled}
                frameContext={{
                  source: '/peripheral-imaging/anatomy',
                  mode: view.mode,
                  values: props.lab.values,
                  temporalPhase: view.mode === 'time' ? playback.phase : undefined,
                }}
                pose={pose}
                depth={inputs.toolDepth}
                comparison={!props.independent}
                acquisitionField={inputs.fieldPercent}
                displayMask={
                  fieldVisible && inputs.crop ? (
                    <FieldMask frame={frame} fieldPercent={inputs.cropWidth} crop />
                  ) : undefined
                }
                overlay={
                  view.mode === 'time' ? (
                    <TimeOverlay frame={frame} model={timeModel} />
                  ) : isRegistration ? (
                    <RegistrationOverlay
                      inputs={inputs}
                      sensor={view.mode === 'navigation' ? registeredSensor : undefined}
                    />
                  ) : fieldVisible ? (
                    <>
                      <ProjectionOverlays
                        orbit={pose.orbit}
                        tilt={pose.tilt}
                        depth={inputs.toolDepth}
                        geometry={pose.geometry}
                      />
                      <FieldContextOverlay orbit={pose.orbit} tilt={pose.tilt} />
                    </>
                  ) : undefined
                }
                showCurrent={inputs.showCurrent}
                offset={translation}
                targetFill={view.mode !== 'signal'}
                zoom={fieldVisible ? inputs.zoom : 1}
                mask={
                  fieldVisible ? (
                    <FieldMask frame={frame} fieldPercent={inputs.fieldPercent} crop={false} />
                  ) : undefined
                }
                onSource={setSource}
                hidden={view.monitor === 'hidden'}
              />
              <p className={styles.monitorCaption}>
                At frontal: screen right = patient left; top = superior. Zero-angle beam travels
                posterior to anterior. Orbit and tilt use the model’s signed angles.
              </p>
              <p className={styles.monitorCaption}>
                {view.mode === 'time'
                  ? timeModel.sampleIndex < 0
                    ? 'Waiting for the first completed pulse.'
                    : `Frame ${timeModel.sampleIndex + 1} · held between pulses. Amber: pulse travel; white: sampled tool.`
                  : isRegistration
                    ? 'Amber: current target · teal: stored contour · white: authored tool'
                    : 'Amber contour: authored target · white mark: tool tip'}
              </p>
            </section>
          )}
          {dts.active && (
            <section className={styles.monitorPanel} hidden={view.monitor === 'hidden'}>
              <div className={styles.sceneHeader}>Limited-angle teaching plane</div>
              <TomosynthesisMonitor
                model={dts}
                planeDepth={inputs.planeDepth}
                allowOverlay={!props.independent}
              />
              <p className={styles.monitorCaption}>
                {dts.count} / 13 projections ·{' '}
                {dts.selectedLayer === 'measured'
                  ? 'Acquired projections'
                  : dts.selectedLayer === 'prior'
                    ? 'Planning CT prior'
                    : 'Acquired projections with planning CT prior'}
              </p>
            </section>
          )}
          {dockNearImage && <div className={styles.nearImageControls}>{controlDock}</div>}
        </div>
        {props.presentation === 'multiplanar' && !props.independent && (
          <button
            type="button"
            aria-expanded={geometryOpen}
            onClick={() => setGeometryOpen((open) => !open)}
          >
            {geometryOpen ? 'Hide geometric explanation' : 'Show geometric explanation'}
          </button>
        )}
        {props.chainAnswer && (
          <div className={styles.answer}>
            <ChainAnswerFieldset answer={props.chainAnswer} />
          </div>
        )}
        {isCbct && (
          <ConeBeamPanels acquisition={cbct} inputs={inputs} enabled={props.controlsEnabled} />
        )}
        {dts.active && !props.independent && (
          <TomosynthesisPanels
            model={dts}
            inputs={inputs}
            prior={view.mode === 'dts-prior'}
            enabled={props.controlsEnabled}
          />
        )}
        {view.mode === 'sampling' && (
          <SamplingPanels
            inputs={inputs}
            revealed={!props.independent && props.lab.values.revealed === true}
          />
        )}
        {isRegistration && <RegistrationPanels augmented={view.mode === 'augmented'} />}
        {view.mode === 'staff' && <StaffPanels inputs={inputs} />}
        {view.mode === 'dose' && (
          <DosePanels inputs={inputs} profile={profile} failed={profileFailed} />
        )}
        {view.mode === 'time' && <TimeSamples model={timeModel} phase={playback.phase} />}
        {view.mode === 'signal' && <SignalReadout profile={profile} failed={profileFailed} />}
        {isRoom ? <LabGoals goals={props.goals} /> : !dockNearImage ? controlDock : null}
        {!representationReady && !isRoom && (
          <p role="status">
            The required image is loading or unavailable. Image-based work is paused; use the
            teaching explanation and retry the view.
          </p>
        )}
        {!props.presentation && (
          <p className={styles.boundary} data-model-boundary>
            {view.boundary}
          </p>
        )}
        {props.children}
      </div>
    </SceneBoundary>
  )
}
