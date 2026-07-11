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

import { BModeFramePanel } from '@/features/thoracic-ultrasound-simulator/components/BModeFramePanel'
import {
  activeProbePreset,
  ThoracicProbeControls,
} from '@/features/thoracic-ultrasound-simulator/components/ThoracicProbeControls'
import { ThoracicScene3D } from '@/features/thoracic-ultrasound-simulator/components/ThoracicScene3D'
import type { SelectedStructure } from '@/features/thoracic-ultrasound-simulator/types'
import type { LoadedThoracicCase } from '@/features/thoracic-ultrasound-simulator/loader/loadThoracicCase'
import { loadThoracicCase } from '@/features/thoracic-ultrasound-simulator/loader/loadThoracicCase'
import { useBModeFrame } from '@/features/thoracic-ultrasound-simulator/providers/useBModeFrame'
import type { ProbeStore } from '@/features/thoracic-ultrasound-simulator/state/probeStore'
import {
  createProbeStore,
  useProbeState,
} from '@/features/thoracic-ultrasound-simulator/state/probeStore'

import { pleuralSimulatorCases } from '../content/pleuralSimulatorCases'
import { scoreProbeWindow } from '../engine/scoring'
import { pleuralTissueModel } from '../engine/tissueModel'
import type { ProbeScore } from '../types'
import { CaseObjectives } from './CaseObjectives'
import { HandoffContent } from '@/i18n/handoff'

const patternOptions: { id: EffusionPattern; label: string }[] = [
  { id: 'simpleAnechoic', label: 'Simple anechoic' },
  { id: 'complexNonSeptated', label: 'Complex nonseptated' },
  { id: 'septatedLoculated', label: 'Septated or loculated' },
  { id: 'echogenic', label: 'Echogenic' },
  { id: 'noDrainableEffusion', label: 'No drainable effusion' },
]

function asEffusionPattern(value: string | null): EffusionPattern | null {
  return patternOptions.some((option) => option.id === value) ? (value as EffusionPattern) : null
}

