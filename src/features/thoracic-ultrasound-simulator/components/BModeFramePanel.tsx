'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'

import type { ResolvedBModeFrame } from '../providers/types'
import { HandoffContent } from '@/i18n/handoff'

interface BModeFramePanelProps {
  frame: ResolvedBModeFrame | null
  depthCm: number
  title?: string
  /** True when geometry metrics are being computed for the current pose. */
  metricsActive?: boolean
}

/**
 * 2D image panel. Displays whatever the frame-provider stack resolved: a
 * reviewed cached image, a quality-gated browser render, or the neutral
 * placeholder. It never renders synthetic imagery on its own initiative.
 */
export function BModeFramePanel({
  frame,
  depthCm,
  title = 'B-mode',
  metricsActive = false,
}: BModeFramePanelProps) {
  return (
    <HandoffContent>
      {
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-black shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
            <span>{title}</span>
            <span>{depthCm.toFixed(1)} cm</span>
          </div>
          <div className="relative bg-black p-3">
            {frame?.imageUrl ? (
              <Image
                src={frame.imageUrl}
                alt={`${frame.entry?.label ?? frame.sourceLabel}: synthetic teaching frame.`}
                width={520}
                height={620}
                priority
                unoptimized
                className="aspect-[5/6] w-full rounded bg-black object-contain"
              />
            ) : frame?.imageData ? (
              <ImageDataCanvas imageData={frame.imageData} />
            ) : (
              <FramePlaceholder depthCm={depthCm} metricsActive={metricsActive} />
            )}
            {frame?.imageData ? null : (
              // Live renders draw their own centimetre ticks; this overlay
              // ruler is only for cached frames and the placeholder.
              <div className="pointer-events-none absolute right-4 top-12 flex h-[calc(100%-4.5rem)] flex-col justify-between text-[10px] font-medium text-slate-400">
                <span>0</span>
                <span>{(depthCm / 2).toFixed(0)}</span>
                <span>{depthCm.toFixed(0)} cm</span>
              </div>
            )}
          </div>
          <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-300">
            {frame && frame.kind !== 'placeholder' ? (
              <>
                <p className="font-semibold text-slate-100">{frame.sourceLabel}</p>
                {frame.educationalUse ? <p className="mt-1">{frame.educationalUse}</p> : null}
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-100">No image at this pose</p>
                <p className="mt-1">
                  Geometry scoring is still active, but no frame could be produced for this pose on
                  this device.
                </p>
              </>
            )}
          </div>
        </div>
      }
    </HandoffContent>
  )
}

function ImageDataCanvas({ imageData }: { imageData: ImageData }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      return
    }
    canvas.width = imageData.width
    canvas.height = imageData.height
    context.putImageData(imageData, 0, 0)
  }, [imageData])

  return (
    <canvas
      ref={canvasRef}
      aria-label="Live synthetic B-mode render (educational simulation)"
      className="aspect-[5/6] w-full rounded bg-black object-contain"
    />
  )
}

function FramePlaceholder({ depthCm, metricsActive }: { depthCm: number; metricsActive: boolean }) {
  return (
    <HandoffContent>
      {
        <div
          aria-label="No image is available for this probe pose"
          className="relative aspect-[5/6] w-full rounded bg-black"
          role="img"
        >
          <svg className="h-full w-full" viewBox="0 0 520 620">
            <defs>
              <radialGradient id="thoracic-placeholder-sector" cx="50%" cy="18%" r="82%">
                <stop offset="0%" stopColor="#1f2937" stopOpacity="0.64" />
                <stop offset="58%" stopColor="#0f172a" stopOpacity="0.44" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.2" />
              </radialGradient>
              <clipPath id="thoracic-placeholder-clip">
                <path d="M260 44 C146 136, 76 338, 54 590 L466 590 C444 338, 374 136, 260 44 Z" />
              </clipPath>
            </defs>
            <rect width="520" height="620" fill="#000" />
            <g clipPath="url(#thoracic-placeholder-clip)">
              <rect width="520" height="620" fill="url(#thoracic-placeholder-sector)" />
              {Array.from({ length: 18 }, (_, index) => {
                const y = 96 + index * 25
                const opacity = Math.max(0.04, 0.16 - index * 0.004)
                return (
                  <path
                    d={`M ${128 - index * 2} ${y} C 210 ${y + 8}, 310 ${y - 8}, ${392 + index * 2} ${y}`}
                    fill="none"
                    key={index}
                    opacity={opacity}
                    stroke="#94a3b8"
                    strokeWidth={index % 4 === 0 ? 1.4 : 0.8}
                  />
                )
              })}
            </g>
            <path
              d="M260 44 C146 136, 76 338, 54 590 L466 590 C444 338, 374 136, 260 44 Z"
              fill="none"
              stroke="#334155"
              strokeWidth="2"
            />
            <text
              fill="#cbd5e1"
              fontSize="18"
              fontWeight="700"
              letterSpacing="0"
              opacity="0.86"
              textAnchor="middle"
              x="260"
              y="288"
            >
              No image at this pose
            </text>
            <text
              fill="#94a3b8"
              fontSize="13"
              fontWeight="500"
              letterSpacing="0"
              opacity="0.86"
              textAnchor="middle"
              x="260"
              y="316"
            >
              {metricsActive
                ? 'Geometry scoring is active'
                : 'Adjust the probe to image the target'}
            </text>
            <text
              fill="#64748b"
              fontSize="11"
              fontWeight="600"
              letterSpacing="0"
              opacity="0.8"
              textAnchor="middle"
              x="260"
              y="586"
            >
              {depthCm.toFixed(0)} cm
            </text>
          </svg>
        </div>
      }
    </HandoffContent>
  )
}
