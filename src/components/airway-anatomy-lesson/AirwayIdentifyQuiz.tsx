'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  Boxes,
  CheckCircle2,
  Flame,
  HelpCircle,
  MapPinned,
  MousePointer2,
  Trophy,
  XCircle,
} from 'lucide-react'

import { getNode, lobeColor, LOBE_LABELS } from '@/lib/airway-anatomy-lesson/airway-graph'
import {
  buildIdentifyQuestion,
  loadQuizFrames,
  QUIZ_EXCLUDED_NODE_IDS,
  type AirwayQuizQuestion,
  type QuizFramesData,
} from '@/lib/airway-anatomy-lesson/airway-quiz'
import {
  buildFindFrameCandidates,
  buildIndex,
  hitTestMarker,
  loadOverlayData,
  markersAtFrame,
  timeForFrame,
  type FrameMarker,
  type OverlayIndex,
} from '@/lib/airway-anatomy-lesson/video-atlas'
import { cn } from '@/lib/cn'

import { Airway3DModel } from './Airway3DModel'
import { CtCorrelationView } from './CtCorrelationView'

const RECENT_MEMORY = 6
const OUTLINE = '#22d3ee'

/** Flat [x,y,...] to SVG polygon points string "x,y x,y ...". */
function toPoints(poly: number[]): string {
  let points = ''
  for (let i = 0; i < poly.length; i += 2) {
    points += `${poly[i]},${poly[i + 1]} `
  }
  return points.trim()
}

function displayName(id: string, data?: QuizFramesData | null): string {
  return getNode(id)?.fullName ?? data?.structures[id]?.name ?? id
}

function randomItem<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)]
}

interface AirwayIdentifyQuizProps {
  onOpenStructure?: (id: string) => void
  className?: string
}

type AssessmentMode = 'name' | 'find'

