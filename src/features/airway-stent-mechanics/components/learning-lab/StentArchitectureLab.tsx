'use client'

import {
  Activity,
  ArrowDownToLine,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  MoveHorizontal,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Target,
  Waves,
  Wind,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { cn } from '@/lib/cn'

import {
  architectureRegistry,
  getArchitectureProfile,
  supportsLoadMode,
} from '../../content/architectureRegistry'
import { forceLabMissions, guidedForceScenes } from '../../content/learningLabCopy'
import { applyLoadAmplitude, getLoadFrame } from '../../engine/learningLabMechanics'
import {
  STENT_LOAD_MODES,
  isStentArchitectureId,
  isStentLoadMode,
  type ForceLabMission,
  type LoadFrame,
  type StentArchitectureId,
  type StentArchitectureProfile,
  type StentLabExperience,
  type StentLabExperienceProgress,
  type StentLoadMode,
} from '../../engine/learningLabTypes'
import { StentArchitectureViewport } from './StentArchitectureViewport'

export interface StentArchitectureLabProps {
  experience?: StentLabExperience
  initialArchitectureId?: StentArchitectureId
  onExperienceProgress?: (progress: StentLabExperienceProgress) => void
}

interface ForceLabMissionAttempt {
  architectureId: StentArchitectureId
  choiceId: string
  correct: boolean
  loadMode: StentLoadMode
  observedArchitectureIds: StentArchitectureId[]
}

export interface AirwayStentLabTestHook {
  architectures: () => StentArchitectureId[]
  frameAt: (progress: number) => LoadFrame
  loadModes: () => StentLoadMode[]
  pause: () => void
  play: () => void
  readout: () => {
    active: boolean
    amplitude: number
    architectureId: StentArchitectureId
    frame: LoadFrame | null
    mode: StentLoadMode
    playing: boolean
    reducedMotion: boolean
    requestedPlaying: boolean
  }
  setAmplitude: (amplitude: number) => void
  setArchitecture: (architectureId: string) => void
  setLoadMode: (mode: string) => void
}

interface AirwayStentLabHookState {
  active: boolean
  allowedModes: StentLoadMode[]
  availableArchitectureIds: StentArchitectureId[]
  amplitude: number
  architectureId: StentArchitectureId
  effectivePlaying: boolean
  frame: LoadFrame | null
  mode: StentLoadMode
  playing: boolean
  profile: StentArchitectureProfile
  reducedMotion: boolean
}

declare global {
  interface Window {
    __airwayStentLab?: AirwayStentLabTestHook
  }
}

const loadModePresentation: Record<
  StentLoadMode,
  { description: string; icon: typeof Activity; label: string; teachingCue: string }
> = {
  rest: {
    description: 'Inspect the unloaded topology before applying a boundary motion.',
    icon: Activity,
    label: 'Unloaded',
    teachingCue: 'Use the gray reference rings to establish unloaded diameter and length.',
  },
  radial: {
    description: 'Apply symmetric diameter reduction to the scaffold and airway.',
    icon: MoveHorizontal,
    label: 'Radial compression',
    teachingCue: 'Watch diameter narrow while braided and knitted scaffolds visibly lengthen.',
  },
  bend: {
    description: 'Impose the same centerline bend and inspect the inner and outer curves.',
    icon: ArrowDownToLine,
    label: 'Bend',
    teachingCue: 'Compare inner-curve crowding, outer-curve opening, and end alignment.',
  },
  ovalization: {
    description: 'Apply focal eccentric narrowing without calling it a force result.',
    icon: ScanLine,
    label: 'Focal ovalization',
    teachingCue: 'Watch the minor axis narrow while the perpendicular axis opens.',
  },
  breathing: {
    description: 'Cycle a small, distributed airway-shape change.',
    icon: Wind,
    label: 'Breathing',
    teachingCue: 'Breathing motion is deliberately amplified so cyclic shape change is visible.',
  },
  cough: {
    description: 'Show a short focal displacement pulse at the tissue–device interface.',
    icon: Zap,
    label: 'Cough pulse',
    teachingCue: 'The amplified pulse highlights rapid deformation and recovery, not cough force.',
  },
  deployment: {
    description: 'Move between constrained and expanded geometry to reveal length coupling.',
    icon: Waves,
    label: 'Deployment coupling',
    teachingCue:
      'Watch the constrained, elongated scaffold expand and shorten—visible foreshortening.',
  },
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotion(callback: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery)
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => false)
}

function useSceneActivity<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [intersecting, setIntersecting] = useState(true)
  const [documentVisible, setDocumentVisible] = useState(true)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry?.isIntersecting ?? true),
      { rootMargin: '160px 0px', threshold: 0.01 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => setDocumentVisible(document.visibilityState === 'visible')
    onVisibilityChange()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return { active: intersecting && documentVisible, ref }
}

