'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { DrrTextureSource, type ProjectionState, type DrrPose } from './drrTextureSource'
import {
  fieldDisplay,
  luminanceOf,
  type FieldDisplay,
  type FieldRect,
} from '../../lib/fieldDisplay'
import type { Point3 } from '../../lib/physics'
import { ProjectionOverlays } from './ProjectionOverlays'
import type { ImagingSuitePaneProps } from './types'
import styles from './suite-scene.module.css'

/**
 * A frozen acquisition: the pixels that were read out, the overlays that describe the geometry they
 * were acquired at, and that acquisition's own metadata.
 *
 * It deliberately carries no display state. Report 2.12 (fellow walkthrough, PDF p.20/p.26) was the
 * consequence of it carrying some: the stored frame kept the electronic crop and the display zoom
 * that happened to be applied when it was captured, so the "Baseline acquisition A" panel and the
 * current panel showed the same cropped picture and the authored comparison showed nothing. An
 * electronic crop and a display zoom are operations on a stored frame, not part of one — which is
 * exactly what this section teaches — so they stay on the current view.
 */
export interface StoredProjection {
  image: string
  overlay: ReactNode
  /** The acquired (collimated) field, which is acquisition, not display. */
  mask: ReactNode
  /**
   * How the acquired field set the displayed image (`lib/fieldDisplay.ts`). It belongs to the
   * acquisition: a stored frame keeps the processing it was read out with.
   */
  processing: FieldDisplay | null
  label: string
  id: string
  state: {
    pose: DrrPose
    depth: number
    acquisitionField: number
    offset?: Point3
    context?: Record<string, unknown>
  }
}

