'use client'
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Anatomy } from './Anatomy'
import { Room } from './Room'
import { ParametricCarm, BeamCone } from './ParametricCarm'
import { DetectorImage } from './DetectorImage'
import { Monitor } from './Monitor'
import type { DrrTextureSource } from './drrTextureSource'
import { CameraRig } from './CameraRig'
import { ChainPins } from './ChainPins'
import { ChainAnswerFieldset } from './ChainAnswerFieldset'
import { WebGLContextGuard } from './WebGLContextGuard'
import { LabDock } from './LabDock'
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
import { TimeView, TimeOverlay, TimeSamples } from './views/TimeView'
import { useSuitePlayback, SuiteClock } from './useSuitePlayback'
import { FieldView, FieldMask } from './views/FieldView'
import { ProjectionView3D } from './views/ProjectionView3D'
import { RayTrace, SignalReadout } from './views/SignalView'
import { loadAnatomyVolume } from '../../lib/anatomy'
import { rayProfile } from '../../lib/rayProfile'
import { labControl, labNumber } from '../../engine/labMetrics'
import { LESION_CENTER, clamp, type Point3 } from '../../lib/physics'
import { resolveSuiteInputs } from './suiteViewSpec'
import { rayThrough, suiteFrame, temporal, cbctOrbitSamples } from './suiteModel'
import { SuiteFallback } from './SuiteFallback'
import type { ImagingSuitePaneProps, SuiteCamera } from './types'
import styles from './suite-scene.module.css'

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
  const { view } = props
  const [source, setSource] = useState<DrrTextureSource | null>(null)
  const [visible, setVisible] = useState(true)
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
  const cbct = useCbctAcquisition(props, inputs, source, reducedMotion, visible)
  const isCbct = view.mode === 'cbct'
  const dts = useTomosynthesis(view, inputs, props.controlsEnabled, visible, reducedMotion)
  const sceneOrbit = isCbct ? cbct.angle : dts.active ? dts.angle : inputs.orbit
  const sceneGeometry = isCbct ? cbct.setup.geometry : inputs.geometry
  const translation = isCbct ? cbct.setup.offset : registered?.currentOffset
  const cbctBounds = useMemo(
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
          : undefined,
    [isCbct, dts.active, inputs.orbitSpanDeg, inputs.sweepDeg, inputs.geometry, sceneGeometry],
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
    if (!['signal', 'sampling'].includes(view.mode)) return
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
      view.mode === 'signal' && volume
        ? rayProfile(volume, frame.source, rayThrough(frame, LESION_CENTER).hit)
        : null,
    [view.mode, volume, frame],
  )
  const [cameraOverride, setCameraOverride] = useState<{
    requested: SuiteCamera
    value: SuiteCamera
  } | null>(null)
  const [contextLost, setContextLost] = useState(false)
  const [epoch, setEpoch] = useState(0)
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
  const playback = useSuitePlayback(view, props.controlsEnabled, visible, reducedMotion)
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
    const node = viewport.current
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
  return (
    <SceneBoundary fallback={fallback}>
      <div
        className={styles.pane}
        data-suite-scene
        data-suite-mode={view.mode}
        data-suite-camera={displayCamera}
        data-suite-state={contextLost ? 'failed' : ready ? 'ready' : 'fallback'}
        data-lit={view.litStop ?? ''}
        data-suite-anim={running ? 'running' : 'idle'}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
      >
        <p className={styles.caption} data-chain-caption>
          {props.chainCaption}
        </p>
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
        <div ref={displays} className={styles.displays} data-monitor-layout={view.monitor}>
          <div className={styles.scenePanel}>
            <div className={styles.sceneHeader}>
              <span>CT-derived anatomy · imaging chain</span>
              <span>Authored teaching model</span>
            </div>
            <div className={styles.viewport} ref={viewport}>
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
                  aria-label="CT-derived thorax with a source, cone, detector and authored target and tool"
                  className={styles.canvasHost}
                >
                  <Canvas
                    key={epoch}
                    frameloop={visible ? (running ? 'always' : 'demand') : 'never'}
                    dpr={[1, 1.5]}
                    camera={{ fov: 42, near: 1, far: 12000 }}
                    gl={{ antialias: true, preserveDrawingBuffer: true }}
                    onCreated={({ gl }) => gl.setClearColor('#11232d')}
                    fallback={
                      <p>
                        The 3D canvas is unavailable. The controls and text readouts remain
                        available.
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
                      />
                      <Room layers={view.layers} geometry={inputs.geometry} />
                      {view.layers.includes('gantry') && (
                        <ParametricCarm
                          frame={frame}
                          variant={inputs.variant}
                          lit={
                            view.mode === 'time' ? timeModel.pulseIsOn : view.litStop === 'source'
                          }
                          shutters={view.mode !== 'field'}
                        />
                      )}
                      {view.layers.includes('cone') && (
                        <BeamCone
                          frame={frame}
                          fieldPercent={inputs.crop ? 100 : inputs.fieldPercent}
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
                          labels={view.layers.includes('labels')}
                          portal={portal as RefObject<HTMLDivElement>}
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
                      {view.mode === 'sampling' && (
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
                      {view.mode === 'field' && (
                        <FieldView
                          frame={frame}
                          fieldPercent={inputs.fieldPercent}
                          crop={inputs.crop}
                        />
                      )}
                      {view.mode === 'signal' && view.layers.includes('ray') && (
                        <RayTrace profile={profile} />
                      )}
                      <ChainPins
                        spread={['suite', 'room', 'anterior', 'side', 'head'].includes(
                          displayCamera,
                        )}
                        frame={frame}
                        portal={portal as RefObject<HTMLDivElement>}
                        lit={view.litStop}
                        answer={props.chainAnswer}
                        onCamera={onCamera}
                      />
                      <FrameReady ready={onReady} />
                    </Suspense>
                    <CameraRig
                      view={displayCamera}
                      frame={frame}
                      enabled={props.controlsEnabled}
                      overviewBounds={cbctBounds}
                      focus={isCbct ? cbct.setup.target : undefined}
                      closeupDistance={
                        view.mode === 'sampling' ? 120 : isRegistration ? 180 : undefined
                      }
                    />
                  </Canvas>
                </div>
              )}
              <div
                ref={portal}
                className={styles.overlay}
                data-chain-map
                aria-label="The imaging chain"
              />
            </div>
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
              >
                Step
              </button>
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
            </div>
          </div>
          {drrMode && (
            <section className={styles.monitorPanel} hidden={view.monitor === 'hidden'}>
              <div className={styles.sceneHeader}>CT-derived projection</div>
              <Monitor
                pose={pose}
                depth={inputs.toolDepth}
                overlay={
                  view.mode === 'time' ? (
                    <TimeOverlay frame={frame} model={timeModel} />
                  ) : isRegistration ? (
                    <RegistrationOverlay
                      inputs={inputs}
                      sensor={view.mode === 'navigation' ? registeredSensor : undefined}
                    />
                  ) : undefined
                }
                showCurrent={inputs.showCurrent}
                offset={translation}
                targetFill={view.mode !== 'signal'}
                zoom={view.mode === 'field' ? inputs.zoom : 1}
                mask={
                  view.mode === 'field' ? (
                    <FieldMask
                      frame={frame}
                      fieldPercent={inputs.fieldPercent}
                      crop={inputs.crop}
                    />
                  ) : undefined
                }
                onSource={setSource}
                hidden={view.monitor === 'hidden'}
              />
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
              <TomosynthesisMonitor model={dts} />
              <p className={styles.monitorCaption}>
                {dts.count} / 13 projections ·{' '}
                {dts.selectedLayer === 'measured'
                  ? 'Measured projections'
                  : dts.selectedLayer === 'prior'
                    ? 'Planning CT prior'
                    : 'Measured projections with planning CT prior'}
              </p>
            </section>
          )}
        </div>
        {props.chainAnswer && (
          <div className={styles.answer}>
            <ChainAnswerFieldset answer={props.chainAnswer} />
          </div>
        )}
        {isCbct && (
          <ConeBeamPanels acquisition={cbct} inputs={inputs} enabled={props.controlsEnabled} />
        )}
        {dts.active && (
          <TomosynthesisPanels
            model={dts}
            inputs={inputs}
            prior={view.mode === 'dts-prior'}
            enabled={props.controlsEnabled}
          />
        )}
        {view.mode === 'sampling' && (
          <SamplingPanels inputs={inputs} revealed={props.lab.values.revealed === true} />
        )}
        {isRegistration && <RegistrationPanels augmented={view.mode === 'augmented'} />}
        {view.mode === 'time' && <TimeSamples model={timeModel} phase={playback.phase} />}
        {view.mode === 'signal' && <SignalReadout profile={profile} failed={profileFailed} />}
        <LabDock
          {...props}
          disabledControls={
            isCbct && (cbct.sourceState !== 'ready' || cbct.busy)
              ? new Set(['captured'])
              : undefined
          }
          onLabChange={(patch) =>
            isCbct && patch.captured === true ? void cbct.run(true) : props.onLabChange(patch)
          }
          onLabReset={() => {
            setSteppedOrbit(0)
            playback.reset()
            cbct.reset()
            dts.reset()
            props.onLabReset()
          }}
        />
        <p className={styles.boundary} data-model-boundary>
          {view.boundary}
        </p>
        {props.children}
      </div>
    </SceneBoundary>
  )
}
