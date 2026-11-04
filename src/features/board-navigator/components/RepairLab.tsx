'use client'

import type { Route } from 'next'
import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CalendarClock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/cn'

import { OBJECTIVES, objectiveById } from '../content/objectives'
import { labHref, mapHref, BOARD_NAVIGATOR_NAV_BASE, type LabMode } from '../content/routes'
import type { Task } from '../content/types'
import {
  closingSummary,
  evidenceFrom,
  LAB_STAGE_LABELS,
  labStages,
  type GradedResponse,
} from '../engine/lab'
import { evidenceFor, withEvidence, withReview, type EvidencePhase } from '../engine/record'
import { buildRecommendations } from '../engine/recommend'
import { daysUntil, scheduleAfterReview, scheduleFirstReview } from '../engine/schedule'
import { isDemonstrated } from '../engine/status'
import { StatusBadge } from './StatusBadge'
import { nowIso, useNavigatorRecord } from './useNavigatorRecord'
import { TaskRunner, type TaskCommit } from './tasks/TaskRunner'

/**
 * Screen C. One objective, five stages: Diagnose → Explain → Manipulate → Apply to a new case →
 * Close the loop. Each committed task writes one observation to the record; the close writes the
 * review schedule. In review mode only the retention check runs, on whichever task the learner has
 * seen least recently, so the same prompt is never the proof that the idea was retained.
 */
