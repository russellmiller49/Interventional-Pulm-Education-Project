'use client'
import { useEffect, useRef, useState } from 'react'
import { loadAnatomyVolume, sampleAnatomy } from '../../lib/anatomy'
import type { AirwayDrillCase } from '../../lib/airwayDrill'
import { LESION_CENTER, LESION_RADIUS, type Point3 } from '../../lib/physics'

/**
 * The answer on the CT: the axial slice through the nodule, with the catheter tip marked where it
 * lies in that plane. Anterior is up and the patient's left is on the right of the image, as an
 * axial CT is read, so "anterior and medial" can be checked by eye.
 *
 * The tip is usually above or below this slice; the caption says by how much, because a mark on a
 * slice it is not in would otherwise read as a finding.
 */
const SIZE = 280
/** Millimetres across the figure: wide enough to hold the tip, the nodule and the midline. */
const SPAN = 150

export function DrillAxialFigure({ entry }: { readonly entry: AirwayDrillCase }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  // Centred between the midline and the chest wall on the nodule's side, at the nodule's depth.
  const centre: Point3 = [LESION_CENTER[0] - 22, LESION_CENTER[1] - 8, LESION_CENTER[2]]
  const scale = SIZE / SPAN
  const toImage = ([x, y]: readonly number[]) => [
    SIZE / 2 + (x - centre[0]) * scale,
    SIZE / 2 - (y - centre[1]) * scale,
  ]
  useEffect(() => {
    let cancelled = false
    loadAnatomyVolume()
      .then((volume) => {
        const context = canvas.current?.getContext('2d')
        if (cancelled || !context) return
        const image = context.createImageData(SIZE, SIZE)
        for (let row = 0; row < SIZE; row++)
          for (let col = 0; col < SIZE; col++) {
            const hu = sampleAnatomy(volume, [
              centre[0] + (col - SIZE / 2) / scale,
              centre[1] + (SIZE / 2 - row) / scale,
              centre[2],
            ])
            // A lung window: air black, the nodule and the vessels grey, soft tissue white.
            const gray = Math.max(0, Math.min(255, ((hu + 1350) / 1500) * 255))
            const index = (row * SIZE + col) * 4
            image.data[index] = image.data[index + 1] = image.data[index + 2] = gray
            image.data[index + 3] = 255
          }
        context.putImageData(image, 0, 0)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('failed')
      })
    return () => {
      cancelled = true
    }
    // The slice is the nodule's own and never changes; the marks are drawn in the SVG above it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const nodule = toImage(LESION_CENTER)
  const tip = toImage(entry.tip)
  const offSlice = Math.round(Math.abs(entry.superiorMm))
  return (
    <figure className="grid gap-2" data-drill-axial data-ct-state={state}>
      <div
        className="relative overflow-hidden rounded-lg border bg-black"
        style={{ width: '100%', maxWidth: SIZE, aspectRatio: '1 / 1' }}
      >
        <canvas
          ref={canvas}
          width={SIZE}
          height={SIZE}
          aria-hidden="true"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label="Axial CT through the nodule with the catheter tip marked"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <g fontSize="11" fontWeight="600" fill="#e6efe9" stroke="#04141a" strokeWidth="3">
            <text x={SIZE / 2} y="13" textAnchor="middle" paintOrder="stroke">
              Anterior
            </text>
            <text x={SIZE / 2} y={SIZE - 5} textAnchor="middle" paintOrder="stroke">
              Posterior
            </text>
            <text x="5" y={SIZE / 2} paintOrder="stroke">
              Midline
            </text>
            <text x={SIZE - 5} y={SIZE / 2} textAnchor="end" paintOrder="stroke">
              Left
            </text>
          </g>
          <circle
            data-drill-axial-nodule
            cx={nodule[0]}
            cy={nodule[1]}
            r={LESION_RADIUS * scale + 3}
            fill="none"
            stroke="#eec482"
            strokeWidth="2"
          />
          <line
            x1={tip[0]}
            y1={tip[1]}
            x2={nodule[0]}
            y2={nodule[1]}
            stroke="#f5f7f1"
            strokeWidth="1"
            strokeDasharray="3 3"
            strokeOpacity="0.8"
          />
          <circle
            data-drill-axial-tip
            cx={tip[0]}
            cy={tip[1]}
            r="5"
            fill="#f5f7f1"
            stroke="#04141a"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <figcaption className="text-xs leading-5 text-muted-foreground">
        Axial CT through the nodule (amber). White dot: the catheter tip
        {offSlice >= 3
          ? `, which lies ${offSlice} mm ${entry.superiorMm > 0 ? 'below' : 'above'} this slice and is marked where it would fall on it.`
          : ', which lies in this slice.'}
        {state === 'failed' ? ' The CT could not be loaded; the marks are still in place.' : ''}
      </figcaption>
    </figure>
  )
}
