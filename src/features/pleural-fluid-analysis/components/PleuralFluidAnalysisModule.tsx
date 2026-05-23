'use client'

import * as React from 'react'
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  FlaskConical,
  Microscope,
  RefreshCcw,
  Stethoscope,
  TestTube2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/cn'

import { defaultPleuralFluidCase, pleuralFluidCases } from '../content/cases'
import {
  analysisFrameworkSteps,
  clinicalContextOptions,
  fluidAppearanceOptions,
  patternLibrary,
  pleuralAnalysisReferences,
  ultrasoundPatternOptions,
} from '../content/framework'
import { scoreDifferential } from '../engine/differential'
import { interpretPleuralFluid } from '../engine/interpretation'
import type {
  ClinicalContextId,
  DifferentialResult,
  FluidAppearance,
  PleuralFluidInput,
  UltrasoundPattern,
} from '../engine/types'
import { PleuralAnalysisQuiz } from './PleuralAnalysisQuiz'
import { PleuralDifferentialExplorer } from './PleuralDifferentialExplorer'

const appearanceStyles: Record<FluidAppearance, { background: string; label: string }> = {
  straw: { background: '#f5c84c', label: 'Straw' },
  serous: { background: '#f7d885', label: 'Serous' },
  serosanguineous: { background: '#e89b8f', label: 'Serosanguineous' },
  bloody: { background: '#b91c1c', label: 'Bloody' },
  milky: { background: '#e7f0ef', label: 'Milky' },
  turbid: { background: '#c6b47f', label: 'Turbid' },
  purulent: { background: '#d9b84f', label: 'Purulent' },
  green: { background: '#6aa56f', label: 'Green' },
  'food-particles': { background: '#b9824f', label: 'Food particles' },
  'urine-odor': { background: '#e2c04d', label: 'Urine odor' },
}

const cloneInput = (input: PleuralFluidInput): PleuralFluidInput => ({ ...input })

