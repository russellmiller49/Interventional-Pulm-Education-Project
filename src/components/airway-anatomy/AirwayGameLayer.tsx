'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  ChevronsUp,
  Flame,
  Gauge,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  X,
} from 'lucide-react'
import * as THREE from 'three'

import { clamp } from '@/lib/airway-anatomy/geometry'
import {
  buildGameTargets,
  buildTargetQueue,
  computeTargetGuide,
  difficultyById,
  DIFFICULTIES,
  isArrived,
  isOffCorridor,
  LOBE_COLORS,
  scoreTarget,
  type Difficulty,
  type GameTarget,
} from '@/lib/airway-anatomy/airway-game'
import type {
  AirwayGraph,
  CenterlineLabels,
  ScopePoseSnapshot,
  Vec3,
} from '@/lib/airway-anatomy/types'
import { HandoffContent } from '@/i18n/handoff'

export type GameStatus = 'idle' | 'countdown' | 'playing' | 'finished'

export interface GameResults {
  score: number
  hits: number
  bestCombo: number
  cleanHits: number
  accuracyPct: number
  starsTotal: number
  perfect: boolean
  best: number
  newBest: boolean
}

export interface AirwayGameView {
  status: GameStatus
  difficultyId: Difficulty['id']
  score: number
  combo: number
  bestCombo: number
  comboMultiplier: number
  hits: number
  timeLeftSec: number
  durationSec: number
  countdownValue: number
  currentTarget: GameTarget | null
  wrongTurns: number
  hintsOn: boolean
  hasTargets: boolean
  lastResult: { abbr: string; points: number; stars: 1 | 2 | 3; clean: boolean; key: number } | null
  results: GameResults | null
}

export interface AirwayGameActions {
  start: (difficultyId?: Difficulty['id']) => void
  stop: () => void
  playAgain: () => void
  setDifficulty: (id: Difficulty['id']) => void
  toggleHints: () => void
}

export interface AirwayGameController {
  view: AirwayGameView
  actions: AirwayGameActions
  /** Increments on every successful arrival — drives the particle burst. */
  hitPulse: number
  /** Anchor of the target just reached, so the burst fires where you arrived. */
  hitAnchor: Vec3 | null
}

interface UseAirwayGameParams {
  enabled: boolean
  graph: AirwayGraph | null
  labels: CenterlineLabels | null
  snapshot: ScopePoseSnapshot | null
  onResetScope: () => void
}

function readBest(id: string): number {
  try {
    const value = window.localStorage.getItem(`bronch-quest-best-${id}`)
    return value ? Number.parseInt(value, 10) || 0 : 0
  } catch {
    return 0
  }
}

