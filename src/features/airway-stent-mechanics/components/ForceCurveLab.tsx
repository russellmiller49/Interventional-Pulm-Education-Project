'use client'

import { useMemo, useState } from 'react'

import { getStentArchitecturePreset } from '@/features/airway-stent-mechanics/content/stentProfiles'
import { createRelativeForceCurve } from '@/features/airway-stent-mechanics/engine/mechanics'
import type { MechanicsInputs } from '@/features/airway-stent-mechanics/engine/types'

interface ForceCurveLabProps {
  inputs: MechanicsInputs
}

const chart = {
  width: 760,
  height: 330,
  left: 70,
  right: 28,
  top: 32,
  bottom: 58,
}

function toPath(points: Array<{ diameterPercent: number; value: number }>, maximum: number) {
  const innerWidth = chart.width - chart.left - chart.right
  const innerHeight = chart.height - chart.top - chart.bottom
  return points
    .map((point, index) => {
      const x = chart.left + ((100 - point.diameterPercent) / 50) * innerWidth
      const y = chart.top + (1 - point.value / maximum) * innerHeight
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export function ForceCurveLab({ inputs }: ForceCurveLabProps) {
  const [compressionPercent, setCompressionPercent] = useState(25)
  const preset = getStentArchitecturePreset(inputs.architectureId)
  const curve = useMemo(
    () => createRelativeForceCurve(preset, inputs.structureScale),
    [inputs.structureScale, preset],
  )
  const maximum = Math.max(100, ...curve.map((point) => point.compressionResistance))
  const compressionPath = toPath(
    curve.map((point) => ({
      diameterPercent: point.diameterPercent,
      value: point.compressionResistance,
    })),
    maximum,
  )
  const expansionPath = toPath(
    curve.map((point) => ({
      diameterPercent: point.diameterPercent,
      value: point.chronicOutwardForce,
    })),
    maximum,
  )
  const selected = curve[Math.round(compressionPercent / 5)]
  const innerWidth = chart.width - chart.left - chart.right
  const selectedX = chart.left + (compressionPercent / 50) * innerWidth
  const selectedCompressionY =
    chart.top +
    (1 - selected.compressionResistance / maximum) * (chart.height - chart.top - chart.bottom)
  const selectedExpansionY =
    chart.top +
    (1 - selected.chronicOutwardForce / maximum) * (chart.height - chart.top - chart.bottom)

  return (
    <div className="grid gap-6 rounded-3xl border border-border/80 bg-card p-5 shadow-sm lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] md:p-7">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
              Relative loading–unloading model
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-foreground">Radial force is a curve</h3>
          </div>
          <span className="rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
            {preset.shortLabel}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Compress the same architecture and compare the loading path (radial resistive force) with
          the unloading path (chronic outward force). The gap is hysteresis. Values are normalized
          educational units because the source does not provide calibrated curves for arbitrary
          slider combinations.
        </p>

        <div className="mt-5 overflow-x-auto">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="min-w-[620px]"
            role="img"
            aria-labelledby="force-curve-title force-curve-description"
          >
            <title id="force-curve-title">Relative compression and expansion force curves</title>
            <desc id="force-curve-description">
              At {compressionPercent}% diameter reduction, compression resistance is{' '}
              {selected.compressionResistance} relative units and chronic outward force is{' '}
              {selected.chronicOutwardForce} relative units. The difference represents hysteresis.
            </desc>
            <rect
              x={chart.left}
              y={chart.top}
              width={chart.width - chart.left - chart.right}
              height={chart.height - chart.top - chart.bottom}
              rx="14"
              className="fill-muted/40 stroke-border"
            />
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = chart.top + (1 - tick / 100) * (chart.height - chart.top - chart.bottom)
              return (
                <g key={tick}>
                  <line
                    x1={chart.left}
                    x2={chart.width - chart.right}
                    y1={y}
                    y2={y}
                    className="stroke-border/70"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={chart.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[12px]"
                  >
                    {tick}
                  </text>
                </g>
              )
            })}
            {[0, 10, 20, 30, 40, 50].map((tick) => {
              const x = chart.left + (tick / 50) * (chart.width - chart.left - chart.right)
              return (
                <g key={tick}>
                  <line
                    x1={x}
                    x2={x}
                    y1={chart.top}
                    y2={chart.height - chart.bottom}
                    className="stroke-border/60"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={x}
                    y={chart.height - chart.bottom + 24}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[12px]"
                  >
                    {tick}%
                  </text>
                </g>
              )
            })}
            <path d={compressionPath} fill="none" stroke="#ef4444" strokeWidth="4" />
            <path d={expansionPath} fill="none" stroke="#0f8b8d" strokeWidth="4" />
            <line
              x1={selectedX}
              x2={selectedX}
              y1={chart.top}
              y2={chart.height - chart.bottom}
              stroke="#64748b"
              strokeWidth="2"
              strokeDasharray="7 5"
            />
            <circle cx={selectedX} cy={selectedCompressionY} r="7" fill="#ef4444" />
            <circle cx={selectedX} cy={selectedExpansionY} r="7" fill="#0f8b8d" />
            <line
              x1={selectedX}
              x2={selectedX}
              y1={selectedCompressionY}
              y2={selectedExpansionY}
              stroke="#8b5cf6"
              strokeWidth="5"
              opacity="0.75"
            />
            <text
              x={(chart.left + chart.width - chart.right) / 2}
              y={chart.height - 10}
              textAnchor="middle"
              className="fill-foreground text-[13px] font-semibold"
            >
              Diameter reduction from free diameter
            </text>
            <text
              transform={`translate(18 ${(chart.top + chart.height - chart.bottom) / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-foreground text-[13px] font-semibold"
            >
              Relative force index
            </text>
            <g transform={`translate(${chart.left + 18} ${chart.top + 18})`}>
              <line x1="0" x2="28" y1="0" y2="0" stroke="#ef4444" strokeWidth="4" />
              <text x="38" y="4" className="fill-foreground text-[12px]">
                Loading: compression resistance (RRF)
              </text>
              <line x1="0" x2="28" y1="24" y2="24" stroke="#0f8b8d" strokeWidth="4" />
              <text x="38" y="28" className="fill-foreground text-[12px]">
                Unloading: chronic outward force (COF)
              </text>
            </g>
          </svg>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border bg-muted/30 p-5">
        <label className="block">
          <span className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
            Diameter reduction
            <output>{compressionPercent}%</output>
          </span>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={compressionPercent}
            onChange={(event) => setCompressionPercent(Number(event.target.value))}
            className="mt-3 w-full accent-sky-600"
          />
        </label>

        <dl className="grid gap-3 text-sm">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
            <dt className="font-semibold text-red-700 dark:text-red-300">Compression resistance</dt>
            <dd className="mt-1 text-2xl font-semibold text-foreground">
              {selected.compressionResistance}
              <span className="ml-1 text-xs font-normal text-muted-foreground">relative units</span>
            </dd>
          </div>
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
            <dt className="font-semibold text-teal-700 dark:text-teal-300">
              Chronic outward force
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-foreground">
              {selected.chronicOutwardForce}
              <span className="ml-1 text-xs font-normal text-muted-foreground">relative units</span>
            </dd>
          </div>
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
            <dt className="font-semibold text-violet-700 dark:text-violet-300">Hysteresis gap</dt>
            <dd className="mt-1 text-2xl font-semibold text-foreground">
              {(selected.compressionResistance - selected.chronicOutwardForce).toFixed(1)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">relative units</span>
            </dd>
          </div>
        </dl>

        <p className="text-xs leading-5 text-muted-foreground">
          A reported value is uninterpretable without diameter, path, fixture, length, temperature,
          rate, orientation, and deformation endpoint.
        </p>
      </div>
    </div>
  )
}
