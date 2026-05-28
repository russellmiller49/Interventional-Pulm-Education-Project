'use client'

import { useMemo, useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import {
  evaluateBothFrameworks,
  type Disposition,
  type FrameworkResult,
} from '../engine/frameworks'
import type { PneumothoraxCase } from '../engine/types'
import { pneumothoraxCases } from '../scenarios/pneumothoraxCases'

const guessOptions: { id: Disposition; label: string }[] = [
  { id: 'observation', label: 'Observation or conservative care' },
  { id: 'aspiration', label: 'Needle aspiration' },
  { id: 'ambulatory', label: 'Ambulatory device' },
  { id: 'chest-drain', label: 'Chest drain' },
  { id: 'escalate', label: 'Specialist escalation' },
  { id: 'emergency', label: 'Emergency decompression' },
]

const typeLabels: Record<PneumothoraxCase['type'], string> = {
  psp: 'Primary spontaneous pneumothorax',
  ssp: 'Secondary spontaneous pneumothorax',
  iatrogenic: 'Iatrogenic pneumothorax',
  traumatic: 'Traumatic pneumothorax',
}

const symptomLabels: Record<PneumothoraxCase['symptomBurden'], string> = {
  minimal: 'Minimal symptoms',
  moderate: 'Moderate symptoms',
  severe: 'Severe symptoms',
}

export function PneumothoraxPathway() {
  const [caseId, setCaseId] = useState(pneumothoraxCases[0]?.id ?? '')
  const [guess, setGuess] = useState<Disposition | null>(null)
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
      title="Pneumothorax: ACCP 2001 compared with BTS 2023"
      objectives={[
        'Run one case through the American College of Chest Physicians 2001 and British Thoracic Society 2023 frameworks.',
        'Explain why unstable patients converge while stable primary spontaneous pneumothorax can diverge.',
        'Identify whether size, symptoms, patient priorities, or air-leak timing is driving the recommendation.',
      ]}
      howToUse={[
        'Pick a scenario and review the stability, size, and symptom details.',
        'Predict the disposition before revealing the guideline comparison.',
        'Compare the two cards and decide why they agree or diverge.',
      ]}
      clinicalAnchor={
        <div>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Scenario
            <select
              value={caseId}
              onChange={(event) => selectCase(event.target.value)}
              className="min-h-11 max-w-xl rounded-lg border border-input bg-background px-3"
            >
              {pneumothoraxCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3">{clinicalCase.learningCue}</p>
          <dl className="mt-4 grid gap-2 text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <Data label="Type" value={typeLabels[clinicalCase.type]} />
            <Data label="Symptoms" value={symptomLabels[clinicalCase.symptomBurden]} />
            <Data
              label="Size for ACCP"
              value={clinicalCase.sizeCategory === 'large' ? 'Large' : 'Small'}
            />
            <Data
              label="Air leak"
              value={
                clinicalCase.persistentAirLeakDays
                  ? `${clinicalCase.persistentAirLeakDays} days`
                  : 'None'
              }
            />
          </dl>
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
            {result.agreement ? 'Frameworks agree' : 'Frameworks diverge'}: {result.comparisonNote}
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
          ACCP 2001 is useful as a historical size-and-stability comparator. BTS 2023 places more
          emphasis on symptoms, patient priorities, ambulatory pathways, and reliable follow-up.
        </p>
      }
    >
      <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">
          Predict the disposition before revealing the comparison
        </h3>
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
            Matches your prediction
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

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  )
}
