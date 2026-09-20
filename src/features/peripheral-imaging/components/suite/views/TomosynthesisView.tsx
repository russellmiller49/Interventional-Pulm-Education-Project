'use client'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Line } from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'
import {
  DTS,
  dtsPixel,
  loadDtsProjections,
  reconstructTeachingPlane,
} from '../../../lib/tomosynthesis'
import { sampleAnatomy } from '../../../lib/anatomy'
import { LESION_CENTER, radians, type Point3 } from '../../../lib/physics'
import { add, chainStopAnchors, scale, suiteFrame } from '../suiteModel'
import {
  DTS_PLANE,
  dtsArc,
  dtsOverlayObjects,
  dtsPlaneQuad,
  missingWedge,
  smearWidth,
} from '../dtsModel'
import { Quad } from '../SceneGeometry'
import { useCtVolumeState } from '../CtSliceImages'
import type { SuiteInputs, SuiteViewSpec } from '../types'
import styles from '../suite-scene.module.css'

export function useTomosynthesis(
  view: SuiteViewSpec,
  inputs: SuiteInputs,
  enabled: boolean,
  visible: boolean,
  reducedMotion: boolean,
) {
  const active = view.mode === 'dts' || view.mode === 'dts-prior'
  const [data, setData] = useState<Uint8ClampedArray | null>(null)
  const [failed, setFailed] = useState(false)
  const playbackKey = `${inputs.sweepDeg}:${view.mode}:${enabled}:${reducedMotion}`
  const defaultCount =
    !enabled || reducedMotion || view.mode === 'dts-prior' ? DTS.viewsPerSweep : 0
  const [playback, setPlayback] = useState<{ key: string; count: number; playing: boolean | null }>(
    { key: playbackKey, count: defaultCount, playing: null },
  )
  const { count, playing } =
    playback.key === playbackKey ? playback : { count: defaultCount, playing: null }
  const [layer, setLayer] = useState<SuiteInputs['priorLayer'] | null>(null)
  const elapsed = useRef(0)
  const { volume, failed: priorFailed } = useCtVolumeState(active && view.mode === 'dts-prior')
  useEffect(() => {
    if (!active) return
    let current = true
    void loadDtsProjections()
      .then((p) => {
        if (current) setData(p)
      })
      .catch(() => {
        if (current) setFailed(true)
      })
    return () => {
      current = false
    }
  }, [active])
  const running =
    active &&
    Boolean(data) &&
    enabled &&
    visible &&
    !reducedMotion &&
    (playing ?? view.animation?.autoplay ?? false) &&
    (count < DTS.viewsPerSweep || view.animation?.loop === true)
  const tick = useCallback(
    (delta: number) => {
      if (!running) return
      elapsed.current += Math.min(delta, 1 / 30)
      if (elapsed.current < 0.12) return
      elapsed.current = 0
      setPlayback({ key: playbackKey, count: count >= DTS.viewsPerSweep ? 0 : count + 1, playing })
    },
    [running, count, playbackKey, playing],
  )
  const selectedLayer = layer ?? inputs.priorLayer
  const images = useMemo(() => {
    if (!active || !data || !DTS.sweeps.includes(inputs.sweepDeg)) return null
    if (selectedLayer !== 'measured' && !volume) return null
    const measured = reconstructTeachingPlane(data, inputs.sweepDeg, inputs.planeDepth)
    const pixels = new Uint8ClampedArray(measured)
    if (selectedLayer !== 'measured' && volume) {
      for (let row = 0; row < 256; row++)
        for (let col = 0; col < 256; col++) {
          const point = add(LESION_CENTER, [
            -20 + (col / 256 - 0.5) * 140,
            inputs.planeDepth,
            (0.5 - row / 256) * 140,
          ])
          const gray = Math.max(
            0,
            Math.min(255, ((sampleAnatomy(volume, point) + 1350) / 1500) * 255),
          )
          const i = (row * 256 + col) * 4,
            alpha = selectedLayer === 'prior' ? 1 : 0.5
          for (let c = 0; c < 3; c++)
            pixels[i + c] = measured[i + c] * (1 - alpha) + gray * [0.25, 0.92, 0.85][c] * alpha
        }
    }
    const plane = document.createElement('canvas')
    plane.width = plane.height = 256
    plane.getContext('2d')!.putImageData(new ImageData(pixels, 256, 256), 0, 0)
    const projections = dtsArc(inputs.sweepDeg, inputs.geometry).map((sample, i) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = DTS.tileSize
      const ctx = canvas.getContext('2d')!,
        image = ctx.createImageData(DTS.tileSize, DTS.tileSize)
      for (let y = 0; y < DTS.tileSize; y++)
        for (let x = 0; x < DTS.tileSize; x++) {
          const gray = Math.max(
            0,
            Math.min(
              255,
              (dtsPixel(data, inputs.sweepDeg, i, x, DTS.tileSize - 1 - y) - 128) * 1.4 + 95,
            ),
          )
          const p = (y * DTS.tileSize + x) * 4
          image.data[p] = image.data[p + 1] = image.data[p + 2] = gray
          image.data[p + 3] = 255
        }
      ctx.putImageData(image, 0, 0)
      return { ...sample, canvas }
    })
    return { plane, projections }
  }, [active, data, inputs.sweepDeg, inputs.planeDepth, inputs.geometry, selectedLayer, volume])
  const step = () => {
    setPlayback({
      key: playbackKey,
      count: count >= DTS.viewsPerSweep ? 1 : count + 1,
      playing: false,
    })
  }
  const play = () => {
    setPlayback({
      key: playbackKey,
      count: count >= DTS.viewsPerSweep ? 0 : count,
      playing: !running,
    })
  }
  return {
    active,
    images,
    selectedLayer,
    setLayer,
    count,
    running,
    tick,
    step,
    play,
    failed,
    priorReady: Boolean(volume),
    priorFailed,
    reset: () => {
      elapsed.current = 0
      setPlayback({ key: playbackKey, count: defaultCount, playing: null })
      setLayer(null)
    },
    angle: dtsArc(inputs.sweepDeg)[Math.max(0, count - 1)]?.angle ?? 0,
  }
}
export type Tomosynthesis = ReturnType<typeof useTomosynthesis>
function ImageQuad({ canvas, points }: { canvas: HTMLCanvasElement; points: readonly Point3[] }) {
  const texture = useMemo(() => {
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [canvas])
  useEffect(() => () => texture.dispose(), [texture])
  return <Quad points={points} color="#ffffff" texture={texture} />
}
export function TomosynthesisView({
  model,
  inputs,
  prior,
}: {
  model: Tomosynthesis
  inputs: SuiteInputs
  prior: boolean
}) {
  const arc = dtsArc(inputs.sweepDeg, inputs.geometry)
  const consoleAnchor = chainStopAnchors(suiteFrame(0)).reconstruction
  const focalPlane = prior
    ? [
        [-100, -100],
        [100, -100],
        [100, 100],
        [-100, 100],
      ].map(([x, y]) => add(consoleAnchor, [x, y + 100, 30]))
    : dtsPlaneQuad(inputs.planeDepth)
  return (
    <group>
      {!prior && (
        <>
          <Line points={arc.map((p) => p.source)} color="#81ccbc" lineWidth={2} />
          {missingWedge(inputs.sweepDeg).map(([start, end], i) => (
            <Line
              key={i}
              points={Array.from({ length: 45 }, (_, j) => {
                const a = radians(start + ((end - start) * j) / 44)
                return add(suiteFrame((a * 180) / Math.PI, 0, inputs.geometry).source, [0, 0, -120])
              })}
              color="#698392"
              dashed
              dashSize={20}
              gapSize={14}
            />
          ))}
          {model.images?.projections.slice(0, model.count).map((p, i) => {
            const frame = suiteFrame(p.angle, 0, inputs.geometry),
              center = add(scale(p.source, 0.8), [0, 0, -130])
            return (
              <ImageQuad
                key={i}
                canvas={p.canvas}
                points={[
                  [-34, -34],
                  [34, -34],
                  [34, 34],
                  [-34, 34],
                ].map(([u, v]) => add(center, add(scale(frame.u, u), [0, 0, v])))}
              />
            )
          })}
          {[0, DTS.toolPlaneRelativeMm].map((depth, i) => {
            const width = smearWidth(depth, inputs.planeDepth, inputs.sweepDeg)
            const center = add(LESION_CENTER, [i ? -20 : 0, inputs.planeDepth - 1, i ? 18 : 0])
            return (
              <Line
                key={depth}
                points={[add(center, [-width / 2, 0, 0]), add(center, [width / 2, 0, 0])]}
                color={i ? '#e7f6f2' : '#e9b66e'}
                lineWidth={5}
              />
            )
          })}
        </>
      )}
      {model.images && <ImageQuad canvas={model.images.plane} points={focalPlane} />}
    </group>
  )
}
function CanvasCopy({ source, label }: { source: HTMLCanvasElement; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    canvas.current?.getContext('2d')?.drawImage(source, 0, 0)
  }, [source])
  return (
    <canvas
      ref={canvas}
      width={source.width}
      height={source.height}
      role="img"
      aria-label={label}
    />
  )
}
/**
 * Report 4.2: an optional teaching overlay on the reconstructed plane. Off by default, so the image
 * is read unmarked first and the raw pixels are always one click away; the canvas underneath is
 * never drawn on. It marks where the model placed the tool and the target — never what was found —
 * and an object the selected plane does not pass through gets a dotted guide and its distance, not
 * an outline.
 */
