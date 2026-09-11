'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import {
  ArrowDown,
  ArrowUp,
  Compass,
  Eye,
  EyeOff,
  Gamepad2,
  Headset,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveAdminAirwayAssetPath } from '@/lib/airway-anatomy/admin-assets'
import { clamp } from '@/lib/airway-anatomy/geometry'
import { loadAirwayStlGeometry } from '@/lib/airway-anatomy/airway-render'
import { AirwayXRSceneDynamic } from '@/components/airway-anatomy/AirwayXRSceneDynamic'
import {
  GameHudOverlay,
  GameIntroOverlay,
  SuccessBurst,
  TargetBeacon,
  useAirwayGame,
  type AirwayGameController,
} from '@/components/airway-anatomy/AirwayGameLayer'
import { edgePathToNode, LOBE_COLORS, type GameTarget } from '@/lib/airway-anatomy/airway-game'
import {
  buildUpcomingOstia,
  shortAnatomicalLabel,
  type OstiumLabel,
} from '@/lib/airway-anatomy/ostia'
import {
  buildScopePoseSnapshot,
  createGraphIndex,
  createInitialScopeState,
  sampleEdgePose,
  updateLookOffset,
  type ScopeState,
} from '@/lib/airway-anatomy/scope-state'
import {
  DEFAULT_SCOPE_ORIENTATION_PROFILE,
  SCOPE_ORIENTATION_PROFILE_IDS,
  applyScopeOrientationToPose,
  createEmptyScopeOrientationCalibration,
  normalizeRollDeg,
  normalizeScopeOrientationCalibration,
  parseScopeOrientationProfileId,
  scopeOrientationAdjustmentFor,
  updateScopeOrientationAdjustment,
  type ScopeOrientationCalibration,
  type ScopeOrientationProfileId,
} from '@/lib/airway-anatomy/scope-orientation'
import type {
  AirwayAnatomyCaseManifest,
  AirwayGraph,
  AirwayGraphNode,
  CenterlineLabels,
  CtAxis,
  ScopePoseSnapshot,
  Vec3,
} from '@/lib/airway-anatomy/types'
import { HandoffContent } from '@/i18n/handoff'
import {
  buildTransportFrames,
  poseWithTransport,
  scopeOpticalFrame,
} from '@/lib/airway-anatomy/transport-frames'
import { createLumenCollider } from '@/lib/airway-anatomy/lumen-collider'
import { driveScope, enterFreeDrive, FLEXIBLE_TIP_RADIUS_MM } from '@/lib/airway-anatomy/drive'
import {
  rollFrame,
  steerFrame,
  scalar,
  minus,
  unit,
  makeFrame,
  type LumenCollider,
} from '@/lib/bronchoscopy-core/frame'
import {
  LinkedCtWorkspace,
  CorrelatedCtPlane,
  useLinkedCt,
  type CtSliceImage,
} from './LinkedCtWorkspace'
import {
  AdaptiveViewportQuality,
  AirwaySurface,
  BRONCH_FOV_DEG,
  BronchLabelOverlay,
  HoldButton,
  Polyline,
  ScopeBody,
  ScopeCamera,
  SteeringRing,
  scopeKeyAction,
  useElementSize,
} from './scope-primitives'
import {
  GamepadScopeSource,
  ScopeDeltaTracker,
  loadActiveScopeTrackerProfile,
  subscribeToScopeTrackerProfileChanges,
} from '@/lib/scope-input/core'

const MANIFEST_URL = resolveAdminAirwayAssetPath('/airway-anatomy/case-001/case_manifest.json')
const ORIENTATION_CALIBRATION_URL = resolveAdminAirwayAssetPath(
  '/airway-anatomy/case-001/scope_orientation_calibration.json',
)
const ORIENTATION_WRITE_ENDPOINT = '/api/airway-anatomy/scope-orientation'
const AIRWAY_CALIBRATION_QUERY_PARAM = 'airwayCalibration'
const SCOPE_ORIENTATION_PROFILE_QUERY_PARAM = 'scopeProfile'
const VIEWPORT_CLASS =
  'relative min-h-[360px] overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950'

const STEER_STEP_DEG = 3

interface LoadedCase {
  manifest: AirwayAnatomyCaseManifest
  graph: AirwayGraph
  labels: CenterlineLabels
  ctVolume: Int16Array
}

interface AirwayTarget {
  id: string
  label: string
  fullLabel: string
  nodeId: number
  edgePath: number[]
  anchorLps: Vec3
}

interface CurrentLocation {
  abbr: string
  name: string
}

