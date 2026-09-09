'use client'

import { useEffect, useRef, useState } from 'react'
import { DrrTextureSource, type ProjectionState, type DrrPose } from './drrTextureSource'
import { ProjectionOverlays } from './ProjectionOverlays'
import styles from './suite-scene.module.css'

export function Monitor({
  pose,
  depth,
  onSource,
  hidden = false,
  showCurrent = true,
}: {
  pose: DrrPose
  depth: number
  onSource: (source: DrrTextureSource | null) => void
  hidden?: boolean
  showCurrent?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<DrrTextureSource | null>(null)
  const [state, setState] = useState<ProjectionState>('loading')
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
  return (
    <div
      className={styles.monitor}
      data-projection-state={state}
      hidden={hidden}
      role="img"
      aria-label="CT-derived teaching projection with authored target and tool"
    >
      <canvas ref={canvas} aria-hidden="true" />
      <ProjectionOverlays
        orbit={pose.orbit}
        tilt={pose.tilt}
        depth={depth}
        geometry={pose.geometry}
        showCurrent={showCurrent}
      />
      {state !== 'ready' && (
        <p className={styles.imageStatus} role="status">
          {state === 'failed'
            ? 'CT rendering unavailable. Use the scene and text readouts.'
            : 'Preparing the CT projection…'}
        </p>
      )}
    </div>
  )
}
