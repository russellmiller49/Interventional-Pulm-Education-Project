'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useMemo, useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'
import { Button } from '@/components/ui/button'

import { pretestItems, type PretestItem } from '../content/pretestItems'
import { comparePretestPosttest, scorePretest } from '../engine/pretest'
import { HandoffContent } from '@/i18n/handoff'

export type CoursePhase = 'pretest' | 'prescription' | 'posttest'

const pretestStorageKey = 'intro-pleural-course-pretest-v1'
const posttestStorageKey = 'intro-pleural-course-posttest-v1'
const phaseStorageKey = 'intro-pleural-course-phase-v1'

function loadRecord(key: string): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const saved = window.localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function loadPhase(): CoursePhase {
  if (typeof window === 'undefined') {
    return 'pretest'
  }

  const saved = window.localStorage.getItem(phaseStorageKey)
  return saved === 'pretest' || saved === 'prescription' || saved === 'posttest' ? saved : 'pretest'
}

export function IntroPleuralCourse() {
  const [phase, setPhase] = useState<CoursePhase>(loadPhase)
  const [pretestAnswers, setPretestAnswers] = useState<Record<string, string>>(() =>
    loadRecord(pretestStorageKey),
  )
  const [posttestAnswers, setPosttestAnswers] = useState<Record<string, string>>(() =>
    loadRecord(posttestStorageKey),
  )

  const pretestResult = useMemo(() => scorePretest(pretestAnswers, pretestItems), [pretestAnswers])
  const posttestResult = useMemo(
    () => scorePretest(posttestAnswers, pretestItems),
    [posttestAnswers],
  )
  const sectionDeltas = useMemo(
    () => comparePretestPosttest(pretestAnswers, posttestAnswers, pretestItems),
    [posttestAnswers, pretestAnswers],
  )

  const pretestAnsweredCount = Object.keys(pretestAnswers).length
  const posttestAnsweredCount = Object.keys(posttestAnswers).length
  const pretestComplete = pretestAnsweredCount === pretestItems.length
  const posttestComplete = posttestAnsweredCount === pretestItems.length

  function setCoursePhase(nextPhase: CoursePhase) {
    setPhase(nextPhase)
    window.localStorage.setItem(phaseStorageKey, nextPhase)
  }

  function updatePretestAnswer(itemId: string, optionId: string) {
    const next = { ...pretestAnswers, [itemId]: optionId }
    setPretestAnswers(next)
    window.localStorage.setItem(pretestStorageKey, JSON.stringify(next))
  }

  function updatePosttestAnswer(itemId: string, optionId: string) {
    const next = { ...posttestAnswers, [itemId]: optionId }
    setPosttestAnswers(next)
    window.localStorage.setItem(posttestStorageKey, JSON.stringify(next))
  }

  function reset() {
    setPretestAnswers({})
    setPosttestAnswers({})
    setPhase('pretest')
    window.localStorage.removeItem(pretestStorageKey)
    window.localStorage.removeItem(posttestStorageKey)
    window.localStorage.removeItem(phaseStorageKey)
  }

  return (
    <HandoffContent>
      {
        <LessonScaffold
          title="Adaptive intro course"
          objectives={[
            'Complete a baseline pretest without answer reveal.',
            'Use weak-section ranking to choose the next pleural modules.',
            'Repeat the same items as a posttest and compare section-level change.',
          ]}
          howToUse={[
            'Answer every pretest question; correctness stays hidden during the baseline pass.',
            'Review the prescription and work through the linked modules.',
            'Start the posttest when ready; explanations and section deltas appear there.',
          ]}
          clinicalAnchor={
            <p>
              Use this as the front door for the pleural curriculum: establish a baseline, route the
              learner to the highest-yield modules, then check whether the weak sections improved.
            </p>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-4">
              {phase === 'pretest' ? (
                <QuestionSet
                  answers={pretestAnswers}
                  items={pretestItems}
                  phase="pretest"
                  onAnswer={updatePretestAnswer}
                />
              ) : null}

              {phase === 'prescription' ? (
                <PrescriptionPanel
                  totalCorrect={pretestResult.totalCorrect}
                  total={pretestResult.total}
                  prescription={pretestResult.prescription}
                />
              ) : null}

              {phase === 'posttest' ? (
                <QuestionSet
                  answers={posttestAnswers}
                  items={pretestItems}
                  phase="posttest"
                  onAnswer={updatePosttestAnswer}
                />
              ) : null}
            </div>

            <aside className="h-fit space-y-4 rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:sticky lg:top-20">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Course phase</p>
                <h3 className="mt-1 text-2xl font-bold capitalize text-foreground">{phase}</h3>
                <div className="mt-4 grid gap-2">
                  <PhasePill active={phase === 'pretest'} label="1. Pretest" />
                  <PhasePill active={phase === 'prescription'} label="2. Prescription" />
                  <PhasePill active={phase === 'posttest'} label="3. Posttest" />
                </div>
              </div>

              {phase === 'pretest' ? (
                <div className="rounded-lg border border-border bg-background p-3 text-sm leading-6">
                  <p className="font-semibold text-foreground">
                    {pretestAnsweredCount} of {pretestItems.length} answered
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Baseline correctness stays hidden until the prescription phase.
                  </p>
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    disabled={!pretestComplete}
                    onClick={() => setCoursePhase('prescription')}
                  >
                    Generate prescription
                  </Button>
                </div>
              ) : null}

              {phase === 'prescription' ? (
                <div className="rounded-lg border border-border bg-background p-3 text-sm leading-6">
                  <p className="font-semibold text-foreground">
                    Baseline score: {pretestResult.totalCorrect}/{pretestResult.total}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Weakest sections are listed first. Work the links, then start the posttest.
                  </p>
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    onClick={() => setCoursePhase('posttest')}
                  >
                    Start posttest
                  </Button>
                </div>
              ) : null}

              {phase === 'posttest' ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-background p-3 text-sm leading-6">
                    <p className="font-semibold text-foreground">
                      Posttest score: {posttestResult.totalCorrect}/{posttestAnsweredCount || 0}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {posttestAnsweredCount} of {pretestItems.length} answered
                    </p>
                  </div>
                  <div className="space-y-2">
                    {sectionDeltas.map((delta) => (
                      <DeltaRow key={delta.section} delta={delta} />
                    ))}
                  </div>
                  {posttestComplete ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-900 dark:text-emerald-100">
                      Posttest complete. Use any flat or declining sections as the next review loop.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-2">
                {phase !== 'pretest' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCoursePhase('pretest')}
                  >
                    Review pretest
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" onClick={reset}>
                  Reset course progress
                </Button>
              </div>
            </aside>
          </div>
        </LessonScaffold>
      }
    </HandoffContent>
  )
}

function QuestionSet({
  answers,
  items,
  onAnswer,
  phase,
}: {
  answers: Record<string, string>
  items: readonly PretestItem[]
  onAnswer: (itemId: string, optionId: string) => void
  phase: 'pretest' | 'posttest'
}) {
  return (
    <HandoffContent>
      {
        <>
          {items.map((item, index) => {
            const selected = answers[item.id]
            const isAnswered = Boolean(selected)
            const isCorrect = selected === item.correctId
            const reveal = phase === 'posttest' && isAnswered

            return (
              <article
                key={item.id}
                className="rounded-lg border border-border/80 bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Question {index + 1}</span>
                  <span>{sectionLabel(item.section)}</span>
                  <span>Level {item.difficulty}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{item.stem}</h3>
                <div className="mt-4 grid gap-2">
                  {item.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected === option.id}
                      onClick={() => onAnswer(item.id, option.id)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm leading-6 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
                {reveal ? (
                  <div
                    className={
                      isCorrect
                        ? 'mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
                        : 'mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-amber-900 dark:text-amber-100'
                    }
                  >
                    <p className="font-semibold">{isCorrect ? 'Correct' : 'Review this branch'}</p>
                    <p className="mt-1">{item.explanation}</p>
                  </div>
                ) : null}
              </article>
            )
          })}
        </>
      }
    </HandoffContent>
  )
}

function PrescriptionPanel({
  prescription,
  total,
  totalCorrect,
}: {
  prescription: ReturnType<typeof scorePretest>['prescription']
  total: number
  totalCorrect: number
}) {
  return (
    <HandoffContent>
      {
        <div className="space-y-4">
          <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-foreground">
              Baseline score: {totalCorrect}/{total}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start with the lowest-percentage sections. Modules are linked directly so the weak
              areas become a study path instead of a score report.
            </p>
          </article>

          <div className="grid gap-4 md:grid-cols-2">
            {prescription.slice(0, 8).map((item) => (
              <article
                key={item.section}
                className="rounded-lg border border-border/80 bg-card p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold capitalize text-foreground">
                    {sectionLabel(item.section)}
                  </h3>
                  <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {item.percent}%
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {item.modules.map((module) => (
                    <Link
                      key={module.id}
                      href={module.route as Route}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-sky-700 underline decoration-sky-500/50 underline-offset-4 dark:text-sky-300"
                    >
                      {module.title}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      }
    </HandoffContent>
  )
}

function DeltaRow({ delta }: { delta: ReturnType<typeof comparePretestPosttest>[number] }) {
  const display =
    delta.delta === null
      ? `${delta.posttestAnswered}/${delta.total} answered`
      : `${delta.delta >= 0 ? '+' : ''}${delta.delta}%`

  return (
    <HandoffContent>
      {
        <div className="rounded-lg border border-border bg-background p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold capitalize text-foreground">
              {sectionLabel(delta.section)}
            </span>
            <span className="text-muted-foreground">{display}</span>
          </div>
          {delta.posttestPercent !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {delta.pretestPercent}% baseline to {delta.posttestPercent}% posttest
            </p>
          ) : null}
        </div>
      }
    </HandoffContent>
  )
}

function PhasePill({ active, label }: { active: boolean; label: string }) {
  return (
    <HandoffContent>
      {
        <div
          className={
            active
              ? 'rounded-lg border border-sky-500 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-800 dark:text-sky-200'
              : 'rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground'
          }
        >
          {label}
        </div>
      }
    </HandoffContent>
  )
}

function sectionLabel(section: string) {
  return section.replace('-', ' ')
}