export function RepairLab({
  objectiveId,
  mode,
}: {
  readonly objectiveId: string
  readonly mode: LabMode
}) {
  const objective = objectiveById(objectiveId)
  const { record, hydrated, update } = useNavigatorRecord()
  const stages = useMemo(
    () => labStages(Boolean(objective.lab.repair.manipulate), mode),
    [objective, mode],
  )
  const [stageIndex, setStageIndex] = useState(0)
  const [diagnoseGraded, setDiagnoseGraded] = useState<GradedResponse | null>(null)
  const [verifyGraded, setVerifyGraded] = useState<GradedResponse | null>(null)
  const [closed, setClosed] = useState(false)
  const stage = stages[stageIndex]

  // In review mode, alternate the task so retention is shown on a different prompt each time.
  const reviewTask = useMemo<Task>(() => {
    const seen = evidenceFor(record, objective.id)
    const lastVerify = [...seen]
      .reverse()
      .find((entry) => entry.phase === 'verify' || entry.phase === 'review')
    return lastVerify?.taskId === objective.lab.verify.id
      ? objective.lab.diagnose
      : objective.lab.verify
    // The task is fixed when the lab opens; later record writes must not swap it mid-review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective.id, hydrated])

  function recordCommit(task: Task, phase: EvidencePhase, commit: TaskCommit) {
    const at = nowIso()
    update((current) => {
      let next = withEvidence(
        current,
        evidenceFrom(
          objective.id,
          task,
          phase,
          commit.graded,
          commit.usedHint,
          commit.confidence,
          at,
        ),
      )
      if (phase === 'review') {
        next = withReview(
          next,
          objective.id,
          scheduleAfterReview(current.reviews[objective.id], commit.graded.correct, at),
          at,
        )
      } else if (phase === 'verify') {
        const evidence = evidenceFor(next, objective.id)
        if (isDemonstrated(evidence)) {
          next = withReview(
            next,
            objective.id,
            current.reviews[objective.id] ?? scheduleFirstReview(at),
            at,
          )
        } else if (!commit.graded.correct) {
          next = withReview(next, objective.id, null, at)
        }
      }
      return next
    })
  }

  function advance() {
    if (stageIndex < stages.length - 1) setStageIndex(stageIndex + 1)
    if (stages[stageIndex + 1] === 'close') setClosed(true)
  }

  if (!hydrated) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-10" aria-busy="true" />
  }

  return (
    <div
      className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10 sm:px-6 lg:px-8"
      data-testid="repair-lab"
      data-stage={stage}
    >
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link
            href={mapHref(objective.id) as Route}
            className="text-primary underline-offset-4 hover:underline"
          >
            Knowledge map
          </Link>
          <span aria-hidden="true">/</span>
          <span>{mode === 'review' ? 'Retention check' : 'Repair lab'}</span>
          {objective.safetyCritical ? (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-300">
              Safety-critical decision
            </span>
          ) : null}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{objective.title}</h1>
        <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="Lab stages">
          {stages.map((entry, index) => (
            <li
              key={entry}
              aria-current={index === stageIndex ? 'step' : undefined}
              className={cn(
                'rounded-full border px-2.5 py-0.5',
                index === stageIndex
                  ? 'border-primary bg-primary/10 font-semibold text-primary'
                  : index < stageIndex
                    ? 'border-border/70 text-muted-foreground line-through'
                    : 'border-border/70 text-muted-foreground',
              )}
            >
              {LAB_STAGE_LABELS[entry]}
            </li>
          ))}
        </ol>
      </header>

      {stage === 'diagnose' ? (
        <TaskRunner
          key="diagnose"
          task={objective.lab.diagnose}
          stageLabel="Diagnose · where is the gap?"
          continueLabel="See the explanation"
          onCommit={(commit) => {
            setDiagnoseGraded(commit.graded)
            recordCommit(objective.lab.diagnose, 'diagnose', commit)
          }}
          onContinue={advance}
        />
      ) : null}

      {stage === 'explain' ? (
        <ExplainPanel objective={objective} diagnoseGraded={diagnoseGraded} onContinue={advance} />
      ) : null}

      {stage === 'manipulate' && objective.lab.repair.manipulate ? (
        <TaskRunner
          key="manipulate"
          task={objective.lab.repair.manipulate}
          stageLabel="Manipulate · change one thing"
          continueLabel="Apply it to a new case"
          onCommit={(commit) =>
            recordCommit(objective.lab.repair.manipulate!, 'manipulate', commit)
          }
          onContinue={advance}
        />
      ) : null}

      {stage === 'verify' ? (
        <TaskRunner
          key={mode === 'review' ? `review-${reviewTask.id}` : 'verify'}
          task={mode === 'review' ? reviewTask : objective.lab.verify}
          stageLabel={
            mode === 'review'
              ? 'Retention check · a different task'
              : 'Apply · a new case, same idea'
          }
          continueLabel="Close the loop"
          onCommit={(commit) => {
            setVerifyGraded(commit.graded)
            recordCommit(
              mode === 'review' ? reviewTask : objective.lab.verify,
              mode === 'review' ? 'review' : 'verify',
              commit,
            )
          }}
          onContinue={advance}
        />
      ) : null}

      {stage === 'close' && verifyGraded && closed ? (
        <ClosePanel
          objective={objective}
          mode={mode}
          diagnoseGraded={diagnoseGraded}
          verifyGraded={verifyGraded}
        />
      ) : null}
    </div>
  )
}

function ExplainPanel({
  objective,
  diagnoseGraded,
  onContinue,
}: {
  readonly objective: ReturnType<typeof objectiveById>
  readonly diagnoseGraded: GradedResponse | null
  readonly onContinue: () => void
}) {
  const misconception = diagnoseGraded?.misconceptionId
    ? objective.misconceptions.find((entry) => entry.id === diagnoseGraded.misconceptionId)
    : null
  return (
    <section
      className="grid gap-5 rounded-3xl border bg-card p-6 sm:p-8"
      aria-labelledby="explain-heading"
      data-testid="explain-panel"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        Explain · the governing principle
      </p>
      <h2 id="explain-heading" className="text-lg font-semibold leading-7">
        {objective.lab.repair.principle}
      </h2>
      {misconception ? (
        <div className="grid gap-1 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">The wrong model your answer matched</p>
          <p>“{misconception.label}”</p>
          <p className="text-muted-foreground">{misconception.repair}</p>
        </div>
      ) : null}
      <div className="grid gap-3 text-sm leading-7">
        {objective.lab.repair.explanation.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <p className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm leading-6">
        <span className="font-semibold">The distinction.</span> {objective.lab.repair.distinction}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" onClick={onContinue} data-testid="explain-continue">
          {objective.lab.repair.manipulate ? 'Try changing one thing' : 'Apply it to a new case'}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Sources: {objective.sourceIds.length} registered reference
          {objective.sourceIds.length === 1 ? '' : 's'}; listed on the curriculum page.
        </span>
      </div>
    </section>
  )
}

function ClosePanel({
  objective,
  mode,
  diagnoseGraded,
  verifyGraded,
}: {
  readonly objective: ReturnType<typeof objectiveById>
  readonly mode: LabMode
  readonly diagnoseGraded: GradedResponse | null
  readonly verifyGraded: GradedResponse
}) {
  const { record } = useNavigatorRecord()
  const now = nowIso()
  const review = record.reviews[objective.id]
  const misconceptionId = diagnoseGraded?.misconceptionId ?? verifyGraded.misconceptionId
  const misconceptionLabel = misconceptionId
    ? (objective.misconceptions.find((entry) => entry.id === misconceptionId)?.label ?? null)
    : null
  const summary = closingSummary({
    diagnose: mode === 'review' ? null : diagnoseGraded,
    verify: verifyGraded,
    distinction: objective.lab.repair.distinction,
    misconceptionLabel,
  })
  const next = buildRecommendations(record, now).find(
    (entry) => entry.objective.id !== objective.id,
  )
  const status = (() => {
    const evidence = evidenceFor(record, objective.id)
    return isDemonstrated(evidence)
      ? ('demonstrated' as const)
      : verifyGraded.correct
        ? ('exploring' as const)
        : ('needs-focus' as const)
  })()

  return (
    <section
      className="grid gap-5 rounded-3xl border bg-card p-6 sm:p-8"
      aria-labelledby="close-heading"
      data-testid="close-panel"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Close the loop</p>
      <h2 id="close-heading" className="text-xl font-bold leading-7">
        {summary.headline}
      </h2>
      <p className="text-sm leading-7">{summary.detail}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status now:</span>
        <StatusBadge status={status} />
      </div>
      <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <CalendarClock aria-hidden="true" className="size-4 text-primary" /> Review
        </p>
        {review ? (
          <p>
            A short check in {daysUntil(review, now)} day{daysUntil(review, now) === 1 ? '' : 's'},
            on a different task. If it holds, the interval lengthens; if not, the Navigator brings
            you back to the explanation.
          </p>
        ) : (
          <p>
            No review is scheduled yet. One is set once the idea is demonstrated on two different
            tasks.
          </p>
        )}
      </div>
      <div className="grid gap-2 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <BookOpen aria-hidden="true" className="size-4 text-primary" /> Go deeper
        </p>
        <ul className="grid gap-1">
          {objective.resources.map((resource) => (
            <li key={resource.href}>
              <Link
                href={resource.href as Route}
                className="text-primary underline-offset-4 hover:underline"
              >
                {resource.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-3 border-t pt-4">
        {next ? (
          <Button asChild size="lg">
            <Link href={labHref(next.objective.id, next.mode) as Route}>
              Next: {next.objective.title}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        ) : null}
        <Button asChild size="lg" variant="outline">
          <Link href={BOARD_NAVIGATOR_NAV_BASE as Route}>Back to Today</Link>
        </Button>
        {!verifyGraded.correct ? (
          <Button asChild size="lg" variant="ghost">
            <Link href={labHref(objective.id, 'repair') as Route}>Run this lab again</Link>
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {OBJECTIVES.length} pilot objectives. This status reflects your tasks on this device; it is
        not a result on any examination.
      </p>
    </section>
  )
}
