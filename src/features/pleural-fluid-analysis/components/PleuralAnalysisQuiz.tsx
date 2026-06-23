'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, CheckCircle2, HelpCircle, RotateCcw, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import { getPleuralDiseaseProfiles } from '../content/diseaseProfiles'
import { getPleuralAnalysisQuizItems } from '../content/quizItems'

export function PleuralAnalysisQuiz() {
  const t = useTranslations('pleuralFluidAnalysis')
  const locale = useLocale()
  const pleuralAnalysisQuizItems = React.useMemo(
    () => getPleuralAnalysisQuizItems(locale),
    [locale],
  )
  const diseaseById = React.useMemo(
    () => new Map(getPleuralDiseaseProfiles(locale).map((disease) => [disease.id, disease])),
    [locale],
  )

  const [questionIndex, setQuestionIndex] = React.useState(0)
  const [selectedDiseaseId, setSelectedDiseaseId] = React.useState<string | null>(null)
  const [correctAnswers, setCorrectAnswers] = React.useState(0)
  const [answeredIds, setAnsweredIds] = React.useState<Set<string>>(() => new Set())

  const item = pleuralAnalysisQuizItems[questionIndex]
  const correctDisease = diseaseById.get(item.answerDiseaseId)
  const selectedDisease = selectedDiseaseId ? diseaseById.get(selectedDiseaseId) : undefined
  const isAnswered = selectedDiseaseId !== null
  const isCorrect = selectedDiseaseId === item.answerDiseaseId

  const selectAnswer = (diseaseId: string) => {
    if (isAnswered) {
      return
    }

    setSelectedDiseaseId(diseaseId)
    setAnsweredIds((current) => new Set(current).add(item.id))

    if (diseaseId === item.answerDiseaseId) {
      setCorrectAnswers((current) => current + 1)
    }
  }

  const goNext = () => {
    setSelectedDiseaseId(null)
    setQuestionIndex((current) => (current + 1) % pleuralAnalysisQuizItems.length)
  }

  const resetQuiz = () => {
    setQuestionIndex(0)
    setSelectedDiseaseId(null)
    setCorrectAnswers(0)
    setAnsweredIds(new Set())
  }

  return (
    <section id="quiz-mode" className="container min-w-0 scroll-mt-24">
      <div className="grid min-w-0 gap-5 rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
                <HelpCircle className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <Badge variant="info">{t('quiz.badge')}</Badge>
                <h2 className="mt-2 break-words text-2xl font-semibold tracking-tight">
                  {t('quiz.title')}
                </h2>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={resetQuiz}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t('quiz.reset')}
            </Button>
          </div>

          <div className="mt-5 rounded-lg border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.difficulty === 'rare' ? 'secondary' : 'outline'} size="sm">
                {t(`difficulty.${item.difficulty}`)}
              </Badge>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('quiz.questionProgress', {
                  current: questionIndex + 1,
                  total: pleuralAnalysisQuizItems.length,
                })}
              </span>
            </div>
            <p className="mt-3 break-words text-base font-semibold leading-7">{item.stem}</p>
            <div className="mt-4 grid gap-2">
              {item.findings.map((finding) => (
                <div
                  key={finding}
                  className="flex min-w-0 gap-2 text-sm leading-6 text-muted-foreground"
                >
                  <CheckCircle2
                    className="mt-1 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300"
                    aria-hidden
                  />
                  <span className="min-w-0 break-words">{finding}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
            {item.choices.map((choiceId) => {
              const disease = diseaseById.get(choiceId)
              const isChoiceSelected = choiceId === selectedDiseaseId
              const isAnswer = choiceId === item.answerDiseaseId

              return (
                <button
                  key={choiceId}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => selectAnswer(choiceId)}
                  className={cn(
                    'min-w-0 rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                    isAnswered && isAnswer
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : isChoiceSelected
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-border/80 bg-background hover:border-sky-500/50 hover:bg-muted/50',
                  )}
                >
                  <span className="block break-words font-semibold">
                    {disease?.name ?? choiceId}
                  </span>
                  {disease ? (
                    <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
                      {t('quiz.choiceMeta', {
                        family: disease.family,
                        rarity: t(`rarity.${disease.rarity}`),
                      })}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <aside className="min-w-0 rounded-lg border border-border/70 bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('quiz.score')}
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {correctAnswers}/{answeredIds.size || 0}
          </p>

          <div className="mt-5 min-h-[15rem] rounded-lg border border-border/70 bg-card p-4">
            {isAnswered ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle2
                      className="mt-1 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : (
                    <XCircle
                      className="mt-1 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">
                      {isCorrect ? t('quiz.correct') : t('quiz.notQuite')}
                    </h3>
                    <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                      {selectedDisease?.name
                        ? t('quiz.youChose', { name: selectedDisease.name })
                        : null}
                      {t('quiz.bestAnswer', {
                        name: correctDisease?.name ?? item.answerDiseaseId,
                      })}
                    </p>
                  </div>
                </div>
                <p className="break-words text-sm leading-6 text-muted-foreground">
                  {item.explanation}
                </p>
                {correctDisease ? (
                  <div className="rounded-lg border border-border/70 bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('quiz.memoryHook')}
                    </p>
                    <p className="mt-2 break-words text-sm leading-6">
                      {correctDisease.teachingPearl}
                    </p>
                  </div>
                ) : null}
                <Button type="button" onClick={goNext}>
                  {t('quiz.nextQuestion')}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <div className="flex h-full min-h-[13rem] flex-col justify-center gap-3 text-sm leading-6 text-muted-foreground">
                <p>{t('quiz.emptyState')}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