export function AirwayIdentifyQuiz({ onOpenStructure, className }: AirwayIdentifyQuizProps) {
  const [mode, setMode] = useState<AssessmentMode>('name')

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-lg font-semibold text-foreground">Endoscopic anatomy challenge</h3>
          <p className="text-sm text-muted-foreground">
            Practice both directions: name a marked airway, then find a named airway on a paused
            bronchoscopy frame.
          </p>
        </div>
        <div className="flex rounded-lg border border-border/70 bg-card/70 p-0.5">
          {[
            { id: 'name' as const, label: 'Name the airway', icon: HelpCircle },
            { id: 'find' as const, label: 'Find the airway', icon: MousePointer2 },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  mode === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {mode === 'name' ? (
        <NameTheAirwayQuiz onOpenStructure={onOpenStructure} />
      ) : (
        <FindTheAirwayQuiz onOpenStructure={onOpenStructure} />
      )}
    </div>
  )
}

function NameTheAirwayQuiz({ onOpenStructure }: { onOpenStructure?: (id: string) => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [data, setData] = useState<QuizFramesData | null>(null)
  const [question, setQuestion] = useState<AirwayQuizQuestion | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [streak, setStreak] = useState(0)
  const [, setRecent] = useState<string[]>([])

  const nextQuestion = useCallback(() => {
    if (!data) return
    setPicked(null)
    setRecent((prev) => {
      const next = buildIdentifyQuestion(data, prev)
      if (!next) return prev
      setQuestion(next)
      return [next.target, ...prev].slice(0, RECENT_MEMORY)
    })
  }, [data])

  useEffect(() => {
    let active = true
    loadQuizFrames()
      .then((frames) => {
        if (!active) return
        setData(frames)
        setStatus('ready')
        const next = buildIdentifyQuestion(frames, [])
        if (next) {
          setQuestion(next)
          setRecent([next.target])
        }
      })
      .catch((err: unknown) => {
        if (!active) return
        console.error('quiz frames failed to load', err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  const answer = useCallback(
    (choice: string) => {
      if (picked || !question) return
      setPicked(choice)
      const isCorrect = choice === question.target
      setScore((current) => ({
        correct: current.correct + (isCorrect ? 1 : 0),
        total: current.total + 1,
      }))
      setStreak((current) => (isCorrect ? current + 1 : 0))
    },
    [picked, question],
  )

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-muted-foreground">
        The identify challenge could not be loaded. Please refresh to try again.
      </div>
    )
  }

  const struct = question ? data?.structures[question.target] : undefined
  const targetNode = question ? getNode(question.target) : undefined
  const revealed = picked != null
  const correct = revealed && picked === question?.target

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <HelpCircle className="h-4 w-4 text-primary" aria-hidden /> Name the airway
          </h4>
          <p className="text-sm text-muted-foreground">
            The cyan outline marks the tested airway. Choose the name, then reveal the matched CT,
            3D highlight, and explanation.
          </p>
        </div>
        <ScorePill score={score} streak={streak} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Endoscopic still
          </p>
          <div className="relative aspect-[1368/1080] w-full overflow-hidden rounded-xl border border-border/70 bg-black">
            {struct ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={struct.img}
                  src={struct.img}
                  alt="Endoscopic view with one airway outlined"
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
                {data && struct.isOrifice ? (
                  <svg
                    viewBox={`0 0 ${data.meta.width} ${data.meta.height}`}
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    <polygon
                      points={toPoints(struct.poly)}
                      fill={revealed ? 'rgba(34,211,238,0.14)' : 'none'}
                      stroke="rgba(2,6,23,0.6)"
                      strokeWidth={9}
                    />
                    <polygon
                      points={toPoints(struct.poly)}
                      fill="none"
                      stroke={OUTLINE}
                      strokeWidth={5}
                    />
                  </svg>
                ) : (
                  <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                    Scope is inside this airway
                  </span>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">
                Loading...
              </div>
            )}
          </div>
        </div>

        {question && <CtCorrelationView focusNodeId={question.target} />}

        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            3D model
          </p>
          <Airway3DModel
            selectedId={question?.target ?? null}
            onSelect={() => {}}
            hideLabel={!revealed}
            dimOpacity={0.5}
            className="h-[260px]"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {question?.options.map((id) => {
          const isTarget = id === question.target
          const isPicked = id === picked
          const node = getNode(id)
          return (
            <button
              key={id}
              type="button"
              disabled={revealed}
              onClick={() => answer(id)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                !revealed && 'border-border/70 hover:border-primary/50 hover:bg-primary/5',
                revealed && isTarget && 'border-emerald-500/60 bg-emerald-500/10 text-foreground',
                revealed &&
                  isPicked &&
                  !isTarget &&
                  'border-rose-500/60 bg-rose-500/10 text-foreground',
                revealed && !isTarget && !isPicked && 'border-border/50 opacity-60',
              )}
            >
              <span className="flex items-center gap-2">
                {node && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: lobeColor(node.lobe) }}
                    aria-hidden
                  />
                )}
                {displayName(id, data)}
              </span>
              {revealed && isTarget && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              )}
              {revealed && isPicked && !isTarget && (
                <XCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      {revealed && targetNode && (
        <RevealPanel
          correct={Boolean(correct)}
          targetId={targetNode.id}
          onNext={nextQuestion}
          onOpenStructure={onOpenStructure}
        />
      )}
    </section>
  )
}

interface FindQuestion {
  frame: number
  targetStructIndex: number
}

function buildFindQuestion(index: OverlayIndex): FindQuestion | null {
  const candidates = buildFindFrameCandidates(index)
    .map((candidate) => {
      const targets = candidate.targets.filter((structIndex) => {
        const nodeId = index.structures[structIndex]?.node
        return Boolean(nodeId && !QUIZ_EXCLUDED_NODE_IDS.has(nodeId))
      })
      return { frame: candidate.frame, targets }
    })
    .filter((candidate) => candidate.targets.length >= 2)
  const candidate = randomItem(candidates)
  if (!candidate) return null
  const targetStructIndex = randomItem(candidate.targets)
  if (targetStructIndex == null) return null
  return { frame: candidate.frame, targetStructIndex }
}

function FindTheAirwayQuiz({ onOpenStructure }: { onOpenStructure?: (id: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [index, setIndex] = useState<OverlayIndex | null>(null)
  const [question, setQuestion] = useState<FindQuestion | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    loadOverlayData(controller.signal)
      .then((overlay) => {
        const builtIndex = buildIndex(overlay)
        setIndex(builtIndex)
        setQuestion(buildFindQuestion(builtIndex))
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('airway overlays failed to load', err)
        setStatus('error')
      })
    return () => controller.abort()
  }, [])

  const nextQuestion = useCallback(() => {
    if (!index) return
    const next = buildFindQuestion(index)
    if (!next) return
    setPicked(null)
    setQuestion(next)
  }, [index])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !index || !question) return

    const seek = () => {
      video.pause()
      video.currentTime = timeForFrame(index.meta, question.frame)
    }

    if (video.readyState >= 1) {
      seek()
      return
    }

    video.addEventListener('loadedmetadata', seek, { once: true })
    return () => video.removeEventListener('loadedmetadata', seek)
  }, [index, question])

  const markers = useMemo<FrameMarker[]>(() => {
    if (!index || !question) return []
    return markersAtFrame(index, question.frame, { nodeOnly: true })
  }, [index, question])

  const targetStructure = index && question ? index.structures[question.targetStructIndex] : null
  const targetNodeId = targetStructure?.node ?? null
  const targetNode = targetNodeId ? getNode(targetNodeId) : undefined
  const pickedNodeId = picked != null && index ? index.structures[picked]?.node : null
  const revealed = picked != null
  const correct = Boolean(revealed && picked === question?.targetStructIndex)

  const answerAtPoint = useCallback(
    (event: MouseEvent<SVGSVGElement>) => {
      if (!index || !question || revealed) return
      const rect = event.currentTarget.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * index.meta.width
      const y = ((event.clientY - rect.top) / rect.height) * index.meta.height
      const hit = hitTestMarker(index, question.frame, x, y, 38)
      if (hit == null) return
      setPicked(hit)
      const isCorrect = hit === question.targetStructIndex
      setScore((current) => ({
        correct: current.correct + (isCorrect ? 1 : 0),
        total: current.total + 1,
      }))
      setStreak((current) => (isCorrect ? current + 1 : 0))
    },
    [index, question, revealed],
  )

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-muted-foreground">
        The marker challenge could not be loaded. Please refresh to try again.
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/70 bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MapPinned className="h-4 w-4 text-primary" aria-hidden /> Find the airway
          </h4>
          <p className="text-sm text-muted-foreground">
            Click the unlabeled marker for{' '}
            <span className="font-semibold text-foreground">
              {targetNode?.fullName ?? 'the target airway'}
            </span>
            .
          </p>
        </div>
        <ScorePill score={score} streak={streak} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="space-y-2">
          <div className="relative aspect-[1368/1080] w-full overflow-hidden rounded-xl border border-border/70 bg-black">
            {index ? (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={`/airway-lesson/${index.meta.video}`}
                  poster={`/airway-lesson/${index.meta.poster}`}
                  muted
                  playsInline
                  preload="metadata"
                  aria-label="Paused bronchoscopy frame for marker selection"
                />
                <svg
                  viewBox={`0 0 ${index.meta.width} ${index.meta.height}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full cursor-crosshair"
                  onClick={answerAtPoint}
                >
                  {markers.map((marker) => {
                    const isTarget = marker.structIndex === question?.targetStructIndex
                    const isPicked = marker.structIndex === picked
                    const showLabel = revealed && (isTarget || isPicked)
                    const fill = revealed
                      ? isTarget
                        ? '#10b981'
                        : isPicked
                          ? '#f43f5e'
                          : '#e2e8f0'
                      : '#e2e8f0'
                    return (
                      <g key={marker.structIndex}>
                        <circle
                          cx={marker.x}
                          cy={marker.y}
                          r={revealed && (isTarget || isPicked) ? 22 : 16}
                          fill="rgba(2,6,23,0.55)"
                          stroke="rgba(255,255,255,0.9)"
                          strokeWidth={4}
                        />
                        <circle cx={marker.x} cy={marker.y} r={8} fill={fill} />
                        {showLabel && (
                          <text
                            x={marker.x + 18}
                            y={marker.y - 18}
                            fill="#f8fafc"
                            stroke="rgba(2,6,23,0.8)"
                            strokeWidth={5}
                            paintOrder="stroke"
                            fontSize={30}
                            fontWeight={700}
                          >
                            {marker.structure.short}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </svg>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">
                Loading paused video frame...
              </div>
            )}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Markers are intentionally unlabeled until you answer. After the reveal, the correct
            marker turns green and an incorrect click turns red.
          </p>
        </div>

        <div className="space-y-3">
          <div
            className={cn(
              'rounded-xl border p-4',
              revealed
                ? correct
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-amber-500/40 bg-amber-500/5'
                : 'border-border/70 bg-background/70',
            )}
          >
            {!revealed && (
              <p className="text-sm leading-6 text-muted-foreground">
                Target:{' '}
                <span className="font-semibold text-foreground">
                  {targetNode?.fullName ?? 'Loading...'}
                </span>
              </p>
            )}
            {revealed && targetNode && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {correct ? 'Correct - ' : 'Not quite - '}
                  the target is {targetNode.fullName}.
                </p>
                {!correct && pickedNodeId && (
                  <p className="text-xs text-muted-foreground">
                    You clicked {displayName(pickedNodeId)}.
                  </p>
                )}
                <p className="text-sm leading-6 text-muted-foreground">{targetNode.summary}</p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={nextQuestion}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
                  >
                    Next airway
                  </button>
                  {onOpenStructure && (
                    <button
                      type="button"
                      onClick={() => onOpenStructure(targetNode.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      <Boxes className="h-3.5 w-3.5" aria-hidden /> Open in explorer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {revealed && targetNodeId && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <CtCorrelationView focusNodeId={targetNodeId} />
              <Airway3DModel
                selectedId={targetNodeId}
                onSelect={() => {}}
                dimOpacity={0.5}
                className="h-[240px]"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ScorePill({
  score,
  streak,
}: {
  score: { correct: number; total: number }
  streak: number
}) {
  return (
    <div className="flex items-center gap-2">
      {streak >= 2 && (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-500">
          <Flame className="h-3.5 w-3.5" aria-hidden /> {streak} streak
        </span>
      )}
      <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <Trophy className="h-3.5 w-3.5" aria-hidden /> {score.correct}/{score.total}
      </span>
    </div>
  )
}

function RevealPanel({
  correct,
  targetId,
  onNext,
  onOpenStructure,
}: {
  correct: boolean
  targetId: string
  onNext: () => void
  onOpenStructure?: (id: string) => void
}) {
  const targetNode = getNode(targetId)
  if (!targetNode) return null

  return (
    <div
      className={cn(
        'space-y-2 rounded-xl border p-4',
        correct ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      <p className="text-sm font-semibold text-foreground">
        {correct ? 'Correct - ' : 'Not quite - '}
        this is the {targetNode.fullName}.
        <span className="ml-2 font-normal text-muted-foreground">
          {LOBE_LABELS[targetNode.lobe]}
        </span>
      </p>
      <p className="text-sm leading-6 text-muted-foreground">{targetNode.summary}</p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          Next airway
        </button>
        {onOpenStructure && (
          <button
            type="button"
            onClick={() => onOpenStructure(targetId)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            <Boxes className="h-3.5 w-3.5" aria-hidden /> Open in explorer
          </button>
        )}
      </div>
    </div>
  )
}
