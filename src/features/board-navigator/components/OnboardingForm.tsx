'use client'

import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'

import {
  LEARNER_GOALS,
  SESSION_LENGTHS,
  type LearnerGoal,
  type LearnerProfile,
  type SessionLength,
} from '../engine/record'

export const GOAL_LABELS: Readonly<Record<LearnerGoal, { title: string; detail: string }>> = {
  board: {
    title: 'Board preparation',
    detail: 'Blueprint-weighted breadth and short daily plans toward a date.',
  },
  fellowship: {
    title: 'Fellowship learning',
    detail: 'Foundations first; prerequisites before the objectives that build on them.',
  },
  maintenance: {
    title: 'Knowledge maintenance',
    detail: 'Retention checks first, then whatever you choose to refresh.',
  },
}

/**
 * First visit: a goal, an optional board date and a session length. Three choices, no account,
 * stored on this device. Everything can be changed later from the Today screen.
 */
export function OnboardingForm({
  initial,
  onSave,
  onCancel,
}: {
  readonly initial?: LearnerProfile | null
  readonly onSave: (profile: LearnerProfile) => void
  readonly onCancel?: () => void
}) {
  const [goal, setGoal] = useState<LearnerGoal>(initial?.goal ?? 'board')
  const [examDate, setExamDate] = useState(initial?.examDate ?? '')
  const [sessionMinutes, setSessionMinutes] = useState<SessionLength>(initial?.sessionMinutes ?? 10)

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave({
      goal,
      examDate: goal === 'board' && /^\d{4}-\d{2}-\d{2}$/.test(examDate) ? examDate : null,
      sessionMinutes,
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-8" data-testid="navigator-onboarding">
      <fieldset className="grid gap-3">
        <legend className="text-base font-semibold">What brings you here?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {LEARNER_GOALS.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 text-sm transition ${
                goal === value
                  ? 'border-primary bg-primary/5'
                  : 'border-border/70 hover:bg-muted/40'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name="goal"
                  value={value}
                  checked={goal === value}
                  onChange={() => setGoal(value)}
                  className="accent-primary"
                />
                {GOAL_LABELS[value].title}
              </span>
              <span className="text-muted-foreground">{GOAL_LABELS[value].detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {goal === 'board' ? (
        <div className="grid gap-2">
          <label htmlFor="navigator-exam-date" className="text-base font-semibold">
            Board date, if you know it
          </label>
          <input
            id="navigator-exam-date"
            type="date"
            value={examDate}
            onChange={(event) => setExamDate(event.target.value)}
            className="h-10 w-full max-w-xs rounded-full border border-border/70 bg-background px-4 text-sm"
          />
          <p className="text-sm text-muted-foreground">
            Optional. It sets the pace of the plan; it is never used to estimate your result.
          </p>
        </div>
      ) : null}

      <fieldset className="grid gap-3">
        <legend className="text-base font-semibold">How long is a typical session?</legend>
        <div className="flex flex-wrap gap-2">
          {SESSION_LENGTHS.map((value) => (
            <label
              key={value}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium ${
                sessionMinutes === value
                  ? 'border-primary bg-primary/5'
                  : 'border-border/70 hover:bg-muted/40'
              }`}
            >
              <input
                type="radio"
                name="session"
                value={value}
                checked={sessionMinutes === value}
                onChange={() => setSessionMinutes(value)}
                className="accent-primary"
              />
              {value} minutes
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg">
          {initial ? 'Save' : 'Start'}
        </Button>
        {onCancel ? (
          <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground" data-storage-statement>
        Your plan and your evidence stay on this device. You can export or delete them from the
        Progress screen at any time.
      </p>
    </form>
  )
}
