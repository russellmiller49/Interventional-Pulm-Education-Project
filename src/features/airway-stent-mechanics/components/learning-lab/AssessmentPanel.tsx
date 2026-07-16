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
  const [reviewedMissedIds, setReviewedMissedIds] = useState<string[]>([])
  const [revisedAnswers, setRevisedAnswers] = useState<Record<string, string>>({})
  const [revisedCommittedIds, setRevisedCommittedIds] = useState<string[]>([])
  const [revisedIncorrectIds, setRevisedIncorrectIds] = useState<string[]>([])
  const [completionReported, setCompletionReported] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const committed = new Set(committedIds)
  const score = useMemo(
    () =>
      items.reduce((total, item) => total + (answers[item.id] === item.correctChoiceId ? 1 : 0), 0),
    [answers, items],
  )
  const allCommitted = items.length > 0 && items.every((item) => committed.has(item.id))
  const mastery = score >= masteryThreshold
  const missedItems = submitted
    ? items.filter((item) => answers[item.id] !== item.correctChoiceId)
    : []
  const missedReviewComplete = missedItems.every((item) => reviewedMissedIds.includes(item.id))
  const missedRevisionComplete = missedItems.every((item) => revisedCommittedIds.includes(item.id))
  const masteryComplete = mastery && completionReported
  const masteryRemediationPending = submitted && mastery && !masteryComplete

  function submitAssessment() {
    if (!allCommitted || submitted) return
    const submittedMissedItems = items.filter((item) => answers[item.id] !== item.correctChoiceId)
    setSubmitted(true)
    if (!mastery || submittedMissedItems.length === 0) {
      setCompletionReported(mastery)
      onComplete({ attempt, mastery, score, total: items.length })
    }
  }

  function commitRevisedAnswer(item: LearningPrompt) {
    if (!masteryRemediationPending || !reviewedMissedIds.includes(item.id)) return
    const revisedChoiceId = revisedAnswers[item.id]
    if (!revisedChoiceId || revisedCommittedIds.includes(item.id)) return

    if (revisedChoiceId !== item.correctChoiceId) {
      setRevisedIncorrectIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      )
      return
    }

    const nextRevisedCommittedIds = revisedCommittedIds.includes(item.id)
      ? revisedCommittedIds
      : [...revisedCommittedIds, item.id]
    setRevisedCommittedIds(nextRevisedCommittedIds)
    setRevisedIncorrectIds((current) => current.filter((id) => id !== item.id))

    const allMissedItemsRevised = missedItems.every((missedItem) =>
      nextRevisedCommittedIds.includes(missedItem.id),
    )
    if (allMissedItemsRevised) {
      setCompletionReported(true)
      onComplete({ attempt, mastery: true, score, total: items.length })
    }
  }

  function retryAssessment() {
    if (mastery && !masteryComplete) return
    if (!mastery && !missedReviewComplete) return
    setAnswers({})
    setCommittedIds([])
    setReviewedMissedIds([])
    setRevisedAnswers({})
    setRevisedCommittedIds([])
    setRevisedIncorrectIds([])
    setCompletionReported(false)
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
              masteryComplete
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-amber-500/40 bg-amber-500/10',
            )}
          >
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Award className="h-5 w-5" aria-hidden />
              {masteryComplete
                ? 'Mastery reached'
                : masteryRemediationPending
                  ? 'Mastery threshold reached · remediation required'
                  : 'Assessment completed'}{' '}
              · {score}/{items.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {masteryComplete
                ? 'You consistently identified the controlling mechanical and clinical tradeoffs.'
                : masteryRemediationPending
                  ? 'Module completion remains open. Review each missed rationale and commit a defensible revised answer.'
                  : 'Module completion remains open. Review each missed rationale, then revise the plan on a new attempt.'}
            </p>
            {!mastery && missedItems.length ? (
              <fieldset className="mt-4 space-y-2">
                <legend className="text-sm font-semibold">Review missed decision domains</legend>
                {missedItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer gap-3 rounded-xl border bg-background p-3 text-sm leading-6"
                  >
                    <input
                      type="checkbox"
                      checked={reviewedMissedIds.includes(item.id)}
                      onChange={(event) =>
                        setReviewedMissedIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, item.id])]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                      className="mt-1 accent-cyan-600"
                    />
                    <span>
                      <strong>{item.title}</strong>
                      <span className="mt-1 block text-muted-foreground">{item.explanation}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            {masteryRemediationPending && missedItems.length ? (
              <fieldset className="mt-4 space-y-4">
                <legend className="text-sm font-semibold">
                  Review and revise missed decision domains
                </legend>
                {missedItems.map((item) => {
                  const reviewed = reviewedMissedIds.includes(item.id)
                  const revisedCommitted = revisedCommittedIds.includes(item.id)
                  const revisedIncorrect = revisedIncorrectIds.includes(item.id)

                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border bg-background p-4"
                      data-testid={`assessment-remediation-${item.id}`}
                    >
                      <label className="flex cursor-pointer gap-3 text-sm leading-6">
                        <input
                          type="checkbox"
                          checked={reviewed}
                          onChange={(event) =>
                            setReviewedMissedIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, item.id])]
                                : current.filter((id) => id !== item.id),
                            )
                          }
                          className="mt-1 accent-cyan-600"
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <span className="mt-1 block text-muted-foreground">
                            {item.explanation}
                          </span>
                        </span>
                      </label>

                      <fieldset className="mt-4" disabled={!reviewed || revisedCommitted}>
                        <legend className="text-sm font-semibold">Commit a revised answer</legend>
                        <div className="mt-2 space-y-2">
                          {item.choices.map((choice) => (
                            <label
                              key={choice.id}
                              className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm leading-6 focus-within:ring-2 focus-within:ring-cyan-500"
                            >
                              <input
                                type="radio"
                                name={`revised-${item.id}`}
                                value={choice.id}
                                checked={revisedAnswers[item.id] === choice.id}
                                onChange={() => {
                                  setRevisedAnswers((current) => ({
                                    ...current,
                                    [item.id]: choice.id,
                                  }))
                                  setRevisedIncorrectIds((current) =>
                                    current.filter((id) => id !== item.id),
                                  )
                                }}
                                className="mt-1 accent-cyan-600"
                              />
                              <span>{choice.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <button
                        type="button"
                        onClick={() => commitRevisedAnswer(item)}
                        disabled={!reviewed || !revisedAnswers[item.id] || revisedCommitted}
                        className="mt-3 min-h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {revisedCommitted ? 'Revised answer committed' : 'Commit revised answer'}
                      </button>
                      {revisedIncorrect ? (
                        <p
                          className="mt-2 text-sm text-amber-800 dark:text-amber-200"
                          role="status"
                        >
                          This revision still misses the controlling relationship. Reconsider the
                          rationale and commit another answer.
                        </p>
                      ) : null}
                    </article>
                  )
                })}
                <p className="text-xs font-semibold text-muted-foreground" role="status">
                  {revisedCommittedIds.length} of {missedItems.length} missed domains revised with a
                  defensible answer
                </p>
              </fieldset>
            ) : null}
            <button
              type="button"
              onClick={retryAssessment}
              disabled={
                mastery ? !masteryComplete || !missedRevisionComplete : !missedReviewComplete
              }
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
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
