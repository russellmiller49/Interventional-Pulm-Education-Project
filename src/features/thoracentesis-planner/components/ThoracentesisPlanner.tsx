'use client'

import { useMemo, useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { predictDrainageCurve, type LungExpansionArchetype } from '../engine/manometry'
import {
  classifyBleedingRisk,
  intercostalVesselRisk,
  type AnticoagulantStatus,
  type AntiplateletStatus,
  type EntryPosition,
} from '../engine/safety'
import { TriangleOfSafety } from './TriangleOfSafety'

type DrainagePrediction = 'gradual' | 'biphasic' | 'earlyNegativePressure'

const predictionOptions: { id: DrainagePrediction; label: string; description: string }[] = [
  {
    id: 'gradual',
    label: 'Gradual pressure decline',
    description: 'Drainage is tolerated until higher volumes or symptoms appear.',
  },
  {
    id: 'biphasic',
    label: 'Late steep pressure drop',
    description: 'Early drainage looks reasonable, then pressure falls faster.',
  },
  {
    id: 'earlyNegativePressure',
    label: 'Early negative-pressure warning',
    description: 'Symptoms and marked pressure drop can appear with small volumes.',
  },
]

const expectedPrediction: Record<LungExpansionArchetype, DrainagePrediction> = {
  expandable: 'gradual',
  partiallyExpandable: 'biphasic',
  trapped: 'earlyNegativePressure',
}

const symptomLabels = {
  chestPressure: 'chest pressure',
  cough: 'cough',
  throatTickle: 'throat tickle',
  pleuriticPain: 'pleuritic pain',
} as const

export function ThoracentesisPlanner() {
  const [inr, setInr] = useState(1.2)
  const [platelets, setPlatelets] = useState(150000)
  const [antiplatelet, setAntiplatelet] = useState<AntiplateletStatus>('none')
  const [anticoagulant, setAnticoagulant] = useState<AnticoagulantStatus>('none')
  const [entryPosition, setEntryPosition] = useState<EntryPosition>('lateral-safe')
  const [archetype, setArchetype] = useState<LungExpansionArchetype>('expandable')
  const [drainedMl, setDrainedMl] = useState(500)
  const [prediction, setPrediction] = useState<DrainagePrediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const bleedingRisk = useMemo(
    () => classifyBleedingRisk({ inr, platelets, antiplatelet, anticoagulant }),
    [anticoagulant, antiplatelet, inr, platelets],
  )
  const vesselRisk = intercostalVesselRisk(entryPosition)
  const drainage = predictDrainageCurve(archetype, drainedMl)
  const predictedCorrectly = prediction === expectedPrediction[archetype]

  function changeArchetype(next: LungExpansionArchetype) {
    setArchetype(next)
    setPrediction(null)
    setRevealed(false)
  }

  function changeDrainedMl(next: number) {
    setDrainedMl(next)
    setRevealed(false)
  }

  return (
    <LessonScaffold
      title="Thoracentesis safety and drainage behavior"
      objectives={[
        'Map a safer lateral access window and avoid common anatomy pitfalls.',
        'Use bleeding-risk inputs as prompts for planning rather than a single cutoff rule.',
        'Predict how drainage pressure and symptoms change with expandable or non-expandable lung.',
      ]}
      howToUse={[
        'Review the access diagram and choose the needle path you want to test.',
        'Adjust the bleeding-risk and drainage controls for the case.',
        'Predict the drainage behavior before revealing the manometry teaching point.',
      ]}
      clinicalAnchor={
        <p>
          A patient with a symptomatic unilateral effusion is being prepared for ultrasound-guided
          thoracentesis. The team must choose a safe window, review bleeding risk, and decide when
          drainage should slow or stop.
        </p>
      }
      reveal={
        <div
          className={
            predictedCorrectly
              ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
              : 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-900 dark:text-amber-100'
          }
        >
          <h3 className="font-semibold">
            {predictedCorrectly ? 'Prediction matches the curve' : 'Compare your prediction'}
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label="Pleural pressure" value={`${drainage.pressureCmH2O} cm H2O`} />
            <Metric
              label="Symptoms"
              value={
                drainage.symptomTriggers.length
                  ? drainage.symptomTriggers.map((trigger) => symptomLabels[trigger]).join(', ')
                  : 'No symptoms triggered'
              }
            />
            <Metric
              label="Re-expansion pulmonary edema risk"
              value={drainage.reExpansionEdemaRisk}
            />
          </div>
          <p className="mt-4">{drainage.teachingPoint}</p>
          <p className="mt-2 font-medium">
            Stop or slow drainage when symptoms, very negative pressure, or rapid large-volume
            removal raises concern.
          </p>
        </div>
      }
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      canReveal={prediction !== null}
      revealLabel="Reveal drainage verdict"
      keyTakeaway={
        <p>
          Ultrasound confirms where to enter; ongoing symptoms and pressure behavior decide how
          drainage proceeds. Bleeding decisions still require indication, urgency, medication
          timing, and local policy.
        </p>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">Triangle of safety</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Use the diagram to rehearse the lateral window bounded by pectoralis major, latissimus
              dorsi, the axilla, rib spaces, and the diaphragm.
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background p-3">
              <TriangleOfSafety />
            </div>
          </article>

          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">Intercostal vessel risk</h3>
            <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Entry position</legend>
              {(
                [
                  ['posterior-medial', 'Posterior or medial'],
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
                {vesselRisk.label}: {vesselRisk.level} teaching risk
              </p>
              <p className="mt-1 text-muted-foreground">{vesselRisk.teachingPoint}</p>
            </div>
          </article>

          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">Manometry drainage trainer</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Expected lung expansion pattern
                <select
                  value={archetype}
                  onChange={(event) =>
                    changeArchetype(event.target.value as LungExpansionArchetype)
                  }
                  className="min-h-11 rounded-lg border border-input bg-background px-3"
                >
                  <option value="expandable">Expandable</option>
                  <option value="partiallyExpandable">Partially expandable</option>
                  <option value="trapped">Trapped or non-expandable</option>
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
                  onChange={(event) => changeDrainedMl(Number(event.target.value))}
                  className="h-2 w-full cursor-pointer accent-sky-600"
                />
              </label>
            </div>

            <fieldset className="mt-5 grid gap-2">
              <legend className="text-sm font-semibold text-foreground">
                Predict the drainage behavior
              </legend>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {predictionOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={prediction === option.id}
                    disabled={revealed}
                    onClick={() => setPrediction(option.id)}
                    className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
                  >
                    <span className="block text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </article>
        </div>

        <aside className="h-fit rounded-lg border border-border/80 bg-card p-5 shadow-sm xl:sticky xl:top-20">
          <h3 className="text-xl font-semibold text-foreground">Bleeding risk</h3>
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
            <p className="font-semibold capitalize text-foreground">{bleedingRisk.level} risk</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {bleedingRisk.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-3 text-muted-foreground">{bleedingRisk.teachingPoint}</p>
          </div>
        </aside>
      </div>
    </LessonScaffold>
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
