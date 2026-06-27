'use client'

import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { getPleuralAnalysisDisclaimer } from '../content/framework'
import { HandoffContent } from '@/i18n/handoff'

interface PleuralAnalysisHeaderProps {
  title: string
  description: string
}

export function PleuralAnalysisHeader({ title, description }: PleuralAnalysisHeaderProps) {
  const t = useTranslations('pleuralFluidAnalysis')
  const locale = useLocale()
  const pleuralAnalysisDisclaimer = getPleuralAnalysisDisclaimer(locale)

  return (
    <HandoffContent>
      {
        <section className="container min-w-0 space-y-5 overflow-hidden">
          <div className="max-w-4xl min-w-0 space-y-3">
            <Badge
              variant="info"
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            >
              {t('header.eyebrow')}
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
              <p className="max-w-3xl break-words text-base leading-7 text-muted-foreground md:text-lg">
                {description}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="min-w-0 break-words">{pleuralAnalysisDisclaimer}</p>
          </div>
        </section>
      }
    </HandoffContent>
  )
}
