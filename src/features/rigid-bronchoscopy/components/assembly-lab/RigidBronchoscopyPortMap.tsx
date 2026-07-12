'use client'

import { Activity, CircleDot, Route, Wind } from 'lucide-react'

import { cn } from '@/lib/cn'

export type DisplayPortId = 'mainAxial' | 'accessory' | 'anesthesiaCircuit' | 'jet'

export interface DisplayPortDefinition {
  description: string
  id: DisplayPortId
  label: string
}

const iconByPort: Record<DisplayPortId, typeof Route> = {
  mainAxial: Route,
  accessory: CircleDot,
  anesthesiaCircuit: Wind,
  jet: Activity,
}

const colorByPort: Record<DisplayPortId, string> = {
  mainAxial: 'border-pink-300/40 bg-pink-400/10 text-pink-100',
  accessory: 'border-violet-300/40 bg-violet-400/10 text-violet-100',
  anesthesiaCircuit: 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100',
  jet: 'border-sky-300/40 bg-sky-400/10 text-sky-100',
}

export function RigidBronchoscopyPortMap({
  activeLabel,
  activePort,
  distinctInterfacesLabel,
  eyebrow,
  ports,
  title,
}: {
  activeLabel: string
  activePort?: DisplayPortId
  distinctInterfacesLabel: string
  eyebrow: string
  ports: readonly DisplayPortDefinition[]
  title: string
}) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
        </div>
        <span className="text-[11px] leading-4 text-slate-400">{distinctInterfacesLabel}</span>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {ports.map((port) => {
          const Icon = iconByPort[port.id]
          const active = activePort === port.id
          return (
            <li
              key={port.id}
              className={cn(
                'rounded-xl border px-3 py-3 transition',
                active ? colorByPort[port.id] : 'border-slate-700 bg-slate-900/70 text-slate-300',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-xs font-semibold">{port.label}</span>
                {active ? (
                  <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    {activeLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 opacity-85">{port.description}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
