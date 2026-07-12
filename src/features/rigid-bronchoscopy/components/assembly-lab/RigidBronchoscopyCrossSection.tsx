'use client'

import { useId } from 'react'

interface RigidBronchoscopyCrossSectionProps {
  airwayDiameterMm: number
  airwayLabel: string
  commonScaleLabel: string
  eyebrow: string
  instrumentDiameterMm?: number
  instrumentLabel?: string
  residualAreaLabel: string
  safetyNote: string
  telescopeDiameterMm?: number
  telescopeLabel?: string
  title: string
  tubeInnerDiameterMm: number
  tubeLabel: string
  tubeOuterDiameterMm: number
}

const SIZE = 220
const CENTER = SIZE / 2
const MAX_RADIUS = 92

function circleAreaMm2(diameterMm: number) {
  return Math.PI * (diameterMm / 2) ** 2
}

function formatArea(value: number) {
  return value.toFixed(1)
}

export function RigidBronchoscopyCrossSection({
  airwayDiameterMm,
  airwayLabel,
  commonScaleLabel,
  eyebrow,
  instrumentDiameterMm = 0,
  instrumentLabel,
  residualAreaLabel,
  safetyNote,
  telescopeDiameterMm = 5.5,
  telescopeLabel = '5.5 mm telescope',
  title,
  tubeInnerDiameterMm,
  tubeLabel,
  tubeOuterDiameterMm,
}: RigidBronchoscopyCrossSectionProps) {
  const descriptionId = useId()
  const scale = MAX_RADIUS / Math.max(airwayDiameterMm / 2, tubeOuterDiameterMm / 2, 1)
  const airwayRadius = (airwayDiameterMm / 2) * scale
  const tubeOuterRadius = (tubeOuterDiameterMm / 2) * scale
  const tubeInnerRadius = (tubeInnerDiameterMm / 2) * scale
  const telescopeRadius = (telescopeDiameterMm / 2) * scale
  const instrumentRadius = (instrumentDiameterMm / 2) * scale
  const usedArea = circleAreaMm2(telescopeDiameterMm) + circleAreaMm2(instrumentDiameterMm)
  const residualArea = Math.max(circleAreaMm2(tubeInnerDiameterMm) - usedArea, 0)
  const instrumentOffset = instrumentDiameterMm
    ? Math.min(tubeInnerRadius - instrumentRadius - 2, telescopeRadius + instrumentRadius + 4)
    : 0

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
        </div>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
          {commonScaleLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr] sm:items-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-labelledby={descriptionId}
          className="mx-auto h-auto w-full max-w-[220px]"
        >
          <title id={descriptionId}>
            {`${airwayDiameterMm.toFixed(1)} millimeter airway containing ${tubeLabel}, ${telescopeLabel}${instrumentLabel ? `, and ${instrumentLabel}` : ''}.`}
          </title>
          <circle
            cx={CENTER}
            cy={CENTER}
            r={airwayRadius}
            fill="#7f1d1d"
            fillOpacity="0.24"
            stroke="#fda4af"
            strokeWidth="4"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={tubeOuterRadius}
            fill="#cbd5e1"
            stroke="#f8fafc"
            strokeWidth="2"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={tubeInnerRadius}
            fill="#082f49"
            stroke="#67e8f9"
            strokeWidth="2"
          />
          <circle
            cx={CENTER - (instrumentDiameterMm ? instrumentOffset / 2 : 0)}
            cy={CENTER}
            r={telescopeRadius}
            fill="#fde68a"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          {instrumentDiameterMm ? (
            <circle
              cx={CENTER + instrumentOffset}
              cy={CENTER}
              r={instrumentRadius}
              fill="#f9a8d4"
              stroke="#ec4899"
              strokeWidth="2"
            />
          ) : null}
        </svg>

        <dl className="grid gap-2 text-xs leading-5 text-slate-300">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/80 px-3 py-2">
            <dt>{airwayLabel}</dt>
            <dd className="font-semibold text-rose-200">{airwayDiameterMm.toFixed(1)} mm</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/80 px-3 py-2">
            <dt>{tubeLabel}</dt>
            <dd className="font-semibold text-slate-100">
              {tubeOuterDiameterMm.toFixed(1)}/{tubeInnerDiameterMm.toFixed(1)} mm
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/80 px-3 py-2">
            <dt>{telescopeLabel}</dt>
            <dd className="font-semibold text-amber-200">{telescopeDiameterMm.toFixed(1)} mm</dd>
          </div>
          {instrumentDiameterMm && instrumentLabel ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/80 px-3 py-2">
              <dt>{instrumentLabel}</dt>
              <dd className="font-semibold text-pink-200">{instrumentDiameterMm.toFixed(1)} mm</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300/20 bg-emerald-400/8 px-3 py-2">
            <dt>{residualAreaLabel}</dt>
            <dd className="font-semibold text-emerald-200">{formatArea(residualArea)} mm²</dd>
          </div>
        </dl>
      </div>

      <p className="mt-3 text-[11px] leading-4 text-slate-400">{safetyNote}</p>
    </section>
  )
}
