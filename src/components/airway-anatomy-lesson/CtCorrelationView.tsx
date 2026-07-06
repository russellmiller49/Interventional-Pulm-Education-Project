'use client'

import { useEffect, useState } from 'react'

import {
  loadCtCorrelation,
  type CtCorrelationData,
} from '@/lib/airway-anatomy-lesson/ct-correlation'
import { cn } from '@/lib/cn'

type Plane = 'axial' | 'coronal'

interface CtCorrelationViewProps {
  /** Lesson node id to show the correlated CT for. */
  focusNodeId: string
  className?: string
}

/**
 * Shows where the structure the scope is looking at sits on the patient's CT.
 * Axial and coronal slices are pre-rendered from the case-001 volume with a
 * crosshair on the airway (see lib/airway-anatomy-lesson/ct-correlation), so a
 * new learner can tie "what the scope sees" to "where it is in the chest."
 */
export function CtCorrelationView({ focusNodeId, className }: CtCorrelationViewProps) {
  const [data, setData] = useState<CtCorrelationData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [plane, setPlane] = useState<Plane>('axial')

  useEffect(() => {
    let active = true
    loadCtCorrelation()
      .then((d) => {
        if (!active) return
        setData(d)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (!active) return
        console.error('CT correlation failed to load', err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  const structure = data?.structures[focusNodeId]
  const windowLabel = data?.meta.window.label ?? 'Lung'

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          CT correlation
        </span>
        <div className="flex gap-0.5 rounded-lg border border-border/70 bg-card/60 p-0.5">
          {(['axial', 'coronal'] as Plane[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlane(p)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium capitalize transition-colors',
                plane === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/70 bg-slate-950">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">
            Loading CT…
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/60">
            CT correlation unavailable.
          </div>
        )}
        {status === 'ready' && structure && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${focusNodeId}-${plane}`}
            src={plane === 'axial' ? structure.axial : structure.coronal}
            alt={`${plane === 'axial' ? 'Axial' : 'Coronal'} CT slice at the ${focusNodeId} with the airway marked`}
            className="absolute inset-0 h-full w-full object-contain"
            loading="lazy"
            draggable={false}
          />
        )}
        {status === 'ready' && !structure && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/60">
            No CT correlation for this structure.
          </div>
        )}

        {status === 'ready' && structure && (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-slate-200">
            {plane === 'axial' ? 'Axial' : 'Coronal'} · {windowLabel} window
          </span>
        )}
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground">
        The crosshair marks this airway on the patient&apos;s CT.{' '}
        {plane === 'axial'
          ? 'Anterior is up; the patient’s right is on the left of the image.'
          : 'Superior is up; the patient’s right is on the left of the image.'}
      </p>
    </div>
  )
}
