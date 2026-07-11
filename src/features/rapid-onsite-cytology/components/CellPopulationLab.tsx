'use client'

import * as React from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Layers3,
  RotateCcw,
  ScanSearch,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HandoffContent } from '@/i18n/handoff'
import { cn } from '@/lib/cn'

import {
  cellPopulationSources,
  cellPopulations,
  cellReadingSteps,
  defaultCellPopulationId,
  getCellPopulation,
  type CellDiagramVariant,
  type CellPopulation,
  type CellPopulationId,
} from '../content/cell-populations'

interface CellQuizResponse {
  selectedId?: CellPopulationId
  revealed: boolean
}

export function CellPopulationLab({ onContinue }: { onContinue: () => void }) {
  return (
    <HandoffContent>
      <section className="container space-y-10">
        <header className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
            Build a visual vocabulary
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Cell ID lab: know the population before naming the process
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Learn the nucleus, cytoplasm, surface, arrangement, and ROSE meaning of common pulmonary
            cytology populations. Then identify each population from an unlabeled schematic before
            moving to real slide images.
          </p>
        </header>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-950 dark:text-amber-100">
          <span className="font-semibold">Schematic—not a photomicrograph: </span>
          features are intentionally simplified and exaggerated. Stain, preparation, activation,
          degeneration, crush, and thickness change how real cells appear. Identify populations from
          several concordant features across the field, not from one cell or one color.
        </div>

        <CellReadingSequence />
        <PopulationExplorer />
        <PopulationComparison />
        <IdentificationPractice />
        <CellPopulationSources />

        <div className="flex justify-end border-t border-border pt-6">
          <Button type="button" onClick={onContinue}>
            Continue to ROSE decision cases
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </section>
    </HandoffContent>
  )
}

function CellReadingSequence() {
  return (
    <HandoffContent>
      <section className="space-y-5" aria-labelledby="cell-reading-sequence-title">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
            A repeatable five-look sequence
          </p>
          <h3 id="cell-reading-sequence-title" className="mt-2 text-2xl font-semibold">
            Read every field in the same order
          </h3>
        </div>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {cellReadingSteps.map((step) => (
            <li
              key={step.number}
              className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"
            >
              <span className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">
                {step.number}
              </span>
              <h4 className="mt-2 font-semibold">{step.title}</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.question}</p>
            </li>
          ))}
        </ol>
      </section>
    </HandoffContent>
  )
}

