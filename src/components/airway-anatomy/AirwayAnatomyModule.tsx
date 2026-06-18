'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { ArrowDown, ArrowUp, Crosshair, Eye, EyeOff, Headset, RotateCcw } from 'lucide-react'
import * as THREE from 'three'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveAdminAirwayAssetPath } from '@/lib/airway-anatomy/admin-assets'
import {
  add,
  clamp,
  ctAxisLength,
  ctIndexToLps,
  dot,
  lpsToCtIndex,
  normalize,
  projectLpsToCanvas,
  scale,
  subtract,
} from '@/lib/airway-anatomy/geometry'
import {
  createBronchoscopyMaterial,
  loadAirwayStlGeometry,
  paintCtSliceGrayscale,
} from '@/lib/airway-anatomy/airway-render'
import { AirwayXRSceneDynamic } from '@/components/airway-anatomy/AirwayXRSceneDynamic'
import {
  alignViewToBranch,
  buildScopePathLps,
  buildScopePoseSnapshot,
  computeViewBasis,
  createGraphIndex,
  createInitialScopeState,
  moveScope,
  sampleEdgePose,
  updateLookOffset,
  type AirwayGraphIndex,
  type ScopeState,
} from '@/lib/airway-anatomy/scope-state'
import type {
  AirwayAnatomyCaseManifest,
  AirwayGraph,
  AirwayGraphNode,
  CenterlineLabels,
  CtAxis,
  ScopePoseSnapshot,
  Vec3,
} from '@/lib/airway-anatomy/types'

