'use client'

import { ArrowDownToLine, ArrowUpFromLine, Hand, Pause } from 'lucide-react'

import { cn } from '@/lib/cn'

export type DisplayRespiratoryPhase =
  | 'patient-inspiration'
  | 'assisted-inspiration'
  | 'delivered-inspiration'
  | 'pause'
  | 'passive-expiration'

const phaseOrder: readonly DisplayRespiratoryPhase[] = [
  'patient-inspiration',
  'assisted-inspiration',
  'delivered-inspiration',
  'pause',
  'passive-expiration',
]

const icons = {
  'patient-inspiration': ArrowDownToLine,
  'assisted-inspiration': Hand,
  'delivered-inspiration': ArrowDownToLine,
  pause: Pause,
  'passive-expiration': ArrowUpFromLine,
} satisfies Record<DisplayRespiratoryPhase, typeof Pause>

export function RespiratoryPhaseIndicator({
  activePhase,
  labels,
  title,
  visiblePhases,
}: {
  activePhase?: DisplayRespiratoryPhase
  labels: Record<DisplayRespiratoryPhase, string>
  title: string
  visiblePhases: readonly DisplayRespiratoryPhase[]
}) {
  const phases = phaseOrder.filter((phase) => visiblePhases.includes(phase))

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3" aria-label={title}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {title}
      </p>
      <ol
        className="mt-2 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}
      >
        {phases.map((phase, index) => {
          const Icon = icons[phase]
          const active = activePhase === phase
          return (
            <li
              key={phase}
              className={cn(
                'relative rounded-lg border px-2 py-2 text-center text-[10px] leading-4',
                active
                  ? 'border-cyan-300/55 bg-cyan-400/15 text-cyan-50'
                  : 'border-slate-700 bg-slate-900/70 text-slate-400',
              )}
              aria-current={active ? 'step' : undefined}
            >
              <Icon className="mx-auto h-3.5 w-3.5" aria-hidden />
              <span className="mt-1 block">{labels[phase]}</span>
              {index < phases.length - 1 ? (
                <span
                  className="absolute -right-1.5 top-1/2 z-10 h-px w-3 bg-slate-500"
                  aria-hidden
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
