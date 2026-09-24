'use client'

import { useEffect, useRef } from 'react'

import styles from './figures.module.css'

/**
 * One computed image. The pixels are fixed data for the figure; the canvas only shows them. It is
 * scaled by CSS to its column, with smoothing, so a phone shows the whole image rather than a crop.
 */
export function FigureCanvas({
  pixels,
  size,
  label,
  overlay,
}: {
  readonly pixels: Uint8ClampedArray | null
  readonly size: number
  /** What the image shows, for a screen reader. */
  readonly label: string
  /** An SVG drawn over the image in the image's own pixel coordinates. */
  readonly overlay?: React.ReactNode
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context || !pixels) return
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels), size, size), 0, 0)
  }, [pixels, size])
  return (
    <div className={styles.canvasFrame} data-figure-canvas={pixels ? 'drawn' : 'empty'}>
      <canvas ref={canvas} width={size} height={size} role="img" aria-label={label} />
      {overlay ? (
        <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className={styles.canvasOverlay}>
          {overlay}
        </svg>
      ) : null}
    </div>
  )
}
