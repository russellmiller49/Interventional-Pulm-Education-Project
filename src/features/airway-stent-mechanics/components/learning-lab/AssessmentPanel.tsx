'use client'

import { Award, RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '@/lib/cn'

import type { LearningPrompt } from './PredictionCard'
import { PredictionCard } from './PredictionCard'

export interface AssessmentResult {
  attempt: number
  mastery: boolean
  score: number
  total: number
}

interface AssessmentPanelProps {
  attempt: number
  items: LearningPrompt[]
  masteryThreshold: number
  onComplete: (result: AssessmentResult) => void
  onRetry: () => void
}

export function AssessmentPanel({
  attempt,
  items,
  masteryThreshold,
  onComplete,
  onRetry,
}: AssessmentPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [committedIds, setCommittedIds] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  const committed = new Set(committedIds)
  const score = useMemo(
    () =>
      items.reduce((total, item) => total + (answers[item.id] === item.correctChoiceId ? 1 : 0), 0),
    [answers, items],
  )
  const allCommitted = items.length > 0 && items.every((item) => committed.has(item.id))
  const mastery = score >= masteryThreshold

  function submitAssessment() {
    if (!allCommitted || submitted) return
    setSubmitted(true)
    onComplete({ attempt, mastery, score, total: items.length })
  }

  function retryAssessment() {
    setAnswers({})
    setCommittedIds([])
    setSubmitted(false)
    onRetry()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
              Integrated assessment · attempt {attempt}
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Commit to all {items.length} decisions</h3>
          </div>
          <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
            Mastery: {masteryThreshold}/{items.length}
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Each answer locks before its rationale appears. Completing the module does not imply a
          patient-specific device recommendation or procedural credential.
        </p>
      </div>

      {items.map((item, index) => (
        <PredictionCard
          key={`${attempt}-${item.id}`}
          eyebrow={`Case ${index + 1} of ${items.length}`}
          prompt={item}
          selectedChoiceId={answers[item.id]}
          committed={committed.has(item.id)}
          onSelect={(choiceId) =>
            setAnswers((current) => ({
              ...current,
              [item.id]: choiceId,
            }))
          }
          onCommit={() => {
            if (!answers[item.id]) return
            setCommittedIds((current) =>
              current.includes(item.id) ? current : [...current, item.id],
            )
          }}
        />
      ))}

      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6" aria-live="polite">
        {!submitted ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">
                {committedIds.length} of {items.length} cases committed
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit becomes available after every explanation has been reviewed.
              </p>
            </div>
            <button
              type="button"
              onClick={submitAssessment}
              disabled={!allCommitted}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Submit assessment
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'rounded-2xl border p-5',
              mastery
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-amber-500/40 bg-amber-500/10',
            )}
          >
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Award className="h-5 w-5" aria-hidden />
              {mastery ? 'Mastery reached' : 'Assessment completed'} · {score}/{items.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mastery
                ? 'You consistently identified the controlling mechanical and clinical tradeoffs.'
                : 'Review the revealed rationales and retry when you are ready. Completion is recorded even when mastery is not yet reached.'}
            </p>
            <button
              type="button"
              onClick={retryAssessment}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Retry all cases
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
