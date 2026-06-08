'use client'

import { useState } from 'react'

import { cn } from '@/lib/cn'

import { DynamicSignsLab } from './DynamicSignsLab'
import { PatternRecognitionLab } from './PatternRecognitionLab'

type PracticeMode = 'patterns' | 'dynamicSigns'

const practiceModes: readonly {
  id: PracticeMode
  label: string
  description: string
}[] = [
  {
    id: 'patterns',
    label: 'Effusion patterns',
    description: 'Classify still images before reveal.',
  },
  {
    id: 'dynamicSigns',
    label: 'Dynamic signs',
    description: 'Interpret motion clips before reveal.',
  },
]

export function PleuralUltrasoundPractice() {
  const [mode, setMode] = useState<PracticeMode>('patterns')

  return (
    <div className="space-y-6">
      <section className="container max-w-4xl">
        <div className="grid gap-2 rounded-lg border border-border/80 bg-card p-2 shadow-sm sm:grid-cols-2">
          {practiceModes.map((practiceMode) => {
            const isActive = mode === practiceMode.id

            return (
              <button
                key={practiceMode.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setMode(practiceMode.id)}
                className={cn(
                  'rounded-md px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="block font-semibold">{practiceMode.label}</span>
                <span className={cn('mt-1 block text-xs leading-5', isActive && 'text-sky-50')}>
                  {practiceMode.description}
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
