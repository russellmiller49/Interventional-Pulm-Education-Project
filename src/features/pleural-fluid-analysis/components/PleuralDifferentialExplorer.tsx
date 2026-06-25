'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SlidersHorizontal, Target } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

import { getPleuralDiseaseProfiles } from '../content/diseaseProfiles'
import { scoreDifferential } from '../engine/differential'
import type { DifferentialResult, PleuralFluidInput } from '../engine/types'
import { HandoffContent } from '@/i18n/handoff'

interface PleuralDifferentialExplorerProps {
  input: PleuralFluidInput
}

export function PleuralDifferentialExplorer({ input }: PleuralDifferentialExplorerProps) {
  const t = useTranslations('pleuralFluidAnalysis')
  const locale = useLocale()
  const diseaseProfiles = React.useMemo(() => getPleuralDiseaseProfiles(locale), [locale])

  const [contextEmphasis, setContextEmphasis] = React.useState(55)
  const [raritySensitivity, setRaritySensitivity] = React.useState(45)

  const differential = React.useMemo(
    () => scoreDifferential(input, { contextEmphasis, raritySensitivity }, diseaseProfiles),
    [contextEmphasis, diseaseProfiles, input, raritySensitivity],
  )

  const topScore = differential.visibleResults[0]?.score ?? 0

  return (
    <HandoffContent>
      {
        <section
          id="differential-engine"
          className="container grid min-w-0 scroll-mt-24 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]"
        >
          <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
                <SlidersHorizontal className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <Badge variant="info">{t('differential.badge')}</Badge>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {t('differential.title')}
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <SliderControl
                label={t('differential.contextEmphasis')}
                value={contextEmphasis}
                leftLabel={t('differential.contextEmphasisLeft')}
                rightLabel={t('differential.contextEmphasisRight')}
                onChange={setContextEmphasis}
              />
              <SliderControl
                label={t('differential.raritySensitivity')}
                value={raritySensitivity}
                leftLabel={t('differential.raritySensitivityLeft')}
                rightLabel={t('differential.raritySensitivityRight')}
                onChange={setRaritySensitivity}
              />
            </div>

            <div className="mt-5 rounded-lg border border-border/70 bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('differential.currentLens')}
              </p>
              <p className="mt-1 font-semibold">{t(`lens.${differential.lensLabelCode}`)}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t('differential.lensHelp')}
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge variant="secondary">{t('differential.mostProbable')}</Badge>
                <h2 className="mt-3 break-words text-2xl font-semibold tracking-tight">
                  {t('differential.rankedFromFindings')}
                </h2>
              </div>
              <div className="rounded-lg border border-border/70 bg-background px-3 py-2 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('differential.topScore')}
                </p>
                <p className="text-lg font-semibold">{topScore}%</p>
              </div>
            </div>

            <div className="mt-5 grid min-w-0 gap-3">
              {differential.visibleResults.map((result) => (
                <DifferentialResultCard key={result.disease.id} result={result} />
              ))}
            </div>
          </div>
        </section>
      }
    </HandoffContent>
  )
}

interface SliderControlProps {
  label: string
  value: number
  leftLabel: string
  rightLabel: string
  onChange: (value: number) => void
}

function SliderControl({ label, value, leftLabel, rightLabel, onChange }: SliderControlProps) {
  return (
    <HandoffContent>
      {
        <label className="grid gap-2 text-sm font-medium">
          <span className="flex items-center justify-between gap-3">
            <span>{label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {value}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-sky-600"
          />
          <span className="flex justify-between text-xs text-muted-foreground">
            <span>{leftLabel}</span>
            <span>{rightLabel}</span>
          </span>
        </label>
      }
    </HandoffContent>
  )
}

interface DifferentialResultCardProps {
  result: DifferentialResult
}

export function DifferentialResultCard({ result }: DifferentialResultCardProps) {
  const t = useTranslations('pleuralFluidAnalysis')

  return (
    <HandoffContent>
      {
        <article className="min-w-0 rounded-lg border border-border/70 bg-background p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-700 dark:text-sky-300">
                  {result.rank}
                </span>
                <h3 className="break-words font-semibold">{result.disease.name}</h3>
                <Badge
                  variant={result.disease.rarity === 'common' ? 'outline' : 'secondary'}
                  size="sm"
                >
                  {t(`rarity.${result.disease.rarity}`)}
                </Badge>
              </div>
              <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                {result.disease.summary}
              </p>
            </div>
            <ScoreBadge score={result.score} />
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                result.score >= 70
                  ? 'bg-emerald-600'
                  : result.score >= 45
                    ? 'bg-sky-600'
                    : 'bg-amber-500',
              )}
              style={{ width: `${result.score}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('differential.matchingClues')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.matchedEvidence.slice(0, 5).map((evidence) => (
                  <span
                    key={evidence}
                    className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300"
                  >
                    {evidence}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('differential.teachingMove')}
              </p>
              <p className="mt-2 break-words text-sm leading-6 text-foreground">
                {result.disease.teachingPearl}
              </p>
            </div>
          </div>
        </article>
      }
    </HandoffContent>
  )
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <HandoffContent>
      {
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold">
          <Target className="h-4 w-4 text-sky-700 dark:text-sky-300" aria-hidden />
          {score}%
        </span>
      }
    </HandoffContent>
  )
}
