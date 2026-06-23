'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

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

const PREDICTION_IDS: DrainagePrediction[] = ['gradual', 'biphasic', 'earlyNegativePressure']

const ENTRY_POSITIONS: EntryPosition[] = [
  'posterior-medial',
  'mid-axillary',
  'lateral-safe',
  'too-low',
]

const expectedPrediction: Record<LungExpansionArchetype, DrainagePrediction> = {
  expandable: 'gradual',
  partiallyExpandable: 'biphasic',
  trapped: 'earlyNegativePressure',
}

export function ThoracentesisPlanner() {
  const t = useTranslations('thoracentesisPlanner')

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

  const predictionOptions = PREDICTION_IDS.map((id) => ({
    id,
    label: t(`planner.predictions.${id}.label`),
    description: t(`planner.predictions.${id}.description`),
  }))

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
      title={t('planner.scaffoldTitle')}
      objectives={t.raw('planner.objectives') as string[]}
      howToUse={t.raw('planner.howToUse') as string[]}
      clinicalAnchor={<p>{t('planner.clinicalAnchor')}</p>}
      reveal={
        <div
          className={
            predictedCorrectly
              ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
              : 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-900 dark:text-amber-100'
          }
        >
          <h3 className="font-semibold">
            {predictedCorrectly ? t('planner.matchHeading') : t('planner.compareHeading')}
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric
              label={t('planner.pleuralPressureLabel')}
              value={`${drainage.pressureCmH2O} cm H2O`}
            />
            <Metric
              label={t('planner.symptomsLabel')}
              value={
                drainage.symptomTriggers.length
                  ? drainage.symptomTriggers.map((trigger) => t(`symptom.${trigger}`)).join(', ')
                  : t('planner.noSymptoms')
              }
            />
            <Metric
              label={t('planner.rpeRiskLabel')}
              value={t(`riskLevel.${drainage.reExpansionEdemaRisk}`)}
            />
          </div>
          <p className="mt-4">{t(`drainageTeaching.${archetype}`)}</p>
          <p className="mt-2 font-medium">{t('planner.stopSlow')}</p>
        </div>
      }
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      canReveal={prediction !== null}
      revealLabel={t('planner.revealLabel')}
      keyTakeaway={<p>{t('planner.keyTakeaway')}</p>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">
              {t('planner.triangleHeading')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('planner.triangleBody')}
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background p-3">
              <TriangleOfSafety />
            </div>
          </article>

          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">{t('planner.vesselHeading')}</h3>
            <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">{t('planner.entryLegend')}</legend>
              {ENTRY_POSITIONS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={entryPosition === id}
                  onClick={() => setEntryPosition(id)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
                >
                  {t(`planner.entry.${id}`)}
                </button>
              ))}
            </fieldset>
            <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm leading-6">
              <p className="font-semibold text-foreground">
                {t('planner.vesselRiskLine', {
                  label: t(`vesselRisk.${entryPosition}.label`),
                  level: t(`riskLevel.${vesselRisk.level}`),
                })}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t(`vesselRisk.${entryPosition}.teachingPoint`)}
              </p>
            </div>
          </article>

          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">
              {t('planner.manometryHeading')}
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t('planner.expectedPatternLabel')}
                <select
                  value={archetype}
                  onChange={(event) =>
                    changeArchetype(event.target.value as LungExpansionArchetype)
                  }
                  className="min-h-11 rounded-lg border border-input bg-background px-3"
                >
                  <option value="expandable">{t('planner.archetype.expandable')}</option>
                  <option value="partiallyExpandable">
                    {t('planner.archetype.partiallyExpandable')}
                  </option>
                  <option value="trapped">{t('planner.archetype.trapped')}</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t('planner.drainedVolumeLabel', { ml: drainedMl })}
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
                {t('planner.predictLegend')}
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
          <h3 className="text-xl font-semibold text-foreground">{t('planner.bleedingHeading')}</h3>
          <div className="mt-4 grid gap-4">
            <Range
              label={t('planner.inrLabel')}
              value={inr}
              min={0.9}
              max={4}
              step={0.1}
              onChange={setInr}
            />
            <Range
              label={t('planner.plateletsLabel')}
              value={platelets}
              min={5000}
              max={250000}
              step={5000}
              suffix="/uL"
              onChange={setPlatelets}
            />
            <label className="grid gap-2 text-sm font-medium text-foreground">
              {t('planner.antiplateletLabel')}
              <select
                value={antiplatelet}
                onChange={(event) => setAntiplatelet(event.target.value as AntiplateletStatus)}
                className="min-h-11 rounded-lg border border-input bg-background px-3"
              >
                <option value="none">{t('planner.antiplatelet.none')}</option>
                <option value="single">{t('planner.antiplatelet.single')}</option>
                <option value="dual">{t('planner.antiplatelet.dual')}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              {t('planner.anticoagulantLabel')}
              <select
                value={anticoagulant}
                onChange={(event) => setAnticoagulant(event.target.value as AnticoagulantStatus)}
                className="min-h-11 rounded-lg border border-input bg-background px-3"
              >
                <option value="none">{t('planner.anticoagulant.none')}</option>
                <option value="held">{t('planner.anticoagulant.held')}</option>
                <option value="active">{t('planner.anticoagulant.active')}</option>
              </select>
            </label>
          </div>
          <div className="mt-5 rounded-lg border border-border bg-background p-4 text-sm leading-6">
            <p className="font-semibold capitalize text-foreground">
              {t('planner.bleedingRiskLabel', { level: t(`riskLevel.${bleedingRisk.level}`) })}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {bleedingRisk.reasonCodes.map((code) => (
                <li key={code}>{t(`bleeding.reasons.${code}`)}</li>
              ))}
            </ul>
            <p className="mt-3 text-muted-foreground">{t('bleeding.teachingPoint')}</p>
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
