'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveQuality, opticalPixelRatio } from '../../lib/bronchoscopy-core/quality'
import { Html, OrbitControls } from '@react-three/drei'
import {
  ArrowDown,
  ArrowUp,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Gamepad2,
  Headset,
  RotateCcw,
  Save,
  SlidersHorizontal,
} from 'lucide-react'
import * as THREE from 'three'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveAdminAirwayAssetPath } from '@/lib/airway-anatomy/admin-assets'
import { add, clamp, scale, subtract } from '@/lib/airway-anatomy/geometry'
import {
  createBronchoscopyMaterial,
  loadAirwayStlGeometry,
} from '@/lib/airway-anatomy/airway-render'
import { AirwayXRSceneDynamic } from '@/components/airway-anatomy/AirwayXRSceneDynamic'
import {
  GameHudOverlay,
  GameIntroOverlay,
  SuccessBurst,
  TargetBeacon,
  useAirwayGame,
  type AirwayGameController,
} from '@/components/airway-anatomy/AirwayGameLayer'
import { LOBE_COLORS, type GameTarget } from '@/lib/airway-anatomy/airway-game'
import {
  buildScopePathLps,
  buildScopePoseSnapshot,
  createGraphIndex,
  createInitialScopeState,
  sampleEdgePose,
  updateLookOffset,
  type AirwayGraphIndex,
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
  verticalFov,
  projectOptical,
  type LumenCollider,
} from '@/lib/bronchoscopy-core/frame'
import {
  LinkedCtWorkspace,
  CorrelatedCtPlane,
  useLinkedCt,
  type CtSliceImage,
} from './LinkedCtWorkspace'
import {
  GamepadScopeSource,
  ScopeDeltaTracker,
  loadActiveScopeTrackerProfile,
  subscribeToScopeTrackerProfileChanges,
} from '@/lib/scope-input/core'
import {
  DEFAULT_PATHOLOGY,
  bleedingAmount,
  siteFor,
  type PathologySettings,
  type BleedingLevel,
} from '@/lib/airway-anatomy/pathology/model'
import { placePathology, sourceVisibility } from '@/lib/airway-anatomy/pathology/geometry'
import { usePathology, useBleedingClock, type PathologyScene } from './pathology/usePathology'
import { PathologyPanel } from './pathology/PathologyPanel'
import { PathologyMeshes, BloodVisibilityOverlay } from './pathology/PathologyScene'

const MANIFEST_URL = resolveAdminAirwayAssetPath('/airway-anatomy/case-001/case_manifest.json')
const ORIENTATION_CALIBRATION_URL = resolveAdminAirwayAssetPath(
  '/airway-anatomy/case-001/scope_orientation_calibration.json',
)
const ORIENTATION_WRITE_ENDPOINT = '/api/airway-anatomy/scope-orientation'
const AIRWAY_CALIBRATION_QUERY_PARAM = 'airwayCalibration'
const SCOPE_ORIENTATION_PROFILE_QUERY_PARAM = 'scopeProfile'
const VIEWPORT_CLASS =
  'relative min-h-[360px] overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950'

const BRONCH_FOV_DEG = 88
const STEER_STEP_DEG = 3
const OSTIUM_LABEL_RANGE_MM = 60

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

interface OstiumLabel {
  edgeId: number
  pointLps: Vec3
  abbr: string
  descriptor: string
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
  const [mode, setMode] = useState<'explore' | 'challenge' | 'abnormalities'>('explore')
  const [pathologySettings, setPathologySettings] = useState<PathologySettings>(DEFAULT_PATHOLOGY)
  const [comparingNormal, setComparingNormal] = useState(false)
  const [bleedingPaused, setBleedingPaused] = useState(false)
  const [bleedingRestart, setBleedingRestart] = useState(0)
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
    if (new URLSearchParams(window.location.search).get('airwayMode') === 'abnormalities')
      setMode('abnormalities')
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

