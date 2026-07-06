'use client'

import { useEffect, useState } from 'react'
import { Film, Info } from 'lucide-react'

import { getNode, lobeColor } from '@/lib/airway-anatomy-lesson/airway-graph'
import { loadQuizFrames, type QuizFramesData } from '@/lib/airway-anatomy-lesson/airway-quiz'
import { coverageNoteForNode, representativeNodeId } from '@/lib/airway-anatomy-lesson/video-atlas'
import { cn } from '@/lib/cn'

interface AirwayStructureMediaPanelProps {
  nodeId: string | null
  className?: string
}

function toPoints(poly: number[]): string {
  let points = ''
  for (let i = 0; i < poly.length; i += 2) {
    points += `${poly[i]},${poly[i + 1]} `
  }
  return points.trim()
}

export function AirwayStructureMediaPanel({ nodeId, className }: AirwayStructureMediaPanelProps) {
  const [data, setData] = useState<QuizFramesData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    loadQuizFrames()
      .then((frames) => {
        if (!active) return
        setData(frames)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (!active) return
        console.error('airway still frames failed to load', err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  const node = nodeId ? getNode(nodeId) : undefined
  const representative = nodeId ? representativeNodeId(nodeId) : null
  const structure = representative && data ? data.structures[representative] : undefined
  const note = nodeId ? coverageNoteForNode(nodeId) : undefined
  const color = node ? lobeColor(node.lobe) : '#94a3b8'

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Film className="h-3.5 w-3.5" aria-hidden />
            Endoscopic still
          </p>
          {node && <h3 className="text-sm font-semibold text-foreground">{node.fullName}</h3>}
        </div>
        {node && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {node.shortLabel}
          </span>
        )}
      </div>

      <div className="relative aspect-[1368/1080] w-full overflow-hidden rounded-lg border border-border/70 bg-black">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">
            Loading still...
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/60">
            Endoscopic still unavailable.
          </div>
        )}
        {status === 'ready' && structure && data && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={structure.img}
              alt={`Endoscopic still representing ${node?.fullName ?? structure.name}`}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
            {structure.isOrifice ? (
              <svg
                viewBox={`0 0 ${data.meta.width} ${data.meta.height}`}
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                <polygon
                  points={toPoints(structure.poly)}
                  fill="rgba(34,211,238,0.14)"
                  stroke="rgba(2,6,23,0.65)"
                  strokeWidth={9}
                />
                <polygon
                  points={toPoints(structure.poly)}
                  fill="none"
                  stroke={color}
                  strokeWidth={5}
                />
              </svg>
            ) : (
              <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/65 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                Scope is inside this airway
              </span>
            )}
          </>
        )}
        {status === 'ready' && !structure && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/60">
            No bronchoscopy still is available for this branch.
          </div>
        )}
      </div>

      {note && (
        <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
          <span>{note}</span>
        </p>
      )}
    </div>
  )
}