export function Monitor({
  pose,
  depth,
  onSource,
  hidden = false,
  showCurrent = true,
  targetFill = true,
  zoom = 1,
  mask,
  overlay,
  offset,
  comparison = false,
  comparisonHint,
  acquisitionField = 100,
  displayMask,
  viewMemory,
  captureEnabled = true,
  frameContext,
  fieldProcessing,
}: {
  pose: DrrPose
  depth: number
  onSource: (source: DrrTextureSource | null) => void
  hidden?: boolean
  showCurrent?: boolean
  targetFill?: boolean
  zoom?: number
  mask?: ReactNode
  overlay?: ReactNode
  offset?: Point3
  comparison?: boolean
  /** What the baseline is for on this step, printed beside the button that replaces it. */
  comparisonHint?: string
  acquisitionField?: number
  displayMask?: ReactNode
  viewMemory?: ImagingSuitePaneProps['viewMemory']
  captureEnabled?: boolean
  frameContext?: Record<string, unknown>
  /**
   * The collimation section: the collimated field on the image and its share of the open field's
   * area. With it the display range and the scatter veil follow the field.
   */
  fieldProcessing?: { readonly rect: FieldRect; readonly areaFraction: number }
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<DrrTextureSource | null>(null)
  const [state, setState] = useState<ProjectionState>('loading')
  const [revision, setRevision] = useState(0)
  const [processing, setProcessing] = useState<FieldDisplay | null>(null)
  const filterId = useId().replace(/:/g, '')
  const [baseline, setBaseline] = useState<StoredProjection | null>(
    viewMemory?.current.baseline ?? null,
  )
  const fieldLeft = fieldProcessing?.rect.left
  const fieldTop = fieldProcessing?.rect.top
  const fieldSize = fieldProcessing?.rect.size
  const fieldArea = fieldProcessing?.areaFraction
  /** The display mapping for the frame now on the canvas, read from its own pixels. */
  function readProcessing(): FieldDisplay | null {
    if (
      fieldLeft === undefined ||
      fieldTop === undefined ||
      fieldSize === undefined ||
      fieldArea === undefined ||
      engine.current?.state !== 'ready'
    )
      return null
    const size = 96
    const pixels = engine.current.snapshot(size).getContext('2d')?.getImageData(0, 0, size, size)
    if (!pixels) return null
    return fieldDisplay(
      luminanceOf(pixels.data),
      size,
      { left: fieldLeft, top: fieldTop, size: fieldSize },
      fieldArea,
    )
  }
  // Report 2.6: the caption names the angles the way the sliders do ("C-arm obliquity", "Beam
  // tilt"), so one quantity has one name. The values are the same signed model angles.
  const label = `C-arm obliquity ${pose.orbit}° · beam tilt ${pose.tilt}° · field ${acquisitionField}%`
  const currentOverlay = overlay ?? (
    <ProjectionOverlays
      orbit={pose.orbit}
      tilt={pose.tilt}
      depth={depth}
      geometry={pose.geometry}
      offset={offset}
      showCurrent={showCurrent}
      targetFill={targetFill}
    />
  )
  function captureBaseline() {
    if (engine.current?.state !== 'ready') return
    const sequence = (viewMemory?.current.captureSequence ?? 0) + 1
    const saved: StoredProjection = {
      id: `acquisition-${sequence}`,
      state: {
        pose: structuredClone(pose),
        depth,
        acquisitionField,
        context: structuredClone(frameContext),
        offset: offset ? ([...offset] as Point3) : undefined,
      },
      image: engine.current.snapshot().toDataURL(),
      overlay: currentOverlay,
      mask,
      processing: readProcessing(),
      label,
    }
    if (viewMemory) {
      viewMemory.current.baseline = saved
      viewMemory.current.captureSequence = sequence
    }
    setBaseline(saved)
  }
  useEffect(() => {
    const source = new DrrTextureSource(canvas.current!)
    engine.current = source
    const unsubscribe = source.subscribe(() => {
      setState(source.state)
      setRevision(source.revision)
    })
    onSource(source)
    void source.load()
    return () => {
      unsubscribe()
      source.dispose()
      engine.current = null
      onSource(null)
    }
  }, [onSource])
  useEffect(() => {
    engine.current?.update(pose)
  }, [pose])
  useEffect(() => {
    setProcessing(readProcessing())
    // The frame on the canvas (its revision) and the field are the whole input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, state, fieldLeft, fieldTop, fieldSize, fieldArea])
  useEffect(() => {
    if (comparison && state === 'ready' && !baseline) captureBaseline()
    // Freeze the first usable frame once; subsequent display/model changes cannot update it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison, state, baseline])
  return (
    <div
      className={comparison ? styles.comparison : undefined}
      data-image-comparison={comparison ? 'available' : undefined}
      data-has-baseline={comparison && baseline ? 'true' : undefined}
    >
      {/* Owner feedback, 2026-10-11 (slide 4): this asked the learner to freeze a baseline and
          change a control on steps that had no control. It is offered only where the step can change
          the image, and it says what the baseline is. */}
      {comparison && captureEnabled && (
        <div className={styles.toolbar} data-baseline-tools>
          <button type="button" disabled={state !== 'ready'} onClick={captureBaseline}>
            Save baseline image
          </button>
          {comparisonHint ? <span>{comparisonHint}</span> : null}
        </div>
      )}
      {comparison && baseline && (
        <figure data-baseline-image data-acquisition-id={baseline.id}>
          <figcaption>Baseline · {baseline.label}</figcaption>
          <div className={styles.monitor} role="img" aria-label="Saved baseline projection">
            <div className={styles.monitorImage} data-monitor-zoom={1}>
              {/* A local canvas capture, retained with its own overlay and acquisition state. */}
              {baseline.processing && (
                <DisplayFilter id={`${filterId}-baseline`} display={baseline.processing} />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={baseline.image}
                alt=""
                style={baseline.processing ? { filter: `url(#${filterId}-baseline)` } : undefined}
              />
              {baseline.overlay}
              {baseline.mask}
            </div>
          </div>
        </figure>
      )}
      <figure data-current-image data-display-gain={processing?.gain.toFixed(2)}>
        {/* The acquisition context is always stated with the image: a fixed example has no
            sliders to read it from. */}
        <figcaption data-acquisition-context>
          {comparison ? `Current · ${label}` : label}
        </figcaption>
        <div
          className={styles.monitor}
          data-projection-state={state}
          hidden={hidden}
          role="img"
          aria-label="Fluoroscopic projection with the target lesion and the tool"
        >
          <div
            className={styles.monitorImage}
            style={{ transform: `scale(${zoom})` }}
            data-monitor-zoom={zoom}
          >
            {processing && <DisplayFilter id={`${filterId}-current`} display={processing} />}
            <canvas
              ref={canvas}
              aria-hidden="true"
              style={processing ? { filter: `url(#${filterId}-current)` } : undefined}
            />
            {currentOverlay}
            {mask}
          </div>
          {displayMask}
          {state !== 'ready' && (
            <p className={styles.imageStatus} role="status">
              {state === 'failed'
                ? 'The image could not be drawn. Reload to retry; the text remains available.'
                : 'Preparing the projection…'}
            </p>
          )}
        </div>
      </figure>
    </div>
  )
}

/**
 * The display mapping as an SVG filter over the projection. It changes what is shown, never the
 * canvas: the detector texture in the 3D view and every stored pixel stay as acquired.
 */
function DisplayFilter({ id, display }: { id: string; display: FieldDisplay }) {
  const tableValues = display.table.join(' ')
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-display-filter
      style={{ position: 'absolute', width: 0, height: 0 }}
    >
      <filter id={id} colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="table" tableValues={tableValues} />
          <feFuncG type="table" tableValues={tableValues} />
          <feFuncB type="table" tableValues={tableValues} />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}