function formatDiameterRetention(value: number | null | undefined) {
  if (value === null) return 'Not applicable'
  if (value === undefined) return 'Preparing geometry…'
  const change = (value - 1) * 100
  if (Math.abs(change) < 0.5) return 'At unloaded diameter'
  if (change < 0) {
    return `${Math.abs(change).toFixed(0)}% narrower · ${Math.round(value * 100)}% retained`
  }
  return `${change.toFixed(0)}% wider than unloaded`
}

function formatLengthChange(value: number | null | undefined) {
  if (value === null) return 'Not applicable'
  if (value === undefined) return 'Preparing geometry…'
  const percent = value * 100
  if (Math.abs(percent) < 0.1) return 'At unloaded length'
  if (percent > 0) return `${percent.toFixed(1)}% longer than unloaded`
  return `${Math.abs(percent).toFixed(1)}% shorter · foreshortened`
}

function anatomyLegend(profile: StentArchitectureProfile): string[] {
  if (profile.geometryBuilder === 'hook-cross-captured-helices') {
    return [
      'Silver diamond paths: woven wires and simple crosses',
      'Gold eye-shaped nodes: captured hook junctions',
      'Translucent layer: fixed full cover',
    ]
  }
  if (profile.geometryBuilder === 'single-wire-knitted-loops') {
    return [
      'Cyan courses: one continuous wire',
      'Interlocking waves: circumferential knitted loops',
      'Translucent midsection: fixed partial cover',
    ]
  }
  return []
}

