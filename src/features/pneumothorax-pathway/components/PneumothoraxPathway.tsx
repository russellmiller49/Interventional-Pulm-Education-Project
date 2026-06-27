'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import {
  evaluateBothFrameworks,
  type Disposition,
  type FrameworkResult,
} from '../engine/frameworks'
import { getPneumothoraxCases } from '../scenarios/pneumothoraxCases'
import { HandoffContent } from '@/i18n/handoff'

const DISPOSITION_IDS: Disposition[] = [
  'observation',
  'aspiration',
  'ambulatory',
  'chest-drain',
  'escalate',
  'emergency',
]

export function PneumothoraxPathway() {
  const t = useTranslations('pneumothoraxPathway')
  const locale = useLocale()

  const cases = useMemo(() => getPneumothoraxCases(locale), [locale])

  const [caseId, setCaseId] = useState(cases[0]?.id ?? '')
  const [guess, setGuess] = useState<Disposition | null>(null)
  const [revealed, setRevealed] = useState(false)

  const clinicalCase = useMemo(
    () => cases.find((item) => item.id === caseId) ?? cases[0],
    [cases, caseId],
  )

  const result = useMemo(
    () => (clinicalCase ? evaluateBothFrameworks(clinicalCase) : null),
    [clinicalCase],
  )

  if (!clinicalCase || !result) {
    return <HandoffContent>{null}</HandoffContent>
  }

  function selectCase(id: string) {
    setCaseId(id)
    setGuess(null)
    setRevealed(false)
  }

  return (
    <HandoffContent>
      {
        <LessonScaffold
          title={t('pathway.scaffoldTitle')}
          objectives={t.raw('pathway.objectives') as string[]}
          howToUse={t.raw('pathway.howToUse') as string[]}
          clinicalAnchor={
            <div>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                {t('pathway.scenarioLabel')}
                <select
                  value={caseId}
                  onChange={(event) => selectCase(event.target.value)}
                  className="min-h-11 max-w-xl rounded-lg border border-input bg-background px-3"
                >
                  {cases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-3">{clinicalCase.learningCue}</p>
              <dl className="mt-4 grid gap-2 text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <Data
                  label={t('pathway.dataType')}
                  value={t(`pneumothoraxType.${clinicalCase.type}`)}
                />
                <Data
                  label={t('pathway.dataSymptoms')}
                  value={t(`symptomBurden.${clinicalCase.symptomBurden}`)}
                />
                <Data
                  label={t('pathway.dataSizeAccp')}
                  value={
                    clinicalCase.sizeCategory === 'large'
                      ? t('pathway.sizeLarge')
                      : t('pathway.sizeSmall')
                  }
                />
                <Data
                  label={t('pathway.dataAirLeak')}
                  value={
                    clinicalCase.persistentAirLeakDays
                      ? t('pathway.airLeakDays', {
                          days: clinicalCase.persistentAirLeakDays,
                        })
                      : t('pathway.airLeakNone')
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
                {result.agreement ? t('pathway.frameworksAgree') : t('pathway.frameworksDiverge')}:{' '}
                {t(`comparisonNote.${result.comparisonNoteCode}`)}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FrameworkCard
                  result={result.accp}
                  guessedRight={guess === result.accp.disposition}
                />
                <FrameworkCard
                  result={result.bts}
                  guessedRight={guess === result.bts.disposition}
                />
              </div>
              <div className="rounded-lg border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                <p className="font-semibold text-foreground">
                  {t('pathway.recurrencePreventionLabel')}
                </p>
                <p className="mt-1">
                  {t(`recurrencePrevention.${result.recurrencePreventionCode}`)}
                </p>
              </div>
            </div>
          }
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          canReveal={guess !== null}
          revealLabel={t('pathway.revealLabel')}
          keyTakeaway={<p>{t('pathway.keyTakeaway')}</p>}
        >
          <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold text-foreground">
              {t('pathway.predictHeading')}
            </h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {DISPOSITION_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={guess === id}
                  disabled={revealed}
                  onClick={() => setGuess(id)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
                >
                  {t(`disposition.${id}`)}
                </button>
              ))}
            </div>
          </div>
        </LessonScaffold>
      }
    </HandoffContent>
  )
}

function FrameworkCard({
  result,
  guessedRight,
}: {
  result: FrameworkResult
  guessedRight: boolean
}) {
  const t = useTranslations('pneumothoraxPathway')

  return (
    <HandoffContent>
      {
        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              {result.framework}
            </span>
            {guessedRight ? (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {t('pathway.matchesPrediction')}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-foreground">
            {t(`headline.${result.headlineCode}`)}
          </h3>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
            {result.rationaleCodes.map((code) => (
              <li key={code} className="rounded-lg border border-border bg-background p-3">
                {t(`rationale.${code}`)}
              </li>
            ))}
          </ul>
        </article>
      }
    </HandoffContent>
  )
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <HandoffContent>
      {
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide">{label}</dt>
          <dd className="mt-1 font-medium text-foreground">{value}</dd>
        </div>
      }
    </HandoffContent>
  )
}
