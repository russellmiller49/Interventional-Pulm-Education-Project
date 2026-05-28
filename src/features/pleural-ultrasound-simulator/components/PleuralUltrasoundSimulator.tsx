'use client'

import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import {
  describeManagement,
  patternToManagement,
  scoreClassification,
} from '@/features/pleural-ultrasound/engine/patterns'
import type { EffusionPattern } from '@/features/pleural-ultrasound/engine/types'

import { pleuralSimulatorCases } from '../content/pleuralSimulatorCases'
import { scoreProbeWindow } from '../engine/scoring'
import { simulatePleuralBMode } from '../engine/simulateBMode'
import type { PleuralProbeState, PleuralSimulatorCase, PleuralVolume, ProbeScore } from '../types'
import { CaseObjectives } from './CaseObjectives'
import { PleuralScene3D } from './PleuralScene3D'
import { ProbeControls } from './ProbeControls'
import { UltrasoundCanvas } from './UltrasoundCanvas'

const patternOptions: { id: EffusionPattern; label: string }[] = [
  { id: 'simpleAnechoic', label: 'Simple anechoic' },
  { id: 'complexNonSeptated', label: 'Complex nonseptated' },
  { id: 'septatedLoculated', label: 'Septated or loculated' },
  { id: 'echogenic', label: 'Echogenic' },
]

export function PleuralUltrasoundSimulator() {
  const [caseData, setCaseData] = useState<PleuralSimulatorCase | null>(null)
  const [volume, setVolume] = useState<PleuralVolume | null>(null)
  const [probe, setProbe] = useState<PleuralProbeState | null>(null)
  const [answer, setAnswer] = useState<EffusionPattern | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const listing = pleuralSimulatorCases[0]

    async function loadCase() {
      try {
        const manifestResponse = await fetch(listing.manifestUrl)
        if (!manifestResponse.ok) {
          throw new Error(`Could not load case manifest (${manifestResponse.status}).`)
        }
        const manifest = (await manifestResponse.json()) as PleuralSimulatorCase
        const labelmapResponse = await fetch(manifest.labelmapUrl)
        if (!labelmapResponse.ok) {
          throw new Error(`Could not load labelmap (${labelmapResponse.status}).`)
        }
        const labelmap = new Uint8Array(await labelmapResponse.arrayBuffer())

        if (cancelled) {
          return
        }

        setCaseData(manifest)
        setVolume({
          data: labelmap,
          geometry: manifest.volume,
          labels: manifest.labels,
        })
        setProbe(manifest.probeDefaults)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Could not load simulator case.',
          )
        }
      }
    }

    loadCase()

    return () => {
      cancelled = true
    }
  }, [])

  const frame = useMemo(() => {
    if (!volume || !probe) {
      return null
    }

    return simulatePleuralBMode({
      volume,
      probe,
      width: 520,
      height: 620,
    })
  }, [probe, volume])

  const score: ProbeScore | null = useMemo(() => {
    if (!caseData || !frame) {
      return null
    }

    return scoreProbeWindow(frame.metrics, answer, caseData.groundTruthPattern)
  }, [answer, caseData, frame])

  const classification = useMemo(() => {
    if (!caseData || !answer || !revealed) {
      return null
    }

    return scoreClassification(answer, caseData.groundTruthPattern)
  }, [answer, caseData, revealed])

  if (error) {
    return (
      <section className="container">
        <Callout variant="warning" title="Simulator assets could not load">
          {error}
        </Callout>
      </section>
    )
  }

  if (!caseData || !volume || !probe) {
    return (
      <section className="container">
        <div className="flex min-h-[28rem] items-center justify-center rounded-lg border border-border/80 bg-card text-sm text-muted-foreground">
          Loading pleural simulator case...
        </div>
      </section>
    )
  }

  return (
    <section className="container space-y-6">
      <Callout variant="warning" title="Educational simulation only">
        {caseData.safetyLabel} The image is synthetic and should not be used for diagnosis,
        treatment, or real procedure guidance.
      </Callout>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
        <div className="space-y-6">
          <PleuralScene3D
            caseData={caseData}
            probe={probe}
            needleUnsafe={!(score?.needleTrajectorySafe ?? false)}
          />
          <ProbeControls caseData={caseData} probe={probe} onChange={setProbe} />
        </div>

        <div className="space-y-6">
          <UltrasoundCanvas frame={frame} depthCm={probe.depthCm} />
          <CaseObjectives caseData={caseData} metrics={frame?.metrics ?? null} score={score} />
          <PatternClassifier
            answer={answer}
            revealed={revealed}
            onAnswer={(next) => {
              setAnswer(next)
              setRevealed(false)
            }}
            onReveal={() => setRevealed(true)}
            classification={classification}
            groundTruth={caseData.groundTruthPattern}
            score={score}
          />
        </div>
      </div>
    </section>
  )
}

interface PatternClassifierProps {
  answer: EffusionPattern | null
  revealed: boolean
  onAnswer: (answer: EffusionPattern) => void
  onReveal: () => void
  classification: ReturnType<typeof scoreClassification> | null
  groundTruth: EffusionPattern
  score: ProbeScore | null
}

function PatternClassifier({
  answer,
  revealed,
  onAnswer,
  onReveal,
  classification,
  groundTruth,
  score,
}: PatternClassifierProps) {
  return (
    <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Pattern classification</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Classify the current synthetic window, then compare it with the case target.
          </p>
        </div>
        <Badge variant={score?.patternClassificationCorrect ? 'success' : 'outline'}>
          {score?.patternClassificationCorrect ? 'Matched' : 'Unscored'}
        </Badge>
      </div>

      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Pleural ultrasound pattern</legend>
        {patternOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={answer === option.id}
            onClick={() => onAnswer(option.id)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
          >
            {option.label}
          </button>
        ))}
      </fieldset>

      <Button
        type="button"
        className="mt-4"
        variant="outline"
        disabled={!answer}
        onClick={onReveal}
      >
        Check classification
      </Button>

      {revealed && classification ? (
        <div
          className={
            classification.correct
              ? 'mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-900 dark:text-emerald-100'
              : 'mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-100'
          }
        >
          <p className="font-semibold">
            {classification.correct ? 'Correct' : 'Compare the pattern'}
          </p>
          <p className="mt-2">{classification.teachingPoint}</p>
          <p className="mt-2 font-medium">{describeManagement(patternToManagement[groundTruth])}</p>
        </div>
      ) : null}
    </article>
  )
}
