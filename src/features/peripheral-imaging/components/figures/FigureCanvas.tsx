'use client'

import { useEffect, useRef } from 'react'

import { CT_CONVENTION, polarityPixels, useFluoroPolarity } from '../../lib/displayPolarity'

import styles from './figures.module.css'

/**
 * One computed image. The pixels are fixed data for the figure; the canvas only shows them. It is
 * scaled by CSS to its column, with smoothing, so a phone shows the whole image rather than a crop.
 *
 * A fluoroscopic image is drawn in the display polarity the learner has chosen (bone dark by
 * default), the same setting the suite's monitor reads; CT and reconstructed planes are not.
 */
export function FigureCanvas({
  pixels,
  size,
  label,
  overlay,
  fluoroscopic = false,
}: {
  readonly pixels: Uint8ClampedArray | null
  readonly size: number
  /** What the image shows, for a screen reader. */
  readonly label: string
  /** An SVG drawn over the image in the image's own pixel coordinates. */
  readonly overlay?: React.ReactNode
  /** A projection from `lib/ctProjection.ts`, shown in the fluoroscopy display polarity. */
  readonly fluoroscopic?: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const chosen = useFluoroPolarity()
  const polarity = fluoroscopic ? chosen : CT_CONVENTION
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context || !pixels) return
    context.putImageData(new ImageData(polarityPixels(pixels, polarity), size, size), 0, 0)
  }, [pixels, size, polarity])
  return (
    <div
      className={styles.canvasFrame}
      data-figure-canvas={pixels ? 'drawn' : 'empty'}
      data-display-polarity={fluoroscopic ? polarity : undefined}
    >
      <canvas ref={canvas} width={size} height={size} role="img" aria-label={label} />
      {overlay ? (
        <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className={styles.canvasOverlay}>
          {overlay}
        </svg>
      ) : null}
    </div>
  )
}