function PopulationExplorer() {
  const [activePopulationId, setActivePopulationId] =
    React.useState<CellPopulationId>(defaultCellPopulationId)
  const activePopulation = getCellPopulation(activePopulationId)
  const [activeFeatureId, setActiveFeatureId] = React.useState(
    activePopulation.features[0]?.id ?? '',
  )
  const activeFeature =
    activePopulation.features.find((feature) => feature.id === activeFeatureId) ??
    activePopulation.features[0]

  const selectPopulation = (population: CellPopulation) => {
    setActivePopulationId(population.id)
    setActiveFeatureId(population.features[0]?.id ?? '')
  }

  return (
    <HandoffContent>
      <section className="space-y-5" aria-labelledby="population-explorer-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Click the anatomy
            </p>
            <h3 id="population-explorer-title" className="mt-2 text-2xl font-semibold">
              Explore six common populations
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Choose a population, then select a numbered hotspot to connect the visual component
              with its cytologic meaning.
            </p>
          </div>
          <Badge variant="outline">6 schematic populations</Badge>
        </div>

        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="toolbar"
          aria-label="Cell populations"
        >
          {cellPopulations.map((population) => {
            const active = population.id === activePopulation.id
            return (
              <button
                key={population.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectPopulation(population)}
                className={cn(
                  'min-w-40 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-border/80 bg-card hover:border-sky-500/40',
                )}
              >
                <span className="block text-sm font-semibold">{population.shortLabel}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {population.family}
                </span>
              </button>
            )
          })}
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <div className="border-b border-border/80 bg-slate-950 p-5 xl:border-b-0 xl:border-r sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                  Interactive schematic
                </p>
                <h4 className="mt-2 text-2xl font-semibold">{activePopulation.title}</h4>
              </div>
              <Badge className="border-white/15 bg-white/10 text-slate-100">Not to scale</Badge>
            </div>

            <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
              <CellIllustration
                variant={activePopulation.diagramVariant}
                ariaLabel={activePopulation.diagramAlt}
              />
              <div className="absolute inset-0" aria-label="Interactive cell components">
                {activePopulation.features.map((feature, index) => {
                  const active = feature.id === activeFeature?.id
                  return (
                    <button
                      key={feature.id}
                      type="button"
                      aria-label={`Inspect ${feature.label}`}
                      aria-pressed={active}
                      onClick={() => setActiveFeatureId(feature.id)}
                      className={cn(
                        'absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                        active
                          ? 'border-cyan-100 bg-cyan-500 text-white shadow-cyan-500/30'
                          : 'border-white bg-slate-950/85 text-white hover:bg-cyan-600',
                      )}
                      style={{ left: `${feature.xPct}%`, top: `${feature.yPct}%` }}
                    >
                      {index + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {activePopulation.features.map((feature, index) => (
                <button
                  key={feature.id}
                  type="button"
                  aria-pressed={feature.id === activeFeature?.id}
                  onClick={() => setActiveFeatureId(feature.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left text-xs leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                    feature.id === activeFeature?.id
                      ? 'border-cyan-300 bg-cyan-300/15 text-white'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/35',
                  )}
                >
                  <span className="font-semibold">{index + 1}. </span>
                  {feature.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-7">
            <div>
              <Badge variant="info">{activePopulation.family}</Badge>
              <p className="mt-3 text-lg font-semibold leading-7">{activePopulation.oneLook}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">Relative size: </span>
                {activePopulation.relativeSize}
              </p>
            </div>

            {activeFeature ? (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-200">
                  Selected component
                </p>
                <h5 className="mt-2 text-lg font-semibold">{activeFeature.label}</h5>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {activeFeature.description}
                </p>
              </div>
            ) : null}

            <dl className="grid gap-3 text-sm leading-6 sm:grid-cols-2">
              <FeatureDefinition term="Nucleus" description={activePopulation.nucleus} />
              <FeatureDefinition term="Cytoplasm" description={activePopulation.cytoplasm} />
              <FeatureDefinition term="Arrangement" description={activePopulation.arrangement} />
              <FeatureDefinition term="ROSE meaning" description={activePopulation.onsiteMeaning} />
            </dl>

            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-950 dark:text-amber-100">
              <span className="font-semibold">Common trap: </span>
              {activePopulation.pitfall}
            </div>
          </div>
        </div>
      </section>
    </HandoffContent>
  )
}

function FeatureDefinition({ description, term }: { description: string; term: string }) {
  return (
    <HandoffContent>
      <div className="rounded-xl border border-border/80 bg-muted/35 p-3">
        <dt className="font-semibold text-foreground">{term}</dt>
        <dd className="mt-1 text-muted-foreground">{description}</dd>
      </div>
    </HandoffContent>
  )
}

function PopulationComparison() {
  return (
    <HandoffContent>
      <section className="space-y-5" aria-labelledby="cell-comparison-title">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <Layers3 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
              Compare before classifying
            </p>
            <h3 id="cell-comparison-title" className="mt-1 text-2xl font-semibold">
              High-yield population matrix
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
          <table className="min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Population</th>
                <th className="px-4 py-3 font-semibold">Nucleus</th>
                <th className="px-4 py-3 font-semibold">Cytoplasm</th>
                <th className="px-4 py-3 font-semibold">Arrangement</th>
                <th className="px-4 py-3 font-semibold">What it changes onsite</th>
              </tr>
            </thead>
            <tbody>
              {cellPopulations.map((population) => (
                <tr key={population.id} className="border-t border-border/70 align-top">
                  <th className="w-48 px-4 py-4 font-semibold">
                    {population.shortLabel}
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {population.relativeSize}
                    </span>
                  </th>
                  <td className="px-4 py-4 leading-6 text-muted-foreground">
                    {population.nucleus}
                  </td>
                  <td className="px-4 py-4 leading-6 text-muted-foreground">
                    {population.cytoplasm}
                  </td>
                  <td className="px-4 py-4 leading-6 text-muted-foreground">
                    {population.arrangement}
                  </td>
                  <td className="px-4 py-4 leading-6 text-muted-foreground">
                    {population.onsiteMeaning}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </HandoffContent>
  )
}

function IdentificationPractice() {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [responses, setResponses] = React.useState<Record<string, CellQuizResponse>>({})
  const population = cellPopulations[activeIndex] ?? cellPopulations[0]
  const response = responses[population.id] ?? { revealed: false }
  const selectedPopulation = response.selectedId
    ? getCellPopulation(response.selectedId)
    : undefined
  const correct = response.selectedId === population.id
  const completedCount = Object.values(responses).filter((item) => item.revealed).length
  const correctCount = cellPopulations.filter((item) => {
    const itemResponse = responses[item.id]
    return itemResponse?.revealed && itemResponse.selectedId === item.id
  }).length
  const choiceOffset = (activeIndex + 2) % cellPopulations.length
  const rotatedChoices = [
    ...cellPopulations.slice(choiceOffset),
    ...cellPopulations.slice(0, choiceOffset),
  ]

  const updateResponse = (patch: Partial<CellQuizResponse>) => {
    setResponses((current) => ({
      ...current,
      [population.id]: {
        ...current[population.id],
        revealed: current[population.id]?.revealed ?? false,
        ...patch,
      },
    }))
  }

  const nextRound = () => {
    setActiveIndex((current) => (current + 1) % cellPopulations.length)
  }

  const resetPractice = () => {
    setResponses({})
    setActiveIndex(0)
  }

  return (
    <HandoffContent>
      <section className="space-y-5" aria-labelledby="cell-practice-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">
              Commit before reveal
            </p>
            <h3 id="cell-practice-title" className="mt-2 text-2xl font-semibold">
              Identify the population
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Use relative size, nucleus, cytoplasm, and arrangement. The diagnostic label and
              explanation remain hidden until you commit.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
            <div className="px-2 text-center">
              <p className="text-xl font-semibold">{completedCount}/6</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </div>
            <div className="h-9 w-px bg-border" aria-hidden />
            <div className="px-2 text-center">
              <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                {correctCount}
              </p>
              <p className="text-xs text-muted-foreground">correct</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Reset cell identification practice"
              onClick={resetPractice}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
          <div className="border-b border-border/80 bg-slate-950 p-5 text-white lg:border-b-0 lg:border-r sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <Badge className="border-white/15 bg-white/10 text-slate-100">
                Round {activeIndex + 1} of 6
              </Badge>
              <span className="text-xs text-slate-400">Schematic · not to scale</span>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
              <CellIllustration
                variant={population.diagramVariant}
                ariaLabel={
                  response.revealed
                    ? population.diagramAlt
                    : 'Unlabeled schematic cell population for identification practice.'
                }
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Which population best fits the illustrated combination of nucleus, cytoplasm, and
              arrangement?
            </p>
          </div>

          <div className="space-y-5 p-5 sm:p-7">
            <fieldset className="space-y-3">
              <legend className="text-base font-semibold">Choose one population</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {rotatedChoices.map((choice) => {
                  const selected = response.selectedId === choice.id
                  const rightChoice = choice.id === population.id
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={response.revealed}
                      aria-pressed={selected}
                      onClick={() => updateResponse({ selectedId: choice.id })}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-100',
                        !response.revealed &&
                          (selected
                            ? 'border-sky-500 bg-sky-500/10'
                            : 'border-border/80 bg-background hover:border-sky-500/50'),
                        response.revealed && rightChoice && 'border-emerald-500 bg-emerald-500/10',
                        response.revealed &&
                          selected &&
                          !rightChoice &&
                          'border-amber-500 bg-amber-500/10',
                      )}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-medium">{choice.title}</span>
                        {response.revealed && rightChoice ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-emerald-600"
                            aria-label="Correct answer"
                          />
                        ) : response.revealed && selected ? (
                          <XCircle
                            className="h-4 w-4 shrink-0 text-amber-600"
                            aria-label="Your choice"
                          />
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {!response.revealed ? (
              <Button
                type="button"
                disabled={!response.selectedId}
                onClick={() => updateResponse({ revealed: true })}
              >
                Reveal cell identity
                <ScanSearch className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <div className="space-y-4">
                <p role="status" className="sr-only">
                  {correct
                    ? 'Cell population identified correctly. Teaching explanation is visible.'
                    : 'Cell population answer needs review. Teaching explanation is visible.'}
                </p>
                <div
                  className={cn(
                    'rounded-2xl border p-4',
                    correct
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : 'border-amber-500/30 bg-amber-500/10',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {correct ? (
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                    )}
                    <div>
                      <p className="font-semibold">
                        {correct ? 'Correct identification' : 'Compare the defining features'}
                      </p>
                      {!correct && selectedPopulation ? (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          You chose {selectedPopulation.title}. The illustrated population is{' '}
                          {population.title}.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FeatureDefinition term="One-look clue" description={population.oneLook} />
                  <FeatureDefinition term="Nucleus" description={population.nucleus} />
                  <FeatureDefinition term="Cytoplasm" description={population.cytoplasm} />
                  <FeatureDefinition term="Arrangement" description={population.arrangement} />
                </div>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-950 dark:text-amber-100">
                  <span className="font-semibold">Do not overcall: </span>
                  {population.pitfall}
                </div>

                <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => updateResponse({ selectedId: undefined, revealed: false })}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Retry this population
                  </Button>
                  <Button type="button" onClick={nextRound}>
                    Next population
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </HandoffContent>
  )
}

function CellPopulationSources() {
  return (
    <HandoffContent>
      <section className="space-y-4" aria-labelledby="cell-population-sources-title">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Evidence notes
          </p>
          <h3 id="cell-population-sources-title" className="mt-2 text-xl font-semibold">
            Morphology teaching sources
          </h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {cellPopulationSources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-colors hover:border-sky-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-semibold group-hover:text-sky-700 dark:group-hover:text-sky-300">
                  {source.title}
                </span>
                <ExternalLink
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                {source.citation}
              </span>
            </a>
          ))}
        </div>
      </section>
    </HandoffContent>
  )
}

function CellIllustration({
  ariaLabel,
  variant,
}: {
  ariaLabel: string
  variant: CellDiagramVariant
}) {
  return (
    <svg viewBox="0 0 320 220" role="img" aria-label={ariaLabel} className="block h-auto w-full">
      <defs>
        <radialGradient id={`cell-cytoplasm-${variant}`} cx="42%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#60a5fa" />
        </radialGradient>
        <radialGradient id={`red-cell-${variant}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fecdd3" />
          <stop offset="70%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#be123c" />
        </radialGradient>
      </defs>
      <rect width="320" height="220" fill="#0f172a" />
      <circle cx="42" cy="42" r="2" fill="#38bdf8" opacity="0.28" />
      <circle cx="284" cy="54" r="3" fill="#38bdf8" opacity="0.22" />
      <circle cx="265" cy="184" r="2" fill="#38bdf8" opacity="0.24" />

      {variant === 'lymphocyte' ? <LymphocyteDrawing /> : null}
      {variant === 'bronchial-epithelial' ? <BronchialCellDrawing /> : null}
      {variant === 'neutrophil' ? <NeutrophilDrawing /> : null}
      {variant === 'macrophage' ? (
        <MacrophageDrawing gradientId={`cell-cytoplasm-${variant}`} />
      ) : null}
      {variant === 'malignant-epithelial' ? <MalignantEpithelialDrawing /> : null}
      {variant === 'red-blood-cell' ? <RedCellDrawing gradientId={`red-cell-${variant}`} /> : null}
    </svg>
  )
}

function LymphocyteDrawing() {
  return (
    <g>
      <circle
        cx="78"
        cy="70"
        r="24"
        fill="#93c5fd"
        stroke="#e0f2fe"
        strokeWidth="3"
        opacity="0.72"
      />
      <circle cx="78" cy="70" r="19" fill="#4338ca" />
      <circle
        cx="252"
        cy="72"
        r="19"
        fill="#93c5fd"
        stroke="#e0f2fe"
        strokeWidth="3"
        opacity="0.65"
      />
      <circle cx="252" cy="72" r="15" fill="#4338ca" />
      <circle cx="162" cy="114" r="67" fill="#93c5fd" stroke="#e0f2fe" strokeWidth="4" />
      <circle cx="158" cy="109" r="56" fill="#3730a3" stroke="#312e81" strokeWidth="3" />
      {[
        [130, 83],
        [150, 76],
        [177, 86],
        [137, 113],
        [171, 121],
        [151, 139],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="#818cf8" opacity="0.65" />
      ))}
      <path
        d="M195 139 C204 150 201 164 188 170"
        fill="none"
        stroke="#bfdbfe"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </g>
  )
}

function BronchialCellDrawing() {
  const cells = [86, 128, 170, 212]
  return (
    <g>
      <path d="M58 62 L240 62 L229 178 L70 178 Z" fill="#bae6fd" stroke="#e0f2fe" strokeWidth="3" />
      {cells.map((x) => (
        <g key={x}>
          <path
            d={`M${x - 19} 65 L${x + 19} 65 L${x + 15} 176 L${x - 15} 176 Z`}
            fill="#7dd3fc"
            stroke="#0ea5e9"
            strokeWidth="2"
          />
          <ellipse cx={x} cy="132" rx="11" ry="19" fill="#4338ca" />
        </g>
      ))}
      <path d="M66 79 L232 79" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" />
      {Array.from({ length: 24 }, (_, index) => 69 + index * 7).map((x) => (
        <path
          key={x}
          d={`M${x} 63 Q${x - 4} 46 ${x + 2} 32`}
          fill="none"
          stroke="#67e8f9"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
    </g>
  )
}

function NeutrophilDrawing() {
  const granules = [
    [102, 80],
    [125, 58],
    [168, 57],
    [204, 79],
    [218, 119],
    [200, 152],
    [164, 170],
    [118, 161],
    [91, 130],
    [130, 122],
    [189, 111],
  ]
  return (
    <g>
      <circle cx="160" cy="112" r="84" fill="#dbeafe" stroke="#e0f2fe" strokeWidth="4" />
      <path d="M122 102 C111 76 127 58 149 72 C166 82 159 105 145 113" fill="#4f46e5" />
      <path d="M146 111 C155 90 180 84 191 101 C204 121 184 137 166 130" fill="#4f46e5" />
      <path d="M163 130 C153 146 132 155 118 141 C102 124 119 107 139 112" fill="#4f46e5" />
      <path
        d="M146 105 C151 110 154 114 158 118"
        fill="none"
        stroke="#312e81"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M157 126 C155 132 151 136 146 139"
        fill="none"
        stroke="#312e81"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {granules.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="#f59e0b" opacity="0.72" />
      ))}
    </g>
  )
}

function MacrophageDrawing({ gradientId }: { gradientId: string }) {
  return (
    <g>
      <path
        d="M70 92 C82 42 137 23 191 42 C243 60 262 110 238 159 C216 203 151 203 101 180 C59 160 49 123 70 92 Z"
        fill={`url(#${gradientId})`}
        stroke="#e0f2fe"
        strokeWidth="4"
      />
      <ellipse cx="128" cy="119" rx="31" ry="39" fill="#4f46e5" transform="rotate(-18 128 119)" />
      <circle cx="187" cy="82" r="18" fill="#e0f2fe" opacity="0.78" />
      <circle cx="213" cy="119" r="14" fill="#e0f2fe" opacity="0.62" />
      <circle cx="181" cy="155" r="11" fill="#e0f2fe" opacity="0.72" />
      <circle cx="100" cy="70" r="9" fill="#e0f2fe" opacity="0.58" />
      {[
        [205, 68],
        [224, 91],
        [194, 135],
        [155, 65],
        [89, 145],
        [152, 171],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#92400e" opacity="0.8" />
      ))}
    </g>
  )
}

function MalignantEpithelialDrawing() {
  const cells = [
    { cx: 111, cy: 92, rx: 53, ry: 45, rotate: -18, nucleusX: 113, nucleusY: 91, nucleusR: 30 },
    { cx: 177, cy: 82, rx: 55, ry: 48, rotate: 13, nucleusX: 177, nucleusY: 78, nucleusR: 33 },
    { cx: 207, cy: 139, rx: 52, ry: 45, rotate: -8, nucleusX: 207, nucleusY: 136, nucleusR: 30 },
    { cx: 132, cy: 148, rx: 57, ry: 43, rotate: 17, nucleusX: 137, nucleusY: 145, nucleusR: 31 },
  ]
  return (
    <g>
      {cells.map((cell, index) => (
        <g key={`${cell.cx}-${cell.cy}`}>
          <ellipse
            cx={cell.cx}
            cy={cell.cy}
            rx={cell.rx}
            ry={cell.ry}
            transform={`rotate(${cell.rotate} ${cell.cx} ${cell.cy})`}
            fill={index % 2 === 0 ? '#7dd3fc' : '#93c5fd'}
            stroke="#e0f2fe"
            strokeWidth="3"
            opacity="0.93"
          />
          <path
            d={`M${cell.nucleusX - cell.nucleusR} ${cell.nucleusY} C${cell.nucleusX - 22} ${cell.nucleusY - 31} ${cell.nucleusX + 18} ${cell.nucleusY - 39} ${cell.nucleusX + cell.nucleusR} ${cell.nucleusY - 5} C${cell.nucleusX + 23} ${cell.nucleusY + 28} ${cell.nucleusX - 18} ${cell.nucleusY + 35} ${cell.nucleusX - cell.nucleusR} ${cell.nucleusY} Z`}
            fill="#4338ca"
            stroke="#312e81"
            strokeWidth="2"
          />
          <circle cx={cell.nucleusX + 7} cy={cell.nucleusY - 4} r="6" fill="#c4b5fd" />
        </g>
      ))}
      <path
        d="M82 129 C111 109 143 119 166 135"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="4"
        opacity="0.7"
      />
    </g>
  )
}

function RedCellDrawing({ gradientId }: { gradientId: string }) {
  const cells = [
    [79, 78, 0.92],
    [147, 64, 1.08],
    [221, 84, 0.95],
    [101, 145, 1.02],
    [178, 142, 0.9],
    [247, 153, 1.05],
  ] as const
  return (
    <g>
      {cells.map(([cx, cy, scale]) => (
        <g key={`${cx}-${cy}`} transform={`translate(${cx} ${cy}) scale(${scale})`}>
          <circle r="34" fill={`url(#${gradientId})`} stroke="#fecdd3" strokeWidth="3" />
          <circle r="14" fill="#fecdd3" opacity="0.82" />
        </g>
      ))}
    </g>
  )
}
