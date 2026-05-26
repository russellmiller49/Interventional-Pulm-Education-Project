'use client'

import { useMemo, useState } from 'react'

import { TriangleOfSafety } from './TriangleOfSafety'
import {
  classifyBleedingRisk,
  intercostalVesselRisk,
  type AnticoagulantStatus,
  type AntiplateletStatus,
  type EntryPosition,
} from '../engine/safety'
import { predictDrainageCurve, type LungExpansionArchetype } from '../engine/manometry'

export function ThoracentesisPlanner() {
  const [inr, setInr] = useState(1.2)
  const [platelets, setPlatelets] = useState(150000)
  const [antiplatelet, setAntiplatelet] = useState<AntiplateletStatus>('none')
  const [anticoagulant, setAnticoagulant] = useState<AnticoagulantStatus>('none')
  const [entryPosition, setEntryPosition] = useState<EntryPosition>('lateral-safe')
  const [archetype, setArchetype] = useState<LungExpansionArchetype>('expandable')
  const [drainedMl, setDrainedMl] = useState(500)

  const bleedingRisk = useMemo(
    () => classifyBleedingRisk({ inr, platelets, antiplatelet, anticoagulant }),
    [anticoagulant, antiplatelet, inr, platelets],
  )
  const vesselRisk = intercostalVesselRisk(entryPosition)
  const drainage = predictDrainageCurve(archetype, drainedMl)

  return (
    <section className="container grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Triangle of safety</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Inline SVG teaching diagram: pectoralis major, latissimus dorsi, axilla, diaphragm, rib
            spaces, and the lateral target window are rendered as text-described shapes, so no
            static asset manifest entry is needed.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background p-3">
            <TriangleOfSafety />
          </div>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Intercostal vessel risk</h2>
          <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Entry position</legend>
            {(
              [
                ['posterior-medial', 'Posterior / medial'],
                ['mid-axillary', 'Mid-axillary'],
                ['lateral-safe', 'Lateral window'],
                ['too-low', 'Too low'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={entryPosition === id}
                onClick={() => setEntryPosition(id)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
              >
                {label}
              </button>
            ))}
          </fieldset>
          <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm leading-6">
            <p className="font-semibold text-foreground">
              {vesselRisk.label}: {vesselRisk.level} modeled risk
            </p>
            <p className="mt-1 text-muted-foreground">{vesselRisk.teachingPoint}</p>
          </div>
        </article>

        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Manometry drainage trainer</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Lung expansion archetype
              <select
                value={archetype}
                onChange={(event) => setArchetype(event.target.value as LungExpansionArchetype)}
                className="min-h-11 rounded-lg border border-input bg-background px-3"
              >
                <option value="expandable">Expandable</option>
                <option value="partiallyExpandable">Partially expandable</option>
                <option value="trapped">Trapped lung</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Drained volume: {drainedMl} mL
              <input
                type="range"
                min={0}
                max={1800}
                step={50}
                value={drainedMl}
                onChange={(event) => setDrainedMl(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-sky-600"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label="Pleural pressure" value={`${drainage.pressureCmH2O} cm H2O`} />
            <Metric
              label="Symptoms"
              value={drainage.symptomTriggers.join(', ') || 'None modeled'}
            />
            <Metric label="RPE risk" value={drainage.reExpansionEdemaRisk} />
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{drainage.teachingPoint}</p>
        </article>
      </div>

      <aside className="h-fit rounded-lg border border-border/80 bg-card p-5 shadow-sm xl:sticky xl:top-20">
        <h2 className="text-xl font-semibold text-foreground">Bleeding-risk frame</h2>
        <div className="mt-4 grid gap-4">
          <Range label="INR" value={inr} min={0.9} max={4} step={0.1} onChange={setInr} />
          <Range
            label="Platelets"
            value={platelets}
            min={5000}
            max={250000}
            step={5000}
            suffix="/uL"
            onChange={setPlatelets}
          />
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Antiplatelet therapy
            <select
              value={antiplatelet}
              onChange={(event) => setAntiplatelet(event.target.value as AntiplateletStatus)}
              className="min-h-11 rounded-lg border border-input bg-background px-3"
            >
              <option value="none">None</option>
              <option value="single">Single agent</option>
              <option value="dual">Dual therapy</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Anticoagulant
            <select
              value={anticoagulant}
              onChange={(event) => setAnticoagulant(event.target.value as AnticoagulantStatus)}
              className="min-h-11 rounded-lg border border-input bg-background px-3"
            >
              <option value="none">None</option>
              <option value="held">Held per plan</option>
              <option value="active">Active therapeutic dosing</option>
            </select>
          </label>
        </div>
        <div className="mt-5 rounded-lg border border-border bg-background p-4 text-sm leading-6">
          <p className="font-semibold capitalize text-foreground">
            {bleedingRisk.level} risk frame
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {bleedingRisk.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-3 text-muted-foreground">{bleedingRisk.teachingPoint}</p>
        </div>
      </aside>
    </section>
  )
}

function Range({
  label,
  max,
  min,
  onChange,
  step,
  suffix,
  value,
}: {
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  suffix?: string
  value: number
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}: {value.toLocaleString()}
      {suffix ?? ''}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-sky-600"
      />
    </label>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
