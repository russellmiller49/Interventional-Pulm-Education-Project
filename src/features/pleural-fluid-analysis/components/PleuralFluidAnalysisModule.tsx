'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
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

import { defaultPleuralFluidCase, getPleuralFluidCases } from '../content/cases'
import { getPleuralDiseaseProfiles } from '../content/diseaseProfiles'
import {
  getAnalysisFrameworkSteps,
  getClinicalContextOptions,
  getFluidAppearanceOptions,
  getPatternLibrary,
  getPleuralAnalysisReferences,
  getUltrasoundPatternOptions,
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

const appearanceBackground: Record<FluidAppearance, string> = {
  straw: '#f5c84c',
  serous: '#f7d885',
  serosanguineous: '#e89b8f',
  bloody: '#b91c1c',
  milky: '#e7f0ef',
  turbid: '#c6b47f',
  purulent: '#d9b84f',
  green: '#6aa56f',
  'food-particles': '#b9824f',
  'urine-odor': '#e2c04d',
}

const cloneInput = (input: PleuralFluidInput): PleuralFluidInput => ({ ...input })

type Translate = ReturnType<typeof useTranslations<'pleuralFluidAnalysis'>>

/**
 * Build the localized "Next move" list from the engine's `nextActionsCode`. The
 * `definitive` branch prepends the definitive finding's own action (keyed by
 * `headlineDiagnosisCode`) before the shared follow-up line; every other code
 * maps to a ready-made array in the namespace.
 */
function renderNextActions(
  t: Translate,
  interpretation: ReturnType<typeof interpretPleuralFluid>,
): string[] {
  if (interpretation.nextActionsCode === 'definitive') {
    const definitive = interpretation.findings.find((finding) => finding.strength === 'definitive')
    const firstAction = definitive
      ? t(`findings.${definitive.code}.action`)
      : t('nextActions.definitiveFollowUp')

    return [firstAction, t('nextActions.definitiveFollowUp')]
  }

  return t.raw(`nextActions.${interpretation.nextActionsCode}`) as string[]
}

export function PleuralFluidAnalysisModule() {
  const t = useTranslations('pleuralFluidAnalysis')
  const locale = useLocale()
  const pleuralFluidCases = React.useMemo(() => getPleuralFluidCases(locale), [locale])
  const diseaseProfiles = React.useMemo(() => getPleuralDiseaseProfiles(locale), [locale])
  const clinicalContextOptions = React.useMemo(() => getClinicalContextOptions(locale), [locale])
  const ultrasoundPatternOptions = React.useMemo(
    () => getUltrasoundPatternOptions(locale),
    [locale],
  )
  const fluidAppearanceOptions = React.useMemo(() => getFluidAppearanceOptions(locale), [locale])
  const analysisFrameworkSteps = React.useMemo(() => getAnalysisFrameworkSteps(locale), [locale])
  const patternLibrary = React.useMemo(() => getPatternLibrary(locale), [locale])
  const pleuralAnalysisReferences = React.useMemo(
    () => getPleuralAnalysisReferences(locale),
    [locale],
  )

  const [activeCaseId, setActiveCaseId] = React.useState(defaultPleuralFluidCase.id)
  const [input, setInput] = React.useState<PleuralFluidInput>(() =>
    cloneInput(defaultPleuralFluidCase.input),
  )

  const activeCase =
    pleuralFluidCases.find((clinicalCase) => clinicalCase.id === activeCaseId) ??
    pleuralFluidCases[0]
  const interpretation = React.useMemo(() => interpretPleuralFluid(input), [input])
  const differentialPreview = React.useMemo(
    () =>
      scoreDifferential(
        input,
        { contextEmphasis: 72, raritySensitivity: 55, maxResults: 4 },
        diseaseProfiles,
      ),
    [diseaseProfiles, input],
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
  const fluidBackground = appearanceBackground[input.appearance]
  const dominantCategory =
    interpretation.pseudoexudateReasons.length > 0
      ? t('category.Pseudoexudate')
      : t(`category.${interpretation.lightCriteria.classification}`)

  return (
    <div className="min-w-0 space-y-10 overflow-hidden">
      <section className="container grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{t('cockpit.badge')}</Badge>
                <Badge
                  variant={interpretation.reconciledCategory === 'exudate' ? 'default' : 'success'}
                >
                  {dominantCategory}
                </Badge>
              </div>
              <h2 className="break-words text-2xl font-semibold tracking-tight">
                {t('cockpit.title')}
              </h2>
              <p className="max-w-3xl break-words text-sm leading-6 text-muted-foreground">
                {t('cockpit.intro')}
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
              {t('cockpit.resetCase')}
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
                    <h3 className="font-semibold">{t('cockpit.clinicalFrame')}</h3>
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
                  <h3 className="font-semibold">{t('cockpit.fluidSnapshot')}</h3>
                </div>
                <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="mx-auto flex h-56 w-28 items-end rounded-b-[2rem] rounded-t-lg border-2 border-slate-300 bg-white/70 p-2 shadow-inner dark:border-slate-600 dark:bg-slate-950">
                    <div
                      className="w-full rounded-b-[1.45rem] rounded-t-md transition-all duration-500"
                      style={{ height: `${fluidHeight}%`, background: fluidBackground }}
                    />
                  </div>
                  <div className="grid min-w-0 gap-3 text-sm">
                    <MetricRow
                      label={t('cockpit.appearanceLabel')}
                      value={t(`appearance.${input.appearance}`)}
                    />
                    <MetricRow
                      label={t('cockpit.lightCriteriaLabel')}
                      value={t(`category.${interpretation.lightCriteria.classification}`)}
                    />
                    <MetricRow
                      label={t('cockpit.reconciledLabel')}
                      value={t(`category.${interpretation.reconciledCategory}`)}
                      tone={interpretation.reconciledCategory === 'exudate' ? 'amber' : 'emerald'}
                    />
                    <MetricRow
                      label={t('cockpit.teachingFocusLabel')}
                      value={activeCase.teachingFocus}
                    />
                  </div>
                </div>
              </section>

              <section className="min-w-0 rounded-lg border border-border/80 bg-background p-4">
                <div className="grid min-w-0 gap-4">
                  <SelectField
                    label={t('cockpit.clinicalContextLabel')}
                    value={input.clinicalContext}
                    options={clinicalContextOptions}
                    onValueChange={(value) =>
                      updateInput('clinicalContext', value as ClinicalContextId)
                    }
                  />
                  <SelectField
                    label={t('cockpit.ultrasoundLabel')}
                    value={input.ultrasound}
                    options={ultrasoundPatternOptions}
                    onValueChange={(value) => updateInput('ultrasound', value as UltrasoundPattern)}
                  />
                  <SelectField
                    label={t('cockpit.grossAppearanceLabel')}
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
                  <h3 className="font-semibold">{t('cockpit.pairedChemistry')}</h3>
                </div>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <NumberField
                    label={t('fields.serumProtein')}
                    unit="g/dL"
                    value={input.serumProtein}
                    step={0.1}
                    onChange={(value) => updateInput('serumProtein', value)}
                  />
                  <NumberField
                    label={t('fields.pleuralProtein')}
                    unit="g/dL"
                    value={input.pleuralProtein}
                    step={0.1}
                    onChange={(value) => updateInput('pleuralProtein', value)}
                  />
                  <NumberField
                    label={t('fields.serumLdh')}
                    unit="U/L"
                    value={input.serumLdh}
                    onChange={(value) => updateInput('serumLdh', value)}
                  />
                  <NumberField
                    label={t('fields.pleuralLdh')}
                    unit="U/L"
                    value={input.pleuralLdh}
                    onChange={(value) => updateInput('pleuralLdh', value)}
                  />
                  <NumberField
                    label={t('fields.serumLdhUln')}
                    unit="U/L"
                    value={input.serumLdhUpperLimit}
                    onChange={(value) => updateInput('serumLdhUpperLimit', value)}
                  />
                  <NumberField
                    label={t('fields.ntProBnp')}
                    unit="pg/mL"
                    value={input.ntProBnp ?? 0}
                    onChange={(value) => updateInput('ntProBnp', value)}
                  />
                  <NumberField
                    label={t('fields.serumAlbumin')}
                    unit="g/dL"
                    value={input.serumAlbumin ?? 0}
                    step={0.1}
                    onChange={(value) => updateInput('serumAlbumin', value)}
                  />
                  <NumberField
                    label={t('fields.pleuralAlbumin')}
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
                  <h3 className="font-semibold">{t('cockpit.phGlucoseCells')}</h3>
                </div>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <NumberField
                    label={t('fields.pleuralPH')}
                    value={input.pleuralPH}
                    step={0.01}
                    onChange={(value) => updateInput('pleuralPH', value)}
                  />
                  <NumberField
                    label={t('fields.pleuralGlucose')}
                    unit="mg/dL"
                    value={input.pleuralGlucose}
                    onChange={(value) => updateInput('pleuralGlucose', value)}
                  />
                  <NumberField
                    label={t('fields.nucleatedCells')}
                    unit="/uL"
                    value={input.nucleatedCells}
                    onChange={(value) => updateInput('nucleatedCells', value)}
                  />
                  <NumberField
                    label={t('fields.neutrophils')}
                    unit="%"
                    value={input.neutrophils}
                    min={0}
                    max={100}
                    onChange={(value) => updateInput('neutrophils', value)}
                  />
                  <NumberField
                    label={t('fields.lymphocytes')}
                    unit="%"
                    value={input.lymphocytes}
                    min={0}
                    max={100}
                    onChange={(value) => updateInput('lymphocytes', value)}
                  />
                  <NumberField
                    label={t('fields.eosinophils')}
                    unit="%"
                    value={input.eosinophils}
                    min={0}
                    max={100}
                    onChange={(value) => updateInput('eosinophils', value)}
                  />
                  <NumberField
                    label={t('fields.mesothelialCells')}
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
                  <h3 className="font-semibold">{t('cockpit.targetedTests')}</h3>
                </div>
                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <NumberField
                    label={t('fields.triglycerides')}
                    unit="mg/dL"
                    value={input.triglycerides ?? 0}
                    onChange={(value) => updateInput('triglycerides', value)}
                  />
                  <NumberField
                    label={t('fields.cholesterol')}
                    unit="mg/dL"
                    value={input.cholesterol ?? 0}
                    onChange={(value) => updateInput('cholesterol', value)}
                  />
                  <NumberField
                    label={t('fields.ada')}
                    unit="IU/L"
                    value={input.ada ?? 0}
                    onChange={(value) => updateInput('ada', value)}
                  />
                  <NumberField
                    label={t('fields.amylase')}
                    unit="U/L"
                    value={input.amylase ?? 0}
                    onChange={(value) => updateInput('amylase', value)}
                  />
                  <NumberField
                    label={t('fields.pfBloodHct')}
                    value={input.pleuralToBloodHematocritRatio ?? 0}
                    step={0.01}
                    onChange={(value) => updateInput('pleuralToBloodHematocritRatio', value)}
                  />
                  <NumberField
                    label={t('fields.pfSerumCreatinine')}
                    value={input.pleuralToSerumCreatinineRatio ?? 0}
                    step={0.1}
                    onChange={(value) => updateInput('pleuralToSerumCreatinineRatio', value)}
                  />
                  <NumberField
                    label={t('fields.pfSerumBilirubin')}
                    value={input.pleuralToSerumBilirubinRatio ?? 0}
                    step={0.1}
                    onChange={(value) => updateInput('pleuralToSerumBilirubinRatio', value)}
                  />
                </div>
                <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
                  <ToggleField
                    label={t('fields.cytologyPositive')}
                    active={input.cytologyPositive}
                    onClick={() => updateInput('cytologyPositive', !input.cytologyPositive)}
                  />
                  <ToggleField
                    label={t('fields.microbiologyPositive')}
                    active={input.microbiologyPositive}
                    onClick={() => updateInput('microbiologyPositive', !input.microbiologyPositive)}
                  />
                  <ToggleField
                    label={t('fields.chylomicrons')}
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
            <Badge variant="secondary">{t('cockpit.interpretation')}</Badge>
            <h2 className="mt-3 break-words text-xl font-semibold tracking-tight">
              {t(`headlineCode.${interpretation.headlineCode}`, {
                diagnosis: interpretation.headlineDiagnosisCode
                  ? t(`findings.${interpretation.headlineDiagnosisCode}.diagnosis`)
                  : '',
              })}
            </h2>
            <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">
              {t(`reconciliationCode.${interpretation.reconciliationCode}`)}
            </p>
            <div className="mt-5 space-y-3">
              <CriteriaMeter
                label={t('cockpit.proteinRatioMeter')}
                cutoffLabel={t('cockpit.cutoff', { value: 0.5 })}
                value={interpretation.lightCriteria.proteinRatio}
                threshold={0.5}
                active={interpretation.lightCriteria.proteinCriterion}
              />
              <CriteriaMeter
                label={t('cockpit.ldhRatioMeter')}
                cutoffLabel={t('cockpit.cutoff', { value: 0.6 })}
                value={interpretation.lightCriteria.ldhRatio}
                threshold={0.6}
                active={interpretation.lightCriteria.ldhRatioCriterion}
              />
              <CriteriaMeter
                label={t('cockpit.ldhUlnMeter')}
                cutoffLabel={t('cockpit.cutoff', { value: 0.67 })}
                value={interpretation.lightCriteria.ldhUpperLimitRatio}
                threshold={0.67}
                active={interpretation.lightCriteria.ldhUpperLimitCriterion}
              />
            </div>
            {interpretation.pseudoexudateReasonDetails.length > 0 ? (
              <div className="mt-4 min-w-0 rounded-lg border border-emerald-300/60 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/30 dark:text-emerald-100">
                <p className="font-semibold">{t('cockpit.pseudoexudateClues')}</p>
                <ul className="mt-2 space-y-1">
                  {interpretation.pseudoexudateReasonDetails.map((reason) => (
                    <li key={reason.code} className="break-words">
                      {t(`pseudoexudateReason.${reason.code}`, reason.args)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{t('cockpit.rankedDifferential')}</h3>
              <Badge variant="outline" size="sm">
                {t('cockpit.contextWeighted')}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {differentialPreview.visibleResults.map((result) => (
                <DifferentialPreviewItem key={result.disease.id} result={result} />
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="font-semibold">{t('cockpit.nextMove')}</h3>
            <div className="mt-4 space-y-3">
              {renderNextActions(t, interpretation).map((action, index) => (
                <div
                  key={index}
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
                <h3 className="font-semibold">{t('cockpit.pitfallsToCheck')}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {interpretation.pitfallCodes.map((code) => (
                    <li key={code} className="break-words">
                      {t(`pitfalls.${code}`)}
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
          <Badge variant="info">{t('cockpit.frameworkBadge')}</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{t('cockpit.approachMap')}</h2>
          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
            {analysisFrameworkSteps.map((step, index) => (
              <div
                key={step.title}
                className="min-w-0 rounded-lg border border-border/70 bg-background p-4"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  {t('cockpit.step', { number: index + 1 })}
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
          <Badge variant="secondary">{t('cockpit.patternLibraryBadge')}</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {t('cockpit.highYieldBranches')}
          </h2>
          <div className="mt-5 space-y-3">
            {patternLibrary.map((pattern) => (
              <div
                key={pattern.pattern}
                className="min-w-0 rounded-lg border border-border/70 bg-background p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{pattern.pattern}</h3>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('cockpit.branchPoint')}
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
          <Badge variant="outline">{t('cockpit.routineStudies')}</Badge>
          <div className="mt-4 space-y-3">
            {interpretation.routineStudyCodes.map((code) => (
              <div
                key={code}
                className="flex min-w-0 gap-3 text-sm leading-6 text-muted-foreground"
              >
                <CheckCircle2
                  className="mt-1 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300"
                  aria-hidden
                />
                <span className="min-w-0 break-words">{t(`routineStudies.${code}`)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <Badge variant="outline">{t('cockpit.targetedStudies')}</Badge>
          <div className="mt-4 space-y-3">
            {interpretation.targetedStudyCodes.map((code) => (
              <div
                key={code}
                className="flex min-w-0 gap-3 text-sm leading-6 text-muted-foreground"
              >
                <CheckCircle2
                  className="mt-1 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300"
                  aria-hidden
                />
                <span className="min-w-0 break-words">{t(`targetedStudies.${code}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container min-w-0">
        <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <Badge variant="outline">{t('cockpit.sources')}</Badge>
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
  cutoffLabel: string
  value: number
  threshold: number
  active: boolean
}

function CriteriaMeter({ label, cutoffLabel, value, threshold, active }: CriteriaMeterProps) {
  const width = Math.min(100, Math.max(8, (value / threshold) * 56))

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
        <span className="min-w-0 break-words font-semibold text-muted-foreground">{label}</span>
        <span className={cn('font-semibold', active ? 'text-sky-700 dark:text-sky-300' : '')}>
          {value} / {cutoffLabel}
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
