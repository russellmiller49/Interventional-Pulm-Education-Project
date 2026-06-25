'use client'

import Image from 'next/image'

import type { SimulatedPleuralFrame } from '../engine/simulateBMode'
import type { PleuralFrameAtlasEntry } from '../types'
import { HandoffContent } from '@/i18n/handoff'

interface UltrasoundCanvasProps {
  frame: SimulatedPleuralFrame | null
  atlasFrame?: PleuralFrameAtlasEntry | null
  depthCm: number
}

function atlasSourceLabel(atlasFrame: PleuralFrameAtlasEntry) {
  if (atlasFrame.generator.source === 'plus-offline') return 'PLUS offline atlas'
  if (atlasFrame.generator.source === 'must-inspired-offline') return 'MUST-inspired atlas'
  if (atlasFrame.generator.source === 'browser-raymarcher') return 'Browser-rendered atlas'
  return 'Curated teaching atlas'
}

export function UltrasoundCanvas({ frame, atlasFrame = null, depthCm }: UltrasoundCanvasProps) {
  const hasPrototypeMetrics = Boolean(frame)

  return (
    <HandoffContent>
      {
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-black shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
            <span>Pleural B-mode</span>
            <span>{depthCm.toFixed(1)} cm</span>
          </div>
          <div className="relative bg-black p-3">
            {atlasFrame ? (
              <Image
                src={atlasFrame.imageUrl}
                alt={`${atlasFrame.label}: synthetic pleural ultrasound teaching frame.`}
                width={520}
                height={620}
                priority
                unoptimized
                className="aspect-[5/6] w-full rounded bg-black object-contain"
              />
            ) : (
              <PrototypeFramePlaceholder
                depthCm={depthCm}
                hasPrototypeMetrics={hasPrototypeMetrics}
              />
            )}
            <div className="pointer-events-none absolute right-4 top-12 flex h-[calc(100%-4.5rem)] flex-col justify-between text-[10px] font-medium text-slate-400">
              <span>0</span>
              <span>{(depthCm / 2).toFixed(0)}</span>
              <span>{depthCm.toFixed(0)} cm</span>
            </div>
          </div>
          <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-300">
            {atlasFrame ? (
              <>
                <p className="font-semibold text-slate-100">{atlasSourceLabel(atlasFrame)}</p>
                <p className="mt-1">{atlasFrame.educationalUse}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-100">No reviewed atlas frame</p>
                <p className="mt-1">
                  Geometry scoring is still active, but the unreviewed labelmap render is hidden
                  because it does not look like real pleural ultrasound.
                </p>
              </>
            )}
          </div>
        </div>
      }
    </HandoffContent>
  )
}

function PrototypeFramePlaceholder({
  depthCm,
  hasPrototypeMetrics,
}: {
  depthCm: number
  hasPrototypeMetrics: boolean
}) {
  return (
    <HandoffContent>
      {
        <div
          aria-label="No reviewed pleural ultrasound atlas frame is available for this probe pose"
          className="relative aspect-[5/6] w-full rounded bg-black"
          role="img"
        >
          <svg className="h-full w-full" viewBox="0 0 520 620">
            <defs>
              <radialGradient id="prototype-sector" cx="50%" cy="18%" r="82%">
                <stop offset="0%" stopColor="#1f2937" stopOpacity="0.64" />
                <stop offset="58%" stopColor="#0f172a" stopOpacity="0.44" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0.2" />
              </radialGradient>
              <clipPath id="prototype-sector-clip">
                <path d="M260 44 C146 136, 76 338, 54 590 L466 590 C444 338, 374 136, 260 44 Z" />
              </clipPath>
            </defs>
            <rect width="520" height="620" fill="#000" />
            <g clipPath="url(#prototype-sector-clip)">
              <rect width="520" height="620" fill="url(#prototype-sector)" />
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
              No reviewed frame at this pose
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
              {hasPrototypeMetrics
                ? 'Geometry scoring is active'
                : 'Move back toward a cached window'}
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
