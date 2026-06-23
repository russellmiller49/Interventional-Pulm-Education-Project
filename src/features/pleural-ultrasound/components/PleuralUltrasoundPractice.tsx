'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/cn'

import { DynamicSignsLab } from './DynamicSignsLab'
import { PatternRecognitionLab } from './PatternRecognitionLab'

type PracticeMode = 'patterns' | 'dynamicSigns'

const practiceModeIds: readonly PracticeMode[] = ['patterns', 'dynamicSigns']

export function PleuralUltrasoundPractice() {
  const t = useTranslations('pleuralUltrasound.practice.modes')
  const [mode, setMode] = useState<PracticeMode>('patterns')

  return (
    <div className="space-y-6">
      <section className="container max-w-4xl">
        <div className="grid gap-2 rounded-lg border border-border/80 bg-card p-2 shadow-sm sm:grid-cols-2">
          {practiceModeIds.map((modeId) => {
            const isActive = mode === modeId

            return (
              <button
                key={modeId}
                type="button"
                aria-pressed={isActive}
                onClick={() => setMode(modeId)}
                className={cn(
                  'rounded-md px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="block font-semibold">{t(`${modeId}.label`)}</span>
                <span className={cn('mt-1 block text-xs leading-5', isActive && 'text-sky-50')}>
                  {t(`${modeId}.description`)}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {mode === 'patterns' ? <PatternRecognitionLab /> : <DynamicSignsLab />}
    </div>
  )
}
