'use client'

import {
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  ListChecks,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ScanSearch,
  ScanLine,
  SlidersHorizontal,
  Stethoscope,
} from 'lucide-react'
import type { Route } from 'next'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { HandoffContent } from '@/i18n/handoff'
import { cn } from '@/lib/cn'
import { recordSiteModuleEvent } from '@/lib/analytics'

import { StentMechanicsDisclaimer } from '../StentMechanicsDisclaimer'
import { stentExplorerCasePresets } from '../../explorer/cases'
import { getStentExplorerArchitectureProfile } from '../../explorer/architectures'
import { getAvailableStentExplorerHotspots } from '../../explorer/hotspots'
import {
  createDefaultStentExplorerControlState,
  deriveStentMechanicsModifiers,
} from '../../explorer/controlState'
import { stentExplorerReleaseBadge } from '../../explorer/release'
import { getStentExplorerStation, stentExplorerStations } from '../../explorer/stations'
import type {
  StentExplorerArchitectureId,
  StentExplorerControlState,
  StentExplorerStation,
  StentExplorerStationId,
  StentExplorerViewMode,
} from '../../explorer/types'
import { StentEvidencePanel } from './StentEvidencePanel'
import { StentArchitectureFingerprint } from './StentArchitectureFingerprint'
import { StentExplorerViewportDynamic } from './StentExplorerViewportDynamic'
import { StentPlayPrompt } from './StentPlayPrompt'
import { StentPredictionPanel } from './StentPredictionPanel'
import { StentStationControls } from './StentStationControls'
import { StentStationNavigator } from './StentStationNavigator'

const MODULE_ID = 'airway-stent-mechanics'
const ANIMATION_DURATION_MS = 6200
const ANIMATION_FRAME_INTERVAL_MS = 1000 / 30

const viewModes: readonly {
  id: StentExplorerViewMode
  label: string
  icon: typeof Camera
}[] = [
  { id: 'external', label: 'External 3D', icon: Camera },
  { id: 'cutaway', label: 'Cutaway', icon: ScanLine },
  { id: 'endoscopic', label: 'Endoscopic', icon: Stethoscope },
  { id: 'cross-section', label: 'Cross-section', icon: Gauge },
]

type InteractionDockTab = 'details' | 'self-check' | 'explore' | 'inspect'

const interactionDockTabs: readonly {
  id: InteractionDockTab
  label: string
  icon: typeof Layers3
}[] = [
  { id: 'details', label: 'Stent details', icon: Layers3 },
  { id: 'self-check', label: 'Self-check', icon: ListChecks },
  { id: 'explore', label: 'Explore', icon: SlidersHorizontal },
  { id: 'inspect', label: 'Inspect', icon: ScanSearch },
]

interface StentMechanicsExplorerProps {
  initialStationId?: StentExplorerStationId | null
}

function createControlStateForArchitecture(
  station: StentExplorerStation,
  architectureId: StentExplorerArchitectureId,
): StentExplorerControlState {
  return createDefaultStentExplorerControlState(station, architectureId)
}

function phaseIndexForProgress(progress: number, phaseCount: number) {
  return Math.min(phaseCount - 1, Math.floor(Math.min(0.9999, progress) * phaseCount))
}

function reducedMotionRevealProgress(stationId: StentExplorerStationId) {
  return stationId === 'metal-architecture' ? 0.5 : 1
}