const MANIFEST_URL = resolveAdminAirwayAssetPath('/airway-anatomy/case-001/case_manifest.json')
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
  const [ctAxis, setCtAxis] = useState<CtAxis>('axial')
  const [windowPresetId, setWindowPresetId] = useState('lung')
  const [showAnatomyPins, setShowAnatomyPins] = useState(false)
  const [showBranchLabels, setShowBranchLabels] = useState(true)
  const [ctPlaneOpacity, setCtPlaneOpacity] = useState(0.28)
  const [showXr, setShowXr] = useState(false)

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

        const [graph, labels, ctBuffer] = await Promise.all([
          graphResponse.json() as Promise<AirwayGraph>,
          labelsResponse.json() as Promise<CenterlineLabels>,
          ctResponse.arrayBuffer(),
        ])

        if (cancelled) return

        setLoadedCase({
          manifest,
          graph,
          labels,
          ctVolume: new Int16Array(ctBuffer),
        })
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

  const snapshot = useMemo(() => {
    if (!loadedCase || !scopeState) return null
    return buildScopePoseSnapshot({
      state: scopeState,
      graph: loadedCase.graph,
      labels: loadedCase.labels,
      lookAheadMm: loadedCase.manifest.interaction.lookAheadMm,
    })
  }, [loadedCase, scopeState])

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
    return buildUpcomingOstia(graphIndex, loadedCase.labels, snapshot)
  }, [graphIndex, loadedCase, snapshot])

  const stepMm = loadedCase?.manifest.interaction.stepMm ?? 3
  const lookAheadMm = loadedCase?.manifest.interaction.lookAheadMm ?? 12

  const handleMove = useCallback(
    (delta: number) => {
      if (!loadedCase) return
      setScopeState((state) =>
        state
          ? moveScope(state, loadedCase.graph, delta, {
              trailMaxPoints: loadedCase.manifest.interaction.trailMaxPoints,
              lookAheadMm: loadedCase.manifest.interaction.lookAheadMm,
            })
          : state,
      )
    },
    [loadedCase],
  )

  // Screen-space steering: +x steers toward screen-right, +y toward screen-top.
  // Positive yaw rotates the view toward screen-left, so screen-right maps to a
  // negative yaw delta; positive pitch tilts the view up toward screen-top.
  const applySteer = useCallback((screenXDeg: number, screenYUpDeg: number) => {
    setScopeState((state) =>
      state
        ? updateLookOffset(state, {
            yawDeg: state.yawDeg - screenXDeg,
            pitchDeg: state.pitchDeg + screenYUpDeg,
          })
        : state,
    )
  }, [])

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
    setScopeState((state) =>
      state ? updateLookOffset(state, { yawDeg: 0, pitchDeg: 0, rollDeg: 0 }) : state,
    )
  }, [])

  const handleAlignBranch = useCallback(
    (edgeId: number) => {
      if (!loadedCase) return
      setScopeState((state) =>
        state ? alignViewToBranch(state, loadedCase.graph, edgeId, lookAheadMm) : state,
      )
    },
    [loadedCase, lookAheadMm],
  )

  const handleReset = useCallback(() => {
    if (!loadedCase) return
    setScopeState(
      createInitialScopeState(
        loadedCase.graph,
        loadedCase.manifest.interaction.defaultEdgeId,
        loadedCase.manifest.interaction.initialDistanceMm,
      ),
    )
  }, [loadedCase])

  const handleRollChange = (rollDeg: number) => {
    setScopeState((state) => (state ? updateLookOffset(state, { rollDeg }) : state))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
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
      case 'r':
      case 'R':
        handleRecenter()
        break
      default:
        return
    }
    event.preventDefault()
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
        {loadError}
      </div>
    )
  }

  if (!loadedCase || !snapshot || !currentWindow) {
    return (
      <div className="flex min-h-[680px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading synchronized airway case...
      </div>
    )
  }

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-white shadow-sm outline-none"
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
          Drive the scope freely: steer toward an ostium and advance — the scope follows the branch
          you are pointing at, and the 3D model and CT track the tip in real time.{' '}
          {loadedCase.manifest.safetyLabel} For education and anatomy correlation only.
        </p>
      </div>

      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
          <VirtualBronchoscopyViewport
            manifest={loadedCase.manifest}
            pose={snapshot}
            ostia={upcomingOstia}
            showBranchLabels={showBranchLabels}
            location={currentLocation}
            onLookDrag={handleLookDrag}
            onAlignBranch={handleAlignBranch}
          />
          <AirwayTreeViewport
            manifest={loadedCase.manifest}
            graph={loadedCase.graph}
            targets={airwayTargets}
            pose={snapshot}
            showAnatomyPins={showAnatomyPins}
            ctVolume={loadedCase.ctVolume}
            windowLow={currentWindow.low}
            windowHigh={currentWindow.high}
            ctPlaneOpacity={ctPlaneOpacity}
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
            showBranchLabels={showBranchLabels}
            onShowBranchLabelsChange={setShowBranchLabels}
          />
          <CtSliceViewport
            ct={loadedCase.manifest.ct}
            volume={loadedCase.ctVolume}
            axis={ctAxis}
            pose={snapshot}
            trail={snapshot.trailLps}
            windowLow={currentWindow.low}
            windowHigh={currentWindow.high}
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
          />
        </div>
      ) : null}
    </section>
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
  showBranchLabels,
  onShowBranchLabelsChange,
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
  showBranchLabels: boolean
  onShowBranchLabelsChange: (value: boolean) => void
}) {
  const branchProgress =
    pose.edgeLengthMm > 0 ? clamp(pose.distanceMm / pose.edgeLengthMm, 0, 1) : 0

  return (
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
          yaw {Math.round(pose.yawDeg)}° · pitch {Math.round(pose.pitchDeg)}°
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
            <span>Scope roll</span>
            <span>{Math.round(pose.rollDeg)} deg</span>
          </span>
          <input
            type="range"
            min={-90}
            max={90}
            step={1}
            value={pose.rollDeg}
            onChange={(event) => onRollChange(Number(event.target.value))}
            className="w-full accent-cyan-300"
          />
        </label>
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
  )
}

