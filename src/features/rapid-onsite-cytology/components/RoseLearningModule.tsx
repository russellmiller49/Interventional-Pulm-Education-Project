'use client'

/* eslint-disable @next/next/no-img-element */

import * as React from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FlaskConical,
  MessageSquareText,
  Microscope,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Target,
  TestTube2,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HandoffContent } from '@/i18n/handoff'
import { cn } from '@/lib/cn'

import {
  roseAdequacyAxes,
  roseArtifactRescues,
  roseDecisionCases,
  roseFrameworkSteps,
  roseReferences,
  type RoseDecisionCase,
} from '../content/curriculum'
import { CellPopulationLab } from './CellPopulationLab'
import { RapidOnsiteCytologyModule } from './RapidOnsiteCytologyModule'

type RoseSectionId = 'core' | 'cells' | 'decisions' | 'atlas' | 'evidence'

interface CaseResponse {
  assessmentChoiceId?: string
  triageChoiceId?: string
  revealed: boolean
}

const moduleSections: Array<{
  id: RoseSectionId
  number: string
  label: string
  summary: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}> = [
  {
    id: 'core',
    number: '01',
    label: 'Core playbook',
    summary: 'Adequacy and communication',
    icon: BookOpenCheck,
  },
  {
    id: 'cells',
    number: '02',
    label: 'Cell ID lab',
    summary: '6 populations + practice',
    icon: ScanSearch,
  },
  {
    id: 'decisions',
    number: '03',
    label: 'Decision lab',
    summary: `${roseDecisionCases.length} commit-first cases`,
    icon: Target,
  },
  {
    id: 'atlas',
    number: '04',
    label: 'Morphology lab',
    summary: 'Annotated visual practice',
    icon: Microscope,
  },
  {
    id: 'evidence',
    number: '05',
    label: 'Evidence & limits',
    summary: 'Guidelines and safety',
    icon: ShieldCheck,
  },
]