function writeBest(id: string, score: number): void {
  try {
    window.localStorage.setItem(`bronch-quest-best-${id}`, String(score))
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

/**
 * Game state machine for "Bronch Quest". Owns the clock, the target queue, and
 * arrival / wrong-turn detection driven by the shared scope snapshot. Kept out
 * of the main module so the simulator file stays readable.
 */
export function useAirwayGame({
  enabled,
  graph,
  labels,
  snapshot,
  onResetScope,
}: UseAirwayGameParams): AirwayGameController {
  const allTargets = useMemo(
    () => (graph && labels ? buildGameTargets(graph, labels) : []),
    [graph, labels],
  )

  const [status, setStatus] = useState<GameStatus>('idle')
  const [difficultyId, setDifficultyId] = useState<Difficulty['id']>('landmarks')
  const [queue, setQueue] = useState<GameTarget[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [hits, setHits] = useState(0)
  const [wrongTurns, setWrongTurns] = useState(0)
  const [durationSec, setDurationSec] = useState(90)
  const [timeLeftSec, setTimeLeftSec] = useState(90)
  const [countdownValue, setCountdownValue] = useState(3)
  const [hintsOn, setHintsOn] = useState(false)
  const [lastResult, setLastResult] = useState<AirwayGameView['lastResult']>(null)
  const [results, setResults] = useState<GameResults | null>(null)
  const [hitPulse, setHitPulse] = useState(0)
  const [hitAnchor, setHitAnchor] = useState<Vec3 | null>(null)

  const allTargetsRef = useRef<GameTarget[]>([])
  const queueRef = useRef<GameTarget[]>([])
  const queueIndexRef = useRef(0)
  const difficultyRef = useRef<Difficulty>(difficultyById('landmarks'))
  const durationRef = useRef(90)
  const targetStartRef = useRef(0)
  const endAtRef = useRef(0)
  const wrongTurnsRef = useRef(0)
  const offCorridorRef = useRef(false)
  const lastHitIndexRef = useRef(-1)
  const comboRef = useRef(0)
  const statsRef = useRef({ score: 0, bestCombo: 0, hits: 0, cleanHits: 0, starsTotal: 0 })
  const onResetScopeRef = useRef(onResetScope)
  const countdownTimerRef = useRef<number | null>(null)
  const playTimerRef = useRef<number | null>(null)

  useEffect(() => {
    onResetScopeRef.current = onResetScope
  }, [onResetScope])
  useEffect(() => {
    allTargetsRef.current = allTargets
  }, [allTargets])

  const clearTimers = useCallback(() => {
    if (countdownTimerRef.current != null) window.clearInterval(countdownTimerRef.current)
    if (playTimerRef.current != null) window.clearInterval(playTimerRef.current)
    countdownTimerRef.current = null
    playTimerRef.current = null
  }, [])

  const finish = useCallback(() => {
    clearTimers()
    const stats = statsRef.current
    const prevBest = readBest(difficultyRef.current.id)
    const newBest = stats.score > prevBest && stats.score > 0
    if (newBest) writeBest(difficultyRef.current.id, stats.score)
    setResults({
      score: stats.score,
      hits: stats.hits,
      bestCombo: stats.bestCombo,
      cleanHits: stats.cleanHits,
      accuracyPct: stats.hits > 0 ? Math.round((stats.cleanHits / stats.hits) * 100) : 0,
      starsTotal: stats.starsTotal,
      perfect: stats.hits > 0 && stats.cleanHits === stats.hits,
      best: Math.max(prevBest, stats.score),
      newBest,
    })
    setStatus('finished')
  }, [clearTimers])

  const advanceTarget = useCallback(() => {
    let nextIndex = queueIndexRef.current + 1
    let nextQueue = queueRef.current
    if (nextIndex >= nextQueue.length || nextQueue.length === 0) {
      nextQueue = buildTargetQueue(allTargetsRef.current, difficultyRef.current)
      queueRef.current = nextQueue
      setQueue(nextQueue)
      nextIndex = 0
    }
    queueIndexRef.current = nextIndex
    setQueueIndex(nextIndex)
    targetStartRef.current = Date.now()
    wrongTurnsRef.current = 0
    offCorridorRef.current = false
    setWrongTurns(0)
  }, [])

  const registerHit = useCallback(() => {
    const index = queueIndexRef.current
    if (lastHitIndexRef.current === index) return
    const target = queueRef.current[index]
    if (!target) return
    lastHitIndexRef.current = index

    const elapsedSec = (Date.now() - targetStartRef.current) / 1000
    const result = scoreTarget({
      tier: target.tier,
      elapsedSec,
      wrongTurns: wrongTurnsRef.current,
      comboBefore: comboRef.current,
    })

    const stats = statsRef.current
    stats.score += result.points
    stats.hits += 1
    stats.cleanHits += result.clean ? 1 : 0
    stats.starsTotal += result.stars
    stats.bestCombo = Math.max(stats.bestCombo, result.comboAfter)
    comboRef.current = result.comboAfter

    setScore(stats.score)
    setHits(stats.hits)
    setCombo(result.comboAfter)
    setBestCombo(stats.bestCombo)
    setLastResult({
      abbr: target.abbr,
      points: result.points,
      stars: result.stars,
      clean: result.clean,
      key: index + 1,
    })
    setHitAnchor(target.anchorLps)
    setHitPulse((pulse) => pulse + 1)
    advanceTarget()
  }, [advanceTarget])

  const startPlaying = useCallback(() => {
    targetStartRef.current = Date.now()
    endAtRef.current = Date.now() + durationRef.current * 1000
    lastHitIndexRef.current = -1
    setStatus('playing')
  }, [])

  const start = useCallback(
    (id?: Difficulty['id']) => {
      const difficulty = difficultyById(id ?? difficultyRef.current.id)
      difficultyRef.current = difficulty
      durationRef.current = difficulty.durationSec
      setDifficultyId(difficulty.id)
      setDurationSec(difficulty.durationSec)
      setTimeLeftSec(difficulty.durationSec)

      const nextQueue = buildTargetQueue(allTargetsRef.current, difficulty)
      queueRef.current = nextQueue
      queueIndexRef.current = 0
      setQueue(nextQueue)
      setQueueIndex(0)

      statsRef.current = { score: 0, bestCombo: 0, hits: 0, cleanHits: 0, starsTotal: 0 }
      comboRef.current = 0
      wrongTurnsRef.current = 0
      offCorridorRef.current = false
      lastHitIndexRef.current = -1

      setScore(0)
      setCombo(0)
      setBestCombo(0)
      setHits(0)
      setWrongTurns(0)
      setLastResult(null)
      setResults(null)

      onResetScopeRef.current()
      clearTimers()
      setCountdownValue(3)
      setStatus('countdown')
    },
    [clearTimers],
  )

  const stop = useCallback(() => {
    clearTimers()
    setStatus('idle')
    setResults(null)
    setLastResult(null)
  }, [clearTimers])

  const playAgain = useCallback(() => start(difficultyRef.current.id), [start])

  const setDifficulty = useCallback((id: Difficulty['id']) => {
    difficultyRef.current = difficultyById(id)
    setDifficultyId(id)
  }, [])

  const toggleHints = useCallback(() => setHintsOn((value) => !value), [])

  // Countdown 3 · 2 · 1 · GO, then hand off to the play clock.
  useEffect(() => {
    if (status !== 'countdown') return
    // The initial "3" is set in start(); the interval drives the rest.
    let value = 3
    const id = window.setInterval(() => {
      value -= 1
      setCountdownValue(Math.max(0, value))
      if (value <= 0) {
        window.clearInterval(id)
        countdownTimerRef.current = null
        startPlaying()
      }
    }, 700)
    countdownTimerRef.current = id
    return () => window.clearInterval(id)
  }, [status, startPlaying])

  // Play clock.
  useEffect(() => {
    if (status !== 'playing') return
    const id = window.setInterval(() => {
      const left = Math.max(0, (endAtRef.current - Date.now()) / 1000)
      setTimeLeftSec(left)
      if (left <= 0) {
        window.clearInterval(id)
        playTimerRef.current = null
        finish()
      }
    }, 200)
    playTimerRef.current = id
    return () => window.clearInterval(id)
  }, [status, finish])

  // Belt-and-suspenders: if challenge mode is switched off, make sure no timer
  // keeps ticking. The visible state reset happens in the mode toggle handler.
  useEffect(() => {
    if (!enabled) clearTimers()
  }, [enabled, clearTimers])

  useEffect(() => () => clearTimers(), [clearTimers])

  const currentTarget =
    status === 'playing' || status === 'countdown' ? (queue[queueIndex] ?? null) : null

  // Arrival + wrong-turn detection off the shared scope snapshot.
  useEffect(() => {
    if (status !== 'playing' || !currentTarget || !snapshot) return
    const edgeId = snapshot.edgeId
    if (isOffCorridor(currentTarget, edgeId)) {
      if (!offCorridorRef.current) {
        offCorridorRef.current = true
        wrongTurnsRef.current += 1
        setWrongTurns(wrongTurnsRef.current)
      }
    } else {
      offCorridorRef.current = false
    }
    if (isArrived(currentTarget, edgeId)) {
      registerHit()
    }
  }, [snapshot, status, currentTarget, registerHit])

  const comboMultiplier = 1 + Math.min(Math.max(combo, 0), 6) * 0.15

  const view: AirwayGameView = {
    status,
    difficultyId,
    score,
    combo,
    bestCombo,
    comboMultiplier,
    hits,
    timeLeftSec,
    durationSec,
    countdownValue,
    currentTarget,
    wrongTurns,
    hintsOn,
    hasTargets: allTargets.length > 0,
    lastResult,
    results,
  }

  const actions: AirwayGameActions = {
    start,
    stop,
    playAgain,
    setDifficulty,
    toggleHints,
  }

  return { view, actions, hitPulse, hitAnchor }
}

function formatClock(totalSec: number): string {
  const rounded = Math.ceil(totalSec)
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function proximityColor(proximity: number): string {
  if (proximity >= 0.9) return '#f472b6'
  if (proximity >= 0.7) return '#fbbf24'
  if (proximity >= 0.4) return '#34d399'
  return '#38bdf8'
}

function proximityWord(proximity: number): string {
  if (proximity >= 0.9) return 'On top of it'
  if (proximity >= 0.7) return 'Hot'
  if (proximity >= 0.45) return 'Warmer'
  if (proximity >= 0.25) return 'Cool'
  return 'Cold'
}

/**
 * The in-viewport HUD: timer, score, combo, target card, proximity meter, and
 * the on-screen reticle / off-screen "this way" arrow. Rendered during the
 * countdown and active play. Pointer-transparent except the hint toggle so the
 * user can still drag to look through it.
 */
export function GameHudOverlay({
  view,
  actions,
  pose,
  aspect,
  fovDeg,
}: {
  view: AirwayGameView
  actions: AirwayGameActions
  pose: ScopePoseSnapshot
  aspect: number
  fovDeg: number
}) {
  if (view.status !== 'playing' && view.status !== 'countdown') {
    return <HandoffContent>{null}</HandoffContent>
  }

  const target = view.currentTarget
  const guide = target ? computeTargetGuide(target.anchorLps, pose, aspect, fovDeg) : null
  const lobeColor = target ? LOBE_COLORS[target.lobe] : '#38bdf8'
  const timeFrac = view.durationSec > 0 ? clamp(view.timeLeftSec / view.durationSec, 0, 1) : 0
  const lowTime = view.timeLeftSec <= 10 && view.status === 'playing'

  return (
    <HandoffContent>
      {
        <div className="pointer-events-none absolute inset-0 z-20 select-none">
          {/* Directional guidance (edge arrow only when the target is off-screen) */}
          {view.status === 'playing' && target && guide && (
            <GameGuide guide={guide} color={lobeColor} />
          )}

          {/* Top HUD bar */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 backdrop-blur ${
                  lowTime
                    ? 'border-rose-400/60 bg-rose-950/70 text-rose-200'
                    : 'border-slate-600/70 bg-slate-950/75 text-slate-100'
                }`}
                style={lowTime ? { animation: 'bq-pulse 0.6s ease-in-out infinite' } : undefined}
              >
                <Timer className="h-4 w-4" />
                <span className="font-mono text-base font-bold tabular-nums">
                  {formatClock(view.timeLeftSec)}
                </span>
              </div>
              {view.combo >= 2 && (
                <div
                  className="flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-950/60 px-2 py-1.5 text-amber-200 backdrop-blur"
                  style={{ animation: 'bq-pop 0.3s ease-out' }}
                  key={view.combo}
                >
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-bold">
                    {view.combo}
                    <span className="ml-0.5 text-[11px] font-semibold text-amber-300/90">
                      ×{view.comboMultiplier.toFixed(2)}
                    </span>
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-slate-950/80 px-2.5 py-1.5 text-cyan-100 backdrop-blur">
              <Trophy className="h-4 w-4 text-cyan-300" />
              <span className="font-mono text-base font-bold tabular-nums">{view.score}</span>
            </div>
          </div>

          {/* Timer sliver */}
          <div className="absolute inset-x-0 top-0 h-1 bg-slate-900/40">
            <div
              className="h-full transition-[width] duration-200 ease-linear"
              style={{
                width: `${timeFrac * 100}%`,
                background: lowTime ? '#fb7185' : '#22d3ee',
              }}
            />
          </div>

          {/* Target pill + proximity — kept as a thin cluster at the top edge so
              the center of the endoluminal view stays clear for navigation. */}
          {target && (
            <div className="absolute left-1/2 top-11 flex w-[min(80%,320px)] -translate-x-1/2 flex-col items-center gap-1.5">
              <div
                className="flex max-w-full items-center gap-2 rounded-full border bg-slate-950/80 px-3 py-1 shadow backdrop-blur"
                style={{ borderColor: `${lobeColor}66` }}
              >
                <Target className="h-3.5 w-3.5 shrink-0" style={{ color: lobeColor }} />
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Find
                </span>
                <span
                  className="shrink-0 text-base font-black leading-none"
                  style={{ color: lobeColor }}
                >
                  {target.abbr}
                </span>
                <span className="truncate text-xs font-medium text-slate-300">
                  {target.shortName}
                </span>
              </div>

              {view.status === 'playing' && guide && (
                <div className="flex w-full items-center gap-2 rounded-full bg-slate-950/65 px-2.5 py-1 backdrop-blur">
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    Prox
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/90">
                    <div
                      className="h-full rounded-full transition-[width] duration-200"
                      style={{
                        width: `${Math.round(guide.proximity * 100)}%`,
                        background: proximityColor(guide.proximity),
                        boxShadow:
                          guide.proximity >= 0.9
                            ? `0 0 8px ${proximityColor(guide.proximity)}`
                            : 'none',
                      }}
                    />
                  </div>
                  <span
                    className="shrink-0 text-[10px] font-semibold"
                    style={{ color: proximityColor(guide.proximity) }}
                  >
                    {proximityWord(guide.proximity)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Score popup on a hit */}
          {view.lastResult && (
            <ScorePopup key={view.lastResult.key} result={view.lastResult} color={lobeColor} />
          )}

          {/* Hint toggle */}
          {view.status === 'playing' && (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={actions.toggleHints}
              className={`pointer-events-auto absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold backdrop-blur transition ${
                view.hintsOn
                  ? 'border-amber-400/60 bg-amber-950/60 text-amber-200'
                  : 'border-slate-600/70 bg-slate-950/70 text-slate-300 hover:border-slate-400'
              }`}
              title="Toggle named ostia labels"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Hints {view.hintsOn ? 'on' : 'off'}
            </button>
          )}

          {/* Countdown */}
          {view.status === 'countdown' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 backdrop-blur-[1px]">
              <div
                key={view.countdownValue}
                className="text-center"
                style={{ animation: 'bq-count 0.7s ease-out' }}
              >
                <div className="text-7xl font-black text-cyan-200 drop-shadow-[0_2px_12px_rgba(34,211,238,0.5)]">
                  {view.countdownValue > 0 ? view.countdownValue : 'GO!'}
                </div>
                {view.countdownValue > 0 && target && (
                  <div className="mt-2 text-sm text-slate-300">
                    First target: <span className="font-bold text-white">{target.abbr}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
    </HandoffContent>
  )
}

function GameGuide({
  guide,
  color,
}: {
  guide: ReturnType<typeof computeTargetGuide>
  color: string
}) {
  // Only guide when the target is off-screen: a small arrow at the edge points
  // the way. Once it is in view, the open lumen plus the proximity meter are
  // enough — no on-screen reticle cluttering the center of the image.
  if (guide.onScreen) return <HandoffContent>{null}</HandoffContent>

  // Off-screen: an arrow pinned near the edge pointing toward the target.
  const rad = (guide.bearingDeg * Math.PI) / 180
  const left = 50 + Math.sin(rad) * 40
  const top = 50 - Math.cos(rad) * 40
  return (
    <HandoffContent>
      {
        <div
          className="absolute"
          style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div
            style={{
              transform: `rotate(${guide.bearingDeg}deg)`,
              filter: `drop-shadow(0 0 8px ${color})`,
              animation: 'bq-bob 1s ease-in-out infinite',
            }}
          >
            <ChevronsUp className="h-9 w-9" style={{ color }} strokeWidth={2.75} />
          </div>
        </div>
      }
    </HandoffContent>
  )
}

function ScorePopup({
  result,
  color,
}: {
  result: NonNullable<AirwayGameView['lastResult']>
  color: string
}) {
  return (
    <HandoffContent>
      {
        <div
          className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 text-center"
          style={{ animation: 'bq-score 1.1s ease-out forwards' }}
        >
          <div
            className="text-4xl font-black"
            style={{ color, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
          >
            +{result.points}
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-0.5">
            {[1, 2, 3].map((index) => (
              <Star
                key={index}
                className="h-4 w-4"
                fill={index <= result.stars ? '#fbbf24' : 'transparent'}
                style={{ color: index <= result.stars ? '#fbbf24' : '#475569' }}
              />
            ))}
          </div>
          {result.clean && result.stars === 3 && (
            <div className="mt-0.5 text-xs font-bold uppercase tracking-wide text-amber-300">
              Perfect!
            </div>
          )}
        </div>
      }
    </HandoffContent>
  )
}

/**
 * Section-level overlay for the pre-game start card and the post-game results.
 * Rendered over the whole simulator so there is room for the difficulty picker
 * and the celebratory summary.
 */
export function GameIntroOverlay({
  view,
  actions,
}: {
  view: AirwayGameView
  actions: AirwayGameActions
}) {
  if (view.status === 'idle') {
    return (
      <HandoffContent>
        {
          <GameCardShell>
            <StartCard view={view} actions={actions} />
          </GameCardShell>
        }
      </HandoffContent>
    )
  }
  if (view.status === 'finished' && view.results) {
    return (
      <HandoffContent>
        {
          <GameCardShell>
            <ResultsCard view={view} actions={actions} results={view.results} />
          </GameCardShell>
        }
      </HandoffContent>
    )
  }
  return <HandoffContent>{null}</HandoffContent>
}

function GameCardShell({ children }: { children: React.ReactNode }) {
  return (
    <HandoffContent>
      {
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="max-h-full w-[min(560px,100%)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl md:p-6">
            {children}
          </div>
        </div>
      }
    </HandoffContent>
  )
}

function StartCard({ view, actions }: { view: AirwayGameView; actions: AirwayGameActions }) {
  const selected = difficultyById(view.difficultyId)
  return (
    <HandoffContent>
      {
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">Challenge mode</span>
          </div>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Bronch Quest</h3>
          <p className="mt-1.5 text-sm text-slate-300">
            The scope tip is yours. We call a target segment — steer to its ostium and drive in
            before the clock runs out. Clean, fast runs build a combo multiplier.
          </p>

          <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Choose your airways
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {DIFFICULTIES.map((difficulty) => {
              const active = difficulty.id === view.difficultyId
              return (
                <button
                  key={difficulty.id}
                  type="button"
                  onClick={() => actions.setDifficulty(difficulty.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-cyan-400 bg-cyan-500/15 ring-1 ring-cyan-400/40'
                      : 'border-slate-700 bg-slate-950/60 hover:border-slate-500'
                  }`}
                >
                  <div className="text-sm font-bold text-white">{difficulty.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-400">
                    {difficulty.blurb}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
                    <Timer className="h-3 w-3" />
                    {difficulty.durationSec}s
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
              <Gauge className="mx-auto h-4 w-4 text-slate-500" />
              <div className="mt-1">Proximity meter warms as you close in</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
              <Flame className="mx-auto h-4 w-4 text-amber-400/80" />
              <div className="mt-1">Clean hits stack a combo bonus</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
              <Lightbulb className="mx-auto h-4 w-4 text-slate-500" />
              <div className="mt-1">Stuck? Flip on hints for named ostia</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => actions.start(selected.id)}
            disabled={!view.hasTargets}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-base font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            <Play className="h-5 w-5" />
            Start {selected.label}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Drive with the on-screen ring, the Advance/Withdraw buttons, or W/S + arrow keys.
          </p>
        </div>
      }
    </HandoffContent>
  )
}

function ResultsCard({
  view,
  actions,
  results,
}: {
  view: AirwayGameView
  actions: AirwayGameActions
  results: GameResults
}) {
  const difficulty = difficultyById(view.difficultyId)
  return (
    <HandoffContent>
      {
        <div className="text-center">
          {results.newBest ? (
            <div className="flex items-center justify-center gap-1.5 text-amber-300">
              <Trophy className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">
                New personal best
              </span>
            </div>
          ) : (
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              {difficulty.label} · time up
            </div>
          )}
          <div className="mt-1 text-5xl font-black tracking-tight text-white">{results.score}</div>
          <div className="text-xs text-slate-400">
            points{results.perfect ? ' · flawless navigation' : ''}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="Reached"
              value={String(results.hits)}
              icon={<Target className="h-4 w-4" />}
            />
            <StatTile
              label="Best combo"
              value={`${results.bestCombo}`}
              icon={<Flame className="h-4 w-4" />}
            />
            <StatTile
              label="Clean"
              value={`${results.accuracyPct}%`}
              icon={<Gauge className="h-4 w-4" />}
            />
            <StatTile
              label="Stars"
              value={`${results.starsTotal}`}
              icon={<Star className="h-4 w-4" />}
            />
          </div>

          <div className="mt-3 text-[11px] text-slate-500">
            Personal best · {difficulty.label}:{' '}
            <span className="text-slate-300">{results.best}</span>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={actions.playAgain}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
            >
              <RotateCcw className="h-4 w-4" />
              Play again
            </button>
            <button
              type="button"
              onClick={actions.stop}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-400"
            >
              <X className="h-4 w-4" />
              Change difficulty
            </button>
          </div>
        </div>
      }
    </HandoffContent>
  )
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <HandoffContent>
      {
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-2.5">
          <div className="flex items-center justify-center gap-1 text-slate-400">{icon}</div>
          <div className="mt-1 text-xl font-black text-white">{value}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
        </div>
      }
    </HandoffContent>
  )
}

/**
 * A pulsing, lobe-colored beacon at the current target, rendered inside the 3D
 * airway tree Canvas. A soft sphere plus an expanding "sonar" ring makes the
 * destination easy to spot amongst the branches.
 */
export function TargetBeacon({ target }: { target: GameTarget }) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const clockRef = useRef(0)
  const color = LOBE_COLORS[target.lobe]

  useFrame((_, delta) => {
    clockRef.current += Math.min(delta, 0.05)
    const t = clockRef.current
    const pulse = 1 + Math.sin(t * 3.2) * 0.18
    if (coreRef.current) coreRef.current.scale.setScalar(pulse)
    // Sonar ring expands from the core and fades, then repeats.
    const cycle = (t % 1.6) / 1.6
    if (ringRef.current) ringRef.current.scale.setScalar(3 + cycle * 16)
    if (ringMaterialRef.current) ringMaterialRef.current.opacity = 0.6 * (1 - cycle)
  })

  return (
    <HandoffContent>
      {
        <group ref={groupRef} position={target.anchorLps as Vec3}>
          <mesh ref={coreRef}>
            <sphereGeometry args={[3.2, 20, 20]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[5.2, 20, 20]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.72, 1, 32]} />
            <meshBasicMaterial
              ref={ringMaterialRef}
              color={color}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <pointLight color={color} intensity={6} distance={70} decay={1.4} />
          <Html center distanceFactor={130} zIndexRange={[20, 0]}>
            <div
              className="whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-black shadow"
              style={{
                color,
                borderColor: `${color}88`,
                background: 'rgba(2,6,23,0.85)',
                transform: 'translateY(-26px)',
              }}
            >
              {target.abbr}
            </div>
          </Html>
        </group>
      }
    </HandoffContent>
  )
}

const BURST_COUNT = 48

/** A one-shot particle burst fired at `origin` whenever `triggerKey` changes. */
export function SuccessBurst({
  triggerKey,
  origin,
  colorHex,
}: {
  triggerKey: number
  origin: Vec3
  colorHex: string
}) {
  const stateRef = useRef({
    velocities: new Float32Array(BURST_COUNT * 3),
    ages: new Float32Array(BURST_COUNT),
    active: false,
  })

  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST_COUNT * 3), 3))
    return next
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: colorHex,
        size: 3.4,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    [colorHex],
  )
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.color.set(colorHex)
  }, [material, colorHex])

  useEffect(() => {
    if (triggerKey === 0) return
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    const local = stateRef.current
    for (let i = 0; i < BURST_COUNT; i += 1) {
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.max(0, 1 - u * u))
      const speed = 20 + Math.random() * 40
      local.velocities[i * 3] = r * Math.cos(theta) * speed
      local.velocities[i * 3 + 1] = u * speed + 12
      local.velocities[i * 3 + 2] = r * Math.sin(theta) * speed
      local.ages[i] = 0
      position.setXYZ(i, origin[0], origin[1], origin[2])
    }
    position.needsUpdate = true
    local.active = true
    material.opacity = 1
    // Re-fire only when the trigger changes; origin is captured intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey])

  useFrame((_, delta) => {
    const local = stateRef.current
    if (!local.active) return
    const dt = Math.min(delta, 0.05)
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    let maxAge = 0
    let alive = false
    for (let i = 0; i < BURST_COUNT; i += 1) {
      const age = local.ages[i] + dt / 0.95
      local.ages[i] = age
      maxAge = Math.max(maxAge, age)
      if (age >= 1) continue
      alive = true
      local.velocities[i * 3 + 1] -= 40 * dt
      position.setXYZ(
        i,
        position.getX(i) + local.velocities[i * 3] * dt,
        position.getY(i) + local.velocities[i * 3 + 1] * dt,
        position.getZ(i) + local.velocities[i * 3 + 2] * dt,
      )
    }
    position.needsUpdate = true
    material.opacity = Math.max(0, 1 - maxAge)
    if (!alive) local.active = false
  })

  if (triggerKey === 0) return <HandoffContent>{null}</HandoffContent>
  return (
    <HandoffContent>
      {<points geometry={geometry} material={material} frustumCulled={false} />}
    </HandoffContent>
  )
}
