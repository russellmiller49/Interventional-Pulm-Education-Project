'use client'

import { useMemo, useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { pleuralUltrasoundAssets } from '../content/assets'
import { describeManagement, patternToManagement, scoreClassification } from '../engine/patterns'
import type { EffusionPattern } from '../engine/types'

const patternOptions: { id: EffusionPattern; label: string }[] = [
  { id: 'simpleAnechoic', label: 'Simple anechoic' },
  { id: 'complexNonSeptated', label: 'Complex nonseptated' },
  { id: 'septatedLoculated', label: 'Septated or loculated' },
  { id: 'echogenic', label: 'Echogenic' },
]

const neutralAlt = 'Pleural-space image for pattern classification.'

export function PatternRecognitionLab() {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<EffusionPattern | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState({ correct: 0, attempted: 0 })

  const asset = pleuralUltrasoundAssets[index]
  const total = pleuralUltrasoundAssets.length

  const result = useMemo(
    () => (asset && answer ? scoreClassification(answer, asset.groundTruth) : null),
    [answer, asset],
  )

  if (!asset) {
    return null
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
    <LessonScaffold
      title="Pleural ultrasound pattern recognition"
      objectives={[
        'Classify pleural fluid as simple anechoic, complex nonseptated, septated or loculated, or echogenic.',
        'Connect the pattern to sampling, drainage, or source-control thinking.',
        'Explain why ultrasound appearance must be paired with the clinical story.',
      ]}
      howToUse={[
        'Read the vignette and inspect the image without using the caption as a clue.',
        'Choose one pattern before checking the teaching point.',
        'Review the management implication, then advance to the next case.',
      ]}
      clinicalAnchor={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Case {index + 1} of {total}: {asset.neutralVignette}
          </p>
          <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
            Score: {score.correct}/{score.attempted}
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
            <h3 className="font-semibold">{result.correct ? 'Correct' : 'Not quite'}</h3>
            <p className="mt-2">{asset.revealCaption}</p>
            <p className="mt-2">{result.teachingPoint}</p>
            <p className="mt-2 font-medium">
              {describeManagement(patternToManagement[asset.groundTruth])}
            </p>
            <button
              type="button"
              onClick={next}
              className="mt-4 rounded-lg border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Next case
            </button>
          </div>
        ) : null
      }
      revealed={revealed}
      onReveal={reveal}
      canReveal={answer !== null}
      revealLabel="Check my classification"
      keyTakeaway={
        <p>
          Pleural ultrasound narrows the procedure plan, but it does not diagnose the cause alone.
          Simple fluid can still be exudative, and complex fluid should raise source-control
          questions when the story fits.
        </p>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
          <div className="bg-muted/40 p-4">
            <img
              src={asset.path}
              alt={revealed ? asset.revealCaption : neutralAlt}
              className="max-h-[34rem] w-full rounded-lg border border-border bg-background object-contain"
            />
          </div>
          {revealed ? (
            <div className="border-t border-border/80 p-4 text-xs leading-5 text-muted-foreground">
              Attribution: {asset.attribution}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Classify the pattern</h3>
          <div className="mt-4 grid gap-2">
            {patternOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={answer === option.id}
                disabled={revealed}
                onClick={() => setAnswer(option.id)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10 disabled:opacity-60"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </LessonScaffold>
  )
}
