'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import type { Route } from 'next'
import { ArrowLeft, CheckCircle2, Circle, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { PccmPublicAssessmentAttempt } from '@/features/pccm-intro-course/assessment'
import {
  formatPccmAssessmentKind,
  type PccmAssessmentKind,
} from '@/features/pccm-intro-course/types'

interface PccmAssessmentClientProps {
  attemptKind: PccmAssessmentKind
}

export function PccmAssessmentClient({ attemptKind }: PccmAssessmentClientProps) {
  const [attempt, setAttempt] = useState<PccmPublicAssessmentAttempt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const answeredCount = attempt?.answeredCount ?? 0
  const allAnswered = Boolean(attempt && answeredCount >= attempt.total)
  const title = useMemo(() => formatPccmAssessmentKind(attemptKind), [attemptKind])

  useEffect(() => {
    let active = true

    async function loadAttempt() {
      setError(null)
      setIsLoading(true)
      const response = await fetch(`/api/pccm-intro-course/assessments/${attemptKind}`, {
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => null)) as {
        attempt?: PccmPublicAssessmentAttempt
        error?: string
      } | null

      if (!active) {
        return
      }

      if (!response.ok || !payload?.attempt) {
        setError(payload?.error ?? 'Unable to load this assessment.')
      } else {
        setAttempt(payload.attempt)
      }

      setIsLoading(false)
    }

    loadAttempt()

    return () => {
      active = false
    }
  }, [attemptKind])

  async function chooseAnswer(questionId: string, optionId: string) {
    if (attempt?.submittedAt) {
      return
    }

    setPendingQuestionId(questionId)
    setError(null)
    try {
      const response = await fetch(`/api/pccm-intro-course/assessments/${attemptKind}`, {
        body: JSON.stringify({ optionId, questionId }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      })
      const payload = (await response.json().catch(() => null)) as {
        attempt?: PccmPublicAssessmentAttempt
        error?: string
      } | null

      if (!response.ok || !payload?.attempt) {
        setError(payload?.error ?? 'Unable to save that answer.')
        return
      }

      setAttempt(payload.attempt)
    } finally {
      setPendingQuestionId(null)
    }
  }

  async function submitAttempt() {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/pccm-intro-course/assessments/${attemptKind}`, {
        method: 'POST',
      })
      const payload = (await response.json().catch(() => null)) as {
        attempt?: PccmPublicAssessmentAttempt
        error?: string
      } | null

      if (!response.ok || !payload?.attempt) {
        setError(payload?.error ?? 'Unable to submit this assessment.')
        return
      }

      setAttempt(payload.attempt)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="container space-y-6 py-10">
      <header className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant={attempt?.phase === 'post' ? 'info' : 'outline'}>
            {attempt?.phase === 'post' ? 'Posttest' : 'Pretest'}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {attempt?.phase === 'post'
              ? 'Answer choices reveal the correct response and explanation after selection.'
              : 'Pretest responses are saved without revealing correctness or explanations.'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={'/pccm-intro-course' as Route}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Course dashboard
          </Link>
        </Button>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          <RefreshCw className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
          Loading assessment
        </div>
      ) : null}

      {attempt ? (
        <>
          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Answered</p>
              <p className="mt-1 text-2xl font-semibold">
                {answeredCount}/{attempt.total}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="mt-1 text-2xl font-semibold">
                {attempt.submittedAt ? 'Submitted' : 'In progress'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="mt-1 text-2xl font-semibold">
                {attempt.submittedAt && typeof attempt.score === 'number'
                  ? `${attempt.score}/${attempt.total}`
                  : 'Pending'}
              </p>
            </div>
          </section>

          <section className="space-y-4">
            {attempt.questions.map((question, questionIndex) => (
              <article className="rounded-lg border bg-card p-4" key={question.id}>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0">
                      {questionIndex + 1}
                    </Badge>
                    <h2 className="text-base font-semibold leading-6">{question.stem}</h2>
                  </div>
                  {question.imageUrl ? (
                    <Image
                      alt={`Question ${questionIndex + 1} reference image`}
                      className="max-h-[360px] w-full rounded-md border object-contain"
                      height={480}
                      src={question.imageUrl}
                      width={720}
                    />
                  ) : null}
                  <div className="grid gap-2">
                    {question.options.map((option) => {
                      const selected = question.selectedOptionId === option.id
                      const correct = question.reveal?.correctOptionId === option.id
                      const showCorrect = Boolean(question.reveal && correct)
                      const showIncorrect = Boolean(question.reveal && selected && !correct)

                      return (
                        <button
                          className={[
                            'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left text-sm transition',
                            selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
                            showCorrect ? 'border-emerald-500 bg-emerald-500/10' : '',
                            showIncorrect ? 'border-destructive bg-destructive/10' : '',
                          ].join(' ')}
                          disabled={Boolean(attempt.submittedAt || pendingQuestionId)}
                          key={option.id}
                          onClick={() => chooseAnswer(question.id, option.id)}
                          type="button"
                        >
                          {selected || showCorrect ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          )}
                          <span>{option.text}</span>
                        </button>
                      )
                    })}
                  </div>
                  {pendingQuestionId === question.id ? (
                    <p className="text-xs text-muted-foreground">Saving response...</p>
                  ) : null}
                  {question.reveal ? (
                    <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                      <p className="font-medium">
                        {question.reveal.isCorrect ? 'Correct' : 'Not quite'}
                      </p>
                      <p className="mt-1 text-muted-foreground">{question.reveal.explanation}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          <div className="sticky bottom-4 rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {attempt.submittedAt
                  ? 'This assessment has been submitted.'
                  : `${answeredCount}/${attempt.total} questions answered`}
              </p>
              <Button
                disabled={!allAnswered || Boolean(attempt.submittedAt) || isSubmitting}
                onClick={submitAttempt}
                type="button"
              >
                {isSubmitting ? 'Submitting...' : attempt.submittedAt ? 'Submitted' : 'Submit'}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  )
}
