'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'

import type { ResolvedBModeFrame } from '../providers/types'
import type {
  SelectedStructure,
  ThoracicProbeState,
  ThoracicStructureLabel,
  ThoracicStructureLabelDef,
  ThoracicVolume,
} from '../types'
import { sampleLabel } from '../engine/sampleVolume'
import { sectorImageToWorld } from '../engine/sectorGeometry'
import { probeContactDepthMm } from '../engine/simulateBMode'
import { HandoffContent } from '@/i18n/handoff'

interface BModeFramePanelProps {
  frame: ResolvedBModeFrame | null
  depthCm: number
  title?: string
  /** True when geometry metrics are being computed for the current pose. */
  metricsActive?: boolean
  /** Runtime volume + pose + structure list enable in-image identification. */
  volume?: ThoracicVolume | null
  probe?: ThoracicProbeState
  structures?: ThoracicStructureLabelDef[]
  /** Structure selected in either view; labeled here when it is in the plane. */
  selected?: SelectedStructure | null
  onIdentify?: (selection: SelectedStructure | null) => void
}

/**
 * 2D image panel. Displays whatever the frame-provider stack resolved: a
 * reviewed cached image, a quality-gated browser render, or the neutral
 * placeholder. It never renders synthetic imagery on its own initiative. When a
 * live render and the runtime volume are available, hovering the image reads
 * back the structure under the cursor and clicking selects it (shared with 3D).
 */
export function BModeFramePanel({
  frame,
  depthCm,
  title = 'B-mode',
  metricsActive = false,
  volume,
  probe,
  structures,
  selected = null,
  onIdentify,
}: BModeFramePanelProps) {
  const identifiable = Boolean(frame?.imageData && volume && probe && structures)

  // The renderer crops the air standoff before the fan; the pixel->world inverse
  // must add it back so identification lines up with what is drawn.
  const contactDepthMm = useMemo(
    () => (volume && probe ? probeContactDepthMm(volume, probe) : 0),
    [volume, probe],
  )

  const selectedInView = useMemo(() => {
    if (!selected || !volume || !probe || !frame?.imageData) {
      return false
    }
    const { width, height } = frame.imageData
    // Coarse sweep of the sector: does the selected label appear in this plane?
    for (let gy = 0; gy < 24; gy += 1) {
      for (let gx = 0; gx < 20; gx += 1) {
        const world = sectorImageToWorld(
          probe,
          width,
          height,
          ((gx + 0.5) / 20) * width,
          ((gy + 0.5) / 24) * height,
          contactDepthMm,
        )
        if (world && sampleLabel(volume, world) === selected.label) {
          return true
        }
      }
    }
    return false
  }, [selected, volume, probe, frame, contactDepthMm])

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
            ) : frame?.imageData && identifiable ? (
              <InteractiveBModeCanvas
                imageData={frame.imageData}
                probe={probe as ThoracicProbeState}
                volume={volume as ThoracicVolume}
                structures={structures as ThoracicStructureLabelDef[]}
                contactDepthMm={contactDepthMm}
                selected={selected}
                onIdentify={onIdentify}
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
          {selected ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-sky-500/10 px-4 py-2 text-xs text-sky-100">
              <span>
                Identified: <strong>{selected.displayName}</strong>
                {identifiable ? (
                  <span className="text-sky-300/80">
                    {selectedInView ? ' — in this plane' : ' — not in this plane'}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onIdentify?.(null)}
                className="rounded border border-sky-400/40 px-2 py-0.5 text-sky-100 hover:bg-sky-500/20"
              >
                Clear
              </button>
            </div>
          ) : null}
          <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-300">
            {frame && frame.kind !== 'placeholder' ? (
              <>
                <p className="font-semibold text-slate-100">{frame.sourceLabel}</p>
                {identifiable ? (
                  <p className="mt-1 text-slate-400">
                    Hover the image to name a structure; click it to highlight it in 3D.
                  </p>
                ) : frame.educationalUse ? (
                  <p className="mt-1">{frame.educationalUse}</p>
                ) : null}
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

function structureNameForLabel(
  label: ThoracicStructureLabel,
  structures: ThoracicStructureLabelDef[],
): string | null {
  if (label === 'background') {
    return null
  }
  return structures.find((structure) => structure.label === label)?.displayName ?? null
}

interface InteractiveBModeCanvasProps {
  imageData: ImageData
  probe: ThoracicProbeState
  volume: ThoracicVolume
  structures: ThoracicStructureLabelDef[]
  contactDepthMm: number
  selected: SelectedStructure | null
  onIdentify?: (selection: SelectedStructure | null) => void
}

function InteractiveBModeCanvas({
  imageData,
  probe,
  volume,
  structures,
  contactDepthMm,
  onIdentify,
}: InteractiveBModeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hover, setHover] = useState<{ x: number; y: number; name: string } | null>(null)

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

  // object-contain letterboxes the intrinsic canvas inside its box, so recover
  // the fitted scale and offset before mapping a client point to image pixels.
  function identifyAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) {
      return null
    }
    const rect = canvas.getBoundingClientRect()
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height)
    if (scale <= 0) {
      return null
    }
    const offsetX = (rect.width - canvas.width * scale) / 2
    const offsetY = (rect.height - canvas.height * scale) / 2
    const imageX = (clientX - rect.left - offsetX) / scale
    const imageY = (clientY - rect.top - offsetY) / scale

    const world = sectorImageToWorld(
      probe,
      canvas.width,
      canvas.height,
      imageX,
      imageY,
      contactDepthMm,
    )
    if (!world) {
      return null
    }
    const label = sampleLabel(volume, world)
    const name = structureNameForLabel(label, structures)
    return name ? { label, displayName: name } : null
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        aria-label="Live synthetic B-mode render (educational simulation). Hover to identify structures."
        className="aspect-[5/6] w-full cursor-crosshair rounded bg-black object-contain"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const hit = identifyAt(event.clientX, event.clientY)
          setHover(
            hit
              ? { x: event.clientX - rect.left, y: event.clientY - rect.top, name: hit.displayName }
              : null,
          )
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          const hit = identifyAt(event.clientX, event.clientY)
          onIdentify?.(hit)
        }}
      />
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-slate-900/90 px-2 py-0.5 text-xs text-slate-100 ring-1 ring-white/10"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          {hover.name}
        </div>
      ) : null}
    </div>
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
