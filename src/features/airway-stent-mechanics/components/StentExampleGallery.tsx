'use client'

import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { useReducedMotion } from 'framer-motion'
import { Box, CheckCircle2, Gauge, Pause, Play, RotateCcw, ShieldAlert } from 'lucide-react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getStentExample,
  getStentModelAsset,
  stentExamples,
  type StentModelAssetId,
} from '@/features/airway-stent-mechanics/content/stentExamples'
import { getStentExamplePose } from '@/features/airway-stent-mechanics/engine/exampleAnimations'
import { cn } from '@/lib/cn'

import { ModelLoading, StentExampleScene } from './StentExampleScene'

const animationDurationMs = 6200

function phaseLabel(progress: number) {
  if (progress < 0.18) return 'Inspect reference geometry'
  if (progress < 0.7) return 'Apply prescribed deformation'
  if (progress < 0.92) return 'Observe the interface response'
  return 'Reveal teaching markers'
}

function ModelFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center bg-slate-950 p-8 text-center text-white">
      <div className="max-w-md rounded-3xl border border-amber-400/30 bg-amber-400/10 p-6">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-300" aria-hidden />
        <p className="mt-3 text-base font-semibold">The 3D specimen could not be displayed.</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          The prediction, explanation, numbered teaching points, and evidence boundary remain
          available. Retry the optimized model without reloading the lesson.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-slate-500 bg-slate-900 text-white hover:bg-slate-800"
          onClick={onRetry}
        >
          Retry model
        </Button>
      </div>
    </div>
  )
}

