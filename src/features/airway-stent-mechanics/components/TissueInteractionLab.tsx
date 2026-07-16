'use client'

import { useMemo, useState } from 'react'

import { cn } from '@/lib/cn'

type ContactPattern = 'wall' | 'struts' | 'studs' | 'flare'

const patterns: Array<{
  id: ContactPattern
  label: string
  areaFactor: number
  description: string
  implication: string
}> = [
  {
    id: 'wall',
    label: 'Continuous wall / cover',
    areaFactor: 1,
    description: 'Distributed circumferential contact',
    implication:
      'Lower peak concentration for the same total normal load, but secretion transport and end loading remain.',
  },
  {
    id: 'struts',
    label: 'Exposed struts',
    areaFactor: 0.42,
    description: 'Load concentrated along narrow wire paths',
    implication:
      'Higher local pressure and ingrowth apertures; the exact result depends on cell geometry and apposition.',
  },
  {
    id: 'studs',
    label: 'Studs / posts',
    areaFactor: 0.24,
    description: 'Point-like anchoring contacts',
    implication:
      'Anchoring can rise without whole-body force, but mucosal indentation and focal granulation become more likely.',
  },
  {
    id: 'flare',
    label: 'Flared end',
    areaFactor: 0.18,
    description: 'High contact at a short end transition',
    implication:
      'Strong migration resistance at the cost of end hyperplasia, erosion, branch obstruction, and retrieval force.',
  },
]

export function TissueInteractionLab() {
  const [patternId, setPatternId] = useState<ContactPattern>('wall')
  const [totalLoad, setTotalLoad] = useState(55)
  const pattern = patterns.find((candidate) => candidate.id === patternId) ?? patterns[0]
  const localConcentration = Math.round(Math.min(100, (totalLoad / pattern.areaFactor) * 0.62))
  const glowOpacity = 0.12 + localConcentration / 130
  const contacts = useMemo(() => {
    if (patternId === 'wall') return Array.from({ length: 22 }, (_, index) => index)
    if (patternId === 'struts') return Array.from({ length: 11 }, (_, index) => index * 2)
    if (patternId === 'studs') return [1, 6, 11, 16, 21]
    return [0, 1, 20, 21]
  }, [patternId])

  return (
    <div className="grid gap-6 rounded-3xl border border-border/80 bg-card p-5 shadow-sm lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:p-7">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
            Equal force, unequal interface
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-foreground">Contact distribution lab</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Hold the modeled total normal load constant, then change where it reaches the airway.
            This isolates why total radial force and peak tissue stress are not synonymous.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {patterns.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setPatternId(candidate.id)}
              aria-pressed={candidate.id === patternId}
              className={cn(
                'rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                candidate.id === patternId
                  ? 'border-rose-500/50 bg-rose-500/10'
                  : 'border-border bg-background hover:border-rose-500/30',
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{candidate.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {candidate.description}
              </span>
            </button>
          ))}
        </div>

        <label className="block rounded-2xl border bg-muted/30 p-4">
          <span className="flex justify-between gap-3 text-sm font-semibold text-foreground">
            Relative total contact load
            <output>{totalLoad}</output>
          </span>
          <input
            type="range"
            min={25}
            max={90}
            value={totalLoad}
            onChange={(event) => setTotalLoad(Number(event.target.value))}
            className="mt-3 w-full accent-rose-600"
          />
        </label>
      </div>

      <div className="rounded-2xl border bg-slate-950 p-5 text-white">
        <svg
          viewBox="0 0 720 320"
          className="w-full"
          role="img"
          aria-labelledby="tissue-contact-title tissue-contact-description"
        >
          <title id="tissue-contact-title">Airway stent contact distribution</title>
          <desc id="tissue-contact-description">
            {pattern.label} with total load {totalLoad} produces a relative local concentration
            index of {localConcentration} in this conceptual model.
          </desc>
          <defs>
            <linearGradient id="tissue-wall" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#f7c1af" />
              <stop offset="1" stopColor="#c97973" />
            </linearGradient>
          </defs>
          <rect
            x="34"
            y="50"
            width="652"
            height="220"
            rx="88"
            fill="url(#tissue-wall)"
            opacity="0.92"
          />
          <rect x="70" y="88" width="580" height="144" rx="62" fill="#071425" />
          <rect
            x="95"
            y="116"
            width="530"
            height="88"
            rx="40"
            fill="#102943"
            stroke="#67e8f9"
            strokeWidth="4"
            opacity="0.9"
          />
          {contacts.map((contact) => {
            const x = 106 + (contact / 21) * 508
            const isEnd = patternId === 'flare' && (contact <= 1 || contact >= 20)
            const width = patternId === 'wall' ? 24 : isEnd ? 18 : patternId === 'studs' ? 10 : 8
            const height = patternId === 'wall' ? 72 : isEnd ? 112 : patternId === 'studs' ? 24 : 82
            const y = 160 - height / 2
            return (
              <g key={contact}>
                <rect
                  x={x - width * 1.3}
                  y={y - 8}
                  width={width * 2.6}
                  height={height + 16}
                  rx={width}
                  fill="#ef4444"
                  opacity={glowOpacity}
                  className="motion-safe:animate-pulse"
                />
                <rect
                  x={x - width / 2}
                  y={y}
                  width={width}
                  height={height}
                  rx={width / 2}
                  fill="#e2e8f0"
                />
              </g>
            )
          })}
          <text x="360" y="30" textAnchor="middle" fill="#e2e8f0" fontSize="18" fontWeight="700">
            Tissue-facing contact pattern
          </text>
          <text x="360" y="302" textAnchor="middle" fill="#94a3b8" fontSize="15">
            Same total load · different effective contact area · different local concentration
          </text>
        </svg>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total load index</p>
            <p className="mt-1 text-3xl font-semibold">{totalLoad}</p>
          </div>
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
            <p className="text-xs uppercase tracking-wide text-rose-200">
              Local concentration index
            </p>
            <p className="mt-1 text-3xl font-semibold">{localConcentration}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-300">{pattern.implication}</p>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Index is deliberately unitless. It demonstrates a relationship, not a mucosal injury
          threshold.
        </p>
      </div>
    </div>
  )
}
