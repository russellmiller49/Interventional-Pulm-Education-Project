'use client'

import { useMemo, useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { pneumothoraxCases } from '../scenarios/pneumothoraxCases'
import { evaluateBothFrameworks, type FrameworkResult } from '../engine/frameworks'

/**
 * PneumothoraxPathway.fixed.tsx
 *
 * Restores the ACCP-vs-BTS side-by-side comparison and adds a commit-first
 * interaction: the learner predicts the disposition before the frameworks
 * are revealed. Wrapped in LessonScaffold for consistent framing.
 *
 * Replace src/features/pneumothorax-pathway/components/PneumothoraxPathway.tsx.
 */

const guessOptions = [
  { id: 'observation', label: 'Observe / conservative' },
  { id: 'aspiration', label: 'Needle aspiration' },
  { id: 'ambulatory', label: 'Ambulatory device' },
  { id: 'chest-drain', label: 'Chest drain' },
  { id: 'escalate', label: 'Specialist escalation' },
  { id: 'emergency', label: 'Emergency decompression' },
] as const

export function PneumothoraxPathway() {
  const [caseId, setCaseId] = useState(pneumothoraxCases[0]?.id ?? '')
  const [guess, setGuess] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const clinicalCase = useMemo(
    () => pneumothoraxCases.find((item) => item.id === caseId) ?? pneumothoraxCases[0],
    [caseId],
  )

  const result = useMemo(
    () => (clinicalCase ? evaluateBothFrameworks(clinicalCase) : null),
    [clinicalCase],
  )

  if (!clinicalCase || !result) {
    return null
  }

  function selectCase(id: string) {
    setCaseId(id)
    setGuess(null)
    setRevealed(false)
  }

  return (
    <LessonScaffold
      title="Pneumothorax: ACCP 2001 vs BTS 2023"
      objectives={[
        'Run a case through both the ACCP 2001 and BTS 2023 frameworks.',
        'Explain why the frameworks agree on unstable patients but diverge on stable PSP.',
        'Identify whether size, symptoms, or air-leak timing is driving a given recommendation.',
      ]}
      howToUse={[
        'Pick a scenario. Read the one-line vignette.',
        'Predict the disposition before revealing — commit to an answer.',
        'Reveal both frameworks side by side and read the comparison note.',
      ]}
      clinicalAnchor={
        <div>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Scenario
            <select
              value={caseId}
              onChange={(event) => selectCase(event.target.value)}
              className="min-h-11 max-w-md rounded-lg border border-input bg-background px-3"
            >
              {pneumothoraxCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3">{clinicalCase.learningCue}</p>
        </div>
      }
      reveal={
        <div className="space-y-4">
          <div
            className={
              result.agreement
                ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-900 dark:text-emerald-100'
                : 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-medium text-amber-900 dark:text-amber-100'
            }
          >
            {result.agreement ? 'Frameworks agree' : 'Frameworks diverge'} — {result.comparisonNote}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FrameworkCard result={result.accp} guessedRight={guess === result.accp.disposition} />
            <FrameworkCard result={result.bts} guessedRight={guess === result.bts.disposition} />
          </div>
          <div className="rounded-lg border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">Recurrence prevention</p>
            <p className="mt-1">{result.recurrencePrevention}</p>
          </div>
        </div>
      }
      revealed={revealed}
      onReveal={() => setRevealed(true)}
      canReveal={guess !== null}
      revealLabel="Reveal both frameworks"
      keyTakeaway={
        <p>
          ACCP 2001 stratifies stable patients primarily by <strong>size</strong>; BTS 2023 moved to{' '}
          <strong>symptoms and patient priorities</strong>. Both treat instability as an emergency.
          The interesting cases are stable PSP, where they part ways.
        </p>
      }
    >
      {/* The commit step: predict before revealing */}
      <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          What would you do? Predict before revealing.
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {guessOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={guess === option.id}
              disabled={revealed}
              onClick={() => setGuess(option.id)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </LessonScaffold>
  )
}

function FrameworkCard({
  result,
  guessedRight,
}: {
  result: FrameworkResult
  guessedRight: boolean
}) {
  return (
    <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          {result.framework}
        </span>
        {guessedRight ? (
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            matches your prediction
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-foreground">{result.headline}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
        {result.rationale.map((item) => (
          <li key={item} className="rounded-lg border border-border bg-background p-3">
            {item}
          </li>
        ))}
      </ul>
    </article>
  )
}