function DebriefColumn({ title, items }: { items: readonly string[]; title: string }) {
  return (
    <section className="rounded-2xl border bg-background p-4">
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
        {title}
      </h4>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-cyan-600" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function StentMechanicsExplorer({ initialStationId }: StentMechanicsExplorerProps) {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const systemReducedMotion = Boolean(useReducedMotion())
  const firstStationId = initialStationId ?? stentExplorerStations[0].id
  const initialStation = getStentExplorerStation(firstStationId)
  const [activeStationId, setActiveStationId] = useState<StentExplorerStationId>(firstStationId)
  const [architectureId, setArchitectureId] = useState<StentExplorerArchitectureId>(
    initialStation.defaultArchitectureId,
  )
  const [controlState, setControlState] = useState<StentExplorerControlState>(() =>
    createControlStateForArchitecture(initialStation, initialStation.defaultArchitectureId),
  )
  const [activeCaseId, setActiveCaseId] = useState('')
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)
  const [predictionSkipped, setPredictionSkipped] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [viewMode, setViewMode] = useState<StentExplorerViewMode>('external')
  const [showHotspots, setShowHotspots] = useState(true)
  const [viewportVisible, setViewportVisible] = useState(true)
  const [interactionDockTab, setInteractionDockTab] = useState<InteractionDockTab>('details')
  const [focusWorkspace, setFocusWorkspace] = useState(false)
  const [showPlayPrompt, setShowPlayPrompt] = useState(false)
  const [motionOverride, setMotionOverride] = useState(false)
  const progressRef = useRef(0)
  const completionRecordedRef = useRef(false)
  const initialStationRecordedRef = useRef(false)
  const workspaceRef = useRef<HTMLElement>(null)
  const exitFocusButtonRef = useRef<HTMLButtonElement>(null)

  const station = useMemo(() => getStentExplorerStation(activeStationId), [activeStationId])
  const activeCase = useMemo(
    () => stentExplorerCasePresets.find((preset) => preset.id === activeCaseId),
    [activeCaseId],
  )
  const architecture = useMemo(
    () => getStentExplorerArchitectureProfile(architectureId),
    [architectureId],
  )
  const availableHotspots = getAvailableStentExplorerHotspots(station, architectureId)
  const phaseIndex = phaseIndexForProgress(progress, station.phases.length)
  const activePhase = station.phases[phaseIndex]
  const interactionUnlocked = committed || predictionSkipped
  const reducedMotion = systemReducedMotion && !motionOverride
  const visibleHotspots = interactionUnlocked && showHotspots
  const mechanicsModifiers = useMemo(
    () => deriveStentMechanicsModifiers(station, controlState, architectureId),
    [architectureId, controlState, station],
  )

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    if (!focusWorkspace) return

    const workspace = workspaceRef.current
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    exitFocusButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showPlayPrompt) return
        event.preventDefault()
        setFocusWorkspace(false)
        return
      }
      if (event.key !== 'Tab' || !workspace) return

      const focusable = Array.from(
        workspace.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocusedElement?.focus()
    }
  }, [focusWorkspace, showPlayPrompt])

  useEffect(() => {
    if (initialStationRecordedRef.current) return
    initialStationRecordedRef.current = true
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: firstStationId,
      eventPayload: {
        interaction: 'station_selected',
        stationId: firstStationId,
        entry: 'initial',
      },
    })
  }, [firstStationId])

  useEffect(() => {
    if (!playing || reducedMotion || !viewportVisible) return
    let frame = 0
    let previousTime = performance.now()
    let accumulatedTime = 0

    function tick(now: number) {
      const elapsed = Math.max(0, now - previousTime)
      previousTime = now
      accumulatedTime += elapsed
      if (accumulatedTime < ANIMATION_FRAME_INTERVAL_MS) {
        frame = requestAnimationFrame(tick)
        return
      }
      const next = Math.min(1, progressRef.current + accumulatedTime / ANIMATION_DURATION_MS)
      accumulatedTime = 0
      progressRef.current = next
      setProgress(next)
      if (next >= 1) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, reducedMotion, viewportVisible])

  useEffect(() => {
    if (!interactionUnlocked || reducedMotion || progress < 1 || completionRecordedRef.current) {
      return
    }
    completionRecordedRef.current = true
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: activeStationId,
      eventPayload: {
        interaction: 'station_animation_completed',
        stationId: activeStationId,
        architectureId,
      },
    })
  }, [activeStationId, architectureId, interactionUnlocked, progress, reducedMotion])

  const resetInteraction = useCallback(() => {
    setSelectedChoiceId(null)
    setCommitted(false)
    setPredictionSkipped(false)
    setPlaying(false)
    setProgress(0)
    setViewMode('external')
    progressRef.current = 0
    completionRecordedRef.current = false
  }, [])

  const activateStation = useCallback(
    (stationId: StentExplorerStationId, updateUrl = true, preserveCase = false) => {
      const nextStation = getStentExplorerStation(stationId)
      if (!preserveCase) setActiveCaseId('')
      setActiveStationId(stationId)
      setArchitectureId(nextStation.defaultArchitectureId)
      setControlState(
        createControlStateForArchitecture(nextStation, nextStation.defaultArchitectureId),
      )
      setInteractionDockTab('details')
      setViewMode('external')
      resetInteraction()
      if (updateUrl) {
        router.replace(`${pathname}?station=${stationId}` as Route, { scroll: false })
      }
      recordSiteModuleEvent({
        eventType: 'module_interaction',
        moduleId: MODULE_ID,
        section: stationId,
        eventPayload: { interaction: 'station_selected', stationId },
      })
    },
    [pathname, resetInteraction, router],
  )

  function selectArchitecture(nextArchitectureId: StentExplorerArchitectureId) {
    setArchitectureId(nextArchitectureId)
    setControlState(createControlStateForArchitecture(station, nextArchitectureId))
    resetInteraction()
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: activeStationId,
      eventPayload: {
        interaction: 'architecture_selected',
        stationId: activeStationId,
        architectureId: nextArchitectureId,
      },
    })
  }

  function selectCase(caseId: string) {
    const nextCase = stentExplorerCasePresets.find((preset) => preset.id === caseId)
    if (!nextCase) return
    setActiveCaseId(caseId)
    activateStation(nextCase.initialStationId, true, true)
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: nextCase.initialStationId,
      eventPayload: { interaction: 'case_preset_selected', caseId },
    })
  }

  function commitPrediction() {
    if (!selectedChoiceId) return
    setCommitted(true)
    completionRecordedRef.current = false
    if (reducedMotion) {
      const staticProgress = reducedMotionRevealProgress(activeStationId)
      setProgress(staticProgress)
      progressRef.current = staticProgress
    } else {
      setProgress(0)
      progressRef.current = 0
      setPlaying(true)
    }
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: activeStationId,
      eventPayload: {
        interaction: 'prediction_committed',
        stationId: activeStationId,
        architectureId,
        choiceId: selectedChoiceId,
      },
    })
  }

  function resetStationExploration() {
    resetInteraction()
    setInteractionDockTab('self-check')
    setControlState(createControlStateForArchitecture(station, architectureId))
  }

  function skipPrediction() {
    setPredictionSkipped(true)
    setCommitted(false)
    setPlaying(false)
    completionRecordedRef.current = false
    if (reducedMotion) {
      const staticProgress = reducedMotionRevealProgress(activeStationId)
      setProgress(staticProgress)
      progressRef.current = staticProgress
    } else {
      setProgress(0)
      progressRef.current = 0
    }
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: activeStationId,
      eventPayload: {
        interaction: 'prediction_skipped',
        stationId: activeStationId,
        architectureId,
      },
    })
  }

  function skipPredictionAndPlay() {
    setShowPlayPrompt(false)
    setPredictionSkipped(true)
    setCommitted(false)
    completionRecordedRef.current = false
    setInteractionDockTab('explore')
    if (systemReducedMotion) setMotionOverride(true)
    setProgress(0)
    progressRef.current = 0
    setPlaying(true)
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: activeStationId,
      eventPayload: {
        interaction: 'prediction_skipped',
        stationId: activeStationId,
        architectureId,
        entry: 'play_prompt',
      },
    })
  }

  function openSelfCheckFromPlayPrompt() {
    setShowPlayPrompt(false)
    setInteractionDockTab('self-check')
    requestAnimationFrame(() => {
      document.getElementById('stent-interaction-tab-self-check')?.focus()
    })
  }

  function handlePlaybackRequest() {
    if (!interactionUnlocked) {
      setShowPlayPrompt(true)
      return
    }
    if (reducedMotion) {
      setMotionOverride(true)
      progressRef.current = 0
      setProgress(0)
      completionRecordedRef.current = false
      setPlaying(true)
      return
    }
    if (playing) {
      setPlaying(false)
      return
    }
    if (progressRef.current >= 0.999) {
      progressRef.current = 0
      setProgress(0)
      completionRecordedRef.current = false
    }
    setPlaying(true)
  }

  function handleDockTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, tabIndex: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (tabIndex + 1) % interactionDockTabs.length
    if (event.key === 'ArrowLeft') {
      nextIndex = (tabIndex - 1 + interactionDockTabs.length) % interactionDockTabs.length
    }
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = interactionDockTabs.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const nextTab = interactionDockTabs[nextIndex]
    setInteractionDockTab(nextTab.id)
    document.getElementById(`stent-interaction-tab-${nextTab.id}`)?.focus()
  }

  return (
    <HandoffContent>
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-background pb-20">
        <header className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.15),transparent_42%)] text-white">
          <div className="container max-w-[96rem] px-4 py-8 sm:px-6 sm:py-10">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,0.42fr)] xl:items-end">
              <div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                  <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-cyan-200">
                    Eleven open clinical questions
                  </span>
                  <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-amber-100">
                    {stentExplorerReleaseBadge}
                  </span>
                  {locale !== 'en' ? (
                    <span
                      className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-amber-100"
                      data-no-handoff-translate
                    >
                      English clinical fallback · translation review pending
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Airway stent mechanics &amp; failure explorer
                </p>
                <h1 className="mt-3 max-w-5xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  See how architecture becomes a clinical consequence
                </h1>
                <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-200 sm:text-base">
                  Choose any mechanical question, predict or skip, and inspect how lumen, motion,
                  fit, tissue response, disease, and device integrity interact. There is no required
                  order, score, or completion gate.
                </p>
              </div>

              <aside className="rounded-2xl border border-cyan-300/25 bg-cyan-300/8 p-4 backdrop-blur sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  {activeCase ? 'Current clinical lens' : 'Current question lens'}
                </p>
                <p className="mt-3 text-lg font-bold">{activeCase?.label ?? station.shortLabel}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {activeCase?.summary ?? station.clinicalHook}
                </p>
                {activeCase ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeCase.stationIds.map((stationId) => (
                      <button
                        key={stationId}
                        type="button"
                        onClick={() => activateStation(stationId, true, true)}
                        className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-300/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      >
                        {getStentExplorerStation(stationId).shortLabel}
                      </button>
                    ))}
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </header>

        <div className="container max-w-[96rem] space-y-5 px-4 pt-5 sm:px-6">
          <StentMechanicsDisclaimer />

          <section aria-labelledby="stent-case-starts-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                  Optional case starting points
                </p>
                <h2 id="stent-case-starts-title" className="mt-1 text-2xl font-bold">
                  Start with a case—or choose a clinical question
                </h2>
              </div>
              <a
                href="#stent-explorer-evidence"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Evidence and limitations
              </a>
            </div>
            <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2">
              {stentExplorerCasePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={preset.id === activeCaseId}
                  onClick={() => selectCase(preset.id)}
                  className={cn(
                    'min-w-[13rem] snap-start rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none',
                    preset.id === activeCaseId
                      ? 'border-cyan-500/60 bg-cyan-500/10'
                      : 'bg-card hover:border-cyan-500/45',
                  )}
                >
                  <span className="text-sm font-bold">{preset.label}</span>
                  <span className="mt-1 block max-h-9 overflow-hidden text-[11px] leading-[1.125rem] text-muted-foreground">
                    {preset.summary}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-4">
            <StentStationNavigator
              activeStationId={activeStationId}
              stations={stentExplorerStations}
              onSelect={activateStation}
            />

            <div className="min-w-0 space-y-5">
              <section
                ref={workspaceRef}
                aria-label={focusWorkspace ? 'Focused airway stent workspace' : undefined}
                aria-modal={focusWorkspace || undefined}
                role={focusWorkspace ? 'dialog' : undefined}
                className={cn(
                  'rounded-3xl border bg-card shadow-sm',
                  focusWorkspace &&
                    'fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden rounded-none border-0 bg-background p-3 sm:p-4',
                )}
              >
                <header
                  className={cn(
                    'border-b bg-gradient-to-r from-cyan-500/10 via-background to-indigo-500/10 p-4 sm:p-5',
                    focusWorkspace && 'shrink-0 rounded-2xl border',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-800 dark:text-cyan-200">
                          Clinical question {station.number} · {station.category}
                        </span>
                        <span className="rounded-full border px-3 py-1 text-muted-foreground">
                          Qualitative educational model
                        </span>
                      </div>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                        {station.title}
                      </h2>
                      <p
                        className={cn(
                          'mt-1.5 max-w-6xl text-sm leading-6 text-muted-foreground',
                          focusWorkspace && 'max-h-12 overflow-hidden',
                        )}
                      >
                        {station.clinicalHook}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <button
                        ref={focusWorkspace ? exitFocusButtonRef : undefined}
                        type="button"
                        aria-pressed={focusWorkspace}
                        onClick={() => setFocusWorkspace((current) => !current)}
                        className="hidden min-h-10 items-center gap-2 rounded-xl border bg-background px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 xl:inline-flex"
                      >
                        {focusWorkspace ? (
                          <Minimize2 className="h-4 w-4" aria-hidden />
                        ) : (
                          <Maximize2 className="h-4 w-4" aria-hidden />
                        )}
                        {focusWorkspace ? 'Exit focus' : 'Focus workspace'}
                      </button>
                    </div>
                  </div>
                </header>

                <div
                  className={cn(
                    'grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,23rem)]',
                    focusWorkspace &&
                      'min-h-0 flex-1 overflow-hidden p-0 pt-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,24rem)]',
                  )}
                >
                  <div
                    className={cn(
                      'min-w-0 space-y-3 xl:sticky xl:top-20 xl:self-start',
                      focusWorkspace &&
                        'grid h-full min-h-0 !self-stretch grid-rows-[auto_minmax(0,1fr)_auto] gap-3 space-y-0 overflow-hidden xl:static',
                    )}
                  >
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label="Visualization view"
                    >
                      {viewModes.map((candidate) => {
                        const Icon = candidate.icon
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            aria-pressed={viewMode === candidate.id}
                            disabled={!interactionUnlocked && candidate.id !== 'external'}
                            onClick={() => setViewMode(candidate.id)}
                            className={cn(
                              'inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40',
                              viewMode === candidate.id
                                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-800 dark:text-cyan-100'
                                : 'bg-background hover:bg-muted',
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                            {candidate.label}
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        aria-pressed={visibleHotspots}
                        disabled={!interactionUnlocked}
                        onClick={() => setShowHotspots((current) => !current)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-background px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {visibleHotspots ? (
                          <Eye className="h-4 w-4" aria-hidden />
                        ) : (
                          <EyeOff className="h-4 w-4" aria-hidden />
                        )}
                        Hotspots
                      </button>
                    </div>

                    <div className="relative min-h-0">
                      <div className="relative z-20 mb-3 grid gap-2 rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-3 text-white shadow-xl backdrop-blur lg:absolute lg:right-4 lg:top-4 lg:mb-0 lg:w-[20rem]">
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                          Choose clinical question
                          <select
                            aria-label="Choose clinical question"
                            value={activeStationId}
                            onChange={(event) =>
                              activateStation(event.currentTarget.value as StentExplorerStationId)
                            }
                            className="mt-1.5 block min-h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                          >
                            {stentExplorerStations.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.number}. {candidate.shortLabel}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                          Choose stent architecture
                          <select
                            aria-label="Choose stent architecture"
                            value={architectureId}
                            onChange={(event) =>
                              selectArchitecture(
                                event.currentTarget.value as StentExplorerArchitectureId,
                              )
                            }
                            className="mt-1.5 block min-h-11 w-full rounded-xl border border-white/15 bg-slate-900 px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                          >
                            {station.architectureOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="text-[10px] leading-4 text-slate-400">
                          Changing either choice resets the prediction and animation.
                        </p>
                      </div>

                      <StentExplorerViewportDynamic
                        architectureId={architectureId}
                        className={cn(
                          'h-[clamp(20rem,42dvh,28rem)] !min-h-[20rem] xl:h-[clamp(28rem,58dvh,43rem)]',
                          focusWorkspace && 'h-full !min-h-0 rounded-2xl',
                        )}
                        modifiers={mechanicsModifiers}
                        playing={playing}
                        progress={progress}
                        reducedMotion={reducedMotion}
                        showHotspots={visibleHotspots}
                        station={station}
                        viewMode={viewMode}
                        onVisibilityChange={setViewportVisible}
                      />
                    </div>

                    <div
                      className={cn(
                        'rounded-2xl border bg-muted/20 p-4',
                        focusWorkspace && 'max-h-[13rem] overflow-y-auto p-3',
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
                            {activePhase.label}
                          </p>
                          <p
                            className={cn(
                              'mt-1 text-sm leading-6 text-muted-foreground',
                              focusWorkspace && 'max-h-6 overflow-hidden',
                            )}
                          >
                            {activePhase.instruction}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handlePlaybackRequest}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-600 px-3 text-xs font-bold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                          >
                            {playing ? (
                              <Pause className="h-4 w-4" aria-hidden />
                            ) : (
                              <Play className="h-4 w-4" aria-hidden />
                            )}
                            {playing ? 'Pause' : progress >= 1 ? 'Replay' : 'Play'}
                          </button>
                          <button
                            type="button"
                            disabled={!interactionUnlocked}
                            onClick={() => {
                              setPlaying(false)
                              setProgress(0)
                              progressRef.current = 0
                              completionRecordedRef.current = false
                            }}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-background px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden />
                            Reset pose
                          </button>
                        </div>
                      </div>
                      <label className="mt-4 block">
                        <span className="sr-only">Animation progress</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(progress * 100)}
                          disabled={!interactionUnlocked}
                          onChange={(event) => {
                            const next = Number(event.target.value) / 100
                            setPlaying(false)
                            setProgress(next)
                            progressRef.current = next
                          }}
                          className="w-full accent-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </label>
                      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                        <span>Baseline</span>
                        <span>{Math.round(progress * 100)}%</span>
                        <span>Clinical consequence</span>
                      </div>
                      <p
                        className={cn(
                          'mt-3 text-xs leading-5 text-muted-foreground',
                          focusWorkspace && 'max-h-10 overflow-hidden',
                        )}
                        aria-live="polite"
                      >
                        <strong className="text-foreground">Text equivalent:</strong>{' '}
                        {activePhase.textEquivalent}
                      </p>
                      {systemReducedMotion && motionOverride ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/50 bg-cyan-50/70 p-3 dark:border-cyan-300/20 dark:bg-cyan-300/5">
                          <p className="text-xs leading-5 text-cyan-900 dark:text-cyan-100">
                            Animation is enabled for this module even though your device requests
                            reduced motion.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const staticProgress = reducedMotionRevealProgress(activeStationId)
                              setMotionOverride(false)
                              setPlaying(false)
                              setProgress(staticProgress)
                              progressRef.current = staticProgress
                            }}
                            className="min-h-9 rounded-lg border bg-background px-3 text-[11px] font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                          >
                            Use static states
                          </button>
                        </div>
                      ) : reducedMotion ? (
                        <div className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50/70 p-3 dark:border-amber-300/20 dark:bg-amber-300/5">
                          <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
                            Reduced motion is active by default. Commit or skip the optional
                            prediction to inspect static states, or select Play to run the full
                            animation for this module.
                          </p>
                          <div
                            aria-label="Reduced-motion static state"
                            className="mt-2 flex flex-wrap gap-2"
                            role="group"
                          >
                            {[
                              { label: 'Baseline', value: 0 },
                              { label: 'Loaded', value: 0.5 },
                              { label: 'Recovered / consequence', value: 1 },
                            ].map((state) => (
                              <button
                                key={state.label}
                                type="button"
                                aria-pressed={Math.abs(progress - state.value) < 0.01}
                                disabled={!interactionUnlocked}
                                onClick={() => {
                                  setPlaying(false)
                                  setProgress(state.value)
                                  progressRef.current = state.value
                                }}
                                className="min-h-9 rounded-lg border bg-background px-3 text-[11px] font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-cyan-500 aria-pressed:bg-cyan-500/10"
                              >
                                {state.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <aside
                    aria-label="Clinical question interaction dock"
                    className={cn(
                      'min-h-0 overflow-hidden rounded-2xl border bg-background shadow-sm xl:sticky xl:top-20 xl:flex xl:max-h-[calc(100dvh-6rem)] xl:flex-col',
                      focusWorkspace && 'h-full max-h-none xl:static',
                    )}
                  >
                    <div
                      aria-label="Clinical question interaction panels"
                      className="grid shrink-0 grid-cols-4 gap-1 border-b bg-muted/30 p-1.5"
                      role="tablist"
                    >
                      {interactionDockTabs.map((dockTab, tabIndex) => {
                        const Icon = dockTab.icon
                        const selected = interactionDockTab === dockTab.id
                        return (
                          <button
                            key={dockTab.id}
                            id={`stent-interaction-tab-${dockTab.id}`}
                            type="button"
                            aria-controls="stent-interaction-tabpanel"
                            aria-selected={selected}
                            onClick={() => setInteractionDockTab(dockTab.id)}
                            onKeyDown={(event) => handleDockTabKeyDown(event, tabIndex)}
                            role="tab"
                            tabIndex={selected ? 0 : -1}
                            className={cn(
                              'flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                              selected
                                ? 'bg-background text-cyan-800 shadow-sm dark:text-cyan-100'
                                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                            <span className="truncate">{dockTab.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div
                      id="stent-interaction-tabpanel"
                      aria-labelledby={`stent-interaction-tab-${interactionDockTab}`}
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-color:rgb(100_116_139)_transparent] [scrollbar-width:thin] sm:p-4"
                      role="tabpanel"
                      tabIndex={0}
                    >
                      {interactionDockTab === 'details' ? (
                        <div className="space-y-4">
                          <section className="rounded-xl border bg-muted/15 p-3">
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-200">
                              Clinical case lens
                              <select
                                aria-label="Clinical case lens"
                                value={activeCaseId}
                                onChange={(event) => {
                                  const nextCaseId = event.currentTarget.value
                                  if (nextCaseId) selectCase(nextCaseId)
                                  else setActiveCaseId('')
                                }}
                                className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3 text-sm normal-case tracking-normal text-foreground"
                              >
                                <option value="">No case lens · clinical question only</option>
                                {stentExplorerCasePresets.map((preset) => (
                                  <option key={preset.id} value={preset.id}>
                                    {preset.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {activeCase?.summary ??
                                'Choose an optional case lens or continue with the current clinical question.'}
                            </p>
                            {activeCase ? (
                              <div className="mt-3 border-t pt-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                  Questions in this case
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {activeCase.stationIds.map((stationId) => (
                                    <button
                                      key={stationId}
                                      type="button"
                                      aria-pressed={stationId === activeStationId}
                                      onClick={() => activateStation(stationId, true, true)}
                                      className="rounded-full border px-3 py-1.5 text-[11px] font-semibold hover:border-cyan-500/60 hover:bg-cyan-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 aria-pressed:border-cyan-500 aria-pressed:bg-cyan-500/10"
                                    >
                                      {getStentExplorerStation(stationId).shortLabel}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </section>

                          <section>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
                              Architecture of the selected stent
                            </p>
                            <div className="mt-3 rounded-xl border bg-muted/15 p-3">
                              <p className="text-sm font-bold">{architecture.label}</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {architecture.construction}
                              </p>
                            </div>
                            <StentArchitectureFingerprint
                              architecture={architecture}
                              revealed={interactionUnlocked}
                            />
                          </section>
                        </div>
                      ) : null}

                      {interactionDockTab === 'self-check' ? (
                        <StentPredictionPanel
                          compact
                          committed={committed}
                          reducedMotion={reducedMotion}
                          skipped={predictionSkipped}
                          selectedChoiceId={selectedChoiceId}
                          station={station}
                          onSelect={setSelectedChoiceId}
                          onCommit={commitPrediction}
                          onSkip={skipPrediction}
                          onReset={resetStationExploration}
                        />
                      ) : null}

                      {interactionDockTab === 'explore' ? (
                        interactionUnlocked ? (
                          <StentStationControls
                            architectureId={architectureId}
                            station={station}
                            value={controlState}
                            onChange={(nextControlState) => {
                              setControlState(nextControlState)
                              setPlaying(false)
                            }}
                          />
                        ) : (
                          <section className="rounded-2xl border border-dashed bg-muted/10 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
                              Explore panel locked
                            </p>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              Commit or skip the optional self-check to unlock question-specific
                              mechanics controls while the 3D view stays in place.
                            </p>
                            <button
                              type="button"
                              onClick={() => setInteractionDockTab('self-check')}
                              className="mt-3 min-h-10 rounded-xl border bg-background px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                            >
                              Open self-check
                            </button>
                          </section>
                        )
                      ) : null}

                      {interactionDockTab === 'inspect' ? (
                        interactionUnlocked ? (
                          <div className="space-y-4" aria-live="polite">
                            <section className="rounded-2xl border bg-background p-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                                  {committed
                                    ? 'Clinical debrief revealed'
                                    : 'Clinical debrief available'}
                                </p>
                              </div>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-200">
                                Inspect these hotspots
                              </p>
                              <ul className="mt-3 space-y-3">
                                {availableHotspots.map((hotspot, index) => (
                                  <li key={hotspot.id} className="flex gap-3 text-sm leading-6">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
                                      {index + 1}
                                    </span>
                                    <span>
                                      <strong className="block">{hotspot.label}</strong>
                                      <span className="text-xs text-muted-foreground">
                                        {hotspot.description}
                                      </span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </section>
                            <DebriefColumn title="What changed" items={station.whatChanged} />
                            <DebriefColumn title="Why it matters" items={station.whyItMatters} />
                            <DebriefColumn title="What to inspect" items={station.inspect} />
                            <DebriefColumn
                              title="Conceptual response"
                              items={station.conceptualResponse}
                            />
                          </div>
                        ) : (
                          <section className="rounded-2xl border border-dashed bg-muted/10 p-4 text-center">
                            <p className="text-sm font-semibold">
                              The clinical debrief is intentionally hidden.
                            </p>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              Commit or skip the optional self-check to reveal hotspots,
                              consequences, inspection priorities, and conceptual response.
                            </p>
                            <button
                              type="button"
                              onClick={() => setInteractionDockTab('self-check')}
                              className="mt-3 min-h-10 rounded-xl border bg-background px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                            >
                              Open self-check
                            </button>
                          </section>
                        )
                      ) : null}
                    </div>
                  </aside>
                </div>
              </section>

              <StentPlayPrompt
                open={showPlayPrompt}
                reducedMotion={reducedMotion}
                stationTitle={station.title}
                onClose={() => setShowPlayPrompt(false)}
                onSelfCheck={openSelfCheckFromPlayPrompt}
                onSkipAndPlay={skipPredictionAndPlay}
              />

              <div id="stent-explorer-evidence" className="scroll-mt-24">
                <StentEvidencePanel
                  revealed={interactionUnlocked}
                  station={station}
                  onSourceOpen={(sourceId) =>
                    recordSiteModuleEvent({
                      eventType: 'module_interaction',
                      moduleId: MODULE_ID,
                      section: activeStationId,
                      eventPayload: {
                        interaction: 'source_opened',
                        stationId: activeStationId,
                        sourceId,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </HandoffContent>
  )
}