export function RoseLearningModule() {
  const [activeSection, setActiveSection] = React.useState<RoseSectionId>('core')
  const [visitedSections, setVisitedSections] = React.useState<Set<RoseSectionId>>(
    () => new Set(['core']),
  )
  const [responses, setResponses] = React.useState<Record<string, CaseResponse>>({})

  const completedCaseCount = Object.values(responses).filter((response) => response.revealed).length
  const correctCaseCount = roseDecisionCases.filter((caseItem) => {
    const response = responses[caseItem.id]
    return response?.revealed && isCaseCorrect(caseItem, response)
  }).length

  const openSection = (sectionId: RoseSectionId) => {
    setActiveSection(sectionId)
    setVisitedSections((current) => {
      const next = new Set(current)
      next.add(sectionId)
      return next
    })
    window.requestAnimationFrame?.(() => {
      document.getElementById('rose-active-panel')?.focus({ preventScroll: true })
      document.getElementById('rose-module-navigation')?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  return (
    <HandoffContent>
      <div className="pb-16">
        <section className="relative overflow-hidden border-b border-border/70 bg-slate-950 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            aria-hidden
            style={{
              background:
                'radial-gradient(circle at 15% 20%, rgba(14,165,233,0.26), transparent 34%), radial-gradient(circle at 85% 10%, rgba(16,185,129,0.18), transparent 30%), linear-gradient(135deg, rgba(15,23,42,0.45), rgba(2,6,23,0.96))',
            }}
          />
          <div className="container relative grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:py-14">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge className="border-sky-300/20 bg-sky-300/10 text-sky-100">
                  ROSE essentials
                </Badge>
                <Badge className="border-white/15 bg-white/5 text-slate-200">
                  EBUS + pulmonary cytology
                </Badge>
                <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                  {roseDecisionCases.length} decision cases
                </Badge>
              </div>
              <div className="max-w-4xl space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">
                  Rapid on-site evaluation
                </p>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Adequacy, triage, and the next pass
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                  ROSE is a decision service—not a race to name every cell. Learn to prove the
                  target, choose the narrowest safe category, protect downstream testing, and give
                  the room a call that changes what happens next.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 backdrop-blur">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
                <div className="space-y-2 text-sm leading-6 text-amber-50">
                  <p className="font-semibold">Educational scope</p>
                  <p className="text-amber-100/85">
                    This module does not confer cytopathology competency or replace institutional
                    protocols, credentialing, or final pathology review. Specimen handling and
                    ancillary-test requirements vary by laboratory.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="rose-module-navigation"
          className="sticky top-16 z-30 scroll-mt-16 border-b border-border/80 bg-background/95 py-3 shadow-sm supports-backdrop:backdrop-blur md:top-20 md:scroll-mt-20"
        >
          <div className="container space-y-3">
            <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>
                Exploration: {visitedSections.size}/{moduleSections.length} sections visited
              </span>
              <span>
                Practice: {completedCaseCount}/{roseDecisionCases.length} cases · {correctCaseCount}{' '}
                correct
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-[width] duration-300"
                style={{ width: `${(visitedSections.size / moduleSections.length) * 100}%` }}
              />
            </div>
            <nav aria-label="ROSE module sections" className="flex gap-2 overflow-x-auto pb-1">
              {moduleSections.map((section) => {
                const Icon = section.icon
                const active = section.id === activeSection
                const visited = visitedSections.has(section.id)
                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => openSection(section.id)}
                    className={cn(
                      'group flex min-w-[190px] flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-sky-500 bg-sky-500/10 text-foreground'
                        : 'border-border/70 bg-card text-muted-foreground hover:border-sky-500/40 hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        active
                          ? 'bg-sky-500 text-white'
                          : visited
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {visited && !active ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        <Icon className="h-4 w-4" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.number}
                      </span>
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {section.label}
                      </span>
                      <span className="block truncate text-xs">{section.summary}</span>
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>
        </section>

        <section
          id="rose-active-panel"
          tabIndex={-1}
          aria-label="Active ROSE learning section"
          className="pt-8 outline-none"
        >
          {activeSection === 'core' ? (
            <CorePlaybook onContinue={() => openSection('cells')} />
          ) : null}
          {activeSection === 'cells' ? (
            <CellPopulationLab onContinue={() => openSection('decisions')} />
          ) : null}
          {activeSection === 'decisions' ? (
            <DecisionLab
              responses={responses}
              onResponsesChange={setResponses}
              onContinue={() => openSection('atlas')}
            />
          ) : null}
          {activeSection === 'atlas' ? (
            <MorphologyLab onContinue={() => openSection('evidence')} />
          ) : null}
          {activeSection === 'evidence' ? <EvidenceAndLimits /> : null}
        </section>
      </div>
    </HandoffContent>
  )
}

function CorePlaybook({ onContinue }: { onContinue: () => void }) {
  return (
    <HandoffContent>
      <section className="container space-y-10">
        <SectionHeader
          eyebrow="The mental model"
          title="Three adequacy checks. Six moves. One clear call."
          description="A specimen can be technically readable but from the wrong place, or diagnostic on the rapid smear but insufficient for the tests that follow. Keep those judgments separate."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {roseAdequacyAxes.map((axis, index) => (
            <article
              key={axis.id}
              className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
            >
              <span
                className="absolute right-4 top-3 text-5xl font-semibold text-muted/80"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="relative space-y-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  {axis.id === 'representative' ? (
                    <Target className="h-5 w-5" aria-hidden />
                  ) : axis.id === 'interpretable' ? (
                    <Microscope className="h-5 w-5" aria-hidden />
                  ) : (
                    <TestTube2 className="h-5 w-5" aria-hidden />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{axis.title}</h3>
                  <p className="mt-1 text-sm font-medium text-sky-700 dark:text-sky-300">
                    {axis.question}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{axis.positiveSignal}</p>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm leading-6 text-amber-950 dark:text-amber-100">
                  <span className="font-semibold">Trap: </span>
                  {axis.trap}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <CircleDot
              className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
              aria-hidden
            />
            <div className="space-y-2 text-sm leading-6">
              <h3 className="font-semibold text-foreground">
                Do not count your way to false certainty
              </h3>
              <p className="text-muted-foreground">
                Lung-cytology adequacy has no single universal cell-count threshold across specimen
                types and clinical questions. Proposed lymph-node benchmarks can inform local
                practice, but morphology, site, clinical intent, preparation quality, and the
                laboratory’s validated criteria still matter.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-5">
            <h3 className="font-semibold text-foreground">Pass strategy is a separate decision</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              For suspected malignant EBUS-TBNA, CHEST recommends four or more needle passes (strong
              recommendation, very-low-certainty evidence). Clinical feasibility, local protocol,
              and ancillary needs still govern. This procedure-level strategy is not a universal
              cytology cell-count threshold.
            </p>
          </div>
          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
            <h3 className="font-semibold text-foreground">Protect the staging map</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use systematic rather than PET-target-only staging. When applicable, sample the
              highest-stage stations first (N3, then N2, then N1), label every station separately,
              and prevent carryover. A representative station does not complete mediastinal staging,
              and ROSE cannot assign overall TNM stage. A positive high-stage node may sometimes let
              the proceduralist avoid a higher-risk lesion biopsy, but it does not automatically end
              systematic staging or prove biomarker sufficiency.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
              The six-move loop
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              What to think before saying “adequate”
            </h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {roseFrameworkSteps.map((step) => (
              <article
                key={step.id}
                className="grid gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:grid-cols-[64px_minmax(0,1fr)]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 font-mono text-lg font-semibold text-white dark:bg-slate-100 dark:text-slate-950">
                  {step.number}
                </div>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm font-medium text-sky-700 dark:text-sky-300">
                      {step.question}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step.action}</p>
                  <p className="border-l-2 border-amber-500 pl-3 text-sm leading-6 text-amber-900 dark:text-amber-100">
                    {step.caution}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              Smear rescue
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Name the failure so the next pass can improve
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              “Inadequate” is more useful when the room also hears why: blood dilution, crush,
              necrosis-only material, or cells from the access path rather than the target.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {roseArtifactRescues.map((artifact) => (
              <article
                key={artifact.id}
                className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
              >
                <h3 className="font-semibold">{artifact.title}</h3>
                <dl className="mt-3 grid gap-3 text-sm leading-6">
                  <div>
                    <dt className="font-semibold text-foreground">What you see</dt>
                    <dd className="text-muted-foreground">{artifact.signal}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-amber-800 dark:text-amber-200">The trap</dt>
                    <dd className="text-muted-foreground">{artifact.risk}</dd>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-3">
                    <dt className="font-semibold text-emerald-800 dark:text-emerald-200">
                      Useful response
                    </dt>
                    <dd className="mt-1 text-muted-foreground">{artifact.response}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="rounded-2xl border-border/80">
            <CardHeader>
              <CardTitle>WHO categories are final-report vocabulary</CardTitle>
            </CardHeader>
            <CardContent className="gap-4 text-sm leading-6">
              <div className="flex flex-wrap gap-2">
                {[
                  'Insufficient / non-diagnostic',
                  'Benign',
                  'Atypical',
                  'Suspicious for malignancy',
                  'Malignant',
                ].map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-border bg-background px-3 py-1.5 font-medium"
                  >
                    {category}
                  </span>
                ))}
              </div>
              <p className="text-muted-foreground">
                They are useful shared language, but a rapid call should not pretend to be the final
                integrated report. At ROSE, say what proves representation, the broad finding, the
                limitation, and the requested specimen action.
              </p>
            </CardContent>
          </Card>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <MessageSquareText className="h-5 w-5" aria-hidden />
              <h3 className="font-semibold">The one-sentence call</h3>
            </div>
            <p className="mt-4 text-lg font-semibold leading-8 text-foreground">
              Target + representation + broad finding + limitation + requested action. Final
              pathology pending.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Avoid unqualified words such as “adequate,” “negative,” or a definitive stage. The
              room needs to know what you saw and what to do with the next material.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={onContinue}>
            Learn the cell populations
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </section>
    </HandoffContent>
  )
}

function DecisionLab({
  onContinue,
  onResponsesChange,
  responses,
}: {
  onContinue: () => void
  onResponsesChange: React.Dispatch<React.SetStateAction<Record<string, CaseResponse>>>
  responses: Record<string, CaseResponse>
}) {
  const [activeCaseId, setActiveCaseId] = React.useState(roseDecisionCases[0]?.id ?? '')
  const activeCase =
    roseDecisionCases.find((caseItem) => caseItem.id === activeCaseId) ?? roseDecisionCases[0]

  if (!activeCase) {
    return <HandoffContent>{null}</HandoffContent>
  }

  const response = responses[activeCase.id] ?? { revealed: false }
  const canReveal = Boolean(response.assessmentChoiceId && response.triageChoiceId)
  const completedCount = Object.values(responses).filter((item) => item.revealed).length
  const correctCount = roseDecisionCases.filter((caseItem) => {
    const caseResponse = responses[caseItem.id]
    return caseResponse?.revealed && isCaseCorrect(caseItem, caseResponse)
  }).length
  const currentIndex = roseDecisionCases.findIndex((caseItem) => caseItem.id === activeCase.id)
  const nextCase = roseDecisionCases[(currentIndex + 1) % roseDecisionCases.length]

  const updateResponse = (patch: Partial<CaseResponse>) => {
    onResponsesChange((current) => ({
      ...current,
      [activeCase.id]: {
        ...current[activeCase.id],
        revealed: current[activeCase.id]?.revealed ?? false,
        ...patch,
      },
    }))
  }

  const resetPractice = () => {
    onResponsesChange({})
    setActiveCaseId(roseDecisionCases[0]?.id ?? '')
  }

  return (
    <HandoffContent>
      <section className="container space-y-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            eyebrow="Commit before reveal"
            title="ROSE decision lab"
            description="For each case, commit to both the rapid assessment and the specimen action. Diagnostic titles, answer colors, and source labels stay hidden until you check the case."
          />
          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
            <div className="px-2 text-center">
              <p className="text-2xl font-semibold">{completedCount}</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </div>
            <div className="h-10 w-px bg-border" aria-hidden />
            <div className="px-2 text-center">
              <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {correctCount}
              </p>
              <p className="text-xs text-muted-foreground">both correct</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Reset all cases"
              onClick={resetPractice}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-950 dark:text-amber-100">
          <span className="font-semibold">Team boundary: </span>
          ROSE communicates what is represented, what is seen, and what specimen need remains. The
          proceduralist decides whether another pass or target is safe based on the indication,
          complications, patient tolerance, and clinical feasibility.
        </div>

        <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="space-y-3 xl:sticky xl:top-48 xl:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Case queue
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {roseDecisionCases.map((caseItem, index) => {
                const caseResponse = responses[caseItem.id]
                const isComplete = Boolean(caseResponse?.revealed)
                const correct = isComplete && isCaseCorrect(caseItem, caseResponse)
                const active = caseItem.id === activeCase.id
                return (
                  <button
                    key={caseItem.id}
                    type="button"
                    onClick={() => setActiveCaseId(caseItem.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-border/80 bg-card hover:border-sky-500/40',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
                        !isComplete && 'bg-muted text-muted-foreground',
                        isComplete &&
                          correct &&
                          'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        isComplete &&
                          !correct &&
                          'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {isComplete ? (
                        correct ? (
                          <Check className="h-4 w-4" aria-hidden />
                        ) : (
                          <RotateCcw className="h-4 w-4" aria-hidden />
                        )
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">Case {index + 1}</span>
                      <span className="block truncate text-sm font-semibold">{caseItem.focus}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <article className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            <div className="border-b border-border/80 bg-gradient-to-r from-slate-950 to-slate-900 p-5 text-white sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/15 bg-white/10 text-slate-200">
                  Case {currentIndex + 1} · {activeCase.focus}
                </Badge>
                {response.revealed ? (
                  <Badge
                    className={cn(
                      'border-transparent',
                      isCaseCorrect(activeCase, response)
                        ? 'bg-emerald-400/15 text-emerald-200'
                        : 'bg-amber-400/15 text-amber-100',
                    )}
                  >
                    {isCaseCorrect(activeCase, response)
                      ? 'Both decisions correct'
                      : 'Review the decisions'}
                  </Badge>
                ) : (
                  <Badge className="border-white/15 bg-white/5 text-slate-300">
                    Answers hidden
                  </Badge>
                )}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                {activeCase.title}
              </h2>
              <dl className="mt-5 grid gap-4 text-sm leading-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                    Target
                  </dt>
                  <dd className="mt-1 text-slate-200">{activeCase.target}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                    Clinical question
                  </dt>
                  <dd className="mt-1 text-slate-200">{activeCase.clinicalQuestion}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-7 p-5 sm:p-7">
              <div
                className={cn(
                  'grid gap-5',
                  activeCase.image && 'lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]',
                )}
              >
                <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                    Rapid-smear finding
                  </p>
                  <p className="mt-3 text-base leading-7 text-foreground">
                    {activeCase.smearFinding}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    Decide what this proves about the target, then decide what the next material
                    needs to accomplish.
                  </p>
                </div>

                {activeCase.image ? (
                  <figure className="overflow-hidden rounded-2xl border border-border/80 bg-slate-950">
                    <img
                      key={activeCase.image.src}
                      src={activeCase.image.src}
                      alt={response.revealed ? activeCase.image.revealAlt : activeCase.image.alt}
                      loading="lazy"
                      decoding="async"
                      className="max-h-[360px] w-full object-contain"
                    />
                    <figcaption className="border-t border-white/10 px-4 py-3 text-xs leading-5 text-slate-300">
                      <span className="mb-1 block font-medium text-slate-200">
                        Illustrative reference image—not from this vignette.
                      </span>
                      {response.revealed ? (
                        <a
                          href={activeCase.image.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sky-300 hover:underline"
                        >
                          {activeCase.image.sourceLabel}
                        </a>
                      ) : (
                        'Teaching image · diagnosis and source label reveal after commitment'
                      )}
                      <span className="mt-1 block">
                        {activeCase.image.attribution} ·{' '}
                        <a
                          href={activeCase.image.licenseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {activeCase.image.license}
                        </a>
                      </span>
                    </figcaption>
                  </figure>
                ) : null}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <CaseDecisionGroup
                  label="Decision 1 · Assessment"
                  decision={activeCase.assessment}
                  choiceOffset={currentIndex}
                  selectedChoiceId={response.assessmentChoiceId}
                  revealed={response.revealed}
                  onSelect={(choiceId) => updateResponse({ assessmentChoiceId: choiceId })}
                />
                <CaseDecisionGroup
                  label="Decision 2 · Specimen action"
                  decision={activeCase.triage}
                  choiceOffset={currentIndex + 2}
                  selectedChoiceId={response.triageChoiceId}
                  revealed={response.revealed}
                  onSelect={(choiceId) => updateResponse({ triageChoiceId: choiceId })}
                />
              </div>

              {!response.revealed ? (
                <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-border p-4 sm:flex-row sm:items-center">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Select one assessment and one specimen action. Feedback stays hidden until you
                    commit.
                  </p>
                  <Button
                    type="button"
                    disabled={!canReveal}
                    onClick={() => updateResponse({ revealed: true })}
                  >
                    Check both decisions
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ) : (
                <CaseReveal caseItem={activeCase} response={response} />
              )}

              {response.revealed ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateResponse({
                        assessmentChoiceId: undefined,
                        triageChoiceId: undefined,
                        revealed: false,
                      })
                    }
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Retry this case
                  </Button>
                  {completedCount === roseDecisionCases.length ? (
                    <Button type="button" onClick={onContinue}>
                      Continue to morphology lab
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : nextCase ? (
                    <Button type="button" onClick={() => setActiveCaseId(nextCase.id)}>
                      Next case
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </HandoffContent>
  )
}

function CaseDecisionGroup({
  choiceOffset,
  decision,
  label,
  onSelect,
  revealed,
  selectedChoiceId,
}: {
  choiceOffset: number
  decision: RoseDecisionCase['assessment']
  label: string
  onSelect: (choiceId: string) => void
  revealed: boolean
  selectedChoiceId?: string
}) {
  const selectedChoice = decision.choices.find((choice) => choice.id === selectedChoiceId)
  const correctChoiceData = decision.choices.find(
    (choice) => choice.id === decision.correctChoiceId,
  )
  const isCorrect = selectedChoiceId === decision.correctChoiceId
  const normalizedOffset = choiceOffset % decision.choices.length
  const orderedChoices = [
    ...decision.choices.slice(normalizedOffset),
    ...decision.choices.slice(0, normalizedOffset),
  ]

  return (
    <HandoffContent>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </legend>
        <p className="text-base font-semibold leading-6">{decision.prompt}</p>
        <div className="grid gap-2">
          {orderedChoices.map((choice) => {
            const selected = choice.id === selectedChoiceId
            const correctChoice = choice.id === decision.correctChoiceId
            return (
              <button
                key={choice.id}
                type="button"
                disabled={revealed}
                aria-pressed={selected}
                onClick={() => onSelect(choice.id)}
                className={cn(
                  'rounded-xl border px-4 py-3 text-left text-sm leading-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-100',
                  !selected &&
                    !revealed &&
                    'border-border/80 bg-background hover:border-sky-500/50',
                  selected && !revealed && 'border-sky-500 bg-sky-500/10 text-foreground',
                  revealed &&
                    correctChoice &&
                    'border-emerald-500 bg-emerald-500/10 text-foreground',
                  revealed &&
                    selected &&
                    !correctChoice &&
                    'border-amber-500 bg-amber-500/10 text-foreground',
                  revealed &&
                    !selected &&
                    !correctChoice &&
                    'border-border/60 bg-muted/30 text-muted-foreground',
                )}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-sky-500 bg-sky-500' : 'border-muted-foreground/50',
                      revealed && correctChoice && 'border-emerald-500 bg-emerald-500',
                      revealed && selected && !correctChoice && 'border-amber-500 bg-amber-500',
                    )}
                  >
                    {(selected || (revealed && correctChoice)) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">{choice.label}</span>
                  {revealed && correctChoice ? (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Correct answer
                    </span>
                  ) : revealed && selected ? (
                    <span className="shrink-0 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Your choice
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
        {revealed && selectedChoice ? (
          <div
            className={cn(
              'rounded-xl border p-3 text-sm leading-6',
              isCorrect
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100',
            )}
          >
            <span className="font-semibold">{isCorrect ? 'Good decision. ' : 'Reconsider. '}</span>
            {selectedChoice.feedback}
          </div>
        ) : null}
        {revealed && !isCorrect && correctChoiceData ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-950 dark:text-emerald-100">
            <span className="font-semibold">Correct answer: {correctChoiceData.label}. </span>
            {correctChoiceData.feedback}
          </div>
        ) : null}
      </fieldset>
    </HandoffContent>
  )
}

function CaseReveal({
  caseItem,
  response,
}: {
  caseItem: RoseDecisionCase
  response: CaseResponse
}) {
  const correct = isCaseCorrect(caseItem, response)
  return (
    <HandoffContent>
      <div
        className={cn(
          'space-y-5 rounded-2xl border p-5',
          correct
            ? 'border-emerald-500/35 bg-emerald-500/10'
            : 'border-amber-500/35 bg-amber-500/10',
        )}
      >
        <p role="status" className="sr-only">
          {correct
            ? 'Both case decisions are correct. Expert feedback is now visible.'
            : 'One or more case decisions need review. Expert feedback is now visible.'}
        </p>
        <div className="flex items-start gap-3">
          {correct ? (
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          ) : (
            <XCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
          )}
          <div>
            <h3 className="font-semibold">
              {correct ? 'Both decisions align' : 'Compare your choices with the expert frame'}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              The goal is a useful preliminary category plus a specimen action—not a forced final
              diagnosis.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-current/15 bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Say this to the room
          </p>
          <blockquote className="mt-2 text-lg font-semibold leading-8 text-foreground">
            {caseItem.reveal.onsiteCall}
          </blockquote>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
          <div>
            <p className="text-sm font-semibold">Why this works</p>
            <ul className="mt-2 grid gap-2 text-sm leading-6 text-muted-foreground">
              {caseItem.reveal.reasoning.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-950 dark:text-amber-100">
            <p className="font-semibold">High-risk pitfall</p>
            <p className="mt-1">{caseItem.reveal.pitfall}</p>
          </div>
        </div>
      </div>
    </HandoffContent>
  )
}

function MorphologyLab({ onContinue }: { onContinue: () => void }) {
  const patternCards = [
    {
      title: 'Representative vs nonrepresentative',
      cue: 'First prove that the intended target—not merely the airway or blood—appears on the slide.',
      action:
        'If the target is absent, improve acquisition before spending the specimen on downstream tests.',
    },
    {
      title: 'Malignant epithelial pattern',
      cue: 'Reproducible crowded, cohesive atypical groups support a broad epithelial malignancy call.',
      action:
        'Protect validated preparations for final typing and biomarkers; avoid consuming every pass on smears.',
    },
    {
      title: 'Small blue-cell pattern',
      cue: 'High N:C ratio, molding, fine chromatin, apoptosis, necrosis, and crush form a pattern—not a final subtype by themselves.',
      action:
        'Preserve validated morphologic and ancillary preparations; consider lymphoid and other mimics.',
    },
    {
      title: 'Granulomatous / inflammatory pattern',
      cue: 'Epithelioid histiocytes, giant cells, necrosis, and acute inflammation can redirect the differential.',
      action:
        'Preserve validated cytology preparations and, when infection is suspected, sterile microbiology material; morphology alone does not establish etiology.',
    },
  ]

  return (
    <HandoffContent>
      <section className="space-y-8">
        <div className="container space-y-6">
          <SectionHeader
            eyebrow="Recognize enough to triage"
            title="Morphology lab"
            description="The original hotspot atlas now sits after the decision framework. Use it to connect visual features with broad patterns and pitfalls—not to substitute a hotspot label for an adequacy decision."
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {patternCards.map((pattern, index) => (
              <article
                key={pattern.title}
                className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                  Pattern {index + 1}
                </span>
                <h3 className="mt-2 font-semibold">{pattern.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{pattern.cue}</p>
                <p className="mt-3 border-l-2 border-emerald-500 pl-3 text-sm leading-6 text-foreground">
                  {pattern.action}
                </p>
              </article>
            ))}
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-950 dark:text-amber-100">
            <span className="font-semibold">Lab rule: </span>
            start in Quiz mode. Titles, source links, diagnostic labels, and explanations stay
            hidden until you answer. Switch to Learn mode when you want guided annotation review.
          </div>
        </div>

        <RapidOnsiteCytologyModule embedded />

        <div className="container flex justify-end">
          <Button type="button" onClick={onContinue}>
            Review evidence and limits
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </section>
    </HandoffContent>
  )
}

function EvidenceAndLimits() {
  return (
    <HandoffContent>
      <section className="container space-y-8">
        <SectionHeader
          eyebrow="Traceable teaching"
          title="Evidence, uncertainty, and safe use"
          description="This curriculum prioritizes recent EBUS specimen-handling guidance, the active CAP thoracic-specimen guideline, and the WHO lung-cytopathology reporting framework."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {roseReferences.map((reference) => (
            <article
              key={reference.id}
              className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <Badge variant="outline">{reference.sourceType}</Badge>
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${reference.title}`}
                  className="rounded-full border border-border p-2 text-muted-foreground transition-colors hover:border-sky-500/50 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{reference.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{reference.citation}</p>
              <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm leading-6">
                <span className="font-semibold">Used here: </span>
                {reference.useInModule}
              </div>
            </article>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-5">
            <div className="flex items-center gap-2 text-sky-800 dark:text-sky-200">
              <FlaskConical className="h-5 w-5" aria-hidden />
              <h2 className="font-semibold">What the evidence does not settle</h2>
            </div>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-2">
                <CircleDot className="mt-1 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                <span>
                  There is no single universal adequacy count for every pulmonary cytology specimen
                  and endpoint.
                </span>
              </li>
              <li className="flex gap-2">
                <CircleDot className="mt-1 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                <span>
                  Collection media, preparation types, molecular workflows, and pass strategies
                  require local validation and protocol alignment.
                </span>
              </li>
              <li className="flex gap-2">
                <CircleDot className="mt-1 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                <span>
                  CHEST recommends four or more passes for suspected malignant EBUS-TBNA (strong
                  recommendation, very-low-certainty evidence), but feasibility, local protocol, and
                  ancillary needs still govern.
                </span>
              </li>
              <li className="flex gap-2">
                <CircleDot className="mt-1 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                <span>
                  ROSE communicates findings and specimen needs; the proceduralist retains
                  responsibility for whether further sampling is safe and clinically appropriate.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-950 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <h2 className="font-semibold">Final safety boundary</h2>
                <p className="mt-2">
                  This module supports education and team communication. It is not a diagnostic
                  instrument, does not authorize independent ROSE interpretation, and cannot define
                  whether a real patient’s specimen is adequate. Use institutional procedures,
                  receiving-laboratory requirements, qualified cytopathology review, and clinical
                  judgment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </HandoffContent>
  )
}

function SectionHeader({
  description,
  eyebrow,
  title,
}: {
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <div className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p>
    </div>
  )
}

function isCaseCorrect(caseItem: RoseDecisionCase, response: CaseResponse | undefined) {
  return Boolean(
    response?.revealed &&
    response.assessmentChoiceId === caseItem.assessment.correctChoiceId &&
    response.triageChoiceId === caseItem.triage.correctChoiceId,
  )
}