function HoldButton({
  onTrigger,
  intervalMs,
  className,
  ariaLabel,
  children,
}: {
  onTrigger: () => void
  intervalMs?: number
  className?: string
  ariaLabel: string
  children: React.ReactNode
}) {
  const hold = useHoldRepeat(onTrigger, intervalMs)
  return (
    <button
      type="button"
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
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
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

function VirtualBronchoscopyViewport({
  manifest,
  pose,
  ostia,
  showBranchLabels,
  location,
  onLookDrag,
  onAlignBranch,
}: {
  manifest: AirwayAnatomyCaseManifest
  pose: ScopePoseSnapshot
  ostia: OstiumLabel[]
  showBranchLabels: boolean
  location: CurrentLocation
  onLookDrag: (dxPx: number, dyPx: number) => void
  onAlignBranch: (edgeId: number) => void
}) {
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>()
  const aspect = size.height > 0 ? size.width / size.height : 16 / 9

  return (
    <div
      ref={containerRef}
      className={`${VIEWPORT_CLASS} touch-none select-none`}
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
          dpr={[1, 2]}
          camera={{ fov: BRONCH_FOV_DEG, near: 0.06, far: 900, position: pose.tipLps }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={[0x070201]} />
          <ambientLight intensity={0.55} color={0xffc4a6} />
          <Suspense fallback={null}>
            <AirwaySurface
              stlUrl={
                manifest.assets.airwayStl
                  ? resolveAdminAirwayAssetPath(manifest.assets.airwayStl)
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
        />
      )}
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-950/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
        Virtual bronchoscopy
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-baseline gap-1.5 whitespace-nowrap rounded-full border border-cyan-300/25 bg-slate-950/85 px-3 py-1 text-xs">
        <span className="font-bold text-cyan-200">{location.abbr}</span>
        <span className="text-slate-300">{location.name}</span>
        <span className="text-slate-500">· {Math.round(pose.distanceMm)} mm</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-slate-950/75 px-2 py-1 text-[11px] text-slate-400">
        drag to look
      </div>
    </div>
  )
}

function BronchLabelOverlay({
  ostia,
  pose,
  aspect,
  onAlignBranch,
}: {
  ostia: OstiumLabel[]
  pose: ScopePoseSnapshot
  aspect: number
  onAlignBranch: (edgeId: number) => void
}) {
  const placed = ostia
    .map((ostium) => {
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

  if (!placed.length) return null

  return (
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
  )
}

function AirwayTreeViewport({
  manifest,
  graph,
  targets,
  pose,
  showAnatomyPins,
  ctVolume,
  windowLow,
  windowHigh,
  ctPlaneOpacity,
}: {
  manifest: AirwayAnatomyCaseManifest
  graph: AirwayGraph
  targets: AirwayTarget[]
  pose: ScopePoseSnapshot
  showAnatomyPins: boolean
  ctVolume: Int16Array
  windowLow: number
  windowHigh: number
  ctPlaneOpacity: number
}) {
  const bounds = useMemo(() => boundsForGraph(graph), [graph])
  const cameraPosition: Vec3 = [
    bounds.center[0] + bounds.radius * 0.95,
    bounds.center[1] - bounds.radius * 1.35,
    bounds.center[2] + bounds.radius * 0.55,
  ]

  return (
    <div className={VIEWPORT_CLASS}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 34, near: 0.5, far: bounds.radius * 12, position: cameraPosition }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={[0x040812]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[180, -260, 120]} intensity={1.15} />
        <directionalLight position={[-120, 180, -100]} intensity={0.35} color={0x9bb8ff} />
        <Suspense fallback={null}>
          <AirwaySurface
            stlUrl={
              manifest.assets.airwayStl
                ? resolveAdminAirwayAssetPath(manifest.assets.airwayStl)
                : null
            }
            transform={manifest.airwaySurfaceTransform ?? manifest.airwayTransform}
            mode="tree"
          />
          <CtAxialPlane
            ct={manifest.ct}
            volume={ctVolume}
            pose={pose}
            windowLow={windowLow}
            windowHigh={windowHigh}
            opacity={ctPlaneOpacity}
          />
          <group>
            {graph.edges.map((edge) => (
              <Polyline
                key={edge.id}
                points={edge.pointsLps}
                color={edge.id === pose.edgeId ? '#fbbf24' : '#38bdf8'}
                opacity={edge.id === pose.edgeId ? 0.85 : 0.2}
              />
            ))}
            <ScopeBody graph={graph} pose={pose} />
          </group>
          {showAnatomyPins && <SceneLabels targets={targets} />}
        </Suspense>
        <OrbitControls target={bounds.center} enablePan enableRotate enableZoom />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-950/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
        3D airway correlation
      </div>
    </div>
  )
}

function CtSliceViewport({
  ct,
  volume,
  axis,
  pose,
  trail,
  windowLow,
  windowHigh,
}: {
  ct: AirwayAnatomyCaseManifest['ct']
  volume: Int16Array
  axis: CtAxis
  pose: ScopePoseSnapshot
  trail: Vec3[]
  windowLow: number
  windowHigh: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const tipIndex = useMemo(() => lpsToCtIndex(pose.tipLps, ct), [ct, pose.tipLps])
  const sliceIndex = Math.round(
    axis === 'axial' ? tipIndex[2] : axis === 'coronal' ? tipIndex[1] : tipIndex[0],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawCtSlice({
      canvas,
      ct,
      volume,
      axis,
      sliceIndex,
      windowLow,
      windowHigh,
      pose,
      trail,
    })
  }, [axis, ct, pose, sliceIndex, trail, volume, windowHigh, windowLow])

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            CT slice
          </div>
          <div className="text-sm text-slate-200">
            IJK {tipIndex.map((value) => Math.round(value)).join(', ')}
          </div>
        </div>
        <div className="rounded bg-slate-950 px-2 py-1 text-xs text-slate-300">
          {axis} {clamp(sliceIndex, 0, ctAxisLength(ct, axis) - 1)}
        </div>
      </div>
      <div className="relative aspect-square overflow-hidden rounded-md border border-slate-800 bg-black">
        <canvas ref={canvasRef} className="h-full w-full object-contain" />
      </div>
    </div>
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

  if (!stlUrl || !geometry) return null

  return (
    <mesh
      geometry={geometry}
      material={material}
      scale={transform.sceneScale}
      rotation={transform.rotationDeg.map((deg) => THREE.MathUtils.degToRad(deg)) as Vec3}
      position={transform.positionOffsetMm}
    />
  )
}

function ScopeCamera({ pose }: { pose: ScopePoseSnapshot }) {
  const { camera } = useThree()
  const lightRef = useRef<THREE.PointLight>(null)
  // The orientation target must be a Camera, not a plain Object3D: their
  // lookAt() conventions are opposite (a camera points its -Z at the target,
  // an Object3D points +Z), so a plain dummy would aim the view backward.
  const dummyRef = useRef<THREE.Camera | null>(null)
  const initializedRef = useRef(false)

  useFrame((_, delta) => {
    if (!dummyRef.current) dummyRef.current = new THREE.PerspectiveCamera()
    const dummy = dummyRef.current

    const tip = new THREE.Vector3(...pose.tipLps)
    const base = normalize(subtract(pose.lookAtLps, pose.tipLps), pose.tangentLps)
    const { forward, up } = computeViewBasis(base, pose.yawDeg, pose.pitchDeg, 0)

    dummy.position.copy(tip)
    dummy.up.set(...up)
    dummy.lookAt(tip.x + forward[0], tip.y + forward[1], tip.z + forward[2])
    dummy.rotateZ(THREE.MathUtils.degToRad(pose.rollDeg))

    // Critically damped chase keeps motion smooth without feeling laggy.
    const k = 1 - Math.exp(-Math.min(delta || 0.016, 0.1) * 11)
    if (!initializedRef.current || camera.position.distanceTo(tip) > 28) {
      camera.position.copy(tip)
      camera.quaternion.copy(dummy.quaternion)
      initializedRef.current = true
    } else {
      camera.position.lerp(tip, k)
      camera.quaternion.slerp(dummy.quaternion, k)
    }
    camera.up.copy(dummy.up)
    lightRef.current?.position.copy(camera.position)
  })

  return <pointLight ref={lightRef} intensity={20} distance={190} decay={1.05} color={0xfff0e0} />
}

/** Bronchoscope rendered as an insertion tube from the tracheal inlet to the tip. */
function ScopeBody({ graph, pose }: { graph: AirwayGraph; pose: ScopePoseSnapshot }) {
  const pathLps = useMemo(
    () => buildScopePathLps(graph, pose.edgeId, pose.distanceMm),
    [graph, pose.edgeId, pose.distanceMm],
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
  const viewForward = useMemo(() => {
    const base = normalize(subtract(pose.lookAtLps, pose.tipLps), pose.tangentLps)
    return computeViewBasis(base, pose.yawDeg, pose.pitchDeg, 0).forward
  }, [pose.lookAtLps, pose.pitchDeg, pose.tangentLps, pose.tipLps, pose.yawDeg])
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
      <pointLight position={pose.tipLps} intensity={5} distance={34} decay={1.4} color="#cfe3ff" />
    </group>
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

  if (points.length < 2) return null
  return <primitive object={line} />
}

function SceneLabels({ targets }: { targets: AirwayTarget[] }) {
  return (
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
  )
}

function CtAxialPlane({
  ct,
  volume,
  pose,
  windowLow,
  windowHigh,
  opacity,
}: {
  ct: AirwayAnatomyCaseManifest['ct']
  volume: Int16Array
  pose: ScopePoseSnapshot
  windowLow: number
  windowHigh: number
  opacity: number
}) {
  const texture = useMemo(() => {
    if (opacity <= 0.01) return null
    const canvas = document.createElement('canvas')
    const sliceIndex = Math.round(lpsToCtIndex(pose.tipLps, ct)[2])
    drawCtSlice({
      canvas,
      ct,
      volume,
      axis: 'axial',
      sliceIndex,
      windowLow,
      windowHigh,
      pose,
      trail: [],
    })
    const nextTexture = new THREE.CanvasTexture(canvas)
    nextTexture.colorSpace = THREE.SRGBColorSpace
    return nextTexture
  }, [ct, opacity, pose, volume, windowHigh, windowLow])

  useEffect(() => () => texture?.dispose(), [texture])

  if (!texture || opacity <= 0.01) return null

  const [i, j, k] = lpsToCtIndex(pose.tipLps, ct)
  const center = ctIndexToLps([(ct.sizeXyz[0] - 1) / 2, (ct.sizeXyz[1] - 1) / 2, Math.round(k)], ct)
  const width = (ct.sizeXyz[0] - 1) * ct.spacingXyzMm[0]
  const height = (ct.sizeXyz[1] - 1) * ct.spacingXyzMm[1]
  void i
  void j

  return (
    <mesh position={center} scale={[1, -1, 1]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function drawCtSlice({
  canvas,
  ct,
  volume,
  axis,
  sliceIndex,
  windowLow,
  windowHigh,
  pose,
  trail,
}: {
  canvas: HTMLCanvasElement
  ct: AirwayAnatomyCaseManifest['ct']
  volume: Int16Array
  axis: CtAxis
  sliceIndex: number
  windowLow: number
  windowHigh: number
  pose: ScopePoseSnapshot
  trail: Vec3[]
}) {
  const painted = paintCtSliceGrayscale({
    canvas,
    ct,
    volume,
    axis,
    sliceIndex,
    windowLow,
    windowHigh,
  })
  if (!painted) return
  const context = canvas.getContext('2d')
  if (!context) return
  drawTrailOnCt(context, ct, axis, painted.clampedSlice, trail)
  drawScopeTipMarker(context, ct, axis, painted.clampedSlice, pose)
}

function drawScopeTipMarker(
  context: CanvasRenderingContext2D,
  ct: AirwayAnatomyCaseManifest['ct'],
  axis: CtAxis,
  sliceIndex: number,
  pose: ScopePoseSnapshot,
) {
  const projected = projectLpsToCanvas(
    pose.tipLps,
    axis,
    sliceIndex,
    ct,
    context.canvas.width,
    context.canvas.height,
  )
  if (!projected.inFrame) return

  const aheadLps = add(pose.tipLps, scale(normalize(pose.tangentLps), 9))
  const ahead = projectLpsToCanvas(
    aheadLps,
    axis,
    sliceIndex,
    ct,
    context.canvas.width,
    context.canvas.height,
  )
  let headingX = ahead.x - projected.x
  let headingY = ahead.y - projected.y
  const headingLength = Math.hypot(headingX, headingY)

  context.save()

  const glow = context.createRadialGradient(
    projected.x,
    projected.y,
    0,
    projected.x,
    projected.y,
    13,
  )
  glow.addColorStop(0, 'rgba(34, 211, 238, 0.45)')
  glow.addColorStop(1, 'rgba(34, 211, 238, 0)')
  context.fillStyle = glow
  context.beginPath()
  context.arc(projected.x, projected.y, 13, 0, Math.PI * 2)
  context.fill()

  if (headingLength > 1.5) {
    headingX /= headingLength
    headingY /= headingLength
    context.strokeStyle = 'rgba(125, 211, 252, 0.95)'
    context.lineWidth = 2
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(projected.x + headingX * 6.5, projected.y + headingY * 6.5)
    context.lineTo(projected.x + headingX * 15, projected.y + headingY * 15)
    context.stroke()
    // Arrowhead
    const perpX = -headingY
    const perpY = headingX
    context.beginPath()
    context.moveTo(projected.x + headingX * 18, projected.y + headingY * 18)
    context.lineTo(projected.x + headingX * 13 + perpX * 3, projected.y + headingY * 13 + perpY * 3)
    context.lineTo(projected.x + headingX * 13 - perpX * 3, projected.y + headingY * 13 - perpY * 3)
    context.closePath()
    context.fillStyle = 'rgba(125, 211, 252, 0.95)'
    context.fill()
  }

  context.strokeStyle = 'rgba(2, 6, 23, 0.85)'
  context.lineWidth = 3.5
  context.beginPath()
  context.arc(projected.x, projected.y, 5.5, 0, Math.PI * 2)
  context.stroke()
  context.strokeStyle = '#f8fafc'
  context.lineWidth = 1.8
  context.beginPath()
  context.arc(projected.x, projected.y, 5.5, 0, Math.PI * 2)
  context.stroke()

  context.fillStyle = '#22d3ee'
  context.beginPath()
  context.arc(projected.x, projected.y, 2.2, 0, Math.PI * 2)
  context.fill()

  context.restore()
}

function drawTrailOnCt(
  context: CanvasRenderingContext2D,
  ct: AirwayAnatomyCaseManifest['ct'],
  axis: CtAxis,
  sliceIndex: number,
  trail: Vec3[],
) {
  if (trail.length < 2) return
  context.save()
  context.lineWidth = 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (let index = 1; index < trail.length; index += 1) {
    const fromProjected = projectLpsToCanvas(
      trail[index - 1],
      axis,
      sliceIndex,
      ct,
      context.canvas.width,
      context.canvas.height,
    )
    const toProjected = projectLpsToCanvas(
      trail[index],
      axis,
      sliceIndex,
      ct,
      context.canvas.width,
      context.canvas.height,
    )
    if (!fromProjected.inFrame || !toProjected.inFrame) continue
    const sliceDistance = Math.max(fromProjected.distanceFromSlice, toProjected.distanceFromSlice)
    if (sliceDistance > 3) continue
    const alpha = (1 - sliceDistance / 3) * 0.85
    context.strokeStyle = `rgba(45, 212, 191, ${alpha.toFixed(3)})`
    context.beginPath()
    context.moveTo(fromProjected.x, fromProjected.y)
    context.lineTo(toProjected.x, toProjected.y)
    context.stroke()
  }
  context.restore()
}

/**
 * Project an LPS point into the bronchoscopy viewport. Mirrors the camera
 * basis in ScopeCamera, so HTML overlays land on top of the rendered anatomy.
 * Screen +up (anterior) maps to a smaller top%, matching the un-flipped canvas.
 */
function projectToViewport(
  pointLps: Vec3,
  pose: ScopePoseSnapshot,
  aspect: number,
): { leftPct: number; topPct: number; depthMm: number } | null {
  const base = normalize(subtract(pose.lookAtLps, pose.tipLps), pose.tangentLps)
  const { forward, right, up } = computeViewBasis(base, pose.yawDeg, pose.pitchDeg, pose.rollDeg)
  const offset = subtract(pointLps, pose.tipLps)
  const depthMm = dot(offset, forward)
  if (depthMm < 1.5) return null
  const tanHalfFov = Math.tan((BRONCH_FOV_DEG * Math.PI) / 360)
  const ndcX = dot(offset, right) / (depthMm * tanHalfFov * Math.max(aspect, 0.1))
  const ndcY = dot(offset, up) / (depthMm * tanHalfFov)
  return {
    leftPct: (0.5 + ndcX / 2) * 100,
    topPct: (0.5 - ndcY / 2) * 100,
    depthMm,
  }
}

function buildUpcomingOstia(
  index: AirwayGraphIndex,
  labels: CenterlineLabels,
  pose: ScopePoseSnapshot,
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
      const info = resolved.info
      const abbr = info?.abbreviatedLabel ?? `Branch ${resolved.steerEdgeId}`
      if (info && info.abbreviatedLabel === currentInfo?.abbreviatedLabel) continue
      if (seenAbbr.has(abbr)) continue
      seenAbbr.add(abbr)
      const descriptor = info ? shortAnatomicalLabel(info.fullLabel, info.abbreviatedLabel) : ''
      ostia.push({
        edgeId: resolved.steerEdgeId,
        pointLps: resolved.pointLps,
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