function ForcePracticeMissionPanel({
  activeMission,
  activeMissionId,
  architectureId,
  attempts,
  loadMode,
  missionAnswers,
  missionObservations,
  onCommit,
  onSelectAnswer,
  onSelectMission,
}: {
  activeMission: ForceLabMission
  activeMissionId: string
  architectureId: StentArchitectureId
  attempts: Record<string, ForceLabMissionAttempt>
  loadMode: StentLoadMode
  missionAnswers: Record<string, string>
  missionObservations: Record<string, StentArchitectureId[]>
  onCommit: () => void
  onSelectAnswer: (missionId: string, choiceId: string) => void
  onSelectMission: (missionId: string) => void
}) {
  const attempt = attempts[activeMission.id]
  const selectedChoiceId = missionAnswers[activeMission.id]
  const observedArchitectureIds = missionObservations[activeMission.id] ?? []
  const selectedChoice = activeMission.choices.find((choice) => choice.id === selectedChoiceId)
  const missionIndex = forceLabMissions.findIndex((mission) => mission.id === activeMission.id)
  const nextMission = forceLabMissions[missionIndex + 1]
  const attemptedChoice = attempt
    ? activeMission.choices.find((choice) => choice.id === attempt.choiceId)
    : undefined
  const requiredArchitecturesObserved = activeMission.requiredArchitectureIds.every((id) =>
    attempt?.observedArchitectureIds.includes(id),
  )

  return (
    <div
      className="border-b border-slate-800 bg-slate-900/55 px-5 py-5 sm:px-7"
      data-testid="force-practice-missions"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            <Target className="h-4 w-4" aria-hidden />
            Case mission {missionIndex + 1} of {forceLabMissions.length}
          </p>
          <h4 className="mt-2 text-xl font-semibold text-white">{activeMission.title}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-300">{activeMission.stem}</p>
          <p className="mt-2 text-sm font-medium leading-6 text-white">{activeMission.task}</p>
        </div>
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-100">
          Configure the lab, inspect the visible geometry, then commit. No force or pressure is
          calculated.
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Force Lab practice missions">
        {forceLabMissions.map((mission, index) => {
          const selected = mission.id === activeMissionId
          const completed = Boolean(attempts[mission.id])
          return (
            <button
              key={mission.id}
              type="button"
              onClick={() => onSelectMission(mission.id)}
              aria-current={selected ? 'step' : undefined}
              className={cn(
                'rounded-xl border p-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                selected
                  ? 'border-cyan-300/60 bg-cyan-300/10 text-white'
                  : 'border-slate-700 bg-slate-950/55 text-slate-300 hover:border-slate-500',
              )}
            >
              <span className="font-semibold">
                {completed ? 'Completed' : `Mission ${index + 1}`}
              </span>
              <span className="mt-1 block leading-4 text-slate-400">{mission.title}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid gap-2" role="radiogroup" aria-label={activeMission.task}>
          {activeMission.choices.map((choice) => {
            const selected = selectedChoiceId === choice.id
            const correctChoice = Boolean(attempt) && choice.id === activeMission.correctChoiceId
            const selectedWrong = Boolean(attempt) && selected && !correctChoice
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={Boolean(attempt)}
                onClick={() => onSelectAnswer(activeMission.id, choice.id)}
                className={cn(
                  'rounded-xl border p-3 text-left text-xs leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-default',
                  !attempt && selected && 'border-cyan-300/60 bg-cyan-300/10 text-white',
                  !attempt && !selected && 'border-slate-700 bg-slate-950/55 text-slate-300',
                  correctChoice && 'border-emerald-400/55 bg-emerald-400/10 text-white',
                  selectedWrong && 'border-amber-300/55 bg-amber-300/10 text-white',
                )}
              >
                <span className="font-medium">{choice.label}</span>
                {attempt ? (
                  <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                    {choice.rationale}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/65 p-3 text-xs">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">
            Current configuration
          </p>
          <dl className="mt-2 space-y-2 text-slate-200">
            <div>
              <dt className="text-slate-500">Architecture</dt>
              <dd>{getArchitectureProfile(architectureId).shortLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Applied displacement</dt>
              <dd>{loadModePresentation[loadMode].label}</dd>
            </div>
          </dl>
          {activeMission.requiredArchitectureIds.length > 0 ? (
            <div className="mt-3 border-t border-slate-700 pt-3">
              <p className="text-slate-500">Required observations</p>
              <ul className="mt-1 space-y-1 text-slate-300">
                {activeMission.requiredArchitectureIds.map((id) => (
                  <li key={id} className="flex items-center gap-2">
                    {observedArchitectureIds.includes(id) ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                    ) : (
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-slate-600"
                        aria-hidden
                      />
                    )}
                    {getArchitectureProfile(id).shortLabel}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!attempt ? (
            <button
              type="button"
              onClick={onCommit}
              disabled={!selectedChoice || loadMode === 'rest'}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-cyan-300 px-3 text-xs font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              Commit configuration and answer
            </button>
          ) : (
            <div
              className={cn(
                'mt-4 rounded-xl border p-3 leading-5',
                attempt.correct
                  ? 'border-emerald-400/45 bg-emerald-400/10 text-emerald-100'
                  : 'border-amber-300/45 bg-amber-300/10 text-amber-100',
              )}
              role="status"
            >
              <p className="flex items-center gap-2 font-semibold">
                {attempt.correct ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                ) : (
                  <CircleAlert className="h-4 w-4" aria-hidden />
                )}
                {attempt.correct ? 'Defensible interpretation' : 'Reframe the comparison'}
              </p>
              <p className="mt-2 text-[11px] leading-4">
                You used {loadModePresentation[attempt.loadMode].label.toLowerCase()} with{' '}
                {getArchitectureProfile(attempt.architectureId).shortLabel}.
                {!requiredArchitecturesObserved ? ' The prescribed comparison was incomplete.' : ''}
              </p>
              <p className="mt-2 text-[11px] leading-4">
                {attemptedChoice?.rationale} {activeMission.explanation}
              </p>
              {nextMission ? (
                <button
                  type="button"
                  onClick={() => onSelectMission(nextMission.id)}
                  className="mt-3 min-h-10 w-full rounded-lg border border-current/25 px-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Next mission
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function StentArchitectureLab({
  experience = 'architecture-explorer',
  initialArchitectureId,
  onExperienceProgress,
}: StentArchitectureLabProps) {
  const reducedMotion = usePrefersReducedMotion()
  const guidedExperience = experience === 'guided-force'
  const practiceExperience = experience === 'force-practice'
  const defaultArchitecture =
    initialArchitectureId ??
    (guidedExperience || practiceExperience ? 'free-crossing-braid' : 'studded-silicone')
  const [architectureId, setArchitectureId] = useState<StentArchitectureId>(defaultArchitecture)
  const [mode, setMode] = useState<StentLoadMode>(
    guidedExperience || practiceExperience ? 'radial' : 'rest',
  )
  const [amplitude, setAmplitude] = useState(guidedExperience ? 0.76 : 0.88)
  const [playing, setPlaying] = useState(false)
  const [showAirway, setShowAirway] = useState(true)
  const [showCover, setShowCover] = useState(true)
  const [resetVersion, setResetVersion] = useState(0)
  const [frame, setFrame] = useState<LoadFrame | null>(null)
  const [visitedGuidedSceneIds, setVisitedGuidedSceneIds] = useState<string[]>(() =>
    guidedExperience && guidedForceScenes[0] ? [guidedForceScenes[0].id] : [],
  )
  const [activeMissionId, setActiveMissionId] = useState(forceLabMissions[0]?.id ?? '')
  const [missionAnswers, setMissionAnswers] = useState<Record<string, string>>({})
  const [missionAttempts, setMissionAttempts] = useState<Record<string, ForceLabMissionAttempt>>({})
  const [missionObservations, setMissionObservations] = useState<
    Record<string, StentArchitectureId[]>
  >({})
  const testHookStateRef = useRef<AirwayStentLabHookState | null>(null)
  const { active: sceneActive, ref: sceneRef } = useSceneActivity<HTMLElement>()
  const profile = getArchitectureProfile(architectureId)
  const topologyLegend = anatomyLegend(profile)
  const guidedModes = useMemo(
    () => new Set<StentLoadMode>(guidedForceScenes.map((scene) => scene.mode)),
    [],
  )
  const availableArchitectureIds = useMemo(
    () =>
      guidedExperience
        ? (['free-crossing-braid'] as StentArchitectureId[])
        : architectureRegistry.map((candidate) => candidate.id),
    [guidedExperience],
  )
  const allowedModes = STENT_LOAD_MODES.filter(
    (candidate) =>
      supportsLoadMode(profile, candidate) && (!guidedExperience || guidedModes.has(candidate)),
  )
  const activeGuidedScene = guidedForceScenes.find((scene) => scene.mode === mode)
  const activeMission = forceLabMissions.find((mission) => mission.id === activeMissionId)
  const activeMissionAttempt = activeMission ? missionAttempts[activeMission.id] : undefined
  const showInterpretation = !practiceExperience || Boolean(activeMissionAttempt)
  const effectivePlaying = playing && sceneActive && !reducedMotion && mode !== 'rest'

  const recordMissionObservation = useCallback(
    (
      mission: ForceLabMission | undefined,
      observedArchitectureId: StentArchitectureId,
      observedMode: StentLoadMode,
    ) => {
      if (!practiceExperience || !mission) return
      if (observedMode !== mission.correctLoadMode) return
      if (!mission.requiredArchitectureIds.includes(observedArchitectureId)) return

      setMissionObservations((current) => {
        const observed = current[mission.id] ?? []
        if (observed.includes(observedArchitectureId)) return current
        return { ...current, [mission.id]: [...observed, observedArchitectureId] }
      })
    },
    [practiceExperience],
  )

  const selectArchitecture = useCallback(
    (id: StentArchitectureId) => {
      if (guidedExperience && id !== 'free-crossing-braid') return
      const nextProfile = getArchitectureProfile(id)
      const nextMode = supportsLoadMode(nextProfile, mode)
        ? mode
        : supportsLoadMode(nextProfile, 'radial')
          ? 'radial'
          : 'rest'
      setArchitectureId(id)
      setShowCover(true)
      setPlaying(false)
      setFrame(null)
      setMode(nextMode)
      recordMissionObservation(activeMission, id, nextMode)
    },
    [activeMission, guidedExperience, mode, recordMissionObservation],
  )

  const selectMode = useCallback(
    (nextMode: StentLoadMode) => {
      if (!supportsLoadMode(architectureId, nextMode)) return
      if (guidedExperience && !guidedModes.has(nextMode)) return
      setMode(nextMode)
      setPlaying(false)
      setFrame(null)
      recordMissionObservation(activeMission, architectureId, nextMode)
    },
    [activeMission, architectureId, guidedExperience, guidedModes, recordMissionObservation],
  )

  const openGuidedScene = useCallback(
    (sceneId: string) => {
      const scene = guidedForceScenes.find((candidate) => candidate.id === sceneId)
      if (!scene) return
      selectMode(scene.mode)
      setVisitedGuidedSceneIds((current) =>
        current.includes(scene.id) ? current : [...current, scene.id],
      )
    },
    [selectMode],
  )

  const reportFrame = useCallback((nextFrame: LoadFrame) => {
    setFrame((current) => {
      if (
        current &&
        current.caption === nextFrame.caption &&
        Math.abs(current.radialScaleX - nextFrame.radialScaleX) < 0.005 &&
        Math.abs(current.radialScaleZ - nextFrame.radialScaleZ) < 0.005 &&
        Math.abs(current.axialScale - nextFrame.axialScale) < 0.005
      ) {
        return current
      }
      return nextFrame
    })
  }, [])

  const resetViewAndPose = () => {
    setPlaying(false)
    setFrame(null)
    setResetVersion((current) => current + 1)
  }

  const commitActiveMission = useCallback(() => {
    if (!activeMission || missionAttempts[activeMission.id]) return
    const choiceId = missionAnswers[activeMission.id]
    if (!choiceId || mode === 'rest') return

    const observedArchitectureIds = missionObservations[activeMission.id] ?? []
    const observedRequiredArchitectures = activeMission.requiredArchitectureIds.every((id) =>
      observedArchitectureIds.includes(id),
    )
    const correct =
      mode === activeMission.correctLoadMode &&
      choiceId === activeMission.correctChoiceId &&
      observedRequiredArchitectures

    setMissionAttempts((current) => ({
      ...current,
      [activeMission.id]: {
        architectureId,
        choiceId,
        correct,
        loadMode: mode,
        observedArchitectureIds: [...observedArchitectureIds],
      },
    }))
    setPlaying(false)
  }, [activeMission, architectureId, missionAnswers, missionAttempts, missionObservations, mode])

  const experienceProgress = useMemo<StentLabExperienceProgress>(() => {
    if (guidedExperience) {
      const completedIds = guidedForceScenes
        .filter((scene) => visitedGuidedSceneIds.includes(scene.id))
        .map((scene) => scene.id)
      return { completedIds, complete: completedIds.length === guidedForceScenes.length }
    }
    if (practiceExperience) {
      const completedIds = forceLabMissions
        .filter((mission) => Boolean(missionAttempts[mission.id]))
        .map((mission) => mission.id)
      return { completedIds, complete: completedIds.length === forceLabMissions.length }
    }
    return { completedIds: [], complete: false }
  }, [guidedExperience, missionAttempts, practiceExperience, visitedGuidedSceneIds])

  useEffect(() => {
    onExperienceProgress?.(experienceProgress)
  }, [experienceProgress, onExperienceProgress])

  const showLengthChange = profile.capabilities.supportsLengthChange
  const showDiameterRetention = profile.capabilities.supportsDiameterRetention

  useEffect(() => {
    testHookStateRef.current = {
      active: sceneActive,
      allowedModes: [...allowedModes],
      availableArchitectureIds: [...availableArchitectureIds],
      amplitude,
      architectureId,
      effectivePlaying,
      frame,
      mode,
      playing,
      profile,
      reducedMotion,
    }
  }, [
    allowedModes,
    amplitude,
    availableArchitectureIds,
    architectureId,
    effectivePlaying,
    frame,
    mode,
    playing,
    profile,
    reducedMotion,
    sceneActive,
  ])

  useEffect(() => {
    const currentState = () => {
      const current = testHookStateRef.current
      if (!current) throw new Error('The airway-stent lab is not mounted.')
      return current
    }
    const hook: AirwayStentLabTestHook = {
      architectures: () => [...currentState().availableArchitectureIds],
      frameAt: (progress) => {
        const current = currentState()
        return applyLoadAmplitude(
          getLoadFrame(current.mode, progress, current.profile),
          current.amplitude,
        )
      },
      loadModes: () => [...currentState().allowedModes],
      pause: () => setPlaying(false),
      play: () => setPlaying(true),
      readout: () => {
        const current = currentState()
        return {
          active: current.active,
          amplitude: current.amplitude,
          architectureId: current.architectureId,
          frame: current.frame,
          mode: current.mode,
          playing: current.effectivePlaying,
          reducedMotion: current.reducedMotion,
          requestedPlaying: current.playing,
        }
      },
      setAmplitude: (nextAmplitude) => {
        if (!Number.isFinite(nextAmplitude)) {
          throw new Error('Airway-stent lab amplitude must be a finite number.')
        }
        setAmplitude(Math.min(1, Math.max(0.2, nextAmplitude)))
      },
      setArchitecture: (nextArchitectureId) => {
        if (!isStentArchitectureId(nextArchitectureId)) {
          throw new Error(`Unknown airway-stent architecture: ${nextArchitectureId}`)
        }
        const current = currentState()
        if (!current.availableArchitectureIds.includes(nextArchitectureId)) {
          throw new Error(`${nextArchitectureId} is not available in this learning experience.`)
        }
        selectArchitecture(nextArchitectureId)
      },
      setLoadMode: (nextMode) => {
        if (!isStentLoadMode(nextMode)) {
          throw new Error(`Unknown airway-stent load mode: ${nextMode}`)
        }
        const current = currentState()
        if (!current.allowedModes.includes(nextMode)) {
          throw new Error(`${current.profile.id} does not support the ${nextMode} load mode.`)
        }
        selectMode(nextMode)
      },
    }

    window.__airwayStentLab = hook
    return () => {
      if (window.__airwayStentLab === hook) delete window.__airwayStentLab
    }
  }, [selectArchitecture, selectMode])

  return (
    <section
      ref={sceneRef}
      className="overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 text-white shadow-2xl"
      aria-label={
        guidedExperience
          ? 'Guided airway stent Force Lab'
          : practiceExperience
            ? 'Airway stent Force Lab practice'
            : 'Interactive airway stent architecture lab'
      }
      data-experience={experience}
      data-testid="stent-architecture-lab"
    >
      <div className="border-b border-slate-800 bg-gradient-to-r from-cyan-400/10 via-slate-950 to-rose-400/10 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            {guidedExperience
              ? 'Guided observation'
              : practiceExperience
                ? 'Commit before reveal'
                : 'Trace the load path'}
          </span>
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
            Illustrative topology · no force units
          </span>
        </div>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          {guidedExperience
            ? 'Guided Force Lab: see the constraint'
            : practiceExperience
              ? 'Force Lab practice: choose, observe, defend'
              : 'Architecture explorer'}
        </h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
          {guidedExperience
            ? 'Use one fixed free-braid schematic to learn how uniform, focal, and cyclic boundary motion changes visible geometry. The teaching scenes do not measure force, pressure, or clinical performance.'
            : practiceExperience
              ? 'Use the full cockpit to configure each case, inspect the displayed response, and commit to a defensible claim before teaching cues appear.'
              : 'Compare how a continuous wall, bifurcation, free braid, captured crossing, cut lattice, or knitted strand moves under the same imposed displacement. Animation amplitude shows visible motion—not force, pressure, stiffness, or device superiority.'}
        </p>
      </div>

      {practiceExperience && activeMission ? (
        <ForcePracticeMissionPanel
          activeMission={activeMission}
          activeMissionId={activeMissionId}
          architectureId={architectureId}
          attempts={missionAttempts}
          loadMode={mode}
          missionAnswers={missionAnswers}
          missionObservations={missionObservations}
          onCommit={commitActiveMission}
          onSelectAnswer={(missionId, choiceId) =>
            setMissionAnswers((current) => ({ ...current, [missionId]: choiceId }))
          }
          onSelectMission={(missionId) => {
            const mission = forceLabMissions.find((candidate) => candidate.id === missionId)
            setActiveMissionId(missionId)
            setPlaying(false)
            recordMissionObservation(mission, architectureId, mode)
          }}
        />
      ) : null}

      <div
        className="grid items-start lg:grid-cols-[minmax(0,1fr)_20rem]"
        data-testid="stent-architecture-cockpit"
      >
        <div className="min-w-0 border-b border-slate-800 p-4 sm:p-5 lg:order-2 lg:border-b-0 lg:border-l">
          {guidedExperience ? (
            <div
              className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] p-3"
              data-testid="guided-force-fixed-architecture"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                Fixed teaching schematic
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{profile.shortLabel}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Architecture selection is intentionally held constant so the boundary motion is the
                variable under study.
              </p>
            </div>
          ) : (
            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Architecture
              <select
                value={architectureId}
                onChange={(event) => selectArchitecture(event.target.value as StentArchitectureId)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                data-testid="architecture-selector"
              >
                {architectureRegistry
                  .filter((candidate) => availableArchitectureIds.includes(candidate.id))
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.shortLabel}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlaying((current) => !current)}
              disabled={mode === 'rest' || reducedMotion}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {effectivePlaying ? (
                <Pause className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              {mode === 'rest' ? 'Static state' : effectivePlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={resetViewAndPose}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </button>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {guidedExperience ? 'Guided scenes' : 'Applied displacement'}
            </legend>
            <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0">
              {guidedExperience
                ? guidedForceScenes.map((scene) => {
                    const presentation = loadModePresentation[scene.mode]
                    const Icon = presentation.icon
                    const selected = mode === scene.mode
                    const visited = visitedGuidedSceneIds.includes(scene.id)
                    return (
                      <button
                        key={scene.id}
                        type="button"
                        onClick={() => openGuidedScene(scene.id)}
                        aria-pressed={selected}
                        className={cn(
                          'min-h-11 min-w-[9rem] snap-start rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none lg:min-w-0',
                          selected
                            ? 'border-cyan-300/70 bg-cyan-300/10'
                            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500',
                        )}
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold leading-4">
                          {visited ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
                          ) : (
                            <Icon className="h-4 w-4 text-cyan-200" aria-hidden />
                          )}
                          {scene.shortLabel}
                        </span>
                      </button>
                    )
                  })
                : allowedModes.map((candidate) => {
                    const presentation = loadModePresentation[candidate]
                    const Icon = presentation.icon
                    const selected = mode === candidate
                    return (
                      <button
                        key={candidate}
                        type="button"
                        onClick={() => selectMode(candidate)}
                        aria-pressed={selected}
                        aria-label={
                          practiceExperience
                            ? presentation.label
                            : `${presentation.label}. ${presentation.description}`
                        }
                        className={cn(
                          'min-h-11 min-w-[9rem] snap-start rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none lg:min-w-0',
                          selected
                            ? 'border-cyan-300/70 bg-cyan-300/10'
                            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500',
                        )}
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold leading-4">
                          <Icon className="h-4 w-4 text-cyan-200" aria-hidden />
                          {presentation.label}
                        </span>
                        {!practiceExperience ? (
                          <span className="sr-only">{presentation.description}</span>
                        ) : null}
                      </button>
                    )
                  })}
            </div>
          </fieldset>

          <div
            className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="text-xs leading-5 text-slate-200">
              {guidedExperience
                ? (activeGuidedScene?.prompt ?? 'Choose a guided scene to begin.')
                : practiceExperience
                  ? 'Inspect the selected architecture under the current displacement before committing your case interpretation.'
                  : loadModePresentation[mode].description}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-4 text-cyan-100">
              {guidedExperience
                ? activeGuidedScene && visitedGuidedSceneIds.includes(activeGuidedScene.id)
                  ? activeGuidedScene.teachingCue
                  : 'Open this scene to reveal the teaching cue and count it toward the guided sequence.'
                : showInterpretation
                  ? loadModePresentation[mode].teachingCue
                  : 'Teaching cues stay hidden until the active mission is committed.'}
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
              {practiceExperience && !showInterpretation
                ? 'Selected architecture'
                : profile.topologyLabel}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">
              {profile.material} · {profile.coverage.replaceAll('-', ' ')} cover
            </p>
            {showInterpretation && topologyLegend.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-slate-700 pt-2 text-[11px] leading-4 text-slate-300">
                {topologyLegend.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-cyan-200" aria-hidden>
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {!guidedExperience ? (
            <label className="mt-3 block rounded-xl border border-slate-700 bg-slate-900/70 p-3">
              <span className="flex items-center justify-between gap-4 text-sm font-semibold">
                Visible displacement
                <span className="tabular-nums text-cyan-200">{Math.round(amplitude * 100)}%</span>
              </span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.01}
                value={amplitude}
                onChange={(event) => setAmplitude(Number(event.target.value))}
                className="mt-2 w-full accent-cyan-300"
                aria-describedby="stent-displacement-boundary"
              />
              <span
                id="stent-displacement-boundary"
                className="mt-1 block text-[11px] leading-4 text-slate-400"
              >
                A visual multiplier only. It does not represent newtons, pressure, or wall stress.
              </span>
            </label>
          ) : null}

          {!guidedExperience ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {profile.capabilities.supportsCoverInspection ? (
                <button
                  type="button"
                  onClick={() => setShowCover((current) => !current)}
                  aria-pressed={!showCover}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  {showCover ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                  {showCover ? 'Inspect scaffold' : 'Restore cover'}
                </button>
              ) : (
                <div className="flex min-h-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 px-3 text-center text-[11px] text-slate-500">
                  No removable cover layer
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowAirway((current) => !current)}
                aria-pressed={showAirway}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {showAirway ? (
                  <Eye className="h-4 w-4" aria-hidden />
                ) : (
                  <EyeOff className="h-4 w-4" aria-hidden />
                )}
                {showAirway ? 'Airway shown' : 'Airway hidden'}
              </button>
            </div>
          ) : null}

          {!guidedExperience && profile.capabilities.supportsCoverInspection ? (
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
              Scaffold inspection only hides the membrane visually; it does not change the selected
              device configuration or mechanics.
            </p>
          ) : null}

          {reducedMotion ? (
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Reduced motion is enabled. Each load remains at a representative static pose.
            </p>
          ) : playing && !sceneActive ? (
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Animation is paused while the lab is offscreen or this tab is hidden.
            </p>
          ) : null}

          {!guidedExperience && showInterpretation ? (
            <details className="mt-3 rounded-xl border border-slate-700 bg-slate-900/55 p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                Architecture details and source boundary
              </summary>
              <p className="mt-3 leading-5 text-slate-300">{profile.topologyDescription}</p>
              <dl className="mt-3 grid gap-2">
                <div>
                  <dt className="text-slate-500">Load path</dt>
                  <dd className="mt-0.5 leading-5 text-slate-200">{profile.loadPath}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Material system</dt>
                  <dd className="mt-0.5 text-slate-200">{profile.material}</dd>
                </div>
              </dl>
              {profile.brandedExample ? (
                <p className="mt-3 border-t border-slate-700 pt-3 text-[11px] leading-4 text-slate-400">
                  Sourced example: {profile.brandedExample}. This generic schematic is not product
                  CAD or a ranking.
                </p>
              ) : null}
            </details>
          ) : null}
        </div>

        <div className="min-w-0 bg-[radial-gradient(circle_at_50%_35%,rgba(8,145,178,0.23),transparent_58%)] lg:order-1">
          <div
            className="relative h-[380px] sm:h-[470px] lg:h-[clamp(32rem,64svh,39rem)]"
            data-testid="stent-architecture-viewport"
          >
            <StentArchitectureViewport
              active={sceneActive}
              amplitude={amplitude}
              mode={mode}
              onFrameChange={reportFrame}
              playing={effectivePlaying}
              profile={profile}
              reducedMotion={reducedMotion}
              resetVersion={resetVersion}
              showAirway={showAirway}
              showCover={showCover}
            />

            <div className="pointer-events-none absolute left-3 top-3 max-w-[18rem] rounded-xl border border-white/10 bg-slate-950/78 p-3 backdrop-blur sm:left-4 sm:top-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-200">
                {profile.shortLabel}
              </p>
              {showInterpretation ? (
                <p className="mt-1 hidden text-xs leading-5 text-slate-300 sm:block">
                  {profile.loadPath}
                </p>
              ) : (
                <p className="mt-1 hidden text-xs leading-5 text-slate-400 sm:block">
                  Interpretation hidden until mission commit.
                </p>
              )}
            </div>

            {showInterpretation && topologyLegend.length > 0 ? (
              <div className="pointer-events-none absolute right-4 top-4 hidden max-w-[17rem] rounded-xl border border-white/10 bg-slate-950/78 p-3 text-[11px] leading-4 text-slate-300 backdrop-blur xl:block">
                {topologyLegend.map((item) => (
                  <p key={item} className="mt-1 first:mt-0">
                    {item}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              'grid gap-2 border-t border-slate-800 bg-slate-950/60 p-3 sm:p-4',
              showDiameterRetention && showLengthChange
                ? 'sm:grid-cols-3'
                : showDiameterRetention || showLengthChange
                  ? 'sm:grid-cols-2'
                  : '',
            )}
          >
            <div className="rounded-xl border border-white/10 bg-slate-950/75 p-2.5 sm:col-span-full">
              <p
                className="text-xs font-semibold leading-5 text-slate-100"
                aria-live="polite"
                aria-atomic="true"
              >
                {profile.shortLabel}: {frame?.caption ?? loadModePresentation[mode].description}
              </p>
              <p className="text-[10px] leading-4 text-slate-500">
                Drag to orbit · scroll or pinch to zoom · animation begins paused
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/75 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Current imposed motion
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-100">
                {loadModePresentation[mode].label}
              </p>
            </div>
            {showDiameterRetention ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/75 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Visible diameter vs unloaded
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-cyan-100">
                  {formatDiameterRetention(frame?.normalizedDiameterRetention)}
                </p>
              </div>
            ) : null}
            {showLengthChange ? (
              <div className="rounded-xl border border-white/10 bg-slate-950/75 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Visible length vs unloaded
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-amber-100">
                  {formatLengthChange(frame?.normalizedLengthChange)}
                </p>
              </div>
            ) : null}
            <p className="text-[10px] leading-4 text-slate-500 sm:col-span-full">
              Gray rings mark unloaded geometry; amber rings mark current visible length. Motion is
              deliberately amplified for teaching.
            </p>
          </div>
        </div>
      </div>

      {guidedExperience ? (
        <div className="border-t border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Guided scene progress</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Open all three representative scenes. Playing the animation is optional; each scene
                also provides a static pose.
              </p>
            </div>
            <span
              className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100"
              role="status"
            >
              {visitedGuidedSceneIds.length} of {guidedForceScenes.length} scenes viewed
            </span>
          </div>
        </div>
      ) : showInterpretation ? (
        <div className="grid gap-3 border-t border-slate-800 bg-slate-900/60 p-5 sm:p-6 md:grid-cols-3">
          {profile.teachingPoints.map((point, index) => (
            <article
              key={point}
              className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300/10 text-sm font-semibold text-cyan-200">
                {index + 1}
              </span>
              <p className="mt-3 text-sm leading-6 text-slate-200">{point}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-t border-slate-800 bg-slate-900/60 px-5 py-4 text-xs leading-5 text-slate-400 sm:px-7">
          Commit the active mission to reveal architecture-specific teaching points.
        </div>
      )}

      <div className="border-t border-amber-300/20 bg-amber-300/5 px-5 py-4 text-xs leading-5 text-amber-100 sm:px-7">
        <strong>Evidence boundary:</strong> These topology-faithful educational schematics are not
        exact product CAD, finite-element analyses, bench-calibrated comparisons, placement
        guidance, or patient-specific predictions. Normalized readouts describe visible geometry
        relative to the unloaded schematic only.
      </div>
    </section>
  )
}