export function AirwayAnatomyModule() {
  const [loadedCase, setLoadedCase] = useState<LoadedCase | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scopeState, setScopeState] = useState<ScopeState | null>(null)
  const [scopeOrientationProfile, setScopeOrientationProfile] = useState<ScopeOrientationProfileId>(
    DEFAULT_SCOPE_ORIENTATION_PROFILE,
  )
  const [scopeOrientationCalibration, setScopeOrientationCalibration] =
    useState<ScopeOrientationCalibration>(() => createEmptyScopeOrientationCalibration())
  const [orientationSaveStatus, setOrientationSaveStatus] = useState('')
  const [ctAxis, setCtAxis] = useState<CtAxis>('axial')
  const [windowPresetId, setWindowPresetId] = useState('lung')
  const [showAnatomyPins, setShowAnatomyPins] = useState(false)
  const [showBranchLabels, setShowBranchLabels] = useState(true)
  const [ctPlaneOpacity, setCtPlaneOpacity] = useState(0.28)
  const [showXr, setShowXr] = useState(false)
  const [mode, setMode] = useState<'explore' | 'challenge'>('explore')
  const [calibrationMode, setCalibrationMode] = useState(false)
  const [collider, setCollider] = useState<LumenCollider | null>(null)
  const [geometryError, setGeometryError] = useState<string | null>(null)
  const [enlarged, setEnlarged] = useState(false)
  const [trackerEnabled, setTrackerEnabled] = useState(false)
  const [trackerConnected, setTrackerConnected] = useState(false)
  const driveQueue = useRef(0)
  const renderedState = useRef(scopeState)
  renderedState.current = scopeState
  const frames = useMemo(
    () =>
      loadedCase
        ? buildTransportFrames(
            loadedCase.graph,
            scopeOrientationProfile === 'flexible' ? loadedCase.manifest.orientationLandmarks : [],
          )
        : null,
    [loadedCase, scopeOrientationProfile],
  )
  useEffect(() => {
    if (!loadedCase) return
    const { manifest } = loadedCase
    const url =
      manifest.assets.reviewedLumenGlb ??
      manifest.assets.reviewedLumenGlb ??
      manifest.assets.airwayStl
    if (!url) return
    let cancelled = false
    loadAirwayStlGeometry(resolveAdminAirwayAssetPath(url))
      .then((geometry) => {
        if (cancelled) return
        if (
          manifest.geometryValidation?.closed &&
          manifest.geometryValidation.coordinateSystem === 'LPS'
        ) {
          setCollider(createLumenCollider(geometry))
        }
      })
      .catch(() => {
        if (!cancelled)
          setGeometryError('The reviewed airway surface could not load. Reload to retry.')
      })
    return () => {
      cancelled = true
    }
  }, [loadedCase])

  useEffect(() => {
    setCalibrationMode(isAirwayOrientationCalibrationMode())
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const manifestResponse = await fetch(MANIFEST_URL)
        if (!manifestResponse.ok) {
          throw new Error(`Unable to load airway anatomy manifest (${manifestResponse.status}).`)
        }
        const manifest = (await manifestResponse.json()) as AirwayAnatomyCaseManifest
        const [graphResponse, labelsResponse, ctResponse] = await Promise.all([
          fetch(resolveAdminAirwayAssetPath(manifest.assets.airwayGraphJson)),
          fetch(resolveAdminAirwayAssetPath(manifest.assets.centerlineLabelsJson)),
          fetch(resolveAdminAirwayAssetPath(manifest.assets.ctPreviewRaw)),
        ])

        if (!graphResponse.ok)
          throw new Error(`Unable to load airway graph (${graphResponse.status}).`)
        if (!labelsResponse.ok)
          throw new Error(`Unable to load airway labels (${labelsResponse.status}).`)
        if (!ctResponse.ok) throw new Error(`Unable to load CT preview (${ctResponse.status}).`)

        const [graph, labels, ctBuffer, orientationCalibration] = await Promise.all([
          graphResponse.json() as Promise<AirwayGraph>,
          labelsResponse.json() as Promise<CenterlineLabels>,
          ctResponse.arrayBuffer(),
          fetchScopeOrientationCalibration(manifest.id),
        ])

        if (cancelled) return

        const requestedProfile = parseScopeOrientationProfileId(
          new URLSearchParams(window.location.search).get(SCOPE_ORIENTATION_PROFILE_QUERY_PARAM),
        )
        setLoadedCase({
          manifest,
          graph,
          labels,
          ctVolume: new Int16Array(ctBuffer),
        })
        setScopeOrientationCalibration(orientationCalibration)
        setScopeOrientationProfile(requestedProfile ?? orientationCalibration.defaultProfile)
        setScopeState(
          createInitialScopeState(
            graph,
            manifest.interaction.defaultEdgeId,
            manifest.interaction.initialDistanceMm,
          ),
        )
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Unable to load airway anatomy module.',
          )
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const graphIndex = useMemo(
    () => (loadedCase ? createGraphIndex(loadedCase.graph) : null),
    [loadedCase],
  )

  const rawSnapshot = useMemo(() => {
    if (!loadedCase || !scopeState) return null
    return buildScopePoseSnapshot({
      state: scopeState,
      graph: loadedCase.graph,
      labels: loadedCase.labels,
      lookAheadMm: loadedCase.manifest.interaction.lookAheadMm,
    })
  }, [loadedCase, scopeState])

  const snapshot = useMemo(() => {
    if (!rawSnapshot) return null
    if (!frames) return rawSnapshot
    const transported = poseWithTransport(rawSnapshot, frames)
    if (rawSnapshot.opticalFrame) return transported
    return applyScopeOrientationToPose(
      transported,
      scopeOrientationCalibration,
      scopeOrientationProfile,
    )
  }, [rawSnapshot, frames, scopeOrientationCalibration, scopeOrientationProfile])

  const currentWindow = useMemo(() => {
    const presets = loadedCase?.manifest.ct.windowPresets ?? []
    return presets.find((preset) => preset.id === windowPresetId) ?? presets[0] ?? null
  }, [loadedCase?.manifest.ct.windowPresets, windowPresetId])

  const airwayTargets = useMemo(() => {
    if (!loadedCase) return []
    return buildAirwayTargets(loadedCase.graph, loadedCase.labels)
  }, [loadedCase])

  const currentLocation = useMemo<CurrentLocation>(() => {
    if (!loadedCase || !snapshot) return { abbr: '--', name: 'Loading' }
    const info = loadedCase.labels.edgeLabels[String(snapshot.edgeId)]
    if (!info) return { abbr: `Edge ${snapshot.edgeId}`, name: 'Unlabeled branch' }
    return {
      abbr: info.abbreviatedLabel,
      name: shortAnatomicalLabel(info.fullLabel, info.abbreviatedLabel),
    }
  }, [loadedCase, snapshot])

  const upcomingOstia = useMemo<OstiumLabel[]>(() => {
    if (!loadedCase || !graphIndex || !snapshot) return []
    return buildUpcomingOstia(
      graphIndex,
      loadedCase.labels,
      snapshot,
      loadedCase.manifest.ostialLandmarks,
    )
  }, [graphIndex, loadedCase, snapshot])

  const stepMm = loadedCase?.manifest.interaction.stepMm ?? 3
  const lookAheadMm = loadedCase?.manifest.interaction.lookAheadMm ?? 12

  const frameForState = useCallback(
    (state: ScopeState) => {
      if (!loadedCase || !frames) return null
      const pose = poseWithTransport(
        buildScopePoseSnapshot({
          state,
          graph: loadedCase.graph,
          labels: loadedCase.labels,
          lookAheadMm,
        }),
        frames,
      )
      return scopeOpticalFrame(
        state.freeFrame
          ? pose
          : applyScopeOrientationToPose(pose, scopeOrientationCalibration, scopeOrientationProfile),
      )
    },
    [loadedCase, frames, lookAheadMm, scopeOrientationCalibration, scopeOrientationProfile],
  )
  const advance = useCallback(
    (delta: number) => {
      if (!loadedCase || !frames) return
      setScopeState((state) => {
        if (!state) return state
        const frame = frameForState(state)
        return frame ? driveScope(state, delta, loadedCase.graph, frames, frame, collider) : state
      })
    },
    [loadedCase, frames, frameForState, collider],
  )
  // Movement is integrated before publishing the pose. No viewport has its own chase camera.
  useEffect(() => {
    let handle = 0,
      previous = 0
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000 || 0, 0.05)
      previous = now
      const amount = Math.sign(driveQueue.current) * Math.min(Math.abs(driveQueue.current), dt * 24)
      if (amount) {
        driveQueue.current -= amount
        advance(amount)
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [advance])
  const handleMove = useCallback((delta: number) => {
    driveQueue.current = clamp(driveQueue.current + delta, -15, 15)
  }, [])
  const applySteer = useCallback(
    (screenXDeg: number, screenYUpDeg: number) => {
      setScopeState((state) => {
        if (!state || !frames) return state
        const frame = frameForState(state)
        if (!frame) return state
        const next = steerFrame(frame, screenXDeg, screenYUpDeg)
        if (state.freeFrame) return { ...state, freeFrame: next, movementMessage: undefined }
        const base = frames.at(state.edgeId, state.distanceMm)
        return updateLookOffset(state, {
          yawDeg:
            (Math.atan2(-scalar(next.forward, base.right), scalar(next.forward, base.forward)) *
              180) /
            Math.PI,
          pitchDeg: (Math.asin(clamp(scalar(next.forward, base.up), -1, 1)) * 180) / Math.PI,
        })
      })
    },
    [frames, frameForState],
  )

  const handleSteer = useCallback(
    (dxUnit: number, dyUpUnit: number) => {
      applySteer(dxUnit * STEER_STEP_DEG, dyUpUnit * STEER_STEP_DEG)
    },
    [applySteer],
  )

  const handleLookDrag = useCallback(
    (dxPx: number, dyPx: number) => {
      applySteer(dxPx * 0.14, -dyPx * 0.14)
    },
    [applySteer],
  )

  const handleRecenter = useCallback(() => {
    driveQueue.current = 0
    setScopeState((state) => {
      if (!state || !frames) return state
      const reset = updateLookOffset(state, { yawDeg: 0, pitchDeg: 0, rollDeg: 0 })
      if (state.freeFrame) {
        const base = frames.at(state.edgeId, state.distanceMm)
        return {
          ...reset,
          freeFrame: { ...base, position: state.freeFrame.position },
          movementMessage: undefined,
        }
      }
      return reset
    })
  }, [frames])
  const handleAlignBranch = useCallback(
    (edgeId: number) => {
      if (!loadedCase || !frames) return
      setScopeState((state) => {
        if (!state) return state
        const edge = loadedCase.graph.edges.find((e) => e.id === edgeId),
          frame = frameForState(state)
        if (!edge || !frame) return state
        const target = sampleEdgePose(edge, Math.min(edge.lengthMm * 0.6, 7)).point
        if (collider && !collider.visible(frame.position, target))
          return {
            ...state,
            movementMessage: 'That opening is occluded. Reposition the scope to see it.',
          }
        const direction = unit(minus(target, frame.position)),
          base = frames.at(state.edgeId, state.distanceMm)
        if (state.freeFrame)
          return { ...state, freeFrame: makeFrame(frame.position, direction, frame.up) }
        return updateLookOffset(state, {
          yawDeg:
            (Math.atan2(-scalar(direction, base.right), scalar(direction, base.forward)) * 180) /
            Math.PI,
          pitchDeg: (Math.asin(clamp(scalar(direction, base.up), -1, 1)) * 180) / Math.PI,
        })
      })
    },
    [loadedCase, frames, frameForState, collider],
  )

  const handleReset = useCallback(() => {
    driveQueue.current = 0
    if (!loadedCase) return
    setScopeState(
      createInitialScopeState(
        loadedCase.graph,
        loadedCase.manifest.interaction.defaultEdgeId,
        loadedCase.manifest.interaction.initialDistanceMm,
      ),
    )
  }, [loadedCase])

  const game = useAirwayGame({
    enabled: mode === 'challenge',
    graph: loadedCase?.graph ?? null,
    labels: loadedCase?.labels ?? null,
    snapshot,
    onResetScope: handleReset,
  })

  // In challenge mode the named ostia labels double as an optional hint; the
  // free-drive toggle governs them everywhere else.
  const effectiveShowBranchLabels = mode === 'challenge' ? game.view.hintsOn : showBranchLabels

  const handleRollChange = (rollDeg: number) => {
    setScopeState((state) =>
      state
        ? {
            ...updateLookOffset(state, { rollDeg }),
            freeFrame: state.freeFrame
              ? rollFrame(state.freeFrame, rollDeg - state.rollDeg)
              : undefined,
          }
        : state,
    )
  }

  const handleScopeOrientationProfileChange = useCallback(
    (profileId: ScopeOrientationProfileId) => {
      setScopeOrientationProfile(profileId)
      updateScopeOrientationProfileUrl(profileId)
    },
    [],
  )

  const saveCurrentFlexibleOrientation = useCallback(async () => {
    if (!snapshot) return
    const rollDeg = normalizeRollDeg(snapshot.rollDeg)
    const nextCalibration = updateScopeOrientationAdjustment(
      scopeOrientationCalibration,
      'flexible',
      snapshot.edgeId,
      { rollDeg },
    )
    setScopeOrientationCalibration(nextCalibration)
    setScopeOrientationProfile('flexible')
    setScopeState((state) => (state ? updateLookOffset(state, { rollDeg: 0 }) : state))
    setOrientationSaveStatus(`Saving Edge ${snapshot.edgeId} flexible roll...`)

    try {
      await saveScopeOrientationAdjustment(snapshot.edgeId, 'flexible', { rollDeg })
      setOrientationSaveStatus(`Saved Edge ${snapshot.edgeId} flexible roll (${rollDeg} deg).`)
    } catch (error) {
      setOrientationSaveStatus(
        `Local only: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }, [scopeOrientationCalibration, snapshot])

  const resetCurrentFlexibleOrientation = useCallback(async () => {
    if (!snapshot) return
    const nextCalibration = updateScopeOrientationAdjustment(
      scopeOrientationCalibration,
      'flexible',
      snapshot.edgeId,
      null,
    )
    setScopeOrientationCalibration(nextCalibration)
    setScopeState((state) => (state ? updateLookOffset(state, { rollDeg: 0 }) : state))
    setOrientationSaveStatus(`Removing Edge ${snapshot.edgeId} flexible roll...`)

    try {
      await saveScopeOrientationAdjustment(snapshot.edgeId, 'flexible', null)
      setOrientationSaveStatus(`Removed Edge ${snapshot.edgeId} flexible roll default.`)
    } catch (error) {
      setOrientationSaveStatus(
        `Local only: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }, [scopeOrientationCalibration, snapshot])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('input, select, textarea')) return
    if (!loadedCase) return
    const moveStep = (event.shiftKey ? 5 : 1) * stepMm
    const action = scopeKeyAction(event.key)
    if (!action) return
    switch (action.kind) {
      case 'steer':
        applySteer(action.dxUnit * STEER_STEP_DEG, action.dyUpUnit * STEER_STEP_DEG)
        break
      case 'move':
        handleMove(action.direction * moveStep)
        break
      case 'roll':
        handleRollChange((scopeState?.rollDeg ?? 0) + action.deltaDeg)
        break
      case 'recenter':
        handleRecenter()
        break
    }
    event.preventDefault()
  }

  const opticalFrame = useMemo(() => (snapshot ? scopeOpticalFrame(snapshot) : null), [snapshot])
  const linkedCt = useLinkedCt(
    loadedCase?.manifest.ct,
    loadedCase?.ctVolume,
    opticalFrame,
    currentWindow?.low ?? -1000,
    currentWindow?.high ?? -300,
  )
  const setLinkedCtAxis = linkedCt.setAxis
  useEffect(() => {
    setLinkedCtAxis(ctAxis)
  }, [ctAxis, setLinkedCtAxis])
  const hardwareHandlers = useRef({ advance, applySteer, handleRollChange, handleRecenter })
  hardwareHandlers.current = { advance, applySteer, handleRollChange, handleRecenter }
  useEffect(() => {
    if (!trackerEnabled) return
    let profile = loadActiveScopeTrackerProfile(),
      lastFlex: number | null = null,
      handle = 0
    const source = new GamepadScopeSource({ profile }),
      deltas = new ScopeDeltaTracker()
    const unsubscribe = subscribeToScopeTrackerProfileChanges(() => {
      profile = loadActiveScopeTrackerProfile()
      source.setProfile(profile)
      lastFlex = null
    })
    let connected = false
    const tick = () => {
      const input = source.sample()
      if (input && !input.status.fault) {
        const d = deltas.update(input, profile),
          h = hardwareHandlers.current
        if (d.resynced) lastFlex = input.flexion
        if (lastFlex != null) h.applySteer(0, (input.flexion - lastFlex) * 100)
        lastFlex = input.flexion
        if (input.rollValid && d.dRollRad)
          h.handleRollChange((renderedState.current?.rollDeg ?? 0) + (d.dRollRad * 180) / Math.PI)
        if (d.dDepthMm) h.advance(d.dDepthMm)
        if (input.pressed.calibrate) h.handleRecenter()
      } else {
        lastFlex = null
        deltas.reset()
      }
      if (source.connected !== connected) {
        connected = source.connected
        setTrackerConnected(connected)
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(handle)
      unsubscribe()
      setTrackerConnected(false)
    }
  }, [trackerEnabled])

  if (loadError) {
    return (
      <HandoffContent>
        {
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
            {loadError}
          </div>
        }
      </HandoffContent>
    )
  }

  if (!loadedCase || !snapshot || !currentWindow) {
    return (
      <HandoffContent>
        {
          <div className="flex min-h-[680px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
            Loading synchronized airway case...
          </div>
        }
      </HandoffContent>
    )
  }

  const flexibleOrientationAdjustment = scopeOrientationAdjustmentFor(
    scopeOrientationCalibration,
    'flexible',
    snapshot.edgeId,
  )
  const flexibleRollDeg = flexibleOrientationAdjustment.rollDeg ?? 0
  const liveRollDeg = scopeState?.rollDeg ?? 0
  const activeProfileLabel =
    scopeOrientationCalibration.profiles[scopeOrientationProfile]?.label ?? scopeOrientationProfile

  return (
    <HandoffContent>
      {
        <section
          className="relative overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-white shadow-sm outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <div className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info" className="rounded-full px-3 py-1 text-xs font-semibold">
                    Simulation
                  </Badge>
                  <span className="text-xs font-medium text-slate-400">
                    {loadedCase.manifest.ct.sourceNrrd}
                  </span>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                  Synchronized Airway Anatomy
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex items-center rounded-lg border border-slate-700 bg-slate-900/80 p-0.5"
                  aria-label="Scope orientation profile"
                >
                  {SCOPE_ORIENTATION_PROFILE_IDS.map((profileId) => (
                    <button
                      key={profileId}
                      type="button"
                      onClick={() => handleScopeOrientationProfileChange(profileId)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        scopeOrientationProfile === profileId
                          ? profileId === 'flexible'
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      aria-pressed={scopeOrientationProfile === profileId}
                    >
                      {scopeOrientationCalibration.profiles[profileId].label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900/80 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('explore')
                      game.actions.stop()
                    }}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      mode === 'explore'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    aria-pressed={mode === 'explore'}
                  >
                    <Compass className="h-4 w-4" />
                    Explore
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('challenge')}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      mode === 'challenge'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    aria-pressed={mode === 'challenge'}
                  >
                    <Gamepad2 className="h-4 w-4" />
                    Challenge
                  </button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAnatomyPins((value) => !value)}
                >
                  {showAnatomyPins ? (
                    <EyeOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  {showAnatomyPins ? 'Hide 3D pins' : 'Show 3D pins'}
                </Button>
                <Button
                  type="button"
                  variant={showXr ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setShowXr((value) => !value)}
                >
                  <Headset className="mr-2 h-4 w-4" />
                  {showXr ? 'Hide VR view' : 'VR view'}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
            <p className="mt-3 max-w-4xl text-sm text-slate-300">
              {mode === 'challenge'
                ? 'Challenge mode: we name a target segment and start the clock — steer to its ostium and drive in. The 3D beacon and proximity meter guide you; clean, fast runs stack a combo bonus. '
                : 'Drive the scope freely: steer toward an ostium and advance — the scope follows the branch you are pointing at, and the 3D model and CT track the tip in real time. '}
              {loadedCase.manifest.safetyLabel} For education and anatomy correlation only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3 text-xs">
            <div className="flex rounded-md bg-slate-800 p-1" aria-label="Navigation mode">
              <button
                className={`rounded px-3 py-2 ${!scopeState?.freeFrame ? 'bg-cyan-300 text-slate-950' : 'text-slate-300'}`}
                onClick={() => {
                  driveQueue.current = 0
                  setScopeState((s) =>
                    s
                      ? {
                          ...s,
                          freeFrame: undefined,
                          freePath: undefined,
                          yawDeg: 0,
                          pitchDeg: 0,
                          rollDeg: 0,
                        }
                      : s,
                  )
                }}
              >
                Guided anatomy
              </button>
              <button
                disabled={!collider}
                title={!collider ? 'Preparing validated collision geometry' : undefined}
                className={`rounded px-3 py-2 disabled:opacity-40 ${scopeState?.freeFrame ? 'bg-cyan-300 text-slate-950' : 'text-slate-300'}`}
                onClick={() => {
                  driveQueue.current = 0
                  setScopeState((s) =>
                    s && opticalFrame
                      ? collider!.clearance(opticalFrame.position) < FLEXIBLE_TIP_RADIUS_MM
                        ? {
                            ...s,
                            movementMessage:
                              'This airway is too narrow for the 3.8 mm scope. Withdraw before entering realistic mode.',
                          }
                        : enterFreeDrive(s, opticalFrame, loadedCase.graph)
                      : s,
                  )
                }}
              >
                Realistic navigation
              </button>
            </div>
            <button className="text-cyan-200" onClick={() => setEnlarged(!enlarged)}>
              {enlarged ? 'Balanced layout' : 'Enlarge bronchoscopy'}
            </button>
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={trackerEnabled}
                onChange={(e) => setTrackerEnabled(e.target.checked)}
              />
              Scope Tracker {trackerEnabled ? (trackerConnected ? 'connected' : 'waiting') : ''}
            </label>
            {!scopeState?.freeFrame &&
              mode === 'explore' &&
              loadedCase.manifest.orientationLandmarks?.map((reference) => (
                <button
                  key={reference.id}
                  type="button"
                  className="rounded border border-slate-700 px-2 py-1 text-cyan-200"
                  title={reference.expectation}
                  onClick={() => {
                    driveQueue.current = 0
                    setScopeOrientationProfile('flexible')
                    setScopeState(
                      createInitialScopeState(
                        loadedCase.graph,
                        reference.edgeId,
                        reference.distanceMm,
                      ),
                    )
                  }}
                >
                  {reference.id.toUpperCase()} reference
                </button>
              ))}
            <span className="text-slate-400">
              {scopeState?.freeFrame
                ? 'Steer · W/S insert and withdraw · Q/E rotate'
                : 'Aim into an opening, then advance · R recenters'}
            </span>
            {(scopeState?.movementMessage || geometryError) && (
              <p role="status" className="w-full text-amber-200">
                {geometryError ?? scopeState?.movementMessage}
              </p>
            )}
          </div>
          <div
            className={`grid gap-3 p-3 ${enlarged ? 'xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,.65fr)]' : 'xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,.88fr)]'}`}
          >
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
              <VirtualBronchoscopyViewport
                manifest={loadedCase.manifest}
                pose={snapshot}
                ostia={upcomingOstia}
                showBranchLabels={effectiveShowBranchLabels}
                location={currentLocation}
                onLookDrag={handleLookDrag}
                onAlignBranch={handleAlignBranch}
                game={mode === 'challenge' ? game : null}
                fovDeg={BRONCH_FOV_DEG}
                collider={collider}
              />
              <AirwayTreeViewport
                manifest={loadedCase.manifest}
                graph={loadedCase.graph}
                targets={airwayTargets}
                pose={snapshot}
                showAnatomyPins={showAnatomyPins}
                ctImage={linkedCt.result?.images.find((i) => i.plane.axis === linkedCt.axis)}
                ctVolume={loadedCase.ctVolume}
                windowLow={currentWindow.low}
                windowHigh={currentWindow.high}
                ctPlaneOpacity={ctPlaneOpacity}
                gameTarget={mode === 'challenge' ? game.view.currentTarget : null}
                hitPulse={game.hitPulse}
                hitAnchor={game.hitAnchor}
              />
            </div>

            <div className="grid gap-3">
              <ControlPanel
                pose={snapshot}
                location={currentLocation}
                stepMm={stepMm}
                onSteer={handleSteer}
                onRecenter={handleRecenter}
                onMove={handleMove}
                ctAxis={ctAxis}
                onCtAxisChange={setCtAxis}
                windowPresetId={windowPresetId}
                windowPresets={loadedCase.manifest.ct.windowPresets}
                onWindowPresetChange={setWindowPresetId}
                ctPlaneOpacity={ctPlaneOpacity}
                onCtPlaneOpacityChange={setCtPlaneOpacity}
                onRollChange={handleRollChange}
                liveRollDeg={liveRollDeg}
                totalRollDeg={snapshot.rollDeg}
                showBranchLabels={showBranchLabels}
                onShowBranchLabelsChange={setShowBranchLabels}
                calibrationMode={calibrationMode}
                orientationProfile={scopeOrientationProfile}
                orientationProfileLabel={activeProfileLabel}
                flexibleRollDeg={flexibleRollDeg}
                orientationSaveStatus={orientationSaveStatus}
                onSaveFlexibleOrientation={saveCurrentFlexibleOrientation}
                onResetFlexibleOrientation={resetCurrentFlexibleOrientation}
              />
              <LinkedCtWorkspace
                controller={linkedCt}
                frame={opticalFrame!}
                low={currentWindow.low}
                high={currentWindow.high}
              />
            </div>
          </div>

          {showXr ? (
            <div className="border-t border-slate-800 p-3">
              <AirwayXRSceneDynamic
                manifest={loadedCase.manifest}
                graph={loadedCase.graph}
                pose={snapshot}
                ctVolume={loadedCase.ctVolume}
                windowLow={currentWindow.low}
                windowHigh={currentWindow.high}
                ctPlaneOpacity={ctPlaneOpacity}
                stepMm={stepMm}
                onMove={handleMove}
                onSteer={handleSteer}
                onRecenter={handleRecenter}
                game={mode === 'challenge' ? game : null}
              />
            </div>
          ) : null}

          {/* The desktop start/results card. While the VR view is open the in-headset HUD owns
              the start/results flow (and keeps the Enter VR button reachable), so suppress it. */}
          {mode === 'challenge' && !showXr ? (
            <GameIntroOverlay view={game.view} actions={game.actions} />
          ) : null}
        </section>
      }
    </HandoffContent>
  )
}

function ControlPanel({
  pose,
  location,
  stepMm,
  onSteer,
  onRecenter,
  onMove,
  ctAxis,
  onCtAxisChange,
  windowPresetId,
  windowPresets,
  onWindowPresetChange,
  ctPlaneOpacity,
  onCtPlaneOpacityChange,
  onRollChange,
  liveRollDeg,
  totalRollDeg,
  showBranchLabels,
  onShowBranchLabelsChange,
  calibrationMode,
  orientationProfile,
  orientationProfileLabel,
  flexibleRollDeg,
  orientationSaveStatus,
  onSaveFlexibleOrientation,
  onResetFlexibleOrientation,
}: {
  pose: ScopePoseSnapshot
  location: CurrentLocation
  stepMm: number
  onSteer: (dxUnit: number, dyUpUnit: number) => void
  onRecenter: () => void
  onMove: (deltaMm: number) => void
  ctAxis: CtAxis
  onCtAxisChange: (axis: CtAxis) => void
  windowPresetId: string
  windowPresets: AirwayAnatomyCaseManifest['ct']['windowPresets']
  onWindowPresetChange: (preset: string) => void
  ctPlaneOpacity: number
  onCtPlaneOpacityChange: (opacity: number) => void
  onRollChange: (rollDeg: number) => void
  liveRollDeg: number
  totalRollDeg: number
  showBranchLabels: boolean
  onShowBranchLabelsChange: (value: boolean) => void
  calibrationMode: boolean
  orientationProfile: ScopeOrientationProfileId
  orientationProfileLabel: string
  flexibleRollDeg: number
  orientationSaveStatus: string
  onSaveFlexibleOrientation: () => void
  onResetFlexibleOrientation: () => void
}) {
  const branchProgress =
    pose.edgeLengthMm > 0 ? clamp(pose.distanceMm / pose.edgeLengthMm, 0, 1) : 0

  return (
    <HandoffContent>
      {
        <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Current position
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-cyan-200">{location.abbr}</span>
                <span className="truncate text-sm text-slate-300">{location.name}</span>
              </div>
            </div>
            <div className="shrink-0 rounded bg-slate-950 px-2 py-1 text-xs text-slate-300">
              yaw {Math.round(pose.yawDeg)}° · pitch {Math.round(pose.pitchDeg)}° · roll{' '}
              {Math.round(totalRollDeg)}°
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-400/80 transition-[width]"
              style={{ width: `${branchProgress * 100}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {Math.round(pose.distanceMm)} / {Math.round(pose.edgeLengthMm)} mm into branch
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Steer the tip
            </div>
            <SteeringRing onSteer={onSteer} onRecenter={onRecenter} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <HoldButton
                ariaLabel="Withdraw scope"
                onTrigger={() => onMove(-stepMm)}
                intervalMs={110}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-700 active:bg-slate-600"
              >
                <ArrowDown className="h-4 w-4" />
                Withdraw
              </HoldButton>
              <HoldButton
                ariaLabel="Advance scope"
                onTrigger={() => onMove(stepMm)}
                intervalMs={110}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-400/50 bg-cyan-500/15 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/25 active:bg-cyan-400/35"
              >
                <ArrowUp className="h-4 w-4" />
                Advance
              </HoldButton>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Steer toward an ostium, then advance — the scope enters the branch you point at. Hold
              buttons to repeat. Keys: arrows steer, W/S drive, R recenter.
            </p>
          </div>

          <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                CT plane
              </span>
              <select
                value={ctAxis}
                onChange={(event) => onCtAxisChange(event.target.value as CtAxis)}
                className="min-h-10 rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300"
              >
                <option value="axial">Axial</option>
                <option value="coronal">Coronal</option>
                <option value="sagittal">Sagittal</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                CT window
              </span>
              <select
                value={windowPresetId}
                onChange={(event) => onWindowPresetChange(event.target.value)}
                className="min-h-10 rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300"
              >
                {windowPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>3D CT overlay</span>
                <span>{Math.round(ctPlaneOpacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={0.65}
                step={0.01}
                value={ctPlaneOpacity}
                onChange={(event) => onCtPlaneOpacityChange(Number(event.target.value))}
                className="w-full accent-cyan-300"
              />
            </label>
            <label className="grid gap-2">
              <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                <span>Scope roll trim</span>
                <span>{Math.round(liveRollDeg)} deg</span>
              </span>
              <input
                type="range"
                min={-90}
                max={90}
                step={1}
                value={liveRollDeg}
                onChange={(event) => onRollChange(Number(event.target.value))}
                className="w-full accent-cyan-300"
              />
            </label>
            {calibrationMode ? (
              <div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-100">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Orientation calibration
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {orientationProfile === 'flexible'
                        ? `Edge ${pose.edgeId}: current flexible default ${Math.round(
                            flexibleRollDeg,
                          )} deg.`
                        : `${orientationProfileLabel} preserves the baseline view; switch to Flexible before saving defaults.`}
                    </p>
                  </div>
                  <span className="rounded bg-slate-950 px-2 py-1 text-xs text-slate-300">
                    Edge {pose.edgeId}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onSaveFlexibleOrientation}
                    disabled={orientationProfile !== 'flexible'}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save view
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onResetFlexibleOrientation}
                    disabled={orientationProfile !== 'flexible'}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset edge
                  </Button>
                </div>
                {orientationSaveStatus ? (
                  <p className="mt-2 text-xs text-cyan-100">{orientationSaveStatus}</p>
                ) : null}
              </div>
            ) : null}
            <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>Branch labels in view</span>
              <input
                type="checkbox"
                checked={showBranchLabels}
                onChange={(event) => onShowBranchLabelsChange(event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
            </label>
          </div>
        </div>
      }
    </HandoffContent>
  )
}

async function fetchScopeOrientationCalibration(caseId: string) {
  try {
    const response = await fetch(ORIENTATION_CALIBRATION_URL, { cache: 'no-store' })
    if (!response.ok) {
      return createEmptyScopeOrientationCalibration(caseId)
    }
    return normalizeScopeOrientationCalibration(await response.json(), caseId)
  } catch {
    return createEmptyScopeOrientationCalibration(caseId)
  }
}

async function saveScopeOrientationAdjustment(
  edgeId: number,
  profileId: ScopeOrientationProfileId,
  adjustment: { rollDeg: number } | null,
) {
  const response = await fetch(ORIENTATION_WRITE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profileId,
      edgeId,
      adjustment,
    }),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `orientation save failed with ${response.status}`)
  }
}

function isAirwayOrientationCalibrationMode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get(AIRWAY_CALIBRATION_QUERY_PARAM) === '1'
}

function updateScopeOrientationProfileUrl(profileId: ScopeOrientationProfileId) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (profileId === DEFAULT_SCOPE_ORIENTATION_PROFILE) {
    url.searchParams.delete(SCOPE_ORIENTATION_PROFILE_QUERY_PARAM)
  } else {
    url.searchParams.set(SCOPE_ORIENTATION_PROFILE_QUERY_PARAM, profileId)
  }
  window.history.replaceState({}, '', url)
}

function VirtualBronchoscopyViewport({
  manifest,
  pose,
  ostia,
  showBranchLabels,
  location,
  onLookDrag,
  onAlignBranch,
  game,
  fovDeg,
  collider,
}: {
  collider: LumenCollider | null
  manifest: AirwayAnatomyCaseManifest
  pose: ScopePoseSnapshot
  ostia: OstiumLabel[]
  showBranchLabels: boolean
  location: CurrentLocation
  onLookDrag: (dxPx: number, dyPx: number) => void
  onAlignBranch: (edgeId: number) => void
  game: AirwayGameController | null
  fovDeg: number
}) {
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>()
  const aspect = size.height > 0 ? size.width / size.height : 16 / 9

  return (
    <HandoffContent>
      {
        <div
          ref={containerRef}
          className="relative aspect-[4/3] touch-none select-none overflow-hidden rounded-lg border border-slate-700 bg-black"
          onPointerDown={(event) => {
            pointerRef.current = { x: event.clientX, y: event.clientY }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const previous = pointerRef.current
            if (!previous) return
            const dx = event.clientX - previous.x
            const dy = event.clientY - previous.y
            pointerRef.current = { x: event.clientX, y: event.clientY }
            onLookDrag(dx, dy)
          }}
          onPointerUp={() => {
            pointerRef.current = null
          }}
          onPointerCancel={() => {
            pointerRef.current = null
          }}
        >
          <div className="absolute inset-0">
            <Canvas
              frameloop={game ? 'always' : 'demand'}
              dpr={[1, 1.75]}
              camera={{
                fov: BRONCH_FOV_DEG,
                near: 0.06,
                far: 900,
                position: pose.tipLps,
              }}
              gl={{ antialias: true, alpha: false }}
            >
              <color attach="background" args={[0x070201]} />
              <AdaptiveViewportQuality />
              <ambientLight intensity={0.55} color={0xffc4a6} />
              <Suspense fallback={null}>
                <AirwaySurface
                  stlUrl={
                    (manifest.assets.reviewedLumenGlb ?? manifest.assets.airwayStl)
                      ? resolveAdminAirwayAssetPath(
                          (manifest.assets.reviewedLumenGlb ?? manifest.assets.airwayStl)!,
                        )
                      : null
                  }
                  transform={manifest.airwaySurfaceTransform ?? manifest.airwayTransform}
                  mode="bronch"
                />
                <ScopeCamera pose={pose} />
              </Suspense>
            </Canvas>
          </div>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, transparent 44%, rgba(0,0,0,0.16) 66%, rgba(10,2,2,0.6) 100%)',
            }}
          />
          {showBranchLabels && (
            <BronchLabelOverlay
              ostia={ostia}
              pose={pose}
              aspect={aspect}
              onAlignBranch={onAlignBranch}
              collider={collider}
            />
          )}
          {!game && (
            <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-950/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
              Virtual bronchoscopy
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-baseline gap-1.5 whitespace-nowrap rounded-full border border-cyan-300/25 bg-slate-950/85 px-3 py-1 text-xs">
            <span className="font-bold text-cyan-200">{location.abbr}</span>
            <span className="text-slate-300">{location.name}</span>
            <span className="text-slate-500">· {Math.round(pose.distanceMm)} mm</span>
          </div>
          <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-slate-950/75 px-2 py-1 text-[11px] text-slate-400">
            drag to look
          </div>
          {game ? (
            <GameHudOverlay
              view={game.view}
              actions={game.actions}
              pose={pose}
              aspect={aspect}
              fovDeg={fovDeg}
            />
          ) : null}
        </div>
      }
    </HandoffContent>
  )
}

function AirwayTreeViewport({
  manifest,
  graph,
  targets,
  pose,
  showAnatomyPins,
  ctPlaneOpacity,
  gameTarget,
  hitPulse,
  hitAnchor,
  ctImage,
}: {
  ctImage?: CtSliceImage
  manifest: AirwayAnatomyCaseManifest
  graph: AirwayGraph
  targets: AirwayTarget[]
  pose: ScopePoseSnapshot
  showAnatomyPins: boolean
  ctVolume: Int16Array
  windowLow: number
  windowHigh: number
  ctPlaneOpacity: number
  gameTarget: GameTarget | null
  hitPulse: number
  hitAnchor: Vec3 | null
}) {
  const bounds = useMemo(() => boundsForGraph(graph), [graph])
  const targetEdgeSet = useMemo(() => new Set(gameTarget?.edgeIds ?? []), [gameTarget])
  const targetColor = gameTarget ? LOBE_COLORS[gameTarget.lobe] : null
  const cameraPosition: Vec3 = [
    bounds.center[0] + bounds.radius * 0.95,
    bounds.center[1] - bounds.radius * 1.35,
    bounds.center[2] + bounds.radius * 0.55,
  ]

  return (
    <HandoffContent>
      {
        <div className={VIEWPORT_CLASS}>
          <Canvas
            frameloop={gameTarget ? 'always' : 'demand'}
            dpr={[1, 1.75]}
            camera={{
              fov: 34,
              near: 0.5,
              far: bounds.radius * 12,
              position: cameraPosition,
              up: [0, 0, 1],
            }}
            gl={{ antialias: true, alpha: false }}
          >
            <color attach="background" args={[0x040812]} />
            <AdaptiveViewportQuality />
            <ambientLight intensity={0.55} />
            <directionalLight position={[180, -260, 120]} intensity={1.15} />
            <directionalLight position={[-120, 180, -100]} intensity={0.35} color={0x9bb8ff} />
            <Suspense fallback={null}>
              <AirwaySurface
                stlUrl={
                  (manifest.assets.reviewedLumenGlb ?? manifest.assets.airwayStl)
                    ? resolveAdminAirwayAssetPath(
                        (manifest.assets.reviewedLumenGlb ?? manifest.assets.airwayStl)!,
                      )
                    : null
                }
                transform={manifest.airwaySurfaceTransform ?? manifest.airwayTransform}
                mode="tree"
              />
              <CorrelatedCtPlane image={ctImage} opacity={ctPlaneOpacity} />
              <group>
                {graph.edges.map((edge) => {
                  const isCurrent = edge.id === pose.edgeId
                  const isTarget = targetEdgeSet.has(edge.id)
                  return (
                    <Polyline
                      key={edge.id}
                      points={edge.pointsLps}
                      color={
                        isCurrent ? '#fbbf24' : isTarget && targetColor ? targetColor : '#38bdf8'
                      }
                      opacity={
                        isCurrent
                          ? 1
                          : isTarget
                            ? 0.85
                            : edge.startNodeId ===
                                graph.edges.find((e) => e.id === pose.edgeId)?.endNodeId
                              ? 0.55
                              : 0.08
                      }
                    />
                  )
                })}
                <ScopeBody graph={graph} pose={pose} />
                {gameTarget ? <TargetBeacon target={gameTarget} /> : null}
                {gameTarget && targetColor ? (
                  <SuccessBurst
                    triggerKey={hitPulse}
                    origin={hitAnchor ?? gameTarget.anchorLps}
                    colorHex={targetColor}
                  />
                ) : null}
              </group>
              {showAnatomyPins && <SceneLabels targets={targets} />}
            </Suspense>
            <OrbitControls target={bounds.center} enablePan enableRotate enableZoom />
          </Canvas>
          <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-950/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
            3D airway correlation
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-slate-950/80 px-2 py-1 text-[11px] text-slate-300">
            LPS · superior ↑ · gold: current branch
          </div>
        </div>
      }
    </HandoffContent>
  )
}

function SceneLabels({ targets }: { targets: AirwayTarget[] }) {
  return (
    <HandoffContent>
      {
        <>
          {targets.slice(0, 90).map((target) => (
            <group key={target.id} position={target.anchorLps}>
              <mesh>
                <sphereGeometry args={[1.6, 8, 8]} />
                <meshBasicMaterial color="#facc15" />
              </mesh>
              <Html center distanceFactor={38} zIndexRange={[10, 0]}>
                <div
                  className="rounded border border-amber-200/60 bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-100 shadow"
                  title={target.fullLabel}
                >
                  {target.label}
                </div>
              </Html>
            </group>
          ))}
        </>
      }
    </HandoffContent>
  )
}

function buildAirwayTargets(graph: AirwayGraph, labels: CenterlineLabels): AirwayTarget[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const byLabel = new Map<string, AirwayTarget>()

  for (const polyline of labels.polylines) {
    if (!polyline.abbreviatedLabel || !polyline.fullLabel || polyline.pointsLps.length < 2) {
      continue
    }
    const distalPoint = polyline.pointsLps[polyline.pointsLps.length - 1]
    const matchedEdge =
      polyline.matchedEdgeId == null ? null : (edgeById.get(polyline.matchedEdgeId) ?? null)
    const node =
      (matchedEdge ? nodeById.get(matchedEdge.endNodeId) : nearestGraphNode(graph, distalPoint)) ??
      nearestGraphNode(graph, distalPoint)
    const edgePath = edgePathToNode(node.id, nodeById)
    if (!edgePath.length) {
      continue
    }
    const key = `${polyline.abbreviatedLabel}|${polyline.fullLabel}`
    const current = byLabel.get(key)
    const next: AirwayTarget = {
      id: key,
      label: polyline.abbreviatedLabel,
      fullLabel: polyline.fullLabel,
      nodeId: node.id,
      edgePath,
      anchorLps: matchedEdge?.pointsLps[matchedEdge.pointsLps.length - 1] ?? distalPoint,
    }
    if (!current || node.rootDistanceMm > (nodeById.get(current.nodeId)?.rootDistanceMm ?? 0)) {
      byLabel.set(key, next)
    }
  }

  return [...byLabel.values()].sort((a, b) =>
    airwayLabelSortKey(a).localeCompare(airwayLabelSortKey(b)),
  )
}

function nearestGraphNode(graph: AirwayGraph, point: Vec3): AirwayGraphNode {
  let nearest = graph.nodes[0]
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const node of graph.nodes) {
    const nextDistance = Math.hypot(
      node.lps[0] - point[0],
      node.lps[1] - point[1],
      node.lps[2] - point[2],
    )
    if (nextDistance < nearestDistance) {
      nearest = node
      nearestDistance = nextDistance
    }
  }
  return nearest
}

function airwayLabelSortKey(target: AirwayTarget): string {
  const sideRank = target.label.startsWith('RB') ? '1' : target.label.startsWith('LB') ? '2' : '0'
  const number = target.label.match(/\d+/)?.[0]?.padStart(2, '0') ?? '00'
  return `${sideRank}-${number}-${target.label}-${target.fullLabel}`
}

function boundsForGraph(graph: AirwayGraph): { center: Vec3; radius: number } {
  const points = graph.nodes.map((node) => node.lps)
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  for (const point of points) {
    min[0] = Math.min(min[0], point[0])
    min[1] = Math.min(min[1], point[1])
    min[2] = Math.min(min[2], point[2])
    max[0] = Math.max(max[0], point[0])
    max[1] = Math.max(max[1], point[1])
    max[2] = Math.max(max[2], point[2])
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const radius = Math.max(160, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 0.62)
  return { center, radius }
}
