'use client'

import { useMemo, useState } from 'react'

import { LessonScaffold } from '@/components/learning/LessonScaffold'

import { dynamicSignOptions, publicPleuralUltrasoundVideoAssets } from '../content/videoAssets'
import type { DynamicUltrasoundSign } from '../content/videoAssets'

const neutralVideoLabel = 'Lung ultrasound clip for dynamic-sign classification.'

export function DynamicSignsLab() {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<DynamicUltrasoundSign | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState({ correct: 0, attempted: 0 })

  const asset = publicPleuralUltrasoundVideoAssets[index]
  const total = publicPleuralUltrasoundVideoAssets.length

  const result = useMemo(
    () =>
      asset && answer
        ? {
            correct: answer === asset.groundTruth,
            teachingPoint: asset.teachingPoint,
          }
        : null,
    [answer, asset],
  )

  if (!asset) {
    return null
  }

  function reveal() {
    if (!answer || !asset || revealed) {
      return
    }

    const correct = answer === asset.groundTruth
    setScore((previous) => ({
      correct: previous.correct + (correct ? 1 : 0),
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
      title="Dynamic signs video lab"
      objectives={[
        'Recognize A-lines, B-lines, pleural-line irregularity, consolidation, and curtain/no-target views in motion.',
        'Separate lung-pattern findings from drainable pleural-fluid pockets.',
        'Use dynamic clips to decide whether to keep scanning, sample fluid, or think source control.',
      ]}
      howToUse={[
        'Watch the clip before using the choices as a clue.',
        'Commit to the dominant dynamic sign before checking the teaching point.',
        'Review why the clip is or is not a pleural-procedure target, then advance.',
      ]}
      clinicalAnchor={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Clip {index + 1} of {total}: {asset.neutralVignette}
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
            <p className="mt-2 text-xs text-muted-foreground dark:text-slate-300">
              Attribution: {asset.attribution}
              {' · '}
              <a
                href={asset.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-sky-500 underline-offset-4"
              >
                {asset.license}
              </a>
              {asset.convertedToMp4 ? ' · Converted to MP4 for browser playback' : ''}
            </p>
            <button
              type="button"
              onClick={next}
              className="mt-4 rounded-lg border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Next clip
            </button>
          </div>
        ) : null
      }
      revealed={revealed}
      onReveal={reveal}
      canReveal={answer !== null}
      revealLabel="Check my interpretation"
      keyTakeaway={
        <p>
          Motion matters. A-lines, B-lines, curtain sign, and consolidation may answer the lung
          question, but a pleural procedure still requires a discrete safe fluid pocket.
        </p>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
          <div className="bg-muted/40 p-4">
            <video
              key={asset.id}
              controls
              playsInline
              preload="metadata"
              aria-label={neutralVideoLabel}
              className="max-h-[34rem] w-full rounded-lg border border-border bg-black object-contain"
            >
              <source src={asset.localPath ?? asset.path} type="video/mp4" />
              Your browser does not support embedded video.
            </video>
          </div>
          {revealed ? (
            <div className="border-t border-border/80 p-4 text-xs leading-5 text-muted-foreground">
              <p>Source filename: {asset.sourceFilename}</p>
              <p className="mt-1">
                Source:{' '}
                <a
                  href={asset.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-sky-500 underline-offset-4"
                >
                  {asset.license}
                </a>
                {asset.attributionRequired ? ' with attribution required' : ''}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Classify the dynamic sign</h3>
          <div className="mt-4 grid gap-2">
            {dynamicSignOptions.map((option) => (
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
