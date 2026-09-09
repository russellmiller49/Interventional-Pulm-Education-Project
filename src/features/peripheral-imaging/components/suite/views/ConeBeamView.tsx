'use client'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Line } from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { DrrTextureSource, DrrPose } from '../drrTextureSource'
import { labReadouts } from '../../../engine/labMetrics'
import { add, cbctOrbitSamples, cbctSetup, scale, suiteFrame, sweptEnvelope } from '../suiteModel'
import { CtQuad, slicePoint, useCtVolume } from '../CtSliceImages'
import { Quad } from '../SceneGeometry'
import { ProjectionOverlays } from '../ProjectionOverlays'
import { MPR } from '../../Diagrams'
import type { ImagingSuitePaneProps, SuiteInputs } from '../types'
import type { Point3 } from '../../../lib/physics'
import styles from '../suite-scene.module.css'

type ProjectionCopy = { angle: number; canvas: HTMLCanvasElement }
export function useCbctAcquisition(
  props: ImagingSuitePaneProps,
  inputs: SuiteInputs,
  source: DrrTextureSource | null,
  reducedMotion: boolean,
  visible: boolean,
) {
  const enabled = props.view.mode === 'cbct'
  const [resetEpoch, setResetEpoch] = useState(0)
  const setup = useMemo(() => cbctSetup(inputs), [inputs])
  const key = JSON.stringify([
    enabled,
    inputs.variant,
    inputs.offsetX,
    inputs.offsetDepth,
    inputs.acquisitionOrbit,
    inputs.orbitSpanDeg,
    inputs.projectionCount,
    inputs.geometry,
    resetEpoch,
  ])
  const sourceState = useSyncExternalStore(
    useCallback((fn) => source?.subscribe(fn) ?? (() => {}), [source]),
    useCallback(() => source?.state ?? 'loading', [source]),
    () => 'loading',
  )
  const [frames, setFrames] = useState<ProjectionCopy[]>([])
  const [scouts, setScouts] = useState<ProjectionCopy[]>([])
  const [angle, setAngle] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const copies = useRef<ProjectionCopy[]>([])
  const autoKey = useRef('')
  const pose = useCallback(
    (orbit: number): DrrPose => ({
      orbit,
      tilt: 0,
      geometry: setup.geometry,
      anatomyTranslation: setup.offset,
    }),
    [setup.geometry, setup.offset],
  )
  const ready = labReadouts('acquisition', props.lab.values, props.view.sectionId).ready === true
  const volume = useCtVolume(enabled)
  // Depend on the scalar setup key, not React callback identities. A moved setup loses its copies.
  useEffect(() => {
    if (!enabled || sourceState !== 'ready' || !source) return
    abort.current?.abort()
    copies.current = []
    setFrames([])
    setScouts([])
    setAngle(null)
    setBusy(false)
    setFailed(false)
    const setupNow = cbctSetup(inputs)
    const poseNow = (orbit: number) => ({
      orbit,
      tilt: 0,
      geometry: setupNow.geometry,
      anatomyTranslation: setupNow.offset,
    })
    const task = requestAnimationFrame(() => {
      try {
        const pair = [0, 90].map((orbit) => {
          source.render(poseNow(orbit), true)
          return { angle: orbit, canvas: source.snapshot(192) }
        })
        source.update(poseNow(inputs.acquisitionOrbit))
        setScouts(pair)
        if (reducedMotion) {
          const completed = cbctOrbitSamples(inputs.orbitSpanDeg, inputs.projectionCount).map(
            (orbit) => {
              source.render(poseNow(orbit), true)
              return { angle: orbit, canvas: source.snapshot(192) }
            },
          )
          copies.current = completed
          setFrames(completed)
          setAngle(completed.at(-1)?.angle ?? null)
        }
      } catch {
        setFailed(true)
      }
    })
    return () => {
      cancelAnimationFrame(task)
      abort.current?.abort()
    }
    // inputs are represented in key; adding the complete object would reset on every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, sourceState, source, reducedMotion])
  useEffect(() => {
    if (!props.controlsEnabled || !visible) {
      abort.current?.abort()
      setBusy(false)
    }
  }, [props.controlsEnabled, visible])
  const angles = cbctOrbitSamples(inputs.orbitSpanDeg, inputs.projectionCount)
  const stop = () => {
    abort.current?.abort()
    setBusy(false)
  }
  const take = (canvas: HTMLCanvasElement, p: DrrPose) => {
    const copy = { angle: p.orbit, canvas }
    copies.current = [...copies.current, copy]
    setFrames(copies.current)
    setAngle(p.orbit)
  }
  const run = async (capture = false) => {
    if (!props.controlsEnabled || !source || sourceState !== 'ready' || (capture && !ready)) return
    stop()
    if (copies.current.length >= angles.length) {
      copies.current = []
      setFrames([])
    }
    const controller = new AbortController()
    abort.current = controller
    setBusy(!reducedMotion)
    setFailed(false)
    try {
      do {
        if (copies.current.length === angles.length) {
          copies.current = []
          setFrames([])
        }
        await source.renderSequence(angles.slice(copies.current.length).map(pose), {
          signal: controller.signal,
          immediate: reducedMotion,
          onFrame: take,
        })
      } while (
        !reducedMotion &&
        !capture &&
        props.view.animation?.loop &&
        !controller.signal.aborted
      )
      if (!controller.signal.aborted && capture) props.onLabChange({ captured: true })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true)
    } finally {
      if (abort.current === controller) setBusy(false)
    }
  }
  const step = () => {
    if (!props.controlsEnabled || !source || sourceState !== 'ready') return
    stop()
    if (copies.current.length >= angles.length) {
      copies.current = []
      setFrames([])
    }
    const p = pose(angles[copies.current.length])
    source.render(p, true)
    take(source.snapshot(192), p)
  }
  useEffect(() => {
    if (
      !enabled ||
      !props.view.animation?.autoplay ||
      !props.controlsEnabled ||
      !visible ||
      reducedMotion ||
      scouts.length !== 2 ||
      autoKey.current === key
    )
      return
    autoKey.current = key
    void run()
    // An authored autoplay runs once per setup. Callback changes and Pause do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    props.view.animation?.autoplay,
    props.controlsEnabled,
    visible,
    reducedMotion,
    scouts.length,
    key,
  ])
  return {
    setup,
    frames,
    scouts,
    angle: angle ?? inputs.acquisitionOrbit,
    busy,
    failed,
    ready,
    sourceState,
    volume,
    run,
    step,
    stop,
    reset: () => {
      stop()
      setResetEpoch((n) => n + 1)
    },
    complete: frames.length === angles.length,
  }
}
export type CbctAcquisition = ReturnType<typeof useCbctAcquisition>

function ProjectionTile({ copy, points }: { copy: ProjectionCopy; points: readonly Point3[] }) {
  const texture = useMemo(() => {
    const t = new CanvasTexture(copy.canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [copy.canvas])
  useEffect(() => () => texture.dispose(), [texture])
  return <Quad points={points} texture={texture} color="#ffffff" />
}
export function ConeBeamView({
  acquisition,
  inputs,
}: {
  acquisition: CbctAcquisition
  inputs: SuiteInputs
}) {
  const { setup, frames, complete, volume } = acquisition
  const envelope = useMemo(
    () => sweptEnvelope(inputs.variant, inputs.orbitSpanDeg, inputs.geometry),
    [inputs.variant, inputs.orbitSpanDeg, inputs.geometry],
  )
  const fov = setup.fov
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[fov.radius, fov.radius, fov.height, 64, 1, true]} />
        <meshBasicMaterial
          color="#6fcebe"
          wireframe
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[16, 16, 16]} />
        <meshBasicMaterial color={setup.centered ? '#84d1b9' : '#e4aa68'} wireframe />
      </mesh>
      {[envelope.source, envelope.detector].map((arc, index) => (
        <group key={index}>
          {[-1, 1].map((side) => (
            <Line
              key={side}
              points={arc.map((p) => add(p, [0, 0, side * envelope.halfWidth]))}
              color="#6992ac"
              transparent
              opacity={0.45}
            />
          ))}
          {arc.slice(1).map((p, i) => (
            <Quad
              key={i}
              points={[
                add(arc[i], [0, 0, -envelope.halfWidth]),
                add(p, [0, 0, -envelope.halfWidth]),
                add(p, [0, 0, envelope.halfWidth]),
                add(arc[i], [0, 0, envelope.halfWidth]),
              ]}
              color="#6b8fa8"
              opacity={0.025}
            />
          ))}
        </group>
      ))}
      {frames.map((copy, i) => {
        const frame = suiteFrame(copy.angle, 0, setup.geometry)
        const center = add(scale(frame.source, 0.73), [0, 0, -envelope.halfWidth - 55])
        return (
          <ProjectionTile
            key={i}
            copy={copy}
            points={[
              add(center, add(scale(frame.u, -36), [0, 0, -36])),
              add(center, add(scale(frame.u, 36), [0, 0, -36])),
              add(center, add(scale(frame.u, 36), [0, 0, 36])),
              add(center, add(scale(frame.u, -36), [0, 0, 36])),
            ]}
          />
        )
      })}
      {complete &&
        volume &&
        (['Axial', 'Coronal', 'Sagittal'] as const).map((plane) => (
          <CtQuad
            key={plane}
            volume={volume}
            plane={plane}
            points={[
              [-27, -27],
              [27, -27],
              [27, 27],
              [-27, 27],
            ].map(([u, v]) => add(setup.target, slicePoint(plane, u, v, 0)))}
          />
        ))}
    </group>
  )
}
function Snapshot({
  copy,
  scout = false,
  inputs,
}: {
  copy: ProjectionCopy
  scout?: boolean
  inputs?: SuiteInputs
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    canvas.current?.getContext('2d')?.drawImage(copy.canvas, 0, 0, 192, 192)
  }, [copy])
  return (
    <figure
      className={styles.snapshot}
      data-scout-state={scout ? 'ready' : undefined}
      data-cbct-frame={scout ? undefined : copy.angle}
    >
      <div>
        <canvas
          ref={canvas}
          width={192}
          height={192}
          role="img"
          aria-label={`${scout ? 'Scout' : 'Projection'} at ${copy.angle.toFixed(1)} degrees`}
        />
        {scout && inputs && (
          <ProjectionOverlays
            orbit={copy.angle}
            tilt={0}
            depth={inputs.toolDepth}
            geometry={cbctSetup(inputs).geometry}
            offset={cbctSetup(inputs).offset}
          />
        )}
        {scout && (
          <svg viewBox="0 0 192 192" aria-hidden="true">
            <path d="M96 12V180M12 96H180" stroke="#91d3d6" strokeDasharray="3 3" fill="none" />
          </svg>
        )}
      </div>
      <figcaption>
        {scout
          ? copy.angle === 0
            ? 'Frontal scout'
            : 'Lateral scout'
          : `${copy.angle.toFixed(0)}°`}
      </figcaption>
    </figure>
  )
}
export function ConeBeamPanels({
  acquisition,
  inputs,
  enabled,
}: {
  acquisition: CbctAcquisition
  inputs: SuiteInputs
  enabled: boolean
}) {
  const a = acquisition
  return (
    <section
      className={styles.signalProfile}
      data-cbct-state={a.failed ? 'failed' : a.complete ? 'complete' : 'ready'}
      data-gantry-variant={inputs.variant}
    >
      <p>
        {inputs.variant === 'mobile' ? 'Mobile cart' : 'Fixed support'} · teal cylinder: authored
        field of view · small box: teaching centre tolerance · blue shell: drawn swept envelope, not
        a clearance test.
      </p>
      <div className={styles.sequenceToolbar}>
        <button
          type="button"
          disabled={!enabled || a.sourceState !== 'ready'}
          onClick={() => (a.busy ? a.stop() : void a.run())}
        >
          {a.busy ? 'Pause orbit' : 'Run the orbit'}
        </button>
        <span>
          {a.frames.length} / {inputs.projectionCount} projections
        </span>
      </div>
      <div className={styles.scoutPair}>
        {a.scouts.map((copy) => (
          <Snapshot key={copy.angle} copy={copy} scout inputs={inputs} />
        ))}
      </div>
      <div className={styles.filmstrip}>
        {a.frames.map((copy, i) => (
          <Snapshot key={i} copy={copy} />
        ))}
      </div>
      {a.failed && (
        <p role="status">
          Projection sequence unavailable. The geometry and lab readouts remain available.
        </p>
      )}
      {a.complete && (
        <>
          <p>
            Original CT standing in for a reconstructed volume. These slices were not reconstructed
            from the orbit.
          </p>
          <div className={styles.mprGrid}>
            {(['Axial', 'Coronal', 'Sagittal'] as const).map((plane) => (
              <MPR key={plane} plane={plane} position={0} tip={[0, 0, 0]} slab={false} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
