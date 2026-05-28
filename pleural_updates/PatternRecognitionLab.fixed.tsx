'use client'

import { useMemo, useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { pleuralUltrasoundAssets } from '../content/assets'
import { describeManagement, patternToManagement, scoreClassification } from '../engine/patterns'
import type { EffusionPattern } from '../engine/types'

/**
 * PatternRecognitionLab.fixed.tsx
 *
 * Fixes the answer leak (the case title and alt text previously named the
 * pattern before the learner classified it) and adds a commit-first flow with
 * a running score so it behaves like a lab, not a flip-card.
 *
 * REQUIRES one content change in content/assets.ts: add two fields per asset —
 *   neutralVignette: string  // e.g. "62M, dyspnea, unilateral effusion on CXR"
 *   revealCaption: string    // the descriptive caption shown only AFTER answering
 * and STOP using clinicalLabel / the descriptive alt as the pre-answer heading.
 * Keep `alt` neutral (describe that it is a thoracic ultrasound image) until
 * reveal; show the descriptive caption in revealCaption after the learner
 * commits. This keeps WCAG alt text honest without giving away the answer.
 *
 * Replace src/features/pleural-ultrasound/components/PatternRecognitionLab.tsx.
 */

const patternOptions: { id: EffusionPattern; label: string }[] = [
  { id: 'simpleAnechoic', label: 'Simple anechoic' },
  { id: 'complexNonSeptated', label: 'Complex nonseptated' },
  { id: 'septatedLoculated', label: 'Septated / loculated' },
  { id: 'echogenic', label: 'Echogenic' },
]

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
    setScore((prev) => ({
      correct: prev.correct + (outcome.correct ? 1 : 0),
      attempted: prev.attempted + 1,
    }))
    setRevealed(true)
  }

  function next() {
    setIndex((prev) => (prev + 1) % total)
    setAnswer(null)
    setRevealed(false)
  }

  // Pre-answer the alt text stays neutral; the descriptive caption only appears on reveal.
  const neutralAlt = 'Thoracic ultrasound image of a pleural effusion for pattern classification.'

  return (
    <LessonScaffold
      title="Pleural ultrasound pattern recognition"
      objectives={[
        'Classify effusions as simple anechoic, complex nonseptated, septated/loculated, or echogenic.',
        'State the management implication of each pattern.',
        'Explain why a simple-looking effusion does not rule out an exudate.',
      ]}
      howToUse={[
        'Read the short vignette and study the image.',
        'Commit to a pattern before checking — no peeking.',
        'Reveal, read the teaching point, then advance to the next case.',
      ]}
      clinicalAnchor={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Case {index + 1} of {total}: {asset.neutralVignette ?? 'Unilateral pleural effusion.'}
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
            <h3 className="font-semibold">
              {result.correct ? 'Correct' : 'Not quite — recalibrate'}
            </h3>
            <p className="mt-2">{asset.revealCaption ?? asset.alt}</p>
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
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
          <div className="bg-muted/40 p-4">
            <img
              src={asset.path}
              alt={revealed ? asset.alt : neutralAlt}
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
