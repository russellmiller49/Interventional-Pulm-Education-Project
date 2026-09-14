'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DrrTextureSource, type ProjectionState, type DrrPose } from './drrTextureSource'
import type { Point3 } from '../../lib/physics'
import { ProjectionOverlays } from './ProjectionOverlays'
import type { ImagingSuitePaneProps } from './types'
import styles from './suite-scene.module.css'

export interface StoredProjection {
  image: string
  overlay: ReactNode
  mask: ReactNode
  displayMask: ReactNode
  zoom: number
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
  acquisitionField = 100,
  displayMask,
  viewMemory,
  captureEnabled = true,
  frameContext,
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
  acquisitionField?: number
  displayMask?: ReactNode
  viewMemory?: ImagingSuitePaneProps['viewMemory']
  captureEnabled?: boolean
  frameContext?: Record<string, unknown>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<DrrTextureSource | null>(null)
  const [state, setState] = useState<ProjectionState>('loading')
  const [baseline, setBaseline] = useState<StoredProjection | null>(
    viewMemory?.current.baseline ?? null,
  )
  const label = `Orbit ${pose.orbit}° · tilt ${pose.tilt}° · acquired field ${acquisitionField}% · exposure: not modeled`
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
      displayMask,
      zoom,
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
    const unsubscribe = source.subscribe(() => setState(source.state))
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
      {comparison && (
        <div className={styles.toolbar}>
          <button
            type="button"
            disabled={!captureEnabled || state !== 'ready'}
            onClick={captureBaseline}
          >
            Save baseline image
          </button>
          <span>Freeze this image, then change one control.</span>
        </div>
      )}
      {comparison && baseline && (
        <figure data-baseline-image data-acquisition-id={baseline.id}>
          <figcaption>Baseline acquisition A · {baseline.label}</figcaption>
          <div className={styles.monitor} role="img" aria-label="Saved baseline projection">
            <div className={styles.monitorImage} style={{ transform: `scale(${baseline.zoom})` }}>
              {/* A local canvas capture, retained with its own overlay and acquisition state. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={baseline.image} alt="" />
              {baseline.overlay}
              {baseline.mask}
            </div>
            {baseline.displayMask}
          </div>
        </figure>
      )}
      <figure data-current-image>
        {comparison && <figcaption>Current simulated projection · {label}</figcaption>}
        <div
          className={styles.monitor}
          data-projection-state={state}
          hidden={hidden}
          role="img"
          aria-label="CT-derived teaching projection with authored target and tool"
        >
          <div
            className={styles.monitorImage}
            style={{ transform: `scale(${zoom})` }}
            data-monitor-zoom={zoom}
          >
            <canvas ref={canvas} aria-hidden="true" />
            {currentOverlay}
            {mask}
          </div>
          {displayMask}
          {state !== 'ready' && (
            <p className={styles.imageStatus} role="status">
              {state === 'failed'
                ? 'CT rendering unavailable. Image-based work cannot be completed. Reload to retry; teaching text remains available.'
                : 'Preparing the CT projection…'}
            </p>
          )}
        </div>
      </figure>
    </div>
  )
}