export function PleuralFluidAnalysisModule() {
  const [activeCaseId, setActiveCaseId] = React.useState(defaultPleuralFluidCase.id)
  const [input, setInput] = React.useState<PleuralFluidInput>(() =>
    cloneInput(defaultPleuralFluidCase.input),
  )

  const activeCase =
    pleuralFluidCases.find((clinicalCase) => clinicalCase.id === activeCaseId) ??
    defaultPleuralFluidCase
  const interpretation = React.useMemo(() => interpretPleuralFluid(input), [input])
  const differentialPreview = React.useMemo(
    () => scoreDifferential(input, { contextEmphasis: 72, raritySensitivity: 55, maxResults: 4 }),
    [input],
  )

  const selectCase = (caseId: string) => {
    const nextCase = pleuralFluidCases.find((clinicalCase) => clinicalCase.id === caseId)

    if (!nextCase) {
      return
    }

    setActiveCaseId(nextCase.id)
    setInput(cloneInput(nextCase.input))
  }

  const updateInput = <Key extends keyof PleuralFluidInput>(
    key: Key,
    value: PleuralFluidInput[Key],
  ) => {
    setInput((current) => ({ ...current, [key]: value }))
  }

  const fluidHeight = Math.min(86, Math.max(18, 18 + input.pleuralProtein * 9))
  const fluidStyle = appearanceStyles[input.appearance]
  const dominantCategory =
    interpretation.pseudoexudateReasons.length > 0
      ? 'Pseudoexudate'
      : interpretation.lightCriteria.classification

  return (
    <div className="min-w-0 space-y-10 overflow-hidden">
      <section className="container grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">Case cockpit</Badge>
                <Badge
                  variant={interpretation.reconciledCategory === 'exudate' ? 'default' : 'success'}
                >
                  {dominantCategory}
                </Badge>
              </div>
              <h2 className="break-words text-2xl font-semibold tracking-tight">
                Pleural fluid reasoning lab
              </h2>
              <p className="max-w-3xl break-words text-sm leading-6 text-muted-foreground">
                Move between clinical cases, change the fluid profile, and watch the diagnostic
                reasoning update around the clinical context rather than the chemistry alone.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectCase(activeCase.id)}
              className="shrink-0"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Reset case
            </Button>
          </div>

          <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-5">
            {pleuralFluidCases.map((clinicalCase) => {
              const isActive = clinicalCase.id === activeCase.id

              return (
                <button
                  key={clinicalCase.id}
                  type="button"
                  onClick={() => selectCase(clinicalCase.id)}
                  className={cn(
                    'min-w-0 rounded-lg border p-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'border-sky-500 bg-sky-500/10 text-foreground shadow-sm'
                      : 'border-border/80 bg-background hover:border-sky-500/50 hover:bg-muted/50',
                  )}
                >
                  <span className="block break-words font-semibold leading-5">
                    {clinicalCase.title}
                  </span>
                  <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
                    {clinicalCase.subtitle}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="min-w-0 space-y-5">
              <section className="min-w-0 rounded-lg border border-border/80 bg-background p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
                    <Stethoscope className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-2">
                    <h3 className="font-semibold">Clinical frame</h3>
                    <p className="break-words text-sm leading-6 text-muted-foreground">
                      {activeCase.patient}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {activeCase.clinicalClues.map((clue) => (
                    <div
                      key={clue}
                      className="flex min-w-0 items-start gap-2 text-sm leading-6 text-muted-foreground"
                    >
                      <CheckCircle2
                        className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <span className="min-w-0 break-words">{clue}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-lg border border-border/80 bg-background p-4">
                <div className="flex items-center gap-2">
                  <TestTube2 className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden />
                  <h3 className="font-semibold">Fluid snapshot</h3>
                </div>
                <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="mx-auto flex h-56 w-28 items-end rounded-b-[2rem] rounded-t-lg border-2 border-slate-300 bg-white/70 p-2 shadow-inner dark:border-slate-600 dark:bg-slate-950">
                    <div
                      className="w-full rounded-b-[1.45rem] rounded-t-md transition-all duration-500"
                      style={{ height: `${fluidHeight}%`, background: fluidStyle.background }}
                    />
                  </div>
                  <div className="grid min-w-0 gap-3 text-sm">
                    <MetricRow label="Appearance" value={fluidStyle.label} />
                    <MetricRow
                      label="Light criteria"
                      value={interpretation.lightCriteria.classification}
                    />
                    <MetricRow
                      label="Reconciled"
                      value={interpretation.reconciledCategory}
                      tone={interpretation.reconciledCategory === 'exudate' ? 'amber' : 'emerald'}
                    />
                    <MetricRow label="Teaching focus" value={activeCase.teachingFocus} />
                  </div>
                </div>
              </section>

              <section className="min-w-0 rounded-lg border border-border/80 bg-background p-4">
                <div className="grid min-w-0 gap-4">
                  <SelectField
                    label="Clinical context"
                    value={input.clinicalContext}
                    options={clinicalContextOptions}
                    onValueChange={(value) =>
                      updateInput('clinicalContext', value as ClinicalContextId)
                    }
                  />
                  <SelectField
                    label="Thoracic ultrasound"
                    value={input.ultrasound}
                    options={ultrasoundPatternOptions}
                    onValueChange={(value) => updateInput('ultrasound', value as UltrasoundPattern)}
                  />
                  <SelectField
                    label="Gross appearance"
                    value={input.appearance}
                    options={fluidAppearanceOptions}
                    onValueChange={(value) => updateInput('appearance', value as FluidAppearance)}
                  />
                </div>
              </section>
            </div>

            <div className="min-w-0 space-y-5">
              <section className="min-w-0 rounded-lg border border-border/80 bg-background p-4">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden />
                  <h3 className="font-semibold">Paired chemistry</h3>
                </div>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <NumberField
                    label="Serum protein"
                    unit="g/dL"
                    value={input.serumProtein}
                    step={0.1}
                    onChange={(value) => updateInput('serumProtein', value)}
                  />
                  <NumberField
                    label="Pleural protein"
                    unit="g/dL"
                    value={input.pleuralProtein}
                    step={0.1}
                    onChange={(value) => updateInput('pleuralProtein', value)}
                  />
                  <NumberField
                    label="Serum LDH"
                    unit="U/L"
                    value={input.serumLdh}
                    onChange={(value) => updateInput('serumLdh', value)}
                  />
                  <NumberField
                    label="Pleural LDH"
                    unit="U/L"
                    value={input.pleuralLdh}
                    onChange={(value) => updateInput('pleuralLdh', value)}
                  />
                  <NumberField
                    label="Serum LDH ULN"
                    unit="U/L"
                    value={input.serumLdhUpperLimit}
                    onChange={(value) => updateInput('serumLdhUpperLimit', value)}
                  />
                  <NumberField
                    label="NT-proBNP"
                    unit="pg/mL"
                    value={input.ntProBnp ?? 0}
                    onChange={(value) => updateInput('ntProBnp', value)}
                  />
                  <NumberField
                    label="Serum albumin"
                    unit="g/dL"
                    value={input.serumAlbumin ?? 0}
                    step={0.1}
                    onChange={(value) => updateInput('serumAlbumin', value)}
                  />
                  <NumberField
                    label="Pleural albumin"
                    unit="g/dL"
                    value={input.pleuralAlbumin ?? 0}
                    step={0.1}
                    onChange={(value) => updateInput('pleuralAlbumin', value)}
                  />
                </div>
              </section>

              <section className="min-w-0 rounded-lg border border-border/80 bg-background p-4">
                <div className="flex items-center gap-2">
                  <Microscope className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden />
                  <h3 className="font-semibold">pH, glucose, and cells</h3>
                </div>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <NumberField
                    label="Pleural pH"
                    value={input.pleuralPH}
                    step={0.01}
                    onChange={(value) => updateInput('pleuralPH', value)}
                  />
                  <NumberField
                    label="Pleural glucose"
                    unit="mg/dL"
                    value={input.pleuralGlucose}
                    onChange={(value) => updateInput('pleuralGlucose', value)}
                  />
                  <NumberField
                    label="Nucleated cells"
                    unit="/uL"
                    value={input.nucleatedCells}
                    onChange={(value) => updateInput('nucleatedCells', value)}
                  />
                  <NumberField
                    label="Neutrophils"
                    unit="%"
                    value={input.neutrophils}
                    min={0}
                    max={100}
                    onChange={(value) => updateInput('neutrophils', value)}
                  />
                  <NumberField
                    label="Lymphocytes"
                    unit="%"
                    value={input.lymphocytes}
                    min={0}
                    max={100}
                    onChange={(value) => updateInput('lymphocytes', value)}
                  />
                  <NumberField
                    label="Eosinophils"
                    unit="%"
                    value={input.eosinophils}
                    min={0}
                    max={100}
                    onChange={(value) => updateInput('eosinophils', value)}
                  />
                  <NumberField
                    label="Mesothelial cells"
                    unit="%"
                    value={input.mesothelialCells}
                    min={0}
                    max={100}
                    onChange={(value) => updateInput('mesothelialCells', value)}
                  />
                </div>
              </section>

              <section className="min-w-0 rounded-lg border border-border/80 bg-background p-4">
                <div className="flex items-center gap-2">
                  <Beaker className="h-5 w-5 text-sky-700 dark:text-sky-300" aria-hidden />
                  <h3 className="font-semibold">Targeted tests</h3>
                </div>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <NumberField
                    label="Triglycerides"
                    unit="mg/dL"
                    value={input.triglycerides ?? 0}
                    onChange={(value) => updateInput('triglycerides', value)}
                  />
                  <NumberField
                    label="Cholesterol"
                    unit="mg/dL"
                    value={input.cholesterol ?? 0}
                    onChange={(value) => updateInput('cholesterol', value)}
                  />
                  <NumberField
                    label="ADA"
                    unit="IU/L"
                    value={input.ada ?? 0}
                    onChange={(value) => updateInput('ada', value)}
                  />
                  <NumberField
                    label="Amylase"
                    unit="U/L"
                    value={input.amylase ?? 0}
                    onChange={(value) => updateInput('amylase', value)}
                  />
                  <NumberField
                    label="PF/blood Hct"
                    value={input.pleuralToBloodHematocritRatio ?? 0}
                    step={0.01}
                    onChange={(value) => updateInput('pleuralToBloodHematocritRatio', value)}
                  />
                  <NumberField
                    label="PF/serum creatinine"
                    value={input.pleuralToSerumCreatinineRatio ?? 0}
                    step={0.1}
                    onChange={(value) => updateInput('pleuralToSerumCreatinineRatio', value)}
                  />
                  <NumberField
                    label="PF/serum bilirubin"
                    value={input.pleuralToSerumBilirubinRatio ?? 0}
                    step={0.1}
                    onChange={(value) => updateInput('pleuralToSerumBilirubinRatio', value)}
                  />
                </div>
                <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
                  <ToggleField
                    label="Cytology +"
                    active={input.cytologyPositive}
                    onClick={() => updateInput('cytologyPositive', !input.cytologyPositive)}
                  />
                  <ToggleField
                    label="Microbiology +"
                    active={input.microbiologyPositive}
                    onClick={() => updateInput('microbiologyPositive', !input.microbiologyPositive)}
                  />
                  <ToggleField
                    label="Chylomicrons"
                    active={input.chylomicronsPresent}
                    onClick={() => updateInput('chylomicronsPresent', !input.chylomicronsPresent)}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <Badge variant="secondary">Interpretation</Badge>
            <h2 className="mt-3 break-words text-xl font-semibold tracking-tight">
              {interpretation.headline}
            </h2>
            <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">
              {interpretation.reconciliation}
            </p>
            <div className="mt-5 space-y-3">
              <CriteriaMeter
                label="PF / serum protein"
                value={interpretation.lightCriteria.proteinRatio}
                threshold={0.5}
                active={interpretation.lightCriteria.proteinCriterion}
              />
              <CriteriaMeter
                label="PF / serum LDH"
                value={interpretation.lightCriteria.ldhRatio}
                threshold={0.6}
                active={interpretation.lightCriteria.ldhRatioCriterion}
              />
              <CriteriaMeter
                label="PF LDH / serum ULN"
                value={interpretation.lightCriteria.ldhUpperLimitRatio}
                threshold={0.67}
                active={interpretation.lightCriteria.ldhUpperLimitCriterion}
              />
            </div>
            {interpretation.pseudoexudateReasons.length > 0 ? (
              <div className="mt-4 min-w-0 rounded-lg border border-emerald-300/60 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-100">
                <p className="font-semibold">Pseudoexudate clues</p>
                <ul className="mt-2 space-y-1">
                  {interpretation.pseudoexudateReasons.map((reason) => (
                    <li key={reason} className="break-words">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Ranked differential</h3>
              <Badge variant="outline" size="sm">
                context weighted
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {differentialPreview.visibleResults.map((result) => (
                <DifferentialPreviewItem key={result.disease.id} result={result} />
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="font-semibold">Next move</h3>
            <div className="mt-4 space-y-3">
              {interpretation.nextActions.map((action) => (
                <div
                  key={action}
                  className="flex min-w-0 gap-3 text-sm leading-6 text-muted-foreground"
                >
                  <CheckCircle2
                    className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  <span className="min-w-0 break-words">{action}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-amber-300/60 bg-amber-50 p-5 text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex min-w-0 gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <h3 className="font-semibold">Pitfalls to check</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {interpretation.pitfalls.map((pitfall) => (
                    <li key={pitfall} className="break-words">
                      {pitfall}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <PleuralDifferentialExplorer input={input} />
      <PleuralAnalysisQuiz />

      <section className="container grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <Badge variant="info">Framework</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Approach map</h2>
          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
            {analysisFrameworkSteps.map((step, index) => (
              <div
                key={step.title}
                className="min-w-0 rounded-lg border border-border/70 bg-background p-4"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  Step {index + 1}
                </span>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <Badge variant="secondary">Pattern library</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">High-yield branches</h2>
          <div className="mt-5 space-y-3">
            {patternLibrary.map((pattern) => (
              <div
                key={pattern.pattern}
                className="min-w-0 rounded-lg border border-border/70 bg-background p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{pattern.pattern}</h3>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Branch point
                  </span>
                </div>
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                  {pattern.signal}
                </p>
                <p className="mt-2 break-words text-sm leading-6 text-foreground">{pattern.move}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <Badge variant="outline">Routine studies</Badge>
          <div className="mt-4 space-y-3">
            {interpretation.routineStudies.map((study) => (
              <div
                key={study}
                className="flex min-w-0 gap-3 text-sm leading-6 text-muted-foreground"
              >
                <CheckCircle2
                  className="mt-1 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300"
                  aria-hidden
                />
                <span className="min-w-0 break-words">{study}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <Badge variant="outline">Targeted studies</Badge>
          <div className="mt-4 space-y-3">
            {interpretation.targetedStudies.map((study) => (
              <div
                key={study}
                className="flex min-w-0 gap-3 text-sm leading-6 text-muted-foreground"
              >
                <CheckCircle2
                  className="mt-1 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300"
                  aria-hidden
                />
                <span className="min-w-0 break-words">{study}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container min-w-0">
        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <Badge variant="outline">Sources</Badge>
          <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-3">
            {pleuralAnalysisReferences.map((reference) => (
              <div
                key={reference.id}
                className="min-w-0 rounded-lg border border-border/70 bg-background p-4"
              >
                <p className="break-words text-sm font-semibold leading-6">{reference.citation}</p>
                <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">
                  {reference.source}
                </p>
                <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                  {reference.useNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function DifferentialPreviewItem({ result }: { result: DifferentialResult }) {
  const bestEvidence = result.matchedEvidence[0] ?? result.disease.summary

  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-700 dark:text-sky-300">
              {result.rank}
            </span>
            <span className="break-words font-semibold">{result.disease.name}</span>
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{bestEvidence}</p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-semibold">
          {result.score}%
        </span>
      </div>
    </div>
  )
}

interface SelectFieldProps<Value extends string> {
  label: string
  value: Value
  options: readonly { id: Value; label: string; description?: string }[]
  onValueChange: (value: Value) => void
}

function SelectField<Value extends string>({
  label,
  value,
  options,
  onValueChange,
}: SelectFieldProps<Value>) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium">
      <span className="min-w-0 break-words">{label}</span>
      <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as Value)}>
        <SelectTrigger className="min-w-0 rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <span className="block break-words">{option.label}</span>
              {option.description ? (
                <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  unit?: string
  min?: number
  max?: number
  step?: number
}

function NumberField({ label, value, onChange, unit, min, max, step = 1 }: NumberFieldProps) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 break-words">{label}</span>
        {unit ? <span className="text-xs font-normal text-muted-foreground">{unit}</span> : null}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 min-w-0 rounded-lg border border-border/80 bg-background px-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
      />
    </label>
  )
}

interface ToggleFieldProps {
  label: string
  active: boolean
  onClick: () => void
}

function ToggleField({ label, active, onClick }: ToggleFieldProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-w-0 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-200'
          : 'border-border/80 bg-background text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}

interface MetricRowProps {
  label: string
  value: string
  tone?: 'emerald' | 'amber'
}

function MetricRow({ label, value, tone }: MetricRowProps) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 break-words text-sm font-semibold leading-5',
          tone === 'emerald' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'amber' && 'text-amber-700 dark:text-amber-300',
        )}
      >
        {value}
      </p>
    </div>
  )
}

interface CriteriaMeterProps {
  label: string
  value: number
  threshold: number
  active: boolean
}

function CriteriaMeter({ label, value, threshold, active }: CriteriaMeterProps) {
  const width = Math.min(100, Math.max(8, (value / threshold) * 56))

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
        <span className="min-w-0 break-words font-semibold text-muted-foreground">{label}</span>
        <span className={cn('font-semibold', active ? 'text-sky-700 dark:text-sky-300' : '')}>
          {value} / cutoff {threshold}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            active ? 'bg-sky-600' : 'bg-emerald-600',
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