  const pathology = usePathology(
    pathologySettings,
    mode === 'abnormalities' && !comparingNormal,
    loadedCase?.graph ?? null,
    collider,
  )
  const navigationCollider =
    mode === 'abnormalities' && !comparingNormal ? (pathology.collider ?? collider) : collider
  const bleedingClock = useBleedingClock(
    mode === 'abnormalities' &&
      !comparingNormal &&
      pathology.ready &&
      pathologySettings.bleeding !== 'off' &&
      !bleedingPaused,
    `${mode}:${pathologySettings.site}:${pathologySettings.morphology}:${pathologySettings.size}:${pathologySettings.wallAngleDeg}:${pathologySettings.bleeding}:${bleedingRestart}`,
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
        if (mode === 'abnormalities' && (comparingNormal || !pathology.ready))
          return {
            ...state,
            movementMessage: comparingNormal
              ? 'Restore abnormalities to resume insertion.'
              : 'Wait for the abnormality model before advancing.',
          }
        const frame = frameForState(state)
        const moved = frame
          ? driveScope(state, delta, loadedCase.graph, frames, frame, navigationCollider)
          : state
        if (mode === 'abnormalities' && moved.movementMessage?.startsWith('Wall contact'))
          return {
            ...moved,
            movementMessage:
              'Scope contact with airway wall or lesion — withdraw or redirect the tip.',
          }
        return moved
      })
    },
    [loadedCase, frames, frameForState, navigationCollider, mode, comparingNormal, pathology.ready],
  )

  const approachPathology = useCallback(
    (settings: PathologySettings) => {
      driveQueue.current = 0
      if (!loadedCase || !pathology.frames || !collider) return
      const site = siteFor(settings.site)
      const initial = createInitialScopeState(
        loadedCase.graph,
        site.edgeId,
        Math.max(0, site.distanceMm - 24),
      )
      const frame = frameForState(initial)
      if (!frame) return
      try {
        const placement = placePathology(settings, pathology.frames, collider)
        const target = add(
          placement.wallPoint,
          scale(placement.inward, Math.max(0.15, placement.projectionMm * 0.55)),
        )
        const aimed = makeFrame(frame.position, unit(minus(target, frame.position)), frame.up)
        setScopeState(enterFreeDrive(initial, aimed, loadedCase.graph))
      } catch {
        setScopeState(initial)
      }
    },
    [loadedCase, pathology.frames, collider, frameForState],
  )

  const changePathology = useCallback(
    (settings: PathologySettings) => {
      setComparingNormal(false)
      setBleedingPaused(false)
      setPathologySettings(settings)
      if (
        settings.morphology !== pathologySettings.morphology ||
        settings.site !== pathologySettings.site ||
        settings.size !== pathologySettings.size ||
        settings.wallAngleDeg !== pathologySettings.wallAngleDeg
      )
        approachPathology(settings)
    },
    [pathologySettings, approachPathology],
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
        if (navigationCollider && !navigationCollider.visible(frame.position, target))
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
    [loadedCase, frames, frameForState, navigationCollider],
  )

  const handleReset = useCallback(() => {
    driveQueue.current = 0
    setComparingNormal(false)
    setBleedingRestart((v) => v + 1)
    if (!loadedCase) return
    if (mode === 'abnormalities') {
      approachPathology(pathologySettings)
      return
    }
    setScopeState(
      createInitialScopeState(
        loadedCase.graph,
        loadedCase.manifest.interaction.defaultEdgeId,
        loadedCase.manifest.interaction.initialDistanceMm,
      ),
    )
  }, [loadedCase, mode, pathologySettings, approachPathology])

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
    switch (event.key) {
      case 'ArrowUp':
        applySteer(0, STEER_STEP_DEG)
        break
      case 'ArrowDown':
        applySteer(0, -STEER_STEP_DEG)
        break
      case 'ArrowLeft':
        applySteer(-STEER_STEP_DEG, 0)
        break
      case 'ArrowRight':
        applySteer(STEER_STEP_DEG, 0)
        break
      case 'w':
      case 'W':
        handleMove(moveStep)
        break
      case 's':
      case 'S':
        handleMove(-moveStep)
        break
      case 'q':
      case 'Q':
        handleRollChange((scopeState?.rollDeg ?? 0) - 5)
        break
      case 'e':
      case 'E':
        handleRollChange((scopeState?.rollDeg ?? 0) + 5)
        break
      case 'r':
      case 'R':
        handleRecenter()
        break
      default:
        return
    }
    event.preventDefault()
  }

  const opticalFrame = useMemo(() => (snapshot ? scopeOpticalFrame(snapshot) : null), [snapshot])
  const bloodAmount = bleedingAmount(bleedingClock.elapsed, pathologySettings.bleeding)
  const bloodVisibility =
    mode === 'abnormalities' && !comparingNormal && opticalFrame && pathology.placement && collider
      ? sourceVisibility(opticalFrame, pathology.placement, collider)
      : 0
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
          id="airway-simulator"
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
                      driveQueue.current = 0
                      setComparingNormal(false)
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
                    onClick={() => {
                      driveQueue.current = 0
                      setComparingNormal(false)
                      setMode('challenge')
                    }}
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
                  <button
                    type="button"
                    onClick={() => {
                      setMode('abnormalities')
                      driveQueue.current = 0
                      setComparingNormal(false)
                      setShowXr(false)
                      game.actions.stop()
                      approachPathology(pathologySettings)
                    }}
                    aria-pressed={mode === 'abnormalities'}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === 'abnormalities' ? 'bg-rose-300 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Abnormalities
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
                  disabled={mode === 'abnormalities'}
                  title={
                    mode === 'abnormalities'
                      ? 'The abnormalities prototype is available in the desktop views.'
                      : undefined
                  }
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
                : mode === 'abnormalities'
                  ? 'Inspect synthetic endobronchial findings in the synchronized airway. Select a finding and location in Airway abnormalities, then use the scope controls to approach it. '
                  : 'Drive the scope freely: steer toward an ostium and advance — the scope follows the branch you are pointing at, and the 3D model and CT track the tip in real time. '}
              {loadedCase.manifest.safetyLabel} For education and anatomy correlation only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3 text-xs">
            <div className="flex rounded-md bg-slate-800 p-1" aria-label="Navigation mode">
              <button
                disabled={mode === 'abnormalities'}
                title={
                  mode === 'abnormalities'
                    ? 'Use realistic navigation to preserve scope-to-lesion contact.'
                    : undefined
                }
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
                disabled={
                  !navigationCollider ||
                  comparingNormal ||
                  (mode === 'abnormalities' && !pathology.ready)
                }
                title={!collider ? 'Preparing validated collision geometry' : undefined}
                className={`rounded px-3 py-2 disabled:opacity-40 ${scopeState?.freeFrame ? 'bg-cyan-300 text-slate-950' : 'text-slate-300'}`}
                onClick={() => {
                  driveQueue.current = 0
                  setScopeState((s) =>
                    s && opticalFrame
                      ? navigationCollider!.clearance(opticalFrame.position) <
                        FLEXIBLE_TIP_RADIUS_MM
                        ? {
                            ...s,
                            movementMessage:
                              'Insufficient clearance for the 3.8 mm scope. Withdraw before entering realistic mode.',
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
            {mode === 'abnormalities' && (
              <div className="flex w-full flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                <HoldButton
                  ariaLabel="Withdraw from abnormality"
                  disabled={comparingNormal || !pathology.ready}
                  onTrigger={() => handleMove(-stepMm)}
                  className="rounded border border-slate-600 px-4 py-2 text-slate-200 disabled:opacity-40"
                >
                  ← Withdraw
                </HoldButton>
                <HoldButton
                  ariaLabel="Advance toward abnormality"
                  disabled={comparingNormal || !pathology.ready}
                  onTrigger={() => handleMove(stepMm)}
                  className="rounded border border-cyan-500/40 bg-cyan-400/10 px-4 py-2 text-cyan-100 disabled:opacity-40"
                >
                  Advance →
                </HoldButton>
                <button
                  type="button"
                  onClick={() => handleRollChange(liveRollDeg - 15)}
                  className="rounded border border-slate-600 px-3 py-2 text-slate-200"
                >
                  Rotate left
                </button>
                <button
                  type="button"
                  onClick={() => handleRollChange(liveRollDeg + 15)}
                  className="rounded border border-slate-600 px-3 py-2 text-slate-200"
                >
                  Rotate right
                </button>
                <span className="text-slate-400">Drag in Virtual bronchoscopy to steer.</span>
              </div>
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
                collider={navigationCollider}
                pathology={mode === 'abnormalities' && !comparingNormal ? pathology : undefined}
                bleeding={pathologySettings.bleeding}
                bloodTime={bleedingClock.time}
                bloodElapsed={bleedingClock.elapsed}
                bloodAmount={bloodAmount}
                bloodVisibility={bloodVisibility}
                animateBlood={
                  mode === 'abnormalities' &&
                  !comparingNormal &&
                  !bleedingPaused &&
                  pathologySettings.bleeding !== 'off'
                }
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
                pathology={mode === 'abnormalities' && !comparingNormal ? pathology : undefined}
                bleeding={pathologySettings.bleeding}
                bloodTime={bleedingClock.time}
                bloodElapsed={bleedingClock.elapsed}
              />
            </div>

            <div className="grid gap-3">
              {mode === 'abnormalities' && (
                <PathologyPanel
                  settings={pathologySettings}
                  onChange={changePathology}
                  comparing={comparingNormal}
                  onCompare={() => {
                    driveQueue.current = 0
                    setScopeState((state) =>
                      state ? { ...state, movementMessage: undefined } : state,
                    )
                    setComparingNormal((v) => !v)
                  }}
                  paused={bleedingPaused}
                  onPause={() => setBleedingPaused((v) => !v)}
                  onRestart={() => {
                    setBleedingRestart((v) => v + 1)
                    setBleedingPaused(false)
                  }}
                  onApproach={() => {
                    setComparingNormal(false)
                    approachPathology(pathologySettings)
                  }}
                  ready={pathology.ready}
                  error={pathology.error}
                  onRetry={pathology.retry}
                  projectionMm={pathology.placement?.projectionMm ?? 0}
                  obscured={bloodAmount * bloodVisibility > 0.5}
                />
              )}
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
              {mode === 'abnormalities' && (
                <p className="px-2 text-xs text-amber-100">
                  CT reference: original anatomy. Added abnormalities are visible in the 3D views
                  only.
                </p>
              )}
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

const STEER_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

function SteeringRing({
  onSteer,
  onRecenter,
}: {
  onSteer: (dxUnit: number, dyUpUnit: number) => void
  onRecenter: () => void
}) {
  return (
    <HandoffContent>
      {
        <div className="relative mx-auto mt-2 h-44 w-44">
          {STEER_ANGLES.map((angleDeg) => (
            <SteerButton key={angleDeg} angleDeg={angleDeg} onSteer={onSteer} />
          ))}
          <button
            type="button"
            aria-label="Recenter view"
            title="Recenter view (R)"
            onClick={onRecenter}
            className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-300 transition hover:border-cyan-300 hover:text-cyan-200 active:bg-cyan-400/15"
          >
            <Crosshair className="h-5 w-5" />
          </button>
        </div>
      }
    </HandoffContent>
  )
}

function SteerButton({
  angleDeg,
  onSteer,
}: {
  angleDeg: number
  onSteer: (dxUnit: number, dyUpUnit: number) => void
}) {
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dyUp = Math.cos(rad)
  const hold = useHoldRepeat(() => onSteer(dx, dyUp), 80)
  const left = 50 + 36 * Math.sin(rad)
  const top = 50 - 36 * Math.cos(rad)

  return (
    <HandoffContent>
      {
        <button
          type="button"
          aria-label={`Steer ${angleDeg} degrees clockwise from up`}
          style={{ left: `${left}%`, top: `${top}%` }}
          className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none select-none items-center justify-center rounded-full border border-slate-600 bg-slate-800/90 text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200 active:border-cyan-200 active:bg-cyan-400/20"
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            hold.start()
          }}
          onPointerUp={hold.stop}
          onPointerCancel={hold.stop}
          onLostPointerCapture={hold.stop}
          onClick={(event) => {
            if (event.detail === 0) onSteer(dx, dyUp)
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            style={{ transform: `rotate(${angleDeg}deg)` }}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V6" />
            <path d="m6 11 6-6 6 6" />
          </svg>
        </button>
      }
    </HandoffContent>
  )
}

function HoldButton({
  onTrigger,
  intervalMs,
  className,
  ariaLabel,
  children,
  disabled = false,
}: {
  onTrigger: () => void
  intervalMs?: number
  className?: string
  ariaLabel: string
  children: React.ReactNode
  disabled?: boolean
}) {
  const hold = useHoldRepeat(onTrigger, intervalMs)
  return (
    <HandoffContent>
      {
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={`touch-none select-none ${className ?? ''}`}
          onPointerDown={(event) => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            hold.start()
          }}
          onPointerUp={hold.stop}
          onPointerCancel={hold.stop}
          onLostPointerCapture={hold.stop}
          onClick={(event) => {
            if (event.detail === 0 && !disabled) onTrigger()
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {children}
        </button>
      }
    </HandoffContent>
  )
}

function useHoldRepeat(action: () => void, intervalMs = 90, delayMs = 260) {
  const actionRef = useRef(action)
  useEffect(() => {
    actionRef.current = action
  })
  const timersRef = useRef<{ timeout: number | null; interval: number | null }>({
    timeout: null,
    interval: null,
  })

  const stop = useCallback(() => {
    if (timersRef.current.timeout != null) window.clearTimeout(timersRef.current.timeout)
    if (timersRef.current.interval != null) window.clearInterval(timersRef.current.interval)
    timersRef.current = { timeout: null, interval: null }
  }, [])

  const start = useCallback(() => {
    stop()
    actionRef.current()
    timersRef.current.timeout = window.setTimeout(() => {
      timersRef.current.interval = window.setInterval(() => actionRef.current(), intervalMs)
    }, delayMs)
  }, [delayMs, intervalMs, stop])

  useEffect(() => stop, [stop])

  return { start, stop }
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
  pathology,
  bleeding,
  bloodTime,
  bloodElapsed,
  bloodAmount,
  bloodVisibility,
  animateBlood,
}: {
  pathology?: PathologyScene
  bleeding: BleedingLevel
  bloodTime: React.RefObject<number>
  bloodElapsed: number
  bloodAmount: number
  bloodVisibility: number
  animateBlood: boolean
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
          data-blood-amount={bloodAmount.toFixed(3)}
          data-source-visibility={bloodVisibility.toFixed(3)}
          data-scope-position={pose.tipLps.map((v) => v.toFixed(3)).join(',')}
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
              frameloop={game || animateBlood ? 'always' : 'demand'}
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
                {pathology && (
                  <PathologyMeshes
                    scene={pathology}
                    bleeding={bleeding}
                    time={bloodTime}
                    elapsed={bloodElapsed}
                  />
                )}
              </Suspense>
            </Canvas>
          </div>
          {pathology && (
            <BloodVisibilityOverlay amount={bloodAmount} visibility={bloodVisibility} />
          )}
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

function BronchLabelOverlay({
  ostia,
  pose,
  aspect,
  onAlignBranch,
  collider,
}: {
  collider: LumenCollider | null
  ostia: OstiumLabel[]
  pose: ScopePoseSnapshot
  aspect: number
  onAlignBranch: (edgeId: number) => void
}) {
  const placed = ostia
    .map((ostium) => {
      if (collider && !collider.visible(pose.tipLps, ostium.pointLps)) return null
      const projected = projectToViewport(ostium.pointLps, pose, aspect)
      if (!projected || projected.depthMm < 1.5 || projected.depthMm > 130) return null
      if (
        projected.leftPct < 1 ||
        projected.leftPct > 99 ||
        projected.topPct < 3 ||
        projected.topPct > 97
      ) {
        return null
      }
      return { ...ostium, ...projected }
    })
    .filter((item): item is NonNullable<typeof item> => item != null)

  if (!placed.length) return <HandoffContent>{null}</HandoffContent>

  return (
    <HandoffContent>
      {
        <div className="pointer-events-none absolute inset-0 z-10">
          {placed.map((item) => {
            const labelScale = clamp(34 / item.depthMm, 0.78, 1.35)
            return (
              <button
                type="button"
                key={`${item.abbr}-${item.edgeId}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onAlignBranch(item.edgeId)}
                title={`Align scope toward ${item.abbr}`}
                className="pointer-events-auto absolute cursor-pointer text-center leading-tight transition-opacity hover:opacity-80 focus:outline-none"
                style={{
                  left: `${item.leftPct}%`,
                  top: `${item.topPct}%`,
                  transform: `translate(-50%, -50%) scale(${labelScale})`,
                }}
              >
                <span
                  className="block text-[15px] font-semibold tracking-wide"
                  style={{
                    color: '#8fe3d9',
                    textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)',
                  }}
                >
                  {item.abbr}
                </span>
                {item.descriptor && (
                  <span
                    className="block text-[12px] font-medium"
                    style={{
                      color: '#9ce8de',
                      textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.7)',
                    }}
                  >
                    {item.descriptor}
                  </span>
                )}
              </button>
            )
          })}
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
  pathology,
  bleeding,
  bloodTime,
  bloodElapsed,
}: {
  pathology?: PathologyScene
  bleeding: BleedingLevel
  bloodTime: React.RefObject<number>
  bloodElapsed: number
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
              {pathology && (
                <PathologyMeshes
                  scene={pathology}
                  bleeding={bleeding}
                  time={bloodTime}
                  elapsed={bloodElapsed}
                  external
                />
              )}
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

function AirwaySurface({
  stlUrl,
  transform,
  mode,
}: {
  stlUrl: string | null
  transform: AirwayAnatomyCaseManifest['airwayTransform']
  mode: 'bronch' | 'tree'
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    if (!stlUrl) return
    let cancelled = false
    loadAirwayStlGeometry(stlUrl)
      .then((nextGeometry) => {
        if (!cancelled) {
          setGeometry(nextGeometry)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGeometry(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [stlUrl])

  const material = useMemo(
    () =>
      mode === 'bronch'
        ? createBronchoscopyMaterial()
        : new THREE.MeshStandardMaterial({
            color: '#7dd3fc',
            roughness: 0.55,
            metalness: 0.02,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
          }),
    [mode],
  )

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  if (!stlUrl || !geometry) return <HandoffContent>{null}</HandoffContent>

  return (
    <HandoffContent>
      {
        <mesh
          geometry={geometry}
          material={material}
          scale={transform.sceneScale}
          rotation={transform.rotationDeg.map((deg) => THREE.MathUtils.degToRad(deg)) as Vec3}
          position={transform.positionOffsetMm}
        />
      }
    </HandoffContent>
  )
}

function ScopeCamera({ pose }: { pose: ScopePoseSnapshot }) {
  const { camera, size } = useThree()
  useFrame(() => {
    updateScopeCamera(camera, pose, size.width / Math.max(1, size.height))
  })

  return null
}

function updateScopeCamera(camera: THREE.Camera, pose: ScopePoseSnapshot, aspect: number) {
  const frame = scopeOpticalFrame(pose)
  camera.position.set(...frame.position)
  camera.up.set(...frame.up)
  camera.lookAt(...add(frame.position, frame.forward))
  if (camera instanceof THREE.PerspectiveCamera) {
    const fov = verticalFov(BRONCH_FOV_DEG, aspect)
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }
  camera.updateMatrixWorld()
}

/** Bronchoscope rendered as an insertion tube from the tracheal inlet to the tip. */
function ScopeBody({ graph, pose }: { graph: AirwayGraph; pose: ScopePoseSnapshot }) {
  const pathLps = useMemo(
    () => pose.shaftPathLps ?? buildScopePathLps(graph, pose.edgeId, pose.distanceMm),
    [graph, pose.edgeId, pose.distanceMm, pose.shaftPathLps],
  )

  const tubeGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    let lastKept: Vec3 | null = null
    for (const point of pathLps) {
      if (
        !lastKept ||
        Math.hypot(point[0] - lastKept[0], point[1] - lastKept[1], point[2] - lastKept[2]) >= 2
      ) {
        points.push(new THREE.Vector3(...point))
        lastKept = point
      }
    }
    const tail = pathLps[pathLps.length - 1]
    if (tail && lastKept && lastKept !== tail) {
      points.push(new THREE.Vector3(...tail))
    }
    if (points.length < 2) return null
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
    const segments = Math.min(400, Math.max(24, Math.round(curve.getLength() / 1.5)))
    return new THREE.TubeGeometry(curve, segments, 1.9, 12, false)
  }, [pathLps])

  useEffect(() => () => tubeGeometry?.dispose(), [tubeGeometry])

  const tangent = useMemo(
    () => new THREE.Vector3(...pose.tangentLps).normalize(),
    [pose.tangentLps],
  )
  const tipQuaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent),
    [tangent],
  )
  const viewForward = useMemo(() => scopeOpticalFrame(pose).forward, [pose])
  const beamQuaternion = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(...viewForward).negate(),
      ),
    [viewForward],
  )

  const beamLength = 16
  const tipSegmentPosition = subtract(pose.tipLps, scale(pose.tangentLps, 3.2))
  const beamPosition = add(pose.tipLps, scale(viewForward, beamLength / 2))

  return (
    <HandoffContent>
      {
        <group>
          {tubeGeometry && (
            <mesh geometry={tubeGeometry}>
              <meshStandardMaterial
                color="#3f4754"
                roughness={0.35}
                metalness={0.35}
                emissive="#1e293b"
                emissiveIntensity={0.5}
              />
            </mesh>
          )}
          <mesh position={tipSegmentPosition} quaternion={tipQuaternion}>
            <cylinderGeometry args={[2.1, 2.1, 7, 16]} />
            <meshStandardMaterial
              color="#9ca3af"
              roughness={0.28}
              metalness={0.6}
              emissive="#475569"
              emissiveIntensity={0.4}
            />
          </mesh>
          <mesh position={pose.tipLps}>
            <sphereGeometry args={[1.5, 16, 16]} />
            <meshStandardMaterial color="#eff6ff" emissive="#bfdbfe" emissiveIntensity={2.2} />
          </mesh>
          <mesh position={beamPosition} quaternion={beamQuaternion}>
            <coneGeometry args={[6.5, beamLength, 20, 1, true]} />
            <meshBasicMaterial
              color="#bfdbfe"
              transparent
              opacity={0.15}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <pointLight
            position={pose.tipLps}
            intensity={5}
            distance={34}
            decay={1.4}
            color="#cfe3ff"
          />
        </group>
      }
    </HandoffContent>
  )
}

function Polyline({ points, color, opacity }: { points: Vec3[]; color: string; opacity: number }) {
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry()
    next.setFromPoints(points.map((point) => new THREE.Vector3(...point)))
    return next
  }, [points])
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    [color, opacity],
  )
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  if (points.length < 2) return <HandoffContent>{null}</HandoffContent>
  return <HandoffContent>{<primitive object={line} />}</HandoffContent>
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

function projectToViewport(
  pointLps: Vec3,
  pose: ScopePoseSnapshot,
  aspect: number,
): { leftPct: number; topPct: number; depthMm: number } | null {
  const projected = projectOptical(pointLps, scopeOpticalFrame(pose), aspect, BRONCH_FOV_DEG)
  if (!projected) return null
  return {
    leftPct: (0.5 + projected.x / 2) * 100,
    topPct: (0.5 - projected.y / 2) * 100,
    depthMm: projected.depth,
  }
}

function buildUpcomingOstia(
  index: AirwayGraphIndex,
  labels: CenterlineLabels,
  pose: ScopePoseSnapshot,
  landmarks: AirwayAnatomyCaseManifest['ostialLandmarks'] = [],
): OstiumLabel[] {
  const edge = index.edgesById.get(pose.edgeId)
  if (!edge) return []
  const node = index.nodesById.get(edge.endNodeId)
  if (!node || !node.childEdgeIds.length) return []
  const distanceToNode = pose.edgeLengthMm - pose.distanceMm
  if (distanceToNode > OSTIUM_LABEL_RANGE_MM) return []

  const currentInfo = labels.edgeLabels[String(edge.id)]
  const ostia: OstiumLabel[] = []
  const seenAbbr = new Set<string>()
  for (const childEdgeId of node.childEdgeIds) {
    for (const resolved of resolveOstiaForChild(index, labels, childEdgeId)) {
      const reviewed = landmarks.find((l) => l.edgeId === resolved.steerEdgeId)
      const info = reviewed
        ? { abbreviatedLabel: reviewed.label, fullLabel: reviewed.description }
        : resolved.info
      const abbr = info?.abbreviatedLabel ?? `Branch ${resolved.steerEdgeId}`
      if (info && info.abbreviatedLabel === currentInfo?.abbreviatedLabel) continue
      if (seenAbbr.has(abbr)) continue
      seenAbbr.add(abbr)
      const descriptor = info ? shortAnatomicalLabel(info.fullLabel, info.abbreviatedLabel) : ''
      ostia.push({
        edgeId: resolved.steerEdgeId,
        pointLps: reviewed?.pointLps ?? resolved.pointLps,
        abbr,
        descriptor: descriptor === abbr ? '' : descriptor,
      })
    }
  }
  return ostia
}

/** How short an unlabeled connector can be before we look through it to the next split. */
const CONNECTOR_PASSTHROUGH_MM = 14

interface ResolvedOstium {
  /** The immediate child of the current branch the user must steer into. */
  steerEdgeId: number
  pointLps: Vec3
  info: { abbreviatedLabel: string; fullLabel: string } | undefined
}

/**
 * Map a single child edge to the ostium label(s) the user should see. A labeled
 * child yields itself. A short unlabeled connector that immediately splits (e.g.
 * the RUL stem that opens into RB1 + RB2) is looked through, surfacing the
 * deeper ostia — but the user still steers into the connector edge.
 */
function resolveOstiaForChild(
  index: AirwayGraphIndex,
  labels: CenterlineLabels,
  steerEdgeId: number,
): ResolvedOstium[] {
  const child = index.edgesById.get(steerEdgeId)
  if (!child) return []
  const ostiumPoint = sampleEdgePose(child, Math.min(7, child.lengthMm * 0.6)).point
  const directInfo = labels.edgeLabels[String(steerEdgeId)]
  if (directInfo) {
    return [{ steerEdgeId, pointLps: ostiumPoint, info: directInfo }]
  }

  const endNode = index.nodesById.get(child.endNodeId)
  if (child.lengthMm <= CONNECTOR_PASSTHROUGH_MM && endNode && endNode.childEdgeIds.length > 1) {
    const expanded: ResolvedOstium[] = []
    for (const grandchildId of endNode.childEdgeIds) {
      const grandchild = index.edgesById.get(grandchildId)
      if (!grandchild) continue
      const info =
        labels.edgeLabels[String(grandchildId)] ??
        firstLabeledDescendant(index, labels, grandchildId)
      // Aim at the deeper ostium so tapping RB1 vs RB2 biases the steered
      // descent differently even though both pass through the same connector.
      expanded.push({
        steerEdgeId: grandchildId,
        pointLps: sampleEdgePose(grandchild, Math.min(7, grandchild.lengthMm * 0.6)).point,
        info,
      })
    }
    if (expanded.length) return expanded
  }

  return [
    {
      steerEdgeId,
      pointLps: ostiumPoint,
      info: firstLabeledDescendant(index, labels, steerEdgeId),
    },
  ]
}

function firstLabeledDescendant(
  index: AirwayGraphIndex,
  labels: CenterlineLabels,
  edgeId: number,
): { abbreviatedLabel: string; fullLabel: string } | undefined {
  const queue: number[] = [edgeId]
  let guard = 0
  while (queue.length && guard < 64) {
    guard += 1
    const currentId = queue.shift()
    if (currentId == null) break
    const info = labels.edgeLabels[String(currentId)]
    if (info) return info
    const edge = index.edgesById.get(currentId)
    const node = edge ? index.nodesById.get(edge.endNodeId) : undefined
    // Only follow an unambiguous continuation; a bifurcation introduces a new
    // decision point that should surface as its own labels later.
    if (node?.childEdgeIds.length === 1) {
      queue.push(node.childEdgeIds[0])
    }
  }
  return undefined
}

function shortAnatomicalLabel(fullLabel: string, abbreviatedLabel: string): string {
  if (/^bronchus intermedius$/i.test(fullLabel)) return 'B. Intermedius'
  let label = fullLabel.replace(/\s+Segment$/i, '').replace(/\s+Bronchus$/i, '')
  if (/^[RL]B\d/i.test(abbreviatedLabel)) {
    label = label.replace(/^(Right|Left)\s+(Upper|Middle|Lower)\s+Lobe\s+/i, '')
  }
  return label
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
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

function edgePathToNode(nodeId: number, nodeById: Map<number, AirwayGraphNode>): number[] {
  const reversed: number[] = []
  let current = nodeById.get(nodeId)
  let guard = 0
  while (current?.parentEdgeId != null && guard < nodeById.size + 1) {
    guard += 1
    reversed.push(current.parentEdgeId)
    current = current.parentNodeId == null ? undefined : nodeById.get(current.parentNodeId)
  }
  return reversed.reverse()
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

function AdaptiveViewportQuality() {
  const { size, setDpr } = useThree(),
    quality = useRef(new AdaptiveQuality())
  useEffect(
    () => setDpr(opticalPixelRatio(size.width, window.devicePixelRatio, quality.current.level)),
    [size.width, setDpr],
  )
  useFrame(() => {
    const changed = quality.current.frame(performance.now())
    if (changed) setDpr(opticalPixelRatio(size.width, window.devicePixelRatio, changed))
  })
  return null
}