export function TomosynthesisMonitor({
  model,
  planeDepth,
  allowOverlay = true,
}: {
  model: Tomosynthesis
  planeDepth: number
  /** A check reads the image unaided: marking which plane holds the tool would answer it. */
  allowOverlay?: boolean
}) {
  const failed = model.failed || (model.selectedLayer !== 'measured' && model.priorFailed)
  const state = failed ? 'failed' : model.images ? 'ready' : 'loading'
  const [overlay, setOverlay] = useState(false)
  const toggleId = useId()
  // The planning CT was acquired before the tool was placed; there is no tool in it to point at.
  const objects = dtsOverlayObjects(planeDepth).filter(
    (object) => object.id !== 'tool' || model.selectedLayer !== 'prior',
  )
  const mm = (value: number) => `${Math.abs(value).toFixed(0)} mm`
  return (
    <>
      <div
        className={styles.monitor}
        data-dts-state={state}
        data-projection-state={state}
        data-image-provenance={model.selectedLayer}
        data-dts-overlay={allowOverlay && overlay ? 'shown' : 'hidden'}
      >
        {model.images ? (
          <CanvasCopy
            source={model.images.plane}
            label={
              model.selectedLayer === 'measured'
                ? 'Teaching focal plane from limited-angle projections'
                : model.selectedLayer === 'prior'
                  ? 'Planning CT prior, coloured teal'
                  : 'Teaching focal plane blended with a teal planning CT prior'
            }
          />
        ) : (
          <p className={styles.imageStatus}>
            {' '}
            {failed ? 'Teaching image unavailable.' : 'Preparing the teaching plane…'}{' '}
          </p>
        )}
        {allowOverlay && overlay && model.images && (
          <svg
            viewBox={`0 0 ${DTS_PLANE.sizePx} ${DTS_PLANE.sizePx}`}
            role="img"
            aria-label="Teaching overlay of the modeled tool and target positions"
            data-dts-overlay-marks
          >
            {objects.map((object) => {
              const { x, y, w, h } = object.box
              const pad = 5
              const colour = object.id === 'tool' ? '#9be7da' : '#f0c27d'
              const labelY = object.id === 'tool' ? y - pad - 5 : y + h + pad + 11
              return (
                <g
                  key={object.id}
                  data-dts-mark={object.id}
                  data-in-plane={object.inPlane ? 'true' : 'false'}
                >
                  {/* Drawn around the object, never over it, so its pixels stay readable. */}
                  <rect
                    x={x - pad}
                    y={y - pad}
                    width={w + pad * 2}
                    height={h + pad * 2}
                    rx={object.id === 'target' ? (w + pad * 2) / 2 : 3}
                    fill="none"
                    stroke={colour}
                    strokeWidth={object.inPlane ? 1.4 : 1}
                    strokeDasharray={object.inPlane ? undefined : '2 4'}
                    opacity={object.inPlane ? 1 : 0.75}
                  />
                  <text
                    x={object.id === 'tool' ? x - pad : x + w / 2}
                    y={labelY}
                    textAnchor={object.id === 'tool' ? 'start' : 'middle'}
                    fontSize="8.5"
                    fill={colour}
                    stroke="#05070c"
                    strokeWidth="2.2"
                    paintOrder="stroke"
                  >
                    {object.inPlane
                      ? `${object.label} · in this plane`
                      : `${object.label} · ${mm(object.fromPlaneMm)} from this plane`}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
      {allowOverlay && (
        <div className={styles.overlayToggle}>
          <label htmlFor={toggleId}>
            <input
              id={toggleId}
              type="checkbox"
              checked={overlay}
              disabled={!model.images}
              onChange={(event) => setOverlay(event.target.checked)}
              data-dts-overlay-toggle
            />
            Show where the model placed the tool and the target
          </label>
          {overlay && (
            <p data-dts-overlay-note>
              A teaching overlay drawn from the model’s authored coordinates, not something detected
              in this image. A solid outline means the selected plane passes through that object; a
              dotted one marks an object that lies off this plane, where the image can show only its
              blur.
              {model.selectedLayer === 'prior'
                ? ' The planning CT was acquired before the tool was placed, so no tool is marked on it.'
                : ''}{' '}
              Clear the box to read the image unmarked.
            </p>
          )}
        </div>
      )}
    </>
  )
}
/**
 * Report 4.3 (fellow walkthrough, PDF p.34): the thirteen projections are about 65 px wide, too
 * small to see the tool move against the anatomy from one end of the sweep to the other — which is
 * the whole basis of shift-and-add. A thumbnail now opens that same projection enlarged, in place,
 * and Previous/Next step through the sweep so the shift can be watched. The enlarged image is a
 * copy of the thumbnail's own canvas and carries its position in the sweep and its angle, so the
 * two can never name different acquisitions. It is not a modal: Escape or Close returns focus to
 * the thumbnail that opened it.
 */
function ProjectionFilmstrip({ model }: { model: Tomosynthesis }) {
  const frames = model.images?.projections.slice(0, model.count) ?? []
  const [open, setOpen] = useState<number | null>(null)
  const thumbs = useRef(new Map<number, HTMLButtonElement>())
  const selected = open !== null && open < frames.length ? open : null
  const close = () => {
    const index = selected
    setOpen(null)
    if (index !== null) thumbs.current.get(index)?.focus()
  }
  return (
    <>
      {selected !== null && (
        <figure
          className={styles.enlarged}
          data-dts-enlarged={selected}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            close()
          }}
        >
          <CanvasCopy
            key={selected}
            source={frames[selected].canvas}
            label={`Teaching projection ${selected + 1} of ${frames.length} at ${frames[selected].angle} degrees, enlarged`}
          />
          <figcaption>
            Projection {selected + 1} of {frames.length} · {frames[selected].angle}° · the same
            pixels as the thumbnail, enlarged. Step through the sweep and watch the tool shift
            against the anatomy.
          </figcaption>
          <div className={styles.enlargedActions}>
            <button
              type="button"
              disabled={selected === 0}
              onClick={() => setOpen(selected - 1)}
              data-dts-enlarged-previous
            >
              Previous projection
            </button>
            <button
              type="button"
              disabled={selected >= frames.length - 1}
              onClick={() => setOpen(selected + 1)}
              data-dts-enlarged-next
            >
              Next projection
            </button>
            <button type="button" onClick={close} data-dts-enlarged-close>
              Close enlarged view
            </button>
          </div>
        </figure>
      )}
      <div className={styles.filmstrip}>
        {frames.map((p, i) => (
          <figure key={i} className={styles.snapshot} data-dts-frame={i}>
            <button
              type="button"
              className={styles.thumb}
              ref={(node) => {
                if (node) thumbs.current.set(i, node)
                else thumbs.current.delete(i)
              }}
              aria-pressed={selected === i}
              aria-label={`Enlarge teaching projection ${i + 1} of ${frames.length} at ${p.angle} degrees`}
              onClick={() => setOpen(selected === i ? null : i)}
            >
              <CanvasCopy source={p.canvas} label={`Teaching projection at ${p.angle} degrees`} />
            </button>
            <figcaption>{p.angle}°</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
export function TomosynthesisPanels({
  model,
  inputs,
  prior,
  enabled,
}: {
  model: Tomosynthesis
  inputs: SuiteInputs
  prior: boolean
  enabled: boolean
}) {
  return (
    <section className={styles.signalProfile}>
      {model.failed && (
        <p role="status">
          Teaching projections are unavailable; the scene and control values remain available.
        </p>
      )}
      <p>
        {prior
          ? 'The display colour-codes the image source: gray from the thirteen DTS projections, teal from the planning CT.'
          : '13 parallel teaching projections · cone arc for orientation. Dashed arc: unsampled directions. Bars on the focal plane: out-of-plane spreading.'}
      </p>
      {prior && (
        <fieldset disabled={!enabled} className={styles.controls}>
          <legend>Image source</legend>
          {(['measured', 'prior', 'blend'] as const).map((layer) => (
            <button
              type="button"
              key={layer}
              aria-pressed={model.selectedLayer === layer}
              disabled={layer !== 'measured' && !model.priorReady}
              onClick={() => model.setLayer(layer)}
            >
              {layer === 'measured'
                ? 'Acquired projections'
                : layer === 'prior'
                  ? 'Planning CT prior'
                  : 'Blend with prior'}
            </button>
          ))}
          <p>
            Gray: combined measured projections · teal: planning CT contribution. A prior is not
            another current measurement.
          </p>
          {!model.priorReady && (
            <p role="status">
              {model.priorFailed
                ? 'Planning CT prior unavailable; measured projections remain available.'
                : 'Preparing the planning CT prior…'}
            </p>
          )}
        </fieldset>
      )}
      <ProjectionFilmstrip model={model} />
      <p>
        Tool-plane spread:{' '}
        {smearWidth(DTS.toolPlaneRelativeMm, inputs.planeDepth, inputs.sweepDeg).toFixed(1)} mm ·
        target-plane spread: {smearWidth(0, inputs.planeDepth, inputs.sweepDeg).toFixed(1)} mm.
      </p>
    </section>
  )
}