export function StentExampleGallery() {
  const reducedMotion = Boolean(useReducedMotion())
  const [exampleId, setExampleId] = useState(stentExamples[0].id)
  const example = getStentExample(exampleId)
  const [assetId, setAssetId] = useState<StentModelAssetId>(example.defaultAssetId)
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const progressRef = useRef(0)
  const animationStartProgress = useRef(0)
  const animationStartedAt = useRef(0)
  const { active: modelLoading, progress: modelLoadProgress } = useProgress()

  const asset = getStentModelAsset(assetId)
  const pairedAsset = asset.pairedAssetId ? getStentModelAsset(asset.pairedAssetId) : undefined
  const airwayAsset = getStentModelAsset('trachea-openface-stenosis')
  const pose = useMemo(
    () => getStentExamplePose(example.sceneKind, progress),
    [example.sceneKind, progress],
  )
  const correct = revealed && choiceId === example.correctChoiceId

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    if (!playing || reducedMotion) return
    animationStartProgress.current = progressRef.current
    animationStartedAt.current = performance.now()
    let frame = 0

    function tick(now: number) {
      const elapsed = now - animationStartedAt.current
      const next = Math.min(1, animationStartProgress.current + elapsed / animationDurationMs)
      setProgress(next)
      if (next >= 1) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, reducedMotion])

  function resetLearningState(nextAssetId = assetId) {
    setAssetId(nextAssetId)
    setChoiceId(null)
    setRevealed(false)
    setProgress(0)
    setPlaying(false)
  }

  function chooseExample(nextExampleId: string) {
    const nextExample = getStentExample(nextExampleId)
    setExampleId(nextExample.id)
    resetLearningState(nextExample.defaultAssetId)
    setRetryVersion((value) => value + 1)
  }

  function commitAndRun() {
    if (!choiceId) return
    setRevealed(true)
    if (reducedMotion) {
      setProgress(1)
      setPlaying(false)
    } else {
      setProgress(0)
      setPlaying(true)
    }
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false)
      return
    }
    if (progress >= 0.999) setProgress(0)
    setPlaying(true)
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-700/80 bg-slate-950 text-white shadow-2xl">
      <div className="border-b border-slate-700/80 px-5 py-5 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-200 hover:bg-cyan-300/10">
                Supplied 3D specimens
              </Badge>
              <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
                Draft review · provenance pending
              </Badge>
            </div>
            <h3 className="mt-3 text-2xl font-semibold">3D Mechanics Casebook</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              These are cleaned, decimated derivatives of the models in{' '}
              <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-cyan-200">
                3D assets/Stents
              </code>
              . Model labels follow the supplied filenames; geometry and product configuration have
              not been manufacturer-validated.
            </p>
          </div>
          <div className="grid min-w-52 grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3">
              <Box className="h-4 w-4 text-cyan-300" aria-hidden />
              <p className="mt-2 font-semibold">Lazy loaded</p>
              <p className="mt-1 text-slate-400">Selected specimen only</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3">
              <Gauge className="h-4 w-4 text-cyan-300" aria-hidden />
              <p className="mt-2 font-semibold">Web optimized</p>
              <p className="mt-1 text-slate-400">≤120k triangles</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid border-b border-slate-700/80 lg:grid-cols-[0.64fr_1.36fr]">
        <div className="border-b border-slate-700/80 p-4 lg:border-b-0 lg:border-r">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Choose a teaching example
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {stentExamples.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => chooseExample(candidate.id)}
                aria-pressed={candidate.id === example.id}
                className={cn(
                  'rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none',
                  candidate.id === example.id
                    ? 'border-cyan-300/70 bg-cyan-300/10'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-500',
                )}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                  Example {candidate.number}
                </span>
                <span className="mt-1 block text-sm font-semibold text-white">
                  {candidate.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {example.eyebrow}
          </p>
          <h4 className="mt-2 text-2xl font-semibold">{example.title}</h4>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{example.description}</p>

          {example.assetIds.length > 1 ? (
            <label className="mt-5 block max-w-xl rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Geometry specimen
              </span>
              <select
                value={asset.id}
                disabled={playing}
                onChange={(event) => {
                  resetLearningState(event.target.value as StentModelAssetId)
                  setRetryVersion((value) => value + 1)
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {example.assetIds.map((candidateId) => {
                  const candidate = getStentModelAsset(candidateId)
                  return (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.shortLabel}
                    </option>
                  )
                })}
              </select>
              <span className="mt-2 block text-xs leading-5 text-slate-400">
                {asset.family} · source: {asset.sourceFile} · optimized budget{' '}
                {asset.triangleBudget.toLocaleString()} triangles
              </span>
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.42fr)_minmax(320px,0.58fr)]">
        <div
          className="relative min-h-[520px] border-b border-slate-700/80 lg:min-h-[650px] lg:border-b-0 lg:border-r"
          role="img"
          aria-busy={modelLoading}
          aria-label={`${example.title}. Interactive prescribed deformation of ${asset.label}. Not finite-element analysis or measured product performance.`}
        >
          <p className="sr-only" aria-live="polite" role="status">
            {asset.label}. {phaseLabel(progress)}. Animation {playing ? 'playing' : 'paused'} at{' '}
            {Math.round(progress * 100)} percent.
          </p>
          {modelLoading ? (
            <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 rounded-full border border-slate-600 bg-slate-950/85 p-1.5">
              <div
                className="h-1.5 rounded-full bg-cyan-300 transition-[width] motion-reduce:transition-none"
                style={{ width: `${Math.max(4, modelLoadProgress)}%` }}
              />
              <span className="sr-only">Loading model: {Math.round(modelLoadProgress)}%</span>
            </div>
          ) : null}
          <CanvasErrorBoundary
            key={`${example.id}-${asset.id}-${retryVersion}`}
            fallback={<ModelFailure onRetry={() => setRetryVersion((value) => value + 1)} />}
          >
            <Canvas
              key={`${example.id}-${asset.id}-${retryVersion}`}
              dpr={[1, 1.65]}
              frameloop={playing ? 'always' : 'demand'}
              camera={{ position: [5.2, 0.7, 7.6], fov: 38, near: 0.01, far: 100 }}
              gl={{ antialias: true, alpha: false }}
            >
              <color attach="background" args={['#06101f']} />
              <fog attach="fog" args={['#06101f', 9, 15]} />
              <Suspense fallback={<ModelLoading />}>
                <StentExampleScene
                  asset={asset}
                  airwayAsset={airwayAsset}
                  example={example}
                  pairedAsset={example.sceneKind === 'cover' ? pairedAsset : undefined}
                  pose={pose}
                  revealed={revealed}
                />
              </Suspense>
            </Canvas>
          </CanvasErrorBoundary>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-slate-600/80 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur">
            Drag to orbit · scroll/pinch to zoom
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Predict before animation
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-white">{example.prompt}</p>
            <div className="mt-3 grid gap-2">
              {example.choices.map((choice) => {
                const isCorrect = choice.id === example.correctChoiceId
                const isSelected = choiceId === choice.id
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={revealed}
                    onClick={() => setChoiceId(choice.id)}
                    className={cn(
                      'rounded-2xl border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none',
                      !revealed && isSelected && 'border-violet-400 bg-violet-400/10',
                      !revealed && !isSelected && 'border-slate-700 bg-slate-900/70',
                      revealed && isCorrect && 'border-emerald-400/60 bg-emerald-400/10',
                      revealed && isSelected && !isCorrect && 'border-amber-400/60 bg-amber-400/10',
                      revealed && !isCorrect && !isSelected && 'border-slate-700 opacity-55',
                    )}
                  >
                    {choice.label}
                  </button>
                )
              })}
            </div>
            {!revealed ? (
              <Button
                type="button"
                disabled={!choiceId}
                onClick={commitAndRun}
                className="mt-4 w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200"
              >
                <Play className="h-4 w-4" aria-hidden />
                Lock prediction and run example
              </Button>
            ) : (
              <div
                className={cn(
                  'mt-4 rounded-2xl border p-4 text-sm leading-6',
                  correct
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                    : 'border-amber-400/40 bg-amber-400/10 text-amber-100',
                )}
                role="status"
              >
                <p className="flex items-center gap-2 font-semibold">
                  {correct ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : null}
                  {correct ? 'Mechanically sound.' : 'Reframe the controlling variable.'}
                </p>
                <p className="mt-1">{example.explanation}</p>
              </div>
            )}
          </div>

          {revealed ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Animation control
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{phaseLabel(progress)}</p>
                </div>
                {!reducedMotion ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-slate-600 bg-slate-950 text-white hover:bg-slate-800"
                    onClick={togglePlayback}
                  >
                    {playing ? (
                      <Pause className="h-4 w-4" aria-hidden />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden />
                    )}
                    {playing ? 'Pause' : progress >= 0.999 ? 'Replay' : 'Play'}
                  </Button>
                ) : null}
              </div>
              <label className="mt-4 block">
                <span className="sr-only">Animation progress</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(progress * 100)}
                  onChange={(event) => {
                    setPlaying(false)
                    setProgress(Number(event.target.value) / 100)
                  }}
                  className="w-full accent-cyan-300"
                />
              </label>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Reference</span>
                <span>{Math.round(progress * 100)}%</span>
                <span>Teaching markers</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => {
                  setPlaying(false)
                  setProgress(0)
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset pose
              </Button>
              {reducedMotion ? (
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Reduced motion is enabled, so the complete teaching pose is shown without cyclic
                  playback.
                </p>
              ) : null}
            </div>
          ) : null}

          {revealed ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Numbered teaching markers
              </p>
              <ol className="mt-3 grid gap-2 text-sm text-slate-200">
                {example.markerLabels.map((label, index) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
              <ul className="mt-4 grid gap-2 border-t border-slate-700 pt-4 text-xs leading-5 text-slate-300">
                {example.teachingPoints.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100">
            <p className="font-semibold">Evidence boundary</p>
            <p className="mt-1 text-amber-100/80">{example.boundary}</p>
            <p className="mt-2 text-amber-100/70">
              Source-document references: {example.sourceRefs.map((id) => `[${id}]`).join(' ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
