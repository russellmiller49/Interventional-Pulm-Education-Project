'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'

import { pleuralUltrasoundAssets } from '../content/assets'
import { describeManagement, patternToManagement, scoreClassification } from '../engine/patterns'
import type { EffusionPattern } from '../engine/types'

const patternOptions: { id: EffusionPattern; label: string }[] = [
  { id: 'simpleAnechoic', label: 'Simple anechoic' },
  { id: 'complexNonSeptated', label: 'Complex nonseptated' },
  { id: 'septatedLoculated', label: 'Septated / loculated' },
  { id: 'echogenic', label: 'Echogenic' },
]

export function PatternRecognitionLab() {
  const [assetId, setAssetId] = useState(pleuralUltrasoundAssets[0]?.id ?? '')
  const [answer, setAnswer] = useState<EffusionPattern | null>(null)

  const asset = useMemo(
    () => pleuralUltrasoundAssets.find((item) => item.id === assetId) ?? pleuralUltrasoundAssets[0],
    [assetId],
  )

  if (!asset) {
    return null
  }

  const score = answer ? scoreClassification(answer, asset.groundTruth) : null
  const management = describeManagement(patternToManagement[asset.groundTruth])

  return (
    <section className="container grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/80 p-5">
          <p className="text-sm font-medium text-muted-foreground">Case image</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">{asset.clinicalLabel}</h2>
        </div>
        <div className="bg-muted/40 p-4">
          <img
            src={asset.path}
            alt={asset.alt}
            className="max-h-[34rem] w-full rounded-lg border border-border bg-background object-contain"
          />
        </div>
        <div className="border-t border-border/80 p-5 text-sm leading-6 text-muted-foreground">
          <p>{asset.alt}</p>
          <p className="mt-2">Attribution: {asset.attribution}</p>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Select case
            <select
              value={assetId}
              onChange={(event) => {
                setAssetId(event.target.value)
                setAnswer(null)
              }}
              className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {pleuralUltrasoundAssets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.clinicalLabel}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <h3 className="text-base font-semibold text-foreground">Classify the pattern</h3>
          <div className="mt-4 grid gap-2">
            {patternOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={answer === option.id}
                onClick={() => setAnswer(option.id)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {score ? (
          <div
            className={
              score.correct
                ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-900 shadow-sm dark:text-emerald-100'
                : 'rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-sm leading-6 text-amber-900 shadow-sm dark:text-amber-100'
            }
          >
            <h3 className="font-semibold">{score.correct ? 'Correct' : 'Recalibrate'}</h3>
            <p className="mt-2">{score.teachingPoint}</p>
            <p className="mt-2 font-medium">{management}</p>
          </div>
        ) : null}

        <Button type="button" variant="secondary" onClick={() => setAnswer(null)}>
          Hide answer
        </Button>
      </aside>
    </section>
  )
}