export function PleuralUltrasoundSimulator() {
  const [loaded, setLoaded] = useState<LoadedThoracicCase | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const listing = pleuralSimulatorCases[0]

    loadThoracicCase(listing.manifestUrl)
      .then((result) => {
        if (!cancelled) {
          setLoaded(result)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Could not load simulator case.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const store = useMemo(
    () => (loaded ? createProbeStore(activeProbePreset(loaded.manifest).defaults) : null),
    [loaded],
  )

  if (error) {
    return (
      <HandoffContent>
        {
          <section className="container">
            <Callout variant="warning" title="Simulator assets could not load">
              {error}
            </Callout>
          </section>
        }
      </HandoffContent>
    )
  }

  if (!loaded || !store) {
    return (
      <HandoffContent>
        {
          <section className="container">
            <div className="flex min-h-[28rem] items-center justify-center rounded-lg border border-border/80 bg-card text-sm text-muted-foreground">
              Loading pleural simulator case...
            </div>
          </section>
        }
      </HandoffContent>
    )
  }

  return <LoadedSimulator loaded={loaded} store={store} />
}

function LoadedSimulator({ loaded, store }: { loaded: LoadedThoracicCase; store: ProbeStore }) {
  const { manifest, volume } = loaded
  const probe = useProbeState(store)
  const [answer, setAnswer] = useState<EffusionPattern | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [selectedStructure, setSelectedStructure] = useState<SelectedStructure | null>(null)
  const [cardiacMotionEnabled, setCardiacMotionEnabled] = useState(
    () =>
      typeof window === 'undefined' ||
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  const {
    frame,
    metrics,
    groundTruthKey,
    cardiacInPlane,
    cardiacMotionActive,
    heartRateBpm,
    probeType,
  } = useBModeFrame({
    manifest,
    volume,
    probe,
    width: 520,
    height: 620,
    model: pleuralTissueModel,
    cardiacMotionEnabled,
  })

  const groundTruth = asEffusionPattern(groundTruthKey)

  const score: ProbeScore | null = useMemo(() => {
    if (!metrics || !groundTruth) {
      return null
    }
    return scoreProbeWindow(metrics, answer, groundTruth)
  }, [metrics, answer, groundTruth])

  const classification = useMemo(() => {
    if (!groundTruth || !answer || !revealed) {
      return null
    }
    return scoreClassification(answer, groundTruth)
  }, [groundTruth, answer, revealed])

  const objectives = useMemo(
    () => manifest.learningTasks.map((task) => task.prompt),
    [manifest.learningTasks],
  )

  return (
    <HandoffContent>
      {
        <section className="container space-y-6">
          <Callout variant="warning" title="Educational simulation only">
            {manifest.safetyLabel} The image is synthetic and should not be used for diagnosis,
            treatment, or real procedure guidance.
          </Callout>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
            <div className="space-y-6">
              <ThoracicScene3D
                manifest={manifest}
                store={store}
                needleUnsafe={!(score?.needleTrajectorySafe ?? false)}
                selected={selectedStructure}
                onSelectStructure={setSelectedStructure}
              />
              <ThoracicProbeControls manifest={manifest} store={store} />
            </div>

            <div className="space-y-6">
              <BModeFramePanel
                frame={frame}
                depthCm={probe.depthCm}
                title={cardiacInPlane ? 'Cardiac phased-array B-mode' : 'Thoracic B-mode'}
                metricsActive={Boolean(metrics)}
                volume={volume}
                probe={probe}
                structures={manifest.structures}
                selected={selectedStructure}
                onIdentify={setSelectedStructure}
                probeType={probeType}
                cardiacMotion={
                  cardiacInPlane
                    ? {
                        enabled: cardiacMotionEnabled,
                        active: cardiacMotionActive,
                        heartRateBpm,
                        onToggle: () => setCardiacMotionEnabled((enabled) => !enabled),
                      }
                    : undefined
                }
              />
              {cardiacInPlane ? (
                <CardiacWindowGuide
                  heartRateBpm={heartRateBpm}
                  motionEnabled={cardiacMotionEnabled}
                />
              ) : (
                <>
                  <CaseObjectives objectives={objectives} metrics={metrics} score={score} />
                  <PatternClassifier
                    answer={answer}
                    revealed={revealed}
                    onAnswer={(next) => {
                      setAnswer(next)
                      setRevealed(false)
                    }}
                    onReveal={() => setRevealed(true)}
                    classification={classification}
                    groundTruth={groundTruth}
                    score={score}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      }
    </HandoffContent>
  )
}

function CardiacWindowGuide({
  heartRateBpm,
  motionEnabled,
}: {
  heartRateBpm: number | null
  motionEnabled: boolean
}) {
  return (
    <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Cardiac window</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Explore how probe position and rotation change a phased-array view of the heart.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Phased array</Badge>
          <Badge variant={motionEnabled ? 'success' : 'outline'}>
            {motionEnabled ? 'Cine running' : 'Cine paused'}
          </Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-muted/35 p-3">
          <p className="font-semibold text-foreground">What the image represents</p>
          <p className="mt-1">
            Dark spaces are procedural chamber blood pools. The granular muscular wall and bright
            endocardial or valve echoes move through an illustrative
            {heartRateBpm ? ` ${heartRateBpm.toFixed(0)} bpm` : ''} cycle.
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="font-semibold text-foreground">Interpretation limit</p>
          <p className="mt-1">
            This is not a patient-specific echo and must not be used to estimate chamber size,
            ejection fraction, valve function, or clinical findings.
          </p>
        </div>
      </div>
    </article>
  )
}

interface PatternClassifierProps {
  answer: EffusionPattern | null
  revealed: boolean
  onAnswer: (answer: EffusionPattern) => void
  onReveal: () => void
  classification: ReturnType<typeof scoreClassification> | null
  groundTruth: EffusionPattern | null
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
    <HandoffContent>
      {
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

          {revealed && classification && groundTruth ? (
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
              <p className="mt-2 font-medium">
                {describeManagement(patternToManagement[groundTruth])}
              </p>
            </div>
          ) : null}
        </article>
      }
    </HandoffContent>
  )
}
