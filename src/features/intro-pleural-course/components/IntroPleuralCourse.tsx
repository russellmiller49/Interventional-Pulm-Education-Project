'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'

import { pretestItems } from '../content/pretestItems'
import { scorePretest } from '../engine/pretest'

const storageKey = 'intro-pleural-course-progress-v1'

export function IntroPleuralCourse() {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') {
      return {}
    }

    try {
      const saved = window.localStorage.getItem(storageKey)
      return saved ? (JSON.parse(saved) as Record<string, string>) : {}
    } catch {
      return {}
    }
  })

  const result = useMemo(() => scorePretest(answers, pretestItems), [answers])
  const answeredCount = Object.keys(answers).length
  const isComplete = answeredCount === pretestItems.length

  function updateAnswer(itemId: string, optionId: string) {
    const next = { ...answers, [itemId]: optionId }
    setAnswers(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function reset() {
    setAnswers({})
    window.localStorage.removeItem(storageKey)
  }

  return (
    <section className="container grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        {pretestItems.map((item, index) => {
          const selected = answers[item.id]
          const isAnswered = Boolean(selected)
          const isCorrect = selected === item.correctId

          return (
            <article
              key={item.id}
              className="rounded-lg border border-border/80 bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Question {index + 1}</span>
                <span>{item.section}</span>
                <span>Level {item.difficulty}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-foreground">{item.stem}</h2>
              <div className="mt-4 grid gap-2">
                {item.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected === option.id}
                    onClick={() => updateAnswer(item.id, option.id)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm leading-6 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
                  >
                    {option.text}
                  </button>
                ))}
              </div>
              {isAnswered ? (
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
      </div>

      <aside className="h-fit space-y-4 rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:sticky lg:top-20">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {answeredCount} of {pretestItems.length} answered
          </p>
          <h2 className="mt-1 text-2xl font-bold text-foreground">
            {result.totalCorrect}/{result.totalCorrect || answeredCount ? answeredCount : 0}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The prescription sorts weak sections first and links to the live modules that address
            them.
          </p>
        </div>

        <div className="space-y-2">
          {result.prescription.slice(0, 6).map((item) => (
            <div key={item.section} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold capitalize text-foreground">
                  {item.section}
                </span>
                <span className="text-xs text-muted-foreground">{item.percent}%</span>
              </div>
              <div className="mt-2 space-y-1">
                {item.modules.map((module) => (
                  <Link
                    key={module.id}
                    href={module.route as Route}
                    className="block text-sm text-sky-700 underline decoration-sky-500/50 underline-offset-4 dark:text-sky-300"
                  >
                    {module.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {isComplete ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-900 dark:text-emerald-100">
            Pretest complete. Use the ordered module list as your learning path, then repeat the
            same items as a posttest.
          </div>
        ) : null}

        <Button type="button" variant="secondary" onClick={reset}>
          Reset course progress
        </Button>
      </aside>
    </section>
  )
}
