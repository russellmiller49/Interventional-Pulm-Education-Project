'use client'

import { CheckCircle2, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import type { ClinicalDecisionPrompt, StentClinicalCase } from '../../engine/learningLabTypes'
import { ClinicalDebrief } from './ClinicalDebrief'
import { PhysicsLensDrawer } from './PhysicsLensDrawer'
import { SurveillancePlanBuilder } from './SurveillancePlanBuilder'

interface ClinicalCaseFlowProps {
  caseData: StentClinicalCase
  children?: ReactNode
  completedInteractionIds?: readonly string[]
  initiallyCompleted?: boolean
  requiredInteractionIds?: readonly string[]
  surveillancePlanCompleted?: boolean
  onCaseStarted?: (caseId: string) => void
  onComplete?: (caseId: string) => void
  onDecisionCommitted?: (details: {
    caseId: string
    choiceId: string
    decisionId: string
    initial: boolean
    revised: boolean
  }) => void
  onPhysicsLensOpen?: (caseId: string) => void
  onSurveillancePlanCompleted?: () => void
}

export function ClinicalCaseFlow({
  caseData,
  children,
  completedInteractionIds = [],
  initiallyCompleted = false,
  requiredInteractionIds = [],
  onCaseStarted,
  onComplete,
  onDecisionCommitted,
  onPhysicsLensOpen,
  onSurveillancePlanCompleted,
  surveillancePlanCompleted = false,
}: ClinicalCaseFlowProps) {
  const defensibleChoices = useMemo(
    () =>
      Object.fromEntries(
        caseData.decisions.map((decision) => [decision.id, decision.correctChoiceId]),
      ),
    [caseData.decisions],
  )
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>(() =>
    initiallyCompleted ? { ...defensibleChoices } : {},
  )
  const [committedChoices, setCommittedChoices] = useState<Record<string, string>>(() =>
    initiallyCompleted ? { ...defensibleChoices } : {},
  )
  const [completed, setCompleted] = useState(initiallyCompleted)
  const initialDecision = caseData.decisions[0]
  const initialCommitted = Boolean(initialDecision && committedChoices[initialDecision.id])
  const requiresSurveillancePlan = caseData.requiredForLesson !== false

  useEffect(() => {
    onCaseStarted?.(caseData.id)
  }, [caseData.id, onCaseStarted])

  const allDecisionsCurrent = useMemo(
    () =>
      caseData.decisions.every(
        (decision) =>
          Boolean(committedChoices[decision.id]) &&
          committedChoices[decision.id] === selectedChoices[decision.id],
      ),
    [caseData.decisions, committedChoices, selectedChoices],
  )
  const allDecisionsDefensible = useMemo(
    () =>
      allDecisionsCurrent &&
      caseData.decisions.every(
        (decision) => committedChoices[decision.id] === decision.correctChoiceId,
      ),
    [allDecisionsCurrent, caseData.decisions, committedChoices],
  )
  const requiredInteractionsComplete = requiredInteractionIds.every((interactionId) =>
    completedInteractionIds.includes(interactionId),
  )
  const surveillanceRequirementComplete = !requiresSurveillancePlan || surveillancePlanCompleted

  function commitDecision(decision: ClinicalDecisionPrompt, initial: boolean) {
    const choiceId = selectedChoices[decision.id]
    if (!choiceId) return
    const previousChoiceId = committedChoices[decision.id]
    if (previousChoiceId === choiceId) return
    setCommittedChoices((current) => ({ ...current, [decision.id]: choiceId }))
    onDecisionCommitted?.({
      caseId: caseData.id,
      choiceId,
      decisionId: decision.id,
      initial,
      revised: Boolean(previousChoiceId),
    })
  }

  function completeCase() {
    if (
      !allDecisionsDefensible ||
      !requiredInteractionsComplete ||
      !surveillanceRequirementComplete ||
      completed
    ) {
      return
    }
    setCompleted(true)
    onComplete?.(caseData.id)
  }

  return (
    <div className="space-y-6" data-testid={`clinical-case-${caseData.id}`}>
      <section
        className="overflow-hidden rounded-3xl border bg-card shadow-sm"
        aria-labelledby={`${caseData.id}-title`}
      >
        <div className="border-b bg-gradient-to-r from-cyan-500/10 via-background to-indigo-500/10 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-800 dark:text-cyan-200">
              Clinical case
            </span>
            <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
              {caseData.clinicalReviewStatus === 'reviewed'
                ? 'Clinically reviewed'
                : 'Draft · clinical review required'}
            </span>
          </div>
          <h3
            id={`${caseData.id}-title`}
            className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {caseData.title}
          </h3>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground sm:text-base">
            {caseData.stem}
          </p>
        </div>

        {initialDecision ? (
          <div className="p-5 sm:p-7">
            <DecisionCard
              decision={initialDecision}
              committedChoiceId={committedChoices[initialDecision.id]}
              selectedChoiceId={selectedChoices[initialDecision.id]}
              onSelect={(choiceId) =>
                setSelectedChoices((current) => ({
                  ...current,
                  [initialDecision.id]: choiceId,
                }))
              }
              onCommit={() => commitDecision(initialDecision, true)}
              title="Make the first clinical call"
            />
          </div>
        ) : null}
      </section>

      {initialCommitted ? (
        <>
          <section
            className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
            aria-labelledby={`${caseData.id}-findings-title`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
              Findings after commitment
            </p>
            <h3 id={`${caseData.id}-findings-title`} className="mt-2 text-xl font-bold">
              Information that should refine the plan
            </h3>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              {caseData.findings.map((finding) => (
                <div
                  key={finding.id}
                  className={
                    finding.emphasis === 'warning'
                      ? 'rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4'
                      : finding.emphasis === 'important'
                        ? 'rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4'
                        : 'rounded-2xl border bg-background p-4'
                  }
                >
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {finding.label}
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-foreground">{finding.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {children}

          {caseData.physicsLens ? (
            <PhysicsLensDrawer
              config={caseData.physicsLens}
              onOpen={() => onPhysicsLensOpen?.(caseData.id)}
            />
          ) : null}

          {caseData.decisions.slice(1).map((decision, index) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              committedChoiceId={committedChoices[decision.id]}
              selectedChoiceId={selectedChoices[decision.id]}
              onSelect={(choiceId) =>
                setSelectedChoices((current) => ({ ...current, [decision.id]: choiceId }))
              }
              onCommit={() => commitDecision(decision, false)}
              title={`Decision ${index + 2} of ${caseData.decisions.length}`}
            />
          ))}

          {requiresSurveillancePlan ? (
            <SurveillancePlanBuilder
              completed={surveillancePlanCompleted}
              mode={caseData.surveillancePlanMode}
              onComplete={onSurveillancePlanCompleted}
            />
          ) : null}

          <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Finalize the defensible plan</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Commit every decision and revise any choice that the debrief identifies as
                  incomplete. Required cases also need a committed surveillance or exit plan.
                  Optional visualization never gates completion.
                </p>
                {requiredInteractionIds.length ? (
                  <p className="mt-2 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
                    {
                      requiredInteractionIds.filter((id) => completedInteractionIds.includes(id))
                        .length
                    }{' '}
                    of {requiredInteractionIds.length} required clinical interactions complete
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={completeCase}
                disabled={
                  !allDecisionsDefensible ||
                  !requiredInteractionsComplete ||
                  !surveillanceRequirementComplete ||
                  completed
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {completed ? 'Case completed' : 'Complete clinical case'}
              </button>
            </div>
          </section>

          {completed ? <ClinicalDebrief takeaway={caseData.finalTakeaway} /> : null}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Commit to the opening decision to reveal findings, decision tools, and the optional
          physics lens.
        </div>
      )}
    </div>
  )
}

function DecisionCard({
  committedChoiceId,
  decision,
  onCommit,
  onSelect,
  selectedChoiceId,
  title,
}: {
  committedChoiceId?: string
  decision: ClinicalDecisionPrompt
  onCommit: () => void
  onSelect: (choiceId: string) => void
  selectedChoiceId?: string
  title: string
}) {
  const committedChoice = decision.options.find((option) => option.id === committedChoiceId)
  const correctChoice = decision.options.find((option) => option.id === decision.correctChoiceId)
  const revisionPending = Boolean(committedChoiceId && selectedChoiceId !== committedChoiceId)

  return (
    <section
      className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby={`${decision.id}-title`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
        {title}
      </p>
      <h3 id={`${decision.id}-title`} className="mt-2 text-xl font-bold leading-7">
        {decision.question}
      </h3>
      {decision.instruction ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{decision.instruction}</p>
      ) : null}

      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">{decision.question}</legend>
        {decision.options.map((option) => (
          <label
            key={option.id}
            className={
              selectedChoiceId === option.id
                ? 'flex cursor-pointer gap-3 rounded-xl border border-cyan-500/60 bg-cyan-500/10 p-4 focus-within:ring-2 focus-within:ring-cyan-500'
                : 'flex cursor-pointer gap-3 rounded-xl border bg-background p-4 hover:border-cyan-500/40 focus-within:ring-2 focus-within:ring-cyan-500'
            }
          >
            <input
              type="radio"
              name={decision.id}
              value={option.id}
              checked={selectedChoiceId === option.id}
              onChange={() => onSelect(option.id)}
              className="mt-1 accent-cyan-600"
            />
            <span className="text-sm leading-6">{option.label}</span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        onClick={onCommit}
        disabled={!selectedChoiceId || selectedChoiceId === committedChoiceId}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {committedChoiceId ? <RotateCcw className="h-4 w-4" aria-hidden /> : null}
        {committedChoiceId ? 'Revise and recommit' : 'Commit and reveal'}
      </button>
      {revisionPending ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-200" role="status">
          A revised choice is selected. Recommit it before finalizing the case.
        </p>
      ) : null}

      {committedChoice ? (
        <div
          className={
            committedChoice.id === decision.correctChoiceId
              ? 'mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4'
              : 'mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4'
          }
          aria-live="polite"
        >
          <p className="text-sm font-semibold">
            {committedChoice.id === decision.correctChoiceId
              ? 'Defensible choice'
              : 'Reconsider the controlling relationship'}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {committedChoice.rationale}
          </p>
          {committedChoice.id !== decision.correctChoiceId && correctChoice ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              A stronger answer is{' '}
              <strong className="text-foreground">{correctChoice.label}</strong>.{' '}
              {correctChoice.rationale}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
