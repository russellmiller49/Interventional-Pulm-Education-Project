'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { malignantEffusionAssets } from '../content/assets'
import {
  afterNondiagnosticTaps,
  postDrainageBranch,
  type LungExpansion,
  type ManagementArm,
} from '../engine/diagnostic'
import { HandoffContent } from '@/i18n/handoff'

const expansionIds: LungExpansion[] = ['full', 'partial', 'trapped']

const managementIds: ManagementArm[] = [
  'pleurodesisCandidate',
  'ipcOrRapidPleurodesis',
  'ipcPreferred',
]

const comparatorIds = ['thoracentesis', 'pleuroscopy', 'ipc', 'pleurodesis', 'combined'] as const

export function MalignantEffusionPathway() {
  const t = useTranslations('malignantEffusion.pathway')
  const tYield = useTranslations('malignantEffusion.yield')
  const tNondiagnostic = useTranslations('malignantEffusion.nondiagnostic')
  const tBranch = useTranslations('malignantEffusion.branch')

  const [tapCount, setTapCount] = useState(1)
  const [lungExpansion, setLungExpansion] = useState<LungExpansion>('partial')
  const [armGuess, setArmGuess] = useState<ManagementArm | null>(null)
  const [revealed, setRevealed] = useState(false)

  const tapRecommendation = afterNondiagnosticTaps(tapCount)
  const branch = postDrainageBranch(lungExpansion)
  const guessedCorrectly = armGuess === branch.arm

  const tapRecommendationText = tNondiagnostic(`${tapRecommendation.code}.recommendation`)
  const tapTeachingText = tNondiagnostic(`${tapRecommendation.code}.teachingPoint`)

  function chooseExpansion(next: LungExpansion) {
    setLungExpansion(next)
    setArmGuess(null)
    setRevealed(false)
  }

  return (
    <HandoffContent>
      {
        <LessonScaffold
          title={t('scaffoldTitle')}
          objectives={t.raw('objectives') as string[]}
          howToUse={t.raw('howToUse') as string[]}
          clinicalAnchor={<p>{t('clinicalAnchor')}</p>}
          reveal={
            <div className="space-y-4">
              <div
                className={
                  guessedCorrectly
                    ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
                    : 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-900 dark:text-amber-100'
                }
              >
                <h3 className="font-semibold">
                  {guessedCorrectly ? t('matchHeading') : t('compareHeading')}
                </h3>
                <p className="mt-2 text-base font-semibold">{t(`management.${branch.arm}`)}</p>
                <p className="mt-2">{tBranch(branch.arm)}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <RevealCard
                  title={t('revealCards.cytologyTitle')}
                  body={tYield('thoracentesis')}
                  note={t('revealCards.cytologyNote')}
                />
                <RevealCard
                  title={t('revealCards.tissueTitle')}
                  body={tapRecommendationText}
                  note={tapTeachingText}
                />
                <RevealCard
                  title={t('revealCards.higherYieldTitle')}
                  body={tYield('pleuroscopy')}
                  note={t('revealCards.higherYieldNote')}
                />
              </div>
            </div>
          }
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          canReveal={armGuess !== null}
          revealLabel={t('revealLabel')}
          keyTakeaway={<p>{t('keyTakeaway')}</p>}
        >
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
                <h3 className="text-xl font-semibold text-foreground">{t('escalationHeading')}</h3>
                <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
                  {t('tapCountLabel', { count: tapCount })}
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={tapCount}
                    onChange={(event) => setTapCount(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer accent-sky-600"
                  />
                </label>
                <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm leading-6">
                  <p className="font-semibold text-foreground">{tapRecommendationText}</p>
                  <p className="mt-2 text-muted-foreground">{tapTeachingText}</p>
                  <p className="mt-2 text-muted-foreground">{tYield('thoracentesis')}</p>
                </div>
              </article>

              <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
                <h3 className="text-xl font-semibold text-foreground">{t('expansionHeading')}</h3>
                <div className="mt-4 grid gap-2">
                  {expansionIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={lungExpansion === id}
                      onClick={() => chooseExpansion(id)}
                      className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {t(`expansion.${id}.label`)}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t(`expansion.${id}.description`)}
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            </div>

            <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground">{t('predictHeading')}</h3>
              <div className="mt-4 grid gap-2 lg:grid-cols-3">
                {managementIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={armGuess === id}
                    disabled={revealed}
                    onClick={() => setArmGuess(id)}
                    className="rounded-lg border border-border bg-background px-3 py-3 text-left text-sm font-semibold transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
                  >
                    {t(`management.${id}`)}
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground">{t('comparatorHeading')}</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {comparatorIds.map((id) => (
                  <div key={id} className="rounded-lg border border-border bg-background p-4">
                    <h4 className="text-sm font-semibold text-foreground">
                      {t(`comparator.${id}.title`)}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t(`comparator.${id}.body`)}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground">
                {t('imageReferencesHeading')}
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {malignantEffusionAssets.map((asset) => {
                  const altText = t(`imageAlt.${asset.id}`)
                  return (
                    <figure
                      key={asset.id}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      <img
                        src={asset.localPath ?? asset.path}
                        alt={altText}
                        className="h-48 w-full bg-muted object-contain"
                      />
                      <figcaption className="border-t border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
                        {altText} {t('attributionLabel')} {asset.attribution}
                      </figcaption>
                    </figure>
                  )
                })}
              </div>
            </article>

            <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
              <h3 className="text-xl font-semibold text-foreground">{t('reflectionHeading')}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('reflectionBody')}</p>
            </article>
          </div>
        </LessonScaffold>
      }
    </HandoffContent>
  )
}

function RevealCard({ body, note, title }: { body: string; note: string; title: string }) {
  return (
    <HandoffContent>
      {
        <article className="rounded-lg border border-border/80 bg-card p-5 text-sm leading-6 shadow-sm">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-muted-foreground">{body}</p>
          <p className="mt-2 text-muted-foreground">{note}</p>
        </article>
      }
    </HandoffContent>
  )
}
