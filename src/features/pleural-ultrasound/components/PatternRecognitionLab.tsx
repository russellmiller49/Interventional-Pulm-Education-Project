'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { publicPleuralUltrasoundAssets } from '../content/assets'
import { patternToManagement, scoreClassification } from '../engine/patterns'
import type { EffusionPattern } from '../engine/types'
import { HandoffContent } from '@/i18n/handoff'

const patternOptionIds: EffusionPattern[] = [
  'simpleAnechoic',
  'complexNonSeptated',
  'septatedLoculated',
  'echogenic',
  'noDrainableEffusion',
]

export function PatternRecognitionLab() {
  const t = useTranslations('pleuralUltrasound.patternLab')
  const tu = useTranslations('pleuralUltrasound')

  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<EffusionPattern | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState({ correct: 0, attempted: 0 })

  const asset = publicPleuralUltrasoundAssets[index]
  const total = publicPleuralUltrasoundAssets.length

  const result = useMemo(
    () => (asset && answer ? scoreClassification(answer, asset.groundTruth) : null),
    [answer, asset],
  )

  if (!asset) {
    return <HandoffContent>{null}</HandoffContent>
  }

  function reveal() {
    if (!answer || !asset || revealed) {
      return
    }

    const outcome = scoreClassification(answer, asset.groundTruth)
    setScore((previous) => ({
      correct: previous.correct + (outcome.correct ? 1 : 0),
      attempted: previous.attempted + 1,
    }))
    setRevealed(true)
  }

  function next() {
    setIndex((previous) => (previous + 1) % total)
    setAnswer(null)
    setRevealed(false)
  }

  return (
    <HandoffContent>
      {
        <LessonScaffold
          title={t('scaffoldTitle')}
          objectives={t.raw('objectives') as string[]}
          howToUse={t.raw('howToUse') as string[]}
          clinicalAnchor={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                {t('caseLabel', {
                  index: index + 1,
                  total,
                  vignette: tu(`vignette.${asset.id}`),
                })}
              </p>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
                {t('scoreLabel', {
                  correct: score.correct,
                  attempted: score.attempted,
                })}
              </span>
            </div>
          }
          reveal={
            result ? (
              <div
                className={
                  result.correct
                    ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
                    : 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-900 dark:text-amber-100'
                }
              >
                <h3 className="font-semibold">
                  {result.correct ? t('correctHeading') : t('incorrectHeading')}
                </h3>
                <p className="mt-2">{tu(`patternReveal.${asset.groundTruth}`)}</p>
                <p className="mt-2">{tu(`patternTeaching.${asset.groundTruth}`)}</p>
                <p className="mt-2 font-medium">
                  {tu(`management.${patternToManagement[asset.groundTruth]}`)}
                </p>
                <button
                  type="button"
                  onClick={next}
                  className="mt-4 rounded-lg border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('nextLabel')}
                </button>
              </div>
            ) : null
          }
          revealed={revealed}
          onReveal={reveal}
          canReveal={answer !== null}
          revealLabel={t('revealLabel')}
          keyTakeaway={<p>{t('keyTakeaway')}</p>}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
              <div className="bg-muted/40 p-4">
                <img
                  src={asset.localPath ?? asset.path}
                  alt={revealed ? tu(`patternReveal.${asset.groundTruth}`) : t('neutralAlt')}
                  className="max-h-[34rem] w-full rounded-lg border border-border bg-background object-contain"
                />
              </div>
              {revealed ? (
                <div className="border-t border-border/80 p-4 text-xs leading-5 text-muted-foreground">
                  <p>{t('attributionLabel', { attribution: asset.attribution })}</p>
                  <p className="mt-1">
                    {t('sourceLabel')}{' '}
                    <a
                      href={asset.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-sky-500 underline-offset-4"
                    >
                      {asset.license}
                    </a>
                    {asset.attributionRequired ? t('withAttribution') : ''}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
              <h3 className="text-base font-semibold text-foreground">{t('classifyHeading')}</h3>
              <div className="mt-4 grid gap-2">
                {patternOptionIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={answer === id}
                    disabled={revealed}
                    onClick={() => setAnswer(id)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
                  >
                    {t(`options.${id}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </LessonScaffold>
      }
    </HandoffContent>
  )
}
