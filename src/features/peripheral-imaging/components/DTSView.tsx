'use client'
import { useEffect, useRef, useState } from 'react'
import { DTS, dtsPixel, loadDtsProjections, reconstructTeachingPlane } from '../lib/tomosynthesis'
import styles from '../imaging.module.css'

export function DTSImage({ sweep, plane }: { sweep: number; plane: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const views = useRef<(HTMLCanvasElement | null)[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    let cancelled = false
    loadDtsProjections()
      .then((data) => {
        if (cancelled || !canvas.current) return
        canvas.current
          .getContext('2d')
          ?.putImageData(
            new ImageData(reconstructTeachingPlane(data, sweep, plane), 256, 256),
            0,
            0,
          )
        for (let i = 0; i < 3; i++) {
          const ctx = views.current[i]?.getContext('2d')
          if (!ctx) continue
          const image = ctx.createImageData(DTS.tileSize, DTS.tileSize)
          for (let y = 0; y < DTS.tileSize; y++)
            for (let x = 0; x < DTS.tileSize; x++) {
              const value = Math.min(
                255,
                (dtsPixel(data, sweep, i * 6, x, DTS.tileSize - 1 - y) - 128) * 1.4 + 95,
              )
              const p = (y * DTS.tileSize + x) * 4
              image.data[p] = image.data[p + 1] = image.data[p + 2] = value
              image.data[p + 3] = 255
            }
          ctx.putImageData(image, 0, 0)
        }
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('failed')
      })
    return () => {
      cancelled = true
    }
  }, [sweep, plane])
  return (
    <div data-dts-state={status}>
      <div
        className={styles.dtsViews}
        aria-label="First, central and final background-suppressed projections from the selected DTS arc"
      >
        {[-sweep / 2, 0, sweep / 2].map((angle, i) => (
          <figure key={i}>
            <canvas
              ref={(node) => {
                views.current[i] = node
              }}
              width={DTS.tileSize}
              height={DTS.tileSize}
              aria-hidden="true"
            />
            <figcaption>{angle}° projection</figcaption>
          </figure>
        ))}
      </div>
      <div
        className={styles.radiograph}
        role="img"
        aria-label={`CT-derived shift-and-add plane at ${plane} millimeters, from 13 projections over ${sweep} degrees. The target and instrument were added to the teaching volume.`}
      >
        <canvas ref={canvas} width={256} height={256} aria-hidden="true" />
        <div className={styles.imageHeader}>
          <span>Limited-angle plane</span>
          <span>{plane} mm</span>
        </div>
        <div className={styles.imageFooter}>
          CT + authored target / tool · background-suppressed shift-and-add
        </div>
        {status !== 'ready' && (
          <div className={styles.imageStatus}>
            {status === 'loading'
              ? 'Preparing limited-angle projections…'
              : 'Image unavailable. Use the depth controls and explanation.'}
          </div>
        )}
      </div>
    </div>
  )
}
